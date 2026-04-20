import https from "https";
import logger from "../config/logger.js";

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

  // Handle 12-hour format like "9:30 AM" or "1:00 PM"
  const ampmMatch = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}:00`;
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
            logger.error(`[ClassSync] API returned invalid JSON. Status: ${res.statusCode}, Raw (first 500 chars): ${raw.slice(0, 500)}`);
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

/**
 * Case-insensitive property getter. Stingray API may return keys in
 * different casings (e.g., "Courses" vs "courses", "CourseID" vs "courseId").
 */
const getField = (obj, ...candidates) => {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of candidates) {
    if (obj[key] !== undefined) return obj[key];
  }
  // Try case-insensitive lookup
  const lowerMap = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const key of candidates) {
    const realKey = lowerMap.get(key.toLowerCase());
    if (realKey !== undefined && obj[realKey] !== undefined) return obj[realKey];
  }
  return undefined;
};

export const fetchStudentSchedule = async ({ email, termCode }) => {
  if (!email) {
    const error = new Error("Student email is required to fetch class schedule.");
    error.statusCode = 400;
    throw error;
  }

  const resolvedTermCode = termCode || getCurrentTermCode();
  const url = `${STUDENT_SCHEDULE_API_BASE}/${encodeURIComponent(email)}/${encodeURIComponent(resolvedTermCode)}`;

  logger.info(`[ClassSync] Fetching schedule: ${url}`);

  const payload = await httpsRequestJson(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  // Log the raw response structure for debugging
  const topKeys = payload ? Object.keys(payload) : [];
  logger.info(`[ClassSync] API response keys: [${topKeys.join(", ")}]`);

  const success = getField(payload, "Success", "success");
  if (!payload || (success !== "True" && success !== true && success !== "true")) {
    const message = String(
      getField(payload, "Message", "message") ||
      "Class schedule API returned unsuccessful response."
    );
    logger.warn(`[ClassSync] API unsuccessful. Success="${success}", Message="${message}"`);
    const error = new Error(message);
    error.statusCode = /user does not exist/i.test(message) ? 404 : 502;
    throw error;
  }

  // Log course count
  const courses = getField(payload, "Courses", "courses", "Schedule", "schedule", "Classes", "classes");
  const courseCount = Array.isArray(courses) ? courses.length : 0;
  logger.info(`[ClassSync] Success=True, found ${courseCount} courses for ${email} (term: ${resolvedTermCode})`);

  if (courseCount > 0 && courses[0]) {
    const sampleKeys = Object.keys(courses[0]);
    logger.info(`[ClassSync] Sample course keys: [${sampleKeys.join(", ")}]`);
    // Log first course meeting structure
    const meetings = getField(courses[0], "meeting_times", "MeetingTimes", "meetingTimes", "meetings", "Meetings", "Times", "schedule");
    if (meetings && meetings[0]) {
      logger.info(`[ClassSync] Sample meeting keys: [${Object.keys(meetings[0]).join(", ")}]`);
      logger.info(`[ClassSync] Sample meeting: ${JSON.stringify(meetings[0])}`);
    } else {
      logger.warn(`[ClassSync] First course has no recognizable meeting_times field. Course data: ${JSON.stringify(courses[0]).slice(0, 300)}`);
    }
  }

  return {
    termCode: resolvedTermCode,
    payload,
  };
};

export const normalizeScheduleToAvailabilityBlocks = (schedulePayload) => {
  // Try multiple possible keys for the courses array
  const courses = (
    getField(schedulePayload, "Courses", "courses", "Schedule", "schedule", "Classes", "classes")
    || []
  );
  if (!Array.isArray(courses)) {
    logger.warn(`[ClassSync] Courses field is not an array: ${typeof courses}`);
    return [];
  }

  const dedupe = new Map();

  for (const course of courses) {
    const courseId = String(
      getField(course, "CourseID", "courseId", "course_id", "Id", "id", "SectionID", "sectionId", "CRN") ||
      "unknown_course"
    );

    // Try multiple possible keys for meeting times
    const meetings = (
      getField(course, "meeting_times", "MeetingTimes", "meetingTimes", "meetings", "Meetings", "Times", "schedule") ||
      []
    );

    if (!Array.isArray(meetings)) {
      logger.warn(`[ClassSync] Course ${courseId} has non-array meetings: ${typeof meetings}`);
      continue;
    }

    for (const meeting of meetings) {
      // Try multiple keys for days
      let days = getField(meeting, "days", "Days", "DaysOfWeek", "daysOfWeek", "day_codes");
      // Handle comma-separated string: "M,W,F" or "MWF"
      if (typeof days === "string") {
        if (days.includes(",")) {
          days = days.split(",").map((d) => d.trim());
        } else {
          // Parse "MWF" or "TTH" style
          days = parseDayString(days);
        }
      }
      if (!Array.isArray(days)) {
        logger.warn(`[ClassSync] Meeting in ${courseId} has no parseable days: ${JSON.stringify(days)}`);
        continue;
      }

      // Try multiple keys for times
      const rawStart = getField(meeting, "start_time", "StartTime", "startTime", "start", "Begin", "begin_time");
      const rawEnd = getField(meeting, "end_time", "EndTime", "endTime", "end", "End", "end_time_display");

      const startTime = normalizeTime(rawStart);
      const endTime = normalizeTime(rawEnd);

      if (!startTime || !endTime || startTime >= endTime) {
        if (rawStart || rawEnd) {
          logger.warn(`[ClassSync] Skipping meeting in ${courseId}: could not normalize times. raw_start="${rawStart}", raw_end="${rawEnd}", normalized="${startTime}"-"${endTime}"`);
        }
        continue;
      }

      for (const codeRaw of days) {
        const code = String(codeRaw || "").toUpperCase().trim();
        const dayOfWeek = DAY_CODE_TO_WEEKDAY[code];
        if (dayOfWeek === undefined) {
          logger.warn(`[ClassSync] Unknown day code "${code}" in course ${courseId}`);
          continue;
        }

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

  logger.info(`[ClassSync] Normalized ${dedupe.size} availability blocks from ${courses.length} courses`);
  return Array.from(dedupe.values());
};

/**
 * Parse a concatenated day string like "MWF" or "TTH" or "MTWRF" into day codes.
 */
const parseDayString = (str) => {
  const result = [];
  let i = 0;
  const s = str.toUpperCase().trim();
  while (i < s.length) {
    // Try two-char codes first (TH, SU)
    if (i + 1 < s.length) {
      const two = s.slice(i, i + 2);
      if (DAY_CODE_TO_WEEKDAY[two] !== undefined) {
        result.push(two);
        i += 2;
        continue;
      }
    }
    // Single char
    const one = s[i];
    if (DAY_CODE_TO_WEEKDAY[one] !== undefined) {
      result.push(one);
    }
    i += 1;
  }
  return result;
};
