import { DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("users", "classScheduleLastSyncedAt", {
      type: DataTypes.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("users", "classScheduleSyncStatus", {
      type: DataTypes.ENUM("never_synced", "success", "failed"),
      allowNull: false,
      defaultValue: "never_synced",
    });

    await queryInterface.addColumn("users", "classScheduleSyncError", {
      type: DataTypes.TEXT,
      allowNull: true,
    });

    await queryInterface.addIndex("users", ["classScheduleSyncStatus"], {
      name: "users_class_sync_status_idx",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("users", "users_class_sync_status_idx");
    await queryInterface.removeColumn("users", "classScheduleSyncError");
    await queryInterface.removeColumn("users", "classScheduleSyncStatus");
    await queryInterface.removeColumn("users", "classScheduleLastSyncedAt");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS enum_users_classScheduleSyncStatus;").catch(() => {});
  },
};
