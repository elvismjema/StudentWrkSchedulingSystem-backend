import db from "../models/index.js";
import {
  canManageDepartment,
  resolveHighestRoleForUser,
} from "../authorization/roleAccess.js";

const UserDepartment = db.userDepartment;
const Department = db.department;

const exports = {};

const classifyRole = (role) => {
  const roleName = String(role?.role_name || "").toLowerCase();
  const permissionLevel = Number(role?.permission_level || 0);

  if (roleName.includes("admin") || permissionLevel >= 90) return "admin";
  if (
    roleName.includes("manager") ||
    roleName.includes("supervisor") ||
    permissionLevel >= 50
  ) {
    return "manager";
  }

  return "student";
};

// AT-22845: Student can view list of available departments
exports.listAvailableDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: ["department_id", "department_name", "description"],
      order: [["department_name", "ASC"]],
    });

    res.send(departments);
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some error occurred while retrieving departments.",
    });
  }
};

// AT-22846: Student can submit a department join request
exports.submitJoinRequest = async (req, res) => {
  const { user_id, department_id, position_id, role_id } = req.body;

  if (!user_id || !department_id) {
    return res.status(400).send({
      message: "user_id and department_id are required.",
    });
  }

  try {
    // Check if the department exists
    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).send({
        message: `Department with id=${department_id} not found.`,
      });
    }

    // Check if the user already has an active membership in this department
    const existing = await UserDepartment.findOne({
      where: {
        user_id: user_id,
        department_id: department_id,
        is_active: true,
      },
    });

    if (existing) {
      return res.status(409).send({
        message: "User is already an active member of this department.",
      });
    }

    const userDepartment = await UserDepartment.create({
      user_id,
      department_id,
      position_id: position_id || null,
      role_id: role_id || null,
      is_active: true,
      assigned_at: new Date(),
    });

    // AT-22847: Return confirmation after request is submitted
    res.status(201).send({
      message: "Department join request submitted successfully.",
      data: userDepartment,
    });
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some error occurred while submitting the join request.",
    });
  }
};

// List all user-department memberships for a specific user
exports.listUserDepartments = async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).send({
      message: "userId parameter is required.",
    });
  }

  try {
    const memberships = await UserDepartment.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Department,
          as: "department",
          attributes: ["department_id", "department_name", "description"],
        },
      ],
    });

    res.send(memberships);
  } catch (err) {
    res.status(500).send({
      message:
        err.message ||
        "Some error occurred while retrieving user departments.",
    });
  }
};

// Deactivate a user-department membership
exports.leaveDepar = async (req, res) => {
  const udId = req.params.id;

  try {
    const membership = await UserDepartment.findByPk(udId);

    if (!membership) {
      return res.status(404).send({
        message: `User-Department membership with id=${udId} not found.`,
      });
    }

    membership.is_active = false;
    membership.deactivated_at = new Date();
    await membership.save();

    res.send({
      message: "Successfully left the department.",
      data: membership,
    });
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some error occurred while leaving the department.",
    });
  }
};

// Admin: Get all users with their roles across all departments
exports.getAllUsersWithRoles = async (req, res) => {
  try {
    const activeOnly = String(req.query.activeOnly || "").toLowerCase() === "true";
    const userWhere = activeOnly
      ? { is_active: true }
      : undefined;

    const users = await db.user.findAll({
      where: userWhere,
      include: [
        {
          model: UserDepartment,
          as: "userDepartments",
          where: { is_active: true },
          required: false,
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["department_id", "department_name"],
            },
            {
              model: db.role,
              as: "role",
              attributes: ["role_id", "role_name", "permission_level"],
            },
            {
              model: db.position,
              as: "position",
              attributes: ["position_id", "position_name"],
            },
          ],
        },
      ],
      order: [["lName", "ASC"], ["fName", "ASC"]],
    });

    res.send(users);
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some error occurred while retrieving users with roles.",
    });
  }
};

