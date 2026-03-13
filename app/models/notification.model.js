import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Notification = SequelizeInstance.define("notification", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  message: {
    type: Sequelize.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: 'users',  // This should match the actual table name
      key: 'id'
    }
  },
  isRead: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  // Notification category — used to drive routing and icons on the frontend
  type: {
    type: Sequelize.ENUM(
      "shift_assignment",
      "shift_change",
      "shift_cancellation",
      "shift_reassignment",
      "shift_reminder",
      "coverage_gap"
    ),
    allowNull: true,
    defaultValue: null
  },
  // Deep-link path (e.g. /shifts/42) — frontend uses this for direct navigation
  link: {
    type: Sequelize.STRING(500),
    allowNull: true,
    defaultValue: null
  },
  // "high" priority is reserved for critical-position coverage gap alerts
  priority: {
    type: Sequelize.ENUM("normal", "high"),
    allowNull: false,
    defaultValue: "normal"
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
  tableName: 'notifications'
});

export default Notification;
