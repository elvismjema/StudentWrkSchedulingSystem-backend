import db from "../models/index.js";
import logger from "../config/logger.js";
import { Op } from "sequelize";

const Shift = db.shift;
const ClockRecord = db.clockRecord;
const User = db.user;
const Department = db.department;
const TimeOffRequest = db.timeOffRequest;
const ShiftSwapRequest = db.shiftSwapRequest;
const TimeDiscrepancy = db.timeDiscrepancy;
const ShiftTask = db.shiftTask;

const exports = {};

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateRange(req) {
  const now = new Date();
  const startDate =
    req.query.start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endDate =
    req.query.end_date || now.toISOString().slice(0, 10);
  return { startDate, endDate };
}

function deptFilter(req) {
  return req.query.department_id ? { department_id: req.query.department_id } : {};
}

// ── Shift Coverage Report ────────────────────────────────────────────────────

exports.shiftCoverage = async (req, res) => {
  try {
    const { startDate, endDate } = dateRange(req);
    const deptWhere = deptFilter(req);

    const shifts = await Shift.findAll({
      where: {
        shift_date: { [Op.between]: [startDate, endDate] },
        is_template: false,
        ...deptWhere,
      },
      include: [
        { model: Department, as: "department", attributes: ["department_id", "department_name"] },
        { model: User, as: "assignedUser", attributes: ["id", "fName", "lName"], required: false },
      ],
      order: [["shift_date", "ASC"], ["start_time", "ASC"]],
    });

    const total = shifts.length;
    const filled = shifts.filter((s) => s.assigned_user_id).length;
    const unfilled = total - filled;
    const published = shifts.filter((s) => s.is_published).length;
    const unpublished = total - published;

    // Group by department
    const byDepartment = {};
    for (const s of shifts) {
      const dName = s.department?.department_name || "Unknown";
      if (!byDepartment[dName]) byDepartment[dName] = { total: 0, filled: 0, unfilled: 0 };
      byDepartment[dName].total++;
      if (s.assigned_user_id) byDepartment[dName].filled++;
      else byDepartment[dName].unfilled++;
    }

    return res.json({
      period: { startDate, endDate },
      summary: { total, filled, unfilled, published, unpublished, coverageRate: total ? ((filled / total) * 100).toFixed(1) : "0.0" },
      byDepartment,
    });
  } catch (err) {
    logger.error(`shiftCoverage report error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
};

// ── Hours Worked Report ──────────────────────────────────────────────────────

exports.hoursWorked = async (req, res) => {
  try {
    const { startDate, endDate } = dateRange(req);

    const records = await ClockRecord.findAll({
      where: {
        clock_in: { [Op.between]: [new Date(startDate), new Date(endDate + "T23:59:59")] },
        clock_out: { [Op.not]: null },
      },
      include: [
        { model: User, as: "user", attributes: ["id", "fName", "lName", "email"] },
        {
          model: Shift,
          as: "shift",
          attributes: ["shift_id", "department_id"],
          include: [{ model: Department, as: "department", attributes: ["department_id", "department_name"] }],
          required: false,
        },
      ],
      order: [["clock_in", "ASC"]],
    });

    // Aggregate by user
    const byUser = {};
    for (const r of records) {
      const uid = r.user_id;
      if (!byUser[uid]) {
        byUser[uid] = {
          userId: uid,
          name: `${r.user?.fName || ""} ${r.user?.lName || ""}`.trim(),
          email: r.user?.email || "",
          totalMinutes: 0,
          shiftCount: 0,
        };
      }
      const mins = Math.round((new Date(r.clock_out) - new Date(r.clock_in)) / 60000);
      byUser[uid].totalMinutes += mins;
      byUser[uid].shiftCount++;
    }

    const workers = Object.values(byUser).map((w) => ({
      ...w,
      totalHours: (w.totalMinutes / 60).toFixed(1),
    }));

    workers.sort((a, b) => b.totalMinutes - a.totalMinutes);

    return res.json({
      period: { startDate, endDate },
      totalRecords: records.length,
      workers,
    });
  } catch (err) {
    logger.error(`hoursWorked report error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
};

// ── Attendance Summary ───────────────────────────────────────────────────────

exports.attendance = async (req, res) => {
  try {
    const { startDate, endDate } = dateRange(req);

    const discrepancies = await TimeDiscrepancy.findAll({
      where: {
        created_at: { [Op.between]: [new Date(startDate), new Date(endDate + "T23:59:59")] },
      },
      include: [
        { model: User, as: "user", attributes: ["id", "fName", "lName"] },
      ],
      order: [["created_at", "DESC"]],
    });

    const total = discrepancies.length;
    const resolved = discrepancies.filter((d) => d.is_resolved).length;
    const unresolved = total - resolved;

    // Group by type
    const byType = {};
    for (const d of discrepancies) {
      const t = d.discrepancy_type || "unknown";
      byType[t] = (byType[t] || 0) + 1;
    }

    // Top offenders
    const byUser = {};
    for (const d of discrepancies) {
      const uid = d.user_id;
      if (!byUser[uid]) {
        byUser[uid] = {
          userId: uid,
          name: `${d.user?.fName || ""} ${d.user?.lName || ""}`.trim(),
          count: 0,
          totalVarianceMinutes: 0,
        };
      }
      byUser[uid].count++;
      byUser[uid].totalVarianceMinutes += d.minutes_variance || 0;
    }

    const topUsers = Object.values(byUser).sort((a, b) => b.count - a.count).slice(0, 10);

    return res.json({
      period: { startDate, endDate },
      summary: { total, resolved, unresolved },
      byType,
      topUsers,
    });
  } catch (err) {
    logger.error(`attendance report error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
};

// ── Time-Off Summary ─────────────────────────────────────────────────────────

exports.timeOff = async (req, res) => {
  try {
    const { startDate, endDate } = dateRange(req);

    const requests = await TimeOffRequest.findAll({
      where: {
        created_at: { [Op.between]: [new Date(startDate), new Date(endDate + "T23:59:59")] },
      },
      include: [
        { model: User, as: "user", attributes: ["id", "fName", "lName"] },
      ],
      order: [["created_at", "DESC"]],
    });

    const total = requests.length;
    const byStatus = {};
    const byType = {};
    for (const r of requests) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byType[r.type] = (byType[r.type] || 0) + 1;
    }

    return res.json({
      period: { startDate, endDate },
      summary: { total, ...byStatus },
      byType,
      recent: requests.slice(0, 20).map((r) => ({
        id: r.id,
        user: `${r.user?.fName || ""} ${r.user?.lName || ""}`.trim(),
        type: r.type,
        status: r.status,
        startDate: r.start_date,
        endDate: r.end_date,
      })),
    });
  } catch (err) {
    logger.error(`timeOff report error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
};

// ── Task Completion Report ───────────────────────────────────────────────────

exports.taskCompletion = async (req, res) => {
  try {
    const tasks = await ShiftTask.findAll({
      include: [
        { model: User, as: "assignedUser", attributes: ["id", "fName", "lName"], required: false },
      ],
      order: [["createdAt", "DESC"]],
    });

    const total = tasks.length;
    const byStatus = {};
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    }

    const completionRate = total
      ? (((byStatus.completed || 0) / total) * 100).toFixed(1)
      : "0.0";

    return res.json({
      summary: { total, ...byStatus, completionRate },
    });
  } catch (err) {
    logger.error(`taskCompletion report error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
};

export default exports;
