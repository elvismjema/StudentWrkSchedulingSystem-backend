import db from "../models/index.js";
import logger from "../config/logger.js";

const Tag = db.tag;
const Op = db.Sequelize.Op;
const exports = {};

// Create and Save a new Tag
exports.create = (req, res) => {
  if (!req.body.name) {
    logger.warn("Tag creation attempt with empty name");
    res.status(400).send({
      message: "Tag name can not be empty!",
    });
    return;
  }

  const tag = {
    name: req.body.name,
    description: req.body.description,
  };

  logger.debug(`Creating tag: ${tag.name}`);

  Tag.create(tag)
    .then((data) => {
      logger.info(`Tag created successfully: ${data.id} - ${data.name}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating tag: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while creating the Tag.",
      });
    });
};

// Retrieve all Tags from the database
exports.findAll = (req, res) => {
  const name = req.query.name;
  const condition = name ? { name: { [Op.like]: `%${name}%` } } : null;

  logger.debug(`Fetching all tags with condition: ${JSON.stringify(condition)}`);

  Tag.findAll({ where: condition })
    .then((data) => {
      logger.info(`Retrieved ${data.length} tags`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving tags: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving tags.",
      });
    });
};

// Find a single Tag with an id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding tag with id: ${id}`);

  Tag.findByPk(id)
    .then((data) => {
      if (data) {
        logger.info(`Tag found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Tag not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Tag with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving tag ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error retrieving Tag with id=${id}.`,
      });
    });
};

// Update a Tag by id
exports.update = (req, res) => {
  const id = req.params.id;
  logger.debug(`Updating tag ${id} with data: ${JSON.stringify(req.body)}`);

  Tag.update(req.body, {
    where: { id: id },
  })
    .then(([num]) => {
      if (num === 1) {
        logger.info(`Tag ${id} updated successfully`);
        res.send({
          message: "Tag was updated successfully.",
        });
      } else {
        logger.warn(`Failed to update tag ${id} - not found or empty body`);
        res.send({
          message: `Cannot update Tag with id=${id}. Maybe Tag was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating tag ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error updating Tag with id=${id}.`,
      });
    });
};

// Delete a Tag by id
exports.delete = (req, res) => {
  const id = req.params.id;
  logger.debug(`Attempting to delete tag: ${id}`);

  Tag.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num === 1) {
        logger.info(`Tag ${id} deleted successfully`);
        res.send({
          message: "Tag was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete tag ${id} - not found`);
        res.send({
          message: `Cannot delete Tag with id=${id}. Maybe Tag was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting tag ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Could not delete Tag with id=${id}.`,
      });
    });
};

export default exports;
