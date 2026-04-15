import https from "https";

const STUDENT_SCHEDULE_API_BASE = "https://stingray.oc.edu/api/accommodationuserschedule";

const DAY_CODE_TO_WEEKDAY = {
  M: 1,
  T: 2,
  W: 3,
  TH: 4,
  F: 5,
  S: 6,
  SU: 0,
};

const normalizeTime = (value) => {
  if (!value) return null;
  const text = String(value).trim();

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) return text;
  if (/^\d{1,2}:\d{2}$/.test(text)) return `${text}:00`;

  // Supports values like "0930" or "930"
  if (/^\d{3,4}$/.test(text)) {
    const padded = text.padStart(4, "0");
    return `${padded.slice(0, 2)}:${padded.slice(2)}:00`;
  }

  return null;
};

const getCurrentTermCode = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month >= 1 && month <= 5) return `${year}SP`;
  if (month >= 6 && month <= 7) return `${year}SU`;
  return `${year}FA`;
};

const httpsRequestJson = (url, { method = "GET", headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let raw = "";

      res.on("data", (chunk) => {
        raw += chunk;
      });

      res.on("end", () => {
        let payload = {};

        if (raw) {
          try {
            payload = JSON.parse(raw);
          } catch (error) {
            const parseError = new Error(`Class schedule API returned invalid JSON (status ${res.statusCode}).`);
            parseError.statusCode = 502;
            reject(parseError);
            return;
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(payload);
          return;
        }

        const message =
          payload?.Message ||
          payload?.message ||
          `Class schedule API error (${res.statusCode}).`;
        const error = new Error(message);
        error.statusCode = res.statusCode >= 400 && res.statusCode < 500 ? res.statusCode : 502;
        reject(error);
      });
    });

    req.on("error", (error) => {
      error.statusCode = error.statusCode || 502;
      reject(error);
    });

    req.end();
  });

export const fetchStudentSchedule = async ({ email, termCode }) => {
  if (!email) {
    const error = new Error("Student email is required to fetch class schedule.");
    error.statusCode = 400;
    throw error;
  }

  const resolvedTermCode = termCode || getCurrentTermCode();
  const url = `${STUDENT_SCHEDULE_API_BASE}/${encodeURIComponent(email)}/${encodeURIComponent(resolvedTermCode)}`;

  const payload = await httpsRequestJson(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!payload || payload.Success !== "True") {
    const message = String(payload?.Message || "Class schedule API returned unsuccessful response.");
    const error = new Error(message);
    error.statusCode = /user does not exist/i.test(message) ? 404 : 502;
    throw error;
  }

  return {
    termCode: resolvedTermCode,
    payload,
  };
};

export const normalizeScheduleToAvailabilityBlocks = (schedulePayload) => {
  const courses = Array.isArray(schedulePayload?.Courses) ? schedulePayload.Courses : [];
  const dedupe = new Map();

  for (const course of courses) {
    const courseId = String(course?.CourseID || "unknown_course");
    const meetings = Array.isArray(course?.meeting_times) ? course.meeting_times : [];

    for (const meeting of meetings) {
      const days = Array.isArray(meeting?.days) ? meeting.days : [];
      const startTime = normalizeTime(meeting?.start_time);
      const endTime = normalizeTime(meeting?.end_time);

      if (!startTime || !endTime || startTime >= endTime) continue;

      for (const codeRaw of days) {
        const code = String(codeRaw || "").toUpperCase();
        const dayOfWeek = DAY_CODE_TO_WEEKDAY[code];
        if (dayOfWeek === undefined) continue;

        const sourceRef = `${courseId}:${code}:${startTime}-${endTime}`;
        const key = `${dayOfWeek}|${startTime}|${endTime}|${sourceRef}`;

        dedupe.set(key, {
          dayOfWeek,
          startTime,
          endTime,
          availabilityType: "unavailable",
          isRecurring: true,
          recurrencePattern: "class_schedule",
          sourceType: "class_schedule",
          sourceRef,
          isSystemManaged: true,
          requestStatus: "approved",
          requestNotes: `Auto-synced from class schedule (${sourceRef})`,
        });
      }
    }
  }

  return Array.from(dedupe.values());
};
