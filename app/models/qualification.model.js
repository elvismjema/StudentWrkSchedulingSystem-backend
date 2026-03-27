import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Qualification = SequelizeInstance.define(
  "Qualification",
  {
    qualification_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "qualification_id"
    },
    qualification_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "qualification_name"
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "description"
    },
    requires_document: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      field: "requires_document"
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at"
    }
  },
  {
    tableName: "qualifications",
    timestamps: false,
    underscored: true
  }
);

export default Qualification;
