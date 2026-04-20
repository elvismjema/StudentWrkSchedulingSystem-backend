import { DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("availabilities", "syncBatchId", {
      type: DataTypes.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex(
      "availabilities",
      [
        "userId",
        "sourceType",
        "sourceRef",
        "isRecurring",
        "dayOfWeek",
        "startTime",
        "endTime",
      ],
      {
        name: "availabilities_class_sync_dedupe_uq",
        unique: true,
      }
    );

    await queryInterface.addIndex("availabilities", ["syncBatchId"], {
      name: "availabilities_sync_batch_idx",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("availabilities", "availabilities_sync_batch_idx");
    await queryInterface.removeIndex("availabilities", "availabilities_class_sync_dedupe_uq");
    await queryInterface.removeColumn("availabilities", "syncBatchId");
  },
};
