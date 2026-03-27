import { DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'type' column to distinguish notification categories
    await queryInterface.addColumn("notifications", "type", {
      type: DataTypes.ENUM(
        "shift_assignment",
        "shift_change",
        "shift_cancellation",
        "shift_reassignment",
        "shift_reminder",
        "coverage_gap"
      ),
      allowNull: true,
      defaultValue: null,
    });

    // Add 'link' column so recipients can navigate directly to the relevant page
    await queryInterface.addColumn("notifications", "link", {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    });

    // Add 'priority' column to support high-priority gap alerts (US3 AC2)
    await queryInterface.addColumn("notifications", "priority", {
      type: DataTypes.ENUM("normal", "high"),
      allowNull: false,
      defaultValue: "normal",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("notifications", "type");
    await queryInterface.removeColumn("notifications", "link");
    await queryInterface.removeColumn("notifications", "priority");
  },
};
