import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Position = SequelizeInstance.define(
  "Position",
  {
    position_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "position_id"
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "department_id"
    },
    position_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "position_name"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description"
    },
    // Marks a position (e.g. lifeguard, front desk) as requiring high-priority gap alerts
    is_critical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_critical"
    },
    // Hex color used to visually identify this position on the manager schedule
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: null,
      field: "color"
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
    tableName: "positions",
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (position) => {
        position.updated_at = new Date();
      }
    }
  }
);

export default Position;
