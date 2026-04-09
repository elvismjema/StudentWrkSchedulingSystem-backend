import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const TimecardApproval = SequelizeInstance.define(
  "TimecardApproval",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "id",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "department_id",
    },
    period_start: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "period_start",
    },
    period_end: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "period_end",
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
      field: "status",
    },
    decided_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "decided_by",
    },
    decided_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "decided_at",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    tableName: "timecard_approvals",
    timestamps: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "department_id", "period_start", "period_end"],
      },
    ],
    hooks: {
      beforeUpdate: (record) => {
        record.updated_at = new Date();
      },
    },
  },
);

export default TimecardApproval;
