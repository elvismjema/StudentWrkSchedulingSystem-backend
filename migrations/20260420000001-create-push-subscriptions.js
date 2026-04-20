export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("push_subscriptions", {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    endpoint: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    p256dh: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    auth: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    },
  });

  await queryInterface.addIndex("push_subscriptions", ["user_id"], {
    name: "idx_push_subscriptions_user",
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable("push_subscriptions");
}
