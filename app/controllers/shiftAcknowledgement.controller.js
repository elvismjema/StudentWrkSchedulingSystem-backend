import db from "../models/index.js";
import logger from "../config/logger.js";
import { resolveHighestRoleForUser } from "../authorization/roleAccess.js";

const ShiftAcknowledgement = db.shiftAcknowledgement;
const Shift = db.shift;
const User = db.user;
const Department = db.department;
const Op = db.Sequelize.Op;

const exports = {};

// Create and Save a new Shift Acknowledgement
exports.create = (req, res) => {
  // Validate request
  if (!req.body.shiftId || !req.body.userId) {
    logger.warn('Shift Acknowledgement creation attempt with missing required fields');
    res.status(400).send({
      message: "Shift ID and User ID are required!",
    });
    return;
  }

  // Create a Shift Acknowledgement
  const shiftAcknowledgement = {
    shiftId: req.body.shiftId,
    userId: req.body.userId,
    acknowledged: req.body.acknowledged || false,
    acknowledgedAt: req.body.acknowledgedAt || null,
    importedToCalendar: req.body.importedToCalendar || false,
  };

  logger.debug(`Creating shift acknowledgement for shift: ${shiftAcknowledgement.shiftId}, user: ${shiftAcknowledgement.userId}`);

  // Save Shift Acknowledgement in the database
  ShiftAcknowledgement.create(shiftAcknowledgement)
    .then((data) => {
      logger.info(`Shift Acknowledgement created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating shift acknowledgement: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Shift Acknowledgement.",
      });
    });
};

// Retrieve all Shift Acknowledgements from the database
exports.findAll = (req, res) => {
  const shiftId = req.query.shiftId;
  const userId = req.query.userId;
  const acknowledged = req.query.acknowledged;

  let condition = {};

  if (shiftId) {
    condition.shiftId = shiftId;
  }
  if (userId) {
    condition.userId = userId;
  }
  if (acknowledged !== undefined) {
    condition.acknowledged = acknowledged === 'true';
  }

  logger.debug(`Fetching shift acknowledgements with condition: ${JSON.stringify(condition)}`);

  ShiftAcknowledgement.findAll({
    where: condition,
    include: [
      {
        model: Shift,
        as: 'shift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      }
    ],
    order: [['createdAt', 'DESC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} shift acknowledgements`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving shift acknowledgements: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving shift acknowledgements.",
      });
    });
};

