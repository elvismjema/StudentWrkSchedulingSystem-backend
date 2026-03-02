import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const UserQualification = SequelizeInstance.define(
  "UserQualification",
  {
    user_qualification_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "user_qualification_id"
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id"
    },
    qualification_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "qualification_id"
    },
    approval_status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
      field: "approval_status"
    },
    approved_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "approved_by_user_id"
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "approved_at"
    },
    document_name: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "document_name"
    },
    document_path: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "document_path"
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
    tableName: "user_qualifications",
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (userQualification) => {
        userQualification.updated_at = new Date();
      }
    }
  }
);

export default UserQualification;
