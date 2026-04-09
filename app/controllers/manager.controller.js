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

    const statusFilter = req.query.status === "all"
      ? {}
      : { status: "manager_pending" };

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

    if (swapReq.status !== "manager_pending") {
      await transaction.rollback();
      return fail(res, `Request is already "${swapReq.status}" and cannot be reviewed again.`, 409);
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

      // Reassign shift to the respondent
      shift.assigned_user_id = swapReq.respondent_user_id;
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
