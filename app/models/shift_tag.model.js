import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ShiftTag = SequelizeInstance.define(
  "shift_tag",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    shiftId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    tagId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "shift_tags",
  },
);

export default ShiftTag;
