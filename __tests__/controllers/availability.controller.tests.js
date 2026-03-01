const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindByPk = jest.fn();
const mockFindOne = jest.fn();
const mockUpdate = jest.fn();
const mockDestroy = jest.fn();

jest.mock("../../app/models/index.js", () => ({
  __esModule: true,
  default: {
    availability: {
      create: mockCreate,
      findAll: mockFindAll,
      findByPk: mockFindByPk,
      findOne: mockFindOne,
      update: mockUpdate,
      destroy: mockDestroy,
    },
    user: {},
    Sequelize: {
      Op: {
        lt: "lt",
        gt: "gt",
        and: "and",
        ne: "ne",
        gte: "gte",
        lte: "lte",
      },
    },
  },
}));

jest.mock("../../app/config/logger.js", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const availabilityController = require("../../app/controllers/availability.controller.js").default;

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
});

describe("availability create", () => {
  it("Given: valid availability data, When: create is called, Then: availability is persisted", async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 7, userId: 1, startTime: "09:00:00", endTime: "11:00:00" });
    const req = mockReq({
      userId: 1,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "11:00",
    });
    const res = mockRes();

    await availabilityController.create(req, res);

    expect(mockCreate).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it("Given: invalid time format, When: create is called, Then: request is rejected with 400", async () => {
    const req = mockReq({
      userId: 1,
      dayOfWeek: 2,
      startTime: "invalid",
      endTime: "11:00",
    });
    const res = mockRes();

    await availabilityController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("Given: overlapping availability exists, When: create is called, Then: request is rejected with 409", async () => {
    mockFindOne.mockResolvedValue({ id: 2 });
    const req = mockReq({
      userId: 1,
      dayOfWeek: 2,
      startTime: "10:00",
      endTime: "12:00",
    });
    const res = mockRes();

    await availabilityController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("availability update", () => {
  it("Given: existing availability, When: update start/end is called, Then: record is updated without creating duplicates", async () => {
    mockFindByPk.mockResolvedValue({
      id: 1,
      userId: 1,
      startTime: "08:00:00",
      endTime: "10:00:00",
      dayOfWeek: 1,
      specificDate: null,
    });
    mockFindOne.mockResolvedValue(null);
    mockUpdate.mockResolvedValue([1]);

    const req = mockReq(
      { startTime: "09:00", endTime: "11:00" },
      { id: "1" },
    );
    const res = mockRes();

    await availabilityController.update(req, res);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Availability was updated successfully." }),
    );
  });

  it("Given: invalid update time format, When: update is called, Then: request is rejected with 400", async () => {
    mockFindByPk.mockResolvedValue({
      id: 1,
      userId: 1,
      startTime: "08:00:00",
      endTime: "10:00:00",
      dayOfWeek: 1,
      specificDate: null,
    });
    const req = mockReq({ startTime: "99:99" }, { id: "1" });
    const res = mockRes();

    await availabilityController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("availability list", () => {
  it("Given: no availabilities, When: manager requests all availabilities, Then: empty array is returned with 200", async () => {
    mockFindAll.mockResolvedValue([]);
    const req = mockReq({}, {}, {});
    const res = mockRes();

    await availabilityController.findAll(req, res);

    expect(res.send).toHaveBeenCalledWith([]);
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("Given: manager applies list filters, When: findAll is called, Then: availability query uses filter parameters", async () => {
    mockFindAll.mockResolvedValue([]);
    const req = mockReq({}, {}, {
      userId: "3",
      departmentId: "2",
      requestStatus: "pending",
      availabilityType: "available",
      dayOfWeek: "1",
      specificDate: "2026-03-01",
      startTimeFrom: "08:00",
      startTimeTo: "12:00",
    });
    const res = mockRes();

    await availabilityController.findAll(req, res);

    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "3",
          departmentId: "2",
          requestStatus: "pending",
          availabilityType: "available",
          dayOfWeek: "1",
          specificDate: "2026-03-01",
        }),
      }),
    );
    expect(res.send).toHaveBeenCalledWith([]);
  });

  it("Given: invalid filter time format, When: manager requests list, Then: request is rejected with 400", async () => {
    const req = mockReq({}, {}, {
      startTimeFrom: "bad-time",
    });
    const res = mockRes();

    await availabilityController.findAll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it("Given: overlapping availability records exist, When: manager requests list, Then: response flags conflicts", async () => {
    mockFindAll.mockResolvedValue([
      { id: 1, userId: 8, dayOfWeek: 2, specificDate: null, startTime: "09:00:00", endTime: "11:00:00" },
      { id: 2, userId: 8, dayOfWeek: 2, specificDate: null, startTime: "10:00:00", endTime: "12:00:00" },
      { id: 3, userId: 8, dayOfWeek: 3, specificDate: null, startTime: "10:00:00", endTime: "12:00:00" },
    ]);

    const req = mockReq({}, {}, {});
    const res = mockRes();

    await availabilityController.findAll(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, hasConflict: true }),
        expect.objectContaining({ id: 2, hasConflict: true }),
        expect.objectContaining({ id: 3, hasConflict: false }),
      ]),
    );
  });
});
