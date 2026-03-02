export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_qualifications', 'evidence_filename', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('user_qualifications', 'evidence_mime_type', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('user_qualifications', 'evidence_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('user_qualifications', 'evidence_type', {
      type: Sequelize.ENUM('RESUME', 'CERTIFICATE', 'OTHER'),
      allowNull: true
    });

    await queryInterface.addColumn('user_qualifications', 'submitted_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('user_qualifications', 'evidence_filename');
    await queryInterface.removeColumn('user_qualifications', 'evidence_mime_type');
    await queryInterface.removeColumn('user_qualifications', 'evidence_url');
    await queryInterface.removeColumn('user_qualifications', 'evidence_type');
    await queryInterface.removeColumn('user_qualifications', 'submitted_at');
  }
};
