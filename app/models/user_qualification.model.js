import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const UserQualification = SequelizeInstance.define(
  "user_qualification",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    qualification_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    file_name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    file_path: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    mime_type: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    uploaded_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
    approval_status: {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    approved_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    approved_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    rejection_reason: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    notes: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "user_qualifications",
    timestamps: false,
  },
);

export default UserQualification;
