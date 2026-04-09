import { DataTypes } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";

/**
 * ShiftSwapRequest model — tracks shift swap / find-cover requests between students.
 *
 * Workflow:
 *   1. Requester posts their shift for coverage ("find_cover") or proposes a swap ("swap")
 *   2. A respondent can accept (for find_cover) or the requester targets a specific coworker (for swap)
 *   3. Manager approval may be required (configurable)
 *   4. On final approval the shift assignments are swapped
 */
const ShiftSwapRequest = sequelize.define(
  "ShiftSwapRequest",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    requester_shift_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "The shift the requester wants covered or swapped",
    },
    respondent_shift_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "For swap type: the shift offered in exchange",
    },
    requester_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "User requesting the swap/cover",
    },
    respondent_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User who accepts the swap/cover",
    },
    type: {
      type: DataTypes.ENUM("find_cover", "swap"),
      allowNull: false,
      defaultValue: "find_cover",
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "accepted",
        "declined",
        "cancelled",
        "manager_pending",
        "cover_approved",
        "approved",
        "rejected"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    requester_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    respondent_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    manager_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Manager who approved/rejected",
    },
    reviewed_at: {
      type: DataTypes.DATE,
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
    tableName: "shift_swap_requests",
    timestamps: false,
  }
);

export default ShiftSwapRequest;
