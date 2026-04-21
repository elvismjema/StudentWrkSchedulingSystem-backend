/**
 * Notification Service
 *
 * Centralized dispatcher for all notification channels:
 *   - In-app notifications (DB)
 *   - Email notifications (SMTP via nodemailer)
 *   - SMS notifications (Twilio)
 */

import db from "../models/index.js";
import logger from "../config/logger.js";

const Notification = db.notification;
const User = db.user;

let smtpTransportPromise = null;
let twilioClientPromise = null;
let webpushClientPromise = null;

const isTruthy = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const getSmtpTransport = async () => {
  if (smtpTransportPromise) return smtpTransportPromise;

  smtpTransportPromise = (async () => {
    const smtpUrl = process.env.SMTP_URL;
    const smtpHost = process.env.SMTP_HOST;

    if (!smtpUrl && !smtpHost) {
      return null;
    }

    try {
      const nodemailer = await import("nodemailer");
      const smtpPort = Number(process.env.SMTP_PORT || 587);
      const smtpSecure = isTruthy(process.env.SMTP_SECURE, smtpPort === 465);

      const transportConfig = smtpUrl
        ? smtpUrl
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth:
              process.env.SMTP_USER && process.env.SMTP_PASS
                ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                  }
                : undefined,
          };

      return nodemailer.default.createTransport(transportConfig);
    } catch (error) {
      logger.error(`[NotificationService] Failed to initialize SMTP transport: ${error.message}`);
      return null;
    }
  })();

  return smtpTransportPromise;
};

const getTwilioClient = async () => {
  if (twilioClientPromise) return twilioClientPromise;

  twilioClientPromise = (async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return null;
    }

    try {
      const twilio = await import("twilio");
      return twilio.default(accountSid, authToken);
    } catch (error) {
      logger.error(`[NotificationService] Failed to initialize Twilio client: ${error.message}`);
      return null;
    }
  })();

  return twilioClientPromise;
};

// ---------------------------------------------------------------------------
// Web Push notification
// ---------------------------------------------------------------------------

// Exported so other modules (e.g. the notification-preferences PUT endpoint)
// can validate inbound keys against the canonical set instead of duplicating
// the list. Order is intentional — it mirrors the order rendered in the UI.
export const NOTIFICATION_PREFERENCE_KEYS = Object.freeze([
  "shiftReminders",
  "scheduleChanges",
  "swapRequests",
  "openShifts",
  "timeOff",
]);

const NOTIFICATION_TYPE_TO_PREF_KEY = {
  shift_assignment: "scheduleChanges",
  shift_change: "scheduleChanges",
  shift_cancellation: "scheduleChanges",
  shift_reassignment: "scheduleChanges",
  schedule_published: "scheduleChanges",
  shift_reminder: "shiftReminders",
  swap_request: "swapRequests",
  swap_approved: "swapRequests",
  swap_denied: "swapRequests",
  coverage_gap: "openShifts",
  open_shift: "openShifts",
  time_off_approved: "timeOff",
  time_off_denied: "timeOff",
  time_off_request: "timeOff",
};

const getWebpushClient = async () => {
  if (webpushClientPromise) return webpushClientPromise;

  webpushClientPromise = (async () => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_EMAIL || "mailto:admin@workerscheduling.eaglesoftwareteam.com";

    if (!publicKey || !privateKey) {
      return null;
    }

    try {
      const webpush = await import("web-push");
      webpush.default.setVapidDetails(subject, publicKey, privateKey);
      return webpush.default;
    } catch (error) {
      logger.error(`[NotificationService] Failed to initialize web-push: ${error.message}`);
      return null;
    }
  })();

  return webpushClientPromise;
};

/**
 * Send a Web Push notification to every device the user has subscribed.
 *
 * Returns a delivery summary so callers (e.g. the self-serve test endpoint)
 * can report exactly what happened. Still safe to await-and-ignore from the
 * unified dispatcher — existing call sites don't need to change.
 *
 * @returns {Promise<{ sent: number, failed: number, pruned: number, skippedReason?: string, devicesTargeted: number }>}
 */
