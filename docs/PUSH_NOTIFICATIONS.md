# Push Notifications — Setup & Troubleshooting

This backend can send Web Push notifications (browser + installed PWA) so
students see shift assignments, schedule changes, and alerts even when
the app isn't open. This doc covers the one-time setup and the things that
typically go wrong.

## How it fits together

```
Manager creates/updates shift
        │
        ▼
shift.controller.js  →  notifyAssignedUserForShift()
        │
        ▼
notificationService.sendNotification()
        │
        ├── sendInAppNotification()   → always runs (writes to DB, bell icon)
        ├── sendEmailNotification()   → if SMTP configured
        ├── sendSmsNotification()     → if Twilio configured + enabled
        └── sendWebPushNotification() → if VAPID keys configured
                    │
                    ▼
            web-push library  →  FCM / APNs / Mozilla push service
                    │
                    ▼
            Service Worker (src/sw.js on the frontend)
                    │
                    ▼
            registration.showNotification(title, options)
```

In-app notifications work with zero configuration. Email, SMS, and web
push each need their own credentials set via env vars. Missing credentials
never crash the app — the sender for that channel just returns early.

## One-time VAPID setup

Web Push requires a VAPID keypair that identifies our server to the push
providers (Mozilla, Google, Apple). Generate it **once** and reuse it
across every environment that shares a database — otherwise subscriptions
stored in the DB against the old key become unusable.

### 1. Generate the keypair

```bash
npx web-push generate-vapid-keys
```

Output looks like:

```
=======================================
Public Key:
BJnM...long base64url...

Private Key:
o0v_...long base64url...
=======================================
```

### 2. Add three GitHub repo secrets

Go to **Settings → Secrets and variables → Actions** on the backend repo
and add:

| Secret               | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`   | The "Public Key" from step 1                               |
| `VAPID_PRIVATE_KEY`  | The "Private Key" from step 1                              |
| `VAPID_EMAIL`        | `mailto:` URL the push provider contacts you at, e.g. `mailto:admin@workerscheduling.eaglesoftwareteam.com` |

### 3. Re-deploy

Push any commit to `dev` (or trigger the `Deploy Backend` workflow
manually). The workflow writes all three values into the production
`.env` on boot. The service restarts with push enabled.

### 4. Verify end-to-end

1. Open the student app on a real phone/laptop.
2. Accept the "Enable push notifications" prompt (or go to
   **Settings → Push notifications** and toggle it on).
3. Tap **Send test notification**. You should get a banner on the
   device within a few seconds.
4. As a manager, create a new shift and assign it to that student.
   They should get a "New Shift Assigned" push.

## Troubleshooting

### "Push notifications are not configured on this server."

`GET /push-subscriptions/vapid-public-key` returned `503`. VAPID keys
aren't set in the process env. Check:

- GitHub repo secrets `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` exist
- The most recent deploy succeeded AFTER those secrets were added
- On the server: `sudo cat /home/ubuntu/nodeapps/sev2026/t2/.env | grep VAPID`

### Student has enabled push but isn't getting anything

Check the backend logs for the request that should have fired the push:

```
sudo journalctl -u workerscheduling-t2-backend -n 200 | grep -i push
```

You're looking for the `skippedReason` field on
`sendWebPushNotification`. Common values:

| skippedReason            | Meaning                                               | Fix                                           |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------- |
| `no-user-id`             | Called with `userId=null/undefined` — caller bug      | Check the code path that sent the notification |
| `vapid-not-configured`   | VAPID keys missing from env                           | See one-time setup above                      |
| `model-not-registered`   | `db.pushSubscription` not loaded — migration missing  | Run `npm run schema:sync` on the server       |
| `no-subscriptions`       | User hasn't enabled push on any device                | User must toggle it on in Settings            |
| `opted-out:<prefKey>`    | User unchecked that category in Settings              | Expected — user preference, don't override    |
| `error:<message>`        | Runtime failure — check logs for stack trace          | Depends on message                            |

If `sent > 0` in the summary but the device still didn't get anything:

- Browser permission may have been revoked — check
  `Notification.permission` in DevTools console; must be `"granted"`
- On iOS, push **only works when the app is installed to Home Screen**
  (Add to Home Screen from the Share sheet). Safari tabs can't receive
  push on iOS even in 2026.
- On macOS Safari, make sure Focus / Do Not Disturb isn't suppressing
  notifications.

### Test push delivered but shift-assignment push doesn't fire

Test push goes through the same `sendWebPushNotification` but
intentionally skips the per-type preference check. If the test works
but a real assignment doesn't, the user has likely turned off
**Schedule changes** in Settings → Notification Preferences. That
category gates:

- `shift_assignment`
- `shift_change`
- `shift_cancellation`
- `shift_reassignment`
- `schedule_published`

### Subscriptions piling up for users who stopped using a device

The backend prunes subscriptions automatically when the push provider
returns `410 Gone` or `404 Not Found` — next send attempt deletes the
stale row. No manual cleanup needed. If you want to wipe everything for
one user (e.g. account reset), `DELETE /push-subscriptions` with no
body removes all of their devices.

## Developer notes

- All push delivery flows through `sendWebPushNotification` in
  `app/services/notificationService.js`. Do NOT call `web-push.send`
  directly elsewhere — you'll lose the prune-on-410 behavior.
- `sendNotification` is the standard dispatcher. Callers pass `type`,
  `link`, and `priority` and never need to know which channels are on.
- The preference opt-out mapping lives in `NOTIFICATION_TYPE_TO_PREF_KEY`
  at the top of `notificationService.js`. Keep it in sync with any new
  notification types you add.
- The service worker at `sws-frontend/src/sw.js` is what actually paints
  the OS banner. If you change the notification payload shape on the
  backend, update the `push` event handler there too.
