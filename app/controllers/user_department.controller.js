import db from "../models/index.js";
import {
  canManageDepartment,
  getManagedDepartmentIds,
  resolveHighestRoleForUser,
} from "../authorization/roleAccess.js";

const UserDepartment = db.userDepartment;
const Department = db.department;
const exports = {};

const exports = {};

// Get student's single active department
exports.getStudentActiveDepartment = async (userId) => {
  try {
    const activeDepartment = await UserDepartment.findOne({
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
          attributes: ["role_id", "role_name", "permission_level"],
        },
        {
          model: db.position,
          as: "position",
          attributes: ["position_id", "position_name"],
        },
      ],
      order: [
        ["is_active", "DESC"],
        ["assigned_at", "DESC"],
        ["ud_id", "DESC"],
      ],
    });

    return activeDepartment;
  } catch (error) {
    console.error('Error getting student active department:', error);
    return null;
  }
};

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

    // Check if the user already has an active or pending membership
    const Op = db.Sequelize.Op;
    const existing = await UserDepartment.findOne({
      where: {
        user_id: user_id,
        department_id: department_id,
        [Op.or]: [
          { is_active: true },
          { request_status: "pending" },
        ],
      },
    });

    if (existing) {
      if (existing.request_status === "pending") {
        return res.status(409).send({
          message: "A join request is already pending for this department.",
        });
      }
      return res.status(409).send({
        message: "User is already an active member of this department.",
      });
    }

    const userDepartment = await UserDepartment.create({
      user_id,
      department_id,
      position_id: position_id || null,
      role_id: role_id || null,
      is_active: false,
      request_status: "pending",
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
      order: [
        ["is_active", "DESC"],
        ["assigned_at", "DESC"],
        ["ud_id", "DESC"],
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
  const userId = Number(req.body?.user_id);
  const departmentId = Number(req.body?.department_id);
  const roleId = Number(req.body?.role_id);
  const positionIdRaw = req.body?.position_id;
  const positionId =
    positionIdRaw === null || positionIdRaw === undefined || positionIdRaw === ""
      ? null
      : Number(positionIdRaw);
  const applyToAllDepartments =
    req.body?.apply_to_all_departments === true ||
    req.body?.applyToAllDepartments === true;

  if (!userId || !roleId || (!applyToAllDepartments && !departmentId)) {
    return res.status(400).send({
      message:
        "user_id and role_id are required. department_id is required unless apply_to_all_departments=true.",
    });
  }

  try {
    const actorUserId = req.auth?.userId;
    const actorEmail = req.auth?.email;
    const actorRole = await resolveHighestRoleForUser(actorUserId, actorEmail);
    const role = await db.role.findByPk(roleId);

    if (!role) {
      return res.status(404).send({
        message: `Role with id=${roleId} not found.`,
      });
    }

    const targetRoleClassification = classifyRole(role);

    const shouldAssignAcrossAllDepartments =
      applyToAllDepartments ||
      (actorRole === "admin" && targetRoleClassification === "admin");

    if (shouldAssignAcrossAllDepartments && actorRole !== "admin") {
      return res.status(403).send({
        message: "Forbidden! Only admins can assign roles across all departments.",
      });
    }

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
    }

    if (actorRole !== "admin" && targetRoleClassification !== "student") {
      return res.status(403).send({
        message: "Forbidden! Only admins can assign manager or admin roles.",
      });
    }

    // Check if the user exists
    const user = await db.user.findByPk(userId);
    if (!user) {
      return res.status(404).send({
        message: `User with id=${userId} not found.`,
      });
    }

    if (shouldAssignAcrossAllDepartments) {
      const departments = await Department.findAll({
        attributes: ["department_id", "department_name"],
      });

      if (!departments.length) {
        return res.status(404).send({
          message: "No departments found.",
        });
      }

      const Op = db.Sequelize.Op;
      const matchingRoles = await db.role.findAll({
        where: {
          role_name: role.role_name,
          permission_level: role.permission_level,
          department_id: {
            [Op.in]: departments.map((d) => d.department_id),
          },
        },
      });

      const roleByDepartment = new Map(
        matchingRoles.map((r) => [Number(r.department_id), r]),
      );

      const updatedMemberships = [];
      const createdMemberships = [];
      const missingRoleDepartments = [];

      for (const department of departments) {
        const targetRole = roleByDepartment.get(Number(department.department_id));
        if (!targetRole) {
          missingRoleDepartments.push({
            department_id: department.department_id,
            department_name: department.department_name,
          });
          continue;
        }

        let membership = await UserDepartment.findOne({
          where: {
            user_id: userId,
            department_id: department.department_id,
            is_active: true,
          },
        });

        if (membership) {
          membership.role_id = targetRole.role_id;
          membership.position_id = null;
          await membership.save();
          updatedMemberships.push(membership.ud_id);
        } else {
          membership = await UserDepartment.create({
            user_id: userId,
            department_id: department.department_id,
            position_id: null,
            role_id: targetRole.role_id,
            is_active: true,
            assigned_at: new Date(),
          });
          createdMemberships.push(membership.ud_id);
        }
      }

      return res.status(200).send({
        message: `Role applied across departments. Updated: ${updatedMemberships.length}, Created: ${createdMemberships.length}.`,
        data: {
          user_id: userId,
          role_name: role.role_name,
          permission_level: role.permission_level,
          updated_memberships: updatedMemberships.length,
          created_memberships: createdMemberships.length,
          missing_role_departments: missingRoleDepartments,
        },
      });
    }

    // Check if the department exists
    const department = await Department.findByPk(departmentId);
    if (!department) {
      return res.status(404).send({
        message: `Department with id=${departmentId} not found.`,
      });
    }

    // Check if user already has an active membership in this department
    let membership = await UserDepartment.findOne({
      where: {
        user_id: userId,
        department_id: departmentId,
        is_active: true,
      },
    });

    if (membership) {
      // Update existing membership
      if (targetRoleClassification === "student") {
        await UserDepartment.update(
          {
            is_active: false,
            deactivated_at: new Date(),
          },
          {
            where: {
              user_id: userId,
              is_active: true,
              ud_id: { [db.Sequelize.Op.ne]: membership.ud_id },
            },
          },
        );
      }

      membership.role_id = roleId;
      membership.position_id = positionId === null ? membership.position_id : positionId;
      membership.is_active = true;
      membership.deactivated_at = null;
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
      // For students, deactivate all existing active departments first
      if (targetRoleClassification === "student") {
        await UserDepartment.update(
          { 
            is_active: false,
            deactivated_at: new Date()
          },
          {
            where: {
              user_id: userId,
              is_active: true
            }
          }
        );
      }

      const newMembership = await UserDepartment.create({
        user_id: userId,
        department_id: departmentId,
        position_id: positionId || null,
        role_id: roleId,
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

// Manager: add an existing (or newly created) worker to a managed department.
// If membership already exists (active or inactive), reactivate/update it instead of creating a duplicate.
exports.assignWorker = async (req, res) => {
  const userId = Number(req.body?.userId ?? req.body?.user_id);
  const departmentId = Number(req.body?.departmentId ?? req.body?.department_id);
  const positionIdRaw = req.body?.positionId ?? req.body?.position_id;
  const positionId =
    positionIdRaw === null || positionIdRaw === undefined || positionIdRaw === ""
      ? null
      : Number(positionIdRaw);

  if (!userId || !departmentId) {
    return res.status(400).send({
      message: "userId and departmentId are required.",
    });
  }

  try {
    const actorUserId = req.auth?.userId;
    const actorEmail = req.auth?.email;
    const canManage = await canManageDepartment(actorUserId, actorEmail, departmentId);
    if (!canManage) {
      return res.status(403).send({
        message: "Forbidden! You can only manage users in your departments.",
      });
    }

    const [user, department] = await Promise.all([
      db.user.findByPk(userId),
      Department.findByPk(departmentId),
    ]);

    if (!user) {
      return res.status(404).send({
        message: `User with id=${userId} not found.`,
      });
    }

    if (!department) {
      return res.status(404).send({
        message: `Department with id=${departmentId} not found.`,
      });
    }

    if (positionId !== null) {
      const position = await db.position.findByPk(positionId);
      if (!position || Number(position.department_id) !== departmentId) {
        return res.status(400).send({
          message: "Selected position does not belong to this department.",
        });
      }
    }

    // Assign student-level role for this department.
    const Op = db.Sequelize.Op;
    const studentRole = await db.role.findOne({
      where: {
        department_id: departmentId,
        [Op.or]: [
          { permission_level: { [Op.lt]: 50 } },
          { role_name: { [Op.like]: "%student%" } },
          { role_name: { [Op.like]: "%worker%" } },
        ],
      },
      order: [["permission_level", "ASC"], ["role_id", "ASC"]],
    });

    if (!studentRole) {
      return res.status(404).send({
        message: "No role configured for this department.",
      });
    }

    let membership = await UserDepartment.findOne({
      where: {
        user_id: userId,
        department_id: departmentId,
        is_active: true,
      },
    });

    if (!membership) {
      membership = await UserDepartment.findOne({
        where: {
          user_id: userId,
          department_id: departmentId,
        },
        order: [["ud_id", "DESC"]],
      });
    }

    if (membership) {
      membership.role_id = studentRole.role_id;
      membership.position_id = positionId;
      membership.is_active = true;
      membership.request_status = "approved";
      membership.deactivated_at = null;
      membership.assigned_at = new Date();
      await membership.save();
    } else {
      membership = await UserDepartment.create({
        user_id: userId,
        department_id: departmentId,
        position_id: positionId,
        role_id: studentRole.role_id,
        is_active: true,
        request_status: "approved",
        assigned_at: new Date(),
      });
    }

    const hydratedMembership = await UserDepartment.findByPk(membership.ud_id, {
      include: [
        {
          model: db.department,
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
        {
          model: db.user,
          as: "user",
          attributes: ["id", "fName", "lName", "email"],
        },
      ],
    });

    return res.status(200).send({
      message: "Worker assigned to department successfully.",
      data: hydratedMembership,
    });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Some error occurred while assigning worker to department.",
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

// AT-22809: Manager can view list of pending join requests (only for their departments)
exports.getPendingRequests = async (req, res) => {
  try {
    const actorUserId = req.auth?.userId;
    const actorEmail = req.auth?.email;
    const managedDeptIds = await getManagedDepartmentIds(actorUserId, actorEmail);

    if (!managedDeptIds.length) {
      return res.send([]);
    }

    const Op = db.Sequelize.Op;
    const pending = await UserDepartment.findAll({
      where: {
        request_status: "pending",
        department_id: { [Op.in]: managedDeptIds },
      },
      include: [
        {
          model: db.user,
          as: "user",
          attributes: ["id", "fName", "lName", "email"],
        },
        {
          model: Department,
          as: "department",
          attributes: ["department_id", "department_name", "description"],
        },
      ],
      order: [["assigned_at", "ASC"]],
    });

    res.send(pending);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Error retrieving pending join requests.",
    });
  }
};

// AT-22890: Manager can approve a student's join request
exports.approveJoinRequest = async (req, res) => {
  const udId = req.params.id;

  try {
    const membership = await UserDepartment.findByPk(udId);
    if (!membership) {
      return res.status(404).send({ message: `Request with id=${udId} not found.` });
    }

    if (membership.request_status !== "pending") {
      return res.status(400).send({ message: "This request has already been processed." });
    }

    // Verify manager has access to this department
    const actorUserId = req.auth?.userId;
    const actorEmail = req.auth?.email;
    const canManage = await canManageDepartment(actorUserId, actorEmail, membership.department_id);
    if (!canManage) {
      return res.status(403).send({ message: "Forbidden! You can only manage your own departments." });
    }

    membership.request_status = "approved";
    membership.is_active = true;
    await membership.save();

    res.send({ message: "Join request approved.", data: membership });
  } catch (err) {
    res.status(500).send({ message: err.message || "Error approving join request." });
  }
};

// AT-22891: Manager can deny a student's join request
exports.rejectJoinRequest = async (req, res) => {
  const udId = req.params.id;

  try {
    const membership = await UserDepartment.findByPk(udId);
    if (!membership) {
      return res.status(404).send({ message: `Request with id=${udId} not found.` });
    }

    if (membership.request_status !== "pending") {
      return res.status(400).send({ message: "This request has already been processed." });
    }

    const actorUserId = req.auth?.userId;
    const actorEmail = req.auth?.email;
    const canManage = await canManageDepartment(actorUserId, actorEmail, membership.department_id);
    if (!canManage) {
      return res.status(403).send({ message: "Forbidden! You can only manage your own departments." });
    }

    membership.request_status = "rejected";
    membership.is_active = false;
    await membership.save();

    res.send({ message: "Join request denied.", data: membership });
  } catch (err) {
    res.status(500).send({ message: err.message || "Error rejecting join request." });
  }
};

export default exports;
