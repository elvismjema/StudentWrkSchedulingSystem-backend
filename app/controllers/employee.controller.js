import db from "../models/index.js";
import logger from "../config/logger.js";

const Employee = db.employee;
const Op = db.Sequelize.Op;

const exports = {};

// Create and save a new employee
exports.create = async (req, res) => {
  try {
    const { fName, lName, email } = req.body;

    if (!fName || !lName || !email) {
      return res.status(400).send({
        message: "Missing required fields: fName, lName, email"
      });
    }

    const employee = await Employee.create({
      fName,
      lName,
      email
    });

    logger.info(`Employee created successfully: ${employee.id} - ${employee.email}`);
    return res.send(employee);
  } catch (err) {
    logger.error(`Error creating employee: ${err.message}`);
    return res.status(500).send({
      message: err.message || "Some error occurred while creating the Employee."
    });
  }
};

// Retrieve all employees
exports.findAll = async (req, res) => {
  try {
    const id = req.query.id;
    const condition = id ? { id: { [Op.like]: `%${id}%` } } : null;

    const employees = await Employee.findAll({ where: condition });
    return res.send(employees);
  } catch (err) {
    logger.error(`Error retrieving employees: ${err.message}`);
    return res.status(500).send({
      message: err.message || "Some error occurred while retrieving employees."
    });
  }
};

// Find a single employee by id
exports.findOne = async (req, res) => {
  try {
    const id = req.params.id;
    const employee = await Employee.findByPk(id);

    if (!employee) {
      return res.status(404).send({
        message: `Cannot find Employee with id=${id}.`
      });
    }

    return res.send(employee);
  } catch (err) {
    logger.error(`Error retrieving employee: ${err.message}`);
    return res.status(500).send({
      message: "Error retrieving Employee with id=" + req.params.id
    });
  }
};

// Update an employee by id
exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const [num] = await Employee.update(req.body, {
      where: { id }
    });

    if (num === 1) {
      return res.send({
        message: "Employee was updated successfully."
      });
    }

    return res.send({
      message: `Cannot update Employee with id=${id}. Maybe Employee was not found or req.body is empty!`
    });
  } catch (err) {
    logger.error(`Error updating employee: ${err.message}`);
    return res.status(500).send({
      message: "Error updating Employee with id=" + req.params.id
    });
  }
};

// Delete an employee by id
exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
    const num = await Employee.destroy({
      where: { id }
    });

    if (num === 1) {
      return res.send({
        message: "Employee was deleted successfully!"
      });
    }

    return res.send({
      message: `Cannot delete Employee with id=${id}. Maybe Employee was not found!`
    });
  } catch (err) {
    logger.error(`Error deleting employee: ${err.message}`);
    return res.status(500).send({
      message: "Could not delete Employee with id=" + req.params.id
    });
  }
};

export default exports;
