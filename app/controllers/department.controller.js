import db from "../models/index.js";

const Department = db.department;

// Create and save a new department
export const createDepartment = async (req, res) => {
  try {
    const {
      department_name,
      description,
      open_during_breaks,
      break_hours_required,
      buffer_time_minutes,
      min_staff_required,
      late_threshold_minutes,
      early_threshold_minutes,
      notify_on_time_discrepancy
    } = req.body;

    if (!department_name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: department_name"
      });
    }

    const department = await Department.create({
      department_name,
      description,
      open_during_breaks,
      break_hours_required,
      buffer_time_minutes,
      min_staff_required,
      late_threshold_minutes,
      early_threshold_minutes,
      notify_on_time_discrepancy
    });

    return res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create department",
      error: error.message
    });
  }
};

// Retrieve all departments
export const listDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      order: [["department_name", "ASC"]]
    });

    return res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
      error: error.message
    });
  }
};

// Retrieve a single department by id
export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findByPk(id, {
      include: [{ model: db.position, as: "positions" }]
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch department",
      error: error.message
    });
  }
};

// Update a department
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findByPk(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    const updatableFields = [
      "department_name",
      "description",
      "open_during_breaks",
      "break_hours_required",
      "buffer_time_minutes",
      "min_staff_required",
      "late_threshold_minutes",
      "early_threshold_minutes",
      "notify_on_time_discrepancy"
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        department[field] = req.body[field];
      }
    });

    department.updated_at = new Date();
    await department.save();

    return res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update department",
      error: error.message
    });
  }
};

// Delete a department by id
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findByPk(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    await department.destroy();

    return res.status(200).json({
      success: true,
      message: "Department deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete department",
      error: error.message
    });
  }
};

// Remove all departments
export const removeAllDepartments = async (req, res) => {
  try {
    const count = await Department.destroy({ where: {} });

    return res.status(200).json({
      success: true,
      message: `${count} department(s) removed successfully`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove departments",
      error: error.message
    });
  }
};
