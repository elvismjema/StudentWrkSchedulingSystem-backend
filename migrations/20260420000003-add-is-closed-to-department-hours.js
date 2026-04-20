/**
 * Migration: Add is_closed column to department_hours table.
 *
 * Allows managers to mark a specific day of the week as closed,
 * which hides it from calendar bounds calculations.
 */

export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn("department_hours", "is_closed", {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    after: "is_default",
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn("department_hours", "is_closed");
}
