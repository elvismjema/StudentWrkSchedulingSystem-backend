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
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description"
    },
    requires_document: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "requires_document"
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at"
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at"
    }
  },
  {
    tableName: "qualifications",
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (qualification) => {
        qualification.updated_at = new Date();
      }
    }
  }
);

export default Qualification;
