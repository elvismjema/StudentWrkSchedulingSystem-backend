export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn("users", "notification_preferences", {
    type: Sequelize.TEXT,
    allowNull: true,
    defaultValue: null,
    comment: "JSON-encoded notification preference flags per user",
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn("users", "notification_preferences");
}
