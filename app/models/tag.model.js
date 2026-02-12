import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Tag = SequelizeInstance.define(
  "tag",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    description: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "tags",
  },
);

export default Tag;
