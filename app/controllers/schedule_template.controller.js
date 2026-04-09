import db from "../models/index.js";
import { Op } from "sequelize";
import { sendNotification } from "../services/notificationService.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toMinutes = (timeValue) => {
  const [hours, minutes] = String(timeValue || "00:00").split(":").map(Number);
  return hours * 60 + (minutes || 0);
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Reusable include block for loading a template's shifts with position, assigned
 * worker, and task list.
 */
const templateShiftIncludes = [
  { model: db.position, as: "position" },
  {
    model: db.user,
    as: "assignedUser",
    attributes: ["id", "fName", "lName", "email"],
    required: false,
  },
  {
    model: db.shiftTask,
    as: "tasks",
    required: false,
  },
];

/**
 * Fetch all template shifts (Shift rows where is_template=true) for a given
 * template, ordered by day then start time.
 */
const loadTemplateShifts = (templateId) =>
  db.shift.findAll({
    where: { template_id: templateId, is_template: true },
    include: templateShiftIncludes,
    order: [
      ["day_of_week", "ASC"],
      ["start_time", "ASC"],
    ],
  });

/**
 * Validate that a user has manager/supervisor/admin access to a department.
 * Returns true if access is allowed, false otherwise.
 */
const validateManagerDepartmentAccess = async (userId, departmentId) => {
  if (!userId || !departmentId) return false;

  // Global admin bypasses department check
  const user = await db.user.findByPk(userId, { attributes: ["id", "role"] });
  if (user?.role === "admin") return true;

  // Check active department membership with a manager or supervisor role
  const membership = await db.userDepartment.findOne({
    where: { user_id: userId, department_id: departmentId, is_active: true },
    include: [{ model: db.role, as: "role", required: true }],
  });

  if (!membership) return false;
  const roleName = String(membership.role?.role_name || "").toLowerCase();
  return roleName.includes("manager") || roleName.includes("supervisor");
};

/**
 * Return all active manager user IDs for a department.
 */
const getDepartmentManagerIds = async (departmentId) => {
  if (!departmentId) return [];

  const managerMemberships = await db.userDepartment.findAll({
    where: { department_id: departmentId, is_active: true },
    include: [{ model: db.role, as: "role", required: true }],
  });

  return managerMemberships
    .filter((m) => {
      const roleName = String(m.role?.role_name || "").toLowerCase();
      return roleName.includes("manager") || roleName.includes("supervisor");
    })
    .map((m) => m.user_id);
};

/**
 * Check whether a worker has recurring unavailability / time-off that overlaps
 * a template shift window on a given day-of-week.
 * Used for in-editor (no publish date) conflict checking.
 */
const checkRecurringConflict = async (userId, dayOfWeek, startTime, endTime) => {
  const records = await db.availability.findAll({
    where: {
      userId,
      availabilityType: { [Op.in]: ["unavailable", "time_off"] },
      requestStatus: { [Op.in]: ["approved", "pending"] },
      dayOfWeek,
      isRecurring: true,
      startTime: { [Op.lt]: endTime },
      endTime: { [Op.gt]: startTime },
    },
  });

  return records.length > 0 ? records : null;
};

/**
 * Check whether a worker has any unavailability / time-off (recurring OR for a
 * specific date) that overlaps the given shift window.
 * Used at publish time when we know the actual shift date.
 */
const checkDateConflict = async (userId, shiftDate, dayOfWeek, startTime, endTime) => {
  const records = await db.availability.findAll({
    where: {
      userId,
      availabilityType: { [Op.in]: ["unavailable", "time_off"] },
      requestStatus: { [Op.in]: ["approved", "pending"] },
      [Op.or]: [
        { specificDate: shiftDate },
        { dayOfWeek, isRecurring: true },
      ],
      startTime: { [Op.lt]: endTime },
      endTime: { [Op.gt]: startTime },
    },
  });

  return records.length > 0 ? records : null;
};

/**
 * Given the start date of a week (Monday) and a day-of-week integer (0=Sun,
 * 1=Mon … 6=Sat), return the ISO date string for that day within the week.
 */
