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
 * OneSignal returns a response WITHOUT an `id` and/or with the alias listed
 * under `errors.invalid_aliases.external_id` — we treat either as
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

    // OneSignal's documented 200 response shape is:
    //   { id, external_id?, errors? }
    // Per the official docs (https://documentation.onesignal.com/reference/
    // push-notification):
    //   - A non-empty `id` means the notification was created and will be
    //     delivered to the matched subscriptions.
    //   - A missing or empty `id` means the message was NOT created — usually
    //     because there were no valid subscriptions in the target audience.
    //   - When targeting by alias, unmatched IDs come back under
    //     `errors.invalid_aliases.external_id` (array of the aliases that
    //     didn't match any user). Unmatched subscription IDs come back under
    //     `errors.invalid_player_ids`.
    // The REST API does NOT return a `recipients` count on this endpoint
    // (that's the /notifications?c=... list endpoint, not the create one),
    // so we infer delivery from `id` presence + the error structure instead.
    const invalidExternalIds = Array.isArray(data?.errors?.invalid_aliases?.external_id)
      ? data.errors.invalid_aliases.external_id
      : [];
    const invalidPlayerIds = Array.isArray(data?.errors?.invalid_player_ids)
      ? data.errors.invalid_player_ids
      : [];
    const aliasUnmatched = invalidExternalIds.some(
      (e) => typeof e === "string" && e.includes(externalId),
    );

    if (!data.id || aliasUnmatched || invalidPlayerIds.length > 0) {
      logger.info(
        `[OneSignalPush] No delivery for user ${userId} (external_id=${externalId}): ${
          data.id ? "invalid ids in response" : "no notification id returned"
        } errors=${JSON.stringify(data?.errors || {})}`,
      );
      return { ...summary, skippedReason: "no-subscriptions", oneSignalId: data.id };
    }

    // OneSignal accepted the notification. We don't know the exact device
    // count from this endpoint — set devicesTargeted to 1 for the matched
    // user so the UI sees a non-zero delivery.
    summary.sent = 1;
    summary.devicesTargeted = 1;
    summary.oneSignalId = data.id;
    logger.info(
      `[OneSignalPush] Sent to user ${userId} (external_id=${externalId}) id=${data.id}`,
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
