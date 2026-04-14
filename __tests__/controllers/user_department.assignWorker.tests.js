import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCanManageDepartment = jest.fn();

const mockDeptFindByPk = jest.fn();
const mockUdFindAll = jest.fn();
const mockUdCreate = jest.fn();
const mockUdFindByPk = jest.fn();
const mockUserFindByPk = jest.fn();
const mockRoleFindOne = jest.fn();
const mockPositionFindByPk = jest.fn();

const mockDb = {
  Sequelize: {
    Op: {
      lt: Symbol('lt'),
      like: Symbol('like'),
      or: Symbol('or'),
    },
  },
  department: {
    findByPk: mockDeptFindByPk,
  },
  userDepartment: {
    findAll: mockUdFindAll,
    create: mockUdCreate,
    findByPk: mockUdFindByPk,
  },
  user: {
    findByPk: mockUserFindByPk,
  },
  role: {
    findOne: mockRoleFindOne,
  },
  position: {
    findByPk: mockPositionFindByPk,
  },
};

await jest.unstable_mockModule('../app/authorization/roleAccess.js', () => ({
  __esModule: true,
  canManageDepartment: mockCanManageDepartment,
  getManagedDepartmentIds: jest.fn(),
  resolveHighestRoleForUser: jest.fn(),
}));

await jest.unstable_mockModule('../app/models/index.js', () => ({
  __esModule: true,
  default: mockDb,
}));

const controllerModule = await import('../../app/controllers/user_department.controller.js');
const { assignWorker } = controllerModule.default || controllerModule;

const mockReq = (body = {}, auth = {}) => ({ body, auth });

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe('assignWorker multi-position flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanManageDepartment.mockResolvedValue(true);
    mockUserFindByPk.mockResolvedValue({ id: 44, email: 'worker@example.com' });
    mockDeptFindByPk.mockResolvedValue({ department_id: 7, department_name: 'Library' });
    mockRoleFindOne.mockResolvedValue({ role_id: 3, role_name: 'Student Worker', permission_level: 10 });
  });

  it('syncs active memberships to selected positionIds (update existing, create missing, deactivate removed)', async () => {
    const existingSelected = {
      ud_id: 101,
      user_id: 44,
      department_id: 7,
      position_id: 11,
      role_id: 3,
      is_active: false,
      request_status: 'rejected',
      deactivated_at: new Date('2026-04-10T00:00:00.000Z'),
      assigned_at: new Date('2026-04-10T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(true),
    };

    const existingToDeactivate = {
      ud_id: 102,
      user_id: 44,
      department_id: 7,
      position_id: 19,
      role_id: 3,
      is_active: true,
      request_status: 'approved',
      deactivated_at: null,
      assigned_at: new Date('2026-04-10T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(true),
    };

    const createdMembership = {
      ud_id: 103,
      user_id: 44,
      department_id: 7,
      position_id: 12,
      role_id: 3,
      is_active: true,
      request_status: 'approved',
      assigned_at: new Date('2026-04-12T12:00:00.000Z'),
    };

    mockPositionFindByPk
      .mockResolvedValueOnce({ position_id: 11, department_id: 7 })
      .mockResolvedValueOnce({ position_id: 12, department_id: 7 });

    mockUdFindAll.mockResolvedValue([existingSelected, existingToDeactivate]);
    mockUdCreate.mockResolvedValue(createdMembership);
    mockUdFindByPk
      .mockResolvedValueOnce(existingSelected)
      .mockResolvedValueOnce(createdMembership);

    const req = mockReq(
      {
        userId: 44,
        departmentId: 7,
        positionIds: [11, 12],
      },
      {
        userId: 9,
        email: 'manager@example.com',
      },
    );
    const res = mockRes();

    await assignWorker(req, res);

    expect(existingSelected.save).toHaveBeenCalled();
    expect(existingSelected.is_active).toBe(true);
    expect(existingSelected.request_status).toBe('approved');

    expect(mockUdCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 44,
        department_id: 7,
        position_id: 12,
        role_id: 3,
        is_active: true,
        request_status: 'approved',
      }),
    );

    expect(existingToDeactivate.save).toHaveBeenCalled();
    expect(existingToDeactivate.is_active).toBe(false);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('successfully'),
        data: expect.any(Array),
      }),
    );
    expect(payload.data).toHaveLength(2);
  });
});
