import db from "../models/index.js";
import logger from "../config/logger.js";

const ScheduleGapAlert = db.scheduleGapAlert;
const Op = db.Sequelize.Op;

const exports = {};

// Create and Save a new Schedule Gap Alert
exports.create = (req, res) => {
  // Validate request
  if (!req.body.gapDate || !req.body.dayOfWeek || !req.body.gapStartTime || !req.body.gapEndTime) {
    logger.warn('Schedule Gap Alert creation attempt with missing required fields');
    res.status(400).send({
      message: "Gap date, day of week, start time and end time are required!",
    });
    return;
  }

  // Create a Schedule Gap Alert
  const scheduleGapAlert = {
    departmentId: req.body.departmentId || null,
    gapDate: req.body.gapDate,
    dayOfWeek: req.body.dayOfWeek,
    gapStartTime: req.body.gapStartTime,
    gapEndTime: req.body.gapEndTime,
    positionId: req.body.positionId || null,
    requiredStaffCount: req.body.requiredStaffCount || 1,
    scheduledStaffCount: req.body.scheduledStaffCount || 0,
    alertStatus: req.body.alertStatus || 'open',
    resolvedAt: req.body.resolvedAt || null,
  };

  logger.debug(`Creating schedule gap alert for date: ${scheduleGapAlert.gapDate}`);

  // Save Schedule Gap Alert in the database
  ScheduleGapAlert.create(scheduleGapAlert)
    .then((data) => {
      logger.info(`Schedule Gap Alert created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating schedule gap alert: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Schedule Gap Alert.",
      });
    });
};

// Retrieve all Schedule Gap Alerts from the database
exports.findAll = (req, res) => {
  const departmentId = req.query.departmentId;
  const positionId = req.query.positionId;
  const alertStatus = req.query.alertStatus;
  const gapDate = req.query.gapDate;

  let condition = {};
  
  if (departmentId) {
    condition.departmentId = departmentId;
  }
  if (positionId) {
    condition.positionId = positionId;
  }
  if (alertStatus) {
    condition.alertStatus = alertStatus;
  }
  if (gapDate) {
    condition.gapDate = gapDate;
  }

  logger.debug(`Fetching schedule gap alerts with condition: ${JSON.stringify(condition)}`);

  ScheduleGapAlert.findAll({ 
    where: condition,
    order: [['gapDate', 'ASC'], ['gapStartTime', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} schedule gap alerts`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving schedule gap alerts: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving schedule gap alerts.",
      });
    });
};

// Retrieve all open Schedule Gap Alerts
exports.findAllOpen = (req, res) => {
  logger.debug('Fetching all open schedule gap alerts');

  ScheduleGapAlert.findAll({ 
    where: { alertStatus: 'open' },
    order: [['gapDate', 'ASC'], ['gapStartTime', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} open schedule gap alerts`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving open schedule gap alerts: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving open schedule gap alerts.",
      });
    });
};

// Retrieve all Schedule Gap Alerts for a specific department
exports.findAllForDepartment = (req, res) => {
  const departmentId = req.params.departmentId;

  logger.debug(`Fetching schedule gap alerts for department: ${departmentId}`);

  ScheduleGapAlert.findAll({ 
    where: { departmentId: departmentId },
    order: [['gapDate', 'ASC'], ['gapStartTime', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} schedule gap alerts for department ${departmentId}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving schedule gap alerts for department ${departmentId}: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving schedule gap alerts.",
      });
    });
};

// Retrieve Schedule Gap Alerts for a date range
exports.findByDateRange = (req, res) => {
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  if (!startDate || !endDate) {
    logger.warn('Date range query missing start or end date');
    res.status(400).send({
      message: "Start date and end date are required!",
    });
    return;
  }

  logger.debug(`Fetching schedule gap alerts for date range: ${startDate} to ${endDate}`);

  ScheduleGapAlert.findAll({ 
    where: { 
      gapDate: {
        [Op.between]: [startDate, endDate]
      }
    },
    order: [['gapDate', 'ASC'], ['gapStartTime', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} schedule gap alerts for date range`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving schedule gap alerts for date range: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving schedule gap alerts.",
      });
    });
};