const getShiftDate = (weekStartDate, dayOfWeek) => {
  const start = new Date(`${weekStartDate}T00:00:00`);
  // Mon=offset 0, Tue=1, … Sat=5, Sun=6
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  start.setDate(start.getDate() + offset);
  return start.toISOString().split("T")[0];
};

/**
 * Run conflict analysis on a set of template shifts.
 * - If weekStartDate is provided, check recurring + specific-date (publish-time).
 * - Otherwise, check recurring only (editor-time).
 */
const analyseConflicts = async (templateShifts, weekStartDate = null) => {
  const conflicts = [];

  for (const shift of templateShifts) {
    const shiftPlain =
      typeof shift.toJSON === "function" ? shift.toJSON() : shift;
    const shiftDate = weekStartDate
      ? getShiftDate(weekStartDate, shiftPlain.day_of_week)
      : null;

    // 1. No worker assigned → coverage gap
    if (!shiftPlain.assigned_user_id) {
      conflicts.push({
        templateShiftId: shiftPlain.shift_id,
        day_of_week: shiftPlain.day_of_week,
        day_name: DAY_NAMES[shiftPlain.day_of_week] || "Unknown",
        start_time: shiftPlain.start_time,
        end_time: shiftPlain.end_time,
        shift_date: shiftDate,
        position: shiftPlain.position || null,
        assignedUser: null,
        type: "no_coverage",
        severity: "high",
        message: `No worker assigned to ${DAY_NAMES[shiftPlain.day_of_week]} ${shiftPlain.start_time}–${shiftPlain.end_time}${shiftPlain.position ? ` (${shiftPlain.position.position_name})` : ""}`,
      });
      continue;
    }

    // 2. Worker assigned → check for unavailability / time-off conflict
    let conflictRecords = null;
    if (weekStartDate) {
      conflictRecords = await checkDateConflict(
        shiftPlain.assigned_user_id,
        shiftDate,
        shiftPlain.day_of_week,
        shiftPlain.start_time,
        shiftPlain.end_time
      );
    } else {
      conflictRecords = await checkRecurringConflict(
        shiftPlain.assigned_user_id,
        shiftPlain.day_of_week,
        shiftPlain.start_time,
        shiftPlain.end_time
      );
    }

    if (conflictRecords) {
      const userName =
        shiftPlain.assignedUser
          ? `${shiftPlain.assignedUser.fName} ${shiftPlain.assignedUser.lName}`
          : `Worker #${shiftPlain.assigned_user_id}`;

      const firstConflict = conflictRecords[0];
      const conflictTypeLabel =
        firstConflict.availabilityType === "time_off"
          ? "a time-off request"
          : "unavailability";
      const dateLabel = shiftDate
        ? ` on ${shiftDate} (${DAY_NAMES[shiftPlain.day_of_week]})`
        : ` on ${DAY_NAMES[shiftPlain.day_of_week]}s (recurring)`;

      conflicts.push({
        templateShiftId: shiftPlain.shift_id,
        day_of_week: shiftPlain.day_of_week,
        day_name: DAY_NAMES[shiftPlain.day_of_week] || "Unknown",
        start_time: shiftPlain.start_time,
        end_time: shiftPlain.end_time,
        shift_date: shiftDate,
        position: shiftPlain.position || null,
        assignedUser: shiftPlain.assignedUser || null,
        type: "availability_conflict",
        severity: "medium",
        isRecurring: !weekStartDate || Boolean(firstConflict.isRecurring),
        message: `${userName} has ${conflictTypeLabel}${dateLabel} during ${shiftPlain.start_time}–${shiftPlain.end_time}`,
      });
    }
  }

  return conflicts;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Load a template with full nested associations. */
const loadFullTemplate = async (templateId) => {
  return db.scheduleTemplate.findByPk(templateId, {
    include: [
      { model: db.department, as: "department" },
      {
        model: db.user,
        as: "creator",
        attributes: ["id", "fName", "lName", "email"],
      },
      {
        model: db.shift,
        as: "templateShifts",
        where: { is_template: true },
        required: false,
        include: templateShiftIncludes,
      },
    ],
    order: [[{ model: db.shift, as: "templateShifts" }, "day_of_week", "ASC"]],
  });
};

/**
 * Create Shift (template) records and their ShiftTasks from a plain shifts array.
 * All writes use the provided Sequelize transaction.
 */
const createTemplateShifts = async (templateId, departmentId, createdBy, shifts, transaction) => {
  for (const shift of shifts) {
    if (
      shift.day_of_week === undefined ||
      shift.day_of_week === null ||
      !shift.start_time ||
      !shift.end_time
    ) {
      continue; // skip rows that are missing required time fields
    }

    const newShift = await db.shift.create(
      {
        department_id: departmentId,
        position_id: shift.position_id || null,
        template_id: templateId,
        day_of_week: shift.day_of_week,
        shift_date: null,
        start_time: shift.start_time,
        end_time: shift.end_time,
        assigned_user_id: shift.assigned_user_id || null,
        created_by: createdBy,
        is_template: true,
        is_published: false,
        is_recurring: false,
        trade_status: null,
      },
      { transaction }
    );

    const tasks = Array.isArray(shift.tasks) ? shift.tasks : [];
    for (const task of tasks) {
      if (!task.taskName) continue;
      await db.shiftTask.create(
        {
          shiftId: newShift.shift_id,
          taskName: task.taskName,
          taskDescription: task.taskDescription || null,
          taskType: task.taskType || "other",
          priority: task.priority || "medium",
          dueTime: task.dueTime || null,
          estimatedDuration: task.estimatedDuration || null,
          status: "pending",
        },
        { transaction }
      );
    }
  }
};

// ---------------------------------------------------------------------------
// CRUD — templates
// ---------------------------------------------------------------------------

/**
 * Create a new schedule template.
 * Accepts an optional shifts array; each shift may include a tasks array.
 */
export const createScheduleTemplate = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const actorUserId = req.auth?.userId || req.body.created_by;
    const { department_id, template_name, recurrence_type, is_active, shifts = [] } = req.body;

    if (!department_id || !template_name || !recurrence_type || !actorUserId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required fields: department_id, template_name, recurrence_type",
      });
    }

    const canAccess = await validateManagerDepartmentAccess(actorUserId, department_id);
    if (!canAccess) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "You do not have manager access to this department",
      });
    }

    const validRecurrenceTypes = ["weekly", "biweekly", "monthly"];
    if (!validRecurrenceTypes.includes(recurrence_type)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid recurrence_type. Must be one of: weekly, biweekly, monthly",
      });
    }

    const template = await db.scheduleTemplate.create(
      {
        department_id,
        template_name,
        recurrence_type,
        is_active: is_active !== undefined ? is_active : true,
        created_by: actorUserId,
        created_at: new Date(),
        updated_at: new Date(),
      },
      { transaction: t }
    );

    await createTemplateShifts(template.template_id, department_id, actorUserId, shifts, t);

    await t.commit();

    const fullTemplate = await loadFullTemplate(template.template_id);
    const conflicts = await analyseConflicts(fullTemplate.templateShifts || [], null);

    return res.status(201).json({ success: true, data: fullTemplate, conflicts });
  } catch (error) {
    await t.rollback();
    console.error("Error creating schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create schedule template",
      error: error.message,
    });
  }
};

