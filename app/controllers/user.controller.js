import db  from "../models/index.js";
import logger from "../config/logger.js";
import { getManagedDepartmentIds } from "../authorization/roleAccess.js";

const User = db.user;
const Shift = db.shift;
const Session = db.session;
const Op = db.Sequelize.Op;
const exports = {};
// Create and Save a new User
exports.create = (req, res) => {
  // Validate request
  if (!req.body.fName) {
    logger.warn('User creation attempt with empty fName');
    res.status(400).send({
      message: "Content can not be empty!",
    });
    return;
  }

  // Create a User
  const user = {
    id: req.body.id,
    fName: req.body.fName,
    lName: req.body.lName,
    email: req.body.email,
    role: req.body.role || "student",
    // refresh_token: req.body.refresh_token,
    // expiration_date: req.body.expiration_date
  };

  logger.debug(`Creating user: ${user.email}`);

  // Save User in the database
  User.create(user)
    .then((data) => {
      logger.info(`User created successfully: ${data.id} - ${data.email}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating user: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while creating the User.",
      });
    });
};

// Retrieve all People from the database.
exports.findAll = (req, res) => {
  const id = req.query.id;
  var condition = id ? { id: { [Op.like]: `%${id}%` } } : null;

  logger.debug(`Fetching all users with condition: ${JSON.stringify(condition)}`);

  User.findAll({ where: condition })
    .then((data) => {
      logger.info(`Retrieved ${data.length} users`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving users: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving people.",
      });
    });
};

// Find a single User with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  logger.debug(`Finding user with id: ${id}`);

  User.findByPk(id)
    .then((data) => {
      if (data) {
        logger.info(`User found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`User not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find User with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving user ${id}: ${err.message}`);
      res.status(500).send({
        message: "Error retrieving User with id=" + id,
      });
    });
};

// Find a single User with an email
exports.findByEmail = (req, res) => {
  const email = req.params.email;

  logger.debug(`Finding user with email: ${email}`);

  User.findOne({
    where: {
      email: email,
    },
  })
    .then((data) => {
      if (data) {
        logger.info(`User found by email: ${email}`);
        res.send(data);
      } else {
        logger.warn(`User not found with email: ${email}`);
        res.send({ email: "not found" });
        /*res.status(404).send({
          message: `Cannot find User with email=${email}.`
        });*/
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving user by email ${email}: ${err.message}`);
      res.status(500).send({
        message: "Error retrieving User with email=" + email,
      });
    });
};

// Update a User by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;

  logger.debug(`Updating user ${id} with data: ${JSON.stringify(req.body)}`);

  User.update(req.body, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`User ${id} updated successfully`);
        res.send({
          message: "User was updated successfully.",
        });
      } else {
        logger.warn(`Failed to update user ${id} - not found or empty body`);
        res.send({
          message: `Cannot update User with id=${id}. Maybe User was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating user ${id}: ${err.message}`);
      res.status(500).send({
        message: "Error updating User with id=" + id,
      });
    });
};

// Delete a User with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  logger.debug(`Attempting to delete user: ${id}`);

  User.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`User ${id} deleted successfully`);
        res.send({
          message: "User was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete user ${id} - not found`);
        res.send({
          message: `Cannot delete User with id=${id}. Maybe User was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting user ${id}: ${err.message}`);
      res.status(500).send({
        message: "Could not delete User with id=" + id,
      });
    });
};

// Permanently delete a user from manager flow, scoped to manager's departments.
exports.deleteByManager = async (req, res) => {
  const targetUserId = Number(req.params.id);
  const actorUserId = Number(req.auth?.userId);
  const actorEmail = req.auth?.email;

  if (!targetUserId) {
    return res.status(400).send({
      message: "Valid user id is required.",
    });
  }

  if (!actorUserId) {
    return res.status(401).send({
      message: "Unauthorized! Missing authenticated user context.",
    });
  }

  if (targetUserId === actorUserId) {
    return res.status(400).send({
      message: "You cannot delete your own account.",
    });
  }

  try {
    const targetUser = await User.findByPk(targetUserId, {
      include: [
        {
          model: db.userDepartment,
          as: "userDepartments",
          where: { is_active: true },
          required: false,
          attributes: ["department_id"],
        },
      ],
    });

    if (!targetUser) {
      return res.status(404).send({
        message: `Cannot find User with id=${targetUserId}.`,
      });
    }

    const managedDeptIds = await getManagedDepartmentIds(actorUserId, actorEmail);
    const targetDeptIds = (targetUser.userDepartments || [])
      .map((membership) => Number(membership.department_id))
      .filter(Boolean);

    const canDelete = targetDeptIds.some((departmentId) => managedDeptIds.includes(departmentId));
    if (!canDelete) {
      return res.status(403).send({
        message: "Forbidden! You can only permanently delete users in your departments.",
      });
    }

    await targetUser.destroy();

    return res.send({
      message: "User was permanently deleted successfully!",
    });
  } catch (err) {
    logger.error(`Error deleting user ${targetUserId} from manager flow: ${err.message}`);
    return res.status(500).send({
      message: err.message || `Could not delete User with id=${targetUserId}.`,
    });
  }
};

// Deactivate a user account (manager action)
exports.deactivateUser = async (req, res) => {
  const id = Number(req.params.id);
  const removeFutureShifts =
    req.body?.remove_future_shifts === true ||
    req.body?.removeFutureShifts === true;

  if (!id) {
    return res.status(400).send({
      message: "Valid user id is required.",
    });
  }

  try {
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).send({
        message: `Cannot find User with id=${id}.`,
      });
    }

    if (user.is_active === false) {
      return res.send({
        success: true,
        message: "User is already inactive.",
        data: {
          id: user.id,
          is_active: false,
          deactivated_at: user.deactivated_at,
          removed_future_shifts: 0,
        },
      });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const futureShiftWhere = {
      assigned_user_id: id,
      shift_date: {
        [Op.gte]: todayIso,
      },
      trade_status: {
        [Op.or]: [
          { [Op.eq]: null },
          { [Op.ne]: "cancelled" },
        ],
      },
    };

    const futureShifts = await Shift.findAll({
      where: futureShiftWhere,
      order: [["shift_date", "ASC"], ["start_time", "ASC"]],
    });

    if (futureShifts.length > 0 && !removeFutureShifts) {
      return res.status(409).send({
        success: false,
        message: "This student has future shifts assigned. Deactivate with shift removal to continue.",
        requires_shift_removal: true,
        future_shift_count: futureShifts.length,
        future_shifts: futureShifts.map((shift) => ({
          shift_id: shift.shift_id,
          shift_date: shift.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          department_id: shift.department_id,
          position_id: shift.position_id,
        })),
      });
    }

    let removedFutureShifts = 0;
    if (futureShifts.length > 0 && removeFutureShifts) {
      removedFutureShifts = await Shift.destroy({
        where: futureShiftWhere,
      });
    }

    user.is_active = false;
    user.deactivated_at = new Date();
    await user.save();

    await Session.update(
      { token: "" },
      {
        where: {
          email: user.email,
        },
      },
    );

    return res.send({
      success: true,
      message: "User deactivated successfully.",
      data: {
        id: user.id,
        is_active: user.is_active,
        deactivated_at: user.deactivated_at,
        removed_future_shifts: removedFutureShifts,
      },
    });
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Error deactivating user.",
    });
  }
};


export default exports;
