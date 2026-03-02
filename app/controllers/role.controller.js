import db from "../models/index.js";

const Role = db.role;

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

    const createdRole = await Role.findByPk(role.role_id, {
      include: [{ model: db.department, as: "department" }]
    });

    return res.status(201).json({
      success: true,
      data: createdRole
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: error.message
    });
  }
};

// Retrieve all roles with optional department filter
export const listRoles = async (req, res) => {
  try {
    const { department_id } = req.query;
    const where = {};

    if (department_id) {
      where.department_id = department_id;
    }

    const roles = await Role.findAll({
      where,
      include: [{ model: db.department, as: "department" }],
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

// Retrieve one role by id
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

// Update role by id
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id, role_name, description, permission_level } = req.body;

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    if (department_id !== undefined) {
      const department = await db.department.findByPk(department_id);
      if (!department) {
        return res.status(404).json({
          success: false,
          message: "Department not found"
        });
      }
      role.department_id = department_id;
    }

    if (role_name !== undefined) role.role_name = role_name;
    if (description !== undefined) role.description = description;
    if (permission_level !== undefined) role.permission_level = permission_level;

    await role.save();

    const updatedRole = await Role.findByPk(id, {
      include: [{ model: db.department, as: "department" }]
    });

    return res.status(200).json({
      success: true,
      data: updatedRole
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update role",
      error: error.message
    });
  }
};

// Delete role by id
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
