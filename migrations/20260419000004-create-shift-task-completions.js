export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("shift_task_completions", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shift_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "shifts", key: "shift_id" },
      onDelete: "CASCADE",
    },
    task_list_item_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "task_list_items", key: "id" },
      onDelete: "CASCADE",
    },
    completed_by: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    completed_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  });

  await queryInterface.addConstraint("shift_task_completions", {
    fields: ["shift_id", "task_list_item_id"],
    type: "unique",
    name: "unique_shift_task_completion",
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable("shift_task_completions");
}
