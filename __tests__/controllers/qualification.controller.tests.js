const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindByPk = jest.fn();

jest.mock("../../app/models/index.js", () => ({
  __esModule: true,
  default: {
    qualification: {
      create: mockCreate,
      findAll: mockFindAll,
      findByPk: mockFindByPk,
    },
  },
}));

const {
  createQualification,
  listQualifications,
  updateQualification,
  deleteQualification,
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
