import db from "../models/index.js";
import logger from "../config/logger.js";

const ShiftTag = db.shiftTag;
const exports = {};

// Create and Save a new Shift_Tag
exports.create = (req, res) => {
  if (!req.body.shiftId || !req.body.tagId) {
    logger.warn("Shift_Tag creation attempt with missing shiftId or tagId");
    res.status(400).send({
      message: "shiftId and tagId are required!",
    });
    return;
  }

  const shiftTag = {
    shiftId: req.body.shiftId,
    tagId: req.body.tagId,
  };

  logger.debug(
    `Creating shift_tag for shiftId=${shiftTag.shiftId}, tagId=${shiftTag.tagId}`,
  );

  ShiftTag.create(shiftTag)
    .then((data) => {
      logger.info(`Shift_Tag created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating shift_tag: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Shift_Tag.",
      });
    });
};

// Retrieve all Shift_Tags
exports.findAll = (req, res) => {
  const { shiftId, tagId } = req.query;
  const condition = {};

  if (shiftId) {
    condition.shiftId = shiftId;
  }
  if (tagId) {
    condition.tagId = tagId;
  }

  logger.debug(
    `Fetching all shift_tags with condition: ${JSON.stringify(condition)}`,
  );

  ShiftTag.findAll({ where: condition })
    .then((data) => {
      logger.info(`Retrieved ${data.length} shift_tags`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving shift_tags: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving shift_tags.",
      });
    });
};

// Find a single Shift_Tag by id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding shift_tag with id: ${id}`);

  ShiftTag.findByPk(id)
    .then((data) => {
      if (data) {
        logger.info(`Shift_Tag found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Shift_Tag not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Shift_Tag with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving shift_tag ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error retrieving Shift_Tag with id=${id}.`,
      });
    });
};

// Update a Shift_Tag by id
exports.update = (req, res) => {
  const id = req.params.id;
  logger.debug(`Updating shift_tag ${id} with data: ${JSON.stringify(req.body)}`);

  ShiftTag.update(req.body, {
    where: { id: id },
  })
    .then(([num]) => {
      if (num === 1) {
        logger.info(`Shift_Tag ${id} updated successfully`);
        res.send({
          message: "Shift_Tag was updated successfully.",
        });
      } else {
        logger.warn(`Failed to update shift_tag ${id} - not found or empty body`);
        res.send({
          message: `Cannot update Shift_Tag with id=${id}. Maybe Shift_Tag was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating shift_tag ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error updating Shift_Tag with id=${id}.`,
      });
    });
};

// Delete a Shift_Tag by id
exports.delete = (req, res) => {
  const id = req.params.id;
  logger.debug(`Attempting to delete shift_tag: ${id}`);

  ShiftTag.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num === 1) {
        logger.info(`Shift_Tag ${id} deleted successfully`);
        res.send({
          message: "Shift_Tag was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete shift_tag ${id} - not found`);
        res.send({
          message: `Cannot delete Shift_Tag with id=${id}. Maybe Shift_Tag was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting shift_tag ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Could not delete Shift_Tag with id=${id}.`,
      });
    });
};

export default exports;
