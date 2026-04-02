import { DataTypes } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";

/**
 * TimeOffRequest model — student-submitted time-off / absence requests.
 *
 * Supports types: sick, personal, academic_conflict (student-specific).
 * Manager reviews and approves/rejects. Approved requests block scheduling.
 */
const TimeOffRequest = sequelize.define(
  "TimeOffRequest",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("sick", "personal", "academic_conflict"),
      allowNull: false,
      defaultValue: "personal",
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    review_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "time_off_requests",
    timestamps: false,
    validate: {
      endAfterStart() {
        if (this.end_date < this.start_date) {
          throw new Error("end_date must be on or after start_date");
        }
      },
    },
  }
);

export default TimeOffRequest;
