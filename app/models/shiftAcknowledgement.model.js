import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ShiftAcknowledgement = SequelizeInstance.define("shiftAcknowledgement", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  shiftId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    comment: 'FK to shifts table'
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    comment: 'FK to users table - the employee who needs to acknowledge'
  },
  acknowledged: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether the shift has been acknowledged by the employee'
  },
  acknowledgedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'Timestamp when the shift was acknowledged'
  },
  importedToCalendar: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether the shift has been imported to external calendar'
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
  tableName: 'shift_acknowledgements',
  timestamps: true
});

export default ShiftAcknowledgement;
