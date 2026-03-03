import dbConfig from "../config/db.config.js";
import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";

// Models
import User from "./user.model.js";
import Employee from "./employee.model.js";
import Session from "./session.model.js";
import Tutorial from "./tutorial.model.js";
import Lesson from "./lesson.model.js";
import Notification from "./notification.model.js";
import TimeDiscrepancy from "./time_discrepancy.model.js";
import ClockRecord from "./clock_record.model.js";
import Shift from "./shift.model.js";
import ShiftAudit from "./shift_audit.model.js";

import Department from "./department.model.js";
import Position from "./position.model.js";
import Role from "./role.model.js";
import ScheduleTemplate from "./schedule_template.model.js";
import Availability from "./availability.model.js";
import ScheduleGapAlert from "./scheduleGapAlert.model.js";
import ShiftAcknowledgement from "./shiftAcknowledgement.model.js";
import ConflictAlert from "./conflictAlert.model.js";
import ShiftTask from "./shiftTask.model.js";
import DepartmentHours from "./department_hours.model.js";
import Qualification from "./qualification.model.js";
import UserQualification from "./user_qualification.model.js";
import UserDepartment from "./user_department.model.js";
import PendingAssignment from "./pending_assignment.model.js";


const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = User;
db.employee = Employee;
db.session = Session;
db.tutorial = Tutorial;
db.lesson = Lesson;
db.notification = Notification;
db.timeDiscrepancy = TimeDiscrepancy;
db.clockRecord = ClockRecord;
db.shift = Shift;
db.shiftAudit = ShiftAudit;

db.department = Department;
db.position = Position;
db.role = Role;
db.scheduleTemplate = ScheduleTemplate;
db.availability = Availability;
db.scheduleGapAlert = ScheduleGapAlert;
db.shiftAcknowledgement = ShiftAcknowledgement;
db.conflictAlert = ConflictAlert;
db.shiftTask = ShiftTask;
db.departmentHours = DepartmentHours;
db.qualification = Qualification;
db.userQualification = UserQualification;
db.userDepartment = UserDepartment;
db.pendingAssignment = PendingAssignment;


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

// Employee relationships (mapped to users table)
db.employee.hasMany(db.session, {
  as: "sessions",
  foreignKey: "userId",
  constraints: false
});

db.session.belongsTo(db.employee, {
  as: "employee",
  foreignKey: "userId",
  constraints: false
});

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

