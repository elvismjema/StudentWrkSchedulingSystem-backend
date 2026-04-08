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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const classifyRole = (role) => {
  const roleName = String(role?.role_name || "").toLowerCase();
  const permissionLevel = Number(role?.permission_level || 0);
  if (roleName.includes("admin") || permissionLevel >= 100) return "admin";
  if (roleName.includes("manager") || roleName.includes("supervisor") || permissionLevel >= 50) return "manager";
  return "student";
};

// Admin: Assign a manager or student worker to a single department.
// Enforces the one-department rule: all existing non-admin memberships (and future shifts within
// those departments) are removed before the new assignment is created.
exports.assignDepartment = async (req, res) => {
  const userId = Number(req.body?.user_id);
  const departmentId = Number(req.body?.department_id);
  let roleId = Number(req.body?.role_id) || null;
  const rawPositionId = req.body?.position_id;
  const positionId =
    rawPositionId == null || rawPositionId === "" ? null : Number(rawPositionId);
  // role_name + permission_level are accepted as fallback when role_id is absent
  const roleName = req.body?.role_name ? String(req.body.role_name).trim() : null;
  const rolePermissionLevel = req.body?.permission_level != null ? Number(req.body.permission_level) : null;

  if (!userId || !departmentId) {
    return res.status(400).json({
      success: false,
      message: "user_id and department_id are required.",
    });
  }

  if (!roleId && !roleName) {
    return res.status(400).json({
      success: false,
      message: "Either role_id or role_name must be provided.",
    });
  }

  try {
    // If role_id is absent, resolve (or create) the role by name for this department
    let role;
    let user;
    let department;

    [user, department] = await Promise.all([
      User.findByPk(userId),
      Department.findByPk(departmentId),
    ]);

    if (roleId) {
      role = await Role.findByPk(roleId);
    } else {
      // findOrCreate using name so synthesised dropdown entries are handled
      const [foundRole] = await Role.findOrCreate({
        where: { department_id: departmentId, role_name: roleName },
        defaults: {
          department_id: departmentId,
          role_name: roleName,
          permission_level: rolePermissionLevel ?? 10,
          description: null,
        },
      });
      role = foundRole;
      roleId = role.role_id;
    }

    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (!role) return res.status(404).json({ success: false, message: "Role not found." });
    if (!department) return res.status(404).json({ success: false, message: "Department not found." });

    const roleClassification = classifyRole(role);
    const isNonAdminRole = roleClassification !== "admin";

    let removedShiftCount = 0;
    let removedMembershipCount = 0;
    const removedDepartments = [];

    if (isNonAdminRole) {
      // Find all active memberships for this user
      const existingMemberships = await UserDepartment.findAll({
        where: { user_id: userId, is_active: true },
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["role_id", "permission_level"],
          },
        ],
      });

      const Op = db.Sequelize.Op;
      const today = new Date().toISOString().split("T")[0];

      for (const membership of existingMemberships) {
        const membershipRoleLevel = Number(membership.role?.permission_level || 0);
        // Keep admin-level memberships and skip the target department
        if (membershipRoleLevel >= 90) continue;
        if (Number(membership.department_id) === departmentId) continue;

        // Unassign user from future shifts in this old department
        const [affectedShifts] = await db.shift.update(
          { assigned_user_id: null },
          {
            where: {
              assigned_user_id: userId,
              department_id: membership.department_id,
              shift_date: { [Op.gte]: today },
            },
          },
        );
        removedShiftCount += affectedShifts;

        // Deactivate old membership
        membership.is_active = false;
        membership.deactivated_at = new Date();
        await membership.save();
        removedMembershipCount++;

        // Record old department name for response / notifications
        const oldDept = await Department.findByPk(membership.department_id, {
          attributes: ["department_name"],
        });
        if (oldDept) removedDepartments.push(oldDept.department_name);
      }
    }

    // Create or update the new department membership
    let membership = await UserDepartment.findOne({
      where: { user_id: userId, department_id: departmentId, is_active: true },
    });

    if (membership) {
      membership.role_id = roleId;
      if (positionId !== null) membership.position_id = positionId;
      await membership.save();
    } else {
      membership = await UserDepartment.create({
        user_id: userId,
        department_id: departmentId,
        role_id: roleId,
        position_id: positionId,
        is_active: true,
        request_status: "approved",
        assigned_at: new Date(),
      });
    }

    // ── Notifications ───────────────────────────────────────────────────────
    const Notification = db.notification;

    // Notify the assigned user
    await Notification.create({
      title: "Department Assignment",
      message: `You have been assigned to ${department.department_name} as ${role.role_name}.`,
      userId,
      isRead: false,
    });

    // If assigning a student/worker, notify the managers of the new department
    if (roleClassification === "student") {
      const managerMemberships = await UserDepartment.findAll({
        where: { department_id: departmentId, is_active: true },
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["role_id", "permission_level"],
          },
        ],
      });

      for (const managerMembership of managerMemberships) {
        const managerId = Number(managerMembership.user_id);
        const managerRoleLevel = Number(managerMembership.role?.permission_level || 0);
        if (managerRoleLevel >= 50 && managerRoleLevel < 90 && managerId !== userId) {
          await Notification.create({
            title: "New Student Worker Assigned",
            message: `${user.fName} ${user.lName} has been assigned to ${department.department_name}.`,
            userId: managerId,
            isRead: false,
          });
        }
      }
    }

    logger.info(
      `Admin assigned user id=${userId} to department id=${departmentId} role id=${roleId}. Removed ${removedMembershipCount} old memberships, ${removedShiftCount} future shifts unassigned.`,
    );

    return res.status(200).json({
      success: true,
      message: `${user.fName} ${user.lName} has been assigned to ${department.department_name} as ${role.role_name}.`,
      data: {
        membership,
        removed_memberships: removedMembershipCount,
        removed_shifts: removedShiftCount,
        removed_departments: removedDepartments,
      },
    });
  } catch (err) {
    logger.error(`Admin assignDepartment error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to assign department.",
      error: err.message,
    });
  }
};

// Admin: promote a user to site-wide admin.
// Sets user.role = 'admin', deactivates all non-admin dept memberships, unassigns future shifts.
exports.promoteToAdmin = async (req, res) => {
  const userId = Number(req.params.userId);
  const requestingUserId = Number(req.auth?.userId);

  if (!userId) {
    return res.status(400).json({ success: false, message: "Valid userId is required." });
  }

  if (userId === requestingUserId) {
    return res.status(400).json({ success: false, message: "You cannot promote yourself." });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    if (user.role === "admin") {
      return res.status(400).json({ success: false, message: `${user.fName} ${user.lName} is already an admin.` });
    }

    const Op = db.Sequelize.Op;
    const today = new Date().toISOString().split("T")[0];

    // Deactivate all active non-admin department memberships and unassign future shifts
    const memberships = await UserDepartment.findAll({
      where: { user_id: userId, is_active: true },
      include: [{ model: Role, as: "role", attributes: ["role_id", "permission_level"] }],
    });

    let removedShiftCount = 0;
    let removedMembershipCount = 0;

    for (const membership of memberships) {
      const level = Number(membership.role?.permission_level || 0);
      if (level >= 100) continue; // already admin-level — leave intact

      const [affected] = await db.shift.update(
        { assigned_user_id: null },
        {
          where: {
            assigned_user_id: userId,
            department_id: membership.department_id,
            shift_date: { [Op.gte]: today },
          },
        },
      );
      removedShiftCount += affected;

      membership.is_active = false;
      membership.deactivated_at = new Date();
      await membership.save();
      removedMembershipCount++;
    }

    // Set global admin flag
    user.role = "admin";
    await user.save();

    // Notify the promoted user
    const Notification = db.notification;
    await Notification.create({
      title: "Admin Access Granted",
      message: "You have been granted site-wide admin access.",
      userId,
      isRead: false,
    });

    logger.info(
      `Admin id=${requestingUserId} promoted user id=${userId} to admin. Removed ${removedMembershipCount} memberships, ${removedShiftCount} future shifts unassigned.`,
    );

    return res.status(200).json({
      success: true,
      message: `${user.fName} ${user.lName} has been promoted to admin.`,
      data: { removed_memberships: removedMembershipCount, removed_shifts: removedShiftCount },
    });
  } catch (err) {
    logger.error(`Admin promoteToAdmin error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to promote user.", error: err.message });
  }
};

