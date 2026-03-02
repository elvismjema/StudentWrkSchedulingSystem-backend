export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('position_qualifications', {
    position_qualification_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    position_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'positions',
        key: 'position_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    qualification_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'qualifications',
        key: 'qualification_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.addIndex('position_qualifications', ['position_id']);
  await queryInterface.addIndex('position_qualifications', ['qualification_id']);
  await queryInterface.addIndex('position_qualifications', ['position_id', 'qualification_id'], { unique: true });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable('position_qualifications');
}
