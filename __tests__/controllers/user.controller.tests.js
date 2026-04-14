import { jest } from '@jest/globals';
const mockUserFindByPk = jest.fn();
const mockUserFindAll = jest.fn();
const mockUserFindOne = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserDestroy = jest.fn();

const mockShiftFindAll = jest.fn();
const mockShiftDestroy = jest.fn();
const mockSessionUpdate = jest.fn();

jest.mock("app/config/logger.js", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("app/models/index.js", () => ({
  __esModule: true,
  default: {
    user: {
      findByPk: mockUserFindByPk,
      findAll: mockUserFindAll,
      findOne: mockUserFindOne,
      create: mockUserCreate,
      update: mockUserUpdate,
      destroy: mockUserDestroy,
    },
    shift: {
      findAll: mockShiftFindAll,
      destroy: mockShiftDestroy,
    },
    session: {
      update: mockSessionUpdate,
    },
    Sequelize: {
      Op: {
        like: "like",
        gte: "gte",
        or: "or",
        eq: "eq",
        ne: "ne",
      },
    },
  },
}));

import controller from "app/controllers/user.controller.js";
const { deactivateUser } = controller;

const mockReq = (body = {}, params = {}, query = {}) => ({
  body,
  params,
  query,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockShiftFindAll.mockResolvedValue([]);
  mockShiftDestroy.mockResolvedValue(0);
  mockSessionUpdate.mockResolvedValue([0]);
});

describe("deactivate user", () => {
  it("warns when future shifts exist and removal was not requested", async () => {
    const mockUser = {
      id: 10,
      email: "student@oc.edu",
      is_active: true,
      deactivated_at: null,
      save: jest.fn(),
    };

    mockUserFindByPk.mockResolvedValue(mockUser);
    mockShiftFindAll.mockResolvedValue([
      {
        shift_id: 100,
        shift_date: "2026-04-10",
        start_time: "09:00",
        end_time: "12:00",
        department_id: 1,
        position_id: 2,
      },
    ]);

    const req = mockReq({}, { id: "10" });
    const res = mockRes();

    await deactivateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        requires_shift_removal: true,
        future_shift_count: 1,
      }),
    );
  });

  it("deactivates and removes future shifts when requested", async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    const mockUser = {
      id: 11,
      email: "worker@oc.edu",
      is_active: true,
      deactivated_at: null,
      save: mockSave,
    };

    mockUserFindByPk.mockResolvedValue(mockUser);
    mockShiftFindAll.mockResolvedValue([
      {
        shift_id: 200,
        shift_date: "2026-04-11",
        start_time: "13:00",
        end_time: "17:00",
        department_id: 1,
        position_id: 3,
      },
    ]);
    mockShiftDestroy.mockResolvedValue(1);

    const req = mockReq({ remove_future_shifts: true }, { id: "11" });
    const res = mockRes();

    await deactivateUser(req, res);

    expect(mockShiftDestroy).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
    expect(mockSessionUpdate).toHaveBeenCalledWith(
      { token: "" },
      expect.objectContaining({ where: { email: "worker@oc.edu" } }),
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          is_active: false,
          removed_future_shifts: 1,
        }),
      }),
    );
  });
});