// Admin: get roles for a department (excludes admin-level, used for the assign-department dialog)
exports.getDepartmentRoles = async (req, res) => {  const departmentId = Number(req.params.departmentId);

  if (!departmentId) {
    return res.status(400).json({ success: false, message: "Valid departmentId is required." });
  }

  try {
    // Ensure the standard Student and Manager roles exist for this department
    // and build the response directly from each findOrCreate result so that
    // a missing Manager is never silently dropped by a subsequent findAll.
    const standardRoles = [
      { role_name: "Student", permission_level: 10, description: "Student worker with basic scheduling access" },
      { role_name: "Manager", permission_level: 60, description: "Department manager with scheduling and approval permissions" },
    ];

    const result = [];
    for (const template of standardRoles) {
      try {
        const [role, created] = await Role.findOrCreate({
          where: { department_id: departmentId, role_name: template.role_name },
          defaults: {
            department_id: departmentId,
            role_name: template.role_name,
            permission_level: template.permission_level,
            description: template.description,
          },
        });
        result.push(role);
      } catch (innerErr) {
        // findOrCreate failed — fall back to a plain find
        const existing = await Role.findOne({
          where: { department_id: departmentId, role_name: template.role_name },
        });
        if (existing) {
          result.push(existing);
        }
      }
    }

    // Filter out true admin-level roles (permission_level >= 100) before returning
    const filtered = result.filter((r) => Number(r.permission_level) < 100);

    return res.status(200).json({ success: true, data: filtered });
  } catch (err) {
    logger.error(`Admin getDepartmentRoles error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to retrieve roles.", error: err.message });
  }
};

export default exports;
