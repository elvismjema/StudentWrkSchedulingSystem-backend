import db from "../models/index.js";

const ShiftTaskCompletion = db.shiftTaskCompletion;
const TaskListItem = db.taskListItem;
const User = db.user;

// Get all completions for a specific shift
export const getShiftCompletions = async (req, res) => {
  try {
    const { shift_id } = req.params;
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
