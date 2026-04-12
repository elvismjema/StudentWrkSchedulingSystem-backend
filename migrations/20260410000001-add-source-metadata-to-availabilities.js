import { DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("availabilities", "sourceType", {
      type: DataTypes.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("availabilities", "sourceRef", {
      type: DataTypes.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("availabilities", "isSystemManaged", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addIndex("availabilities", ["userId", "sourceType", "sourceRef"], {
      name: "availabilities_user_source_ref_idx",
    });

    await queryInterface.addIndex("availabilities", ["userId", "isSystemManaged"], {
      name: "availabilities_user_system_managed_idx",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("availabilities", "availabilities_user_system_managed_idx");
    await queryInterface.removeIndex("availabilities", "availabilities_user_source_ref_idx");
    await queryInterface.removeColumn("availabilities", "isSystemManaged");
    await queryInterface.removeColumn("availabilities", "sourceRef");
    await queryInterface.removeColumn("availabilities", "sourceType");
  },
};
