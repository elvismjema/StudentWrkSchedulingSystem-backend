/**
 * Migration: Create department_hours table (safe – uses IF NOT EXISTS).
 *
 * Stores per-department operating hours for each day of the week.
 * These hours drive the visible time range on the Schedule calendar and
 * the Schedule Template editor.
 *
 * Uses a raw CREATE TABLE … IF NOT EXISTS so the migration is idempotent
 * on servers where Sequelize sync may have already created the table.
 */

export async function up(queryInterface, Sequelize) {
  // Create the table only if it does not already exist.
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS department_hours (
      hours_id      INT          NOT NULL AUTO_INCREMENT,
      department_id INT          NOT NULL,
      day_of_week   INT          NULL,
      open_time     TIME         NULL,
      close_time    TIME         NULL,
      specific_date DATE         NULL,
      is_default    TINYINT(1)   NULL     DEFAULT 1,
      is_closed     TINYINT(1)   NOT NULL DEFAULT 0,
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (hours_id),
      CONSTRAINT fk_dept_hours_dept
        FOREIGN KEY (department_id) REFERENCES departments (department_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Add is_closed column if the table existed already without it.
  await queryInterface.sequelize.query(`
    ALTER TABLE department_hours
      ADD COLUMN IF NOT EXISTS is_closed TINYINT(1) NOT NULL DEFAULT 0;
  `);
}

export async function down(queryInterface) {
  await queryInterface.dropTable("department_hours");
}
