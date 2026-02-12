import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Shift = SequelizeInstance.define(
  "Shift",
  {
    shift_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "shift_id"
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id"
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "start_time"
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "end_time"
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
    tableName: "shifts",
    timestamps: false,
    underscored: true
  }
);

export default Shift;