// Retrieve all unacknowledged Shift Acknowledgements
exports.findAllUnacknowledged = (req, res) => {
  logger.debug('Fetching all unacknowledged shift acknowledgements');

  ShiftAcknowledgement.findAll({
    where: { acknowledged: false },
    include: [
      {
        model: Shift,
        as: 'shift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      }
    ],
    order: [['createdAt', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} unacknowledged shift acknowledgements`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving unacknowledged shift acknowledgements: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving unacknowledged shift acknowledgements.",
      });
    });
};

// Retrieve all Shift Acknowledgements for a specific user
exports.findAllForUser = (req, res) => {
  const userId = req.params.userId;

  logger.debug(`Fetching shift acknowledgements for user: ${userId}`);

  ShiftAcknowledgement.findAll({
    where: { userId: userId, acknowledged: false },
    include: [
      {
        model: Shift,
        as: 'shift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id', 'position_id'],
        include: [
          {
            model: Department,
            as: 'department',
            attributes: ['department_id', 'department_name', 'location']
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} shift acknowledgements for user ${userId}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving shift acknowledgements for user ${userId}: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving shift acknowledgements.",
      });
    });
};

// Retrieve all Shift Acknowledgements for a specific shift
exports.findAllForShift = (req, res) => {
  const shiftId = req.params.shiftId;

  logger.debug(`Fetching shift acknowledgements for shift: ${shiftId}`);

  ShiftAcknowledgement.findAll({
    where: { shiftId: shiftId },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      }
    ],
    order: [['createdAt', 'DESC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} shift acknowledgements for shift ${shiftId}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving shift acknowledgements for shift ${shiftId}: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving shift acknowledgements.",
      });
    });
};

// Find a single Shift Acknowledgement with an id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding shift acknowledgement with id: ${id}`);

  ShiftAcknowledgement.findByPk(id, {
    include: [
      {
        model: Shift,
        as: 'shift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      }
    ]
  })
    .then((data) => {
      if (data) {
        logger.info(`Shift Acknowledgement found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Shift Acknowledgement not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Shift Acknowledgement with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving shift acknowledgement ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error retrieving Shift Acknowledgement with id=${id}`,
      });
    });
};

// Update a Shift Acknowledgement by the id
exports.update = (req, res) => {
  const id = req.params.id;

  logger.debug(`Updating shift acknowledgement with id: ${id}`);

  ShiftAcknowledgement.update(req.body, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Shift Acknowledgement updated successfully: ${id}`);
        res.send({
          message: "Shift Acknowledgement was updated successfully.",
        });
      } else {
        logger.warn(`Cannot update shift acknowledgement with id ${id}. Acknowledgement not found or req.body is empty`);
        res.status(404).send({
          message: `Cannot update Shift Acknowledgement with id=${id}. Maybe Shift Acknowledgement was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating shift acknowledgement ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error updating Shift Acknowledgement with id=${id}`,
      });
    });
};

/**
 * Acknowledge a shift (set acknowledged to true).
 * FIX: Added ownership validation — students can only acknowledge their own shifts.
 */
exports.acknowledge = async (req, res) => {
  const id = req.params.id;

  logger.debug(`Acknowledging shift acknowledgement: ${id}`);

  try {
    const acknowledgement = await ShiftAcknowledgement.findByPk(id);
    if (!acknowledgement) {
      return res.status(404).send({
        message: `Shift Acknowledgement with id=${id} was not found.`,
      });
    }

    // Ownership check: students can only acknowledge their own shifts
    const authUserId = Number(req.auth?.userId);
    if (acknowledgement.userId !== authUserId) {
      const role = await resolveHighestRoleForUser(authUserId, req.auth?.email);
      if (role !== "manager" && role !== "admin") {
        return res.status(403).send({
          message: "Forbidden! You can only acknowledge your own shifts.",
        });
      }
    }

    acknowledgement.acknowledged = true;
    acknowledgement.acknowledgedAt = new Date();
    await acknowledgement.save();

    logger.info(`Shift acknowledged successfully: ${id}`);
    res.send({
      message: "Shift was acknowledged successfully.",
      data: acknowledgement,
    });
  } catch (err) {
    logger.error(`Error acknowledging shift ${id}: ${err.message}`);
    res.status(500).send({
      message: `Error acknowledging Shift with id=${id}`,
    });
  }
};

/**
 * Mark shift as imported to calendar.
 * FIX: Added ownership validation — students can only mark their own.
 */
exports.markCalendarImported = async (req, res) => {
  const id = req.params.id;

  logger.debug(`Marking shift acknowledgement ${id} as imported to calendar`);

  try {
    const acknowledgement = await ShiftAcknowledgement.findByPk(id);
    if (!acknowledgement) {
      return res.status(404).send({
        message: `Shift Acknowledgement with id=${id} was not found.`,
      });
    }

    // Ownership check
    const authUserId = Number(req.auth?.userId);
    if (acknowledgement.userId !== authUserId) {
      const role = await resolveHighestRoleForUser(authUserId, req.auth?.email);
      if (role !== "manager" && role !== "admin") {
        return res.status(403).send({
          message: "Forbidden! You can only mark your own shifts as imported.",
        });
      }
    }

    acknowledgement.importedToCalendar = true;
    await acknowledgement.save();

    logger.info(`Shift marked as imported to calendar: ${id}`);
    res.send({
      message: "Shift was marked as imported to calendar successfully.",
      data: acknowledgement,
    });
  } catch (err) {
    logger.error(`Error marking shift ${id} as imported: ${err.message}`);
    res.status(500).send({
      message: `Error marking Shift with id=${id} as imported`,
    });
  }
};

// Delete a Shift Acknowledgement with the specified id
exports.delete = (req, res) => {
  const id = req.params.id;

  logger.debug(`Deleting shift acknowledgement with id: ${id}`);

  ShiftAcknowledgement.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Shift Acknowledgement deleted successfully: ${id}`);
        res.send({
          message: "Shift Acknowledgement was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete shift acknowledgement with id ${id}. Acknowledgement not found`);
        res.status(404).send({
          message: `Cannot delete Shift Acknowledgement with id=${id}. Maybe Shift Acknowledgement was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting shift acknowledgement ${id}: ${err.message}`);
      res.status(500).send({
        message: `Could not delete Shift Acknowledgement with id=${id}`,
      });
    });
};

// Delete all Shift Acknowledgements from the database
exports.deleteAll = (req, res) => {
  logger.warn('Attempting to delete all shift acknowledgements');

  ShiftAcknowledgement.destroy({
    where: {},
    truncate: false,
  })
    .then((nums) => {
      logger.info(`${nums} shift acknowledgements deleted successfully`);
      res.send({ message: `${nums} Shift Acknowledgements were deleted successfully!` });
    })
    .catch((err) => {
      logger.error(`Error deleting all shift acknowledgements: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all shift acknowledgements.",
      });
    });
};

export default exports;
