import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const PositionQualification = SequelizeInstance.define(
  "PositionQualification",
  {
    position_qualification_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "position_qualification_id"
    },
    position_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "position_id"
    },
    qualification_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "qualification_id"
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
    tableName: "position_qualifications",
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (positionQualification) => {
        positionQualification.updated_at = new Date();
      }
    }
  }
);

export default PositionQualification;
