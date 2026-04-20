export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn("shifts", "task_list_id", {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: "task_lists", key: "id" },
    onDelete: "SET NULL",
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn("shifts", "task_list_id");
}
