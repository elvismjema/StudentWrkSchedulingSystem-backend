import db from "../models/index.js";
import logger from "../config/logger.js";

const ShiftTask = db.shiftTask;
const Shift = db.shift;
const User = db.user;
const Op = db.Sequelize.Op;

const exports = {};

// Create and Save a new Shift Task
exports.create = (req, res) => {
  // Validate request
  if (!req.body.shiftId || !req.body.taskName) {
    logger.warn('Shift Task creation attempt with missing required fields');
    res.status(400).send({
      message: "Shift ID and Task Name are required!",
    });
    return;
  }

  // Create a Shift Task
  const shiftTask = {
    shiftId: req.body.shiftId,
    taskName: req.body.taskName,
    taskDescription: req.body.taskDescription || null,
    taskType: req.body.taskType || 'other',
    assignedTo: req.body.assignedTo || null,
    priority: req.body.priority || 'medium',
    status: req.body.status || 'pending',
    dueTime: req.body.dueTime || null,
    estimatedDuration: req.body.estimatedDuration || null,
    isRecurring: req.body.isRecurring || false,
    isRequired: req.body.isRequired !== undefined ? req.body.isRequired : true,
    sortOrder: req.body.sortOrder || null,
  };

  logger.debug(`Creating shift task for shift: ${shiftTask.shiftId}, task: ${shiftTask.taskName}`);

  // Save Shift Task in the database
  ShiftTask.create(shiftTask)
    .then((data) => {
      logger.info(`Shift Task created successfully: ${data.id}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error creating shift task: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Shift Task.",
      });
    });
};

// Retrieve all Shift Tasks from the database
exports.findAll = (req, res) => {
  const shiftId = req.query.shiftId;
  const assignedTo = req.query.assignedTo;
  const status = req.query.status;
  const taskType = req.query.taskType;
  const priority = req.query.priority;
  const isRecurring = req.query.isRecurring;

  let condition = {};
  
  if (shiftId) {
    condition.shiftId = shiftId;
  }
  if (assignedTo) {
    condition.assignedTo = assignedTo;
  }
  if (status) {
    condition.status = status;
  }
  if (taskType) {
    condition.taskType = taskType;
  }
  if (priority) {
    condition.priority = priority;
  }
  if (isRecurring !== undefined) {
    condition.isRecurring = isRecurring === 'true';
  }

  logger.debug(`Fetching shift tasks with condition: ${JSON.stringify(condition)}`);

  ShiftTask.findAll({ 
    where: condition,
    include: [
      {
        model: Shift,
        as: 'shift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: User,
        as: 'assignedUser',
        attributes: ['id', 'fName', 'lName', 'email'],
        required: false
      },
      {
        model: User,
        as: 'completer',
        attributes: ['id', 'fName', 'lName'],
        required: false
      }
    ],
    order: [['sortOrder', 'ASC'], ['priority', 'DESC'], ['createdAt', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} shift tasks`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving shift tasks: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving shift tasks.",
      });
    });
};

// Retrieve all pending Shift Tasks
exports.findAllPending = (req, res) => {
  logger.debug('Fetching all pending shift tasks');

  ShiftTask.findAll({ 
    where: { status: 'pending' },
    include: [
      {
        model: Shift,
        as: 'shift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: User,
        as: 'assignedUser',
        attributes: ['id', 'fName', 'lName', 'email'],
        required: false
      }
    ],
    order: [['priority', 'DESC'], ['dueTime', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} pending shift tasks`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving pending shift tasks: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving pending shift tasks.",
      });
    });
};

// Retrieve all Shift Tasks for a specific shift
exports.findAllForShift = (req, res) => {
  const shiftId = req.params.shiftId;

  logger.debug(`Fetching shift tasks for shift: ${shiftId}`);

  ShiftTask.findAll({ 
    where: { shiftId: shiftId },
    include: [
      {
        model: User,
        as: 'assignedUser',
        attributes: ['id', 'fName', 'lName', 'email'],
        required: false
      },
      {
        model: User,
        as: 'completer',
        attributes: ['id', 'fName', 'lName'],
        required: false
      }
    ],
    order: [['sortOrder', 'ASC'], ['priority', 'DESC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} shift tasks for shift ${shiftId}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving shift tasks for shift ${shiftId}: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving shift tasks for shift.",
      });
    });
};

// Retrieve all Shift Tasks assigned to a specific user
exports.findAllForUser = (req, res) => {
  const userId = req.params.userId;

  logger.debug(`Fetching shift tasks for user: ${userId}`);

  ShiftTask.findAll({ 
    where: { assignedTo: userId },
    include: [
      {
        model: Shift,
        as: 'shift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: User,
        as: 'completer',
        attributes: ['id', 'fName', 'lName'],
        required: false
      }
    ],
    order: [['status', 'ASC'], ['priority', 'DESC'], ['dueTime', 'ASC']]
  })
    .then((data) => {
      logger.info(`Retrieved ${data.length} shift tasks for user ${userId}`);
      res.send(data);
    })
    .catch((err) => {
      logger.error(`Error retrieving shift tasks for user ${userId}: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving shift tasks for user.",
      });
    });
};