// Find a single Schedule Gap Alert with an id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding schedule gap alert with id: ${id}`);

  ScheduleGapAlert.findByPk(id)
    .then((data) => {
      if (data) {
        logger.info(`Schedule Gap Alert found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Schedule Gap Alert not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Schedule Gap Alert with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving schedule gap alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error retrieving Schedule Gap Alert with id=${id}`,
      });
    });
};

// Update a Schedule Gap Alert by the id
exports.update = (req, res) => {
  const id = req.params.id;

  logger.debug(`Updating schedule gap alert with id: ${id}`);

  ScheduleGapAlert.update(req.body, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Schedule Gap Alert updated successfully: ${id}`);
        res.send({
          message: "Schedule Gap Alert was updated successfully.",
        });
      } else {
        logger.warn(`Cannot update schedule gap alert with id ${id}. Alert not found or req.body is empty`);
        res.send({
          message: `Cannot update Schedule Gap Alert with id=${id}. Maybe Schedule Gap Alert was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating schedule gap alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error updating Schedule Gap Alert with id=${id}`,
      });
    });
};

// Update Schedule Gap Alert status
exports.updateStatus = (req, res) => {
  const id = req.params.id;
  const { alertStatus } = req.body;

  if (!alertStatus || !['open', 'acknowledged', 'resolved', 'cancelled'].includes(alertStatus)) {
    logger.warn(`Invalid status update attempt for schedule gap alert ${id}`);
    res.status(400).send({
      message: "Valid alert status is required (open, acknowledged, resolved, or cancelled).",
    });
    return;
  }

  logger.debug(`Updating schedule gap alert ${id} status to: ${alertStatus}`);

  const updateData = {
    alertStatus: alertStatus,
  };

  if (alertStatus === 'resolved') {
    updateData.resolvedAt = new Date();
  }

  ScheduleGapAlert.update(updateData, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Schedule Gap Alert ${id} status updated to ${alertStatus}`);
        res.send({
          message: "Schedule Gap Alert status was updated successfully.",
        });
      } else {
        logger.warn(`Cannot update schedule gap alert status with id ${id}`);
        res.send({
          message: `Cannot update Schedule Gap Alert status with id=${id}. Maybe Schedule Gap Alert was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating schedule gap alert status ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error updating Schedule Gap Alert status with id=${id}`,
      });
    });
};

// Delete a Schedule Gap Alert with the specified id
exports.delete = (req, res) => {
  const id = req.params.id;

  logger.debug(`Deleting schedule gap alert with id: ${id}`);

  ScheduleGapAlert.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Schedule Gap Alert deleted successfully: ${id}`);
        res.send({
          message: "Schedule Gap Alert was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete schedule gap alert with id ${id}. Alert not found`);
        res.send({
          message: `Cannot delete Schedule Gap Alert with id=${id}. Maybe Schedule Gap Alert was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting schedule gap alert ${id}: ${err.message}`);
      res.status(500).send({
        message: `Could not delete Schedule Gap Alert with id=${id}`,
      });
    });
};

// Delete all Schedule Gap Alerts from the database
exports.deleteAll = (req, res) => {
  logger.warn('Attempting to delete all schedule gap alerts');

  ScheduleGapAlert.destroy({
    where: {},
    truncate: false,
  })
    .then((nums) => {
      logger.info(`${nums} schedule gap alerts deleted successfully`);
      res.send({ message: `${nums} Schedule Gap Alerts were deleted successfully!` });
    })
    .catch((err) => {
      logger.error(`Error deleting all schedule gap alerts: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all schedule gap alerts.",
      });
    });
};

export default exports;
