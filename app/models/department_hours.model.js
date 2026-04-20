import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const DepartmentHours = SequelizeInstance.define(
  "DepartmentHours",
  {
    hours_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "hours_id"
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "department_id"
    },
    day_of_week: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "day_of_week"
    },
    open_time: {
      type: DataTypes.TIME,
      allowNull: true,
      field: "open_time"
    },
    close_time: {
      type: DataTypes.TIME,
      allowNull: true,
      field: "close_time"
    },
    specific_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "specific_date"
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      field: "is_default"
    },
    is_closed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_closed"
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
    tableName: "department_hours",
    timestamps: false,
    underscored: true
  }
);

export default DepartmentHours;