export const sendWebPushNotification = async (userId, title, message, options = {}) => {
  const summary = { sent: 0, failed: 0, pruned: 0, devicesTargeted: 0, failures: [] };
  if (!userId) return { ...summary, skippedReason: "no-user-id" };

  const webpush = await getWebpushClient();
  if (!webpush) {
    logger.debug("[NotificationService][PUSH] VAPID keys not configured; skipping push delivery");
    return { ...summary, skippedReason: "vapid-not-configured" };
  }

  try {
    const PushSubscription = db.pushSubscription;
    if (!PushSubscription) {
      logger.debug("[NotificationService][PUSH] PushSubscription model not registered");
      return { ...summary, skippedReason: "model-not-registered" };
    }

    const [user, subscriptions] = await Promise.all([
      User.findByPk(userId, { attributes: ["id", "notification_preferences"] }),
      PushSubscription.findAll({ where: { user_id: userId } }),
    ]);

    if (!subscriptions || subscriptions.length === 0) {
      return { ...summary, skippedReason: "no-subscriptions" };
    }
    summary.devicesTargeted = subscriptions.length;

    // Check per-preference opt-out
    const prefKey = options.type ? NOTIFICATION_TYPE_TO_PREF_KEY[options.type] : null;
    if (prefKey && user) {
      let prefs = {};
      try {
        prefs = user.notification_preferences ? JSON.parse(user.notification_preferences) : {};
      } catch {
        prefs = {};
      }
      if (prefs[prefKey] === false) {
        logger.debug(`[NotificationService][PUSH] User ${userId} opted out of '${prefKey}' push notifications`);
        return { ...summary, skippedReason: `opted-out:${prefKey}` };
      }
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: options.link || "/",
      tag: options.type || "oc-schedule",
      requireInteraction: options.priority === "high",
    });

    const staleIds = [];
    const failures = [];
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          summary.sent += 1;
        } catch (err) {
          // 404/410 = subscription is gone on the push service side (user revoked perms, cleared site data, uninstalled PWA)
          // 403       = VAPID signature rejected, usually because the subscription was created under a DIFFERENT public key
          //             than the one the server currently signs with. The subscription can never succeed, prune it.
          if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403) {
            staleIds.push(sub.id);
            summary.pruned += 1;
          } else {
            summary.failed += 1;
            failures.push({
              statusCode: err.statusCode || null,
              message: err.message || "unknown error",
            });
            logger.warn(
              `[NotificationService][PUSH] Failed to send push to user ${userId}: ` +
                `statusCode=${err.statusCode} message=${err.message}`,
            );
          }
        }
      }),
    );
    summary.failures = failures;

    for (const id of staleIds) {
      await PushSubscription.destroy({ where: { id } });
    }
    if (staleIds.length > 0) {
      logger.info(`[NotificationService][PUSH] Removed ${staleIds.length} stale subscriptions for user ${userId}`);
    }

    return summary;
  } catch (err) {
    logger.error(`[NotificationService] Web push delivery error for user ${userId}: ${err.message}`);
    return { ...summary, skippedReason: `error:${err.message}` };
  }
};

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
// Email notification
// ---------------------------------------------------------------------------

/**
 * Send an email notification to a user.
 *
 * Uses SMTP_URL or SMTP_HOST/SMTP_PORT credentials from env.
 *
 * @param {object} user    - Sequelize User instance (must have .email)
 * @param {string} subject - email subject line
 * @param {string} body    - plain-text email body
 */