/** List templates for a department, including their template shifts. */
export const listScheduleTemplates = async (req, res) => {
  try {
    const { department_id, is_active } = req.query;
    const whereClause = {};

    if (department_id) whereClause.department_id = department_id;
    if (is_active !== undefined) whereClause.is_active = is_active === "true";

    const templates = await db.scheduleTemplate.findAll({
      where: whereClause,
      include: [
        { model: db.department, as: "department" },
        {
          model: db.user,
          as: "creator",
          attributes: ["id", "fName", "lName", "email"],
        },
        {
          model: db.shift,
          as: "templateShifts",
          where: { is_template: true },
          required: false,
          include: templateShiftIncludes,
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error("Error fetching schedule templates:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch schedule templates",
      error: error.message,
    });
  }
};

/** Get a single template with shifts, tasks and in-editor conflict analysis. */
export const getScheduleTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await loadFullTemplate(id);

    if (!template) {
      return res.status(404).json({ success: false, message: "Schedule template not found" });
    }

    const conflicts = await analyseConflicts(template.templateShifts || [], null);

    return res.status(200).json({ success: true, data: template, conflicts });
  } catch (error) {
    console.error("Error fetching schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch schedule template",
      error: error.message,
    });
  }
};

/**
 * Update a template's metadata and replace its shifts/tasks wholesale.
 * Existing template shifts are deleted and recreated from the request body.
 */
