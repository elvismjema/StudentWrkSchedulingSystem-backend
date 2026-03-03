const mockUserFindAll = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserFindOne = jest.fn();
const mockUserDestroy = jest.fn();

const mockUserDepartmentFindAll = jest.fn();
const mockUserDepartmentFindOne = jest.fn();
const mockUserDepartmentCreate = jest.fn();

const mockDepartmentFindByPk = jest.fn();
const mockRoleFindByPk = jest.fn();
const mockPositionFindByPk = jest.fn();

const mockPendingFindAll = jest.fn();
const mockPendingFindOne = jest.fn();
const mockPendingCreate = jest.fn();
const mockPendingDestroy = jest.fn();

jest.mock("../../app/models/index.js", () => ({
  __esModule: true,
  default: {
    user: {
      findAll: mockUserFindAll,
      findByPk: mockUserFindByPk,
      findOne: mockUserFindOne,
      destroy: mockUserDestroy,
    },
    userDepartment: {
      findAll: mockUserDepartmentFindAll,
      findOne: mockUserDepartmentFindOne,
      create: mockUserDepartmentCreate,
    },
    department: {
      findByPk: mockDepartmentFindByPk,
    },
    role: {
      findByPk: mockRoleFindByPk,
    },
    position: {
      findByPk: mockPositionFindByPk,
    },
    pendingRoleAssignment: {
      findAll: mockPendingFindAll,
      findOne: mockPendingFindOne,
      create: mockPendingCreate,
      destroy: mockPendingDestroy,
    },
  },
}));

const controller = require("../../app/controllers/admin.controller.js");

const {
  getAllUsers,
  getDepartmentMembers,
  getPendingAssignments,
  createPendingAssignment,
  deletePendingAssignment,
} = controller.default || controller;

const mockReq = (body = {}, params = {}, query = {}, auth = { userId: 1 }) => ({
  body,
  params,
  query,
  auth,
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

describe("admin.controller", () => {
  it("returns users for /admin/users", async () => {
    const users = [{ id: 1, email: "a@oc.edu" }];
    mockUserFindAll.mockResolvedValue(users);
    const req = mockReq({}, {}, {}, { userId: 100 });
    const res = mockRes();

    await getAllUsers(req, res);

    expect(mockUserFindAll).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith({ data: users });
  });

  it("returns department members for /admin/departments/:id/members", async () => {
    const members = [{ ud_id: 1, user: { id: 2, email: "user@oc.edu" } }];
    mockUserDepartmentFindAll.mockResolvedValue(members);
    const req = mockReq({}, { departmentId: "2" });
    const res = mockRes();

    await getDepartmentMembers(req, res);

    expect(mockUserDepartmentFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          department_id: 2,
          is_active: true,
        }),
      }),
    );
    expect(res.send).toHaveBeenCalledWith({ data: members });
  });

  it("creates pending assignment when user does not yet exist", async () => {
    mockDepartmentFindByPk.mockResolvedValue({ department_id: 1 });
    mockRoleFindByPk.mockResolvedValue({ role_id: 3, department_id: 1 });
    mockUserFindOne.mockResolvedValue(null);
    mockPendingFindOne.mockResolvedValue(null);
    mockPendingCreate.mockResolvedValue({ id: 9, email: "new.user@oc.edu" });

    const req = mockReq(
      { email: "new.user@oc.edu", department_id: 1, role_id: 3 },
      {},
      {},
      { userId: 99 },
    );
    const res = mockRes();

    await createPendingAssignment(req, res);

    expect(mockPendingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new.user@oc.edu",
        department_id: 1,
        role_id: 3,
        created_by_user_id: 99,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("applies assignment immediately when user already exists", async () => {
    mockDepartmentFindByPk.mockResolvedValue({ department_id: 1 });
    mockRoleFindByPk.mockResolvedValue({ role_id: 3, department_id: 1 });
    mockUserFindOne.mockResolvedValue({ id: 55, email: "existing@oc.edu" });
    mockUserDepartmentFindOne.mockResolvedValue(null);
    mockUserDepartmentCreate.mockResolvedValue({ ud_id: 22, user_id: 55 });
    mockPendingDestroy.mockResolvedValue(1);

    const req = mockReq(
      { email: "existing@oc.edu", department_id: 1, role_id: 3 },
      {},
      {},
      { userId: 99 },
    );
    const res = mockRes();

    await createPendingAssignment(req, res);

    expect(mockUserDepartmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 55,
        department_id: 1,
        role_id: 3,
      }),
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("applied immediately"),
      }),
    );
  });

  it("returns pending assignments list", async () => {
    const pending = [{ id: 1, email: "queued@oc.edu" }];
    mockPendingFindAll.mockResolvedValue(pending);
    const req = mockReq();
    const res = mockRes();

    await getPendingAssignments(req, res);

    expect(res.send).toHaveBeenCalledWith({ data: pending });
  });

  it("returns 404 when deleting unknown pending assignment", async () => {
    mockPendingDestroy.mockResolvedValue(0);
    const req = mockReq({}, { id: "123" });
    const res = mockRes();

    await deletePendingAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
