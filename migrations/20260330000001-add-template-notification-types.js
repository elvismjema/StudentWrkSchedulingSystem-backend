'use strict';

/** Adds two new notification type values used by the schedule-template publish
 *  and conflict-detection workflows:
 *    - availability_conflict  : a pre-assigned worker has unavailability/time-off
 *    - schedule_published     : a full week of shifts was published from a template
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // MySQL requires a full MODIFY COLUMN to extend an ENUM.
    await queryInterface.sequelize.query(`
      ALTER TABLE notifications
      MODIFY COLUMN type ENUM(
        'shift_assignment',
        'shift_change',
        'shift_cancellation',
        'shift_reassignment',
        'shift_reminder',
        'coverage_gap',
        'availability_conflict',
        'schedule_published'
      ) DEFAULT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Rollback: remove the two new values
    await queryInterface.sequelize.query(`
      ALTER TABLE notifications
      MODIFY COLUMN type ENUM(
        'shift_assignment',
        'shift_change',
        'shift_cancellation',
        'shift_reassignment',
        'shift_reminder',
        'coverage_gap'
      ) DEFAULT NULL;
    `);
  },
};