export const updateScheduleTemplate = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const actorUserId = req.auth?.userId || req.body.updated_by;
    const { id } = req.params;
    const { department_id, template_name, recurrence_type, is_active, shifts } = req.body;

    const template = await db.scheduleTemplate.findByPk(id);
    if (!template) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Schedule template not found" });
    }

    const canAccess = await validateManagerDepartmentAccess(actorUserId, template.department_id);
    if (!canAccess) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "You do not have manager access to this department",
      });
    }

    if (template_name !== undefined) template.template_name = template_name;
    if (department_id !== undefined) template.department_id = department_id;
    if (is_active !== undefined) template.is_active = is_active;
    if (recurrence_type !== undefined) {
      const validRecurrenceTypes = ["weekly", "biweekly", "monthly"];
      if (!validRecurrenceTypes.includes(recurrence_type)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid recurrence_type. Must be one of: weekly, biweekly, monthly",
        });
      }
      template.recurrence_type = recurrence_type;
    }
    template.updated_at = new Date();
    await template.save({ transaction: t });

    // Replace template shifts when provided
    if (Array.isArray(shifts)) {
      await db.shift.destroy({
        where: { template_id: id, is_template: true },
        transaction: t,
      });
      const deptId = template.department_id;
      const creator = actorUserId || template.created_by;
      await createTemplateShifts(template.template_id, deptId, creator, shifts, t);
    }

    await t.commit();

    const fullTemplate = await loadFullTemplate(template.template_id);
    const conflicts = await analyseConflicts(fullTemplate.templateShifts || [], null);

    return res.status(200).json({ success: true, data: fullTemplate, conflicts });
  } catch (error) {
    await t.rollback();
    console.error("Error updating schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update schedule template",
      error: error.message,
    });
  }
};

/** Toggle the is_active flag on a template. */
export const setScheduleTemplateActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: "is_active is required in the request body",
      });
    }

    const template = await db.scheduleTemplate.findByPk(id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Schedule template not found" });
    }

    template.is_active = is_active;
    template.updated_at = new Date();
    await template.save();

    return res.status(200).json({ success: true, data: template });
  } catch (error) {
    console.error("Error updating schedule template status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update schedule template status",
      error: error.message,
    });
  }
};

/**
 * Delete a template and all its template shifts (tasks cascade from shifts).
 */
export const deleteScheduleTemplate = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const actorUserId = req.auth?.userId;
    const { id } = req.params;

    const template = await db.scheduleTemplate.findByPk(id);
    if (!template) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Schedule template not found" });
    }

    const canAccess = await validateManagerDepartmentAccess(actorUserId, template.department_id);
    if (!canAccess) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "You do not have manager access to this department",
      });
    }

    // Destroy template shifts first; DB cascade removes their ShiftTasks
    await db.shift.destroy({
      where: { template_id: id, is_template: true },
      transaction: t,
    });

    await template.destroy({ transaction: t });
    await t.commit();

    return res.status(200).json({ success: true, message: "Schedule template deleted successfully" });
  } catch (error) {
    await t.rollback();
    console.error("Error deleting schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete schedule template",
      error: error.message,
    });
  }
};

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

/**
 * Create a deep copy of a template (all shifts + tasks) under a new name.
 * Body: { template_name }  (optional – defaults to "Copy of <original name>")
 */
