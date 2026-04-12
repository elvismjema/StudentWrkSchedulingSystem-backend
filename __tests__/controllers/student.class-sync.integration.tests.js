import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

const mockAvailability = {
  findAll: jest.fn(),
  destroy: jest.fn(),
  bulkCreate: jest.fn(),
  count: jest.fn(),
  max: jest.fn(),
};

const mockUser = {
  findByPk: jest.fn(),
};

const mockDb = {
  Sequelize: { Op: { or: Symbol('or') } },
  sequelize: {
    transaction: jest.fn().mockResolvedValue(mockTransaction),
  },
  availability: mockAvailability,
  user: mockUser,
  shift: {},
  position: {},
  department: {},
  clockRecord: {},
  breakRecord: {},
  timeOffRequest: {},
  shiftSwapRequest: {},
  timeDiscrepancy: {},
};

const mockFetchStudentSchedule = jest.fn();
const mockNormalizeScheduleToAvailabilityBlocks = jest.fn();

const modelsModulePath = '../app/models/index.js';
const serviceModulePath = '../app/services/studentClassSchedule.service.js';
const loggerModulePath = '../app/config/logger.js';
const controllerModulePath = '../../app/controllers/student.controller.js';

await jest.unstable_mockModule(modelsModulePath, () => ({
  __esModule: true,
  default: mockDb,
}));

await jest.unstable_mockModule(serviceModulePath, () => ({
  __esModule: true,
  fetchStudentSchedule: mockFetchStudentSchedule,
  normalizeScheduleToAvailabilityBlocks: mockNormalizeScheduleToAvailabilityBlocks,
}));

await jest.unstable_mockModule(loggerModulePath, () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const {
  syncClassScheduleAvailability,
  updateMyAvailability,
  getClassScheduleSyncStatus,
} = await import(controllerModulePath);

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const getPayload = (res) => res.json.mock.calls.at(-1)?.[0] || null;

describe('student class sync + overlap prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.sequelize.transaction.mockResolvedValue(mockTransaction);
    mockTransaction.commit.mockResolvedValue(undefined);
    mockTransaction.rollback.mockResolvedValue(undefined);
  });

  it('A3: keeps sync idempotent across repeated runs', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 11, email: 'student@school.edu' });
    mockFetchStudentSchedule.mockResolvedValue({
      termCode: '2026SP',
      payload: { Success: 'True', Courses: [] },
    });

    const normalizedBlocks = [
      {
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '10:00:00',
        availabilityType: 'unavailable',
        sourceType: 'class_schedule',
        sourceRef: 'CS-101:M:09:00:00-10:00:00',
      },
      {
        dayOfWeek: 3,
        startTime: '09:00:00',
        endTime: '10:00:00',
        availabilityType: 'unavailable',
        sourceType: 'class_schedule',
        sourceRef: 'CS-101:W:09:00:00-10:00:00',
      },
    ];
    mockNormalizeScheduleToAvailabilityBlocks.mockReturnValue(normalizedBlocks);

    // First sync: no existing class blocks
    mockAvailability.findAll
      .mockResolvedValueOnce([])
      // Second sync: records already exist (idempotent no-op)
      .mockResolvedValueOnce([
        { id: 101, ...normalizedBlocks[0], recurrencePattern: 'class_schedule' },
        { id: 102, ...normalizedBlocks[1], recurrencePattern: 'class_schedule' },
      ]);

    mockAvailability.bulkCreate.mockResolvedValue([]);
    mockAvailability.destroy.mockResolvedValue(0);

    const req = { auth: { userId: 11, email: 'student@school.edu' }, body: { termCode: '2026SP' } };

    const firstRes = mockRes();
    await syncClassScheduleAvailability(req, firstRes);

    expect(firstRes.status).toHaveBeenCalledWith(200);
    expect(getPayload(firstRes).data).toEqual(
      expect.objectContaining({ created: 2, deleted: 0, unchanged: 0, termCode: '2026SP' })
    );

    const secondRes = mockRes();
    await syncClassScheduleAvailability(req, secondRes);

    expect(secondRes.status).toHaveBeenCalledWith(200);
    expect(getPayload(secondRes).data).toEqual(
      expect.objectContaining({ created: 0, deleted: 0, unchanged: 2, termCode: '2026SP' })
    );

    expect(mockAvailability.bulkCreate).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(2);
  });

  it('A3: blocks manual availability that overlaps locked class schedule time', async () => {
    mockAvailability.findAll.mockResolvedValue([
      {
        id: 501,
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '10:00:00',
        sourceType: 'class_schedule',
        recurrencePattern: 'class_schedule',
        isSystemManaged: true,
      },
    ]);

    const req = {
      auth: { userId: 33 },
      body: {
        entries: [
          {
            dayOfWeek: 1,
            startTime: '09:30:00',
            endTime: '10:30:00',
            availabilityType: 'available',
          },
        ],
      },
    };
    const res = mockRes();

    await updateMyAvailability(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = getPayload(res);
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('Availability overlaps locked class time');

    expect(mockAvailability.destroy).not.toHaveBeenCalled();
    expect(mockAvailability.bulkCreate).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  it('A3: returns derived class sync status from availability records', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 44 });
    mockAvailability.count.mockResolvedValue(2);
    mockAvailability.max.mockResolvedValue('2026-04-12T11:00:00.000Z');

    const req = { auth: { userId: 44 } };
    const res = mockRes();

    await getClassScheduleSyncStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getPayload(res).data).toEqual({
      status: 'success',
      lastSyncedAt: '2026-04-12T11:00:00.000Z',
      error: null,
    });

    mockAvailability.count.mockResolvedValueOnce(0);
    mockAvailability.max.mockResolvedValueOnce(null);
    const emptyRes = mockRes();

    await getClassScheduleSyncStatus(req, emptyRes);

    expect(emptyRes.status).toHaveBeenCalledWith(200);
    expect(getPayload(emptyRes).data).toEqual({
      status: 'never_synced',
      lastSyncedAt: null,
      error: null,
    });
  });
});
