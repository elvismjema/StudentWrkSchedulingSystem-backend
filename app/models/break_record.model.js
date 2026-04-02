import { DataTypes } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";

/**
 * BreakRecord model — tracks break start/end within a clock-in session.
 *
 * Associated with a ClockRecord. A clock session may have multiple breaks.
 */
const BreakRecord = sequelize.define(
  "BreakRecord",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    clock_record_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    break_start: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    break_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    break_type: {
      type: DataTypes.ENUM("meal", "rest", "other"),
      allowNull: false,
      defaultValue: "rest",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "break_records",
    timestamps: false,
  }
);

export default BreakRecord;
