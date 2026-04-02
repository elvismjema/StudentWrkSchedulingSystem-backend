import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Availability = SequelizeInstance.define("availability", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  departmentId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'FK to departments table - will be linked when department model is created'
  },
  dayOfWeek: {
    type: Sequelize.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 6  // 0=Sunday, 6=Saturday
    },
    comment: '0=Sunday, 1=Monday, ..., 6=Saturday'
  },
  startTime: {
    type: Sequelize.TIME,
    allowNull: false
  },
  endTime: {
    type: Sequelize.TIME,
    allowNull: false
  },
  availabilityType: {
    type: Sequelize.ENUM('available', 'unavailable', 'preferred', 'time_off'),
    allowNull: false,
    defaultValue: 'available'
  },
  specificDate: {
    type: Sequelize.DATEONLY,
    allowNull: true,
    comment: 'For one-time availability changes'
  },
  isRecurring: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  recurrencePattern: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'e.g., weekly, biweekly, monthly'
  },
  recurrenceStartDate: {
    type: Sequelize.DATEONLY,
    allowNull: true
  },
  recurrenceEndDate: {
    type: Sequelize.DATEONLY,
    allowNull: true
  },
  requestStatus: {
    type: Sequelize.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  approvedBy: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  approvedAt: {
    type: Sequelize.DATE,
    allowNull: true
  },
  requestNotes: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  }
}, {
  tableName: 'availabilities'
});

export default Availability;
