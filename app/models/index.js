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

import Availability from "./availability.model.js";
import ScheduleGapAlert from "./scheduleGapAlert.model.js";
import ShiftAcknowledgement from "./shiftAcknowledgement.model.js";
import ConflictAlert from "./conflictAlert.model.js";


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

db.availability = Availability;
db.scheduleGapAlert = ScheduleGapAlert;
db.shiftAcknowledgement = ShiftAcknowledgement;
db.conflictAlert = ConflictAlert;


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
db.shift.belongsTo(db.department, {
  foreignKey: "department_id",
  as: "department",
  onDelete: "CASCADE"
});

db.shift.belongsTo(db.user, {
  foreignKey: "position_id",
  as: "position",
  onDelete: "CASCADE"
});

db.shift.belongsTo(db.scheduleTemplate, {
  foreignKey: "template_id",
  as: "template",
  onDelete: "SET NULL"
});

db.shift.belongsTo(db.user, {
  foreignKey: "assigned_user_id",
  as: "assignedUser",
  onDelete: "SET NULL"
});

db.shift.belongsTo(db.user, {
  foreignKey: "created_by",
  as: "creator",
  onDelete: "CASCADE"
});

db.shift.hasMany(db.timeDiscrepancy, {
  foreignKey: "shift_id",
  as: "timeDiscrepancies"
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

// Availability relationships
// User can have many availabilities
db.user.hasMany(
  db.availability,
  { as: "availabilities" },
  { foreignKey: { name: 'userId', allowNull: false }, onDelete: "CASCADE" }
);

db.availability.belongsTo(
  db.user,
  { as: "user" },
  { foreignKey: { name: 'userId', allowNull: false }, onDelete: "CASCADE" }
);

// User can approve many availabilities (approvedBy relationship)
db.user.hasMany(
  db.availability,
  { as: "approvedAvailabilities", foreignKey: 'approvedBy' }
);

db.availability.belongsTo(
  db.user,
  { as: "approver", foreignKey: 'approvedBy' }
);
// Schedule Gap Alert relationships
// Department can have many schedule gap alerts (will be activated when department model is complete)
// db.department.hasMany(
//   db.scheduleGapAlert,
//   { as: "scheduleGapAlerts", foreignKey: 'departmentId' }
// );

// db.scheduleGapAlert.belongsTo(
//   db.department,
//   { as: "department", foreignKey: 'departmentId' }
// );

// Position can have many schedule gap alerts (will be activated when position model is complete)
// db.position.hasMany(
//   db.scheduleGapAlert,
//   { as: "scheduleGapAlerts", foreignKey: 'positionId' }
// );

// db.scheduleGapAlert.belongsTo(
//   db.position,
//   { as: "position", foreignKey: 'positionId' }
// );

// Shift Acknowledgement relationships
// Shift can have many acknowledgements
db.shift.hasMany(
  db.shiftAcknowledgement,
  { as: "acknowledgements", foreignKey: { name: 'shiftId', allowNull: false }, onDelete: "CASCADE" }
);

db.shiftAcknowledgement.belongsTo(
  db.shift,
  { as: "shift", foreignKey: { name: 'shiftId', allowNull: false }, onDelete: "CASCADE" }
);

// User can have many shift acknowledgements
db.user.hasMany(
  db.shiftAcknowledgement,
  { as: "shiftAcknowledgements", foreignKey: { name: 'userId', allowNull: false }, onDelete: "CASCADE" }
);

db.shiftAcknowledgement.belongsTo(
  db.user,
  { as: "user", foreignKey: { name: 'userId', allowNull: false }, onDelete: "CASCADE" }
);

// Conflict Alert relationships
// User can have many conflict alerts
db.user.hasMany(
  db.conflictAlert,
  { as: "conflictAlerts", foreignKey: { name: 'userId', allowNull: false }, onDelete: "CASCADE" }
);

db.conflictAlert.belongsTo(
  db.user,
  { as: "user", foreignKey: { name: 'userId', allowNull: false }, onDelete: "CASCADE" }
);

// Primary Shift relationship
db.shift.hasMany(
  db.conflictAlert,
  { as: "conflictAlertsAsPrimary", foreignKey: { name: 'primaryShiftId', allowNull: false }, onDelete: "CASCADE" }
);

db.conflictAlert.belongsTo(
  db.shift,
  { as: "primaryShift", foreignKey: { name: 'primaryShiftId', allowNull: false }, onDelete: "CASCADE" }
);

// Conflicting Shift relationship (optional)
db.shift.hasMany(
  db.conflictAlert,
  { as: "conflictAlertsAsConflicting", foreignKey: { name: 'conflictingShiftId' }, onDelete: "SET NULL" }
);

db.conflictAlert.belongsTo(
  db.shift,
  { as: "conflictingShift", foreignKey: { name: 'conflictingShiftId' }, onDelete: "SET NULL" }
);

// User who acknowledged the conflict
db.user.hasMany(
  db.conflictAlert,
  { as: "acknowledgedConflicts", foreignKey: 'acknowledgedBy' }
);

db.conflictAlert.belongsTo(
  db.user,
  { as: "acknowledger", foreignKey: 'acknowledgedBy' }
);

// User who resolved the conflict
db.user.hasMany(
  db.conflictAlert,
  { as: "resolvedConflicts", foreignKey: 'resolvedBy' }
);

db.conflictAlert.belongsTo(
  db.user,
  { as: "resolver", foreignKey: 'resolvedBy' }
);


export default db;
