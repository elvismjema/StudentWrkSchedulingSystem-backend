import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { validateBufferTime } from '../../app/controllers/shift.controller.js';
import db from '../../app/models/index.js';

describe('Buffer Time Validation', () => {
  let testDepartment;
  let testUser;
  let testPosition;
  
  beforeEach(async () => {
    // Create a test department with 30 minute buffer time
    testDepartment = await db.department.create({
      department_name: 'Test Department',
      description: 'Test department for buffer time validation',
      buffer_time_minutes: 30
    });

    // Create a test user
    testUser = await db.user.create({
      username: 'testuser',
      email: 'testuser@test.com',
      password: 'password123',
      first_name: 'Test',
      last_name: 'User'
    });

    // Create a test position
    testPosition = await db.position.create({
      department_id: testDepartment.department_id,
      position_name: 'Test Position',
      description: 'Test position'
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db.shift.destroy({ where: {} });
    await db.position.destroy({ where: {} });
    await db.user.destroy({ where: {} });
    await db.department.destroy({ where: {} });
  });

  it('should allow shifts with sufficient buffer time', async () => {
    // Create an existing shift from 9:00 to 10:00
    await db.shift.create({
      department_id: testDepartment.department_id,
      position_id: testPosition.position_id,
      assigned_user_id: testUser.user_id,
      shift_date: '2026-03-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      created_by: testUser.user_id
    });

    // Try to create a new shift from 10:30 to 11:30 (30 minute buffer)
    const validation = await validateBufferTime(
      testDepartment.department_id,
      '2026-03-15',
      '10:30:00',
      '11:30:00',
      testUser.user_id
    );

    expect(validation.valid).toBe(true);
  });

  it('should reject shifts with insufficient buffer time', async () => {
    // Create an existing shift from 9:00 to 10:00
    await db.shift.create({
      department_id: testDepartment.department_id,
      position_id: testPosition.position_id,
      assigned_user_id: testUser.user_id,
      shift_date: '2026-03-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      created_by: testUser.user_id
    });

    // Try to create a new shift from 10:15 to 11:15 (only 15 minute buffer)
    const validation = await validateBufferTime(
      testDepartment.department_id,
      '2026-03-15',
      '10:15:00',
      '11:15:00',
      testUser.user_id
    );

    expect(validation.valid).toBe(false);
    expect(validation.message).toContain('Buffer time violation');
    expect(validation.message).toContain('15 minutes');
    expect(validation.message).toContain('Required buffer: 30 minutes');
  });

  it('should reject overlapping shifts', async () => {
    // Create an existing shift from 9:00 to 10:00
    await db.shift.create({
      department_id: testDepartment.department_id,
      position_id: testPosition.position_id,
      assigned_user_id: testUser.user_id,
      shift_date: '2026-03-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      created_by: testUser.user_id
    });

    // Try to create an overlapping shift from 9:30 to 10:30
    const validation = await validateBufferTime(
      testDepartment.department_id,
      '2026-03-15',
      '09:30:00',
      '10:30:00',
      testUser.user_id
    );

    expect(validation.valid).toBe(false);
    expect(validation.message).toContain('Shift overlap detected');
  });

  it('should allow shifts when no buffer time is configured', async () => {
    // Create a department with no buffer time
    const noBufDept = await db.department.create({
      department_name: 'No Buffer Department',
      buffer_time_minutes: 0
    });

    const noBufPos = await db.position.create({
      department_id: noBufDept.department_id,
      position_name: 'Test Position'
    });

    // Create an existing shift
    await db.shift.create({
      department_id: noBufDept.department_id,
      position_id: noBufPos.position_id,
      assigned_user_id: testUser.user_id,
      shift_date: '2026-03-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      created_by: testUser.user_id
    });

    // Try to create a shift immediately after
    const validation = await validateBufferTime(
      noBufDept.department_id,
      '2026-03-15',
      '10:00:00',
      '11:00:00',
      testUser.user_id
    );

    expect(validation.valid).toBe(true);
  });

  it('should allow shifts on different dates', async () => {
    // Create an existing shift on March 15
    await db.shift.create({
      department_id: testDepartment.department_id,
      position_id: testPosition.position_id,
      assigned_user_id: testUser.user_id,
      shift_date: '2026-03-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      created_by: testUser.user_id
    });

    // Try to create a shift on March 16 at the same time
    const validation = await validateBufferTime(
      testDepartment.department_id,
      '2026-03-16',
      '09:00:00',
      '10:00:00',
      testUser.user_id
    );

    expect(validation.valid).toBe(true);
  });

  it('should allow shifts for different users on the same date', async () => {
    const anotherUser = await db.user.create({
      username: 'anotheruser',
      email: 'another@test.com',
      password: 'password123',
      first_name: 'Another',
      last_name: 'User'
    });

    // Create an existing shift for testUser
    await db.shift.create({
      department_id: testDepartment.department_id,
      position_id: testPosition.position_id,
      assigned_user_id: testUser.user_id,
      shift_date: '2026-03-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      created_by: testUser.user_id
    });

    // Try to create a shift for anotherUser at the same time
    const validation = await validateBufferTime(
      testDepartment.department_id,
      '2026-03-15',
      '09:00:00',
      '10:00:00',
      anotherUser.user_id
    );

    expect(validation.valid).toBe(true);
  });
});
