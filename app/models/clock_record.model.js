import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ClockRecord = SequelizeInstance.define(
  "clock_record",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    shiftId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    clockIn: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    clockOut: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    status: {
      type: Sequelize.ENUM("clocked_in", "clocked_out", "missed", "adjusted"),
      allowNull: false,
      defaultValue: "clocked_in",
    },
    notes: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "clock_records",
  },
);

export default ClockRecord;
