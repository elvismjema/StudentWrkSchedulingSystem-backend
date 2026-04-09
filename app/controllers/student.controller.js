/**
 * Student Controller
 *
 * Consolidated controller for all student-facing endpoints.
 * Every handler enforces ownership — students can only access/modify their own data.
 *
 * Endpoint groups:
 *   1.  Dashboard (aggregated)
 *   2.  My Schedule
 *   3.  Open Shifts / Shift Pool
 *   4.  Shift Swap / Find Cover
 *   5.  Time Off Requests
 *   6.  Availability
 *   7.  Clock In/Out / Breaks
 *   8.  Timesheet
 *   9.  Notifications
 *   10. Profile
 *   11. Shift Acknowledgements
 */

import db from "../models/index.js";
import logger from "../config/logger.js";
import { sendNotification } from "../services/notificationService.js";
import { resolveHighestRoleForUser } from "../authorization/roleAccess.js";

const { Op } = db.Sequelize;

const User = db.user;
const Shift = db.shift;
const Notification = db.notification;
const ClockRecord = db.clockRecord;
const ShiftAcknowledgement = db.shiftAcknowledgement;
const Availability = db.availability;
const UserDepartment = db.userDepartment;
const Department = db.department;
const Position = db.position;
const ShiftSwapRequest = db.shiftSwapRequest;
const TimeOffRequest = db.timeOffRequest;
const BreakRecord = db.breakRecord;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Standard success response envelope.
 * @param {object} res - Express response
 * @param {*} data - Payload
 * @param {string} [message] - Optional message
 * @param {number} [status=200] - HTTP status
 */
const ok = (res, data, message = null, status = 200) =>
  res.status(status).json({ success: true, data, ...(message && { message }) });

/**
 * Standard error response envelope.
 * @param {object} res - Express response
 * @param {string} message - Error description
 * @param {number} [status=500] - HTTP status
 */
const fail = (res, message, status = 500) =>
  res.status(status).json({ success: false, message });

/**
 * Convert HH:mm or HH:mm:ss to total minutes since midnight.
 * @param {string} t - Time string
 * @returns {number}
 */
const toMinutes = (t) => {
  if (!t) return 0;
  const parts = String(t).split(":");
  return Number(parts[0]) * 60 + Number(parts[1] || 0);
};

/**
 * Combine a DATEONLY and TIME into a JS Date.
 * @param {string} dateOnly - YYYY-MM-DD
 * @param {string} timeValue - HH:mm:ss
 * @returns {Date|null}
 */
const combineDateAndTime = (dateOnly, timeValue) => {
  if (!dateOnly || !timeValue) return null;
  return new Date(`${dateOnly}T${timeValue}`);
};

/**
 * Get the start-of-week (Monday) and end-of-week (Sunday) for today.
 * @returns {{ weekStart: string, weekEnd: string }}
 */
const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().split("T")[0],
    weekEnd: sunday.toISOString().split("T")[0],
  };
};