export const duplicateScheduleTemplate = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const actorUserId = req.auth?.userId;
    const { id } = req.params;
    const { template_name } = req.body;

    const source = await loadFullTemplate(id);
    if (!source) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Schedule template not found" });
    }

    const newName = template_name || `Copy of ${source.template_name}`;

    const newTemplate = await db.scheduleTemplate.create(
      {
        department_id: source.department_id,
        template_name: newName,
        recurrence_type: source.recurrence_type,
        is_active: source.is_active,
        created_by: actorUserId || source.created_by,
        created_at: new Date(),
        updated_at: new Date(),
      },
      { transaction: t }
    );

    const sourceShifts = source.templateShifts || [];
    for (const srcShift of sourceShifts) {
      const shiftData =
        typeof srcShift.toJSON === "function" ? srcShift.toJSON() : srcShift;

      const newShift = await db.shift.create(
        {
          department_id: shiftData.department_id,
          position_id: shiftData.position_id,
          template_id: newTemplate.template_id,
          day_of_week: shiftData.day_of_week,
          start_time: shiftData.start_time,
          end_time: shiftData.end_time,
          assigned_user_id: shiftData.assigned_user_id || null,
          created_by: actorUserId || shiftData.created_by,
          is_template: true,
          is_published: false,
          is_recurring: false,
          shift_date: null,
          trade_status: null,
        },
        { transaction: t }
      );

      for (const task of shiftData.tasks || []) {
        await db.shiftTask.create(
          {
            shiftId: newShift.shift_id,
            taskName: task.taskName,
            taskDescription: task.taskDescription || null,
            taskType: task.taskType || "other",
            priority: task.priority || "medium",
            dueTime: task.dueTime || null,
            estimatedDuration: task.estimatedDuration || null,
            status: "pending",
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    const fullTemplate = await loadFullTemplate(newTemplate.template_id);
    return res.status(201).json({ success: true, data: fullTemplate });
  } catch (error) {
    await t.rollback();
    console.error("Error duplicating schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to duplicate schedule template",
      error: error.message,
    });
  }
};

// ---------------------------------------------------------------------------
// Conflict checking
// ---------------------------------------------------------------------------

/**
 * GET /:id/conflicts?start_date=YYYY-MM-DD
 *
 * Without start_date: editor-level (recurring unavailability only).
 * With start_date:    publish-preview level (recurring + specific-date).
 */
export const checkTemplateConflicts = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date } = req.query;

    const template = await db.scheduleTemplate.findByPk(id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Schedule template not found" });
    }

    const templateShifts = await loadTemplateShifts(id);
    const conflicts = await analyseConflicts(templateShifts, start_date || null);

    return res.status(200).json({ success: true, conflicts });
  } catch (error) {
    console.error("Error checking template conflicts:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check template conflicts",
      error: error.message,
    });
  }
};

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * POST /:id/publish
 * Body: { start_date: "YYYY-MM-DD", publish_immediately: boolean }
 *
 * Generates real Shift records for the target week, copies tasks, sends conflict
 * and coverage-gap notifications to managers, and (if publish_immediately) sends
 * shift-assignment notifications to assigned workers.
 */
