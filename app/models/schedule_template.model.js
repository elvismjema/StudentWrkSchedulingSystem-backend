import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const ScheduleTemplate = SequelizeInstance.define(
  "ScheduleTemplate",
  {
    template_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "template_id"
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "department_id"
    },
    template_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "template_name"
    },
    recurrence_type: {
      type: DataTypes.ENUM("weekly", "biweekly", "monthly"),
      allowNull: false,
      field: "recurrence_type"
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active"
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "created_by"
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
    tableName: "schedule_templates",
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (scheduleTemplate) => {
        scheduleTemplate.updated_at = new Date();
      }
    }
  }
);

export default ScheduleTemplate;
