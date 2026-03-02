import db from "../models/index.js";

const ClockRecord = db.clockRecord;
const Shift = db.shift;
const TimeDiscrepancy = db.timeDiscrepancy;

const combineDateAndTime = (dateOnly, timeValue) => {
  if (!dateOnly || !timeValue) return null;
  return new Date(`${dateOnly}T${timeValue}`);
};

const minutesBetween = (a, b) => Math.round((a.getTime() - b.getTime()) / 60000);

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
      return res.status(404).send({
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
