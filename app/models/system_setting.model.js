export default (sequelize, Sequelize) => {
  const SystemSetting = sequelize.define(
    "system_setting",
    {
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
    },
    {
      tableName: "system_settings",
      timestamps: true,
      underscored: true,
    }
  );

  return SystemSetting;
};
