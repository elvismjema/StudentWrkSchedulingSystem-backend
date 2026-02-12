import db from "../models/index.js";
import logger from "../config/logger.js";

const ClockRecord = db.clockRecord;
const Op = db.Sequelize.Op;
const exports = {};

// Create and Save a new Clock_Record
exports.create = (req, res) => {
  if (!req.body.userId || !req.body.clockIn) {
    logger.warn("Clock_Record creation attempt with missing userId or clockIn");
    res.status(400).send({
      message: "userId and clockIn are required!",
    });
    return;
  }

  const clockRecord = {
    userId: req.body.userId,
    shiftId: req.body.shiftId,
    clockIn: req.body.clockIn,
    clockOut: req.body.clockOut,
    status: req.body.status ? req.body.status : "clocked_in",
    notes: req.body.notes,
  };

  logger.debug(`Creating clock_record for userId=${clockRecord.userId}`);

  ClockRecord.create(clockRecord)
    .then((data) => {
      logger.info(`Clock_Record created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating clock_record: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Clock_Record.",
      });
    });
};

// Retrieve all Clock_Records
exports.findAll = (req, res) => {
  const { userId, shiftId, status, fromClockIn, toClockIn } = req.query;
  const condition = {};

  if (userId) {
    condition.userId = userId;
  }
  if (shiftId) {
    condition.shiftId = shiftId;
  }
  if (status) {
    condition.status = status;
  }
  if (fromClockIn || toClockIn) {
    condition.clockIn = {};
    if (fromClockIn) {
      condition.clockIn[Op.gte] = fromClockIn;
    }
    if (toClockIn) {
      condition.clockIn[Op.lte] = toClockIn;
    }
  }

  logger.debug(
    `Fetching all clock_records with condition: ${JSON.stringify(condition)}`,
  );

  ClockRecord.findAll({ where: condition })
    .then((data) => {
      logger.info(`Retrieved ${data.length} clock_records`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving clock_records: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving clock_records.",
      });
    });
};

// Find a single Clock_Record by id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding clock_record with id: ${id}`);

  ClockRecord.findByPk(id)
    .then((data) => {
      if (data) {
        logger.info(`Clock_Record found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Clock_Record not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Clock_Record with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving clock_record ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error retrieving Clock_Record with id=${id}.`,
      });
    });
};

// Update a Clock_Record by id
exports.update = (req, res) => {
  const id = req.params.id;
  logger.debug(`Updating clock_record ${id} with data: ${JSON.stringify(req.body)}`);

  ClockRecord.update(req.body, {
    where: { id: id },
  })
    .then(([num]) => {
      if (num === 1) {
        logger.info(`Clock_Record ${id} updated successfully`);
        res.send({
          message: "Clock_Record was updated successfully.",
        });
      } else {
        logger.warn(`Failed to update clock_record ${id} - not found or empty body`);
        res.send({
          message: `Cannot update Clock_Record with id=${id}. Maybe Clock_Record was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating clock_record ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error updating Clock_Record with id=${id}.`,
      });
    });
};

// Delete a Clock_Record by id
exports.delete = (req, res) => {
  const id = req.params.id;
  logger.debug(`Attempting to delete clock_record: ${id}`);

  ClockRecord.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num === 1) {
        logger.info(`Clock_Record ${id} deleted successfully`);
        res.send({
          message: "Clock_Record was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete clock_record ${id} - not found`);
        res.send({
          message: `Cannot delete Clock_Record with id=${id}. Maybe Clock_Record was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting clock_record ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Could not delete Clock_Record with id=${id}.`,
      });
    });
};

export default exports;
