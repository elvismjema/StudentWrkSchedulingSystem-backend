export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('users', 'role', {
    type: Sequelize.ENUM('student', 'manager', 'admin'),
    allowNull: false,
    defaultValue: 'student'
  });

  await queryInterface.addIndex('users', ['role']);
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.removeColumn('users', 'role');
}