export const sendEmailNotification = async (user, subject, body) => {
  if (!user?.email) return;

  const emailEnabled = isTruthy(process.env.NOTIFICATIONS_EMAIL_ENABLED, true);
  if (!emailEnabled) return;

  const transport = await getSmtpTransport();
  if (!transport) {
    logger.debug(`[NotificationService][EMAIL] SMTP is not configured; skipping email to ${user.email}`);
    return;
  }

  try {
    const from = process.env.SMTP_FROM || process.env.NOTIFICATIONS_FROM_EMAIL || "noreply@workerscheduling.local";
    await transport.sendMail({
      from,
      to: user.email,
      subject,
      text: body,
    });
  } catch (error) {
    logger.error(`[NotificationService] Failed to send email to ${user.email}: ${error.message}`);
  }
};

// ---------------------------------------------------------------------------
// SMS notification
// ---------------------------------------------------------------------------

/**
 * Send an SMS notification to a user.
 *
 * Uses Twilio credentials from env. Since the current user model does not
 * include a phone field, configure NOTIFICATION_SMS_FALLBACK_TO to test.
 *
 * @param {object} user    - Sequelize User instance
 * @param {string} message - SMS body text
 */
export const sendSmsNotification = async (user, message) => {
  if (!user) return;

  const smsEnabled = isTruthy(process.env.NOTIFICATIONS_SMS_ENABLED, false);
  if (!smsEnabled) return;

  const client = await getTwilioClient();
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!client || !fromNumber) {
    logger.debug("[NotificationService][SMS] Twilio is not fully configured; skipping SMS delivery");
    return;
  }

  const toNumber =
    user.phone ||
    user.phoneNumber ||
    user.mobile ||
    process.env.NOTIFICATION_SMS_FALLBACK_TO ||
    null;

  if (!toNumber) {
    logger.warn(`[NotificationService][SMS] No destination number for user ${user.id}; set NOTIFICATION_SMS_FALLBACK_TO`);
    return;
  }

  try {
    await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: message,
    });
  } catch (error) {
    logger.error(`[NotificationService] Failed to send SMS for user ${user.id}: ${error.message}`);
  }
};

// ---------------------------------------------------------------------------
// Unified dispatcher
// ---------------------------------------------------------------------------

/**
 * Send a notification via all available channels.
 *
 * @param {number} userId  - recipient user ID
 * @param {string} title   - notification headline (used for in-app and email subject)
 * @param {string} message - notification body
 * @param {object} [options]
 * @param {string} [options.type]     - notification type ENUM value
 * @param {string} [options.link]     - frontend route path for deep-linking
 * @param {string} [options.priority] - "normal" | "high"
 * @param {boolean} [options.skipEmail] - set true to suppress email
 * @param {boolean} [options.skipSms]   - set true to suppress SMS
 * @param {boolean} [options.skipPush]  - set true to suppress web push
 */
export const sendNotification = async (userId, title, message, options = {}) => {
  if (!userId) return;

  // 1) Always persist the in-app notification.
  await sendInAppNotification(userId, title, message, options);

  // 2) Fetch recipient once for optional channels.
  let user = null;
  if (!options.skipEmail || !options.skipSms) {
    try {
      user = await User.findByPk(userId, { attributes: ["id", "email"] });
    } catch (error) {
      logger.error(`[NotificationService] Failed to load user ${userId} for channel delivery: ${error.message}`);
    }
  }

  // 3) Email delivery.
  if (!options.skipEmail) {
    try {
      await sendEmailNotification(user, title, message);
    } catch (err) {
      logger.error(`[NotificationService] Email delivery error for user ${userId}: ${err.message}`);
    }
  }

  // 4) SMS delivery.
  if (!options.skipSms) {
    try {
      await sendSmsNotification(user, message);
    } catch (err) {
      logger.error(`[NotificationService] SMS delivery error for user ${userId}: ${err.message}`);
    }
  }

  // 5) Web Push delivery.
  if (!options.skipPush) {
    try {
      await sendWebPushNotification(userId, title, message, options);
    } catch (err) {
      logger.error(`[NotificationService] Web push delivery error for user ${userId}: ${err.message}`);
    }
  }
};
