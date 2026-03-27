import { DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface) => {
    // Mark positions as critical to enable high-priority gap notifications (US3 AC2)
    await queryInterface.addColumn("positions", "is_critical", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("positions", "is_critical");
  },
};
