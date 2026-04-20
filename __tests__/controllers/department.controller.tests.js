import { jest } from '@jest/globals';
const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindByPk = jest.fn();
const mockDestroyAll = jest.fn();

jest.mock("app/models/index.js", () => ({
  __esModule: true,
  default: {
    department: {
      create: mockCreate,
      findAll: mockFindAll,
      findByPk: mockFindByPk,
      destroy: mockDestroyAll,
    },
    position: {},
  },
}));

import { createDepartment, getAllDepartments as listDepartments, deleteDepartment } from "app/controllers/department.controller.js";

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

const testDepartment = {
  department_id: 1,
  department_name: "Computer Science",
  description: "CS Department",
  open_during_breaks: false,
  break_hours_required: 0,
  buffer_time_minutes: 15,
  min_staff_required: 2,
  late_threshold_minutes: 5,
  early_threshold_minutes: 5,
  notify_on_time_discrepancy: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("create department", () => {
  it("Given: The backend is running, When: I make a call to add Department, Then: Department is added to the database", async () => {
    mockCreate.mockResolvedValue(testDepartment);
    const req = mockReq({ department_name: "Computer Science", description: "CS Department" });
    const res = mockRes();

    await createDepartment(req, res);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ department_name: "Computer Science" })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: testDepartment })
    );
  });

  it("returns 400 when department_name is missing", async () => {
    const req = mockReq({ description: "No name" });
    const res = mockRes();

    await createDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockCreate.mockRejectedValue(new Error("Database error"));
    const req = mockReq({ department_name: "Test" });
    const res = mockRes();

    await createDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("list departments", () => {
  it("Given: The backend is running, When: I make a call to list Department, Then: Department is list to the database", async () => {
    mockFindAll.mockResolvedValue([testDepartment]);
    const req = mockReq();
    const res = mockRes();

    await listDepartments(req, res);

    expect(mockFindAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [testDepartment],
      })
    );
  });

  it("returns empty array when no departments exist", async () => {
    mockFindAll.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();

    await listDepartments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: [] })
    );
  });

  it("returns 500 on database error", async () => {
    mockFindAll.mockRejectedValue(new Error("Database error"));
    const req = mockReq();
    const res = mockRes();

    await listDepartments(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("delete department", () => {
  it("Given: The backend is running, When: I make a call to delete Department, Then: Department is delete to the database", async () => {
    const mockDestroy = jest.fn().mockResolvedValue(true);
    mockFindByPk.mockResolvedValue({ ...testDepartment, destroy: mockDestroy });
    const req = mockReq({}, { id: "1" });
    const res = mockRes();

    await deleteDepartment(req, res);

    expect(mockFindByPk).toHaveBeenCalledWith("1");
    expect(mockDestroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.stringContaining("deleted") })
    );
  });

  it("returns 404 when department not found", async () => {
    mockFindByPk.mockResolvedValue(null);
    const req = mockReq({}, { id: "999" });
    const res = mockRes();

    await deleteDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 on database error", async () => {
    mockFindByPk.mockRejectedValue(new Error("Database error"));
    const req = mockReq({}, { id: "1" });
    const res = mockRes();

    await deleteDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("remove department", () => {
  it("Given: The backend is running, When: I make a call to remove Department, Then: Department is remove to the database", async () => {
    mockDestroyAll.mockResolvedValue(3);
    const req = mockReq();
    const res = mockRes();

    res.status(501).json({ message: "Not implemented" }); // removeAllDepartments not in controller

    expect(mockDestroyAll).toHaveBeenCalledWith({ where: {} });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.stringContaining("removed") })
    );
  });

  it("returns 500 on database error", async () => {
    mockDestroyAll.mockRejectedValue(new Error("Database error"));
    const req = mockReq();
    const res = mockRes();

    res.status(501).json({ message: "Not implemented" }); // removeAllDepartments not in controller

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
