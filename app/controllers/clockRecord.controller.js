import db from "../models/index.js";

const ClockRecord = db.clockRecord;
const Shift = db.shift;
const TimeDiscrepancy = db.timeDiscrepancy;
const User = db.user;
const UserDepartment = db.userDepartment;
const Role = db.role;
const TimecardApproval = db.timecardApproval;
const Op = db.Sequelize.Op;
const HOURLY_RATE = 10;

const combineDateAndTime = (dateOnly, timeValue) => {
  if (!dateOnly || !timeValue) return null;
  return new Date(`${dateOnly}T${timeValue}`);
};

const minutesBetween = (a, b) => Math.round((a.getTime() - b.getTime()) / 60000);
const toDateOnly = (value) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
};
const dateOnlyString = (dateValue) => {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const getWorkedHours = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) return 0;
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3600000;
};
const toHours = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const splitHours = (totalHours) => {
  const total = toHours(totalHours);
  const regularHours = Math.min(40, total);
  const overtimeHours = Math.max(0, total - 40);
  return {
    regularHours: toHours(regularHours),
    overtimeHours: toHours(overtimeHours),
    totalHours: total,
    estimatedPay: toMoney(total * HOURLY_RATE),
  };
};
const statusFromVariance = ({ varianceMinutes, lateThreshold, earlyThreshold, missingClockOut }) => {
  if (missingClockOut) {
    return { status: "missed", lateMinutes: null };
  }
  if (!Number.isFinite(varianceMinutes)) {
    return { status: "on-time", lateMinutes: 0 };
  }
  if (varianceMinutes > lateThreshold) {
    return { status: "late", lateMinutes: varianceMinutes };
  }
  if (varianceMinutes < -1 * earlyThreshold) {
    return { status: "early", lateMinutes: 0 };
  }
  return { status: "on-time", lateMinutes: 0 };
};

const resolveManagerDepartmentIds = async (managerUserId) => {
  const managerMemberships = await UserDepartment.findAll({
    where: {
      user_id: managerUserId,
      is_active: true,
      request_status: "approved",
    },
    include: [{ model: Role, as: "role", attributes: ["role_id", "role_name", "permission_level"] }],
  });

  return managerMemberships
    .filter((membership) => {
      const permission = Number(membership.role?.permission_level || 0);
      const roleName = String(membership.role?.role_name || "").toLowerCase();
      return permission >= 50 || roleName.includes("manager") || roleName.includes("admin");
    })
    .map((membership) => Number(membership.department_id))
    .filter(Boolean);
};

const resolveScopedDepartmentIds = async (req) => {
  const managerUserId = req.auth?.userId;
  const managerDepartmentIds = await resolveManagerDepartmentIds(managerUserId);
  const uniqueManagerDepartmentIds = [...new Set(managerDepartmentIds)];

  const requestedDepartmentId = Number(req.query.department_id || req.body?.department_id || 0);
  if (requestedDepartmentId) {
    if (!uniqueManagerDepartmentIds.includes(requestedDepartmentId)) {
      return { error: "Forbidden! You can only access your own department(s)." };
    }
    return { departmentIds: [requestedDepartmentId] };
  }

  return { departmentIds: uniqueManagerDepartmentIds };
};

const validatePeriod = (periodStartRaw, periodEndRaw) => {
  const periodStart = toDateOnly(periodStartRaw);
  const periodEnd = toDateOnly(periodEndRaw);
  if (!periodStart || !periodEnd || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { error: "period_start and period_end are required in YYYY-MM-DD format." };
  }
  if (periodStart > periodEnd) {
    return { error: "period_start must be on or before period_end." };
  }
  return {
    periodStart,
    periodEnd,
    periodStartStr: dateOnlyString(periodStart),
    periodEndStr: dateOnlyString(periodEnd),
  };
};

