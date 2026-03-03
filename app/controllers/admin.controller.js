import db from "../models/index.js";

const User = db.user;
const UserDepartment = db.userDepartment;
const Department = db.department;
const Role = db.role;
const Position = db.position;
const PendingRoleAssignment = db.pendingRoleAssignment;

const exports = {};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

exports.getAllUsers = async (req, res) => {
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

    return res.send({ data: users });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Failed to fetch users.",
    });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = Number(req.params.userId);
  const actorUserId = Number(req.auth?.userId);

  if (!userId) {
    return res.status(400).send({
      message: "Valid userId is required.",
    });
  }

  if (userId === actorUserId) {
    return res.status(400).send({
      message: "You cannot delete your own account.",
    });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({
        message: `User with id=${userId} not found.`,
      });
    }

    await User.destroy({
      where: { id: userId },
    });

    return res.send({
      message: "User deleted successfully.",
    });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Failed to delete user.",
    });
  }
};

exports.getDepartmentMembers = async (req, res) => {
  const departmentId = Number(req.params.departmentId);

  if (!departmentId) {
    return res.status(400).send({
      message: "Valid departmentId is required.",
    });
  }

  try {
    const members = await UserDepartment.findAll({
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

    return res.send({ data: members });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Failed to fetch department members.",
    });
  }
};

exports.getPendingAssignments = async (req, res) => {
  try {
    const items = await PendingRoleAssignment.findAll({
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

    return res.send({ data: items });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Failed to fetch pending assignments.",
    });
  }
};

exports.createPendingAssignment = async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const departmentId = Number(req.body?.department_id);
  const roleId = Number(req.body?.role_id);
  const rawPositionId = req.body?.position_id;
  const positionId =
    rawPositionId === null || rawPositionId === undefined || rawPositionId === ""
      ? null
      : Number(rawPositionId);
  const createdByUserId = Number(req.auth?.userId) || null;

  if (!normalizedEmail || !departmentId || !roleId) {
    return res.status(400).send({
      message: "email, department_id, and role_id are required.",
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).send({
      message: "Invalid email format.",
    });
  }

  try {
    const [department, role] = await Promise.all([
      Department.findByPk(departmentId),
      Role.findByPk(roleId),
    ]);

    if (!department) {
      return res.status(404).send({
        message: `Department with id=${departmentId} not found.`,
      });
    }

    if (!role) {
      return res.status(404).send({
        message: `Role with id=${roleId} not found.`,
      });
    }

    if (Number(role.department_id) !== departmentId) {
      return res.status(400).send({
        message: "Selected role does not belong to this department.",
      });
    }

    if (positionId) {
      const position = await Position.findByPk(positionId);
      if (!position || Number(position.department_id) !== departmentId) {
        return res.status(400).send({
          message: "Selected position does not belong to this department.",
        });
      }
    }

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      let membership = await UserDepartment.findOne({
        where: {
          user_id: existingUser.id,
          department_id: departmentId,
          is_active: true,
        },
      });

      if (membership) {
        membership.role_id = roleId;
        membership.position_id = positionId;
        await membership.save();
      } else {
        membership = await UserDepartment.create({
          user_id: existingUser.id,
          department_id: departmentId,
          role_id: roleId,
          position_id: positionId,
          is_active: true,
          assigned_at: new Date(),
        });
      }

      await PendingRoleAssignment.destroy({
        where: {
          email: normalizedEmail,
          department_id: departmentId,
        },
      });

      return res.send({
        message: "User exists. Role assignment applied immediately.",
        data: membership,
      });
    }

    const existingPending = await PendingRoleAssignment.findOne({
      where: {
        email: normalizedEmail,
        department_id: departmentId,
      },
    });

    if (existingPending) {
      existingPending.role_id = roleId;
      existingPending.position_id = positionId;
      existingPending.created_by_user_id = createdByUserId;
      await existingPending.save();

      return res.send({
        message: "Pending assignment updated.",
        data: existingPending,
      });
    }

    const pending = await PendingRoleAssignment.create({
      email: normalizedEmail,
      department_id: departmentId,
      role_id: roleId,
      position_id: positionId,
      created_by_user_id: createdByUserId,
    });

    return res.status(201).send({
      message: "Pending assignment created. It will activate on first login.",
      data: pending,
    });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Failed to create pending assignment.",
    });
  }
};

exports.deletePendingAssignment = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send({
      message: "Valid pending assignment id is required.",
    });
  }

  try {
    const deleted = await PendingRoleAssignment.destroy({
      where: { id },
    });

    if (!deleted) {
      return res.status(404).send({
        message: `Pending assignment with id=${id} not found.`,
      });
    }

    return res.send({
      message: "Pending assignment cancelled.",
    });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Failed to cancel pending assignment.",
    });
  }
};

export default exports;
