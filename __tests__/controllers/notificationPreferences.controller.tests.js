// Unit tests for the self-serve notification preferences endpoints.
//
// Product rule: a logged-in user can read and update their own notification
// preferences. Strictly self-scoped — the userId comes from req.auth.userId,
// never a path or body parameter. The preferences map is the source of
// truth that sendWebPushNotification consults to suppress per-category
// pushes.
//
// NOTE: Uses `jest.unstable_mockModule` + dynamic imports because this
// repo runs Jest in ESM mode (`node --experimental-vm-modules`).

import { jest } from "@jest/globals";

const mockUser = {
  findByPk: jest.fn(),
};

jest.unstable_mockModule("app/models/index.js", () => ({
  __esModule: true,
  default: {
    user: mockUser,
  },
}));

jest.unstable_mockModule("app/services/notificationService.js", () => ({
  __esModule: true,
  // Mirror the real export so the controller's validation list matches what
  // the dispatcher actually checks. Keeping this here (not pulled from the
  // real module) keeps the unit test pure and avoids loading the dispatcher's
  // env-dependent transports during test.
  NOTIFICATION_PREFERENCE_KEYS: Object.freeze([
    "shiftReminders",
    "scheduleChanges",
    "swapRequests",
    "openShifts",
    "timeOff",
  ]),
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

const { getMyPreferences, updateMyPreferences } = await import(
  "app/controllers/notificationPreferences.controller.js"
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
  mockUser.findByPk.mockReset();
});

describe("GET /users/me/notification-preferences", () => {
  test("rejects unauthenticated callers with 401", async () => {
    const req = mockReq({ auth: undefined });
    const res = mockRes();

    await getMyPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockUser.findByPk).not.toHaveBeenCalled();
  });

  test("returns all-defaults (every key true) when the user has never saved preferences", async () => {
    mockUser.findByPk.mockResolvedValue({
      id: 42,
      notification_preferences: null,
    });
    const res = mockRes();

    await getMyPreferences(mockReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      preferences: {
        shiftReminders: true,
        scheduleChanges: true,
        swapRequests: true,
        openShifts: true,
        timeOff: true,
      },
    });
  });

  test("merges stored preferences over defaults so missing keys come back true", async () => {
    mockUser.findByPk.mockResolvedValue({
      id: 42,
      // Only one key stored — every other key should default to true.
      notification_preferences: JSON.stringify({ scheduleChanges: false }),
    });
    const res = mockRes();

    await getMyPreferences(mockReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      preferences: expect.objectContaining({
        scheduleChanges: false,
        shiftReminders: true,
        swapRequests: true,
        openShifts: true,
        timeOff: true,
      }),
    });
  });

  test("silently drops unknown legacy keys from stored value", async () => {
    mockUser.findByPk.mockResolvedValue({
      id: 42,
      notification_preferences: JSON.stringify({
        scheduleChanges: false,
        legacyEmailDigest: true, // unknown — must not appear in response
      }),
    });
    const res = mockRes();

    await getMyPreferences(mockReq(), res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.preferences.legacyEmailDigest).toBeUndefined();
    expect(payload.preferences.scheduleChanges).toBe(false);
  });

  test("returns defaults rather than crashing on malformed JSON in the column", async () => {
    mockUser.findByPk.mockResolvedValue({
      id: 42,
      notification_preferences: "not-valid-json{",
    });
    const res = mockRes();

    await getMyPreferences(mockReq(), res);

    expect(res.status).not.toHaveBeenCalled(); // defaults to 200
    expect(res.json).toHaveBeenCalledWith({
      preferences: expect.objectContaining({ scheduleChanges: true }),
    });
  });

  test("uses the authenticated userId, never trusts params/body", async () => {
    mockUser.findByPk.mockResolvedValue({
      id: 42,
      notification_preferences: null,
    });
    const req = mockReq({
      params: { userId: 99, id: 99 },
      body: { userId: 99 },
    });

    await getMyPreferences(req, mockRes());

    expect(mockUser.findByPk).toHaveBeenCalledWith(
      42,
      expect.any(Object),
    );
  });
});

describe("PUT /users/me/notification-preferences", () => {
  test("rejects unauthenticated callers with 401", async () => {
    const req = mockReq({
      auth: undefined,
      body: { preferences: { scheduleChanges: false } },
    });
    const res = mockRes();

    await updateMyPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockUser.findByPk).not.toHaveBeenCalled();
  });

  test("rejects requests missing the preferences object with 400", async () => {
    const res = mockRes();

    await updateMyPreferences(mockReq({ body: {} }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rejects an array under preferences (must be plain object)", async () => {
    const res = mockRes();

    await updateMyPreferences(mockReq({ body: { preferences: [] } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rejects non-boolean values for known keys with 400", async () => {
    const res = mockRes();

    await updateMyPreferences(
      mockReq({ body: { preferences: { scheduleChanges: "false" } } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Preference 'scheduleChanges' must be a boolean.",
    });
  });

  test("rejects payload with only unknown keys (every key dropped)", async () => {
    const res = mockRes();

    await updateMyPreferences(
      mockReq({ body: { preferences: { foo: true, bar: false } } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No known preference keys in request body.",
    });
  });

  test("merges partial PUT into stored preferences (does not reset other keys)", async () => {
    const update = jest.fn().mockResolvedValue();
    mockUser.findByPk.mockResolvedValue({
      id: 42,
      notification_preferences: JSON.stringify({
        scheduleChanges: false,
        swapRequests: false,
      }),
      update,
    });
    const res = mockRes();

    await updateMyPreferences(
      // Body only flips one key — the other stored falses must survive.
      mockReq({ body: { preferences: { scheduleChanges: true } } }),
      res,
    );

    expect(update).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(update.mock.calls[0][0].notification_preferences);
    expect(stored).toEqual({
      shiftReminders: true,
      scheduleChanges: true,
      swapRequests: false, // <-- preserved from prior storage
      openShifts: true,
      timeOff: true,
    });
    expect(res.json).toHaveBeenCalledWith({ preferences: stored });
  });

  test("silently drops unknown keys mixed with valid ones", async () => {
    const update = jest.fn().mockResolvedValue();
    mockUser.findByPk.mockResolvedValue({
      id: 42,
      notification_preferences: null,
      update,
    });

    await updateMyPreferences(
      mockReq({
        body: {
          preferences: {
            scheduleChanges: false,
            legacyEmailDigest: true, // unknown — must be dropped
          },
        },
      }),
      mockRes(),
    );

    const stored = JSON.parse(update.mock.calls[0][0].notification_preferences);
    expect(stored.legacyEmailDigest).toBeUndefined();
    expect(stored.scheduleChanges).toBe(false);
  });

  test("uses the authenticated userId, never trusts params/body for target", async () => {
    const update = jest.fn().mockResolvedValue();
    mockUser.findByPk.mockResolvedValue({
      id: 42,
      notification_preferences: null,
      update,
    });
    const req = mockReq({
      params: { userId: 99, id: 99 },
      body: {
        userId: 99,
        user_id: 99,
        preferences: { scheduleChanges: false },
      },
    });

    await updateMyPreferences(req, mockRes());

    expect(mockUser.findByPk).toHaveBeenCalledWith(42, expect.any(Object));
  });
});
