import db from "../models/index.js";
import { Op } from "sequelize";
import { sendNotification } from "../services/notificationService.js";
import logger from "../config/logger.js";

const Shift = db.shift;
const UserDepartment = db.userDepartment;
const Availability = db.availability;
const ShiftAcknowledgement = db.shiftAcknowledgement;
const ShiftAudit = db.shiftAudit;
const User = db.user;
const TimeOffRequest = db.timeOffRequest;

const SHIFT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  CHANGED: "changed",
  CANCELLED: "cancelled",
};

const shiftIncludes = [
  { model: db.department, as: "department" },
  { model: db.position, as: "position" },
  { model: db.scheduleTemplate, as: "template" },
  { model: db.user, as: "assignedUser" },
  { model: db.user, as: "creator" },
  { model: db.shiftAcknowledgement, as: "acknowledgements" },
  {
    model: db.taskList,
    as: "taskList",
    required: false,
    include: [{ model: db.taskListItem, as: "items" }],
  },
];

// Normalize a time value (TIME column, "HH:MM", "HH:MM:SS", or Date) into
// minutes-since-midnight. Returns null on garbage input so callers can bail
// out safely instead of silently passing validation.
const toMinutes = (timeValue) => {
  if (timeValue == null) return null;
  const text = String(timeValue).trim();
  if (!text) return null;
  const parts = text.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
};

