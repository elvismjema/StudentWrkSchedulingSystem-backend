// ---------------------------------------------------------------------------
// OneSignal Web Push provider.
//
// Sends push notifications via the OneSignal REST API instead of the self-hosted
// VAPID / web-push flow. OneSignal handles the service worker registration,
// subscription storage, iOS PWA quirks, retries, and multi-device delivery on
// our behalf — we simply identify the recipient by their OneSignal `external_id`
// (which we set to the User primary key on the frontend via OneSignal.login).
//
// This module exposes one function, `sendOneSignalNotification`, with the same
// return shape as `sendWebPushNotification` so it can slot in behind the same
// public API in notificationService.js.
//
// Docs: https://documentation.onesignal.com/reference/create-notification
// ---------------------------------------------------------------------------

import logger from "../config/logger.js";

/**
 * @returns {boolean} whether the OneSignal provider has the env vars it needs to run.
 */
export const isOneSignalConfigured = () =>
  Boolean(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY);

/**
 * Send a push notification to a single user via OneSignal.
 *
 * The recipient is matched by OneSignal `external_id` which MUST equal the
 * String(userId) set via `OneSignal.login(String(userId))` on the frontend.
 * If the user has no active OneSignal subscriptions (no devices registered)
 * OneSignal returns `errors.invalid_external_user_ids` — we treat that as
 * "no-subscriptions" rather than a failure.
 *
 * @param {number|string} userId - recipient user ID; will be stringified for external_id match
 * @param {string} title
 * @param {string} message
 * @param {object} [options]
 * @param {string} [options.link]        - deep link URL opened on click
 * @param {string} [options.type]        - notification type tag, used for collapsing
 * @param {string} [options.priority]    - "high" bumps urgency + requireInteraction
 * @returns {Promise<{sent:number, failed:number, pruned:number, devicesTargeted:number, failures:Array, skippedReason?:string, oneSignalId?:string}>}
 */
export const sendOneSignalNotification = async (userId, title, message, options = {}) => {
  const summary = {
    sent: 0,
    failed: 0,
    pruned: 0,
    devicesTargeted: 0,
    failures: [],
  };

  if (!userId) return { ...summary, skippedReason: "no-user-id" };
  if (!isOneSignalConfigured()) {
    return { ...summary, skippedReason: "onesignal-not-configured" };
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  const externalId = String(userId);

  // OneSignal notification payload.
  // https://documentation.onesignal.com/reference/create-notification
  const body = {
    app_id: appId,
    // Match by external_id alias (what we set via OneSignal.login on the frontend).
    include_aliases: { external_id: [externalId] },
    target_channel: "push",
    headings: { en: title },
    contents: { en: message },
    // url: opens when the user taps the push. Defaults to app root if missing.
    url: options.link || undefined,
    // web_push_topic collapses older pushes of the same "type" so users only
    // see the latest, mirroring our existing web-push tag behavior.
    web_push_topic: options.type || "oc-schedule",
    // High priority: request interaction + bump TTL so the push survives briefly
    // if the device is offline.
    priority: options.priority === "high" ? 10 : 5,
    ttl: options.priority === "high" ? 86400 : 21600, // 24h vs 6h
  };

  // Bound the API call so a slow OneSignal never hangs our response.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // Per OneSignal docs, use "Key" auth scheme with the REST API key.
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      summary.failed = 1;
      summary.failures.push({
        statusCode: res.status,
        message: data?.errors ? JSON.stringify(data.errors) : text || "unknown OneSignal error",
      });
      logger.warn(
        `[OneSignalPush] Delivery error for user ${userId}: HTTP ${res.status} ${JSON.stringify(data?.errors || data)}`,
      );
      return summary;
    }

    // OneSignal responds 200 with { id, recipients, external_id, errors? } even
    // when the user has no devices — in that case `recipients` is 0 and the
    // errors array contains "All included players are not subscribed".
    const recipients = typeof data.recipients === "number" ? data.recipients : 0;
    const noRecipients =
      recipients === 0 ||
      (Array.isArray(data.errors) &&
        data.errors.some((e) => typeof e === "string" && e.toLowerCase().includes("not subscribed")));

    if (noRecipients) {
      return { ...summary, skippedReason: "no-subscriptions", oneSignalId: data.id };
    }

    summary.sent = recipients;
    summary.devicesTargeted = recipients;
    summary.oneSignalId = data.id;
    logger.info(
      `[OneSignalPush] Sent to user ${userId} (external_id=${externalId}) recipients=${recipients} id=${data.id}`,
    );
    return summary;
  } catch (err) {
    summary.failed = 1;
    summary.failures.push({
      statusCode: err?.name === "AbortError" ? null : null,
      message: err?.name === "AbortError" ? "OneSignal request timed out after 8000ms" : err?.message || "unknown error",
    });
    logger.warn(`[OneSignalPush] Delivery exception for user ${userId}: ${err?.message || err}`);
    return summary;
  } finally {
    clearTimeout(timer);
  }
};
