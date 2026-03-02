import request from "supertest";
import db from "../../app/models/index.js";
import app from "../../server.js";
import { setupTestData } from "../helpers/testData.js";

describe("Qualification Controller Tests", () => {
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

  describe("GET /students/qualifications", () => {
    it("AC1: Manager can view students and their qualifications", async () => {
      const response = await request(app)
        .get("/students/qualifications")
        .set("Authorization", "Bearer manager-token")
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check that student data structure matches frontend expectations
      const student = response.body.find(s => s.email === "student1@test.com");
      expect(student).toBeDefined();
      expect(student.user_id).toBe(testData.users.student1.id);
      expect(student.first_name).toBe("Test");
      expect(student.last_name).toBe("Student1");
      expect(student.qualifications).toBeInstanceOf(Array);
      expect(student.qualifications.length).toBe(1);
      expect(student.qualifications[0].qualification_name).toBe("Customer Service Training");
      expect(student.qualifications[0].approval_status).toBe("APPROVED");
    });

    it("AC2: Non-manager cannot access student qualifications", async () => {
      const response = await request(app)
        .get("/students/qualifications")
        .set("Authorization", "Bearer student-token")
        .expect(403);

      expect(response.body.message).toContain("Access denied");
    });

    it("Should filter students by qualification ID", async () => {
      const response = await request(app)
        .get("/students/qualifications?qualificationId=" + testData.qualifications.qual2.qualification_id)
        .set("Authorization", "Bearer manager-token")
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      // Should only return students who have this qualification
      response.body.forEach(student => {
        expect(student.qualifications.length).toBeGreaterThan(0);
        expect(student.qualifications[0].qualification_id).toBe(testData.qualifications.qual2.qualification_id);
      });
    });

    it("Should return 401 for unauthorized access", async () => {
      await request(app)
        .get("/students/qualifications")
        .expect(401);
    });
  });

  describe("GET /students/:userId/qualifications", () => {
    it("AC3: Manager can view single student qualifications", async () => {
      const response = await request(app)
        .get(`/students/${testData.users.student1.id}/qualifications`)
        .set("Authorization", "Bearer manager-token")
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].qualification_name).toBe("Customer Service Training");
      expect(response.body[0].approval_status).toBe("APPROVED");
    });

    it("AC2: Non-manager cannot access single student qualifications", async () => {
      await request(app)
        .get(`/students/${testData.users.student1.id}/qualifications`)
        .set("Authorization", "Bearer student-token")
        .expect(403);
    });

    it("AC4: Student with no qualifications returns empty list", async () => {
      const response = await request(app)
        .get(`/students/${testData.users.student3.id}/qualifications`)
        .set("Authorization", "Bearer manager-token")
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });

    it("Should return 404 for non-existent student", async () => {
      const response = await request(app)
        .get("/students/99999/qualifications")
        .set("Authorization", "Bearer manager-token")
        .expect(404);

      expect(response.body.message).toBe("Student not found.");
    });
  });

  describe("GET /positions/:positionId/required-qualifications", () => {
    it("AC5: Position required qualifications endpoint returns expected list", async () => {
      // Test position with single requirement (Cashier)
      const response1 = await request(app)
        .get(`/positions/${testData.positions.position1.position_id}/required-qualifications`)
        .set("Authorization", "Bearer manager-token")
        .expect(200);

      expect(response1.body).toBeInstanceOf(Array);
      expect(response1.body.length).toBe(1);
      expect(response1.body[0].qualification_name).toBe("Customer Service Training");

      // Test position with multiple requirements (Cook)
      const response2 = await request(app)
        .get(`/positions/${testData.positions.position2.position_id}/required-qualifications`)
        .set("Authorization", "Bearer manager-token")
        .expect(200);

      expect(response2.body).toBeInstanceOf(Array);
      expect(response2.body.length).toBe(2);
      const qualNames = response2.body.map(q => q.qualification_name);
      expect(qualNames).toContain("Food Safety Certificate");
      expect(qualNames).toContain("First Aid Certification");
    });

    it("Should return 404 for non-existent position", async () => {
      const response = await request(app)
        .get("/positions/99999/required-qualifications")
        .set("Authorization", "Bearer manager-token")
        .expect(404);

      expect(response.body.message).toBe("Position not found.");
    });

    it("Should return 403 for non-manager access", async () => {
      await request(app)
        .get(`/positions/${testData.positions.position1.position_id}/required-qualifications`)
        .set("Authorization", "Bearer student-token")
        .expect(403);
    });
  });

  describe("GET /qualifications", () => {
    it("Should return all qualifications for authenticated users", async () => {
      const response = await request(app)
        .get("/qualifications")
        .set("Authorization", "Bearer manager-token")
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      
      const qualNames = response.body.map(q => q.qualification_name);
      expect(qualNames).toContain("Food Safety Certificate");
      expect(qualNames).toContain("Customer Service Training");
      expect(qualNames).toContain("First Aid Certification");
    });

    it("Should return 401 for unauthorized access", async () => {
      await request(app)
        .get("/qualifications")
        .expect(401);
    });
  });

  describe("POST /qualifications/check", () => {
    it("Should return qualified when user has all required qualifications", async () => {
      const response = await request(app)
        .post("/qualifications/check")
        .set("Authorization", "Bearer manager-token")
        .send({
          userId: testData.users.student1.id,
          positionId: testData.positions.position1.position_id // Cashier (requires Customer Service)
        })
        .expect(200);

      expect(response.body.isQualified).toBe(true);
      expect(response.body.message).toContain("has all required qualifications");
    });

    it("Should return not qualified when user missing required qualification", async () => {
      const response = await request(app)
        .post("/qualifications/check")
        .set("Authorization", "Bearer manager-token")
        .send({
          userId: testData.users.student3.id, // No qualifications
          positionId: testData.positions.position1.position_id // Cashier (requires Customer Service)
        })
        .expect(400);

      expect(response.body.isQualified).toBe(false);
      expect(response.body.message).toContain("missing required qualifications");
      expect(response.body.missingQualifications).toBeInstanceOf(Array);
      expect(response.body.missingQualifications[0].qualification_name).toBe("Customer Service Training");
    });

    it("Should return qualified when position has no requirements", async () => {
      // Create a position with no requirements
      const noReqPosition = await db.position.create({
        position_name: "Cleaner",
        description: "General cleaning duties",
        department_id: testData.department.id
      });

      const response = await request(app)
        .post("/qualifications/check")
        .set("Authorization", "Bearer manager-token")
        .send({
          userId: testData.users.student3.id, // No qualifications
          positionId: noReqPosition.position_id
        })
        .expect(200);

      expect(response.body.isQualified).toBe(true);
      expect(response.body.message).toContain("No qualifications required");
    });

    it("Should return 403 for non-manager access", async () => {
      await request(app)
        .post("/qualifications/check")
        .set("Authorization", "Bearer student-token")
        .send({
          userId: testData.users.student1.id,
          positionId: testData.positions.position1.position_id
        })
        .expect(403);
    });
  });
});
