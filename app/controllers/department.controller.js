import db from "../models/index.js";

const Department = db.department;

// Get all departments
export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: ["department_id", "department_name", "description"],
      order: [["department_name", "ASC"]]
    });
    
    res.status(200).json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      message: "Error retrieving departments",
      error: error.message
    });
  }
};

// Get single department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const department = await Department.findByPk(id);
    
    if (!department) {
      return res.status(404).json({
        message: "Department not found"
      });
    }
    
    res.status(200).json(department);
  } catch (error) {
    console.error("Error fetching department:", error);
    res.status(500).json({
      message: "Error retrieving department",
      error: error.message
    });
  }
};

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
      max_shift_length_hours
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
      max_shift_length_hours
    });

    res.status(201).json(department);
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({
      message: "Error creating department",
      error: error.message
    });
  }
};

// Update a department by the id in the request
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [updatedRowsCount] = await Department.update(req.body, {
      where: { department_id: id }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({
        message: "Department not found or no changes made"
      });
    }

    const updatedDepartment = await Department.findByPk(id);
    res.status(200).json(updatedDepartment);
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({
      message: "Error updating department",
      error: error.message
    });
  }
};

// Delete a department with the specified id in the request
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedRowsCount = await Department.destroy({
      where: { department_id: id }
    });

    if (deletedRowsCount === 0) {
      return res.status(404).json({
        message: "Department not found"
      });
    }

    res.status(200).json({
      message: "Department deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({
      message: "Error deleting department",
      error: error.message
    });
  }
};
