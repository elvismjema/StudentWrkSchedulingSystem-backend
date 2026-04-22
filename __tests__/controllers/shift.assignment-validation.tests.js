// Unit tests for the shift-assignment eligibility validator.
//
// Exercised end-to-end through `updateShift`, which is the canonical
// manager-facing assignment path. The module-internal validators
// (validateClassScheduleConflict, validateNoUnavailableConflicts,
// validateApprovedTimeOffCoverage, validateAssignmentEligibility) are
// driven via the HTTP-shaped update endpoint.
//
// Product rule under test:
//   A manager can assign a shift to any department member UNLESS the
//   student has a class-schedule block, an "unavailable" window, or an
//   approved time-off covering the shift's date/time. Default-allow.
//
// NOTE: Uses `jest.unstable_mockModule` + dynamic imports because this
// repo runs Jest in ESM mode (`node --experimental-vm-modules`). The
// older `jest.mock` + static-import pattern is a silent no-op here.

import { jest } from "@jest/globals";

const mockShift = {
  findByPk: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
};
const mockUserDepartment = {
  findOne: jest.fn(),
  findAll: jest.fn(),
};
const mockAvailability = {
  findAll: jest.fn(),
};
const mockTimeOffRequest = {
  findOne: jest.fn(),
};
const mockShiftAudit = { create: jest.fn() };
const mockShiftAcknowledgement = { findOne: jest.fn(), create: jest.fn() };

jest.unstable_mockModule("app/models/index.js", () => ({
  __esModule: true,
  default: {
    shift: mockShift,
    userDepartment: mockUserDepartment,
    availability: mockAvailability,
    timeOffRequest: mockTimeOffRequest,
    shiftAudit: mockShiftAudit,
    shiftAcknowledgement: mockShiftAcknowledgement,
    user: {},
    department: {},
    position: {},
    scheduleTemplate: {},
    taskList: {},
    taskListItem: {},
  },
}));