db.shift.belongsTo(db.position, {
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

db.shift.hasMany(db.shiftAudit, {
  foreignKey: "shift_id",
  as: "auditEntries",
});

db.shiftAudit.belongsTo(db.shift, {
  foreignKey: "shift_id",
  as: "shift",
  onDelete: "CASCADE",
});

db.user.hasMany(db.shiftAudit, {
  foreignKey: "actor_user_id",
  as: "shiftAudits",
});

db.shiftAudit.belongsTo(db.user, {
  foreignKey: "actor_user_id",
  as: "actor",
  onDelete: "CASCADE",
});

db.clockRecord.belongsTo(db.user, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "CASCADE"
});

db.user.hasMany(db.clockRecord, {
  foreignKey: "user_id",
  as: "clockRecords"
});

db.clockRecord.belongsTo(db.shift, {
  foreignKey: "shift_id",
  as: "shift",
  onDelete: "SET NULL"
});

db.shift.hasMany(db.clockRecord, {
  foreignKey: "shift_id",
  as: "clockRecords"
});


// Department relationships
db.department.hasMany(db.scheduleTemplate, {
  foreignKey: "department_id",
  as: "scheduleTemplates"
});

db.department.hasMany(db.position, {
  foreignKey: "department_id",
  as: "positions"
});

db.department.hasMany(db.role, {
  foreignKey: "department_id",
  as: "roles"
});

db.department.hasMany(db.departmentHours, {
  foreignKey: "department_id",
  as: "departmentHours"
});

db.departmentHours.belongsTo(db.department, {
  foreignKey: "department_id",
  as: "department",
  onDelete: "CASCADE"
});

db.position.belongsTo(db.department, {
  foreignKey: "department_id",
  as: "department",
  onDelete: "CASCADE"
});

db.role.belongsTo(db.department, {
  foreignKey: "department_id",
  as: "department",
  onDelete: "CASCADE"
});

db.position.hasMany(db.shift, {
  foreignKey: "position_id",
  as: "shifts"
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

// Position can have many schedule gap alerts
db.position.hasMany(
  db.scheduleGapAlert,
  { as: "scheduleGapAlerts", foreignKey: "positionId" }
);

db.scheduleGapAlert.belongsTo(
  db.position,
  { as: "position", foreignKey: "positionId" }
);

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

// Shift Task relationships
// Shift can have many tasks
db.shift.hasMany(
  db.shiftTask,
  { as: "tasks", foreignKey: { name: 'shiftId', allowNull: false }, onDelete: "CASCADE" }
);

db.shiftTask.belongsTo(
  db.shift,
  { as: "shift", foreignKey: { name: 'shiftId', allowNull: false }, onDelete: "CASCADE" }
);

// User can be assigned many shift tasks
db.user.hasMany(
  db.shiftTask,
  { as: "assignedTasks", foreignKey: 'assignedTo' }
);

db.shiftTask.belongsTo(
  db.user,
  { as: "assignedUser", foreignKey: 'assignedTo' }
);

// User can complete many shift tasks
db.user.hasMany(
  db.shiftTask,
  { as: "completedTasks", foreignKey: 'completedBy' }
);

db.shiftTask.belongsTo(
  db.user,
  { as: "completer", foreignKey: 'completedBy' }
);

// User Qualification relationships
db.user.hasMany(db.userQualification, {
  as: "uploadedQualifications",
  foreignKey: "user_id",
});

db.userQualification.belongsTo(db.user, {
  as: "user",
  foreignKey: "user_id",
});

db.qualification.hasMany(db.userQualification, {
  as: "uploadedByUsers",
  foreignKey: "qualification_id",
});

db.userQualification.belongsTo(db.qualification, {
  as: "qualification",
  foreignKey: "qualification_id",
});


// UserDepartment relationships
db.user.hasMany(db.userDepartment, {
  foreignKey: "user_id",
  as: "userDepartments",
});

db.userDepartment.belongsTo(db.user, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "CASCADE",
});

db.department.hasMany(db.userDepartment, {
  foreignKey: "department_id",
  as: "userDepartments",
});

db.userDepartment.belongsTo(db.department, {
  foreignKey: "department_id",
  as: "department",
  onDelete: "CASCADE",
});

db.position.hasMany(db.userDepartment, {
  foreignKey: "position_id",
  as: "userDepartments",
});

db.userDepartment.belongsTo(db.position, {
  foreignKey: "position_id",
  as: "position",
  onDelete: "SET NULL",
});

db.role.hasMany(db.userDepartment, {
  foreignKey: "role_id",
  as: "userDepartments",
});

db.userDepartment.belongsTo(db.role, {
  foreignKey: "role_id",
  as: "role",
  onDelete: "SET NULL",
});

// PendingAssignment relationships
db.department.hasMany(db.pendingAssignment, {
  foreignKey: "department_id",
  as: "pendingAssignments",
});

db.pendingAssignment.belongsTo(db.department, {
  foreignKey: "department_id",
  as: "department",
  onDelete: "CASCADE",
});

db.role.hasMany(db.pendingAssignment, {
  foreignKey: "role_id",
  as: "pendingAssignments",
});

db.pendingAssignment.belongsTo(db.role, {
  foreignKey: "role_id",
  as: "role",
  onDelete: "CASCADE",
});

db.position.hasMany(db.pendingAssignment, {
  foreignKey: "position_id",
  as: "pendingAssignments",
});

db.pendingAssignment.belongsTo(db.position, {
  foreignKey: "position_id",
  as: "position",
  onDelete: "SET NULL",
});

db.user.hasMany(db.pendingAssignment, {
  foreignKey: "created_by",
  as: "createdPendingAssignments",
});

db.pendingAssignment.belongsTo(db.user, {
  foreignKey: "created_by",
  as: "creator",
  onDelete: "SET NULL",
});

export default db;
