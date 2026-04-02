import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ScheduleGapAlert = SequelizeInstance.define("scheduleGapAlert", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  departmentId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'FK to departments table - will be linked when department model is created'
  },
  gapDate: {
    type: Sequelize.DATEONLY,
    allowNull: false,
    comment: 'The date when the staffing gap occurs'
  },
  dayOfWeek: {
    type: Sequelize.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 6  // 0=Sunday, 6=Saturday
    },
    comment: '0=Sunday, 1=Monday, ..., 6=Saturday'
  },
  gapStartTime: {
    type: Sequelize.TIME,
    allowNull: false,
    comment: 'Start time of the staffing gap'
  },
  gapEndTime: {
    type: Sequelize.TIME,
    allowNull: false,
    comment: 'End time of the staffing gap'
  },
  positionId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'FK to positions table - will be linked when position model is created'
  },
  requiredStaffCount: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 0
    },
    comment: 'Number of staff required during this time'
  },
  scheduledStaffCount: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    },
    comment: 'Number of staff currently scheduled'
  },
  alertStatus: {
    type: Sequelize.ENUM('open', 'acknowledged', 'resolved', 'cancelled'),
    allowNull: false,
    defaultValue: 'open',
    comment: 'Status of the gap alert'
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  resolvedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'Timestamp when the gap was resolved'
  }
}, {
  tableName: 'schedule_gap_alerts',
  timestamps: true,
  updatedAt: false  // This table only tracks creation and resolution, no updates
});

export default ScheduleGapAlert;
