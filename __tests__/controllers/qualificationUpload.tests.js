const request = require("supertest");
const db = require("../../app/models/index.js");
const app = require("../../server.js");
const { setupTestData } = require("../helpers/testData.js");
const path = require("path");
const fs = require("fs");

describe("Qualification Upload Tests", () => {
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

  describe("POST /qualifications/me/upload", () => {
    it("AC10.1: Student uploads valid PDF → 201 + status PENDING", async () => {
      // Create a test PDF file
      const testFilePath = path.resolve(__dirname, '../fixtures/test.pdf');
      const testContent = Buffer.from('%PDF-1.4 test content');
      
      // Ensure fixtures directory exists
      const fixturesDir = path.dirname(testFilePath);
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      fs.writeFileSync(testFilePath, testContent);

      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer student-token")
        .field("qualification_id", testData.qualifications.qual1.qualification_id)
        .field("evidence_type", "CERTIFICATE")
        .attach("file", testFilePath);

      expect(response.status).toBe(201);
      expect(response.body.approval_status).toBe("PENDING");
      expect(response.body.evidence_filename).toBe("test.pdf");
      expect(response.body.evidence_type).toBe("CERTIFICATE");
      expect(response.body.submitted_at).toBeDefined();
      expect(response.body.user_id).toBe(testData.users.student1.id);
      expect(response.body.qualification_id).toBe(testData.qualifications.qual1.qualification_id);

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });

    it("AC10.2: Upload invalid file type → 400", async () => {
      // Create a test text file (invalid type)
      const testFilePath = path.resolve(__dirname, '../fixtures/test.txt');
      fs.writeFileSync(testFilePath, "This is a text file");

      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer student-token")
        .field("qualification_id", testData.qualifications.qual1.qualification_id)
        .field("evidence_type", "OTHER")
        .attach("file", testFilePath);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Invalid file type");

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });

    it("AC10.3: Student cannot upload for another user → ensures /me only", async () => {
      const testFilePath = path.resolve(__dirname, '../fixtures/test.pdf');
      const testContent = Buffer.from('%PDF-1.4 test content');
      fs.writeFileSync(testFilePath, testContent);

      // Try to upload with a different user_id in body (should be ignored)
      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer student-token")
        .field("qualification_id", testData.qualifications.qual1.qualification_id)
        .field("evidence_type", "CERTIFICATE")
        .field("user_id", testData.users.student2.id) // This should be ignored
        .attach("file", testFilePath);

      expect(response.status).toBe(201);
      // Should be assigned to authenticated user (student1), not student2
      expect(response.body.user_id).toBe(testData.users.student1.id);

      fs.unlinkSync(testFilePath);
    });

    it("AC10.4: Non-student cannot upload → 403", async () => {
      const testFilePath = path.resolve(__dirname, '../fixtures/test.pdf');
      fs.writeFileSync(testFilePath, Buffer.from('%PDF-1.4 test content'));

      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer manager-token") // Manager token
        .field("qualification_id", testData.qualifications.qual1.qualification_id)
        .field("evidence_type", "CERTIFICATE")
        .attach("file", testFilePath);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Only students can upload qualification evidence.");

      fs.unlinkSync(testFilePath);
    });

    it("AC10.5: Missing file → 400", async () => {
      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer student-token")
        .field("qualification_id", testData.qualifications.qual1.qualification_id)
        .field("evidence_type", "CERTIFICATE");
        // No file attached

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("File is required.");
    });

    it("AC10.6: Missing qualification_id → 400", async () => {
      const testFilePath = path.resolve(__dirname, '../fixtures/test.pdf');
      fs.writeFileSync(testFilePath, Buffer.from('%PDF-1.4 test content'));

      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer student-token")
        .field("evidence_type", "CERTIFICATE")
        .attach("file", testFilePath);
        // Missing qualification_id

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("qualification_id is required.");

      fs.unlinkSync(testFilePath);
    });

    it("AC10.7: Invalid evidence_type → 400", async () => {
      const testFilePath = path.resolve(__dirname, '../fixtures/test.pdf');
      fs.writeFileSync(testFilePath, Buffer.from('%PDF-1.4 test content'));

      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer student-token")
        .field("qualification_id", testData.qualifications.qual1.qualification_id)
        .field("evidence_type", "INVALID_TYPE")
        .attach("file", testFilePath);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("evidence_type must be one of: RESUME, CERTIFICATE, OTHER");

      fs.unlinkSync(testFilePath);
    });

    it("AC10.8: Upload again resets approval_status to PENDING", async () => {
      // First, create an approved qualification
      await db.userQualification.create({
        user_id: testData.users.student1.id,
        qualification_id: testData.qualifications.qual2.qualification_id,
        approval_status: "APPROVED",
        approved_by_user_id: testData.users.manager.id,
        approved_at: new Date(),
        document_name: "existing_doc.pdf"
      });

      const testFilePath = path.resolve(__dirname, '../fixtures/test.pdf');
      fs.writeFileSync(testFilePath, Buffer.from('%PDF-1.4 test content'));

      // Upload new evidence for the same qualification
      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer student-token")
        .field("qualification_id", testData.qualifications.qual2.qualification_id)
        .field("evidence_type", "CERTIFICATE")
        .attach("file", testFilePath);

      expect(response.status).toBe(201);
      expect(response.body.approval_status).toBe("PENDING");
      expect(response.body.approved_by_user_id).toBeNull();
      expect(response.body.approved_at).toBeNull();

      fs.unlinkSync(testFilePath);
    });

    it("AC10.9: Non-existent qualification → 404", async () => {
      const testFilePath = path.resolve(__dirname, '../fixtures/test.pdf');
      fs.writeFileSync(testFilePath, Buffer.from('%PDF-1.4 test content'));

      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer student-token")
        .field("qualification_id", 99999) // Non-existent qualification
        .field("evidence_type", "CERTIFICATE")
        .attach("file", testFilePath);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Qualification not found.");

      fs.unlinkSync(testFilePath);
    });

    it("AC10.10: Unauthorized access → 401", async () => {
      const testFilePath = path.resolve(__dirname, '../fixtures/test.pdf');
      fs.writeFileSync(testFilePath, Buffer.from('%PDF-1.4 test content'));

      const response = await request(app)
        .post("/qualifications/me/upload")
        .set("Authorization", "Bearer invalid-token")
        .field("qualification_id", testData.qualifications.qual1.qualification_id)
        .field("evidence_type", "CERTIFICATE")
        .attach("file", testFilePath);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Unauthorized");

      fs.unlinkSync(testFilePath);
    });
  });
});
