import dbConfig from "../config/db.config.js";
import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";

// Models

import User from "./user.model.js";
import Session from "./session.model.js";
import Tutorial from "./tutorial.model.js";
import Lesson from "./lesson.model.js"; 
import Tag from "./tag.model.js";
import ShiftTag from "./shift_tag.model.js";
import UserDepartment from "./user_department.model.js";
import ClockRecord from "./clock_record.model.js";
import PositionQualification from "./position_qualification.model.js";


const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = User;
db.session = Session;
db.tutorial = Tutorial;
db.lesson = Lesson;
db.tag = Tag;
db.shiftTag = ShiftTag;
db.userDepartment = UserDepartment;
db.clockRecord = ClockRecord;
db.positionQualification = PositionQualification;

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

// foreign key for shift tags
db.tag.hasMany(db.shiftTag, {
  as: "shiftTags",
  foreignKey: { name: "tagId", allowNull: false },
  onDelete: "CASCADE",
});
db.shiftTag.belongsTo(db.tag, {
  as: "tag",
  foreignKey: { name: "tagId", allowNull: false },
  onDelete: "CASCADE",
});

// foreign key for user departments
db.user.hasMany(db.userDepartment, {
  as: "userDepartments",
  foreignKey: { name: "userId", allowNull: false },
  onDelete: "CASCADE",
});
db.userDepartment.belongsTo(db.user, {
  as: "user",
  foreignKey: { name: "userId", allowNull: false },
  onDelete: "CASCADE",
});

// foreign key for clock records
db.user.hasMany(db.clockRecord, {
  as: "clockRecords",
  foreignKey: { name: "userId", allowNull: false },
  onDelete: "CASCADE",
});
db.clockRecord.belongsTo(db.user, {
  as: "user",
  foreignKey: { name: "userId", allowNull: false },
  onDelete: "CASCADE",
});

export default db;
