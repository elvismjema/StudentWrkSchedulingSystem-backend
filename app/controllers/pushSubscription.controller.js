import db from "../models/index.js";
import logger from "../config/logger.js";
import { sendWebPushNotification } from "../services/notificationService.js";

const PushSubscription = db.pushSubscription;

/**
 * GET /push-subscriptions/vapid-public-key
 * Returns the server's VAPID public key so the frontend can subscribe.
 */
export const getVapidPublicKey = (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(503).json({ message: "Push notifications are not configured on this server." });
  }
  res.json({ publicKey: key });
};

/**
 * POST /push-subscriptions
 * Save (upsert) a push subscription for the authenticated user.
 * Body: { endpoint, keys: { p256dh, auth } }
 */
export const saveSubscription = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "endpoint and keys.p256dh and keys.auth are required" });
    }

    // Upsert: if this endpoint already exists for the user, update it; otherwise create.
    const [sub] = await PushSubscription.findOrCreate({
      where: { user_id: userId, endpoint },
      defaults: {
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    if (sub.p256dh !== keys.p256dh || sub.auth !== keys.auth) {
      await sub.update({ p256dh: keys.p256dh, auth: keys.auth });
    }

    res.status(201).json({ message: "Subscription saved" });
  } catch (err) {
    logger.error(`[PushSubscription] Failed to save subscription: ${err.message}`);
    res.status(500).json({ message: "Failed to save subscription" });
  }
};

/**
 * DELETE /push-subscriptions
 * Remove all push subscriptions for the authenticated user (e.g. on logout or disable).
 * Optionally: body { endpoint } to remove a specific one.
 */
export const deleteSubscription = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { endpoint } = req.body || {};
    const where = { user_id: userId };
    if (endpoint) where.endpoint = endpoint;

    await PushSubscription.destroy({ where });
    res.json({ message: "Subscription removed" });
  } catch (err) {
    logger.error(`[PushSubscription] Failed to delete subscription: ${err.message}`);
    res.status(500).json({ message: "Failed to remove subscription" });
  }
};

/**
 * POST /push-subscriptions/me/test
 * Send a canned test push to every device the authenticated user has
 * subscribed. Self-serve only — uses req.auth.userId, never a path/body id —
 * so there is no authorization surface to abuse.
 *
 * Returns a delivery summary so the UI can surface the real outcome:
 *   { message, devicesTargeted, sent, failed, pruned, skippedReason? }
 *
 * skippedReason values the UI cares about:
 *   - "no-subscriptions"     → user hasn't enabled push on any device
 *   - "vapid-not-configured" → server misconfig, tell an admin
 *   - "error:<message>"      → unexpected backend error
 */
export const sendTestPush = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const summary = await sendWebPushNotification(
      userId,
      "Test notification",
      "If you see this, push notifications are working on this device.",
      {
        // Intentionally no 'type' — the preference opt-out map would block
        // the test if the user turned off that category. A test should
        // always attempt delivery.
        link: "/student/notifications",
        priority: "normal",
      },
    );

    return res.json({
      message:
        summary.sent > 0
          ? "Test push sent."
          : summary.skippedReason === "no-subscriptions"
            ? "No devices subscribed yet. Enable push on this device first."
            : summary.skippedReason === "vapid-not-configured" ||
                summary.skippedReason === "onesignal-not-configured" ||
                summary.skippedReason === "push-not-configured"
              ? "Push notifications are not configured on this server."
              : "Test push attempted but no deliveries succeeded.",
      ...summary,
    });
  } catch (err) {
    logger.error(`[PushSubscription] Test push failed: ${err.message}`);
    return res.status(500).json({ message: "Failed to send test push" });
  }
};
