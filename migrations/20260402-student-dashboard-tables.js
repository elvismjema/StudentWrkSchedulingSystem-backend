/**
 * Migration: Create tables for student dashboard features.
 *
 * Tables created:
 *   - shift_swap_requests  — Shift swap and find-cover workflow
 *   - time_off_requests    — Student time-off/absence requests
 *   - break_records        — Break tracking within clock sessions
 */

export async function up(queryInterface, Sequelize) {
  // ── shift_swap_requests ──────────────────────────────────────────────────
  await queryInterface.createTable("shift_swap_requests", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    requester_shift_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "shifts", key: "shift_id" },
      onDelete: "CASCADE",
    },
    respondent_shift_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "shifts", key: "shift_id" },
      onDelete: "SET NULL",
    },
    requester_user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    respondent_user_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    type: {
      type: Sequelize.ENUM("find_cover", "swap"),
      allowNull: false,
      defaultValue: "find_cover",
    },
    status: {
      type: Sequelize.ENUM(
        "pending",
        "accepted",
        "declined",
        "cancelled",
        "manager_pending",
        "approved",
        "rejected"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    requester_notes: { type: Sequelize.TEXT, allowNull: true },
    respondent_notes: { type: Sequelize.TEXT, allowNull: true },
    manager_notes: { type: Sequelize.TEXT, allowNull: true },
    reviewed_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    reviewed_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
  });

  await queryInterface.addIndex("shift_swap_requests", ["requester_user_id", "status"]);
  await queryInterface.addIndex("shift_swap_requests", ["respondent_user_id", "status"]);
  await queryInterface.addIndex("shift_swap_requests", ["requester_shift_id"]);

  // ── time_off_requests ────────────────────────────────────────────────────
  await queryInterface.createTable("time_off_requests", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    type: {
      type: Sequelize.ENUM("sick", "personal", "academic_conflict"),
      allowNull: false,
      defaultValue: "personal",
    },
    start_date: { type: Sequelize.DATEONLY, allowNull: false },
    end_date: { type: Sequelize.DATEONLY, allowNull: false },
    notes: { type: Sequelize.TEXT, allowNull: true },
    status: {
      type: Sequelize.ENUM("pending", "approved", "rejected", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    reviewed_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    reviewed_at: { type: Sequelize.DATE, allowNull: true },
    review_notes: { type: Sequelize.TEXT, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
  });

  await queryInterface.addIndex("time_off_requests", ["user_id", "status"]);
  await queryInterface.addIndex("time_off_requests", ["start_date", "end_date"]);

  // ── break_records ────────────────────────────────────────────────────────
  await queryInterface.createTable("break_records", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    clock_record_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "clock_records", key: "clock_id" },
      onDelete: "CASCADE",
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    break_start: { type: Sequelize.DATE, allowNull: false },
    break_end: { type: Sequelize.DATE, allowNull: true },
    break_type: {
      type: Sequelize.ENUM("meal", "rest", "other"),
      allowNull: false,
      defaultValue: "rest",
    },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
  });

  await queryInterface.addIndex("break_records", ["clock_record_id"]);
  await queryInterface.addIndex("break_records", ["user_id"]);
}

export async function down(queryInterface) {
  await queryInterface.dropTable("break_records");
  await queryInterface.dropTable("time_off_requests");
  await queryInterface.dropTable("shift_swap_requests");
}
