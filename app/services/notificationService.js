/**
 * Notification Service
 *
 * Centralised dispatcher for all notification channels.
 *
 * Currently implemented:
 *   - In-app (database) notifications   ✅
 *
 * Stubbed for future implementation:
 *   - Email notifications               🔧 TODO – wire up nodemailer / SendGrid / SES
 *   - SMS notifications                 🔧 TODO – wire up Twilio / SNS
 *
 * How to complete the email stub:
 *   1. `npm install nodemailer` (or your preferred mailer)
 *   2. Configure SMTP credentials in .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
 *   3. Replace the TODO block inside `sendEmailNotification` with the actual transport logic.
 *
 * How to complete the SMS stub:
 *   1. `npm install twilio` (or your preferred SMS provider SDK)
 *   2. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to .env
 *   3. Replace the TODO block inside `sendSmsNotification` with the actual send logic.
 */

import db from "../models/index.js";
import logger from "../config/logger.js";

const Notification = db.notification;
const User = db.user;

// ---------------------------------------------------------------------------
// In-app notification (always active)
// ---------------------------------------------------------------------------

/**
 * Persist an in-app notification record for a user.
 *
 * @param {number} userId - recipient user ID
 * @param {string} title  - short notification headline
 * @param {string} message - full notification body
 * @param {object} [options]
 * @param {string} [options.type]     - one of the ENUM values on the model
 * @param {string} [options.link]     - frontend route path (e.g. "/shifts/42")
 * @param {string} [options.priority] - "normal" | "high"
 */
export const sendInAppNotification = async (userId, title, message, options = {}) => {
  if (!userId) return;

  try {
    await Notification.create({
      userId,
      title,
      message,
      isRead: false,
      type: options.type || null,
      link: options.link || null,
      priority: options.priority || "normal",
    });
  } catch (err) {
    logger.error(`[NotificationService] Failed to create in-app notification for user ${userId}: ${err.message}`);
  }
};

// ---------------------------------------------------------------------------
// Email notification stub
// ---------------------------------------------------------------------------

/**
 * Send an email notification to a user.
 *
 * 🔧 TODO: Replace this stub with real mailer logic.
 *
 * @param {object} user    - Sequelize User instance (must have .email)
 * @param {string} subject - email subject line
 * @param {string} body    - plain-text or HTML email body
 */
export const sendEmailNotification = async (user, subject, body) => {
  if (!user?.email) return;

  // -------------------------------------------------------------------------
  // TODO: implement email sending
  // Example using nodemailer:
  //
  //   import nodemailer from "nodemailer";
  //
  //   const transporter = nodemailer.createTransport({
  //     host: process.env.SMTP_HOST,
  //     port: Number(process.env.SMTP_PORT) || 587,
  //     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  //   });
  //
  //   await transporter.sendMail({
  //     from: process.env.SMTP_FROM || "noreply@example.com",
  //     to: user.email,
  //     subject,
  //     text: body,
  //   });
  // -------------------------------------------------------------------------

  logger.debug(`[NotificationService][EMAIL STUB] Would send email to ${user.email} — subject: "${subject}"`);
};

// ---------------------------------------------------------------------------
// SMS notification stub
// ---------------------------------------------------------------------------

/**
 * Send an SMS notification to a user.
 *
 * 🔧 TODO: Replace this stub with real SMS logic.
 *
 * @param {object} user    - Sequelize User instance (must have .phone or similar field)
 * @param {string} message - SMS body text
 */
export const sendSmsNotification = async (user, message) => {
  if (!user) return;

  // -------------------------------------------------------------------------
  // TODO: implement SMS sending
  // Example using Twilio:
  //
  //   import twilio from "twilio";
  //
  //   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  //   await client.messages.create({
  //     body: message,
  //     from: process.env.TWILIO_FROM_NUMBER,
  //     to: user.phone,      // ensure a 'phone' column exists on the users table
  //   });
  // -------------------------------------------------------------------------

  logger.debug(`[NotificationService][SMS STUB] Would send SMS to user ${user.id} — message: "${message}"`);
};

// ---------------------------------------------------------------------------
// Unified dispatcher
// ---------------------------------------------------------------------------

/**
 * Send a notification via all available channels.
 *
 * Always creates an in-app notification. Email and SMS are currently stubbed
 * and will log debug messages until fully implemented.
 *
 * @param {number} userId  - recipient user ID
 * @param {string} title   - notification headline (used for in-app and email subject)
 * @param {string} message - notification body
 * @param {object} [options]
 * @param {string} [options.type]     - notification type ENUM value
 * @param {string} [options.link]     - frontend route path for deep-linking
 * @param {string} [options.priority] - "normal" | "high"
 * @param {boolean} [options.skipEmail] - set true to suppress the email stub call
 * @param {boolean} [options.skipSms]   - set true to suppress the SMS stub call
 */
export const sendNotification = async (userId, title, message, options = {}) => {
  if (!userId) return;

  // 1. Always persist the in-app notification
  await sendInAppNotification(userId, title, message, options);

  // 2. Email – look up the user and call the email stub
  //    (stub is a no-op until SMTP is configured – see comments above)
  if (!options.skipEmail) {
    try {
      const user = await User.findByPk(userId, { attributes: ["id", "email"] });
      await sendEmailNotification(user, title, message);
    } catch (err) {
      logger.error(`[NotificationService] Email stub error for user ${userId}: ${err.message}`);
    }
  }

  // 3. SMS – look up the user and call the SMS stub
  //    (stub is a no-op until Twilio / SNS is configured – see comments above)
  if (!options.skipSms) {
    try {
      const user = await User.findByPk(userId, { attributes: ["id"] });
      await sendSmsNotification(user, message);
    } catch (err) {
      logger.error(`[NotificationService] SMS stub error for user ${userId}: ${err.message}`);
    }
  }
};
