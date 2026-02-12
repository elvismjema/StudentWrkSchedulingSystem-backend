import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const TimeDiscrepancy = SequelizeInstance.define(
  "TimeDiscrepancy",
  {
    discrepancy_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "discrepancy_id"
    },
    clock_record_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "clock_record_id"
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id"
    },
    shift_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "shift_id"
    },
    discrepancy_type: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "discrepancy_type"
    },
    minutes_variance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "minutes_variance"
    },
    manager_notified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "manager_notified"
    },
    is_resolved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_resolved"
    },
    resolved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "resolved_by"
    },
    resolution_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "resolution_notes"
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at"
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "resolved_at"
    }
  },
  {
    tableName: "time_discrepancies",
    timestamps: false
  }
);

export default TimeDiscrepancy;
