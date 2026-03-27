import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ShiftAudit = SequelizeInstance.define(
  "ShiftAudit",
  {
    audit_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "audit_id",
    },
    shift_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "shift_id",
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "action",
    },
    actor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "actor_user_id",
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "details",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    tableName: "shift_audits",
    timestamps: false,
    underscored: true,
  },
);

export default ShiftAudit;
