import { Op } from "sequelize";
import db from "../models/index.js";
import { getManagedDepartmentIds } from "../authorization/roleAccess.js";
import { sendNotification } from "../services/notificationService.js";
import logger from "../config/logger.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ok   = (res, data, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, message = "Error", status = 400) =>
  res.status(status).json({ success: false, message, data: null });

const getDepartmentScope = async (req) => {
  const userId = req.auth?.userId;
  const email = req.auth?.email;
  const managedDepartmentIds = await getManagedDepartmentIds(userId, email);
  return [...new Set(managedDepartmentIds.map((id) => Number(id)).filter(Boolean))];
};

const hasApprovedTimeOffForDate = async (userId, shiftDate, transaction) => {
  if (!userId || !shiftDate) return false;
  const request = await db.timeOffRequest.findOne({
    where: {
      user_id: userId,
      status: "approved",
      start_date: { [Op.lte]: shiftDate },
      end_date: { [Op.gte]: shiftDate },
    },
    transaction,
  });
  return Boolean(request);
};

export const getManagerOverview = async (req, res) => {
  try {
    const departmentIds = await getDepartmentScope(req);

    if (!departmentIds.length) {
      return res.send({
        departments: [],
        summary: {
          shifts: {
            draft: 0,
            published: 0,
            changed: 0,
            cancelled: 0,
          },
          open_gap_alerts: 0,
          unresolved_attendance_issues: 0,
          unacknowledged_shift_assignments: 0,
          pending_availability_requests: 0,
        },
      });
    }

    const departmentsPromise = db.department.findAll({
      where: {
        department_id: {
          [Op.in]: departmentIds,
        },
      },
      attributes: ["department_id", "department_name", "description"],
      order: [["department_name", "ASC"]],
    });

    const draftShiftsPromise = db.shift.count({
      where: {
        department_id: { [Op.in]: departmentIds },
        is_published: false,
        [Op.or]: [{ trade_status: null }, { trade_status: { [Op.ne]: "cancelled" } }],
      },
    });

    const publishedShiftsPromise = db.shift.count({
      where: {
        department_id: { [Op.in]: departmentIds },
        is_published: true,
        [Op.or]: [{ trade_status: null }, { trade_status: { [Op.notIn]: ["changed", "cancelled"] } }],
      },
    });

    const changedShiftsPromise = db.shift.count({
      where: {
        department_id: { [Op.in]: departmentIds },
        trade_status: "changed",
      },
    });

    const cancelledShiftsPromise = db.shift.count({
      where: {
        department_id: { [Op.in]: departmentIds },
        trade_status: "cancelled",
      },
    });

    const openGapAlertsPromise = db.scheduleGapAlert.count({
      where: {
        departmentId: { [Op.in]: departmentIds },
        alertStatus: "open",
      },
    });

    const unresolvedAttendanceIssuesPromise = db.timeDiscrepancy.count({
      where: {
        is_resolved: false,
      },
      include: [
        {
          model: db.shift,
          as: "shift",
          where: {
            department_id: { [Op.in]: departmentIds },
          },
          required: true,
          attributes: [],
        },
      ],
    });

    const unacknowledgedAssignmentsPromise = db.shiftAcknowledgement.count({
      where: {
        acknowledged: false,
      },
      include: [
        {
          model: db.shift,
          as: "shift",
          where: {
            department_id: { [Op.in]: departmentIds },
            [Op.or]: [
              { trade_status: null },
              { trade_status: { [Op.ne]: "cancelled" } },
            ],
          },
          required: true,
          attributes: [],
        },
      ],
    });

    const pendingAvailabilityRequestsPromise = db.availability.count({
      where: {
        departmentId: { [Op.in]: departmentIds },
        requestStatus: "pending",
      },
    });

    const [
      departments,
      draftShifts,
      publishedShifts,
      changedShifts,
      cancelledShifts,
      openGapAlerts,
      unresolvedAttendanceIssues,
      unacknowledgedAssignments,
      pendingAvailabilityRequests,
    ] = await Promise.all([
      departmentsPromise,
      draftShiftsPromise,
      publishedShiftsPromise,
      changedShiftsPromise,
      cancelledShiftsPromise,
      openGapAlertsPromise,
      unresolvedAttendanceIssuesPromise,
      unacknowledgedAssignmentsPromise,
      pendingAvailabilityRequestsPromise,
    ]);

    return res.send({
      departments,
      summary: {
        shifts: {
          draft: draftShifts,
          published: publishedShifts,
          changed: changedShifts,
          cancelled: cancelledShifts,
        },
        open_gap_alerts: openGapAlerts,
        unresolved_attendance_issues: unresolvedAttendanceIssues,
        unacknowledged_shift_assignments: unacknowledgedAssignments,
        pending_availability_requests: pendingAvailabilityRequests,
      },
    });
  } catch (error) {
    return res.status(500).send({
      message: `Failed to build manager overview: ${error.message}`,
    });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// SWAP / COVER APPROVAL
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/manager/swap-requests
 *
 * List all shift swap/cover requests that need manager review (status = "manager_pending")
 * for the manager's departments. Optionally pass ?status=all to see all statuses.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const getManagerSwapRequests = async (req, res) => {
  try {
    const departmentIds = await getDepartmentScope(req);
    if (!departmentIds.length) return ok(res, []);

    // Default: show all requests that need attention (pending pool + awaiting manager review)
    // ?status=all shows everything including approved/declined history
    // ?status=manager_pending shows only requests awaiting manager action
    let statusFilter;
    if (req.query.status === "all") {
      statusFilter = {};
    } else if (req.query.status) {
      statusFilter = { status: req.query.status };
    } else {
      // Default: show pending (waiting for volunteer) + manager_pending (awaiting approval)
      statusFilter = { status: { [Op.in]: ["pending", "manager_pending"] } };
    }

    const requests = await db.shiftSwapRequest.findAll({
      where: statusFilter,
      include: [
        {
          model: db.shift,
          as: "requesterShift",
          where: { department_id: { [Op.in]: departmentIds } },
          required: true,
          include: [
            { model: db.department, as: "department", attributes: ["department_id", "department_name"] },
          ],
        },
        {
          model: db.shift,
          as: "respondentShift",
          required: false,
          include: [
            { model: db.department, as: "department", attributes: ["department_id", "department_name"] },
          ],
        },
        { model: db.user, as: "requester", attributes: ["id", "fName", "lName", "email"] },
        { model: db.user, as: "respondent", attributes: ["id", "fName", "lName", "email"] },
      ],
      order: [["created_at", "DESC"]],
    });

    return ok(res, requests);
  } catch (error) {
    logger.error(`[ManagerController] getManagerSwapRequests error: ${error.message}`);
    return fail(res, "Error retrieving swap requests.", 500);
  }
};

/**
 * PUT /api/manager/swap-requests/:id
 *
 * Approve or decline a shift swap/cover request that is in "manager_pending" status.
 *
 * Business rules:
 *   - Manager can only act on requests where the requester's shift belongs to
 *     one of their managed departments.
 *   - action "approve":
 *       find_cover → reassign the shift to the respondent and create acknowledgement
 *       swap       → exchange the two shift assignments
 *       Both: set status to "approved", record reviewed_by + reviewed_at,
 *             notify both students with manager name.
 *   - action "decline":
 *       Set status to "declined", record reviewed_by + reviewed_at,
 *       notify both students (requester + respondent) with optional manager notes.
 *
 * Body: { action: "approve" | "decline", notes?: string }
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const reviewSwapRequest = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const managerId = req.auth.userId;
    const requestId = Number(req.params.id);
    const { action, notes } = req.body;

    if (!["approve", "decline"].includes(action)) {
      await transaction.rollback();
      return fail(res, "action must be 'approve' or 'decline'.", 400);
    }

    const departmentIds = await getDepartmentScope(req);

    const swapReq = await db.shiftSwapRequest.findByPk(requestId, { transaction });
    if (!swapReq) {
      await transaction.rollback();
      return fail(res, "Swap request not found.", 404);
    }

    // Manager can decline requests in "pending" (still in pool) or "manager_pending" (volunteer found)
    // Manager can only approve "manager_pending" requests (a volunteer must exist to assign the shift)
    const reviewableStatuses = ["pending", "manager_pending"];
    if (!reviewableStatuses.includes(swapReq.status)) {
      await transaction.rollback();
      return fail(res, `Request is already "${swapReq.status}" and cannot be reviewed again.`, 409);
    }

    if (action === "approve" && swapReq.status === "pending") {
      await transaction.rollback();
      return fail(res, "Cannot approve yet — no student has volunteered to cover this shift.", 400);
    }

    // Ensure the shift belongs to one of this manager's departments
    const requesterShift = await db.shift.findByPk(swapReq.requester_shift_id, { transaction });
    if (!requesterShift || !departmentIds.includes(requesterShift.department_id)) {
      await transaction.rollback();
      return fail(res, "You do not have permission to review this request.", 403);
    }

    // Fetch manager's name for notification messages
    const manager = await db.user.findByPk(managerId, { attributes: ["id", "fName", "lName"], transaction });
    const managerName = manager ? `${manager.fName} ${manager.lName}` : "Manager";

    // ── DECLINE ──────────────────────────────────────────────────────────────
    if (action === "decline") {
      swapReq.status = "declined";
      swapReq.manager_notes = notes || null;
      swapReq.reviewed_by = managerId;
      swapReq.reviewed_at = new Date();
      swapReq.updated_at = new Date();
      await swapReq.save({ transaction });

      // Clear the pending_cover flag on the shift (stays assigned to original student)
      const declinedShift = await db.shift.findByPk(swapReq.requester_shift_id, { transaction });
      if (declinedShift && declinedShift.trade_status === "pending_cover") {
        declinedShift.trade_status = null;
        declinedShift.updated_at = new Date();
        await declinedShift.save({ transaction });
      }

      await transaction.commit();

      const declineMsg = notes
        ? `Reason: ${notes}`
        : "No reason provided.";

      // Notify requester
      sendNotification(
        swapReq.requester_user_id,
        "Shift Request Declined by Manager",
        `Your shift ${swapReq.type === "find_cover" ? "cover" : "swap"} request was declined by ${managerName}. ${declineMsg}`,
        { type: "shift_change" }
      ).catch((err) => logger.error(`Notification error: ${err.message}`));

      // Notify respondent (if one was assigned)
      if (swapReq.respondent_user_id) {
        sendNotification(
          swapReq.respondent_user_id,
          "Shift Request Declined by Manager",
          `The shift ${swapReq.type === "find_cover" ? "cover" : "swap"} request you accepted was declined by ${managerName}. ${declineMsg}`,
          { type: "shift_change" }
        ).catch((err) => logger.error(`Notification error: ${err.message}`));
      }

      return ok(res, swapReq, "Swap request declined.");
    }

    // ── APPROVE ──────────────────────────────────────────────────────────────
    if (swapReq.type === "find_cover") {
      const shift = await db.shift.findByPk(
        swapReq.requester_shift_id,
        { transaction, lock: transaction.LOCK.UPDATE }
      );
      if (!shift) {
        await transaction.rollback();
        return fail(res, "Shift no longer exists.", 404);
      }

      const responderHasTimeOff = await hasApprovedTimeOffForDate(
        swapReq.respondent_user_id,
        shift.shift_date,
        transaction,
      );
      if (responderHasTimeOff) {
        await transaction.rollback();
        return fail(res, "Cannot approve: replacement worker has approved time-off on this date.", 409);
      }

      // Reassign shift to the respondent and clear the cover flag
      shift.assigned_user_id = swapReq.respondent_user_id;
      shift.trade_status = null;
      shift.updated_at = new Date();
      await shift.save({ transaction });

      // Create acknowledgement for the new assignee
      await db.shiftAcknowledgement.create(
        { shiftId: shift.shift_id, userId: swapReq.respondent_user_id, acknowledged: false },
        { transaction }
      );

      swapReq.status = "approved";
      swapReq.manager_notes = notes || null;
      swapReq.reviewed_by = managerId;
      swapReq.reviewed_at = new Date();
      swapReq.updated_at = new Date();
      await swapReq.save({ transaction });
      await transaction.commit();

      // Notify requester — shift is now covered
      sendNotification(
        swapReq.requester_user_id,
        "Shift Cover Approved",
        `Your cover request for the shift on ${shift.shift_date} was approved by ${managerName}. Your shift has been reassigned.`,
        { type: "shift_change", link: `/shifts/${shift.shift_id}` }
      ).catch((err) => logger.error(`Notification error: ${err.message}`));

      // Notify respondent — they now own the shift
      sendNotification(
        swapReq.respondent_user_id,
        "Shift Cover Approved — You're On",
        `${managerName} approved the cover request. You are now assigned to the shift on ${shift.shift_date}.`,
        { type: "shift_change", link: `/shifts/${shift.shift_id}` }
      ).catch((err) => logger.error(`Notification error: ${err.message}`));

      return ok(res, swapReq, "Cover request approved. Shift reassigned.");
    }

    // swap type — exchange both shift assignments
    const reqShift = await db.shift.findByPk(
      swapReq.requester_shift_id,
      { transaction, lock: transaction.LOCK.UPDATE }
    );
    const resShift = await db.shift.findByPk(
      swapReq.respondent_shift_id,
      { transaction, lock: transaction.LOCK.UPDATE }
    );

    if (!reqShift || !resShift) {
      await transaction.rollback();
      return fail(res, "One or both shifts no longer exist.", 404);
    }

    const requesterTargetHasTimeOff = await hasApprovedTimeOffForDate(
      resShift.assigned_user_id,
      reqShift.shift_date,
      transaction,
    );
    const respondentTargetHasTimeOff = await hasApprovedTimeOffForDate(
      reqShift.assigned_user_id,
      resShift.shift_date,
      transaction,
    );
    if (requesterTargetHasTimeOff || respondentTargetHasTimeOff) {
      await transaction.rollback();
      return fail(res, "Cannot approve swap due to approved time-off conflict.", 409);
    }

    const tempUser = reqShift.assigned_user_id;
    reqShift.assigned_user_id = resShift.assigned_user_id;
    resShift.assigned_user_id = tempUser;
    reqShift.updated_at = new Date();
    resShift.updated_at = new Date();
    await reqShift.save({ transaction });
    await resShift.save({ transaction });

    swapReq.status = "approved";
    swapReq.manager_notes = notes || null;
    swapReq.reviewed_by = managerId;
    swapReq.reviewed_at = new Date();
    swapReq.updated_at = new Date();
    await swapReq.save({ transaction });
    await transaction.commit();

    // Notify requester
    sendNotification(
      swapReq.requester_user_id,
      "Shift Swap Approved",
      `${managerName} approved your shift swap. Your schedule has been updated.`,
      { type: "shift_change" }
    ).catch((err) => logger.error(`Notification error: ${err.message}`));

    // Notify respondent
    sendNotification(
      swapReq.respondent_user_id,
      "Shift Swap Approved",
      `${managerName} approved the shift swap. Your schedule has been updated.`,
      { type: "shift_change" }
    ).catch((err) => logger.error(`Notification error: ${err.message}`));

    return ok(res, swapReq, "Swap approved. Shifts exchanged.");
  } catch (error) {
    await transaction.rollback();
    logger.error(`[ManagerController] reviewSwapRequest error: ${error.message}`);
    return fail(res, "Error processing swap request.", 500);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// TIME-OFF APPROVAL
// ═════════════════════════════════════════════════════════════════════════════

export const getManagerTimeOffRequests = async (req, res) => {
  try {
    const departmentIds = await getDepartmentScope(req);
    if (!departmentIds.length) return ok(res, []);

    const where = {};
    if (req.query.status) where.status = String(req.query.status).toLowerCase();

    const requests = await db.timeOffRequest.findAll({
      where,
      include: [
        {
          model: db.user,
          as: "user",
          attributes: ["id", "fName", "lName", "email"],
          required: true,
          include: [
            {
              model: db.userDepartment,
              as: "userDepartments",
              attributes: ["department_id", "is_active", "request_status"],
              required: true,
              where: {
                department_id: { [Op.in]: departmentIds },
                is_active: true,
                request_status: "approved",
              },
              include: [
                {
                  model: db.department,
                  as: "department",
                  attributes: ["department_id", "department_name"],
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: db.user,
          as: "reviewer",
          attributes: ["id", "fName", "lName", "email"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return ok(res, requests);
  } catch (error) {
    logger.error(`[ManagerController] getManagerTimeOffRequests error: ${error.message}`);
    return fail(res, "Error retrieving time-off requests.", 500);
  }
};

export const reviewManagerTimeOffRequest = async (req, res) => {
  try {
    const managerId = req.auth?.userId;
    const requestId = Number(req.params.id);
    const action = String(req.body?.action || "").toLowerCase();
    const notes = req.body?.notes || null;

    if (!["approve", "reject"].includes(action)) {
      return fail(res, "action must be 'approve' or 'reject'.", 400);
    }

    const departmentIds = await getDepartmentScope(req);
    const request = await db.timeOffRequest.findByPk(requestId, {
      include: [
        {
          model: db.user,
          as: "user",
          attributes: ["id", "fName", "lName", "email"],
          include: [
            {
              model: db.userDepartment,
              as: "userDepartments",
              attributes: ["department_id", "is_active", "request_status"],
              required: true,
              where: {
                department_id: { [Op.in]: departmentIds },
                is_active: true,
                request_status: "approved",
              },
            },
          ],
        },
      ],
    });

    if (!request) return fail(res, "Time-off request not found in your departments.", 404);
    if (request.status !== "pending") return fail(res, `Request is already "${request.status}".`, 409);

    request.status = action === "approve" ? "approved" : "rejected";
    request.reviewed_by = managerId;
    request.reviewed_at = new Date();
    request.review_notes = notes;
    request.updated_at = new Date();
    await request.save();

    return ok(res, request, `Time-off request ${request.status}.`);
  } catch (error) {
    logger.error(`[ManagerController] reviewManagerTimeOffRequest error: ${error.message}`);
    return fail(res, "Error reviewing time-off request.", 500);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// OPEN SHIFT CLAIM APPROVAL
// ═════════════════════════════════════════════════════════════════════════════

export const getManagerOpenShiftClaims = async (req, res) => {
  try {
    const departmentIds = await getDepartmentScope(req);
    if (!departmentIds.length) return ok(res, []);

    const where = {
      type: "find_cover",
      status: "manager_pending",
    };

    const claims = await db.shiftSwapRequest.findAll({
      where,
      include: [
        {
          model: db.shift,
          as: "requesterShift",
          where: {
            department_id: { [Op.in]: departmentIds },
            assigned_user_id: null,
          },
          required: true,
          include: [
            { model: db.department, as: "department", attributes: ["department_id", "department_name"] },
            { model: db.position, as: "position", attributes: ["position_id", "position_name"] },
          ],
        },
        {
          model: db.user,
          as: "requester",
          attributes: ["id", "fName", "lName", "email"],
          required: true,
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return ok(res, claims);
  } catch (error) {
    logger.error(`[ManagerController] getManagerOpenShiftClaims error: ${error.message}`);
    return fail(res, "Error retrieving open shift claims.", 500);
  }
};

export const reviewManagerOpenShiftClaim = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const managerId = req.auth?.userId;
    const claimId = Number(req.params.id);
    const action = String(req.body?.action || "").toLowerCase();
    const notes = req.body?.notes || null;

    if (!["approve", "reject"].includes(action)) {
      await transaction.rollback();
      return fail(res, "action must be 'approve' or 'reject'.", 400);
    }

    const departmentIds = await getDepartmentScope(req);
    const claim = await db.shiftSwapRequest.findByPk(claimId, { transaction });
    if (!claim) {
      await transaction.rollback();
      return fail(res, "Open shift claim not found.", 404);
    }

    if (claim.type !== "find_cover" || claim.status !== "manager_pending") {
      await transaction.rollback();
      return fail(res, "This request is not a pending open-shift claim.", 409);
    }

    const shift = await db.shift.findByPk(claim.requester_shift_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!shift || !departmentIds.includes(Number(shift.department_id))) {
      await transaction.rollback();
      return fail(res, "You do not have permission to review this claim.", 403);
    }

    if (action === "approve") {
      if (shift.assigned_user_id) {
        await transaction.rollback();
        return fail(res, "Shift is no longer open.", 409);
      }

      const claimantHasTimeOff = await hasApprovedTimeOffForDate(
        claim.requester_user_id,
        shift.shift_date,
        transaction,
      );
      if (claimantHasTimeOff) {
        await transaction.rollback();
        return fail(res, "Cannot approve claim: worker has approved time-off on this date.", 409);
      }

      shift.assigned_user_id = claim.requester_user_id;
      shift.updated_at = new Date();
      await shift.save({ transaction });

      await db.shiftAcknowledgement.create(
        { shiftId: shift.shift_id, userId: claim.requester_user_id, acknowledged: false },
        { transaction },
      );

      claim.status = "approved";
    } else {
      claim.status = "rejected";
    }

    claim.manager_notes = notes;
    claim.reviewed_by = managerId;
    claim.reviewed_at = new Date();
    claim.updated_at = new Date();
    await claim.save({ transaction });

    await transaction.commit();
    return ok(res, claim, `Open shift claim ${claim.status}.`);
  } catch (error) {
    await transaction.rollback();
    logger.error(`[ManagerController] reviewManagerOpenShiftClaim error: ${error.message}`);
    return fail(res, "Error reviewing open shift claim.", 500);
  }
};
