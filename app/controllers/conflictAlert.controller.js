import db from "../models/index.js";
import logger from "../config/logger.js";

const ConflictAlert = db.conflictAlert;
const Shift = db.shift;
const User = db.user;
const Op = db.Sequelize.Op;

const exports = {};

// Create and Save a new Conflict Alert
exports.create = (req, res) => {
  // Validate request
  if (!req.body.userId || !req.body.primaryShiftId || !req.body.conflictType) {
    logger.warn('Conflict Alert creation attempt with missing required fields');
    res.status(400).send({
      message: "User ID, Primary Shift ID, and Conflict Type are required!",
    });
    return;
  }

  // Create a Conflict Alert
  const conflictAlert = {
    userId: req.body.userId,
    primaryShiftId: req.body.primaryShiftId,
    conflictingShiftId: req.body.conflictingShiftId || null,
    conflictType: req.body.conflictType,
    conflictDate: req.body.conflictDate,
    conflictStartTime: req.body.conflictStartTime,
    conflictEndTime: req.body.conflictEndTime,
    conflictDetails: req.body.conflictDetails || null,
    severity: req.body.severity || 'medium',
    alertStatus: req.body.alertStatus || 'open',
    autoDetected: req.body.autoDetected !== undefined ? req.body.autoDetected : true,
    notificationSent: req.body.notificationSent || false,
  };

  logger.debug(`Creating conflict alert for user: ${conflictAlert.userId}, type: ${conflictAlert.conflictType}`);

  // Save Conflict Alert in the database
  ConflictAlert.create(conflictAlert)
    .then((data) => {
      logger.info(`Conflict Alert created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating conflict alert: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Conflict Alert.",
      });
    });
};

// Retrieve all Conflict Alerts from the database
exports.findAll = (req, res) => {
  const userId = req.query.userId;
  const conflictType = req.query.conflictType;
  const alertStatus = req.query.alertStatus;
  const severity = req.query.severity;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  let condition = {};
  
  if (userId) {
    condition.userId = userId;
  }
  if (conflictType) {
    condition.conflictType = conflictType;
  }
  if (alertStatus) {
    condition.alertStatus = alertStatus;
  }
  if (severity) {
    condition.severity = severity;
  }
  if (startDate && endDate) {
    condition.conflictDate = {
      [Op.between]: [startDate, endDate]
    };
  } else if (startDate) {
    condition.conflictDate = {
      [Op.gte]: startDate
    };
  } else if (endDate) {
    condition.conflictDate = {
      [Op.lte]: endDate
    };
  }

  logger.debug(`Fetching conflict alerts with condition: ${JSON.stringify(condition)}`);

  ConflictAlert.findAll({ 
    where: condition,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      },
      {
        model: Shift,
        as: 'primaryShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: Shift,
        as: 'conflictingShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id'],
        required: false
      },
      {
        model: User,
        as: 'acknowledger',
        attributes: ['id', 'fName', 'lName'],
        required: false
      },
      {
        model: User,
        as: 'resolver',
        attributes: ['id', 'fName', 'lName'],
        required: false
      }
    ],
    order: [['conflictDate', 'DESC'], ['severity', 'DESC'], ['createdAt', 'DESC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} conflict alerts`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving conflict alerts: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving conflict alerts.",
      });
    });
};

// Retrieve all open Conflict Alerts
exports.findAllOpen = (req, res) => {
  logger.debug('Fetching all open conflict alerts');

  ConflictAlert.findAll({ 
    where: { alertStatus: 'open' },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      },
      {
        model: Shift,
        as: 'primaryShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: Shift,
        as: 'conflictingShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id'],
        required: false
      }
    ],
    order: [['severity', 'DESC'], ['conflictDate', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} open conflict alerts`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving open conflict alerts: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving open conflict alerts.",
      });
    });
};

// Retrieve all Conflict Alerts for a specific user
exports.findAllForUser = (req, res) => {
  const userId = req.params.userId;

  logger.debug(`Fetching conflict alerts for user: ${userId}`);

  ConflictAlert.findAll({ 
    where: { userId: userId },
    include: [
      {
        model: Shift,
        as: 'primaryShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: Shift,
        as: 'conflictingShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id'],
        required: false
      },
      {
        model: User,
        as: 'acknowledger',
        attributes: ['id', 'fName', 'lName'],
        required: false
      },
      {
        model: User,
        as: 'resolver',
        attributes: ['id', 'fName', 'lName'],
        required: false
      }
    ],
    order: [['conflictDate', 'DESC'], ['createdAt', 'DESC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} conflict alerts for user ${userId}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving conflict alerts for user ${userId}: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving conflict alerts for user.",
      });
    });
};

// Retrieve all Conflict Alerts for a specific shift
exports.findAllForShift = (req, res) => {
  const shiftId = req.params.shiftId;

  logger.debug(`Fetching conflict alerts for shift: ${shiftId}`);

  ConflictAlert.findAll({ 
    where: {
      [Op.or]: [
        { primaryShiftId: shiftId },
        { conflictingShiftId: shiftId }
      ]
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      },
      {
        model: Shift,
        as: 'primaryShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: Shift,
        as: 'conflictingShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id'],
        required: false
      }
    ],
    order: [['conflictDate', 'DESC'], ['createdAt', 'DESC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} conflict alerts for shift ${shiftId}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving conflict alerts for shift ${shiftId}: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving conflict alerts for shift.",
      });
    });
};

// Find a single Conflict Alert with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  logger.debug(`Fetching conflict alert: ${id}`);

  ConflictAlert.findByPk(id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      },
      {
        model: Shift,
        as: 'primaryShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: Shift,
        as: 'conflictingShift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id'],
        required: false
      },
      {
        model: User,
        as: 'acknowledger',
        attributes: ['id', 'fName', 'lName'],
        required: false
      },
      {
        model: User,
        as: 'resolver',
        attributes: ['id', 'fName', 'lName'],
        required: false
      }
    ]
  })
    .then((data) => {
      if (data) {
        logger.info(`Retrieved conflict alert: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Conflict alert not found: ${id}`);
        res.status(404).send({
          message: `Cannot find Conflict Alert with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving conflict alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error retrieving Conflict Alert with id=${id}`,
      });
    });
};

// Update a Conflict Alert by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;

  logger.debug(`Updating conflict alert: ${id}`);

  ConflictAlert.update(req.body, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Conflict alert updated successfully: ${id}`);
        res.send({
          message: "Conflict Alert was updated successfully.",
        });
      } else {
        logger.warn(`Cannot update conflict alert ${id}. Maybe not found or req.body is empty.`);
        res.send({
          message: `Cannot update Conflict Alert with id=${id}. Maybe Conflict Alert was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating conflict alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error updating Conflict Alert with id=${id}`,
      });
    });
};

