import db from "../models/index.js";
import logger from "../config/logger.js";

const User = db.user;
const UserDepartment = db.userDepartment;
const Department = db.department;
const Role = db.role;
const Position = db.position;
const PendingAssignment = db.pendingAssignment;
const Op = db.Sequelize.Op;

const exports = {};

// ─── Users ───────────────────────────────────────────────────────────────────

/**
 * Admin: Get all users with their department role memberships.
 * Includes inactive users so the admin has full visibility.
 */
exports.listAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [
        {
          model: UserDepartment,
          as: "userDepartments",
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
      order: [
        ["lName", "ASC"],
        ["fName", "ASC"],
      ],
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

/**
 * Admin: Hard-delete a user entirely from the database.
 * This removes them from all tables that cascade on user delete.
 */
exports.deleteUser = async (req, res) => {
  const id = Number(req.params.id);

  // Protect against accidental self-deletion
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

    const email = user.email;
    const name = `${user.fName} ${user.lName}`;

    await user.destroy();

    logger.info(`Admin deleted user: id=${id} email=${email} name=${name}`);

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

// ─── Pending Assignments (pre-provisioning) ───────────────────────────────────

/**
 * Admin: List all pending (unfulfilled) role assignments.
 */
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

/**
 * Admin: Create a pre-provisioned role assignment by email.
 * When the target email logs in via Google it will be auto-activated.
 */
exports.createPendingAssignment = async (req, res) => {
  const { email, department_id, role_id, position_id } = req.body;

  if (!email || !department_id || !role_id) {
    return res.status(400).json({
      success: false,
      message: "email, department_id, and role_id are required.",
    });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  try {
    // Verify the department and role exist
    const [department, role] = await Promise.all([
      Department.findByPk(department_id),
      Role.findByPk(role_id),
    ]);

    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found." });
    }
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found." });
    }

    // If the user already exists in the DB, assign the role directly
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      // Check if already has this role in this department
      const existing = await UserDepartment.findOne({
        where: {
          user_id: existingUser.id,
          department_id,
          is_active: true,
        },
      });

      if (existing) {
        // Update existing membership's role
        existing.role_id = role_id;
        existing.position_id = position_id || existing.position_id;
        await existing.save();
      } else {
        // Create new membership
        await UserDepartment.create({
          user_id: existingUser.id,
          department_id,
          role_id,
          position_id: position_id || null,
          is_active: true,
          assigned_at: new Date(),
        });
      }

      logger.info(
        `Admin directly assigned role for existing user: email=${normalizedEmail} dept=${department_id} role=${role_id}`
      );

      return res.status(201).json({
        success: true,
        message: `Role assigned directly to existing user "${existingUser.fName} ${existingUser.lName}".`,
        fulfilled_immediately: true,
      });
    }

    // Check if a pending assignment already exists for this email + dept + role
    const existingPending = await PendingAssignment.findOne({
      where: {
        email: normalizedEmail,
        department_id,
        role_id,
        is_fulfilled: false,
      },
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: "A pending assignment for this email, department, and role already exists.",
      });
    }

    const assignment = await PendingAssignment.create({
      email: normalizedEmail,
      department_id,
      role_id,
      position_id: position_id || null,
      created_by: req.auth?.userId || null,
      is_fulfilled: false,
      created_at: new Date(),
    });

    logger.info(
      `Admin created pending assignment: email=${normalizedEmail} dept=${department_id} role=${role_id}`
    );

    return res.status(201).json({
      success: true,
      message: `Pending assignment created. The role will activate when ${normalizedEmail} logs in.`,
      fulfilled_immediately: false,
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

/**
 * Admin: Delete / cancel a pending assignment.
 */
exports.deletePendingAssignment = async (req, res) => {
  const id = Number(req.params.id);

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

// ─── Department Members ───────────────────────────────────────────────────────

/**
 * Admin: Get all members (active user-departments) for a given department.
 */
exports.getDepartmentMembers = async (req, res) => {
  const departmentId = Number(req.params.id);

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
