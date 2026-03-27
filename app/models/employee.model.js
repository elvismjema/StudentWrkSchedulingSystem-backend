import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Employee = SequelizeInstance.define(
  "employee",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    fName: {
      type: Sequelize.STRING,
      allowNull: false
    },
    lName: {
      type: Sequelize.STRING,
      allowNull: false
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false
    }
  },
  {
    tableName: "users"
  }
);

export default Employee;
