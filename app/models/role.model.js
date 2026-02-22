import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Role = SequelizeInstance.define(
  "Role",
  {
    role_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "role_id"
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "department_id"
    },
    role_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "role_name"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description"
    },
    permission_level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "permission_level",
      defaultValue: 1
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at"
    }
  },
  {
    tableName: "roles",
    timestamps: false,
    underscored: true
  }
);

export default Role;