// Coerce Sequelize DATEONLY (string), ISO string, or Date to "YYYY-MM-DD".
// Returns null if we can't derive a valid local date (caller should treat
// that as a validation failure rather than a pass).
const toIsoDate = (dateValue) => {
  if (dateValue == null) return null;
  if (dateValue instanceof Date) {
    if (Number.isNaN(dateValue.getTime())) return null;
    const y = dateValue.getFullYear();
    const m = String(dateValue.getMonth() + 1).padStart(2, "0");
    const d = String(dateValue.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = String(dateValue).trim();
  if (!text) return null;
  // Accept "YYYY-MM-DD" directly.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // Accept "YYYY-MM-DDTHH:MM..." by slicing the date portion.
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const getDayOfWeekFromDate = (dateValue) => {
  const iso = toIsoDate(dateValue);
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
};

// Shared Op.or fragment: every place in the codebase that identifies a
// class-schedule-derived availability row checks all three markers. Mirror
// that here so we never silently miss class rows written by older code
// paths that only stamped one or two of the fields.
const CLASS_SCHEDULE_MARKERS = [
  { sourceType: "class_schedule" },
  { recurrencePattern: "class_schedule" },
  { isSystemManaged: true },
];

const deriveShiftStatus = (shift) => {
  if (shift?.trade_status === SHIFT_STATUS.CANCELLED) {
    return SHIFT_STATUS.CANCELLED;
  }
  if (shift?.trade_status === SHIFT_STATUS.CHANGED) {
    return SHIFT_STATUS.CHANGED;
  }
  if (shift?.is_published) {
    return SHIFT_STATUS.PUBLISHED;
  }
  return SHIFT_STATUS.DRAFT;
};

const withShiftStatus = (shift) => {
  const payload = typeof shift?.toJSON === "function" ? shift.toJSON() : shift;
  return {
    ...payload,
    shift_status: deriveShiftStatus(shift),
  };
};

const intervalsOverlap = (startA, endA, startB, endB) =>
  startA < endB && startB < endA;

const dateFromIso = (isoDate) => new Date(`${isoDate}T00:00:00`);
const isoFromDate = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const syncWeeklyRecurringSeries = async (baseShift, actorUserId) => {
  if (!baseShift?.is_recurring || !baseShift?.shift_date || !baseShift?.recurrence_end_date) return;

  const pattern = baseShift.recurrence_pattern || "weekly";
  const step = pattern === "daily" ? 1 : 7;
  const recurrenceStart = baseShift.recurrence_start_date || baseShift.shift_date;
  const startDate = dateFromIso(baseShift.shift_date);
  const endDate = dateFromIso(baseShift.recurrence_end_date);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return;

  // Find existing series rows that belong to this same recurrence group.
  const existingFutureShifts = await Shift.findAll({
    where: {
      shift_id: { [Op.ne]: baseShift.shift_id },
      department_id: baseShift.department_id,
      created_by: baseShift.created_by,
      is_recurring: true,
      recurrence_pattern: pattern,
      recurrence_start_date: recurrenceStart,
      shift_date: { [Op.gte]: baseShift.shift_date },
    },
  });

  const existingByDate = new Map(
    existingFutureShifts
      .filter((shift) => !!shift.shift_date)
      .map((shift) => [shift.shift_date, shift]),
  );

  const wantedDates = new Set();
  for (let cursor = addDays(startDate, step); cursor <= endDate; cursor = addDays(cursor, step)) {
    const nextDate = isoFromDate(cursor);
    wantedDates.add(nextDate);

    const existingShift = existingByDate.get(nextDate);
    const sharedFields = {
      department_id: baseShift.department_id,
      position_id: baseShift.position_id,
      start_time: baseShift.start_time,
      end_time: baseShift.end_time,
      assigned_user_id: baseShift.assigned_user_id || null,
      trade_status: baseShift.trade_status || null,
      is_published: !!baseShift.is_published,
      is_recurring: true,
      recurrence_pattern: pattern,
      recurrence_start_date: recurrenceStart,
      recurrence_end_date: baseShift.recurrence_end_date,
      task_list_id: baseShift.task_list_id || null,
      day_of_week: null,
      is_template: false,
      template_id: null,
    };

    if (existingShift) {
      await existingShift.update(sharedFields);
    } else {
      await Shift.create({
        ...sharedFields,
        shift_date: nextDate,
        created_by: actorUserId || baseShift.created_by,
      });
    }
  }

  // If recurrence range was shortened, remove leftover future shifts outside the new range.
  const obsoleteShiftIds = existingFutureShifts
    .filter((shift) => shift.shift_date && !wantedDates.has(shift.shift_date))
    .map((shift) => shift.shift_id);

  if (obsoleteShiftIds.length) {
    await Shift.destroy({ where: { shift_id: { [Op.in]: obsoleteShiftIds } } });
  }
};

const deleteFutureRecurringSeriesShifts = async (seriesSeedShift, cutoffShiftDate) => {
  const seriesAnchorDate = seriesSeedShift?.recurrence_start_date || seriesSeedShift?.shift_date;
  const effectiveCutoffDate = cutoffShiftDate || seriesSeedShift?.shift_date;
  if (!seriesAnchorDate || !effectiveCutoffDate) return 0;

  const where = {
    shift_id: { [Op.ne]: seriesSeedShift.shift_id },
    department_id: seriesSeedShift.department_id,
    created_by: seriesSeedShift.created_by,
    is_recurring: true,
    recurrence_pattern: seriesSeedShift.recurrence_pattern || "weekly",
    recurrence_start_date: seriesAnchorDate,
    shift_date: { [Op.gt]: effectiveCutoffDate },
  };

  return Shift.destroy({ where });
};

const validateDepartmentMembership = async (departmentId, userId, positionId) => {
  if (!departmentId || !userId) {
    return {
      valid: false,
      message: "Assigned user and department are required for assignment validation.",
      conflictType: "assignment_validation",
    };
  }

  const membership = await UserDepartment.findOne({
    where: {
      user_id: userId,
      department_id: departmentId,
      is_active: true,
    },
  });

  if (!membership) {
    return {
      valid: false,
      message: "Assigned user is not active in this department.",
      conflictType: "department_membership",
    };
  }

  if (!membership.role_id) {
    return {
      valid: false,
      message: "Assigned user does not have an active role assignment in this department.",
      conflictType: "role_mismatch",
    };
  }

  return { valid: true };
};

// NOTE: A previous `validateAvailabilityCoverage` helper that required
// students to have an affirmative "available"/"preferred" record covering
// the full shift window was removed. Product rule is default-allow: a
// manager can assign a shift UNLESS the student has a class, unavailable
// window, or approved time-off overlapping the shift. Requiring an
// opt-in availability row contradicted that rule and was never wired up.

const validateNoUnavailableConflicts = async (userId, shiftDate, startTime, endTime) => {
  const isoDate = toIsoDate(shiftDate);
  const dayOfWeek = getDayOfWeekFromDate(shiftDate);
  const shiftStart = toMinutes(startTime);
  const shiftEnd = toMinutes(endTime);

  // If we can't resolve the shift window, refuse to assert it's free.
  // Callers should treat this as a validation failure, not a pass.
  if (!isoDate || dayOfWeek === null || shiftStart === null || shiftEnd === null) {
    return {
      valid: false,
      message: "Unable to validate availability: shift date or time is invalid.",
      conflictType: "invalid_shift_window",
    };
  }

  // Product rule: a student marking themselves unavailable should block
  // assignment immediately — not only after a manager has approved the
  // row. Rows that a manager has explicitly rejected or cancelled no
  // longer block (the approval workflow retains its semantics for those
  // cases). Class-schedule unavailable rows are written with
  // requestStatus = "approved" by the sync service, so they are a subset
  // of "not rejected" and continue to block as expected.
  const blockedRecords = await Availability.findAll({
    where: {
      userId,
      availabilityType: "unavailable",
      requestStatus: { [Op.notIn]: ["rejected", "cancelled"] },
      [Op.or]: [
        { specificDate: isoDate },
        { dayOfWeek, isRecurring: true },
      ],
    },
  });

  const conflictingRecord = blockedRecords.find((availability) => {
    const blockedStart = toMinutes(availability.startTime);
    const blockedEnd = toMinutes(availability.endTime);
    if (blockedStart === null || blockedEnd === null) return false;
    return intervalsOverlap(shiftStart, shiftEnd, blockedStart, blockedEnd);
  });

  if (conflictingRecord) {
    return {
      valid: false,
      message: "Worker is marked as unavailable during this shift time.",
      conflictType: "availability_conflict",
      // Surfaced in the [ShiftAssign] blocked log so we can distinguish
      // a student self-declared unavailable (pending) from a
      // manager-approved one. Not part of the HTTP error payload
      // consumed by clients today, but forward-compatible if we want
      // to show it in UI later.
      requestStatus: conflictingRecord.requestStatus,
    };
  }

  return { valid: true };
};

const validateClassScheduleConflict = async (userId, shiftDate, startTime, endTime) => {
  const isoDate = toIsoDate(shiftDate);
  const dayOfWeek = getDayOfWeekFromDate(shiftDate);
  const shiftStart = toMinutes(startTime);
  const shiftEnd = toMinutes(endTime);

  if (!isoDate || dayOfWeek === null || shiftStart === null || shiftEnd === null) {
    return {
      valid: false,
      message: "Unable to validate class schedule: shift date or time is invalid.",
      conflictType: "invalid_shift_window",
    };
  }

  const classRecords = await Availability.findAll({
    where: {
      userId,
      [Op.and]: [
        // Widened: match every class-schedule marker the rest of the app
        // writes/checks (sourceType, recurrencePattern, isSystemManaged).
        { [Op.or]: CLASS_SCHEDULE_MARKERS },
        {
          [Op.or]: [
            { specificDate: isoDate },
            { dayOfWeek, isRecurring: true },
          ],
        },
      ],
    },
  });

  const hasConflict = classRecords.some((record) => {
    const classStart = toMinutes(record.startTime);
    const classEnd = toMinutes(record.endTime);
    if (classStart === null || classEnd === null) return false;
    return intervalsOverlap(shiftStart, shiftEnd, classStart, classEnd);
  });

  if (hasConflict) {
    return {
      valid: false,
      message: "Worker has a class scheduled at this time.",
      conflictType: "class_schedule_conflict",
    };
  }

  return { valid: true };
};

const validateApprovedTimeOffCoverage = async (userId, shiftDate) => {
  const isoDate = toIsoDate(shiftDate);
  if (!isoDate) {
    return {
      valid: false,
      message: "Unable to validate time-off: shift date is invalid.",
      conflictType: "invalid_shift_window",
    };
  }

  const blockingRequest = await TimeOffRequest.findOne({
    where: {
      user_id: userId,
      status: "approved",
      start_date: { [Op.lte]: isoDate },
      end_date: { [Op.gte]: isoDate },
    },
  });

  if (blockingRequest) {
    return {
      valid: false,
      message: "Assigned user has an approved time-off request for this date.",
      conflictType: "time_off_conflict",
    };
  }

  return { valid: true };
};

const validateNoAssignedShiftOverlap = async (
  userId,
  shiftDate,
  startTime,
  endTime,
  excludeShiftId = null,
) => {
  const isoDate = toIsoDate(shiftDate);
  const shiftStart = toMinutes(startTime);
  const shiftEnd = toMinutes(endTime);

  if (!isoDate || shiftStart === null || shiftEnd === null || shiftEnd <= shiftStart) {
    return {
      valid: false,
      message: "Unable to validate shift overlap: shift date or time is invalid.",
      conflictType: "invalid_shift_window",
    };
  }

  const where = {
    assigned_user_id: userId,
    shift_date: isoDate,
    [Op.or]: [
      { trade_status: null },
      { trade_status: { [Op.notIn]: [SHIFT_STATUS.CANCELLED, "approved_cover"] } },
    ],
  };

  if (excludeShiftId) {
    where.shift_id = { [Op.ne]: Number(excludeShiftId) };
  }

  const assignedShifts = await Shift.findAll({
    where,
    order: [["start_time", "ASC"]],
  });

  const conflictingShift = assignedShifts.find((shift) => {
    const existingStart = toMinutes(shift.start_time);
    const existingEnd = toMinutes(shift.end_time);
    if (existingStart === null || existingEnd === null) return false;
    return intervalsOverlap(shiftStart, shiftEnd, existingStart, existingEnd);
  });

  if (conflictingShift) {
    return {
      valid: false,
      message: "This student already has a shift at this time.",
      conflictType: "shift_overlap",
      conflictingShiftId: conflictingShift.shift_id,
    };
  }

  return { valid: true };
};

const validateAssignmentEligibility = async (
  departmentId,
  assignedUserId,
  positionId,
  shiftDate,
  startTime,
  endTime,
  excludeShiftId = null,
) => {
  if (!assignedUserId) {
    return { valid: true };
  }

  // Short, structured context for every decision; makes it possible to
  // reconstruct why a given assignment passed or failed from the logs.
  const ctx = {
    assignedUserId,
    departmentId,
    positionId,
    shiftDate: toIsoDate(shiftDate),
    startTime,
    endTime,
  };

  const departmentValidation = await validateDepartmentMembership(
    departmentId,
    assignedUserId,
    positionId,
  );
  if (!departmentValidation.valid) {
    logger.info("[ShiftAssign] blocked: department", { ...ctx, reason: departmentValidation.conflictType });
    return departmentValidation;
  }

  const shiftOverlapValidation = await validateNoAssignedShiftOverlap(
    assignedUserId,
    shiftDate,
    startTime,
    endTime,
    excludeShiftId,
  );
  if (!shiftOverlapValidation.valid) {
    logger.info("[ShiftAssign] blocked: shift_overlap", {
      ...ctx,
      reason: shiftOverlapValidation.conflictType,
      conflictingShiftId: shiftOverlapValidation.conflictingShiftId,
    });
    return shiftOverlapValidation;
  }

  const timeOffValidation = await validateApprovedTimeOffCoverage(
    assignedUserId,
    shiftDate,
  );
  if (!timeOffValidation.valid) {
    logger.info("[ShiftAssign] blocked: time_off", { ...ctx, reason: timeOffValidation.conflictType });
    return timeOffValidation;
  }

  const classScheduleValidation = await validateClassScheduleConflict(
    assignedUserId,
    shiftDate,
    startTime,
    endTime,
  );
  if (!classScheduleValidation.valid) {
    logger.info("[ShiftAssign] blocked: class_schedule", { ...ctx, reason: classScheduleValidation.conflictType });
    return classScheduleValidation;
  }

  const unavailabilityValidation = await validateNoUnavailableConflicts(
    assignedUserId,
    shiftDate,
    startTime,
    endTime,
  );
  if (!unavailabilityValidation.valid) {
    logger.info("[ShiftAssign] blocked: unavailable", {
      ...ctx,
      reason: unavailabilityValidation.conflictType,
      // pending | approved | undefined (for invalid_shift_window)
      availabilityStatus: unavailabilityValidation.requestStatus,
    });
    return unavailabilityValidation;
  }

  logger.info("[ShiftAssign] allowed", ctx);
  return { valid: true };
};

/**
 * Thin wrapper that routes through the centralised notification service.
 * Accepts optional `options` (type, link, priority) for richer notifications.
 */
const createShiftNotification = async (userId, title, message, options = {}) => {
  if (!userId) return;
  await sendNotification(userId, title, message, options);
};

const ensureShiftAcknowledgement = async (shiftId, userId) => {
  if (!shiftId || !userId) return;

  const acknowledgement = await ShiftAcknowledgement.findOne({
    where: {
      shiftId,
      userId,
    },
  });

  if (!acknowledgement) {
    await ShiftAcknowledgement.create({
      shiftId,
      userId,
      acknowledged: false,
      acknowledgedAt: null,
      importedToCalendar: false,
    });
    return;
  }

  await acknowledgement.update({
    acknowledged: false,
    acknowledgedAt: null,
  });
};

/**
 * Send an enriched notification to the assigned student when a shift changes status.
 *
 * @param {object} shift       - Shift Sequelize instance (with associations loaded)
 * @param {string} statusLabel - one of the SHIFT_STATUS values
 * @param {object} [oldShift]  - snapshot of the shift BEFORE the update (for change diffs)
 */
const notifyAssignedUserForShift = async (shift, statusLabel, oldShift = null) => {
  if (!shift?.assigned_user_id) return;

  const shiftDateLabel = shift.shift_date || "recurring";
  const timeLabel = `${shift.start_time} - ${shift.end_time}`;
  const positionName = shift.position?.position_name || "Unknown Position";
  const departmentName = shift.department?.department_name || shift.department?.name || "Unknown Department";

  if (statusLabel !== SHIFT_STATUS.CANCELLED) {
    await ensureShiftAcknowledgement(shift.shift_id, shift.assigned_user_id);
  }

  const titleByStatus = {
    [SHIFT_STATUS.PUBLISHED]: "New Shift Assigned",
    [SHIFT_STATUS.CHANGED]: "Shift Updated",
    [SHIFT_STATUS.CANCELLED]: "Shift Cancelled",
    [SHIFT_STATUS.DRAFT]: "Shift Assigned",
  };

  const typeByStatus = {
    [SHIFT_STATUS.PUBLISHED]: "shift_assignment",
    [SHIFT_STATUS.CHANGED]: "shift_change",
    [SHIFT_STATUS.CANCELLED]: "shift_cancellation",
    [SHIFT_STATUS.DRAFT]: "shift_assignment",
  };

  let message;

  if (statusLabel === SHIFT_STATUS.CANCELLED) {
    // US2 AC3 – cancellation notification with date and time of the cancelled shift
    message = `Your shift on ${shiftDateLabel} (${timeLabel}) for ${positionName} at ${departmentName} has been cancelled.`;
  } else if ((statusLabel === SHIFT_STATUS.CHANGED) && oldShift) {
    // US2 AC2 / AC4 – show old vs new details
    const changes = [];

    if (String(oldShift.start_time) !== String(shift.start_time) || String(oldShift.end_time) !== String(shift.end_time)) {
      changes.push(`Time changed from ${oldShift.start_time} - ${oldShift.end_time} to ${shift.start_time} - ${shift.end_time}`);
    }
    if (String(oldShift.shift_date) !== String(shift.shift_date)) {
      changes.push(`Date changed from ${oldShift.shift_date} to ${shift.shift_date}`);
    }
    if (String(oldShift.position_id) !== String(shift.position_id)) {
      const oldPosName = oldShift.position?.position_name || `Position #${oldShift.position_id}`;
      changes.push(`Position changed from ${oldPosName} to ${positionName}`);
    }

    const diffSummary = changes.length > 0
      ? changes.join("; ")
      : "Some shift details have been updated";

    message = `Your shift at ${departmentName} has been updated. ${diffSummary}.`;
  } else {
    // US1 AC2 – assignment notification with full shift details
    message = `You have been assigned to a shift on ${shiftDateLabel} (${timeLabel}) for ${positionName} at ${departmentName}.`;
  }

  await createShiftNotification(
    shift.assigned_user_id,
    titleByStatus[statusLabel] || "Shift Update",
    message,
    {
      type: typeByStatus[statusLabel] || "shift_assignment",
      // US1 AC3 / US2 AC1 – deep-link directly to the shift details page
      link: `/shifts/${shift.shift_id}`,
      priority: "normal",
    },
  );
};

/**
 * Find all active managers for a given department.
 * Returns an array of user IDs.
 */
const getDepartmentManagerIds = async (departmentId) => {
  if (!departmentId) return [];

  const managerMemberships = await UserDepartment.findAll({
    where: { department_id: departmentId, is_active: true },
    include: [{
      model: db.role,
      as: "role",
      required: true,
    }],
  });

  return managerMemberships
    .filter((m) => {
      const roleName = String(m.role?.role_name || "").toLowerCase();
      return roleName.includes("manager") || roleName.includes("supervisor");
    })
    .map((m) => m.user_id);
};

/**
 * Detect unassigned (gap) shifts from a list of just-published shifts and send
 * one consolidated gap notification per manager per department.
 *
 * US3 AC1, AC2, AC3, AC4
 *
 * @param {Array} publishedShifts - Shift instances (with associations) that were just published
 */
const notifyManagersOfGaps = async (publishedShifts) => {
  // Collect gaps: published shifts with no assigned user
  const gaps = publishedShifts.filter((s) => !s.assigned_user_id);
  if (gaps.length === 0) return;

  // Group gaps by department
  const gapsByDepartment = {};
  for (const gap of gaps) {
    const deptId = gap.department_id;
    if (!gapsByDepartment[deptId]) {
      gapsByDepartment[deptId] = [];
    }
    gapsByDepartment[deptId].push(gap);
  }

  for (const [deptId, deptGaps] of Object.entries(gapsByDepartment)) {
    const managerIds = await getDepartmentManagerIds(Number(deptId));
    if (managerIds.length === 0) continue;

    const departmentName = deptGaps[0]?.department?.department_name
      || deptGaps[0]?.department?.name
      || `Department #${deptId}`;

    // US3 AC2 – determine if any gap involves a critical position
    const hasCriticalGap = deptGaps.some((g) => g.position?.is_critical === true);
    const priority = hasCriticalGap ? "high" : "normal";

    // US3 AC4 – build a consolidated summary
    const gapCount = deptGaps.length;
    const gapLines = deptGaps.map((g) => {
      const pos = g.position?.position_name || `Position #${g.position_id}`;
      const date = g.shift_date || "recurring";
      const time = `${g.start_time} - ${g.end_time}`;
      const criticalTag = g.position?.is_critical ? " [CRITICAL]" : "";
      return `  • ${date} ${time} – ${pos}${criticalTag}`;
    }).join("\n");

    const title = hasCriticalGap
      ? `⚠ Coverage Gap Alert – ${departmentName} (${gapCount} gap${gapCount !== 1 ? "s" : ""})`
      : `Coverage Gap Alert – ${departmentName} (${gapCount} gap${gapCount !== 1 ? "s" : ""})`;

    const message = `${gapCount} coverage gap${gapCount !== 1 ? "s" : ""} found in ${departmentName}:\n${gapLines}`;

    // US3 AC3 – link to the schedule view for that department
    const link = `/schedule?department_id=${deptId}`;

    for (const managerId of managerIds) {
      await sendNotification(managerId, title, message, {
        type: "coverage_gap",
        link,
        priority,
      });
    }
  }
};

const createShiftAuditEntry = async (shiftId, actorUserId, action, details = null) => {
  if (!shiftId || !actorUserId) return;
  await ShiftAudit.create({
    shift_id: shiftId,
    actor_user_id: actorUserId,
    action,
    details: details ? JSON.stringify(details) : null,
    created_at: new Date(),
  });
};

// Helper function to validate buffer time between shifts
export const validateBufferTime = async (departmentId, shiftDate, startTime, endTime, assignedUserId, excludeShiftId = null) => {
  // Get department buffer time setting
  const department = await db.department.findByPk(departmentId);
  if (!department || !department.buffer_time_minutes || department.buffer_time_minutes === 0) {
    return { valid: true }; // No buffer time configured
  }

  const bufferMinutes = department.buffer_time_minutes;

  // If no user is assigned or no date, skip validation
  if (!assignedUserId || !shiftDate) {
    return { valid: true };
  }

  // Find all shifts for this user on the same date
  const whereClause = {
    assigned_user_id: assignedUserId,
    shift_date: shiftDate,
    trade_status: {
      [Op.ne]: SHIFT_STATUS.CANCELLED,
    },
  };

  // Exclude current shift if updating
  if (excludeShiftId) {
    whereClause.shift_id = { [Op.ne]: excludeShiftId };
  }

  const existingShifts = await Shift.findAll({
    where: whereClause,
    order: [["start_time", "ASC"]],
  });

  const newStartMinutes = toMinutes(startTime);
  const newEndMinutes = toMinutes(endTime);

  // Check buffer time with each existing shift
  for (const existingShift of existingShifts) {
    const existingStartMinutes = toMinutes(existingShift.start_time);
    const existingEndMinutes = toMinutes(existingShift.end_time);

    // Check if new shift ends too close to when existing shift starts
    const timeBetweenShifts1 = existingStartMinutes - newEndMinutes;
    // Check if existing shift ends too close to when new shift starts
    const timeBetweenShifts2 = newStartMinutes - existingEndMinutes;

    if (timeBetweenShifts1 >= 0 && timeBetweenShifts1 < bufferMinutes) {
      return {
        valid: false,
        message: `Buffer time violation: Only ${timeBetweenShifts1} minutes between new shift end (${endTime}) and existing shift start (${existingShift.start_time}). Required buffer: ${bufferMinutes} minutes.`,
      };
    }

    if (timeBetweenShifts2 >= 0 && timeBetweenShifts2 < bufferMinutes) {
      return {
        valid: false,
        message: `Buffer time violation: Only ${timeBetweenShifts2} minutes between existing shift end (${existingShift.end_time}) and new shift start (${startTime}). Required buffer: ${bufferMinutes} minutes.`,
      };
    }

    // Check for overlap
    if (
      (newStartMinutes >= existingStartMinutes && newStartMinutes < existingEndMinutes) ||
      (newEndMinutes > existingStartMinutes && newEndMinutes <= existingEndMinutes) ||
      (newStartMinutes <= existingStartMinutes && newEndMinutes >= existingEndMinutes)
    ) {
      return {
        valid: false,
        message: `Shift overlap detected: New shift (${startTime}-${endTime}) overlaps with existing shift (${existingShift.start_time}-${existingShift.end_time}).`,
      };
    }
  }

  return { valid: true };
};

// Create and Save a new Shift
export const createShift = async (req, res) => {
  try {
    const actorUserId = req.auth?.userId || req.body.created_by;

    // Validate request
    if (!req.body.department_id || !req.body.position_id || !req.body.start_time || !req.body.end_time || !actorUserId) {
      return res.status(400).send({
        message: "Missing required fields: department_id, position_id, start_time, end_time, created_by",
      });
    }

    // If shift_date is provided, ignore day_of_week
    if (req.body.shift_date) {
      req.body.day_of_week = null;
    }

    // Validate assignment against membership and availability
    if (req.body.assigned_user_id) {
      const assignmentValidation = await validateAssignmentEligibility(
        req.body.department_id,
        req.body.assigned_user_id,
        req.body.position_id,
        req.body.shift_date,
        req.body.start_time,
        req.body.end_time,
        null,
      );

      if (!assignmentValidation.valid) {
        return res.status(409).send({
          success: false,
          message: assignmentValidation.message,
          conflictType: assignmentValidation.conflictType,
        });
      }
    }

    // Validate buffer time if shift is assigned and has a date
    if (req.body.assigned_user_id && req.body.shift_date) {
      const bufferValidation = await validateBufferTime(
        req.body.department_id,
        req.body.shift_date,
        req.body.start_time,
        req.body.end_time,
        req.body.assigned_user_id,
      );

      if (!bufferValidation.valid) {
        return res.status(409).send({
          success: false,
          message: bufferValidation.message,
          conflictType: "buffer_time_violation",
        });
      }
    }

    // Create a Shift
    const shift = {
      department_id: req.body.department_id,
      position_id: req.body.position_id,
      template_id: req.body.template_id,
      day_of_week: req.body.day_of_week,
      shift_date: req.body.shift_date,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      assigned_user_id: req.body.assigned_user_id,
      trade_status: req.body.trade_status || null,
      created_by: actorUserId,
      is_template: req.body.is_template || false,
      is_published: req.body.is_published || false,
      is_recurring: req.body.is_recurring || false,
      recurrence_pattern: req.body.recurrence_pattern,
      recurrence_start_date: req.body.recurrence_start_date,
      recurrence_end_date: req.body.recurrence_end_date,
      task_list_id: req.body.task_list_id || null,
    };

    // Save Shift in the database
    const createdShift = await Shift.create(shift);

    // Return the created shift with associations
    const shiftWithAssociations = await Shift.findByPk(createdShift.shift_id, {
      include: shiftIncludes,
    });

    const status = deriveShiftStatus(shiftWithAssociations);
    if (status === SHIFT_STATUS.PUBLISHED || status === SHIFT_STATUS.CHANGED) {
      await notifyAssignedUserForShift(shiftWithAssociations, status);
    }

    await createShiftAuditEntry(
      createdShift.shift_id,
      actorUserId,
      "created",
      {
        status,
        department_id: shift.department_id,
        position_id: shift.position_id,
      },
    );

    res.status(201).send(withShiftStatus(shiftWithAssociations));
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the Shift.",
    });
  }
};

// Retrieve all Shifts from the database with filters
export const listShifts = async (req, res) => {
  try {
    const { department_id, assigned_user_id, is_published, shift_date, shift_status } = req.query;
    const where = {};
    const authUserId = Number(req.auth?.userId);
    const requestedAssignedUserId = assigned_user_id ? Number(assigned_user_id) : null;
    let activeDepartmentId = null;

    // Detect "my own shifts" requests: when the caller is asking for shifts
    // assigned to themselves, skip the active-department auto-filter. Managers
    // (and any user without an active department row) still see their own
    // shifts and can clock in on them.
    const requestingOwnShifts =
      assigned_user_id != null &&
      req.auth?.userId != null &&
      String(assigned_user_id) === String(req.auth.userId);

    if (department_id) {
      where.department_id = department_id;
    } else if (!requestingOwnShifts && req.auth && req.auth.userId) {
      // If no department_id specified and the user is asking for other people's
      // shifts (or all shifts), narrow to their active department. This keeps
      // cross-department separation intact for manager/student browse flows.
      const { getStudentActiveDepartment } = await import('./user_department.controller.js');
      const activeDepartment = await getStudentActiveDepartment(req.auth.userId);

      if (activeDepartment) {
        where.department_id = activeDepartment.department_id;
      }
    }

    if (assigned_user_id) where.assigned_user_id = assigned_user_id;
    if (is_published !== undefined) where.is_published = is_published === "true";
    if (shift_date) where.shift_date = shift_date;
    if (shift_status === SHIFT_STATUS.CANCELLED) {
      where.trade_status = SHIFT_STATUS.CANCELLED;
    }

    const shifts = await Shift.findAll({
      where,
      include: shiftIncludes,
      order: [["shift_date", "ASC"], ["start_time", "ASC"]],
    });

    let payload = shifts.map((shift) => withShiftStatus(shift));
    if (shift_status) {
      payload = payload.filter((shift) => shift.shift_status === shift_status);
    }

    res.send(payload);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving shifts.",
    });
  }
};

