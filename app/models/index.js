import dbConfig from "../config/db.config.js";
import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";

// Models
import User from "./user.model.js";
import Session from "./session.model.js";
import Tutorial from "./tutorial.model.js";
import Lesson from "./lesson.model.js";
import Notification from "./notification.model.js";
import TimeDiscrepancy from "./time_discrepancy.model.js";
import ClockRecord from "./clock_record.model.js";
import Shift from "./shift.model.js";
import Department from "./department.model.js";
import ScheduleTemplate from "./schedule_template.model.js";

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = User;
db.session = Session;
db.tutorial = Tutorial;
db.lesson = Lesson;
db.notification = Notification;
db.timeDiscrepancy = TimeDiscrepancy;
db.clockRecord = ClockRecord;
db.shift = Shift;
db.department = Department;
db.scheduleTemplate = ScheduleTemplate;

// foreign key for session
db.user.hasMany(
  db.session,
  { as: "session" },
  { foreignKey: { allowNull: false }, onDelete: "CASCADE" }
);
db.session.belongsTo(
  db.user,
  { as: "user" },
  { foreignKey: { allowNull: false }, onDelete: "CASCADE" }
);

// foreign key for tutorials
db.user.hasMany(
  db.tutorial,
  { as: "tutorial" },
  { foreignKey: { allowNull: false }, onDelete: "CASCADE" }
);
db.tutorial.belongsTo(
  db.user,
  { as: "user" },
  { foreignKey: { allowNull: false }, onDelete: "CASCADE" }
);

// foreign key for lessons
db.tutorial.hasMany(
  db.lesson,
  { as: "lesson" },
  { foreignKey: { allowNull: false }, onDelete: "CASCADE" }
);
db.lesson.belongsTo(
  db.tutorial,
  { as: "tutorial" },
  { foreignKey: { allowNull: false }, onDelete: "CASCADE" }
);

// Notification relationships
db.user.hasMany(
  db.notification,
  { as: "notifications" },
  { foreignKey: { name: 'userId', allowNull: false }, onDelete: "CASCADE" }
);

db.notification.belongsTo(
  db.user,
  { as: "user" },
  { foreignKey: { name: 'userId', allowNull: false }, onDelete: "CASCADE" }
);

// Time Discrepancy relationships
db.timeDiscrepancy.belongsTo(db.clockRecord, {
  foreignKey: "clock_record_id",
  as: "clockRecord",
  onDelete: "CASCADE"
});

db.timeDiscrepancy.belongsTo(db.user, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "CASCADE"
});

db.timeDiscrepancy.belongsTo(db.shift, {
  foreignKey: "shift_id",
  as: "shift",
  onDelete: "CASCADE"
});

db.timeDiscrepancy.belongsTo(db.user, {
  foreignKey: "resolved_by",
  as: "resolver",
  onDelete: "SET NULL"
});

// ClockRecord relationships
db.clockRecord.hasMany(db.timeDiscrepancy, {
  foreignKey: "clock_record_id",
  as: "timeDiscrepancies"
});

// User relationships
db.user.hasMany(db.timeDiscrepancy, {
  foreignKey: "user_id",
  as: "timeDiscrepancies"
});

// Shift relationships
db.shift.hasMany(db.timeDiscrepancy, {
  foreignKey: "shift_id",
  as: "timeDiscrepancies"
});

db.shift.belongsTo(db.user, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "CASCADE"
});

db.clockRecord.belongsTo(db.user, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "CASCADE"
});

// Department relationships
db.department.hasMany(db.scheduleTemplate, {
  foreignKey: "department_id",
  as: "scheduleTemplates"
});

// Schedule Template relationships
db.scheduleTemplate.belongsTo(db.department, {
  foreignKey: "department_id",
  as: "department",
  onDelete: "CASCADE"
});

db.scheduleTemplate.belongsTo(db.user, {
  foreignKey: "created_by",
  as: "creator",
  onDelete: "CASCADE"
});

db.user.hasMany(db.scheduleTemplate, {
  foreignKey: "created_by",
  as: "createdScheduleTemplates"
});

export default db;