/** Shared include array for shift queries */
const shiftIncludes = [
  { model: Department, as: "department", attributes: ["department_id", "department_name"] },
  { model: Position, as: "position", attributes: ["position_id", "position_name"] },
  {
    model: User,
    as: "assignedUser",
    attributes: ["id", "fName", "lName", "email"],
  },
  {
    model: User,
    as: "creator",
    attributes: ["id", "fName", "lName"],
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// 1. AGGREGATED STUDENT DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/student/dashboard
 *
 * Returns everything the home screen needs in a single call:
 *   - next/current shift
 *   - today's shifts
 *   - this week's shifts (with per-day indicators)
 *   - pending request counts
 *   - unread notification count
 *   - open shifts (count + top 3)
 *   - estimated hours this week
 *   - clock-in status
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getDashboard = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const today = new Date().toISOString().split("T")[0];
    const { weekStart, weekEnd } = getCurrentWeekRange();

    // Run independent queries concurrently
    const [
      todayShifts,
      weekShifts,
      openClockRecord,
      unreadCount,
      pendingAcknowledgements,
      pendingTimeOff,
      pendingSwaps,
      openShifts,
    ] = await Promise.all([
      // Today's shifts
      Shift.findAll({
        where: {
          assigned_user_id: userId,
          shift_date: today,
          is_published: true,
          [Op.or]: [{ trade_status: null }, { trade_status: { [Op.ne]: "cancelled" } }],
        },
        include: shiftIncludes,
        order: [["start_time", "ASC"]],
      }),

      // This week's shifts
      Shift.findAll({
        where: {
          assigned_user_id: userId,
          shift_date: { [Op.between]: [weekStart, weekEnd] },
          is_published: true,
          [Op.or]: [{ trade_status: null }, { trade_status: { [Op.ne]: "cancelled" } }],
        },
        include: shiftIncludes,
        order: [["shift_date", "ASC"], ["start_time", "ASC"]],
      }),

      // Current clock-in status (includes open break record to derive onBreak)
      ClockRecord.findOne({
        where: { user_id: userId, clock_out: null },
        include: [
          { model: Shift, as: "shift", include: [{ model: Department, as: "department" }] },
          { model: BreakRecord, as: "breaks", where: { break_end: null }, required: false },
        ],
        order: [["clock_in", "DESC"]],
      }),

      // Unread notifications
      Notification.count({ where: { userId, isRead: false } }),

      // Pending acknowledgements
      ShiftAcknowledgement.count({ where: { userId, acknowledged: false } }),

      // Pending time-off requests
      TimeOffRequest.count({ where: { user_id: userId, status: "pending" } }),

      // Pending swap requests (incoming)
      ShiftSwapRequest.count({
        where: {
          respondent_user_id: userId,
          status: "pending",
        },
      }),

      // Open shifts (unassigned, published, future)
      Shift.findAndCountAll({
        where: {
          assigned_user_id: null,
          is_published: true,
          shift_date: { [Op.gte]: today },
          [Op.or]: [{ trade_status: null }, { trade_status: { [Op.ne]: "cancelled" } }],
        },
        include: [
          { model: Department, as: "department", attributes: ["department_id", "department_name"] },
          { model: Position, as: "position", attributes: ["position_id", "position_name"] },
        ],
        order: [["shift_date", "ASC"], ["start_time", "ASC"]],
        limit: 3,
      }),
    ]);

    // Derive next shift (first today shift with end_time > now, or first future shift this week)
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    let nextShift = todayShifts.find((s) => toMinutes(s.end_time) > nowMinutes) || null;
    if (!nextShift && weekShifts.length > 0) {
      nextShift = weekShifts.find(
        (s) => s.shift_date > today || (s.shift_date === today && toMinutes(s.end_time) > nowMinutes)
      ) || null;
    }

    // Compute weekly hours estimate
    const weeklyMinutes = weekShifts.reduce((sum, s) => {
      return sum + Math.max(0, toMinutes(s.end_time) - toMinutes(s.start_time));
    }, 0);

    // Build day-of-week indicators (Mon=1 ... Sun=7)
    const scheduledDays = [...new Set(weekShifts.map((s) => new Date(s.shift_date).getDay()))];

    return ok(res, {
      nextShift,
      todayShifts,
      weekShifts,
      scheduledDays,
      estimatedWeeklyHours: +(weeklyMinutes / 60).toFixed(1),
      clockStatus: openClockRecord
        ? {
            isClockedIn: true,
            clockInTime: openClockRecord.clock_in,
            elapsedMinutes: Math.round(
              (Date.now() - new Date(openClockRecord.clock_in).getTime()) / 60000
            ),
            clockRecordId: openClockRecord.clock_id,
            onBreak: Array.isArray(openClockRecord.breaks) && openClockRecord.breaks.length > 0,
            shift: openClockRecord.shift,
          }
        : { isClockedIn: false, onBreak: false },
      pendingCounts: {
        acknowledgements: pendingAcknowledgements,
        timeOff: pendingTimeOff,
        swapRequests: pendingSwaps,
      },
      unreadNotifications: unreadCount,
      openShifts: {
        count: openShifts.count,
        preview: openShifts.rows,
      },
    });
  } catch (error) {
    logger.error(`[StudentController] getDashboard error: ${error.message}`);
    return fail(res, "Error loading dashboard.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. MY SCHEDULE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/student/my-schedule
 *
 * Returns student's shifts for a date range. Includes coworkers on same shift.
 *
 * Query params:
 *   - startDate (required, YYYY-MM-DD)
 *   - endDate   (required, YYYY-MM-DD)
 *   - view      (optional, "week" | "month")
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getMySchedule = async (req, res) => {
  try {
    const userId = req.auth.userId;
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      const range = getCurrentWeekRange();
      startDate = startDate || range.weekStart;
      endDate = endDate || range.weekEnd;
    }

    const shifts = await Shift.findAll({
      where: {
        assigned_user_id: userId,
        shift_date: { [Op.between]: [startDate, endDate] },
        is_published: true,
        [Op.or]: [{ trade_status: null }, { trade_status: { [Op.ne]: "cancelled" } }],
      },
      include: [
        ...shiftIncludes,
        {
          model: ShiftAcknowledgement,
          as: "acknowledgements",
          where: { userId },
          required: false,
          attributes: ["id", "acknowledged", "acknowledgedAt", "importedToCalendar"],
        },
      ],
      order: [["shift_date", "ASC"], ["start_time", "ASC"]],
    });

    // For each shift, fetch coworkers (same department + date + overlapping time)
    const enriched = await Promise.all(
      shifts.map(async (shift) => {
        const coworkers = await Shift.findAll({
          where: {
            shift_date: shift.shift_date,
            department_id: shift.department_id,
            assigned_user_id: { [Op.and]: [{ [Op.ne]: userId }, { [Op.ne]: null }] },
            is_published: true,
            start_time: { [Op.lt]: shift.end_time },
            end_time: { [Op.gt]: shift.start_time },
          },
          include: [
            { model: User, as: "assignedUser", attributes: ["id", "fName", "lName"] },
          ],
          attributes: ["shift_id", "start_time", "end_time"],
        });

        const plain = shift.toJSON();
        plain.coworkers = coworkers.map((c) => ({
          userId: c.assignedUser?.id,
          name: c.assignedUser ? `${c.assignedUser.fName} ${c.assignedUser.lName}` : null,
          startTime: c.start_time,
          endTime: c.end_time,
        }));
        return plain;
      })
    );

    return ok(res, enriched);
  } catch (error) {
    logger.error(`[StudentController] getMySchedule error: ${error.message}`);
    return fail(res, "Error retrieving schedule.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. OPEN SHIFTS / SHIFT POOL
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/student/open-shifts
 *
 * Available open (unassigned) shifts the student is qualified for.
 * Filters: departmentId, startDate, endDate. Paginated.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getOpenShifts = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const today = new Date().toISOString().split("T")[0];
    const { departmentId, startDate, endDate } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;

    // Only show shifts in departments the student belongs to
    const userDepts = await UserDepartment.findAll({
      where: { user_id: userId, is_active: true },
      attributes: ["department_id"],
    });
    const deptIds = userDepts.map((ud) => ud.department_id);
    if (deptIds.length === 0) {
      return ok(res, { count: 0, shifts: [], page, limit });
    }

    const where = {
      assigned_user_id: null,
      is_published: true,
      shift_date: { [Op.gte]: startDate || today },
      department_id: departmentId ? Number(departmentId) : { [Op.in]: deptIds },
      [Op.or]: [{ trade_status: null }, { trade_status: { [Op.ne]: "cancelled" } }],
    };
    if (endDate) {
      where.shift_date = { ...where.shift_date, [Op.lte]: endDate };
    }

    const { count, rows } = await Shift.findAndCountAll({
      where,
      include: [
        { model: Department, as: "department", attributes: ["department_id", "department_name"] },
        { model: Position, as: "position", attributes: ["position_id", "position_name"] },
      ],
      order: [["shift_date", "ASC"], ["start_time", "ASC"]],
      limit,
      offset,
    });

    return ok(res, { count, shifts: rows, page, limit });
  } catch (error) {
    logger.error(`[StudentController] getOpenShifts error: ${error.message}`);
    return fail(res, "Error retrieving open shifts.");
  }
};

/**
 * POST /api/student/open-shifts/:id/claim
 *
 * Claim an open shift. Checks for schedule conflicts.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const claimOpenShift = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const userId = req.auth.userId;
    const shiftId = Number(req.params.id);

    // Lock the shift row to prevent double-claim
    const shift = await Shift.findByPk(shiftId, {
      include: [{ model: Department, as: "department" }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!shift) {
      await transaction.rollback();
      return fail(res, "Shift not found.", 404);
    }

    if (shift.assigned_user_id) {
      await transaction.rollback();
      return fail(res, "This shift has already been claimed.", 409);
    }

    if (!shift.is_published || shift.trade_status === "cancelled") {
      await transaction.rollback();
      return fail(res, "Shift is not available.", 409);
    }

    // Verify student is in the shift's department
    const membership = await UserDepartment.findOne({
      where: { user_id: userId, department_id: shift.department_id, is_active: true },
      transaction,
    });
    if (!membership) {
      await transaction.rollback();
      return fail(res, "You are not a member of this department.", 403);
    }

    // Conflict check: overlapping shifts on same date
    const conflicting = await Shift.findOne({
      where: {
        assigned_user_id: userId,
        shift_date: shift.shift_date,
        is_published: true,
        start_time: { [Op.lt]: shift.end_time },
        end_time: { [Op.gt]: shift.start_time },
        [Op.or]: [{ trade_status: null }, { trade_status: { [Op.ne]: "cancelled" } }],
      },
      transaction,
    });

    if (conflicting) {
      await transaction.rollback();
      return fail(
        res,
        `Schedule conflict: you already have a shift from ${conflicting.start_time} to ${conflicting.end_time} on this date.`,
        409
      );
    }

    // Assign the shift
    shift.assigned_user_id = userId;
    shift.updated_at = new Date();
    await shift.save({ transaction });

    // Create acknowledgement record
    await ShiftAcknowledgement.create(
      { shiftId, userId, acknowledged: false },
      { transaction }
    );

    await transaction.commit();

    // Notify (non-blocking)
    sendNotification(userId, "Shift Claimed", `You picked up a shift on ${shift.shift_date}.`, {
      type: "shift_assignment",
      link: `/shifts/${shiftId}`,
    }).catch((err) => logger.error(`Notification error: ${err.message}`));

    const claimed = await Shift.findByPk(shiftId, { include: shiftIncludes });
    return ok(res, claimed, "Shift claimed successfully.", 200);
  } catch (error) {
    await transaction.rollback();
    logger.error(`[StudentController] claimOpenShift error: ${error.message}`);
    return fail(res, "Error claiming shift.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 4. SHIFT SWAP / FIND COVER
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/student/shifts/:id/find-cover
 *
 * Post a shift to the pool for another student to pick up.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const findCover = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const shiftId = Number(req.params.id);
    const { notes } = req.body;

    const shift = await Shift.findByPk(shiftId);
    if (!shift) return fail(res, "Shift not found.", 404);
    if (shift.assigned_user_id !== userId) {
      return fail(res, "You can only find cover for your own shifts.", 403);
    }
    if (shift.shift_date < new Date().toISOString().split("T")[0]) {
      return fail(res, "Cannot find cover for past shifts.", 400);
    }

    // Check for existing pending request
    const existing = await ShiftSwapRequest.findOne({
      where: {
        requester_shift_id: shiftId,
        requester_user_id: userId,
        status: { [Op.in]: ["pending", "manager_pending"] },
      },
    });
    if (existing) {
      return fail(res, "A cover request already exists for this shift.", 409);
    }

    const request = await ShiftSwapRequest.create({
      requester_shift_id: shiftId,
      requester_user_id: userId,
      type: "find_cover",
      status: "pending",
      requester_notes: notes || null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return ok(res, request, "Cover request posted.", 201);
  } catch (error) {
    logger.error(`[StudentController] findCover error: ${error.message}`);
    return fail(res, "Error creating cover request.");
  }
};

/**
 * POST /api/student/shifts/:id/swap-request
 *
 * Request a swap with a specific coworker.
 * Body: { respondentUserId, respondentShiftId, notes }
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const createSwapRequest = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const shiftId = Number(req.params.id);
    const { respondentUserId, respondentShiftId, notes } = req.body;

    if (!respondentUserId || !respondentShiftId) {
      return fail(res, "respondentUserId and respondentShiftId are required.", 400);
    }

    const myShift = await Shift.findByPk(shiftId);
    if (!myShift) return fail(res, "Your shift not found.", 404);
    if (myShift.assigned_user_id !== userId) {
      return fail(res, "You can only swap your own shifts.", 403);
    }

    const theirShift = await Shift.findByPk(respondentShiftId);
    if (!theirShift) return fail(res, "Respondent shift not found.", 404);
    if (theirShift.assigned_user_id !== Number(respondentUserId)) {
      return fail(res, "Respondent is not assigned to that shift.", 400);
    }

    // Check for existing pending request
    const existing = await ShiftSwapRequest.findOne({
      where: {
        requester_shift_id: shiftId,
        requester_user_id: userId,
        respondent_user_id: Number(respondentUserId),
        status: { [Op.in]: ["pending", "manager_pending"] },
      },
    });
    if (existing) {
      return fail(res, "A swap request already exists between these shifts.", 409);
    }

    const request = await ShiftSwapRequest.create({
      requester_shift_id: shiftId,
      respondent_shift_id: respondentShiftId,
      requester_user_id: userId,
      respondent_user_id: Number(respondentUserId),
      type: "swap",
      status: "pending",
      requester_notes: notes || null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Notify respondent
    sendNotification(
      Number(respondentUserId),
      "Shift Swap Request",
      `A coworker wants to swap shifts with you on ${myShift.shift_date}.`,
      { type: "shift_change", link: `/swap-requests/${request.id}` }
    ).catch((err) => logger.error(`Notification error: ${err.message}`));

    return ok(res, request, "Swap request sent.", 201);
  } catch (error) {
    logger.error(`[StudentController] createSwapRequest error: ${error.message}`);
    return fail(res, "Error creating swap request.");
  }
};

/**
 * GET /api/student/swap-requests
 *
 * View incoming and outgoing swap/cover requests.
 * Query: ?direction=incoming|outgoing|all (default: all)
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getSwapRequests = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const direction = req.query.direction || "all";

    let where;
    if (direction === "incoming") {
      where = { respondent_user_id: userId };
    } else if (direction === "outgoing") {
      where = { requester_user_id: userId };
    } else {
      where = {
        [Op.or]: [{ requester_user_id: userId }, { respondent_user_id: userId }],
      };
    }

    const requests = await ShiftSwapRequest.findAll({
      where,
      include: [
        {
          model: Shift,
          as: "requesterShift",
          include: [
            { model: Department, as: "department", attributes: ["department_id", "department_name"] },
          ],
        },
        {
          model: Shift,
          as: "respondentShift",
          required: false,
          include: [
            { model: Department, as: "department", attributes: ["department_id", "department_name"] },
          ],
        },
        { model: User, as: "requester", attributes: ["id", "fName", "lName", "email"] },
        { model: User, as: "respondent", attributes: ["id", "fName", "lName", "email"] },
      ],
      order: [["created_at", "DESC"]],
    });

    return ok(res, requests);
  } catch (error) {
    logger.error(`[StudentController] getSwapRequests error: ${error.message}`);
    return fail(res, "Error retrieving swap requests.");
  }
};

/**
 * PUT /api/student/swap-requests/:id
 *
 * Accept or decline an incoming swap/cover request.
 * Body: { action: "accept" | "decline", notes }
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const respondToSwapRequest = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const userId = req.auth.userId;
    const requestId = Number(req.params.id);
    const { action, notes } = req.body;

    if (!["accept", "decline"].includes(action)) {
      await transaction.rollback();
      return fail(res, "action must be 'accept' or 'decline'.", 400);
    }

    const swapReq = await ShiftSwapRequest.findByPk(requestId, { transaction });
    if (!swapReq) {
      await transaction.rollback();
      return fail(res, "Swap request not found.", 404);
    }

    // For find_cover: anyone can accept (they become respondent)
    // For swap: only the targeted respondent can accept/decline
    if (swapReq.type === "swap" && swapReq.respondent_user_id !== userId) {
      await transaction.rollback();
      return fail(res, "You are not the respondent for this swap request.", 403);
    }

    // Cannot act on own request
    if (swapReq.requester_user_id === userId && swapReq.type === "swap") {
      await transaction.rollback();
      return fail(res, "You cannot respond to your own swap request.", 400);
    }

    if (swapReq.status !== "pending") {
      await transaction.rollback();
      return fail(res, `Request is already ${swapReq.status}.`, 409);
    }

    if (action === "decline") {
      // Student declining a swap/cover request — no manager needed
      swapReq.status = "declined";
      swapReq.respondent_notes = notes || null;
      swapReq.updated_at = new Date();
      await swapReq.save({ transaction });
      await transaction.commit();

      sendNotification(
        swapReq.requester_user_id,
        "Swap Request Declined",
        "Your shift swap/cover request was declined by the other student.",
        { type: "shift_change" }
      ).catch((err) => logger.error(`Notification error: ${err.message}`));

      return ok(res, swapReq, "Swap request declined.");
    }

    // action === "accept" — student has agreed, now route to manager for approval
    if (swapReq.type === "find_cover") {
      // Conflict check before escalating to manager
      const shift = await Shift.findByPk(swapReq.requester_shift_id, { transaction });
      if (!shift) {
        await transaction.rollback();
        return fail(res, "Shift no longer exists.", 404);
      }

      const conflict = await Shift.findOne({
        where: {
          assigned_user_id: userId,
          shift_date: shift.shift_date,
          is_published: true,
          start_time: { [Op.lt]: shift.end_time },
          end_time: { [Op.gt]: shift.start_time },
          shift_id: { [Op.ne]: shift.shift_id },
          [Op.or]: [{ trade_status: null }, { trade_status: { [Op.ne]: "cancelled" } }],
        },
        transaction,
      });
      if (conflict) {
        await transaction.rollback();
        return fail(res, "You have a schedule conflict with this shift.", 409);
      }

      // Record who accepted — shift reassignment happens after manager approves
      swapReq.respondent_user_id = userId;
      swapReq.status = "manager_pending";
      swapReq.respondent_notes = notes || null;
      swapReq.updated_at = new Date();
      await swapReq.save({ transaction });
      await transaction.commit();

      // Notify the requester that someone picked it up — pending manager approval
      sendNotification(
        swapReq.requester_user_id,
        "Cover Request Accepted — Awaiting Manager Approval",
        `Someone has accepted to cover your shift on ${shift.shift_date}. Waiting for manager approval.`,
        { type: "shift_change" }
      ).catch((err) => logger.error(`Notification error: ${err.message}`));

      // Notify all managers of that department
      notifyManagersOfSwapRequest(swapReq, shift, "find_cover").catch((err) =>
        logger.error(`Manager notification error: ${err.message}`)
      );

      return ok(res, swapReq, "Cover accepted. Awaiting manager approval.");
    }

    // swap type — both shifts must exist before escalating
    const reqShift = await Shift.findByPk(swapReq.requester_shift_id, { transaction });
    const resShift = await Shift.findByPk(swapReq.respondent_shift_id, { transaction });

    if (!reqShift || !resShift) {
      await transaction.rollback();
      return fail(res, "One or both shifts no longer exist.", 404);
    }

    swapReq.status = "manager_pending";
    swapReq.respondent_notes = notes || null;
    swapReq.updated_at = new Date();
    await swapReq.save({ transaction });
    await transaction.commit();

    // Notify requester — awaiting manager
    sendNotification(
      swapReq.requester_user_id,
      "Swap Request Accepted — Awaiting Manager Approval",
      `Your swap request for the shift on ${reqShift.shift_date} has been accepted. Waiting for manager approval.`,
      { type: "shift_change" }
    ).catch((err) => logger.error(`Notification error: ${err.message}`));

    // Notify all managers of that department
    notifyManagersOfSwapRequest(swapReq, reqShift, "swap").catch((err) =>
      logger.error(`Manager notification error: ${err.message}`)
    );

    return ok(res, swapReq, "Swap accepted. Awaiting manager approval.");
  } catch (error) {
    await transaction.rollback();
    logger.error(`[StudentController] respondToSwapRequest error: ${error.message}`);
    return fail(res, "Error processing swap request.");
  }
};

/**
 * Helper: notify all managers of a department about a pending swap/cover request.
 *
 * @param {object} swapReq - ShiftSwapRequest instance
 * @param {object} shift   - the requester's shift (for date + department context)
 * @param {string} type    - "find_cover" | "swap"
 */
async function notifyManagersOfSwapRequest(swapReq, shift, type) {
  const managers = await User.findAll({
    include: [
      {
        model: db.userDepartment,
        as: "userDepartments",
        where: {
          departmentId: shift.department_id,
          classification: { [Op.in]: ["manager", "admin"] },
        },
        required: true,
        attributes: [],
      },
    ],
    attributes: ["id"],
  });

  const label = type === "find_cover" ? "cover" : "swap";
  const notifications = managers.map((mgr) =>
    sendNotification(
      mgr.id,
      `Shift ${label === "cover" ? "Cover" : "Swap"} Request Needs Approval`,
      `A shift ${label} request for ${shift.shift_date} is awaiting your approval.`,
      { type: "shift_change", link: `/manager/swap-requests/${swapReq.id}`, priority: "high" }
    ).catch((err) => logger.error(`Manager notification error (userId ${mgr.id}): ${err.message}`))
  );

  await Promise.allSettled(notifications);
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. TIME OFF REQUESTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/student/time-off
 *
 * Submit a time-off request.
 * Body: { type, startDate, endDate, notes }
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const submitTimeOff = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { type, startDate, endDate, notes } = req.body;

    if (!type || !startDate || !endDate) {
      return fail(res, "type, startDate, and endDate are required.", 400);
    }

    const validTypes = ["sick", "personal", "academic_conflict"];
    if (!validTypes.includes(type)) {
      return fail(res, `type must be one of: ${validTypes.join(", ")}`, 400);
    }

    if (endDate < startDate) {
      return fail(res, "endDate must be on or after startDate.", 400);
    }

    const request = await TimeOffRequest.create({
      user_id: userId,
      type,
      start_date: startDate,
      end_date: endDate,
      notes: notes || null,
      status: "pending",
      created_at: new Date(),
      updated_at: new Date(),
    });

    return ok(res, request, "Time-off request submitted.", 201);
  } catch (error) {
    logger.error(`[StudentController] submitTimeOff error: ${error.message}`);
    return fail(res, "Error submitting time-off request.");
  }
};

/**
 * GET /api/student/time-off
 *
 * View own time-off requests with status.
 * Query: ?status=pending|approved|rejected|cancelled
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getTimeOffRequests = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { status } = req.query;

    const where = { user_id: userId };
    if (status) where.status = status;

    const requests = await TimeOffRequest.findAll({
      where,
      order: [["created_at", "DESC"]],
    });

    return ok(res, requests);
  } catch (error) {
    logger.error(`[StudentController] getTimeOffRequests error: ${error.message}`);
    return fail(res, "Error retrieving time-off requests.");
  }
};

/**
 * DELETE /api/student/time-off/:id
 *
 * Cancel a student's own pending time-off request.
 *
 * Business rules:
 *   - Only the request owner (user_id match) can cancel it.
 *   - Only requests with status "pending" can be cancelled. If the request
 *     has already been approved, rejected, or previously cancelled, the
 *     student receives a 409 with the current status in the error message.
 *   - The row is NOT hard-deleted. Instead, status is set to "cancelled" so
 *     managers retain a full audit trail of all submitted requests.
 *   - Ownership is enforced via the WHERE clause (user_id + id). A mismatch
 *     returns 404 rather than 403 to avoid leaking whether the record exists.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const cancelTimeOff = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const requestId = Number(req.params.id);

    if (!requestId || isNaN(requestId)) {
      return fail(res, "Invalid request ID.", 400);
    }

    // Find the request belonging to this student only
    const request = await TimeOffRequest.findOne({
      where: { id: requestId, user_id: userId },
    });

    if (!request) {
      return fail(res, "Time-off request not found.", 404);
    }

    if (request.status !== "pending") {
      return fail(
        res,
        `Cannot cancel a request that is already "${request.status}".`,
        409
      );
    }

    request.status = "cancelled";
    request.updated_at = new Date();
    await request.save();

    return ok(res, request, "Time-off request cancelled.");
  } catch (error) {
    logger.error(`[StudentController] cancelTimeOff error: ${error.message}`);
    return fail(res, "Error cancelling time-off request.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 6. AVAILABILITY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/student/availability
 *
 * View own current availability records.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getMyAvailability = async (req, res) => {
  try {
    const userId = req.auth.userId;

    const records = await Availability.findAll({
      where: { userId },
      order: [["dayOfWeek", "ASC"], ["startTime", "ASC"]],
    });

    return ok(res, records);
  } catch (error) {
    logger.error(`[StudentController] getMyAvailability error: ${error.message}`);
    return fail(res, "Error retrieving availability.");
  }
};

/**
 * PUT /api/student/availability
 *
 * Update own availability (weekly recurring pattern).
 * Body: { entries: [{ dayOfWeek, startTime, endTime, availabilityType }] }
 *
 * Replaces all recurring availability for the student. Specific-date overrides
 * are not touched.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const updateMyAvailability = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const userId = req.auth.userId;
    const { entries } = req.body;

    if (!Array.isArray(entries)) {
      await transaction.rollback();
      return fail(res, "entries must be an array.", 400);
    }

    // Validate each entry
    const validTypes = ["available", "unavailable", "preferred"];
    for (const entry of entries) {
      if (entry.dayOfWeek == null || !entry.startTime || !entry.endTime) {
        await transaction.rollback();
        return fail(res, "Each entry requires dayOfWeek, startTime, endTime.", 400);
      }
      if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
        await transaction.rollback();
        return fail(res, "dayOfWeek must be 0-6 (Sunday-Saturday).", 400);
      }
      if (entry.availabilityType && !validTypes.includes(entry.availabilityType)) {
        await transaction.rollback();
        return fail(res, `availabilityType must be one of: ${validTypes.join(", ")}`, 400);
      }
    }

    // Remove existing recurring availability (keep specific-date overrides)
    await Availability.destroy({
      where: {
        userId,
        specificDate: null,
        isRecurring: true,
      },
      transaction,
    });

    // Bulk create new entries
    const newRecords = await Availability.bulkCreate(
      entries.map((e) => ({
        userId,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        availabilityType: e.availabilityType || "available",
        isRecurring: true,
        requestStatus: "pending",
      })),
      { transaction }
    );

    await transaction.commit();
    return ok(res, newRecords, "Availability updated.");
  } catch (error) {
    await transaction.rollback();
    logger.error(`[StudentController] updateMyAvailability error: ${error.message}`);
    return fail(res, "Error updating availability.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 7. CLOCK IN/OUT & BREAKS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/student/clock-in
 *
 * Clock into current/upcoming shift.
 * Body: { shiftId }
 * Validates: within 15 minutes of shift start, ownership, no open clock record.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const studentClockIn = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const shiftId = Number(req.body.shiftId);

    if (!shiftId) {
      return fail(res, "shiftId is required.", 400);
    }

    const shift = await Shift.findByPk(shiftId, {
      include: [{ model: Department, as: "department" }],
    });

    if (!shift) return fail(res, "Shift not found.", 404);
    if (shift.assigned_user_id !== userId) {
      return fail(res, "You can only clock into your own shift.", 403);
    }
    if (!shift.is_published || shift.trade_status === "cancelled") {
      return fail(res, "Shift must be published and active.", 409);
    }

    // Date check
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    if (shift.shift_date && today !== shift.shift_date) {
      return fail(res, "Clock-in is only allowed on the shift date.", 409);
    }

    // Within 15 minutes of shift start
    const shiftStart = combineDateAndTime(shift.shift_date, shift.start_time);
    if (shiftStart) {
      const diffMinutes = (shiftStart.getTime() - now.getTime()) / 60000;
      if (diffMinutes > 15) {
        return fail(res, "Too early. You can clock in within 15 minutes of your shift start.", 409);
      }
    }

    // Check no open clock record
    const openRecord = await ClockRecord.findOne({
      where: { user_id: userId, clock_out: null },
    });
    if (openRecord) {
      return fail(res, "You already have an open clock record. Clock out first.", 409);
    }

    const clockInTime = new Date();
    const newRecord = await ClockRecord.create({
      user_id: userId,
      shift_id: shiftId,
      clock_in: clockInTime,
      clock_out: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Time discrepancy detection
    const scheduledClockIn = combineDateAndTime(shift.shift_date, shift.start_time);
    if (scheduledClockIn && shift.department) {
      const variance = Math.round((clockInTime.getTime() - scheduledClockIn.getTime()) / 60000);
      const lateThreshold = Number(shift.department.late_threshold_minutes || 5);
      const earlyThreshold = Number(shift.department.early_threshold_minutes || 5);

      if (variance > lateThreshold || variance < -earlyThreshold) {
        await db.timeDiscrepancy.create({
          clock_record_id: newRecord.clock_id,
          user_id: userId,
          shift_id: shiftId,
          discrepancy_type: variance > 0 ? "late_clock_in" : "early_clock_in",
          minutes_variance: variance,
          manager_notified: Boolean(shift.department.notify_on_time_discrepancy),
          is_resolved: false,
          created_at: new Date(),
        });
      }
    }

    const responseRecord = await ClockRecord.findByPk(newRecord.clock_id, {
      include: [
        { model: User, as: "user", attributes: ["id", "fName", "lName"] },
        { model: Shift, as: "shift", include: [{ model: Department, as: "department" }] },
      ],
    });

    return ok(res, responseRecord, "Clocked in successfully.", 201);
  } catch (error) {
    logger.error(`[StudentController] studentClockIn error: ${error.message}`);
    return fail(res, "Error clocking in.");
  }
};

/**
 * POST /api/student/clock-out
 *
 * Clock out of current shift.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const studentClockOut = async (req, res) => {
  try {
    const userId = req.auth.userId;

    const openRecord = await ClockRecord.findOne({
      where: { user_id: userId, clock_out: null },
      include: [
        { model: Shift, as: "shift", include: [{ model: Department, as: "department" }] },
      ],
      order: [["clock_in", "DESC"]],
    });

    if (!openRecord) {
      return fail(res, "No open clock record found.", 404);
    }

    // End any open breaks first
    await BreakRecord.update(
      { break_end: new Date(), updated_at: new Date() },
      { where: { clock_record_id: openRecord.clock_id, user_id: userId, break_end: null } }
    );

    const clockOutTime = new Date();
    openRecord.clock_out = clockOutTime;
    openRecord.updated_at = new Date();
    await openRecord.save();

    // Time discrepancy for clock-out
    const shift = openRecord.shift;
    if (shift?.shift_date && shift?.end_time && shift?.department) {
      const scheduledEnd = combineDateAndTime(shift.shift_date, shift.end_time);
      if (scheduledEnd) {
        const variance = Math.round((clockOutTime.getTime() - scheduledEnd.getTime()) / 60000);
        const lateThreshold = Number(shift.department.late_threshold_minutes || 5);
        const earlyThreshold = Number(shift.department.early_threshold_minutes || 5);

        if (variance > lateThreshold || variance < -earlyThreshold) {
          await db.timeDiscrepancy.create({
            clock_record_id: openRecord.clock_id,
            user_id: userId,
            shift_id: shift.shift_id,
            discrepancy_type: variance > 0 ? "late_clock_out" : "early_clock_out",
            minutes_variance: variance,
            manager_notified: Boolean(shift.department.notify_on_time_discrepancy),
            is_resolved: false,
            created_at: new Date(),
          });
        }
      }
    }

    const workedMinutes = Math.round(
      (clockOutTime.getTime() - new Date(openRecord.clock_in).getTime()) / 60000
    );

    // Compute break minutes
    const breaks = await BreakRecord.findAll({
      where: { clock_record_id: openRecord.clock_id },
    });
    const breakMinutes = breaks.reduce((sum, b) => {
      if (b.break_start && b.break_end) {
        return sum + Math.round((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
      }
      return sum;
    }, 0);

    return ok(res, {
      clockRecord: openRecord,
      workedMinutes,
      breakMinutes,
      netMinutes: workedMinutes - breakMinutes,
    }, "Clocked out successfully.");
  } catch (error) {
    logger.error(`[StudentController] studentClockOut error: ${error.message}`);
    return fail(res, "Error clocking out.");
  }
};

/**
 * POST /api/student/break/start
 *
 * Start a break within current clock session.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const startBreak = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { breakType } = req.body;

    const openRecord = await ClockRecord.findOne({
      where: { user_id: userId, clock_out: null },
    });
    if (!openRecord) {
      return fail(res, "You must be clocked in to start a break.", 409);
    }

    // Check for existing open break
    const openBreak = await BreakRecord.findOne({
      where: { clock_record_id: openRecord.clock_id, user_id: userId, break_end: null },
    });
    if (openBreak) {
      return fail(res, "You already have an active break. End it first.", 409);
    }

    const breakRecord = await BreakRecord.create({
      clock_record_id: openRecord.clock_id,
      user_id: userId,
      break_start: new Date(),
      break_type: breakType || "rest",
      created_at: new Date(),
      updated_at: new Date(),
    });

    return ok(res, breakRecord, "Break started.", 201);
  } catch (error) {
    logger.error(`[StudentController] startBreak error: ${error.message}`);
    return fail(res, "Error starting break.");
  }
};

/**
 * POST /api/student/break/end
 *
 * End the current active break.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const endBreak = async (req, res) => {
  try {
    const userId = req.auth.userId;

    const openRecord = await ClockRecord.findOne({
      where: { user_id: userId, clock_out: null },
    });
    if (!openRecord) {
      return fail(res, "You must be clocked in.", 409);
    }

    const openBreak = await BreakRecord.findOne({
      where: { clock_record_id: openRecord.clock_id, user_id: userId, break_end: null },
    });
    if (!openBreak) {
      return fail(res, "No active break found.", 404);
    }

    openBreak.break_end = new Date();
    openBreak.updated_at = new Date();
    await openBreak.save();

    const breakMinutes = Math.round(
      (new Date(openBreak.break_end).getTime() - new Date(openBreak.break_start).getTime()) / 60000
    );

    return ok(res, { breakRecord: openBreak, breakMinutes }, "Break ended.");
  } catch (error) {
    logger.error(`[StudentController] endBreak error: ${error.message}`);
    return fail(res, "Error ending break.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 8. TIMESHEET
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/student/timesheet
 *
 * View timesheet for a date range. Includes scheduled vs actual, breaks, totals.
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getTimesheet = async (req, res) => {
  try {
    const userId = req.auth.userId;
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      const range = getCurrentWeekRange();
      startDate = startDate || range.weekStart;
      endDate = endDate || range.weekEnd;
    }

    // Get clock records in range
    const clockRecords = await ClockRecord.findAll({
      where: {
        user_id: userId,
        clock_in: {
          [Op.gte]: new Date(`${startDate}T00:00:00`),
          [Op.lte]: new Date(`${endDate}T23:59:59`),
        },
      },
      include: [
        {
          model: Shift,
          as: "shift",
          include: [
            { model: Department, as: "department", attributes: ["department_id", "department_name"] },
            { model: Position, as: "position", attributes: ["position_id", "position_name"] },
          ],
        },
      ],
      order: [["clock_in", "ASC"]],
    });

    // Get break records for these clock records
    const clockIds = clockRecords.map((cr) => cr.clock_id);
    const breakRecords = clockIds.length > 0
      ? await BreakRecord.findAll({
          where: { clock_record_id: { [Op.in]: clockIds } },
          order: [["break_start", "ASC"]],
        })
      : [];

    // Group breaks by clock_record_id
    const breaksByClockId = {};
    for (const br of breakRecords) {
      if (!breaksByClockId[br.clock_record_id]) breaksByClockId[br.clock_record_id] = [];
      breaksByClockId[br.clock_record_id].push(br);
    }

    // Build timesheet entries
    let totalWorkedMinutes = 0;
    let totalBreakMinutes = 0;
    let totalScheduledMinutes = 0;

    const entries = clockRecords.map((cr) => {
      const breaks = breaksByClockId[cr.clock_id] || [];
      const breakMins = breaks.reduce((sum, b) => {
        if (b.break_start && b.break_end) {
          return sum + Math.round(
            (new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000
          );
        }
        return sum;
      }, 0);

      const workedMins = cr.clock_out
        ? Math.round((new Date(cr.clock_out).getTime() - new Date(cr.clock_in).getTime()) / 60000)
        : Math.round((Date.now() - new Date(cr.clock_in).getTime()) / 60000);

      const scheduledMins = cr.shift
        ? Math.max(0, toMinutes(cr.shift.end_time) - toMinutes(cr.shift.start_time))
        : 0;

      totalWorkedMinutes += workedMins;
      totalBreakMinutes += breakMins;
      totalScheduledMinutes += scheduledMins;

      return {
        clockRecordId: cr.clock_id,
        date: new Date(cr.clock_in).toISOString().split("T")[0],
        clockIn: cr.clock_in,
        clockOut: cr.clock_out,
        scheduledStart: cr.shift?.start_time || null,
        scheduledEnd: cr.shift?.end_time || null,
        workedMinutes: workedMins,
        breakMinutes: breakMins,
        netMinutes: workedMins - breakMins,
        department: cr.shift?.department || null,
        position: cr.shift?.position || null,
        breaks,
      };
    });

    return ok(res, {
      entries,
      summary: {
        totalWorkedMinutes,
        totalBreakMinutes,
        totalNetMinutes: totalWorkedMinutes - totalBreakMinutes,
        totalWorkedHours: +(totalWorkedMinutes / 60).toFixed(1),
        totalNetHours: +((totalWorkedMinutes - totalBreakMinutes) / 60).toFixed(1),
        totalScheduledMinutes,
        totalScheduledHours: +(totalScheduledMinutes / 60).toFixed(1),
      },
      dateRange: { startDate, endDate },
    });
  } catch (error) {
    logger.error(`[StudentController] getTimesheet error: ${error.message}`);
    return fail(res, "Error retrieving timesheet.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 9. NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/student/notifications
 *
 * Get notifications with pagination and unread count.
 * Query: ?page=1&limit=25&unreadOnly=false
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === "true";

    const where = { userId };
    if (unreadOnly) where.isRead = false;

    const [{ count, rows }, unreadCount] = await Promise.all([
      Notification.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      Notification.count({ where: { userId, isRead: false } }),
    ]);

    // Validate link field to prevent open redirect
    const sanitized = rows.map((n) => {
      const plain = n.toJSON();
      if (plain.link && !plain.link.startsWith("/")) {
        plain.link = null; // Strip external URLs
      }
      return plain;
    });

    return ok(res, {
      notifications: sanitized,
      unreadCount,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    logger.error(`[StudentController] getNotifications error: ${error.message}`);
    return fail(res, "Error retrieving notifications.");
  }
};

/**
 * PUT /api/student/notifications/:id/read
 *
 * Mark a single notification as read. Ownership enforced.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const notifId = Number(req.params.id);

    const notification = await Notification.findByPk(notifId);
    if (!notification) return fail(res, "Notification not found.", 404);
    if (notification.userId !== userId) {
      return fail(res, "You can only mark your own notifications.", 403);
    }

    notification.isRead = true;
    notification.updatedAt = new Date();
    await notification.save();

    return ok(res, notification, "Notification marked as read.");
  } catch (error) {
    logger.error(`[StudentController] markNotificationRead error: ${error.message}`);
    return fail(res, "Error marking notification as read.");
  }
};

/**
 * PUT /api/student/notifications/read-all
 *
 * Bulk mark all unread notifications as read (single request).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.auth.userId;

    const [updatedCount] = await Notification.update(
      { isRead: true, updatedAt: new Date() },
      { where: { userId, isRead: false } }
    );

    return ok(res, { markedRead: updatedCount }, `${updatedCount} notification(s) marked as read.`);
  } catch (error) {
    logger.error(`[StudentController] markAllNotificationsRead error: ${error.message}`);
    return fail(res, "Error marking notifications as read.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 10. PROFILE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/student/profile
 *
 * Get own profile including departments, positions, and preferences.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.auth.userId;

    const user = await User.findByPk(userId, {
      attributes: ["id", "fName", "lName", "email", "is_active"],
      include: [
        {
          model: UserDepartment,
          as: "userDepartments",
          where: { is_active: true },
          required: false,
          include: [
            { model: Department, as: "department", attributes: ["department_id", "department_name"] },
            { model: Position, as: "position", attributes: ["position_id", "position_name"] },
            { model: db.role, as: "role", attributes: ["role_id", "role_name"] },
          ],
        },
      ],
    });

    if (!user) return fail(res, "User not found.", 404);

    return ok(res, user);
  } catch (error) {
    logger.error(`[StudentController] getProfile error: ${error.message}`);
    return fail(res, "Error retrieving profile.");
  }
};

/**
 * PUT /api/student/profile
 *
 * Update own profile. Only allows safe fields.
 * Body: { fName, lName }
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { fName, lName } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return fail(res, "User not found.", 404);

    // Only allow updating safe fields
    if (fName !== undefined) user.fName = fName;
    if (lName !== undefined) user.lName = lName;
    await user.save();

    return ok(res, {
      id: user.id,
      fName: user.fName,
      lName: user.lName,
      email: user.email,
    }, "Profile updated.");
  } catch (error) {
    logger.error(`[StudentController] updateProfile error: ${error.message}`);
    return fail(res, "Error updating profile.");
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 11. SHIFT ACKNOWLEDGEMENTS (FIX)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/student/acknowledgements
 *
 * Get pending shift acknowledgements for the authenticated student.
 * This is the missing `getPendingAcknowledgements` method.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getPendingAcknowledgements = async (req, res) => {
  try {
    const userId = req.auth.userId;

    const acknowledgements = await ShiftAcknowledgement.findAll({
      where: { userId, acknowledged: false },
      include: [
        {
          model: Shift,
          as: "shift",
          include: [
            { model: Department, as: "department", attributes: ["department_id", "department_name"] },
            { model: Position, as: "position", attributes: ["position_id", "position_name"] },
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    return ok(res, acknowledgements);
  } catch (error) {
    logger.error(`[StudentController] getPendingAcknowledgements error: ${error.message}`);
    return fail(res, "Error retrieving acknowledgements.");
  }
};

/**
 * PUT /api/student/acknowledgements/:id
 *
 * Acknowledge a shift. Ownership validated.
 * This is the missing `acknowledgeShift` method.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const acknowledgeShift = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const ackId = Number(req.params.id);

    const acknowledgement = await ShiftAcknowledgement.findByPk(ackId);
    if (!acknowledgement) return fail(res, "Acknowledgement not found.", 404);

    // Ownership check — students can only acknowledge their own
    if (acknowledgement.userId !== userId) {
      return fail(res, "You can only acknowledge your own shifts.", 403);
    }

    if (acknowledgement.acknowledged) {
      return fail(res, "Shift already acknowledged.", 409);
    }

    acknowledgement.acknowledged = true;
    acknowledgement.acknowledgedAt = new Date();
    await acknowledgement.save();

    return ok(res, acknowledgement, "Shift acknowledged.");
  } catch (error) {
    logger.error(`[StudentController] acknowledgeShift error: ${error.message}`);
    return fail(res, "Error acknowledging shift.");
  }
};

/**
 * GET /api/student/shifts/:id/coworkers
 *
 * Get coworkers for a specific shift (same department, same date, overlapping time).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getShiftCoworkers = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const shiftId = Number(req.params.id);

    const shift = await Shift.findByPk(shiftId);
    if (!shift) return fail(res, "Shift not found.", 404);

    const coworkers = await Shift.findAll({
      where: {
        shift_date: shift.shift_date,
        department_id: shift.department_id,
        assigned_user_id: { [Op.and]: [{ [Op.ne]: userId }, { [Op.ne]: null }] },
        is_published: true,
        start_time: { [Op.lt]: shift.end_time },
        end_time: { [Op.gt]: shift.start_time },
      },
      include: [
        { model: User, as: "assignedUser", attributes: ["id", "fName", "lName"] },
      ],
      attributes: ["shift_id", "start_time", "end_time"],
    });

    const data = coworkers.map((c) => ({
      userId: c.assignedUser?.id,
      name: c.assignedUser ? `${c.assignedUser.fName} ${c.assignedUser.lName}` : null,
      startTime: c.start_time,
      endTime: c.end_time,
      shiftId: c.shift_id,
    }));

    return ok(res, data);
  } catch (error) {
    logger.error(`[StudentController] getShiftCoworkers error: ${error.message}`);
    return fail(res, "Error retrieving coworkers.");
  }
};

// ── 12. Cancel Swap Request ─────────────────────────────────────────────────

/**
 * DELETE /student/swap-requests/:id
 * Allows the requester to cancel their own pending swap request.
 */
export const cancelSwapRequest = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const requestId = Number(req.params.id);

    const swapReq = await ShiftSwapRequest.findByPk(requestId);
    if (!swapReq) return fail(res, "Swap request not found.", 404);

    // Only the requester can cancel
    if (swapReq.requester_user_id !== userId) {
      return fail(res, "You can only cancel your own requests.", 403);
    }

    // Can only cancel pending requests
    if (!["pending", "manager_pending"].includes(swapReq.status)) {
      return fail(res, `Cannot cancel a request with status: ${swapReq.status}`, 409);
    }

    swapReq.status = "cancelled";
    swapReq.updated_at = new Date();
    await swapReq.save();

    return ok(res, swapReq, "Swap request cancelled.");
  } catch (error) {
    logger.error(`[StudentController] cancelSwapRequest error: ${error.message}`);
    return fail(res, "Error cancelling swap request.");
  }
};
