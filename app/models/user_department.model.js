import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const UserDepartment = SequelizeInstance.define(
  "user_department",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    departmentId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    isPrimary: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "user_departments",
  },
);

export default UserDepartment;
