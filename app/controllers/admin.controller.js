import db from "../models/index.js";
import logger from "../config/logger.js";

const User = db.user;
const UserDepartment = db.userDepartment;
const Department = db.department;
const Role = db.role;
const Position = db.position;
const PendingAssignment = db.pendingAssignment;

const exports = {};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

// Admin: list all users with active department memberships/roles
exports.listAllUsers = async (req, res) => {
  try {
    const activeOnly = String(req.query.activeOnly || "").toLowerCase() === "true";
    const userWhere = activeOnly ? { is_active: true } : undefined;

    const users = await User.findAll({
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
              model: Role,
              as: "role",
              attributes: ["role_id", "role_name", "permission_level"],
            },
            {
              model: Position,
              as: "position",
              attributes: ["position_id", "position_name"],
            },
          ],
        },
      ],
      order: [["lName", "ASC"], ["fName", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    logger.error(`Admin listAllUsers error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users.",
      error: err.message,
    });
  }
};

// Backward-compatible alias
exports.getAllUsers = exports.listAllUsers;

// Admin: hard-delete user
exports.deleteUser = async (req, res) => {
  const id = Number(req.params.id ?? req.params.userId);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Valid user id is required.",
    });
  }

  if (req.auth?.userId && Number(req.auth.userId) === id) {
    return res.status(400).json({
      success: false,
      message: "You cannot delete your own account.",
    });
  }

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with id=${id} not found.`,
      });
    }

    const name = `${user.fName} ${user.lName}`;
    await user.destroy();

    logger.info(`Admin deleted user id=${id} email=${user.email}`);
    return res.status(200).json({
      success: true,
      message: `User "${name}" has been permanently removed from the system.`,
    });
  } catch (err) {
    logger.error(`Admin deleteUser error for id=${id}: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user.",
      error: err.message,
    });
  }
};

// Admin: list pending role assignments
exports.listPendingAssignments = async (req, res) => {
  try {
    const assignments = await PendingAssignment.findAll({
      where: { is_fulfilled: false },
      include: [
        {
          model: Department,
          as: "department",
          attributes: ["department_id", "department_name"],
        },
        {
          model: Role,
          as: "role",
          attributes: ["role_id", "role_name", "permission_level"],
        },
        {
          model: Position,
          as: "position",
          attributes: ["position_id", "position_name"],
          required: false,
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "fName", "lName", "email"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (err) {
    logger.error(`Admin listPendingAssignments error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve pending assignments.",
      error: err.message,
    });
  }
};

// Backward-compatible alias
exports.getPendingAssignments = exports.listPendingAssignments;

