import { DataTypes } from "sequelize";
import db from "../app/models/index.js";

const queryInterface = db.sequelize.getQueryInterface();

const ensureColumn = async (tableName, columnName, definition) => {
  const columns = await queryInterface.describeTable(tableName);

  if (columns[columnName]) {
    console.log(`schema ok: ${tableName}.${columnName}`);
    return false;
  }

  await queryInterface.addColumn(tableName, columnName, definition);
  console.log(`schema updated: ${tableName}.${columnName}`);
  return true;
};

const main = async () => {
  let appliedChanges = 0;

  appliedChanges += Number(
    await ensureColumn("user_departments", "request_status", {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    }),
  );

  appliedChanges += Number(
    await ensureColumn("positions", "is_critical", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }),
  );

  appliedChanges += Number(
    await ensureColumn("notifications", "type", {
      type: DataTypes.ENUM(
        "shift_assignment",
        "shift_change",
        "shift_cancellation",
        "shift_reassignment",
        "shift_reminder",
        "coverage_gap",
        "availability_conflict",
        "schedule_published",
      ),
      allowNull: true,
      defaultValue: null,
    }),
  );

  appliedChanges += Number(
    await ensureColumn("notifications", "link", {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    }),
  );

  appliedChanges += Number(
    await ensureColumn("notifications", "priority", {
      type: DataTypes.ENUM("normal", "high"),
      allowNull: false,
      defaultValue: "normal",
    }),
  );

  appliedChanges += Number(
    await ensureColumn("users", "role", {
      type: DataTypes.ENUM("student", "manager", "admin"),
      allowNull: false,
      defaultValue: "student",
    }),
  );

  console.log(`schema sync complete: ${appliedChanges} change(s) applied`);
};

try {
  await main();
} catch (error) {
  console.error("schema sync failed:", error);
  process.exitCode = 1;
} finally {
  await db.sequelize.close();
}