const buildTimecardRows = async ({ userIds, departmentIds, periodStartStr, periodEndStr }) => {
  if (!userIds.length || !departmentIds.length) return [];

  const workerMemberships = await UserDepartment.findAll({
    where: {
      user_id: { [Op.in]: userIds },
      department_id: { [Op.in]: departmentIds },
      is_active: true,
      request_status: "approved",
    },
    include: [{ model: Role, as: "role", attributes: ["role_name", "permission_level"] }],
  });

  const workerDeptByUserId = new Map();
  workerMemberships.forEach((membership) => {
    const permission = Number(membership.role?.permission_level || 0);
    const roleName = String(membership.role?.role_name || "").toLowerCase();
    if (permission >= 50 || roleName.includes("manager") || roleName.includes("admin")) return;
    if (!workerDeptByUserId.has(Number(membership.user_id))) {
      workerDeptByUserId.set(Number(membership.user_id), Number(membership.department_id));
    }
  });

  const workerIds = [...workerDeptByUserId.keys()];
  if (!workerIds.length) return [];

  const users = await User.findAll({
    where: { id: { [Op.in]: workerIds } },
    attributes: ["id", "fName", "lName", "email"],
  });
  const userById = new Map(users.map((user) => [Number(user.id), user]));

  const clockRecords = await ClockRecord.findAll({
    where: {
      user_id: { [Op.in]: workerIds },
    },
    include: [
      {
        model: Shift,
        as: "shift",
        required: true,
        where: {
          department_id: { [Op.in]: departmentIds },
          shift_date: { [Op.between]: [periodStartStr, periodEndStr] },
        },
        include: [{ model: db.department, as: "department" }],
      },
    ],
    order: [["clock_in", "ASC"]],
  });

  const approvalRows = await TimecardApproval.findAll({
    where: {
      user_id: { [Op.in]: workerIds },
      department_id: { [Op.in]: departmentIds },
      period_start: periodStartStr,
      period_end: periodEndStr,
    },
  });
  const approvalMap = new Map(
    approvalRows.map((row) => [
      `${Number(row.user_id)}:${Number(row.department_id)}:${row.period_start}:${row.period_end}`,
      String(row.status || "pending").toLowerCase(),
    ]),
  );

  const hoursByUserId = new Map(workerIds.map((id) => [id, 0]));
  clockRecords.forEach((record) => {
    const userId = Number(record.user_id);
    const current = Number(hoursByUserId.get(userId) || 0);
    hoursByUserId.set(userId, current + getWorkedHours(record.clock_in, record.clock_out));
  });

  return workerIds.map((workerId) => {
    const departmentId = workerDeptByUserId.get(workerId);
    const key = `${workerId}:${departmentId}:${periodStartStr}:${periodEndStr}`;
    const user = userById.get(workerId);
    const split = splitHours(hoursByUserId.get(workerId) || 0);
    return {
      user_id: workerId,
      department_id: departmentId,
      worker: {
        id: workerId,
        fName: user?.fName || "Unknown",
        lName: user?.lName || "Worker",
        email: user?.email || "",
      },
      regular_hours: split.regularHours,
      overtime_hours: split.overtimeHours,
      total_hours: split.totalHours,
      estimated_pay: split.estimatedPay,
      status: approvalMap.get(key) || "pending",
    };
  });
};

const createTimeDiscrepancyIfNeeded = async ({
  clockRecord,
  shift,
  actualTimestamp,
  scheduledTimestamp,
  typeWhenLate,
  typeWhenEarly,
}) => {
  if (!scheduledTimestamp || !actualTimestamp || !shift?.department) return null;

  const variance = minutesBetween(actualTimestamp, scheduledTimestamp);
  const lateThreshold = Number(shift.department.late_threshold_minutes || 5);
  const earlyThreshold = Number(shift.department.early_threshold_minutes || 5);

  if (variance > lateThreshold) {
    return TimeDiscrepancy.create({
      clock_record_id: clockRecord.clock_id,
      user_id: clockRecord.user_id,
      shift_id: clockRecord.shift_id,
      discrepancy_type: typeWhenLate,
      minutes_variance: variance,
      manager_notified: Boolean(shift.department.notify_on_time_discrepancy),
      is_resolved: false,
      created_at: new Date(),
    });
  }

  if (variance < (-1 * earlyThreshold)) {
    return TimeDiscrepancy.create({
      clock_record_id: clockRecord.clock_id,
      user_id: clockRecord.user_id,
      shift_id: clockRecord.shift_id,
      discrepancy_type: typeWhenEarly,
      minutes_variance: variance,
      manager_notified: Boolean(shift.department.notify_on_time_discrepancy),
      is_resolved: false,
      created_at: new Date(),
    });
  }

  return null;
};

