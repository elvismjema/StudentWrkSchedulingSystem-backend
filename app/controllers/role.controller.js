import db from "../models/index.js";

const User = db.user;
const Role = db.role;

// Get all available roles (from the ENUM)
export const getAllRoles = async (req, res) => {
  try {
    // Return the available roles from the ENUM
    const roles = [
      { role_id: 'student', role_name: 'Student', permission_level: 10 },
      { role_id: 'manager', role_name: 'Manager', permission_level: 50 },
      { role_id: 'admin', role_name: 'Administrator', permission_level: 90 }
    ];
    
    res.status(200).json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      message: "Error retrieving roles",
      error: error.message
    });
  }
};

// Create a new role
export const createRole = async (req, res) => {
  try {
    const { department_id, role_name, description, permission_level } = req.body;

    if (!department_id || !role_name || permission_level === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: department_id, role_name, permission_level"
      });
    }

    const department = await db.department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    const role = await Role.create({
      department_id,
      role_name,
      description,
      permission_level
    });

    return res.status(201).json({
      success: true,
      data: role
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: error.message
    });
  }
};

// Retrieve all roles
export const listRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      order: [["role_name", "ASC"]]
    });

    return res.status(200).json({
      success: true,
      data: roles
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
      error: error.message
    });
  }
};

// Get single role by ID
export const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id, {
      include: [{ model: db.department, as: "department" }]
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch role",
      error: error.message
    });
  }
};

// Update a role
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    const updatableFields = [
      "role_name",
      "description",
      "permission_level"
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        role[field] = req.body[field];
      }
    });

    role.updated_at = new Date();
    await role.save();

    return res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update role",
      error: error.message
    });
  }
};

// Delete a role
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findByPk(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    await role.destroy();

    return res.status(200).json({
      success: true,
      message: "Role deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete role",
      error: error.message
    });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { user_id, role_id, department_id } = req.body;

    if (!user_id || !role_id || !department_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: user_id, role_id, department_id"
      });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const role = await Role.findByPk(role_id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    const department = await db.department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    // Update user role
    await user.update({
      role: role_id,
      department_id: department_id
    });

    return res.status(200).json({
      success: true,
      message: "User role updated successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update user role",
      error: error.message
    });
  }
};