export const publishTemplate = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const actorUserId = req.auth?.userId;
    const { id } = req.params;
    const { start_date, publish_immediately = false } = req.body;

    if (!start_date) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "start_date (Monday of the target week) is required",
      });
    }

    const template = await db.scheduleTemplate.findByPk(id, {
      include: [{ model: db.department, as: "department" }],
    });
    if (!template) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Schedule template not found" });
    }

    const templateShifts = await loadTemplateShifts(id);

    // Block publish if any shift has no assigned worker — workers must be assigned before
    // shifts are sent out to employees.
    const unassignedShifts = templateShifts.filter(
      (s) => !(typeof s.toJSON === "function" ? s.toJSON() : s).assigned_user_id
    );
    if (unassignedShifts.length > 0) {
      await t.rollback();
      return res.status(422).json({
        success: false,
        message: `Cannot publish: ${unassignedShifts.length} shift(s) have no worker assigned. Assign a worker to every shift before publishing.`,
        unassigned_count: unassignedShifts.length,
      });
    }

    // Analyse conflicts before creating shifts so we can surface them immediately
    const conflicts = await analyseConflicts(templateShifts, start_date);

    // Create real (non-template) shifts
    const createdShifts = [];
    for (const tmplShift of templateShifts) {
      const shiftData =
        typeof tmplShift.toJSON === "function" ? tmplShift.toJSON() : tmplShift;

      const shiftDate = getShiftDate(start_date, shiftData.day_of_week);

      const realShift = await db.shift.create(
        {
          department_id: shiftData.department_id,
          position_id: shiftData.position_id,
          template_id: template.template_id,
          day_of_week: shiftData.day_of_week,
          shift_date: shiftDate,
          start_time: shiftData.start_time,
          end_time: shiftData.end_time,
          assigned_user_id: shiftData.assigned_user_id || null,
          created_by: actorUserId || template.created_by,
          is_template: false,
          is_published: publish_immediately,
          is_recurring: false,
          trade_status: null,
        },
        { transaction: t }
      );

      for (const task of shiftData.tasks || []) {
        await db.shiftTask.create(
          {
            shiftId: realShift.shift_id,
            taskName: task.taskName,
            taskDescription: task.taskDescription || null,
            taskType: task.taskType || "other",
            priority: task.priority || "medium",
            dueTime: task.dueTime || null,
            estimatedDuration: task.estimatedDuration || null,
            status: "pending",
          },
          { transaction: t }
        );
      }

      createdShifts.push({ realShift, shiftData, shiftDate });
    }

    await t.commit();

    // ── Post-commit notifications ────────────────────────────────────────────

    const departmentName =
      template.department?.department_name || `Department #${template.department_id}`;
    const managerIds = await getDepartmentManagerIds(template.department_id);

    const coverageGaps = conflicts.filter((c) => c.type === "no_coverage");
    const availabilityConflicts = conflicts.filter((c) => c.type === "availability_conflict");

    if (coverageGaps.length > 0 && managerIds.length > 0) {
      const shiftList = coverageGaps
        .map(
          (c) =>
            `  • ${c.day_name} ${c.start_time}–${c.end_time}` +
            (c.position ? ` (${c.position.position_name})` : "")
        )
        .join("\n");
      const msg =
        `${coverageGaps.length} shift(s) from template "${template.template_name}" published ` +
        `for week of ${start_date} have no worker assigned:\n${shiftList}`;

      for (const managerId of managerIds) {
        await sendNotification(managerId, "Coverage Gaps in Published Schedule", msg, {
          type: "coverage_gap",
          link: "/manager/schedule",
          priority: "high",
        });
      }
    }

    if (availabilityConflicts.length > 0 && managerIds.length > 0) {
      const conflictList = availabilityConflicts.map((c) => `  • ${c.message}`).join("\n");
      const msg =
        `${availabilityConflicts.length} worker(s) have availability conflicts in the schedule ` +
        `published from template "${template.template_name}" for week of ${start_date}:\n${conflictList}`;

      for (const managerId of managerIds) {
        await sendNotification(managerId, "Availability Conflicts in Published Schedule", msg, {
          type: "availability_conflict",
          link: "/manager/schedule",
          priority: "high",
        });
      }
    }

    if (publish_immediately) {
      // Notify assigned workers
      for (const { realShift, shiftData, shiftDate } of createdShifts) {
        if (!shiftData.assigned_user_id) continue;

        const positionName =
          shiftData.position?.position_name || `Position #${shiftData.position_id}`;

        await db.shiftAcknowledgement.create({
          shiftId: realShift.shift_id,
          userId: shiftData.assigned_user_id,
          acknowledged: false,
          acknowledgedAt: null,
          importedToCalendar: false,
        }).catch(() => {}); // non-fatal if acknowledgement already exists

        await sendNotification(
          shiftData.assigned_user_id,
          "New Shift Assigned",
          `You have been assigned a shift on ${shiftDate} ` +
            `(${shiftData.start_time}–${shiftData.end_time}) for ${positionName} at ${departmentName}.`,
          {
            type: "shift_assignment",
            link: `/shifts/${realShift.shift_id}`,
            priority: "normal",
          }
        );
      }

      // Send a summary notification to manager[0] only (avoid spam)
      if (managerIds.length > 0) {
        await sendNotification(
          managerIds[0],
          "Schedule Published",
          `Schedule from template "${template.template_name}" published for week of ${start_date} ` +
            `(${createdShifts.length} shift(s)).`,
          {
            type: "schedule_published",
            link: "/manager/schedule",
            priority: "normal",
          }
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: `${createdShifts.length} shift(s) created from template`,
      shifts_created: createdShifts.length,
      published: publish_immediately,
      conflicts,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error publishing template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to publish template",
      error: error.message,
    });
  }
};