export const clockIn = async (req, res) => {
  try {
    const userId = Number(req.body.user_id);
    const shiftId = Number(req.body.shift_id);

    if (!userId || !shiftId) {
      return res.status(400).send({
        message: "user_id and shift_id are required.",
      });
    }

    if (req.auth?.userId !== userId) {
      return res.status(403).send({
        message: "Forbidden! You can only clock in for your own account.",
      });
    }

    const shift = await Shift.findByPk(shiftId, {
      include: [{ model: db.department, as: "department" }],
    });

    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${shiftId} was not found.`,
      });
    }

    if (shift.assigned_user_id !== userId) {
      return res.status(403).send({
        message: "You can only clock in for a shift assigned to you.",
      });
    }

    if (!shift.is_published || shift.trade_status === "cancelled") {
      return res.status(409).send({
        message: "Shift must be published and active before clock-in.",
      });
    }

    if (shift.shift_date) {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      if (today !== shift.shift_date) {
        return res.status(409).send({
          message: "Clock-in is only allowed on the assigned shift date.",
        });
      }
    }

    const openRecord = await ClockRecord.findOne({
      where: {
        user_id: userId,
        clock_out: null,
      },
      order: [["clock_in", "DESC"]],
    });

    if (openRecord) {
      return res.status(409).send({
        message: "You already have an open clock record. Clock out first.",
      });
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

    const scheduledClockIn = combineDateAndTime(shift.shift_date, shift.start_time);
    await createTimeDiscrepancyIfNeeded({
      clockRecord: newRecord,
      shift,
      actualTimestamp: clockInTime,
      scheduledTimestamp: scheduledClockIn,
      typeWhenLate: "late_clock_in",
      typeWhenEarly: "early_clock_in",
    });

    const responseRecord = await ClockRecord.findByPk(newRecord.clock_id, {
      include: [
        { model: db.user, as: "user" },
        { model: db.shift, as: "shift", include: [{ model: db.department, as: "department" }] },
      ],
    });

    return res.status(201).send(responseRecord);
  } catch (error) {
    return res.status(500).send({
      message: `Error clocking in: ${error.message}`,
    });
  }
};

export const clockOut = async (req, res) => {
  try {
    const clockRecordId = Number(req.params.id);

    if (!clockRecordId) {
      return res.status(400).send({
        message: "Valid clock record id is required.",
      });
    }

    const clockRecord = await ClockRecord.findByPk(clockRecordId, {
      include: [
        {
          model: db.shift,
          as: "shift",
          include: [{ model: db.department, as: "department" }],
        },
      ],
    });

    if (!clockRecord) {
      return res.status(404).send({
        message: `Clock record with id=${clockRecordId} was not found.`,
      });
    }

    if (clockRecord.user_id !== req.auth?.userId) {
      return res.status(403).send({
        message: "Forbidden! You can only clock out your own clock record.",
      });
    }

    if (clockRecord.clock_out) {
      return res.status(409).send({
        message: "This clock record is already closed.",
      });
    }

    const clockOutTime = new Date();
    clockRecord.clock_out = clockOutTime;
    clockRecord.updated_at = new Date();
    await clockRecord.save();

    const scheduledClockOut = combineDateAndTime(
      clockRecord.shift?.shift_date,
      clockRecord.shift?.end_time,
    );

    await createTimeDiscrepancyIfNeeded({
      clockRecord,
      shift: clockRecord.shift,
      actualTimestamp: clockOutTime,
      scheduledTimestamp: scheduledClockOut,
      typeWhenLate: "late_clock_out",
      typeWhenEarly: "early_clock_out",
    });

    const workedMinutes = minutesBetween(clockOutTime, new Date(clockRecord.clock_in));

    return res.send({
      message: "Clock-out successful.",
      worked_minutes: workedMinutes,
      data: clockRecord,
    });
  } catch (error) {
    return res.status(500).send({
      message: `Error clocking out: ${error.message}`,
    });
  }
};

export const getMyClockRecords = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { from, to } = req.query;

    const where = {
      user_id: userId,
    };

    if (from || to) {
      where.clock_in = {};
      if (from) where.clock_in[db.Sequelize.Op.gte] = new Date(from);
      if (to) where.clock_in[db.Sequelize.Op.lte] = new Date(to);
    }

    const records = await ClockRecord.findAll({
      where,
      include: [
        { model: db.shift, as: "shift", include: [{ model: db.department, as: "department" }] },
      ],
      order: [["clock_in", "DESC"]],
    });

    return res.send(records);
  } catch (error) {
    return res.status(500).send({
      message: `Error retrieving clock records: ${error.message}`,
    });
  }
};

export const getMyOpenClockRecord = async (req, res) => {
  try {
    const openRecord = await ClockRecord.findOne({
      where: {
        user_id: req.auth?.userId,
        clock_out: null,
      },
      include: [{ model: db.shift, as: "shift" }],
      order: [["clock_in", "DESC"]],
    });

    if (!openRecord) {
      return res.send({
        success: true,
        data: null,
        message: "No open clock record found.",
      });
    }

    return res.send(openRecord);
  } catch (error) {
    return res.status(500).send({
      message: `Error retrieving open clock record: ${error.message}`,
    });
  }
};

/**
 * GET /clock-records/manager/live-attendance
 *
 * Returns all currently-clocked-in workers in the manager's departments.
 * Useful for a real-time "Who's Working Now" dashboard widget.
 */
export const getManagerLiveAttendance = async (req, res) => {
  try {
    const scope = await resolveScopedDepartmentIds(req);
    if (scope.error) return res.status(403).send({ message: scope.error });
    if (!scope.departmentIds.length) {
      return res.send({ data: [], count: 0 });
    }

    const openRecords = await ClockRecord.findAll({
      where: { clock_out: null },
      include: [
        {
          model: Shift,
          as: "shift",
          required: true,
          where: { department_id: { [Op.in]: scope.departmentIds } },
          include: [
            { model: db.department, as: "department", attributes: ["department_id", "department_name"] },
          ],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "fName", "lName", "email"],
        },
      ],
      order: [["clock_in", "DESC"]],
    });

    const data = openRecords.map((record) => ({
      clock_id: record.clock_id,
      user: record.user,
      shift: {
        shift_id: record.shift?.shift_id,
        shift_date: record.shift?.shift_date,
        start_time: record.shift?.start_time,
        end_time: record.shift?.end_time,
        department: record.shift?.department,
      },
      clock_in: record.clock_in,
      elapsed_minutes: Math.round((Date.now() - new Date(record.clock_in).getTime()) / 60000),
    }));

    return res.send({ data, count: data.length });
  } catch (error) {
    return res.status(500).send({
      message: `Error retrieving live attendance: ${error.message}`,
    });
  }
};

export const getManagerTimecards = async (req, res) => {
  try {
    const period = validatePeriod(req.query.period_start, req.query.period_end);
    if (period.error) return res.status(400).send({ message: period.error });

    const scope = await resolveScopedDepartmentIds(req);
    if (scope.error) return res.status(403).send({ message: scope.error });
    if (!scope.departmentIds.length) {
      return res.send({
        data: [],
        pending_count: 0,
      });
    }

    const departmentMemberships = await UserDepartment.findAll({
      where: {
        department_id: { [Op.in]: scope.departmentIds },
        is_active: true,
        request_status: "approved",
      },
      attributes: ["user_id"],
    });
    const userIds = [...new Set(departmentMemberships.map((membership) => Number(membership.user_id)))];

    let rows = await buildTimecardRows({
      userIds,
      departmentIds: scope.departmentIds,
      periodStartStr: period.periodStartStr,
      periodEndStr: period.periodEndStr,
    });

    const search = String(req.query.search || "").trim().toLowerCase();
    const status = String(req.query.status || "all").toLowerCase();
    if (search) {
      rows = rows.filter((row) => {
        const name = `${row.worker.fName} ${row.worker.lName}`.toLowerCase();
        const email = String(row.worker.email || "").toLowerCase();
        return name.includes(search) || email.includes(search);
      });
    }
    if (status && status !== "all") {
      rows = rows.filter((row) => String(row.status || "").toLowerCase() === status);
    }

    const pendingCount = rows.filter((row) => row.status === "pending").length;
    return res.send({
      data: rows,
      pending_count: pendingCount,
    });
  } catch (error) {
    return res.status(500).send({
      message: `Error retrieving manager timecards: ${error.message}`,
    });
  }
};

export const getManagerTimecardDetail = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).send({ message: "Valid user id is required." });

    const period = validatePeriod(req.query.period_start, req.query.period_end);
    if (period.error) return res.status(400).send({ message: period.error });

    const scope = await resolveScopedDepartmentIds(req);
    if (scope.error) return res.status(403).send({ message: scope.error });
    if (!scope.departmentIds.length) return res.status(403).send({ message: "No manager department scope found." });

    const workerMembership = await UserDepartment.findOne({
      where: {
        user_id: userId,
        department_id: { [Op.in]: scope.departmentIds },
        is_active: true,
        request_status: "approved",
      },
      include: [{ model: Role, as: "role", attributes: ["role_name", "permission_level"] }],
    });

    if (!workerMembership) {
      return res.status(404).send({ message: "Worker not found in your managed departments." });
    }

    const workerPermission = Number(workerMembership.role?.permission_level || 0);
    if (workerPermission >= 50) {
      return res.status(403).send({ message: "Selected user is not a student worker timecard target." });
    }

    const departmentId = Number(workerMembership.department_id);

    const shifts = await Shift.findAll({
      where: {
        assigned_user_id: userId,
        department_id: departmentId,
        shift_date: { [Op.between]: [period.periodStartStr, period.periodEndStr] },
      },
      include: [{ model: db.department, as: "department" }],
      order: [["shift_date", "ASC"], ["start_time", "ASC"]],
    });
    const shiftIds = shifts.map((shift) => Number(shift.shift_id));

    const clockRecords = shiftIds.length
      ? await ClockRecord.findAll({
        where: {
          user_id: userId,
          shift_id: { [Op.in]: shiftIds },
        },
        include: [
          {
            model: Shift,
            as: "shift",
            include: [{ model: db.department, as: "department" }],
          },
          {
            model: TimeDiscrepancy,
            as: "timeDiscrepancies",
            required: false,
          },
        ],
        order: [["clock_in", "ASC"]],
      })
      : [];

    const byShiftId = new Map();
    clockRecords.forEach((record) => {
      const sid = Number(record.shift_id || 0);
      if (!sid) return;
      if (!byShiftId.has(sid)) byShiftId.set(sid, []);
      byShiftId.get(sid).push(record);
    });

    const punchLog = [];
    const exceptions = [];
    let totalHours = 0;

    shifts.forEach((shift) => {
      const shiftRecords = byShiftId.get(Number(shift.shift_id)) || [];
      if (!shiftRecords.length) {
        exceptions.push({
          type: "missed_shift",
          date: shift.shift_date,
          message: `No clock record for scheduled shift (${shift.start_time} - ${shift.end_time}).`,
          severity: "error",
        });
        return;
      }

      shiftRecords.forEach((record) => {
        const scheduledClockIn = combineDateAndTime(shift.shift_date, shift.start_time);
        const actualClockIn = record.clock_in ? new Date(record.clock_in) : null;
        const varianceMinutes = scheduledClockIn && actualClockIn
          ? minutesBetween(actualClockIn, scheduledClockIn)
          : null;
        const lateThreshold = Number(shift.department?.late_threshold_minutes || 5);
        const earlyThreshold = Number(shift.department?.early_threshold_minutes || 5);
        const workedHours = getWorkedHours(record.clock_in, record.clock_out);
        totalHours += workedHours;

        const statusMeta = statusFromVariance({
          varianceMinutes,
          lateThreshold,
          earlyThreshold,
          missingClockOut: !record.clock_out,
        });

        if (statusMeta.status === "late") {
          exceptions.push({
            type: "late_arrival",
            date: shift.shift_date,
            message: `Late by ${statusMeta.lateMinutes} minute(s).`,
            severity: "warning",
          });
        }
        if (statusMeta.status === "early") {
          exceptions.push({
            type: "early_clock_in",
            date: shift.shift_date,
            message: "Clocked in earlier than threshold.",
            severity: "info",
          });
        }
        if (!record.clock_out) {
          exceptions.push({
            type: "missing_clock_out",
            date: shift.shift_date,
            message: "Missing clock-out for this shift.",
            severity: "error",
          });
        }

        punchLog.push({
          clock_id: record.clock_id,
          shift_id: shift.shift_id,
          shift_date: shift.shift_date,
          clock_in: record.clock_in,
          clock_out: record.clock_out,
          worked_hours: toHours(workedHours),
          status: statusMeta.status,
          late_minutes: statusMeta.lateMinutes,
        });
      });
    });

    const split = splitHours(totalHours);
    const approval = await TimecardApproval.findOne({
      where: {
        user_id: userId,
        department_id: departmentId,
        period_start: period.periodStartStr,
        period_end: period.periodEndStr,
      },
    });

    return res.send({
      data: {
        user_id: userId,
        department_id: departmentId,
        status: String(approval?.status || "pending").toLowerCase(),
        punch_log: punchLog,
        exceptions,
        summary: {
          regular_hours: split.regularHours,
          overtime_hours: split.overtimeHours,
          total_hours: split.totalHours,
          estimated_pay: split.estimatedPay,
        },
      },
    });
  } catch (error) {
    return res.status(500).send({
      message: `Error retrieving worker timecard detail: ${error.message}`,
    });
  }
};

export const updateManagerTimecardStatus = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const status = String(req.body.status || "").toLowerCase();
    if (!userId) return res.status(400).send({ message: "Valid user id is required." });
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).send({ message: "status must be one of: pending, approved, rejected." });
    }

    const period = validatePeriod(req.body.period_start, req.body.period_end);
    if (period.error) return res.status(400).send({ message: period.error });

    const scope = await resolveScopedDepartmentIds(req);
    if (scope.error) return res.status(403).send({ message: scope.error });
    if (!scope.departmentIds.length) return res.status(403).send({ message: "No manager department scope found." });

    const workerMembership = await UserDepartment.findOne({
      where: {
        user_id: userId,
        department_id: { [Op.in]: scope.departmentIds },
        is_active: true,
        request_status: "approved",
      },
      include: [{ model: Role, as: "role", attributes: ["permission_level"] }],
    });
    if (!workerMembership) {
      return res.status(404).send({ message: "Worker not found in your managed departments." });
    }
    if (Number(workerMembership.role?.permission_level || 0) >= 50) {
      return res.status(403).send({ message: "Selected user is not a student worker timecard target." });
    }

    const departmentId = Number(workerMembership.department_id);
    let approval = await TimecardApproval.findOne({
      where: {
        user_id: userId,
        department_id: departmentId,
        period_start: period.periodStartStr,
        period_end: period.periodEndStr,
      },
    });

    if (!approval) {
      approval = await TimecardApproval.create({
        user_id: userId,
        department_id: departmentId,
        period_start: period.periodStartStr,
        period_end: period.periodEndStr,
        status,
        decided_by: status === "pending" ? null : req.auth?.userId,
        decided_at: status === "pending" ? null : new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      approval.status = status;
      approval.decided_by = status === "pending" ? null : req.auth?.userId;
      approval.decided_at = status === "pending" ? null : new Date();
      approval.updated_at = new Date();
      await approval.save();
    }

    return res.send({
      message: "Timecard status updated.",
      data: approval,
    });
  } catch (error) {
    return res.status(500).send({
      message: `Error updating worker timecard status: ${error.message}`,
    });
  }
};

export const approveAllManagerTimecards = async (req, res) => {
  try {
    const period = validatePeriod(req.body.period_start, req.body.period_end);
    if (period.error) return res.status(400).send({ message: period.error });

    const scope = await resolveScopedDepartmentIds(req);
    if (scope.error) return res.status(403).send({ message: scope.error });
    if (!scope.departmentIds.length) {
      return res.send({ message: "No scoped departments found.", updated_count: 0 });
    }

    const memberships = await UserDepartment.findAll({
      where: {
        department_id: { [Op.in]: scope.departmentIds },
        is_active: true,
        request_status: "approved",
      },
      include: [{ model: Role, as: "role", attributes: ["permission_level", "role_name"] }],
    });

    const targets = memberships.filter((membership) => {
      const permission = Number(membership.role?.permission_level || 0);
      const roleName = String(membership.role?.role_name || "").toLowerCase();
      return permission < 50 && !roleName.includes("manager") && !roleName.includes("admin");
    });

    const now = new Date();
    let updatedCount = 0;
    for (const membership of targets) {
      const userId = Number(membership.user_id);
      const departmentId = Number(membership.department_id);
      const existing = await TimecardApproval.findOne({
        where: {
          user_id: userId,
          department_id: departmentId,
          period_start: period.periodStartStr,
          period_end: period.periodEndStr,
        },
      });

      if (!existing) {
        await TimecardApproval.create({
          user_id: userId,
          department_id: departmentId,
          period_start: period.periodStartStr,
          period_end: period.periodEndStr,
          status: "approved",
          decided_by: req.auth?.userId,
          decided_at: now,
          created_at: now,
          updated_at: now,
        });
        updatedCount += 1;
        continue;
      }

      if (String(existing.status || "").toLowerCase() === "pending") {
        existing.status = "approved";
        existing.decided_by = req.auth?.userId;
        existing.decided_at = now;
        existing.updated_at = now;
        await existing.save();
        updatedCount += 1;
      }
    }

    return res.send({
      message: "Pending timecards approved.",
      updated_count: updatedCount,
    });
  } catch (error) {
    return res.status(500).send({
      message: `Error approving all timecards: ${error.message}`,
    });
  }
};
