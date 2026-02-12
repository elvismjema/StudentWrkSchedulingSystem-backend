import { DataTypes } from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Shift = SequelizeInstance.define(
  "Shift",
  {
    shift_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: "shift_id"
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "department_id"
    },
    position_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "position_id"
    },
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "template_id"
    },
    day_of_week: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "day_of_week",
      validate: {
        min: 0,
        max: 6
      }
    },
    shift_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "shift_date"
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false,
      field: "start_time"
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false,
      field: "end_time"
    },
    assigned_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_user_id"
    },
    trade_status: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "trade_status"
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "created_by"
    },
    is_template: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_template"
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_published"
    },
    is_recurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_recurring"
    },
    recurrence_pattern: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "recurrence_pattern"
    },
    recurrence_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "recurrence_start_date"
    },
    recurrence_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "recurrence_end_date"
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
    tableName: "shifts",
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (shift) => {
        shift.updated_at = new Date();
      }
    },
    validate: {
      checkTimes() {
        if (new Date(`1970-01-01T${this.end_time}`) <= new Date(`1970-01-01T${this.start_time}`)) {
          throw new Error('end_time must be after start_time');
        }
      },
      checkRecurrence() {
        if (this.is_recurring) {
          if (!this.recurrence_pattern || !this.recurrence_start_date) {
            throw new Error('Recurring shifts require recurrence_pattern and recurrence_start_date');
          }
        }
      },
      checkDateOrDay() {
        if (!this.shift_date && this.day_of_week === undefined) {
          throw new Error('Either shift_date or day_of_week must be provided');
        }
      }
    }
  }
);

export default Shift;
