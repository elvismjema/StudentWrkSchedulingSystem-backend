const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindByPk = jest.fn();
const mockDeptFindByPk = jest.fn();

jest.mock("../../app/models/index.js", () => ({
  __esModule: true,
  default: {
    departmentHours: {
      create: mockCreate,
      findAll: mockFindAll,
      findByPk: mockFindByPk,
    },
    department: {
      findByPk: mockDeptFindByPk,
    },
    position: {},
  },
}));

const {
  addDepartmentHours,
  listDepartmentHours,
  updateDepartmentHours,
  deleteDepartmentHours,
} = require("../../app/controllers/department_hours.controller.js");

const mockReq = (body = {}, params = {}, query = {}) => ({
  body,
  params,
  query,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const testDepartmentHours = {
  hours_id: 1,
  department_id: 1,
  day_of_week: 1,
  open_time: "08:00:00",
  close_time: "17:00:00",
  specific_date: null,
  is_default: true,
};

const testDepartment = {
  department_id: 1,
  department_name: "Computer Science",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("add department hours", () => {
  it("Given: The backend is running, When: I make a call to add Department_Hours, Then: Department_Hours are added to the database", async () => {
    mockDeptFindByPk.mockResolvedValue(testDepartment);
    mockCreate.mockResolvedValue(testDepartmentHours);
    const req = mockReq({
      department_id: 1,
      day_of_week: 1,
      open_time: "08:00:00",
      close_time: "17:00:00",
      is_default: true,
    });
    const res = mockRes();

    await addDepartmentHours(req, res);

    expect(mockDeptFindByPk).toHaveBeenCalledWith(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ department_id: 1, day_of_week: 1 })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: testDepartmentHours })
    );
  });

  it("returns 400 when department_id is missing", async () => {
    const req = mockReq({ day_of_week: 1 });
    const res = mockRes();

    await addDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when department does not exist", async () => {
    mockDeptFindByPk.mockResolvedValue(null);
    const req = mockReq({ department_id: 999 });
    const res = mockRes();

    await addDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockDeptFindByPk.mockResolvedValue(testDepartment);
    mockCreate.mockRejectedValue(new Error("Database error"));
    const req = mockReq({ department_id: 1 });
    const res = mockRes();

    await addDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("update department hours", () => {
  it("Given: The backend is running, When: I make a call to update Department_Hours, Then: Department_Hours are updated in the database", async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    mockFindByPk.mockResolvedValue({
      ...testDepartmentHours,
      save: mockSave,
    });
    const req = mockReq(
      { open_time: "09:00:00", close_time: "18:00:00" },
      { id: "1" }
    );
    const res = mockRes();

    await updateDepartmentHours(req, res);

    expect(mockFindByPk).toHaveBeenCalledWith("1");
    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it("returns 404 when department hours not found", async () => {
    mockFindByPk.mockResolvedValue(null);
    const req = mockReq({ open_time: "09:00:00" }, { id: "999" });
    const res = mockRes();

    await updateDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 on database error", async () => {
    mockFindByPk.mockRejectedValue(new Error("Database error"));
    const req = mockReq({ open_time: "09:00:00" }, { id: "1" });
    const res = mockRes();

    await updateDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("delete department hours", () => {
  it("Given: The backend is running, When: I make a call to delete Department_Hours, Then: Department_Hours are deleted from the database", async () => {
    const mockDestroy = jest.fn().mockResolvedValue(true);
    mockFindByPk.mockResolvedValue({ ...testDepartmentHours, destroy: mockDestroy });
    const req = mockReq({}, { id: "1" });
    const res = mockRes();

    await deleteDepartmentHours(req, res);

    expect(mockFindByPk).toHaveBeenCalledWith("1");
    expect(mockDestroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.stringContaining("deleted") })
    );
  });

  it("returns 404 when department hours not found", async () => {
    mockFindByPk.mockResolvedValue(null);
    const req = mockReq({}, { id: "999" });
    const res = mockRes();

    await deleteDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 on database error", async () => {
    mockFindByPk.mockRejectedValue(new Error("Database error"));
    const req = mockReq({}, { id: "1" });
    const res = mockRes();

    await deleteDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("list department hours", () => {
  it("Given: The backend is running, When: I make a call to Get the Department_Hours, Then: List of Department_Hours are returned", async () => {
    mockFindAll.mockResolvedValue([testDepartmentHours]);
    const req = mockReq({}, {}, {});
    const res = mockRes();

    await listDepartmentHours(req, res);

    expect(mockFindAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [testDepartmentHours],
      })
    );
  });

  it("filters by department_id when provided", async () => {
    mockFindAll.mockResolvedValue([testDepartmentHours]);
    const req = mockReq({}, {}, { department_id: "1" });
    const res = mockRes();

    await listDepartmentHours(req, res);

    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { department_id: "1" },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns empty array when no department hours exist", async () => {
    mockFindAll.mockResolvedValue([]);
    const req = mockReq({}, {}, {});
    const res = mockRes();

    await listDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: [] })
    );
  });

  it("returns 500 on database error", async () => {
    mockFindAll.mockRejectedValue(new Error("Database error"));
    const req = mockReq({}, {}, {});
    const res = mockRes();

    await listDepartmentHours(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
