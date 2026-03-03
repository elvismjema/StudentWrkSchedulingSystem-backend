import request from "supertest";
import db from "../../app/models/index.js";
import app from "../../server.js";
import { setupTestData } from "../helpers/testData.js";

describe("Shift Assignment Tests", () => {
  let testData;

  beforeAll(async () => {
    // Set up test database
    await db.sequelize.sync({ force: true });
    testData = await setupTestData(db);
  });

  afterAll(async () => {
    // Clean up test database
    await db.sequelize.close();
  });

  describe("PUT /shifts/:shiftId (assignment with qualification validation)", () => {
    it("AC6: Assign shift succeeds when user has all required qualifications approved", async () => {
      // Student1 has approved Customer Service Training
      // Shift1 is for Cashier position (requires Customer Service Training)
      const response = await request(app)
        .put(`/shifts/${testData.shifts.shift1.shift_id}`)
        .set("Authorization", "Bearer manager-token")
        .send({
          assigned_user_id: testData.users.student1.id
        })
        .expect(200);

      // Verify the assignment
      expect(response.body.assigned_user_id).toBe(testData.users.student1.id);
      
      // Verify the assignment in database
      const updatedShift = await db.shift.findByPk(testData.shifts.shift1.shift_id);
      expect(updatedShift.assigned_user_id).toBe(testData.users.student1.id);
    });

    it("AC7: Assign shift fails when user missing required qualification", async () => {
      // Student3 has no qualifications
      // Shift1 is for Cashier position (requires Customer Service Training)
      const response = await request(app)
        .put(`/shifts/${testData.shifts.shift1.shift_id}`)
        .set("Authorization", "Bearer manager-token")
        .send({
          assigned_user_id: testData.users.student3.id
        })
        .expect(400);

      expect(response.body.message).toContain("Missing");
      expect(response.body.missingQualifications).toBeInstanceOf(Array);
      expect(response.body.missingQualifications.length).toBe(1);
      expect(response.body.missingQualifications[0].qualification_name).toBe("Customer Service Training");
    });

    it("AC8: Assign shift requires ALL qualifications (multiple required quals)", async () => {
      // Student2 has approved Food Safety but pending First Aid
      // Shift2 is for Cook position (requires Food Safety AND First Aid)
      const response = await request(app)
        .put(`/shifts/${testData.shifts.shift2.shift_id}`)
        .set("Authorization", "Bearer manager-token")
        .send({
          assigned_user_id: testData.users.student2.id
        })
        .expect(400);

      expect(response.body.message).toContain("not approved");
      expect(response.body.notApprovedQualifications).toBeInstanceOf(Array);
      expect(response.body.notApprovedQualifications.length).toBe(1);
      expect(response.body.notApprovedQualifications[0].qualification_name).toBe("First Aid Certification");
      expect(response.body.notApprovedQualifications[0].approval_status).toBe("PENDING");
    });

    it("AC9: Assign shift fails if required qualification is not approved", async () => {
      // Same test as AC8 but focusing on approval status
      const response = await request(app)
        .put(`/shifts/${testData.shifts.shift2.shift_id}`)
        .set("Authorization", "Bearer manager-token")
        .send({
          assigned_user_id: testData.users.student2.id
        })
        .expect(400);

      expect(response.body.message).toContain("not approved");
      expect(response.body.notApprovedQualifications[0].approval_status).toBe("PENDING");
    });

    it("Should assign shift when position has no qualification requirements", async () => {
      // Create a position with no requirements
      const noReqPosition = await db.position.create({
        position_name: "Cleaner",
        description: "General cleaning duties",
        department_id: testData.department.id
      });

      // Create a shift for this position
      const noReqShift = await db.shift.create({
        department_id: testData.department.id,
        position_id: noReqPosition.position_id,
        start_time: "08:00:00",
        end_time: "16:00:00",
        shift_date: "2025-03-16",
        created_by: testData.users.manager.id,
        is_published: true
      });

      const response = await request(app)
        .put(`/shifts/${noReqShift.shift_id}`)
        .set("Authorization", "Bearer manager-token")
        .send({
          assigned_user_id: testData.users.student3.id // Student with no qualifications
        })
        .expect(200);

      expect(response.body.assigned_user_id).toBe(testData.users.student3.id);
    });

    it("Should return 404 for non-existent shift", async () => {
      const response = await request(app)
        .put("/shifts/99999")
        .set("Authorization", "Bearer manager-token")
        .send({
          assigned_user_id: testData.users.student1.id
        })
        .expect(404);

      expect(response.body.message).toContain("Cannot update Shift");
    });

    it("Should return 404 for non-existent user", async () => {
      const response = await request(app)
        .put(`/shifts/${testData.shifts.shift1.shift_id}`)
        .set("Authorization", "Bearer manager-token")
        .send({
          assigned_user_id: 99999
        })
        .expect(404);

      expect(response.body.message).toBe("User not found.");
    });

    it("Should return 400 when trying to assign non-student user", async () => {
      const response = await request(app)
        .put(`/shifts/${testData.shifts.shift1.shift_id}`)
        .set("Authorization", "Bearer manager-token")
        .send({
          assigned_user_id: testData.users.manager.id // Manager, not student
        })
        .expect(400);

      expect(response.body.message).toBe("Only students can be assigned to shifts.");
    });

    it("Should allow other shift updates without qualification validation", async () => {
      // Test updating other fields doesn't trigger qualification validation
      const response = await request(app)
        .put(`/shifts/${testData.shifts.shift1.shift_id}`)
        .set("Authorization", "Bearer manager-token")
        .send({
          start_time: "10:00:00",
          end_time: "18:00:00"
        })
        .expect(200);

      expect(response.body.start_time).toBe("10:00:00");
      expect(response.body.end_time).toBe("18:00:00");
    });

    it("Should return 401 for unauthorized access", async () => {
      await request(app)
        .put(`/shifts/${testData.shifts.shift1.shift_id}`)
        .send({
          assigned_user_id: testData.users.student1.id
        })
        .expect(401);
    });
  });
});
