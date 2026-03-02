import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Department = SequelizeInstance.define(
  "Department",
  {
    department_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "department_id"
    },
    department_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "department_name"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description"
    },
    open_during_breaks: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      field: "open_during_breaks"
    },
    break_hours_required: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: "break_hours_required"
    },
    buffer_time_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: "buffer_time_minutes"
    },
    min_staff_required: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
      field: "min_staff_required"
    },
    late_threshold_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5,
      field: "late_threshold_minutes"
    },
    early_threshold_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5,
      field: "early_threshold_minutes"
    },
    notify_on_time_discrepancy: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      field: "notify_on_time_discrepancy"
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at"
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at"
    }
  },
  {
    tableName: "departments",
    timestamps: false,
    underscored: true
  }
);

export default Department;
