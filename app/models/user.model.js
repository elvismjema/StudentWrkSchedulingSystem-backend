import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const User = SequelizeInstance.define("user", {
  
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  fName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  lName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  is_active: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  deactivated_at: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  role: {
    type: Sequelize.ENUM("student", "manager", "admin"),
    allowNull: false,
    defaultValue: "student",
  },
  classScheduleLastSyncedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  classScheduleSyncStatus: {
    type: Sequelize.ENUM("never_synced", "success", "failed"),
    allowNull: false,
    defaultValue: "never_synced",
  },
  classScheduleSyncError: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  // refresh_token: {
  //   type: Sequelize.STRING(512),
  //   allowNull: true
  // },
  // expiration_date: {
  //   type: Sequelize.DATE,
  //   allowNull: true
  // },
});

export default User;
