
import request from "supertest";
import db from "app/models/index.js";
import app from "../../server.js";
import { setupTestData } from "../helpers/testData.js";
import { createQualification, listQualifications, updateQualification, deleteQualification, uploadQualificationDocument, listStudentsWithQualifications, getStudentQualifications, reviewQualificationDocument } from "app/controllers/qualification.controller.js";

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

const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindByPk = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserQualificationCreate = jest.fn();
const mockUserQualificationFindOne = jest.fn();
const mockUserQualificationFindAll = jest.fn();
const mockUserQualificationFindByPk = jest.fn();
const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockUnlink = jest.fn();

jest.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    unlink: mockUnlink,
  },
}));

jest.mock("app/models/index.js", () => ({
  __esModule: true,
  default: {
    qualification: {
      create: mockCreate,
      findAll: mockFindAll,
      findByPk: mockFindByPk,
    },
    user: {
      findByPk: mockUserFindByPk,
    },
    userQualification: {
      create: mockUserQualificationCreate,
      findOne: mockUserQualificationFindOne,
      findAll: mockUserQualificationFindAll,
      findByPk: mockUserQualificationFindByPk,
    },
  },
}));


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

const testQualification = {
  qualification_id: 1,
  qualification_name: "CPR Certification",
  description: "Valid CPR certification required",
  requires_document: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserQualificationFindOne.mockResolvedValue(null);
  mockUserQualificationFindAll.mockResolvedValue([]);
});