// Admin: pre-provision role assignment by email
exports.createPendingAssignment = async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const departmentId = Number(req.body?.department_id);
  const roleId = Number(req.body?.role_id);
  const rawPositionId = req.body?.position_id;
  const positionId =
    rawPositionId === null || rawPositionId === undefined || rawPositionId === ""
      ? null
      : Number(rawPositionId);

  if (!normalizedEmail || !departmentId || !roleId) {
    return res.status(400).json({
      success: false,
      message: "email, department_id, and role_id are required.",
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format.",
    });
  }

  try {
    const [department, role] = await Promise.all([
      Department.findByPk(departmentId),
      Role.findByPk(roleId),
    ]);

    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found." });
    }

    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found." });
    }

    if (Number(role.department_id) !== departmentId) {
      return res.status(400).json({
        success: false,
        message: "Selected role does not belong to this department.",
      });
    }

    if (positionId) {
      const position = await Position.findByPk(positionId);
      if (!position || Number(position.department_id) !== departmentId) {
        return res.status(400).json({
          success: false,
          message: "Selected position does not belong to this department.",
        });
      }
    }

    // If user already exists, apply immediately
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      const existingMembership = await UserDepartment.findOne({
        where: {
          user_id: existingUser.id,
          department_id: departmentId,
          is_active: true,
        },
      });

      if (existingMembership) {
        existingMembership.role_id = roleId;
        existingMembership.position_id = positionId;
        await existingMembership.save();
      } else {
        await UserDepartment.create({
          user_id: existingUser.id,
          department_id: departmentId,
          role_id: roleId,
          position_id: positionId,
          is_active: true,
          assigned_at: new Date(),
        });
      }

      // Remove stale pending records for same email + department
      await PendingAssignment.destroy({
        where: {
          email: normalizedEmail,
          department_id: departmentId,
          is_fulfilled: false,
        },
      });

      logger.info(
        `Admin directly assigned role for existing user email=${normalizedEmail} dept=${departmentId} role=${roleId}`,
      );
      return res.status(201).json({
        success: true,
        fulfilled_immediately: true,
        message: `Role assigned directly to existing user "${existingUser.fName} ${existingUser.lName}".`,
      });
    }

    // Upsert pending assignment for this email + department
    const existingPending = await PendingAssignment.findOne({
      where: {
        email: normalizedEmail,
        department_id: departmentId,
        is_fulfilled: false,
      },
    });

    if (existingPending) {
      existingPending.role_id = roleId;
      existingPending.position_id = positionId;
      existingPending.created_by = req.auth?.userId || null;
      await existingPending.save();

      return res.status(200).json({
        success: true,
        fulfilled_immediately: false,
        message: "Pending assignment updated.",
        data: existingPending,
      });
    }

    const assignment = await PendingAssignment.create({
      email: normalizedEmail,
      department_id: departmentId,
      role_id: roleId,
      position_id: positionId,
      created_by: req.auth?.userId || null,
      is_fulfilled: false,
      created_at: new Date(),
    });

    logger.info(
      `Admin created pending assignment email=${normalizedEmail} dept=${departmentId} role=${roleId}`,
    );
    return res.status(201).json({
      success: true,
      fulfilled_immediately: false,
      message: `Pending assignment created. The role will activate when ${normalizedEmail} logs in.`,
      data: assignment,
    });
  } catch (err) {
    logger.error(`Admin createPendingAssignment error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to create pending assignment.",
      error: err.message,
    });
  }
};

// Admin: delete pending assignment
exports.deletePendingAssignment = async (req, res) => {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Valid pending assignment id is required.",
    });
  }

  try {
    const assignment = await PendingAssignment.findByPk(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: `Pending assignment with id=${id} not found.`,
      });
    }

    await assignment.destroy();
    return res.status(200).json({
      success: true,
      message: "Pending assignment cancelled.",
    });
  } catch (err) {
    logger.error(`Admin deletePendingAssignment error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to delete pending assignment.",
      error: err.message,
    });
  }
};

// Admin: get members for a department
exports.getDepartmentMembers = async (req, res) => {
  const departmentId = Number(req.params.id ?? req.params.departmentId);

  if (!departmentId) {
    return res.status(400).json({
      success: false,
      message: "Valid department id is required.",
    });
  }

  try {
    const department = await Department.findByPk(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found.",
      });
    }

    const memberships = await UserDepartment.findAll({
      where: {
        department_id: departmentId,
        is_active: true,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fName", "lName", "email", "is_active"],
          required: true,
        },
        {
          model: Role,
          as: "role",
          attributes: ["role_id", "role_name", "permission_level"],
          required: false,
        },
        {
          model: Position,
          as: "position",
          attributes: ["position_id", "position_name"],
          required: false,
        },
      ],
      order: [
        [{ model: User, as: "user" }, "lName", "ASC"],
        [{ model: User, as: "user" }, "fName", "ASC"],
      ],
    });

    return res.status(200).json({
      success: true,
      department: {
        department_id: department.department_id,
        department_name: department.department_name,
        description: department.description,
      },
      data: memberships,
    });
  } catch (err) {
    logger.error(`Admin getDepartmentMembers error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve department members.",
      error: err.message,
    });
  }
};

export default exports;
