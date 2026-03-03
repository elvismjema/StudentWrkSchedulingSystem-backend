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
      error: error.message
    });
  }
};
