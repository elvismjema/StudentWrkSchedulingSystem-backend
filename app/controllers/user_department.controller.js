import db from "../models/index.js";

const UserDepartment = db.userDepartment;
const Department = db.department;

const exports = {};

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

export default exports;
