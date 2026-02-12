import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const PositionQualification = SequelizeInstance.define(
  "position_qualification",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    positionId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    qualificationId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    isRequired: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "position_qualifications",
  },
);

export default PositionQualification;