describe("create qualification", () => {
  it("Given: The backend is running, When: I make a call to add a Qualification with required fields, Then: The Qualification is persisted in the database", async () => {
    mockCreate.mockResolvedValue(testQualification);
    const req = mockReq({
      qualification_name: "CPR Certification",
      description: "Valid CPR certification required",
      requires_document: true,
    });
    const res = mockRes();

    await createQualification(req, res);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        qualification_name: "CPR Certification",
        description: "Valid CPR certification required",
        requires_document: true,
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: testQualification })
    );
  });

  it("returns 400 when qualification_name is missing", async () => {
    const req = mockReq({ description: "Some description" });
    const res = mockRes();

    await createQualification(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockCreate.mockRejectedValue(new Error("Database error"));
    const req = mockReq({ qualification_name: "CPR Certification" });
    const res = mockRes();

    await createQualification(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("delete qualification", () => {
  it("Given: The backend is running, When: I make a call to delete a Qualification, Then: The Qualification is removed from the database", async () => {
    const mockDestroy = jest.fn().mockResolvedValue(true);
    mockFindByPk.mockResolvedValue({ ...testQualification, destroy: mockDestroy });
    const req = mockReq({}, { id: "1" });
    const res = mockRes();

    await deleteQualification(req, res);

    expect(mockFindByPk).toHaveBeenCalledWith("1");
    expect(mockDestroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.stringContaining("deleted") })
    );
  });

  it("returns 404 when qualification not found", async () => {
    mockFindByPk.mockResolvedValue(null);
    const req = mockReq({}, { id: "999" });
    const res = mockRes();

    await deleteQualification(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 on database error", async () => {
    mockFindByPk.mockRejectedValue(new Error("Database error"));
    const req = mockReq({}, { id: "1" });
    const res = mockRes();

    await deleteQualification(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("list qualifications", () => {
  it("Given: The backend is running, When: I make a call to Get the Qualifications, Then: List of Qualifications are returned", async () => {
    mockFindAll.mockResolvedValue([testQualification]);
    const req = mockReq({}, {}, {});
    const res = mockRes();

    await listQualifications(req, res);

    expect(mockFindAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [testQualification],
      })
    );
  });

  it("returns empty array when no qualifications exist", async () => {
    mockFindAll.mockResolvedValue([]);
    const req = mockReq({}, {}, {});
    const res = mockRes();

    await listQualifications(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: [] })
    );
  });

  it("returns 500 on database error", async () => {
    mockFindAll.mockRejectedValue(new Error("Database error"));
    const req = mockReq({}, {}, {});
    const res = mockRes();

    await listQualifications(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("update qualification", () => {
  it("Given: The backend is running, When: I make a call to update a Qualification with required fields, Then: The Qualification is persisted in the database", async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    mockFindByPk.mockResolvedValue({
      ...testQualification,
      save: mockSave,
    });
    const req = mockReq(
      { qualification_name: "Updated CPR", requires_document: false },
      { id: "1" }
    );
    const res = mockRes();

    await updateQualification(req, res);

    expect(mockFindByPk).toHaveBeenCalledWith("1");
    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it("returns 404 when qualification not found", async () => {
    mockFindByPk.mockResolvedValue(null);
    const req = mockReq({ qualification_name: "Updated" }, { id: "999" });
    const res = mockRes();

    await updateQualification(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 on database error", async () => {
    mockFindByPk.mockRejectedValue(new Error("Database error"));
    const req = mockReq({ qualification_name: "Updated" }, { id: "1" });
    const res = mockRes();

    await updateQualification(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("list students with qualifications", () => {
  it("returns grouped students with qualification summaries", async () => {
    mockUserQualificationFindAll.mockResolvedValue([
      {
        user_id: 10,
        approval_status: "pending",
        user: { id: 10, fName: "Ada", lName: "Lovelace", email: "ada@oc.edu" },
        qualification: { qualification_id: 1, qualification_name: "CPR", requires_document: true },
        qualification_id: 1,
      },
      {
        user_id: 10,
        approval_status: "approved",
        user: { id: 10, fName: "Ada", lName: "Lovelace", email: "ada@oc.edu" },
        qualification: { qualification_id: 2, qualification_name: "First Aid", requires_document: true },
        qualification_id: 2,
      },
    ]);

    const req = mockReq({}, {}, {});
    const res = mockRes();

    await listStudentsWithQualifications(req, res);

    expect(mockUserQualificationFindAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [
          expect.objectContaining({
            user_id: 10,
            first_name: "Ada",
            qualifications: expect.arrayContaining([
              expect.objectContaining({ qualification_id: 1, approval_status: "pending" }),
              expect.objectContaining({ qualification_id: 2, approval_status: "approved" }),
            ]),
          }),
        ],
      }),
    );
  });
});

describe("get student qualifications", () => {
  it("returns mapped qualification records for a student", async () => {
    mockUserFindByPk.mockResolvedValue({ id: 10, fName: "Ada", lName: "Lovelace" });
    mockUserQualificationFindAll.mockResolvedValue([
      {
        id: 22,
        qualification_id: 1,
        file_name: "cpr.pdf",
        file_path: "uploads/qualifications/cpr.pdf",
        mime_type: "application/pdf",
        uploaded_at: new Date("2026-01-01T00:00:00.000Z"),
        approval_status: "pending",
        approved_at: null,
        rejection_reason: null,
        notes: null,
        qualification: {
          qualification_id: 1,
          qualification_name: "CPR",
          description: "CPR cert",
          requires_document: true,
        },
      },
    ]);

    const req = mockReq({}, { userId: "10" });
    const res = mockRes();

    await getStudentQualifications(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [
          expect.objectContaining({
            user_qualification_id: 22,
            qualification_name: "CPR",
            approval_status: "pending",
          }),
        ],
      }),
    );
  });
});

describe("review qualification document", () => {
  it("updates status to approved", async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    mockUserQualificationFindByPk.mockResolvedValue({
      id: 12,
      qualification_id: 1,
      approval_status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      file_name: "doc.pdf",
      file_path: "uploads/qualifications/doc.pdf",
      mime_type: "application/pdf",
      uploaded_at: new Date("2026-01-01T00:00:00.000Z"),
      notes: null,
      qualification: {
        qualification_id: 1,
        qualification_name: "CPR",
        description: "CPR cert",
        requires_document: true,
      },
      save: mockSave,
    });

    const req = mockReq({ approval_status: "approved" }, { id: "12" });
    req.auth = { userId: 5 };
    const res = mockRes();

    await reviewQualificationDocument(req, res);

    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ approval_status: "approved" }),
      }),
    );
  });

  it("requires rejection reason when status is rejected", async () => {
    const req = mockReq({ approval_status: "rejected" }, { id: "12" });
    const res = mockRes();

    await reviewQualificationDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUserQualificationFindByPk).not.toHaveBeenCalled();
  });
});

describe("upload qualification document", () => {
  it("Given: upload payload is valid, When: upload endpoint is called, Then: file is stored and linked in database", async () => {
    mockUserFindByPk.mockResolvedValue({ id: 1, email: "student@oc.edu" });
    mockFindByPk.mockResolvedValue(testQualification);
    mockMkdir.mockResolvedValue(true);
    mockWriteFile.mockResolvedValue(true);
    mockUserQualificationFindOne.mockResolvedValue(null);
    mockUserQualificationCreate.mockResolvedValue({
      id: 10,
      user_id: 1,
      qualification_id: 1,
      file_name: "cpr.pdf",
      file_path: "uploads/qualifications/1-1-123456-cpr.pdf",
    });
    const req = mockReq({
      user_id: 1,
      qualification_id: 1,
      file_name: "cpr.pdf",
      file_content_base64: Buffer.from("fake-file-content").toString("base64"),
      mime_type: "application/pdf",
    });
    const res = mockRes();

    await uploadQualificationDocument(req, res);

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockUserQualificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 1,
        qualification_id: 1,
        file_name: "cpr.pdf",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 10 }),
      }),
    );
  });

  it("returns 400 when required upload fields are missing", async () => {
    const req = mockReq({
      user_id: 1,
      qualification_id: 1,
      file_name: "missing-content.pdf",
    });
    const res = mockRes();

    await uploadQualificationDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUserQualificationCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for unsupported file mime type", async () => {
    mockUserFindByPk.mockResolvedValue({ id: 1 });
    mockFindByPk.mockResolvedValue(testQualification);
    const req = mockReq({
      user_id: 1,
      qualification_id: 1,
      file_name: "cpr.exe",
      file_content_base64: Buffer.from("fake-file-content").toString("base64"),
      mime_type: "application/x-msdownload",
    });
    const res = mockRes();

    await uploadQualificationDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("returns 400 when file exceeds max allowed size", async () => {
    mockUserFindByPk.mockResolvedValue({ id: 1 });
    mockFindByPk.mockResolvedValue(testQualification);
    const overLimitBuffer = Buffer.alloc((5 * 1024 * 1024) + 1, 1);
    const req = mockReq({
      user_id: 1,
      qualification_id: 1,
      file_name: "large.pdf",
      file_content_base64: overLimitBuffer.toString("base64"),
      mime_type: "application/pdf",
    });
    const res = mockRes();

    await uploadQualificationDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("returns 404 when user does not exist", async () => {
    mockUserFindByPk.mockResolvedValue(null);
    const req = mockReq({
      user_id: 999,
      qualification_id: 1,
      file_name: "cpr.pdf",
      file_content_base64: Buffer.from("fake-file-content").toString("base64"),
    });
    const res = mockRes();

    await uploadQualificationDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "User not found" }),
    );
  });

  it("returns 404 when qualification does not exist", async () => {
    mockUserFindByPk.mockResolvedValue({ id: 1 });
    mockFindByPk.mockResolvedValue(null);
    const req = mockReq({
      user_id: 1,
      qualification_id: 999,
      file_name: "cpr.pdf",
      file_content_base64: Buffer.from("fake-file-content").toString("base64"),
    });
    const res = mockRes();

    await uploadQualificationDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Qualification not found" }),
    );
  });

  it("replaces existing linked qualification document when one already exists", async () => {
    mockUserFindByPk.mockResolvedValue({ id: 1, email: "student@oc.edu" });
    mockFindByPk.mockResolvedValue(testQualification);
    mockMkdir.mockResolvedValue(true);
    mockWriteFile.mockResolvedValue(true);
    mockUnlink.mockResolvedValue(true);
    const mockSave = jest.fn().mockResolvedValue(true);
    mockUserQualificationFindOne.mockResolvedValue({
      id: 15,
      user_id: 1,
      qualification_id: 1,
      file_name: "old.pdf",
      file_path: "uploads/qualifications/old.pdf",
      save: mockSave,
    });

    const req = mockReq({
      user_id: 1,
      qualification_id: 1,
      file_name: "new-cpr.pdf",
      file_content_base64: Buffer.from("replacement-file").toString("base64"),
      mime_type: "application/pdf",
    });
    const res = mockRes();

    await uploadQualificationDocument(req, res);

    expect(mockUnlink).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
    expect(mockUserQualificationCreate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Qualification document replaced and relinked successfully",
      }),
    );

  });
});
