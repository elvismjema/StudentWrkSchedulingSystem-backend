import { Op } from "sequelize";
import db from "../models/index.js";
import { getManagedDepartmentIds } from "../authorization/roleAccess.js";

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
