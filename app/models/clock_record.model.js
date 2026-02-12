import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ClockRecord = SequelizeInstance.define(
  "ClockRecord",
  {
    clock_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "clock_id"
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id"
    },
    clock_in: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "clock_in"
    },
    clock_out: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "clock_out"
    },
    shift_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "shift_id"
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
    tableName: "clock_records",
    timestamps: false,
    underscored: true
  }
);

export default ClockRecord;
