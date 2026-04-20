import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ShiftTaskCompletion = SequelizeInstance.define(
  "ShiftTaskCompletion",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    shift_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    task_list_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    completed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
    tableName: "shift_task_completions",
    timestamps: false,
    underscored: true,
  }
);

export default ShiftTaskCompletion;
