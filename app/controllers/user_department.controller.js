import db from "../models/index.js";
import logger from "../config/logger.js";

const UserDepartment = db.userDepartment;
const exports = {};

// Create and Save a new User_Department
exports.create = (req, res) => {
  if (!req.body.userId || !req.body.departmentId) {
    logger.warn("User_Department creation attempt with missing userId or departmentId");
    res.status(400).send({
      message: "userId and departmentId are required!",
    });
    return;
  }

  const userDepartment = {
    userId: req.body.userId,
    departmentId: req.body.departmentId,
    isPrimary: req.body.isPrimary ? req.body.isPrimary : false,
  };

  logger.debug(
    `Creating user_department for userId=${userDepartment.userId}, departmentId=${userDepartment.departmentId}`,
  );

  UserDepartment.create(userDepartment)
    .then((data) => {
      logger.info(`User_Department created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating user_department: ${err.message}`);
      res.status(500).send({
        message:
          err.message ||
          "Some error occurred while creating the User_Department.",
      });
    });
};

// Retrieve all User_Departments
exports.findAll = (req, res) => {
  const { userId, departmentId } = req.query;
  const condition = {};

  if (userId) {
    condition.userId = userId;
  }
  if (departmentId) {
    condition.departmentId = departmentId;
  }

  logger.debug(
    `Fetching all user_departments with condition: ${JSON.stringify(condition)}`,
  );

  UserDepartment.findAll({ where: condition })
    .then((data) => {
      logger.info(`Retrieved ${data.length} user_departments`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving user_departments: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving user_departments.",
      });
    });
};

// Find a single User_Department by id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding user_department with id: ${id}`);

  UserDepartment.findByPk(id)
    .then((data) => {
      if (data) {
        logger.info(`User_Department found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`User_Department not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find User_Department with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving user_department ${id}: ${err.message}`);
      res.status(500).send({
        message:
          err.message || `Error retrieving User_Department with id=${id}.`,
      });
    });
};

// Update a User_Department by id
exports.update = (req, res) => {
  const id = req.params.id;
  logger.debug(
    `Updating user_department ${id} with data: ${JSON.stringify(req.body)}`,
  );

  UserDepartment.update(req.body, {
    where: { id: id },
  })
    .then(([num]) => {
      if (num === 1) {
        logger.info(`User_Department ${id} updated successfully`);
        res.send({
          message: "User_Department was updated successfully.",
        });
      } else {
        logger.warn(
          `Failed to update user_department ${id} - not found or empty body`,
        );
        res.send({
          message: `Cannot update User_Department with id=${id}. Maybe User_Department was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating user_department ${id}: ${err.message}`);
      res.status(500).send({
        message: err.message || `Error updating User_Department with id=${id}.`,
      });
    });
};

// Delete a User_Department by id
exports.delete = (req, res) => {
  const id = req.params.id;
  logger.debug(`Attempting to delete user_department: ${id}`);

  UserDepartment.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num === 1) {
        logger.info(`User_Department ${id} deleted successfully`);
        res.send({
          message: "User_Department was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete user_department ${id} - not found`);
        res.send({
          message: `Cannot delete User_Department with id=${id}. Maybe User_Department was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting user_department ${id}: ${err.message}`);
      res.status(500).send({
        message:
          err.message || `Could not delete User_Department with id=${id}.`,
      });
    });
};

export default exports;
