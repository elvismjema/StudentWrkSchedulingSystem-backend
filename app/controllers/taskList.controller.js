import db from "../models/index.js";

const TaskList = db.taskList;
const TaskListItem = db.taskListItem;

// List task lists, optionally filtered by department
export const listTaskLists = async (req, res) => {
  try {
    const { department_id } = req.query;
    const where = {};
    if (department_id) where.department_id = department_id;

    const lists = await TaskList.findAll({
      where,
      include: [
        { model: TaskListItem, as: "items", order: [["sort_order", "ASC"]] },
      ],
      order: [["name", "ASC"]],
    });
    res.json(lists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single task list with its items
export const getTaskList = async (req, res) => {
  try {
    const list = await TaskList.findByPk(req.params.id, {
      include: [
        { model: TaskListItem, as: "items", order: [["sort_order", "ASC"]] },
      ],
    });
    if (!list) return res.status(404).json({ message: "Task list not found" });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a task list and its items in one request
export const createTaskList = async (req, res) => {
  try {
    const actorUserId = req.auth?.userId;
    const { name, description, department_id, items = [] } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!department_id) {
      return res.status(400).json({ message: "department_id is required" });
    }

    const list = await TaskList.create({
      name: name.trim(),
      description: description || null,
      department_id,
      created_by: actorUserId,
    });

    if (items.length) {
      await TaskListItem.bulkCreate(
        items.map((item, i) => ({
          task_list_id: list.id,
          title: item.title?.trim() || "",
          description: item.description || null,
          sort_order: i,
        }))
      );
    }

    const withItems = await TaskList.findByPk(list.id, {
      include: [
        { model: TaskListItem, as: "items", order: [["sort_order", "ASC"]] },
      ],
    });

    res.status(201).json(withItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a task list's name/description and replace its items
export const updateTaskList = async (req, res) => {
  try {
    const list = await TaskList.findByPk(req.params.id);
    if (!list) return res.status(404).json({ message: "Task list not found" });

    const { name, description, items } = req.body;

    await list.update({
      name: name !== undefined ? name.trim() : list.name,
      description: description !== undefined ? description : list.description,
      updated_at: new Date(),
    });

    if (Array.isArray(items)) {
      await TaskListItem.destroy({ where: { task_list_id: list.id } });
      if (items.length) {
        await TaskListItem.bulkCreate(
          items.map((item, i) => ({
            task_list_id: list.id,
            title: item.title?.trim() || "",
            description: item.description || null,
            sort_order: i,
          }))
        );
      }
    }

    const withItems = await TaskList.findByPk(list.id, {
      include: [
        { model: TaskListItem, as: "items", order: [["sort_order", "ASC"]] },
      ],
    });

    res.json(withItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a task list (items cascade)
export const deleteTaskList = async (req, res) => {
  try {
    const list = await TaskList.findByPk(req.params.id);
    if (!list) return res.status(404).json({ message: "Task list not found" });
    await list.destroy();
    res.json({ message: "Task list deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
