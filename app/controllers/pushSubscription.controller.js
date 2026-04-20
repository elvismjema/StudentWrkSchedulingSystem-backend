import db from "../models/index.js";
import logger from "../config/logger.js";

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
