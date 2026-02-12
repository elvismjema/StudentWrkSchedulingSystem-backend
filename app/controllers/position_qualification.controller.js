import db from "../models/index.js";
import logger from "../config/logger.js";

const PositionQualification = db.positionQualification;
const exports = {};

// Create and Save a new Position_Qualification
exports.create = (req, res) => {
  if (!req.body.positionId || !req.body.qualificationId) {
    logger.warn(
      "Position_Qualification creation attempt with missing positionId or qualificationId",
    );
    res.status(400).send({
      message: "positionId and qualificationId are required!",
    });
    return;
  }

  const positionQualification = {
    positionId: req.body.positionId,
    qualificationId: req.body.qualificationId,
    isRequired: req.body.isRequired !== undefined ? req.body.isRequired : true,
  };

  logger.debug(
    `Creating position_qualification for positionId=${positionQualification.positionId}, qualificationId=${positionQualification.qualificationId}`,
  );

  PositionQualification.create(positionQualification)
    .then((data) => {
      logger.info(`Position_Qualification created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating position_qualification: ${err.message}`);
      res.status(500).send({
        message:
          err.message ||
          "Some error occurred while creating the Position_Qualification.",
      });
    });
};

// Retrieve all Position_Qualifications
exports.findAll = (req, res) => {
  const { positionId, qualificationId } = req.query;
  const condition = {};

  if (positionId) {
    condition.positionId = positionId;
  }
  if (qualificationId) {
    condition.qualificationId = qualificationId;
  }

  logger.debug(
    `Fetching all position_qualifications with condition: ${JSON.stringify(condition)}`,
  );

  PositionQualification.findAll({ where: condition })
    .then((data) => {
      logger.info(`Retrieved ${data.length} position_qualifications`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving position_qualifications: ${err.message}`);
      res.status(500).send({
        message:
          err.message ||
          "Some error occurred while retrieving position_qualifications.",
      });
    });
};

// Find a single Position_Qualification by id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding position_qualification with id: ${id}`);

  PositionQualification.findByPk(id)
    .then((data) => {
      if (data) {
        logger.info(`Position_Qualification found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Position_Qualification not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Position_Qualification with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving position_qualification ${id}: ${err.message}`);
      res.status(500).send({
        message:
          err.message || `Error retrieving Position_Qualification with id=${id}.`,
      });
    });
};

// Update a Position_Qualification by id
exports.update = (req, res) => {
  const id = req.params.id;
  logger.debug(
    `Updating position_qualification ${id} with data: ${JSON.stringify(req.body)}`,
  );

  PositionQualification.update(req.body, {
    where: { id: id },
  })
    .then(([num]) => {
      if (num === 1) {
        logger.info(`Position_Qualification ${id} updated successfully`);
        res.send({
          message: "Position_Qualification was updated successfully.",
        });
      } else {
        logger.warn(
          `Failed to update position_qualification ${id} - not found or empty body`,
        );
        res.send({
          message: `Cannot update Position_Qualification with id=${id}. Maybe Position_Qualification was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating position_qualification ${id}: ${err.message}`);
      res.status(500).send({
        message:
          err.message || `Error updating Position_Qualification with id=${id}.`,
      });
    });
};

// Delete a Position_Qualification by id
exports.delete = (req, res) => {
  const id = req.params.id;
  logger.debug(`Attempting to delete position_qualification: ${id}`);

  PositionQualification.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num === 1) {
        logger.info(`Position_Qualification ${id} deleted successfully`);
        res.send({
          message: "Position_Qualification was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete position_qualification ${id} - not found`);
        res.send({
          message: `Cannot delete Position_Qualification with id=${id}. Maybe Position_Qualification was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting position_qualification ${id}: ${err.message}`);
      res.status(500).send({
        message:
          err.message ||
          `Could not delete Position_Qualification with id=${id}.`,
      });
    });
};

export default exports;
