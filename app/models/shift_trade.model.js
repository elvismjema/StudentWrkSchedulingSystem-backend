import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ShiftTrade = SequelizeInstance.define(
  "shift_trade",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    requesterId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    recipientId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    offeredShiftId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    requestedShiftId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    status: {
      type: Sequelize.ENUM("pending", "accepted", "declined", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    requestedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
    respondedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    notes: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "shift_trades",
  },
);

export default ShiftTrade;