// Find a single Shift with an id
export const getShiftById = async (req, res) => {
  const id = req.params.id;

  try {
    const shift = await Shift.findByPk(id, {
      include: shiftIncludes,
    });

    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    res.send(withShiftStatus(shift));
  } catch (err) {
    res.status(500).send({
      message: `Error retrieving Shift with id=${id}`,
    });
  }
};

// Retrieve shift audit trail
export const getShiftAuditTrail = async (req, res) => {
  const id = req.params.id;

  try {
    const shift = await Shift.findByPk(id, {
      attributes: ["shift_id"],
    });

    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    const auditEntries = await ShiftAudit.findAll({
      where: {
        shift_id: id,
      },
      include: [
        {
          model: db.user,
          as: "actor",
          attributes: ["id", "fName", "lName", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.send(
      auditEntries.map((entry) => {
        const payload = typeof entry.toJSON === "function" ? entry.toJSON() : entry;
        let parsedDetails = null;
        if (payload.details) {
          try {
            parsedDetails = JSON.parse(payload.details);
          } catch (error) {
            parsedDetails = payload.details;
          }
        }
        return {
          ...payload,
          details: parsedDetails,
        };
      }),
    );
  } catch (err) {
    return res.status(500).send({
      message: `Error retrieving shift audit trail: ${err.message}`,
    });
  }
};

// Update a Shift by the id in the request
export const updateShift = async (req, res) => {
  const id = req.params.id;

  try {
    const actorUserId = req.auth?.userId || req.body.created_by;
    // Get the existing shift first (with associations so we can build change diffs)
    const existingShift = await Shift.findByPk(id, { include: shiftIncludes });

    if (!existingShift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    // Validate assignment against membership and availability
    const departmentId = req.body.department_id || existingShift.department_id;
    const assignedUserId = req.body.assigned_user_id !== undefined ? req.body.assigned_user_id : existingShift.assigned_user_id;
    const positionId = req.body.position_id || existingShift.position_id;
    const shiftDate = req.body.shift_date || existingShift.shift_date;
    const startTime = req.body.start_time || existingShift.start_time;
    const endTime = req.body.end_time || existingShift.end_time;

    if (assignedUserId) {
      const assignmentValidation = await validateAssignmentEligibility(
        departmentId,
        assignedUserId,
        positionId,
        shiftDate,
        startTime,
        endTime,
        id,
      );

      if (!assignmentValidation.valid) {
        return res.status(409).send({
          success: false,
          message: assignmentValidation.message,
          conflictType: assignmentValidation.conflictType,
        });
      }
    }

    // Validate buffer time if updating assigned user, date, or times
    if (assignedUserId && shiftDate) {
      const bufferValidation = await validateBufferTime(
        departmentId,
        shiftDate,
        startTime,
        endTime,
        assignedUserId,
        id, // Exclude current shift from validation
      );

      if (!bufferValidation.valid) {
        return res.status(409).send({
          success: false,
          message: bufferValidation.message,
          conflictType: "buffer_time_violation",
        });
      }
    }

    const isRecurring = req.body.is_recurring !== undefined ? !!req.body.is_recurring : !!existingShift.is_recurring;
    const turningRecurringOff = !!existingShift.is_recurring && req.body.is_recurring === false;
    const recurrenceEndDate = req.body.recurrence_end_date !== undefined
      ? req.body.recurrence_end_date
      : existingShift.recurrence_end_date;
    const recurrenceStartDate = req.body.recurrence_start_date !== undefined
      ? req.body.recurrence_start_date
      : (req.body.shift_date || existingShift.shift_date);

    if (isRecurring) {
      if (!recurrenceStartDate || !recurrenceEndDate) {
        return res.status(400).send({
          message: "Recurring shifts require recurrence_start_date and recurrence_end_date.",
        });
      }
      if (dateFromIso(recurrenceEndDate) < dateFromIso(recurrenceStartDate)) {
        return res.status(400).send({
          message: "Repeat-until date must be on or after the shift date.",
        });
      }
    }

    const statusSensitiveFields = [
      "department_id",
      "position_id",
      "shift_date",
      "start_time",
      "end_time",
      "assigned_user_id",
    ];

    const changedPublishedShift = existingShift.is_published && statusSensitiveFields.some(
      (field) => req.body[field] !== undefined && req.body[field] !== existingShift[field],
    );

    const updatePayload = { ...req.body };
    if (updatePayload.is_recurring === false) {
      updatePayload.recurrence_pattern = null;
      updatePayload.recurrence_end_date = null;
      updatePayload.recurrence_start_date = null;
    } else if (updatePayload.is_recurring === true && !updatePayload.recurrence_start_date) {
      // Preserve a stable series identifier across edits.
      updatePayload.recurrence_start_date = existingShift.recurrence_start_date || existingShift.shift_date;
    }

    if (updatePayload.trade_status === "open" && updatePayload.assigned_user_id === undefined) {
      updatePayload.assigned_user_id = null;
    }

    if (changedPublishedShift && updatePayload.trade_status === undefined) {
      updatePayload.trade_status = SHIFT_STATUS.CHANGED;
    }

    const [num] = await Shift.update(updatePayload, {
      where: { shift_id: id },
    });

    if (num === 1) {
      let baseShift = await Shift.findByPk(id);
      if (turningRecurringOff) {
        await deleteFutureRecurringSeriesShifts(existingShift, baseShift?.shift_date || existingShift.shift_date);
      } else if (baseShift?.is_recurring) {
        await syncWeeklyRecurringSeries(baseShift, actorUserId || baseShift.created_by);
      }

      const updatedShift = await Shift.findByPk(id, {
        include: shiftIncludes,
      });

      const status = deriveShiftStatus(updatedShift);
      if (
        status === SHIFT_STATUS.PUBLISHED ||
        status === SHIFT_STATUS.CHANGED ||
        status === SHIFT_STATUS.CANCELLED
      ) {
        // Pass existingShift as oldShift so change notifications include old vs new details
        await notifyAssignedUserForShift(updatedShift, status, existingShift);
      }

      await createShiftAuditEntry(
        id,
        req.auth?.userId || updatedShift.created_by,
        "updated",
        {
          status,
          updated_fields: Object.keys(updatePayload || {}),
        },
      );

      res.send(withShiftStatus(updatedShift));
    } else {
      res.status(404).send({
        message: `Cannot update Shift with id=${id}. Shift was not found or req.body is empty!`,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: `Error updating Shift with id=${id}: ${err.message}`,
    });
  }
};

// List workers who can be assigned for a specific shift window.
export const listAssignableWorkers = async (req, res) => {
  try {
    const managerUserId = Number(req.auth?.userId || 0);
    const departmentId = Number(req.query.department_id || 0);
    const positionId = req.query.position_id ? Number(req.query.position_id) : null;
    const shiftDate = req.query.shift_date;
    const startTime = req.query.start_time;
    const endTime = req.query.end_time;

    if (!departmentId || !shiftDate || !startTime || !endTime) {
      return res.status(400).send({
        message: "Missing required query params: department_id, shift_date, start_time, end_time.",
      });
    }

    const where = {
      department_id: departmentId,
      is_active: true,
    };

    if (positionId) {
      where.position_id = positionId;
    }

    const memberships = await UserDepartment.findAll({
      where,
      include: [
        {
          model: db.user,
          as: "user",
          attributes: ["id", "fName", "lName", "email"],
          required: true,
        },
        {
          model: db.role,
          as: "role",
          attributes: ["role_name", "permission_level"],
          required: false,
        },
        {
          model: db.position,
          as: "position",
          attributes: ["position_id", "position_name", "color"],
          required: false,
        },
      ],
      order: [
        [{ model: db.user, as: "user" }, "fName", "ASC"],
        [{ model: db.user, as: "user" }, "lName", "ASC"],
      ],
    });

    const candidates = memberships.filter((membership) => {
      if (!membership?.user) return false;
      if (Number(membership.user_id) === managerUserId) return false;

      const roleName = String(membership.role?.role_name || "").toLowerCase();
      const permissionLevel = Number(membership.role?.permission_level ?? 0);
      return roleName.includes("student") || permissionLevel < 50;
    });

    const checks = await Promise.all(
      candidates.map(async (membership) => {
        const user = membership.user;
        const assignedUserId = Number(user.id);

        const assignmentValidation = await validateAssignmentEligibility(
          departmentId,
          assignedUserId,
          positionId || membership.position_id || null,
          shiftDate,
          startTime,
          endTime,
        );

        if (!assignmentValidation.valid) {
          return null;
        }

        const bufferValidation = await validateBufferTime(
          departmentId,
          shiftDate,
          startTime,
          endTime,
          assignedUserId,
        );

        if (!bufferValidation.valid) {
          return null;
        }

        return {
          id: assignedUserId,
          userId: assignedUserId,
          fName: user.fName,
          lName: user.lName,
          email: user.email,
          position_id: membership.position_id || null,
          position_name: membership.position?.position_name || null,
        };
      }),
    );

    const data = checks.filter(Boolean);
    return res.send({ data });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Failed to load assignable workers.",
    });
  }
};

// Update shift lifecycle status (draft/published/changed/cancelled)
export const updateShiftStatus = async (req, res) => {
  const id = req.params.id;
  const status = String(req.body.status || "").toLowerCase();

  if (!Object.values(SHIFT_STATUS).includes(status)) {
    return res.status(400).send({
      message: "Valid status is required: draft, published, changed, cancelled.",
    });
  }

  try {
    const shift = await Shift.findByPk(id);
    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    if (status === SHIFT_STATUS.DRAFT) {
      shift.is_published = false;
      shift.trade_status = null;
    } else if (status === SHIFT_STATUS.PUBLISHED) {
      shift.is_published = true;
      shift.trade_status = null;
    } else if (status === SHIFT_STATUS.CHANGED) {
      shift.is_published = true;
      shift.trade_status = SHIFT_STATUS.CHANGED;
    } else if (status === SHIFT_STATUS.CANCELLED) {
      shift.is_published = false;
      shift.trade_status = SHIFT_STATUS.CANCELLED;
    }

    shift.updated_at = new Date();
    await shift.save();

    const updatedShift = await Shift.findByPk(id, {
      include: shiftIncludes,
    });

    if (status !== SHIFT_STATUS.DRAFT) {
      await notifyAssignedUserForShift(updatedShift, status);
    }

    // US3 AC1/AC2/AC3 – notify managers of any gap when a shift is published
    if (status === SHIFT_STATUS.PUBLISHED) {
      await notifyManagersOfGaps([updatedShift]);
    }

    await createShiftAuditEntry(
      id,
      req.auth?.userId || updatedShift.created_by,
      "status_changed",
      { status },
    );

    res.send({
      message: `Shift status updated to ${status}.`,
      data: withShiftStatus(updatedShift),
    });
  } catch (err) {
    res.status(500).send({
      message: `Error updating shift status: ${err.message}`,
    });
  }
};

// Publish a shift
export const publishShift = async (req, res) => {
  req.body.status = SHIFT_STATUS.PUBLISHED;
  return updateShiftStatus(req, res);
};

// Send reminder notification for shift
export const sendShiftReminder = async (req, res) => {
  const id = req.params.id;

  try {
    const shift = await Shift.findByPk(id);
    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    if (!shift.assigned_user_id) {
      return res.status(409).send({
        message: "Cannot send reminder for an unassigned shift.",
      });
    }

    await createShiftNotification(
      shift.assigned_user_id,
      "Shift Reminder",
      `Reminder: You have a shift on ${shift.shift_date || "recurring"} from ${shift.start_time} to ${shift.end_time}.`,
      { type: "shift_reminder", link: `/shifts/${shift.shift_id}` },
    );

    await createShiftAuditEntry(
      shift.shift_id,
      req.auth?.userId || shift.created_by,
      "reminder_sent",
      null,
    );

    res.send({
      message: "Shift reminder notification sent.",
    });
  } catch (err) {
    res.status(500).send({
      message: `Error sending shift reminder: ${err.message}`,
    });
  }
};

// Delete a Shift with the specified id in the request
export const deleteShift = async (req, res) => {
  const id = req.params.id;

  try {
    const num = await Shift.destroy({
      where: { shift_id: id },
    });

    if (num == 1) {
      res.send({
        message: "Shift was deleted successfully!",
      });
    } else {
      res.status(404).send({
        message: `Cannot delete Shift with id=${id}. Shift was not found!`,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: `Could not delete Shift with id=${id}: ${err.message}`,
    });
  }
};

// Preview shifts based on template and date range
export const previewShifts = async (req, res) => {
  try {
    const {
      template_id,
      start_date,
      end_date,
      department_id,
      position_id,
      assigned_user_id,
    } = req.body;

    if (!template_id || !start_date || !end_date) {
      return res.status(400).send({
        message: "template_id, start_date, and end_date are required",
      });
    }

    // Get the template shifts
    const templateShifts = await Shift.findAll({
      where: {
        template_id,
        is_template: true,
        ...(department_id && { department_id }),
        ...(position_id && { position_id }),
      },
      include: [
        { model: db.department, as: "department" },
        { model: db.position, as: "position" },
      ],
    });

    if (!templateShifts.length) {
      return res.status(404).send({
        message: "No template shifts found",
      });
    }

    // Generate shifts based on the template and date range
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const generatedShifts = [];

    // For each day in the date range
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Find template shifts for this day of the week
      const shiftsForDay = templateShifts.filter((shift) =>
        shift.day_of_week === dayOfWeek,
      );

      // Create a shift for each template shift
      for (const templateShift of shiftsForDay) {
        const shiftDate = new Date(date);

        generatedShifts.push({
          department_id: templateShift.department_id,
          position_id: templateShift.position_id,
          template_id: templateShift.template_id,
          shift_date: shiftDate.toISOString().split("T")[0],
          start_time: templateShift.start_time,
          end_time: templateShift.end_time,
          assigned_user_id: assigned_user_id || templateShift.assigned_user_id,
          created_by: req.auth?.userId || templateShift.created_by,
          is_published: false,
          is_recurring: false,
          trade_status: null,
          shift_status: SHIFT_STATUS.DRAFT,
          department: templateShift.department,
          position: templateShift.position,
        });
      }
    }

    res.send(generatedShifts);
  } catch (err) {
    res.status(500).send({
      message: `Error generating shift preview: ${err.message}`,
    });
  }
};

// NOTE: A previous `assignUserToShift` handler that did qualification
// checks but bypassed availability/class/time-off validation was
// removed. It was never mounted to any route and was a landmine: any
// future wiring of it would have silently allowed assignments during
// class time. The canonical assignment path is PUT /shifts/:id
// (`updateShift`), which calls `validateAssignmentEligibility`.

/**
 * Bulk-publish multiple shifts in one request.
 *
 * US1 AC4 – sends one consolidated notification per student listing ALL their new shifts.
 * US3 AC4 – sends one consolidated gap notification per manager listing ALL coverage gaps.
 *
 * POST /shifts/bulk-publish
 * Body: { shiftIds: [1, 2, 3, ...] }
 */
export const bulkPublishShifts = async (req, res) => {
  const { shiftIds } = req.body;

  if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
    return res.status(400).send({ message: "shiftIds must be a non-empty array." });
  }

  try {
    // Load all target shifts with associations before modifying
    const shiftsToPublish = await Shift.findAll({
      where: { shift_id: { [Op.in]: shiftIds } },
      include: shiftIncludes,
    });

    if (shiftsToPublish.length === 0) {
      return res.status(404).send({ message: "No matching shifts found." });
    }

    // Publish each shift
    await Shift.update(
      { is_published: true, trade_status: null },
      { where: { shift_id: { [Op.in]: shiftIds } } },
    );

    // Reload all published shifts with fresh data
    const publishedShifts = await Shift.findAll({
      where: { shift_id: { [Op.in]: shiftIds } },
      include: shiftIncludes,
    });

    // -----------------------------------------------------------------------
    // US1 AC4 – consolidated per-student notifications
    // Group assigned shifts by student and send one summary notification each
    // -----------------------------------------------------------------------
    const shiftsByStudent = {};
    for (const shift of publishedShifts) {
      if (!shift.assigned_user_id) continue;
      if (!shiftsByStudent[shift.assigned_user_id]) {
        shiftsByStudent[shift.assigned_user_id] = [];
      }
      shiftsByStudent[shift.assigned_user_id].push(shift);
    }

    for (const [userId, studentShifts] of Object.entries(shiftsByStudent)) {
      await ensureShiftAcknowledgement(studentShifts[0].shift_id, Number(userId));

      const shiftCount = studentShifts.length;
      const shiftLines = studentShifts.map((s) => {
        const pos = s.position?.position_name || `Position #${s.position_id}`;
        const dept = s.department?.department_name || s.department?.name || "";
        const date = s.shift_date || "recurring";
        return `  • ${date} (${s.start_time} - ${s.end_time}) – ${pos}${dept ? " at " + dept : ""}`;
      }).join("\n");

      const title = `${shiftCount} New Shift${shiftCount !== 1 ? "s" : ""} Assigned`;
      const message = `You have been assigned to ${shiftCount} new shift${shiftCount !== 1 ? "s" : ""}:\n${shiftLines}`;

      // Link to the schedule/shifts list – users can browse all assigned shifts
      await sendNotification(Number(userId), title, message, {
        type: "shift_assignment",
        link: "/schedule",
        priority: "normal",
      });
    }

    // -----------------------------------------------------------------------
    // US3 AC4 – consolidated gap notification per manager
    // -----------------------------------------------------------------------
    await notifyManagersOfGaps(publishedShifts);

    // Audit log
    const actorUserId = req.auth?.userId;
    for (const shift of publishedShifts) {
      await createShiftAuditEntry(shift.shift_id, actorUserId || shift.created_by, "status_changed", { status: SHIFT_STATUS.PUBLISHED });
    }

    return res.send({
      message: `${publishedShifts.length} shift(s) published successfully.`,
      data: publishedShifts.map(withShiftStatus),
    });
  } catch (err) {
    return res.status(500).send({
      message: `Error bulk-publishing shifts: ${err.message}`,
    });
  }
};
