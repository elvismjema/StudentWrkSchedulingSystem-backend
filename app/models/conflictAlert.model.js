import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ConflictAlert = SequelizeInstance.define("conflictAlert", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    comment: 'FK to users table - the user involved in the conflict'
  },
  primaryShiftId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    comment: 'FK to shifts table - the primary shift involved in the conflict'
  },
  conflictingShiftId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'FK to shifts table - the conflicting shift (null if conflict is not shift-to-shift)'
  },
  conflictType: {
    type: Sequelize.ENUM(
      'shift_overlap',
      'availability_conflict', 
      'time_constraint',
      'double_booking',
      'rest_period_violation',
      'other'
    ),
    allowNull: false,
    defaultValue: 'shift_overlap',
    comment: 'Type of scheduling conflict detected'
  },
  conflictDate: {
    type: Sequelize.DATEONLY,
    allowNull: false,
    comment: 'The date when the conflict occurs'
  },
  conflictStartTime: {
    type: Sequelize.TIME,
    allowNull: false,
    comment: 'Start time of the conflict period'
  },
  conflictEndTime: {
    type: Sequelize.TIME,
    allowNull: false,
    comment: 'End time of the conflict period'
  },
  conflictDetails: {
    type: Sequelize.TEXT,
    allowNull: true,
    comment: 'Detailed description of the conflict'
  },
  severity: {
    type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'medium',
    comment: 'Severity level of the conflict'
  },
  alertStatus: {
    type: Sequelize.ENUM('open', 'acknowledged', 'resolved', 'cancelled'),
    allowNull: false,
    defaultValue: 'open',
    comment: 'Current status of the conflict alert'
  },
  acknowledgedBy: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'FK to users table - user who acknowledged the alert'
  },
  acknowledgedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'Timestamp when the alert was acknowledged'
  },
  resolvedBy: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'FK to users table - user who resolved the conflict'
  },
  resolvedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'Timestamp when the conflict was resolved'
  },
  resolutionNotes: {
    type: Sequelize.TEXT,
    allowNull: true,
    comment: 'Notes about how the conflict was resolved'
  },
  autoDetected: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether the conflict was automatically detected by the system'
  },
  notificationSent: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether a notification has been sent to relevant parties'
  }
}, {
  tableName: 'conflict_alerts',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default ConflictAlert;
