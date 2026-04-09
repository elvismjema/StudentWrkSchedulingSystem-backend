const request = require('supertest');
const { expect } = require('chai');

describe('Student One Active Department Enforcement', () => {
  const baseURL = 'http://localhost:3000';
  let authToken;

  before(async () => {
    // Login as a student to get auth token
    const loginResponse = await request(baseURL)
      .post('/auth/login')
      .send({
        email: 'student@test.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.token;
  });

  describe('getStudentActiveDepartment', () => {
    it('should return student\'s single active department', async () => {
      const response = await request(baseURL)
        .get('/user-departments/active-department/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('department_id');
      expect(response.body).to.have.property('department_name');
    });
  });

  describe('assignUserRole for students', () => {
    it('should deactivate old departments when assigning new one to student', async () => {
      // First assign student to department 1
      await request(baseURL)
        .post('/user-departments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          user_id: 1,
          department_id: 1,
          role_id: 3
        });

      // Then assign to department 2
      const response = await request(baseURL)
        .post('/user-departments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          user_id: 1,
          department_id: 2,
          role_id: 3
        });

      expect(response.status).to.equal(201);
      
      // Check that old department is deactivated
      const activeDepartments = await request(baseURL)
        .get('/user-departments/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      const activeDepts = activeDepartments.body.filter(dept => dept.is_active === true);
      expect(activeDepts).to.have.length(1);
      expect(activeDepts[0].department_id).to.equal(2);
    });
  });

  describe('shift list auto-filtering', () => {
    it('should auto-filter shifts by student\'s active department', async () => {
      // Create a shift in department 1
      await request(baseURL)
        .post('/shifts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          department_id: 1,
          assigned_user_id: 1,
          start_time: '09:00',
          end_time: '17:00',
          shift_date: '2024-01-15'
        });

      // Get shifts without specifying department (should auto-filter)
      const response = await request(baseURL)
        .get('/shifts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ assigned_user_id: 1 });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      
      // All shifts should be from department 1 (student's active department)
      response.body.forEach(shift => {
        expect(shift.department_id).to.equal(1);
      });
    });
  });
});
