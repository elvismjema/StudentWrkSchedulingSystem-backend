// Unit tests for the self-serve test-push endpoint.
//
// Product rule: a logged-in user can hit POST /push-subscriptions/me/test and
// receive a canned push on every device they've subscribed. The endpoint is
// strictly self-scoped — the recipient id comes from req.auth.userId, never
// from a path or body parameter.
//
// NOTE: Uses `jest.unstable_mockModule` + dynamic imports because this repo
// runs Jest in ESM mode (`node --experimental-vm-modules`).

import { jest } from "@jest/globals";

const mockSendWebPush = jest.fn();

jest.unstable_mockModule("app/services/notificationService.js", () => ({
  __esModule: true,
  sendWebPushNotification: mockSendWebPush,
}));

jest.unstable_mockModule("app/models/index.js", () => ({
  __esModule: true,
  default: {
    pushSubscription: {},
    user: {},
  },
}));

jest.unstable_mockModule("app/config/logger.js", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { sendTestPush } = await import(
  "app/controllers/pushSubscription.controller.js"
);

const mockReq = (overrides = {}) => ({
  auth: { userId: 42 },
  body: {},
  params: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  mockSendWebPush.mockReset();
});

describe("POST /push-subscriptions/me/test", () => {
  test("rejects unauthenticated callers with 401", async () => {
    const req = mockReq({ auth: undefined });
    const res = mockRes();

    await sendTestPush(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockSendWebPush).not.toHaveBeenCalled();
  });

  test("uses the authenticated userId — never trusts body or params", async () => {
    // Attacker-style payload: body and params try to redirect the push to
    // user 99. The controller must ignore them and use req.auth.userId.
    const req = mockReq({
      body: { userId: 99, user_id: 99 },
      params: { userId: 99, id: 99 },
    });
    const res = mockRes();
    mockSendWebPush.mockResolvedValue({
      sent: 1,
      failed: 0,
      pruned: 0,
      devicesTargeted: 1,
    });

    await sendTestPush(req, res);

    expect(mockSendWebPush).toHaveBeenCalledTimes(1);
    expect(mockSendWebPush.mock.calls[0][0]).toBe(42);
  });

  test("returns a success message and delivery summary when at least one device received the push", async () => {
    const req = mockReq();
    const res = mockRes();
    mockSendWebPush.mockResolvedValue({
      sent: 2,
      failed: 0,
      pruned: 1,
      devicesTargeted: 3,
    });

    await sendTestPush(req, res);

    expect(res.status).not.toHaveBeenCalled(); // defaults to 200
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Test push sent.",
        sent: 2,
        failed: 0,
        pruned: 1,
        devicesTargeted: 3,
      }),
    );
  });

  test("returns a human-friendly 'no devices' message when the user has no subscriptions", async () => {
    const req = mockReq();
    const res = mockRes();
    mockSendWebPush.mockResolvedValue({
      sent: 0,
      failed: 0,
      pruned: 0,
      devicesTargeted: 0,
      skippedReason: "no-subscriptions",
    });

    await sendTestPush(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "No devices subscribed yet. Enable push on this device first.",
        sent: 0,
        devicesTargeted: 0,
      }),
    );
  });

  test("surfaces VAPID-not-configured as an admin-actionable message", async () => {
    const req = mockReq();
    const res = mockRes();
    mockSendWebPush.mockResolvedValue({
      sent: 0,
      failed: 0,
      pruned: 0,
      devicesTargeted: 0,
      skippedReason: "vapid-not-configured",
    });

    await sendTestPush(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Push notifications are not configured on this server.",
      }),
    );
  });

  test("does not pass a notification type — a test must bypass category opt-out", async () => {
    // If the controller passed a type, sendWebPushNotification would map it
    // to a preference key and silently skip when the user had toggled that
    // category off. A test push should always attempt delivery regardless
    // of saved preferences.
    const req = mockReq();
    const res = mockRes();
    mockSendWebPush.mockResolvedValue({
      sent: 1,
      failed: 0,
      pruned: 0,
      devicesTargeted: 1,
    });

    await sendTestPush(req, res);

    const options = mockSendWebPush.mock.calls[0][3];
    expect(options.type).toBeUndefined();
  });
});
