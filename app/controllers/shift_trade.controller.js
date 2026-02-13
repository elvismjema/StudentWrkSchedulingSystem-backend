import db from "../models/index.js";
import logger from "../config/logger.js";

const ShiftTrade = db.shiftTrade;
const exports = {};

// Create and Save a new Shift_Trade
exports.create = (req, res) => {
  if (!req.body.requesterId || !req.body.offeredShiftId || !req.body.requestedShiftId) {
    logger.warn(
      "Shift_Trade creation attempt with missing requesterId, offeredShiftId, or requestedShiftId",
    );
    res.status(400).send({
      message: "requesterId, offeredShiftId, and requestedShiftId are required!",
    });
    return;
  }

  const shiftTrade = {
    requesterId: req.body.requesterId,
    recipientId: req.body.recipientId,
    offeredShiftId: req.body.offeredShiftId,
    requestedShiftId: req.body.requestedShiftId,
    status: req.body.status ? req.body.status : "pending",
    requestedAt: req.body.requestedAt,
    respondedAt: req.body.respondedAt,
    notes: req.body.notes,
  };

  logger.debug(
    `Creating shift_trade for requesterId=${shiftTrade.requesterId}, offeredShiftId=${shiftTrade.offeredShiftId}, requestedShiftId=${shiftTrade.requestedShiftId}`,
  );

  ShiftTrade.create(shiftTrade)
    .then((data) => {
      logger.info(`Shift_Trade created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating shift_trade: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Shift_Trade.",
      });
    });
};

// Retrieve all Shift_Trades
exports.findAll = (req, res) => {
  const { requesterId, recipientId, offeredShiftId, requestedShiftId, status } =
    req.query;
  const condition = {};

  if (requesterId) {
    condition.requesterId = requesterId;
  }
  if (recipientId) {
    condition.recipientId = recipientId;
  }
  if (offeredShiftId) {
    condition.offeredShiftId = offeredShiftId;
  }
  if (requestedShiftId) {
    condition.requestedShiftId = requestedShiftId;
  }
  if (status) {
    condition.status = status;
  }

  logger.debug(
    `Fetching all shift_trades with condition: ${JSON.stringify(condition)}`,
  );

  ShiftTrade.findAll({ where: condition })
    .then((data) => {
      logger.info(`Retrieved ${data.length} shift_trades`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving shift_trades: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving shift_trades.",
      });
    });
};

// Find a single Shift_Trade by id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding shift_trade with id: ${id}`);

  ShiftTrade.findByPk(id)
    .then((data) => {
      if (data) {
        logger.info(`Shift_Trade found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Shift_Trade not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Shift_Trade with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving shift_trade ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error retrieving Shift_Trade with id=${id}.`,
      });
    });
};

// Update a Shift_Trade by id
exports.update = (req, res) => {
  const id = req.params.id;
  logger.debug(
    `Updating shift_trade ${id} with data: ${JSON.stringify(req.body)}`,
  );

  ShiftTrade.update(req.body, {
    where: { id: id },
  })
    .then(([num]) => {
      if (num === 1) {
        logger.info(`Shift_Trade ${id} updated successfully`);
        res.send({
          message: "Shift_Trade was updated successfully.",
        });
      } else {
        logger.warn(`Failed to update shift_trade ${id} - not found or empty body`);
        res.send({
          message: `Cannot update Shift_Trade with id=${id}. Maybe Shift_Trade was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating shift_trade ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error updating Shift_Trade with id=${id}.`,
      });
    });
};

// Delete a Shift_Trade by id
exports.delete = (req, res) => {
  const id = req.params.id;
  logger.debug(`Attempting to delete shift_trade: ${id}`);

  ShiftTrade.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num === 1) {
        logger.info(`Shift_Trade ${id} deleted successfully`);
        res.send({
          message: "Shift_Trade was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete shift_trade ${id} - not found`);
        res.send({
          message: `Cannot delete Shift_Trade with id=${id}. Maybe Shift_Trade was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting shift_trade ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Could not delete Shift_Trade with id=${id}.`,
      });
    });
};

export default exports;
