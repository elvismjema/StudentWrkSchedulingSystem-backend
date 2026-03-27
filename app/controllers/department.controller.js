import db from "../models/index.js";

const Department = db.department;


// Get all departments
export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: ['department_id', 'department_name', 'description'],
      order: [['department_name', 'ASC']]
    });
    
    res.status(200).json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      message: "Error retrieving departments",

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


// Get single department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const department = await Department.findByPk(id, {
      attributes: ['department_id', 'department_name', 'description']
    });
    
    if (!department) {
      return res.status(404).json({
        message: "Department not found"
      });
    }
    
    res.status(200).json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({
      message: "Error retrieving department",
      error: error.message
    });
  }
};

// Create new department
export const createDepartment = async (req, res) => {
  try {
    const { department_name, description } = req.body;
    
    if (!department_name) {
      return res.status(400).json({
        message: "Department name is required"
      });
    }
    
    const department = await Department.create({
      department_name,
      description
    });
    
    res.status(201).json(department);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({
      message: "Error creating department",

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


// Update department
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_name, description } = req.body;
    
    const department = await Department.findByPk(id);
    
    if (!department) {
      return res.status(404).json({
        message: "Department not found"
      });
    }
    
    await department.update({
      department_name: department_name || department.department_name,
      description: description || department.description
    });
    
    const updatedDepartment = await department.reload();
    res.status(200).json(updatedDepartment);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({
      message: "Error updating department",

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


// Delete department
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const department = await Department.findByPk(id);
    
    if (!department) {
      return res.status(404).json({
        message: "Department not found"
      });
    }
    
    await department.destroy();
    
    res.status(200).json({
      message: "Department deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({
      message: "Error deleting department",

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
