/**
 * Notification Preferences Controller
 *
 * Strictly self-scoped read/write of the per-category notification opt-out
 * map stored on `users.notification_preferences` (TEXT, JSON-encoded).
 *
 * The push dispatcher (sendWebPushNotification in notificationService.js)
 * reads this exact column to decide whether to suppress a push for a given
 * notification type. Until this endpoint shipped the frontend was writing
 * preferences to a generic profile field that nothing read, so the toggles
 * in Settings looked like they worked but had no effect on delivery.
 *
 * All requests use req.auth.userId. There is intentionally no manager- or
 * admin-scoped variant — no role should be flipping someone else's
 * notification preferences.
 */

import db from "../models/index.js";
import logger from "../config/logger.js";
import { NOTIFICATION_PREFERENCE_KEYS } from "../services/notificationService.js";

const User = db.user;

// Default shape returned when a user has never saved preferences. Every
// known key defaults to `true` (opted in) — matches the UI's initial state
// and the dispatcher's behavior, which only suppresses on an explicit `false`.
const DEFAULT_PREFERENCES = Object.freeze(
  NOTIFICATION_PREFERENCE_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {}),
);

const parseStored = (raw) => {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PREFERENCES };
    // Only surface keys we recognize — drops legacy/junk keys silently.
    const clean = { ...DEFAULT_PREFERENCES };
    for (const key of NOTIFICATION_PREFERENCE_KEYS) {
      if (typeof parsed[key] === "boolean") clean[key] = parsed[key];
    }
    return clean;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

/**
 * GET /users/me/notification-preferences
 * Returns the current user's preference map, with defaults filled in.
 */
export const getMyPreferences = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findByPk(userId, {
      attributes: ["id", "notification_preferences"],
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ preferences: parseStored(user.notification_preferences) });
  } catch (err) {
    logger.error(`[NotificationPreferences] GET failed: ${err.message}`);
    return res.status(500).json({ message: "Failed to load preferences" });
  }
};

/**
 * PUT /users/me/notification-preferences
 * Body: { preferences: { <key>: boolean, ... } }
 *
 * Validation rules:
 *   - At least one known key required (empty/missing object = 400, not a no-op
 *     erase, since the dispatcher would then treat every category as opted-in
 *     and that is almost never the user's intent).
 *   - Unknown keys are dropped silently with a debug log (forward-compat: lets
 *     a future frontend ship a new key before the backend ships its
 *     validation update).
 *   - Non-boolean values for known keys are rejected with 400 (catches
 *     accidental string "true"/"false" payloads early).
 */
export const updateMyPreferences = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const incoming = req.body?.preferences;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      return res.status(400).json({
        message: "Body must include a 'preferences' object.",
      });
    }

    const merged = { ...DEFAULT_PREFERENCES };
    let touchedAny = false;
    const droppedKeys = [];
    for (const [key, value] of Object.entries(incoming)) {
      if (!NOTIFICATION_PREFERENCE_KEYS.includes(key)) {
        droppedKeys.push(key);
        continue;
      }
      if (typeof value !== "boolean") {
        return res.status(400).json({
          message: `Preference '${key}' must be a boolean.`,
        });
      }
      merged[key] = value;
      touchedAny = true;
    }

    if (!touchedAny) {
      return res.status(400).json({
        message: "No known preference keys in request body.",
      });
    }

    if (droppedKeys.length > 0) {
      logger.debug(
        `[NotificationPreferences] Dropped unknown keys for user ${userId}: ${droppedKeys.join(", ")}`,
      );
    }

    // Load existing first so a partial PUT (e.g. body only contains
    // { scheduleChanges: false }) doesn't reset every other category back
    // to the default. Merge incoming over stored over defaults.
    const user = await User.findByPk(userId, {
      attributes: ["id", "notification_preferences"],
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const stored = parseStored(user.notification_preferences);
    const next = { ...stored, ...sanitizeIncoming(incoming) };

    await user.update({ notification_preferences: JSON.stringify(next) });

    return res.json({ preferences: next });
  } catch (err) {
    logger.error(`[NotificationPreferences] PUT failed: ${err.message}`);
    return res.status(500).json({ message: "Failed to save preferences" });
  }
};

// Filters incoming to only known boolean keys. Mirrors the validation in
// updateMyPreferences but returns a clean object for spread-merge.
const sanitizeIncoming = (incoming) => {
  const clean = {};
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    if (typeof incoming[key] === "boolean") clean[key] = incoming[key];
  }
  return clean;
};
