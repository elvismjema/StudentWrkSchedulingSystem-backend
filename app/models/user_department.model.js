import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const UserDepartment = SequelizeInstance.define(
  "UserDepartment",
  {
    ud_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    department_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    position_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    role_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    request_status: {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    assigned_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
    deactivated_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "user_departments",
    timestamps: false,
    underscored: true,
  }
);

export default UserDepartment;
