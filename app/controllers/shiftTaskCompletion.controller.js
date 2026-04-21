import db from "../models/index.js";
import { canManageDepartment, resolveHighestRoleForUser } from "../authorization/roleAccess.js";

const ShiftTaskCompletion = db.shiftTaskCompletion;
const TaskListItem = db.taskListItem;
const User = db.user;
const Shift = db.shift;
const ClockRecord = db.clockRecord;

const findShiftForTaskListItem = async (shiftId, taskListItemId = null) => {
  const shift = await Shift.findByPk(shiftId, {
    include: [
      {
        model: db.taskList,
        as: "taskList",
        required: false,
        attributes: ["id"],
      },
    ],
  });
  if (!shift) return { error: { status: 404, message: "Shift not found" } };

  if (taskListItemId) {
    if (!shift.task_list_id) {
      return { error: { status: 400, message: "This shift does not have an assigned task list" } };
    }
    const item = await TaskListItem.findOne({
      where: { id: taskListItemId, task_list_id: shift.task_list_id },
    });
    if (!item) {
      return { error: { status: 400, message: "Task does not belong to this shift's task list" } };
    }
  }

  return { shift };
};

const canViewShift = async (req, shift) => {
  const userId = Number(req.auth?.userId);
  if (Number(shift.assigned_user_id) === userId) return true;
  const role = await resolveHighestRoleForUser(userId, req.auth?.email);
  if (role === "admin" || role === "manager") return true;
  return canManageDepartment(userId, req.auth?.email, shift.department_id);
};

const canCompleteShiftTasks = async (req, shift) => {
  const userId = Number(req.auth?.userId);
  if (Number(shift.assigned_user_id) !== userId) return false;

  const openClockRecord = await ClockRecord.findOne({
    where: {
      user_id: userId,
      shift_id: shift.shift_id,
      clock_out: null,
    },
  });

  return Boolean(openClockRecord);
};

// Get all completions for a specific shift
export const getShiftCompletions = async (req, res) => {
  try {
    const { shift_id } = req.params;
    const { shift, error } = await findShiftForTaskListItem(shift_id);
    if (error) return res.status(error.status).json({ message: error.message });
    if (!(await canViewShift(req, shift))) {
      return res.status(403).json({ message: "Forbidden! You cannot view this shift's task status." });
    }

    const completions = await ShiftTaskCompletion.findAll({
      where: { shift_id },
      include: [
        { model: User, as: "completedByUser", attributes: ["id", "fName", "lName"] },
      ],
    });
    res.json(completions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mark a task list item as complete for a shift (idempotent)
export const completeTask = async (req, res) => {
  try {
    const actorUserId = req.auth?.userId;
    const { shift_id, task_list_item_id } = req.body;

    if (!shift_id || !task_list_item_id) {
      return res.status(400).json({ message: "shift_id and task_list_item_id are required" });
    }

    const { shift, error } = await findShiftForTaskListItem(shift_id, task_list_item_id);
    if (error) return res.status(error.status).json({ message: error.message });
    if (!(await canCompleteShiftTasks(req, shift))) {
      return res.status(403).json({ message: "You must be clocked in to this assigned shift to complete its tasks." });
    }

    const [completion, created] = await ShiftTaskCompletion.findOrCreate({
      where: { shift_id, task_list_item_id },
      defaults: {
        completed_by: actorUserId,
        completed_at: new Date(),
      },
    });

    res.status(created ? 201 : 200).json(completion);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Remove a completion (uncheck a task)
export const uncompleteTask = async (req, res) => {
  try {
    const { shift_id, task_list_item_id } = req.params;
    const { shift, error } = await findShiftForTaskListItem(shift_id, task_list_item_id);
    if (error) return res.status(error.status).json({ message: error.message });
    if (!(await canCompleteShiftTasks(req, shift))) {
      return res.status(403).json({ message: "You must be clocked in to this assigned shift to update its tasks." });
    }

    const deleted = await ShiftTaskCompletion.destroy({
      where: { shift_id, task_list_item_id },
    });
    if (!deleted) {
      return res.status(404).json({ message: "Completion record not found" });
    }
    res.json({ message: "Task uncompleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
