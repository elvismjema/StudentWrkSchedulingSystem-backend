export async function up(queryInterface, Sequelize) {
  const tableDesc = await queryInterface.describeTable("user_departments");

  if (!tableDesc.request_status) {
    await queryInterface.addColumn("user_departments", "request_status", {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "approved",
    });
  }

  // Update existing active rows to "approved" so current members aren't broken
  await queryInterface.sequelize.query(
    `UPDATE user_departments SET request_status = 'approved' WHERE is_active = 1 AND request_status = 'pending'`
  );
}

export async function down(queryInterface) {
  await queryInterface.removeColumn("user_departments", "request_status");
}
