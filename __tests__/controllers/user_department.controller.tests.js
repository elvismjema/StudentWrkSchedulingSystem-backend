import { jest } from '@jest/globals';
const mockDeptFindAll = jest.fn();
const mockDeptFindByPk = jest.fn();
const mockUdCreate = jest.fn();
const mockUdFindOne = jest.fn();
const mockUdFindAll = jest.fn();
const mockUdFindByPk = jest.fn();

jest.mock("app/models/index.js", () => ({
  __esModule: true,
  default: {
    department: {
      findAll: mockDeptFindAll,
      findByPk: mockDeptFindByPk,
    },
    userDepartment: {
      create: mockUdCreate,
      findOne: mockUdFindOne,
      findAll: mockUdFindAll,
      findByPk: mockUdFindByPk,
    },
  },
}));

import controller from "app/controllers/user_department.controller.js";
const {
  listAvailableDepartments,
  submitJoinRequest,
  listUserDepartments,
  leaveDepar,
} = controller;

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

const testDepartments = [
  { department_id: 1, department_name: "The Brew", description: "Coffee shop on campus" },
  { department_id: 2, department_name: "Library", description: "Campus library" },
  { department_id: 3, department_name: "Fitness Center", description: "Gym and recreation" },
];

const testUserDepartment = {
  ud_id: 1,
  user_id: 10,
  department_id: 1,
  position_id: null,
  role_id: null,
  is_active: true,
  assigned_at: new Date().toISOString(),
  deactivated_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// AT-22845: Student can view list of available departments
describe("AT-22845: Student can view list of available departments", () => {
  it("Given: The backend is running, When: I make a call to get available departments, Then: List of departments are returned", async () => {
    mockDeptFindAll.mockResolvedValue(testDepartments);
    const req = mockReq();
    const res = mockRes();

    await listAvailableDepartments(req, res);

    expect(mockDeptFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: ["department_id", "department_name", "description"],
        order: [["department_name", "ASC"]],
      })
    );
    expect(res.send).toHaveBeenCalledWith(testDepartments);
  });

  it("returns empty array when no departments exist", async () => {
    mockDeptFindAll.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();

    await listAvailableDepartments(req, res);

    expect(res.send).toHaveBeenCalledWith([]);
  });

  it("returns 500 on database error", async () => {
    mockDeptFindAll.mockRejectedValue(new Error("Database error"));
    const req = mockReq();
    const res = mockRes();

    await listAvailableDepartments(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// AT-22846: Student can submit a department join request
describe("AT-22846: Student can submit a department join request", () => {
  it("Given: The backend is running, When: A student submits a join request with valid user_id and department_id, Then: The request is persisted in the database", async () => {
    mockDeptFindByPk.mockResolvedValue(testDepartments[0]);
    mockUdFindOne.mockResolvedValue(null);
    mockUdCreate.mockResolvedValue(testUserDepartment);
    const req = mockReq({ user_id: 10, department_id: 1 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(mockDeptFindByPk).toHaveBeenCalledWith(1);
    expect(mockUdFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 10, department_id: 1, is_active: true },
      })
    );
    expect(mockUdCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 10,
        department_id: 1,
        is_active: true,
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Department join request submitted successfully.",
        data: testUserDepartment,
      })
    );
  });

  it("returns 400 when user_id is missing", async () => {
    const req = mockReq({ department_id: 1 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUdCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when department_id is missing", async () => {
    const req = mockReq({ user_id: 10 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUdCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when department does not exist", async () => {
    mockDeptFindByPk.mockResolvedValue(null);
    const req = mockReq({ user_id: 10, department_id: 999 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockUdCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when user is already an active member of the department", async () => {
    mockDeptFindByPk.mockResolvedValue(testDepartments[0]);
    mockUdFindOne.mockResolvedValue(testUserDepartment);
    const req = mockReq({ user_id: 10, department_id: 1 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockUdCreate).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockDeptFindByPk.mockResolvedValue(testDepartments[0]);
    mockUdFindOne.mockResolvedValue(null);
    mockUdCreate.mockRejectedValue(new Error("Database error"));
    const req = mockReq({ user_id: 10, department_id: 1 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// AT-22847: Student receives confirmation after request is submitted
describe("AT-22847: Student receives confirmation after request is submitted", () => {
  it("Given: A student has submitted a department join request, When: The request is processed, Then: The student receives a confirmation message", async () => {
    mockDeptFindByPk.mockResolvedValue(testDepartments[0]);
    mockUdFindOne.mockResolvedValue(null);
    mockUdCreate.mockResolvedValue(testUserDepartment);
    const req = mockReq({ user_id: 10, department_id: 1 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseBody = res.send.mock.calls[0][0];
    expect(responseBody).toHaveProperty("message");
    expect(responseBody.message).toContain("successfully");
    expect(responseBody).toHaveProperty("data");
    expect(responseBody.data).toEqual(
      expect.objectContaining({
        ud_id: 1,
        user_id: 10,
        department_id: 1,
        is_active: true,
      })
    );
  });

  it("confirmation includes the created membership data", async () => {
    const createdRecord = {
      ...testUserDepartment,
      ud_id: 5,
      user_id: 20,
      department_id: 2,
    };
    mockDeptFindByPk.mockResolvedValue(testDepartments[1]);
    mockUdFindOne.mockResolvedValue(null);
    mockUdCreate.mockResolvedValue(createdRecord);
    const req = mockReq({ user_id: 20, department_id: 2 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseBody = res.send.mock.calls[0][0];
    expect(responseBody.data.ud_id).toBe(5);
    expect(responseBody.data.user_id).toBe(20);
    expect(responseBody.data.department_id).toBe(2);
  });

  it("error response does not contain a success confirmation", async () => {
    mockDeptFindByPk.mockResolvedValue(null);
    const req = mockReq({ user_id: 10, department_id: 999 });
    const res = mockRes();

    await submitJoinRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    const responseBody = res.send.mock.calls[0][0];
    expect(responseBody.message).not.toContain("successfully");
  });
});
