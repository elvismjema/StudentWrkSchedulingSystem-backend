export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("system_settings", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    setting_key: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true,
    },
    setting_value: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    setting_type: {
      type: Sequelize.ENUM("string", "number", "boolean", "json"),
      allowNull: false,
      defaultValue: "string",
    },
    category: {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "general",
    },
    description: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    updated_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
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
}

export async function down(queryInterface) {
  await queryInterface.dropTable("system_settings");
}
