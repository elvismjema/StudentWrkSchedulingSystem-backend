export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('user_qualifications', {
    user_qualification_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
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
    approval_status: {
      type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    approved_by_user_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    approved_at: {
      type: Sequelize.DATE,
      allowNull: true
    },
    document_name: {
      type: Sequelize.STRING,
      allowNull: true
    },
    document_path: {
      type: Sequelize.STRING,
      allowNull: true
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

  await queryInterface.addIndex('user_qualifications', ['user_id']);
  await queryInterface.addIndex('user_qualifications', ['qualification_id']);
  await queryInterface.addIndex('user_qualifications', ['approval_status']);
  await queryInterface.addIndex('user_qualifications', ['user_id', 'qualification_id'], { unique: true });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable('user_qualifications');
}