jest.unstable_mockModule("app/services/notificationService.js", () => ({
  __esModule: true,
  sendNotification: jest.fn(),
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

const { updateShift } = await import("app/controllers/shift.controller.js");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

// Baseline: an existing published shift that we're trying to assign
// student #42 to, on Monday 2026-04-20 from 10:00-11:00.
const baselineShift = () => {
  const obj = {
    shift_id: 1,
    department_id: 7,
    position_id: 3,
    shift_date: "2026-04-20", // Monday (dayOfWeek = 1)
    start_time: "10:00:00",
    end_time: "11:00:00",
    assigned_user_id: null,
    is_recurring: false,
    is_published: true,
    created_by: 99,
  };
  obj.toJSON = function () { return { ...obj }; };
  obj.update = jest.fn(async (patch) => { Object.assign(obj, patch); return obj; });
  return obj;
};

const assignPayload = () => ({
  body: { assigned_user_id: 42 },
  params: { id: "1" },
  auth: { userId: 99 },
});

describe("shift assignment validation", () => {
  beforeEach(() => {
    // mockReset fully clears queued mockResolvedValueOnce entries (which
    // clearAllMocks does not), preventing cross-test pollution.
    mockShift.findByPk.mockReset();
    mockShift.update.mockReset();
    mockShift.findAll.mockReset();
    mockShift.create.mockReset();
    mockUserDepartment.findOne.mockReset();
    mockUserDepartment.findAll.mockReset();
    mockAvailability.findAll.mockReset();
    mockTimeOffRequest.findOne.mockReset();
    mockShiftAudit.create.mockReset();
    mockShiftAcknowledgement.findOne.mockReset();
    mockShiftAcknowledgement.create.mockReset();
    // Department membership check passes by default.
    mockUserDepartment.findOne.mockResolvedValue({
      user_id: 42, department_id: 7, position_id: 3,
      role_id: 5, is_active: true,
    });
    // No time-off, no competing shifts (for buffer check), no other shifts.
    mockTimeOffRequest.findOne.mockResolvedValue(null);
    mockShift.findAll.mockResolvedValue([]);
    mockShift.update.mockResolvedValue([1]);
    mockShiftAudit.create.mockResolvedValue({});
    mockShiftAcknowledgement.findOne.mockResolvedValue(null);
    mockShiftAcknowledgement.create.mockResolvedValue({});
  });

  test("allows assignment when student has no class, no unavailable, no time-off", async () => {
    mockShift.findByPk.mockResolvedValue(baselineShift());
    mockAvailability.findAll.mockResolvedValue([]);
    const res = mockRes();

    await updateShift(assignPayload(), res);

    expect(res.status).not.toHaveBeenCalledWith(409);
  });

  test("blocks assignment when student already has an overlapping shift", async () => {
    mockShift.findByPk.mockResolvedValue(baselineShift());
    mockShift.findAll.mockResolvedValueOnce([
      {
        shift_id: 22,
        assigned_user_id: 42,
        shift_date: "2026-04-20",
        start_time: "10:30:00",
        end_time: "12:00:00",
        trade_status: null,
      },
    ]);
    mockAvailability.findAll.mockResolvedValue([]);

    const res = mockRes();
    await updateShift(assignPayload(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.send.mock.calls[0][0];
    expect(payload.conflictType).toBe("shift_overlap");
    expect(payload.message).toBe("This student already has a shift at this time.");
  });

  test("blocks assignment during a class-schedule window", async () => {
    mockShift.findByPk.mockResolvedValue(baselineShift());
    // The orchestrator calls validateApprovedTimeOffCoverage first (no
    // Availability.findAll), then validateClassScheduleConflict (1st call),
    // then validateNoUnavailableConflicts (2nd call).
    mockAvailability.findAll
      .mockResolvedValueOnce([
        {
          userId: 42,
          dayOfWeek: 1, // Monday
          isRecurring: true,
          startTime: "09:00:00",
          endTime: "10:30:00", // overlaps 10:00-11:00
          sourceType: "class_schedule",
          recurrencePattern: "class_schedule",
          isSystemManaged: true,
        },
      ])
      .mockResolvedValueOnce([]);

    const res = mockRes();
    await updateShift(assignPayload(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.send.mock.calls[0][0];
    expect(payload.conflictType).toBe("class_schedule_conflict");
    expect(payload.message).toMatch(/class/i);
  });

  test("blocks assignment during an approved 'unavailable' window", async () => {
    mockShift.findByPk.mockResolvedValue(baselineShift());
    // Class check empty; unavailable check hits.
    mockAvailability.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          userId: 42,
          dayOfWeek: 1,
          isRecurring: true,
          startTime: "09:30:00",
          endTime: "12:00:00",
          availabilityType: "unavailable",
          requestStatus: "approved",
        },
      ]);

    const res = mockRes();
    await updateShift(assignPayload(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.send.mock.calls[0][0];
    expect(payload.conflictType).toBe("availability_conflict");
    expect(payload.message).toMatch(/unavailable/i);
  });

  test("blocks assignment when student has approved time-off covering the shift date", async () => {
    mockShift.findByPk.mockResolvedValue(baselineShift());
    mockAvailability.findAll.mockResolvedValue([]);
    mockTimeOffRequest.findOne.mockResolvedValue({
      user_id: 42, status: "approved",
      start_date: "2026-04-19", end_date: "2026-04-22",
    });

    const res = mockRes();
    await updateShift(assignPayload(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.send.mock.calls[0][0];
    expect(payload.message).toMatch(/time[- ]?off|approved/i);
  });

  test("class-schedule query matches all three class markers", async () => {
    // Regression guard for the bug where the query only checked two of
    // three markers and missed rows with just recurrencePattern.
    mockShift.findByPk.mockResolvedValue(baselineShift());
    mockAvailability.findAll.mockResolvedValue([]);

    const res = mockRes();
    await updateShift(assignPayload(), res);

    // Orchestrator order: time-off (no Availability call), then class
    // (Availability call #1), then unavailable (#2). We inspect call #1.
    expect(mockAvailability.findAll.mock.calls.length).toBeGreaterThanOrEqual(1);
    const firstCallArgs = mockAvailability.findAll.mock.calls[0][0];
    // Sequelize uses Op symbols as keys; util.inspect surfaces them so
    // we can regex-match the serialized where clause for the three
    // class-schedule markers.
    const util = await import("util");
    const serialized = util.inspect(firstCallArgs, { depth: null });
    expect(serialized).toContain("class_schedule");
    expect(serialized).toContain("recurrencePattern");
    expect(serialized).toContain("isSystemManaged");
  });

  // ---------------------------------------------------------------------
  // Regression coverage for the 'pending unavailable' product-rule fix.
  //
  // Before the fix, validateNoUnavailableConflicts only blocked on rows
  // with requestStatus = 'approved'. The availability controller creates
  // student self-declared blocks with status 'pending' by default, so a
  // student could mark themselves unavailable and a manager could still
  // assign a shift over it. The filter is now 'not rejected or
  // cancelled', which flips the default to block-on-pending while still
  // honoring the approval workflow's explicit negative outcomes.
  // ---------------------------------------------------------------------

  test("blocks assignment during a student-declared 'pending' unavailable window", async () => {
    mockShift.findByPk.mockResolvedValue(baselineShift());
    mockAvailability.findAll
      .mockResolvedValueOnce([]) // class check
      .mockResolvedValueOnce([
        {
          userId: 42,
          dayOfWeek: 1,
          isRecurring: true,
          startTime: "09:30:00",
          endTime: "12:00:00",
          availabilityType: "unavailable",
          requestStatus: "pending", // ← not yet approved by a manager
        },
      ]);

    const res = mockRes();
    await updateShift(assignPayload(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.send.mock.calls[0][0];
    expect(payload.conflictType).toBe("availability_conflict");
    expect(payload.message).toMatch(/unavailable/i);
  });

  // Rejected / cancelled rows are excluded at the database layer by the
  // where clause (requestStatus: { [Op.notIn]: ['rejected','cancelled'] }).
  // We verify the filter shape directly further down
  // ("unavailable query filters out 'rejected' and 'cancelled' at the
  // DB layer") rather than simulating it in-memory here — the mock
  // isn't a real Sequelize instance, so feeding it rejected rows would
  // only exercise the JS-side overlap check, which doesn't know about
  // status at all. The SQL-shape test is the authoritative guard.

  test("does not over-block: non-overlapping pending unavailable row is ignored", async () => {
    // Guard against the failure mode where the fix accidentally widened
    // the conflict check so much that any same-day unavailable row
    // blocks regardless of time. The shift is 10:00-11:00; the
    // unavailable block is 14:00-16:00 — no overlap, must still allow.
    mockShift.findByPk.mockResolvedValue(baselineShift());
    mockAvailability.findAll
      .mockResolvedValueOnce([]) // class check
      .mockResolvedValueOnce([
        {
          userId: 42,
          dayOfWeek: 1,
          isRecurring: true,
          startTime: "14:00:00",
          endTime: "16:00:00",
          availabilityType: "unavailable",
          requestStatus: "pending",
        },
      ]);

    const res = mockRes();
    await updateShift(assignPayload(), res);

    expect(res.status).not.toHaveBeenCalledWith(409);
  });

  test("unavailable query filters out 'rejected' and 'cancelled' at the DB layer", async () => {
    // Verifies the SQL-level filter shape so we catch accidental
    // regressions to the old allowlist behaviour or a filter swap.
    mockShift.findByPk.mockResolvedValue(baselineShift());
    mockAvailability.findAll.mockResolvedValue([]);

    const res = mockRes();
    await updateShift(assignPayload(), res);

    // Orchestrator order: time-off (no Availability call), class (#1),
    // unavailable (#2). Inspect call #2's where clause.
    expect(mockAvailability.findAll.mock.calls.length).toBeGreaterThanOrEqual(2);
    const unavailableCallArgs = mockAvailability.findAll.mock.calls[1][0];
    const util = await import("util");
    const serialized = util.inspect(unavailableCallArgs, { depth: null });

    // Must reference both excluded statuses...
    expect(serialized).toContain("rejected");
    expect(serialized).toContain("cancelled");
    // ...and must NOT be the old approved-only filter.
    expect(serialized).not.toMatch(/requestStatus:\s*'approved'/);
  });

  test("refuses to silently pass when shift date is malformed", async () => {
    // Guard against the failure mode where an invalid shift date caused
    // validators to short-circuit as valid:true.
    const badShift = baselineShift();
    badShift.shift_date = "not-a-date";
    mockShift.findByPk.mockResolvedValue(badShift);
    mockAvailability.findAll.mockResolvedValue([]);

    const res = mockRes();
    await updateShift(assignPayload(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.send.mock.calls[0][0];
    expect(payload.conflictType).toBe("invalid_shift_window");
  });
});
