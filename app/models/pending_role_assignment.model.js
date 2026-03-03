import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const PendingRoleAssignment = SequelizeInstance.define(
  "PendingRoleAssignment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    position_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "pending_role_assignments",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default PendingRoleAssignment;
