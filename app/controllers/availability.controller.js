import db from "../models/index.js";
import logger from "../config/logger.js";

const Availability = db.availability;
const User = db.user;
const Op = db.Sequelize.Op;

const exports = {};

// Create and Save a new Availability
exports.create = (req, res) => {
  // Validate request
  if (!req.body.startTime || !req.body.endTime) {
    logger.warn('Availability creation attempt with missing time fields');
    res.status(400).send({
      message: "Start time and end time are required!",
    });
    return;
  }

  // Create an Availability
  const availability = {
    userId: req.body.userId,
    departmentId: req.body.departmentId || null,
    dayOfWeek: req.body.dayOfWeek || null,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    availabilityType: req.body.availabilityType || 'available',
    specificDate: req.body.specificDate || null,
    isRecurring: req.body.isRecurring || false,
    recurrencePattern: req.body.recurrencePattern || null,
    recurrenceStartDate: req.body.recurrenceStartDate || null,
    recurrenceEndDate: req.body.recurrenceEndDate || null,
    requestStatus: req.body.requestStatus || 'pending',
    approvedBy: req.body.approvedBy || null,
    approvedAt: req.body.approvedAt || null,
    requestNotes: req.body.requestNotes || null,
  };

  logger.debug(`Creating availability for user: ${availability.userId}`);

  // Save Availability in the database
  Availability.create(availability)
    .then((data) => {
      logger.info(`Availability created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating availability: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Availability.",
      });
    });
};

// Retrieve all Availabilities from the database
exports.findAll = (req, res) => {
  const userId = req.query.userId;
  const departmentId = req.query.departmentId;
  const requestStatus = req.query.requestStatus;
  const availabilityType = req.query.availabilityType;

  let condition = {};
  
  if (userId) {
    condition.userId = userId;
  }
  if (departmentId) {
    condition.departmentId = departmentId;
  }
  if (requestStatus) {
    condition.requestStatus = requestStatus;
  }
  if (availabilityType) {
    condition.availabilityType = availabilityType;
  }

  logger.debug(`Fetching availabilities with condition: ${JSON.stringify(condition)}`);

  Availability.findAll({ 
    where: condition,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      },
      {
        model: User,
        as: 'approver',
        attributes: ['id', 'fName', 'lName', 'email']
      }
    ]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} availabilities`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving availabilities: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving availabilities.",
      });
    });
};

// Retrieve all Availabilities for a specific user
exports.findAllForUser = (req, res) => {
  const userId = req.params.userId;

  logger.debug(`Fetching availabilities for user: ${userId}`);

  Availability.findAll({ 
    where: { userId: userId },
    include: [
      {
        model: User,
        as: 'approver',
        attributes: ['id', 'fName', 'lName', 'email']
      }
    ]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} availabilities for user ${userId}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving availabilities for user ${userId}: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving availabilities.",
      });
    });
};

// Find a single Availability with an id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding availability with id: ${id}`);

  Availability.findByPk(id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      },
      {
        model: User,
        as: 'approver',
        attributes: ['id', 'fName', 'lName', 'email']
      }
    ]
  })
    .then((data) => {
      if (data) {
        logger.info(`Availability found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Availability not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Availability with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving availability ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error retrieving Availability with id=${id}`,
      });
    });
};

// Update an Availability by the id
exports.update = (req, res) => {
  const id = req.params.id;

  logger.debug(`Updating availability with id: ${id}`);

  Availability.update(req.body, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Availability updated successfully: ${id}`);
        res.send({
          message: "Availability was updated successfully.",
        });
      } else {
        logger.warn(`Cannot update availability with id ${id}. Availability not found or req.body is empty`);
        res.send({
          message: `Cannot update Availability with id=${id}. Maybe Availability was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating availability ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error updating Availability with id=${id}`,
      });
    });
};

// Delete an Availability with the specified id
exports.delete = (req, res) => {
  const id = req.params.id;

  logger.debug(`Deleting availability with id: ${id}`);

  Availability.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Availability deleted successfully: ${id}`);
        res.send({
          message: "Availability was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete availability with id ${id}. Availability not found`);
        res.send({
          message: `Cannot delete Availability with id=${id}. Maybe Availability was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting availability ${id}: ${err.message}`);
      res.status(500).send({
        message: `Could not delete Availability with id=${id}`,
      });
    });
};

// Delete all Availabilities from the database
exports.deleteAll = (req, res) => {
  logger.warn('Attempting to delete all availabilities');

  Availability.destroy({
    where: {},
    truncate: false,
  })
    .then((nums) => {
      logger.info(`${nums} availabilities deleted successfully`);
      res.send({ message: `${nums} Availabilities were deleted successfully!` });
    })
    .catch((err) => {
      logger.error(`Error deleting all availabilities: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all availabilities.",
      });
    });
};

// Approve or Reject an Availability request
exports.updateStatus = (req, res) => {
  const id = req.params.id;
  const { requestStatus, approvedBy } = req.body;

  if (!requestStatus || !['approved', 'rejected', 'cancelled'].includes(requestStatus)) {
    logger.warn(`Invalid status update attempt for availability ${id}`);
    res.status(400).send({
      message: "Valid request status is required (approved, rejected, or cancelled).",
    });
    return;
  }

  logger.debug(`Updating availability ${id} status to: ${requestStatus}`);

  const updateData = {
    requestStatus: requestStatus,
  };

  if (requestStatus === 'approved' && approvedBy) {
    updateData.approvedBy = approvedBy;
    updateData.approvedAt = new Date();
  }

  Availability.update(updateData, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Availability ${id} status updated to ${requestStatus}`);
        res.send({
          message: "Availability status was updated successfully.",
        });
      } else {
        logger.warn(`Cannot update availability status with id ${id}`);
        res.send({
          message: `Cannot update Availability status with id=${id}. Maybe Availability was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating availability status ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error updating Availability status with id=${id}`,
      });
    });
};

export default exports;