// Find a single Shift Task with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  logger.debug(`Fetching shift task: ${id}`);

  ShiftTask.findByPk(id, {
    include: [
      {
        model: Shift,
        as: 'shift',
        attributes: ['shift_id', 'shift_date', 'start_time', 'end_time', 'department_id']
      },
      {
        model: User,
        as: 'assignedUser',
        attributes: ['id', 'fName', 'lName', 'email'],
        required: false
      },
      {
        model: User,
        as: 'completer',
        attributes: ['id', 'fName', 'lName'],
        required: false
      }
    ]
  })
    .then((data) => {
      if (data) {
        logger.info(`Retrieved shift task: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Shift task not found: ${id}`);
        res.status(404).send({
          message: `Cannot find Shift Task with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving shift task ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error retrieving Shift Task with id=${id}`,
      });
    });
};

// Update a Shift Task by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;

  logger.debug(`Updating shift task: ${id}`);

  ShiftTask.update(req.body, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Shift task updated successfully: ${id}`);
        res.send({
          message: "Shift Task was updated successfully.",
        });
      } else {
        logger.warn(`Cannot update shift task ${id}. Maybe not found or req.body is empty.`);
        res.send({
          message: `Cannot update Shift Task with id=${id}. Maybe Shift Task was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating shift task ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error updating Shift Task with id=${id}`,
      });
    });
};

// Start a Shift Task
exports.start = (req, res) => {
  const id = req.params.id;

  logger.debug(`Starting shift task: ${id}`);

  ShiftTask.update(
    {
      status: 'in_progress',
      startedAt: new Date()
    },
    {
      where: { id: id },
    }
  )
    .then((num) => {
      if (num == 1) {
        logger.info(`Shift task started successfully: ${id}`);
        res.send({
          message: "Shift Task was started successfully.",
        });
      } else {
        logger.warn(`Cannot start shift task ${id}. Maybe not found.`);
        res.send({
          message: `Cannot start Shift Task with id=${id}. Maybe Shift Task was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error starting shift task ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error starting Shift Task with id=${id}`,
      });
    });
};

// Complete a Shift Task
exports.complete = (req, res) => {
  const id = req.params.id;
  const completedBy = req.body.completedBy;
  const completionNotes = req.body.completionNotes || null;
  const actualDuration = req.body.actualDuration || null;

  if (!completedBy) {
    logger.warn('Complete attempt without completedBy field');
    res.status(400).send({
      message: "completedBy is required!",
    });
    return;
  }

  logger.debug(`Completing shift task: ${id} by user: ${completedBy}`);

  ShiftTask.update(
    {
      status: 'completed',
      completedAt: new Date(),
      completedBy: completedBy,
      completionNotes: completionNotes,
      actualDuration: actualDuration
    },
    {
      where: { id: id },
    }
  )
    .then((num) => {
      if (num == 1) {
        logger.info(`Shift task completed successfully: ${id}`);
        res.send({
          message: "Shift Task was completed successfully.",
        });
      } else {
        logger.warn(`Cannot complete shift task ${id}. Maybe not found.`);
        res.send({
          message: `Cannot complete Shift Task with id=${id}. Maybe Shift Task was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error completing shift task ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error completing Shift Task with id=${id}`,
      });
    });
};

// Cancel a Shift Task
exports.cancel = (req, res) => {
  const id = req.params.id;

  logger.debug(`Cancelling shift task: ${id}`);

  ShiftTask.update(
    {
      status: 'cancelled'
    },
    {
      where: { id: id },
    }
  )
    .then((num) => {
      if (num == 1) {
        logger.info(`Shift task cancelled successfully: ${id}`);
        res.send({
          message: "Shift Task was cancelled successfully.",
        });
      } else {
        logger.warn(`Cannot cancel shift task ${id}. Maybe not found.`);
        res.send({
          message: `Cannot cancel Shift Task with id=${id}. Maybe Shift Task was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error cancelling shift task ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error cancelling Shift Task with id=${id}`,
      });
    });
};

// Delete a Shift Task with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  logger.debug(`Deleting shift task: ${id}`);

  ShiftTask.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Shift task deleted successfully: ${id}`);
        res.send({
          message: "Shift Task was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete shift task ${id}. Maybe not found.`);
        res.send({
          message: `Cannot delete Shift Task with id=${id}. Maybe Shift Task was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting shift task ${id}: ${err.message}`);
      res.status(500).send({
        message: `Could not delete Shift Task with id=${id}`,
      });
    });
};

// Delete all Shift Tasks from the database
exports.deleteAll = (req, res) => {
  logger.warn('Deleting all shift tasks');

  ShiftTask.destroy({
    where: {},
    truncate: false,
  })
    .then((nums) => {
      logger.info(`Deleted ${nums} shift tasks`);
      res.send({ message: `${nums} Shift Tasks were deleted successfully!` });
    })
    .catch((err) => {
      logger.error(`Error deleting all shift tasks: ${err.message}`);
      res.status(500).send({
        message: err.message || "Some error occurred while removing all shift tasks.",
      });
    });
};

export default exports;
