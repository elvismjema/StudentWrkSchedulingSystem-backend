"use strict";

/**
 * Add "cover_approved" to shift_swap_requests.status ENUM.
 *
 * This supports the new two-stage cover request workflow:
 *   pending        → manager approves/denies the cover request (Stage 1)
 *   cover_approved → manager approved; shift is now visible as open for pickup
 *   manager_pending→ a student volunteered to pick it up; manager approves/denies (Stage 2)
 *   approved       → shift reassigned to the volunteer
 *   declined       → denied at Stage 1 or Stage 2 (swap/cover final deny)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // MySQL requires reconstructing the ENUM to add a value.
    await queryInterface.sequelize.query(`
      ALTER TABLE shift_swap_requests
      MODIFY COLUMN status ENUM(
        'pending',
        'accepted',
        'declined',
        'cancelled',
        'manager_pending',
        'cover_approved',
        'approved',
        'rejected'
      ) NOT NULL DEFAULT 'pending'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert by removing cover_approved (rows with this value must be handled first)
    await queryInterface.sequelize.query(`
      ALTER TABLE shift_swap_requests
      MODIFY COLUMN status ENUM(
        'pending',
        'accepted',
        'declined',
        'cancelled',
        'manager_pending',
        'approved',
        'rejected'
      ) NOT NULL DEFAULT 'pending'
    `);
  },
};