// Admin: Assign or update user role in a department
exports.assignUserRole = async (req, res) => {
  const { user_id, department_id, role_id, position_id } = req.body;

  if (!user_id || !department_id || !role_id) {
    return res.status(400).send({
      message: "user_id, department_id, and role_id are required.",
    });
  }

  try {
    const actorUserId = req.auth?.userId;
    const actorEmail = req.auth?.email;
    const actorRole = await resolveHighestRoleForUser(actorUserId, actorEmail);

    if (actorRole !== "admin") {
      const managerCanAccessDepartment = await canManageDepartment(
        actorUserId,
        actorEmail,
        department_id,
      );

      if (!managerCanAccessDepartment) {
        return res.status(403).send({
          message: "Forbidden! You can only manage users in your departments.",
        });
      }
    }

    // Check if the department exists
    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).send({
        message: `Department with id=${department_id} not found.`,
      });
    }

    // Check if the role exists
    const role = await db.role.findByPk(role_id);
    if (!role) {
      return res.status(404).send({
        message: `Role with id=${role_id} not found.`,
      });
    }

    const targetRoleClassification = classifyRole(role);
    if (actorRole !== "admin" && targetRoleClassification !== "student") {
      return res.status(403).send({
        message: "Forbidden! Only admins can assign manager or admin roles.",
      });
    }

    // Check if the user exists
    const user = await db.user.findByPk(user_id);
    if (!user) {
      return res.status(404).send({
        message: `User with id=${user_id} not found.`,
      });
    }

    // Check if user already has an active membership in this department
    let membership = await UserDepartment.findOne({
      where: {
        user_id: user_id,
        department_id: department_id,
        is_active: true,
      },
    });

    if (membership) {
      // Update existing membership
      membership.role_id = role_id;
      membership.position_id = position_id || membership.position_id;
      await membership.save();

      const updatedMembership = await UserDepartment.findByPk(membership.ud_id, {
        include: [
          {
            model: Department,
            as: "department",
            attributes: ["department_id", "department_name"],
          },
          {
            model: db.role,
            as: "role",
            attributes: ["role_id", "role_name", "permission_level"],
          },
          {
            model: db.position,
            as: "position",
            attributes: ["position_id", "position_name"],
          },
        ],
      });

      res.send({
        message: "User role updated successfully.",
        data: updatedMembership,
      });
    } else {
      // Create new membership
      const newMembership = await UserDepartment.create({
        user_id,
        department_id,
        position_id: position_id || null,
        role_id,
        is_active: true,
        assigned_at: new Date(),
      });

      const createdMembership = await UserDepartment.findByPk(newMembership.ud_id, {
        include: [
          {
            model: Department,
            as: "department",
            attributes: ["department_id", "department_name"],
          },
          {
            model: db.role,
            as: "role",
            attributes: ["role_id", "role_name", "permission_level"],
          },
          {
            model: db.position,
            as: "position",
            attributes: ["position_id", "position_name"],
          },
        ],
      });

      res.status(201).send({
        message: "User role assigned successfully.",
        data: createdMembership,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while assigning user role.",
    });
  }
};

// Get current user's active roles across all departments
exports.getUserRoles = async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).send({
      message: "userId parameter is required.",
    });
  }

  try {
    const roles = await UserDepartment.findAll({
      where: {
        user_id: userId,
        is_active: true,
      },
      include: [
        {
          model: Department,
          as: "department",
          attributes: ["department_id", "department_name", "description"],
        },
        {
          model: db.role,
          as: "role",
          attributes: ["role_id", "role_name", "permission_level", "description"],
        },
        {
          model: db.position,
          as: "position",
          attributes: ["position_id", "position_name"],
        },
      ],
      order: [[{ model: Department, as: "department" }, "department_name", "ASC"]],
    });

    res.send(roles);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving user roles.",
    });
  }
};

// Admin: Remove user role from a department
exports.removeUserRole = async (req, res) => {
  const udId = req.params.id;

  try {
    const actorUserId = req.auth?.userId;
    const actorEmail = req.auth?.email;
    const actorRole = await resolveHighestRoleForUser(actorUserId, actorEmail);

    const membership = await UserDepartment.findByPk(udId);

    if (!membership) {
      return res.status(404).send({
        message: `User-Department membership with id=${udId} not found.`,
      });
    }

    const departmentId = membership.department_id;
    if (actorRole !== "admin") {
      const managerCanAccessDepartment = await canManageDepartment(
        actorUserId,
        actorEmail,
        departmentId,
      );

      if (!managerCanAccessDepartment) {
        return res.status(403).send({
          message: "Forbidden! You can only manage users in your departments.",
        });
      }

      const targetRole = membership.role_id
        ? await db.role.findByPk(membership.role_id)
        : null;
      const targetRoleClassification = classifyRole(targetRole);

      if (targetRoleClassification !== "student") {
        return res.status(403).send({
          message: "Forbidden! Only admins can remove manager or admin roles.",
        });
      }
    }

    membership.is_active = false;
    membership.deactivated_at = new Date();
    await membership.save();

    res.send({
      message: "User role removed successfully.",
      data: membership,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while removing user role.",
    });
  }
};

export default exports;