// Acknowledge a Conflict Alert
exports.acknowledge = (req, res) => {
  const id = req.params.id;
  const acknowledgedBy = req.body.acknowledgedBy;

  if (!acknowledgedBy) {
    logger.warn('Acknowledge attempt without acknowledgedBy field');
    res.status(400).send({
      message: "acknowledgedBy is required!",
    });
    return;
  }

  logger.debug(`Acknowledging conflict alert: ${id} by user: ${acknowledgedBy}`);

  ConflictAlert.update(
    {
      alertStatus: 'acknowledged',
      acknowledgedBy: acknowledgedBy,
      acknowledgedAt: new Date()
    },
    {
      where: { id: id },
    }
  )
    .then((num) => {
      if (num == 1) {
        logger.info(`Conflict alert acknowledged successfully: ${id}`);
        res.send({
          message: "Conflict Alert was acknowledged successfully.",
        });
      } else {
        logger.warn(`Cannot acknowledge conflict alert ${id}. Maybe not found.`);
        res.send({
          message: `Cannot acknowledge Conflict Alert with id=${id}. Maybe Conflict Alert was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error acknowledging conflict alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error acknowledging Conflict Alert with id=${id}`,
      });
    });
};

// Resolve a Conflict Alert
exports.resolve = (req, res) => {
  const id = req.params.id;
  const resolvedBy = req.body.resolvedBy;
  const resolutionNotes = req.body.resolutionNotes || null;

  if (!resolvedBy) {
    logger.warn('Resolve attempt without resolvedBy field');
    res.status(400).send({
      message: "resolvedBy is required!",
    });
    return;
  }

  logger.debug(`Resolving conflict alert: ${id} by user: ${resolvedBy}`);

  ConflictAlert.update(
    {
      alertStatus: 'resolved',
      resolvedBy: resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes: resolutionNotes
    },
    {
      where: { id: id },
    }
  )
    .then((num) => {
      if (num == 1) {
        logger.info(`Conflict alert resolved successfully: ${id}`);
        res.send({
          message: "Conflict Alert was resolved successfully.",
        });
      } else {
        logger.warn(`Cannot resolve conflict alert ${id}. Maybe not found.`);
        res.send({
          message: `Cannot resolve Conflict Alert with id=${id}. Maybe Conflict Alert was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error resolving conflict alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error resolving Conflict Alert with id=${id}`,
      });
    });
};

// Cancel a Conflict Alert
exports.cancel = (req, res) => {
  const id = req.params.id;

  logger.debug(`Cancelling conflict alert: ${id}`);

  ConflictAlert.update(
    {
      alertStatus: 'cancelled'
    },
    {
      where: { id: id },
    }
  )
    .then((num) => {
      if (num == 1) {
        logger.info(`Conflict alert cancelled successfully: ${id}`);
        res.send({
          message: "Conflict Alert was cancelled successfully.",
        });
      } else {
        logger.warn(`Cannot cancel conflict alert ${id}. Maybe not found.`);
        res.send({
          message: `Cannot cancel Conflict Alert with id=${id}. Maybe Conflict Alert was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error cancelling conflict alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error cancelling Conflict Alert with id=${id}`,
      });
    });
};

// Delete a Conflict Alert with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  logger.debug(`Deleting conflict alert: ${id}`);

  ConflictAlert.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Conflict alert deleted successfully: ${id}`);
        res.send({
          message: "Conflict Alert was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete conflict alert ${id}. Maybe not found.`);
        res.send({
          message: `Cannot delete Conflict Alert with id=${id}. Maybe Conflict Alert was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting conflict alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Could not delete Conflict Alert with id=${id}`,
      });
    });
};

// Delete all Conflict Alerts from the database
exports.deleteAll = (req, res) => {
  logger.warn('Deleting all conflict alerts');

  ConflictAlert.destroy({
    where: {},
    truncate: false,
  })
    .then((nums) => {
      logger.info(`Deleted ${nums} conflict alerts`);
      res.send({ message: `${nums} Conflict Alerts were deleted successfully!` });
    })
    .catch((err) => {
      logger.error(`Error deleting all conflict alerts: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while removing all conflict alerts.",
      });
    });
};

export default exports;
