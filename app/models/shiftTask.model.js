import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ShiftTask = SequelizeInstance.define("shiftTask", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  shiftId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    comment: 'FK to shifts table - the shift this task belongs to'
  },
  taskName: {
    type: Sequelize.STRING(255),
    allowNull: false,
    comment: 'Name/title of the task'
  },
  taskDescription: {
    type: Sequelize.TEXT,
    allowNull: true,
    comment: 'Detailed description of the task'
  },
  taskType: {
    type: Sequelize.ENUM(
      'opening',
      'closing',
      'maintenance',
      'customer_service',
      'inventory',
      'cleaning',
      'training',
      'administrative',
      'other'
    ),
    allowNull: false,
    defaultValue: 'other',
    comment: 'Type/category of the task'
  },
  assignedTo: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'FK to users table - user assigned to complete this task'
  },
  priority: {
    type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'medium',
    comment: 'Priority level of the task'
  },
  status: {
    type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'cancelled', 'skipped'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Current status of the task'
  },
  dueTime: {
    type: Sequelize.TIME,
    allowNull: true,
    comment: 'Time when the task should be completed during the shift'
  },
  estimatedDuration: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'Estimated duration in minutes to complete the task'
  },
  actualDuration: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'Actual duration in minutes to complete the task'
  },
  startedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'Timestamp when the task was started'
  },
  completedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'Timestamp when the task was completed'
  },
  completedBy: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'FK to users table - user who completed the task'
  },
  completionNotes: {
    type: Sequelize.TEXT,
    allowNull: true,
    comment: 'Notes about task completion or issues encountered'
  },
  isRecurring: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether this task recurs for every shift'
  },
  isRequired: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether this task is mandatory'
  },
  sortOrder: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'Order in which tasks should be displayed/completed'
  }
}, {
  tableName: 'shift_tasks',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default ShiftTask;
