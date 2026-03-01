const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindByPk = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserQualificationCreate = jest.fn();
const mockUserQualificationFindOne = jest.fn();
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

jest.mock("../../app/models/index.js", () => ({
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
    },
  },
}));

const {
  createQualification,
  listQualifications,
  updateQualification,
  deleteQualification,
  uploadQualificationDocument,
} = require("../../app/controllers/qualification.controller.js");

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
