import db from "../models/index.js";
import fs from "fs/promises";
import path from "path";
import { Op } from "sequelize";
import multer from "multer";

const Qualification = db.qualification;
const User = db.user;
const UserQualification = db.userQualification;

const Position = db.position;
const PositionQualification = db.positionQualification;
const Shift = db.shift;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/qualifications';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, PNG, and JPEG files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Export the upload middleware
export { upload };

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "qualifications");
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const formatUserQualification = (userQualification) => ({
  user_qualification_id: userQualification.id,
  qualification_id: userQualification.qualification_id,
  qualification_name: userQualification?.qualification?.qualification_name || null,
  description: userQualification?.qualification?.description || null,
  requires_document: Boolean(userQualification?.qualification?.requires_document),
  approval_status: String(userQualification.approval_status || "pending").toLowerCase(),
  document_name: userQualification.file_name,
  document_path: userQualification.file_path,
  mime_type: userQualification.mime_type,
  uploaded_at: userQualification.uploaded_at,
  approved_at: userQualification.approved_at,
  rejection_reason: userQualification.rejection_reason,
  notes: userQualification.notes,
});

// Get all students with their qualifications (optional filter by qualificationId)
export const getStudentsWithQualifications = async (req, res) => {
  try {
    const { qualificationId, status } = req.query;
    const where = {};
    
    if (qualificationId) {
      where.qualification_id = qualificationId;
    }
    
    if (status) {
      where.approval_status = status;
    }
    
    const userQualifications = await db.userQualification.findAll({
      where,
      include: [
        {
          model: db.user,
          as: "user",
          attributes: ["id", "fName", "lName", "email"]
        },
        {
          model: db.qualification,
          as: "qualification"
        }
      ],
      order: [["uploaded_at", "DESC"]]
    });
    
    const formattedData = userQualifications.map(formatUserQualification);
    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching students with qualifications:", error);
    res.status(500).json({
      message: "Error retrieving qualifications",
      error: error.message
    });
  }
};

export const listStudentsWithQualifications = async (req, res) => {

  try {
    const { qualificationId, status } = req.query;
    const where = {};

    if (qualificationId) {
      where.qualification_id = Number(qualificationId);
    }

    if (status) {
      const normalizedStatus = String(status).toLowerCase();
      if (!["pending", "approved", "rejected"].includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter. Allowed values: pending, approved, rejected",
        });
      }
      where.approval_status = normalizedStatus;
    }

    const records = await UserQualification.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fName", "lName", "email"],
        },
        {
          model: Qualification,
          as: "qualification",
          attributes: ["qualification_id", "qualification_name", "requires_document"],
        },
      ],
      order: [["uploaded_at", "DESC"]],
    });

    const studentsById = new Map();

    records.forEach((record) => {
      if (!record.user) return;

      const userId = Number(record.user_id);
      if (!studentsById.has(userId)) {
        studentsById.set(userId, {
          user_id: userId,
          first_name: record.user.fName,
          last_name: record.user.lName,
          email: record.user.email,
          qualifications: [],
        });
      }

      studentsById.get(userId).qualifications.push({
        qualification_id: record.qualification_id,
        qualification_name: record?.qualification?.qualification_name || null,
        requires_document: Boolean(record?.qualification?.requires_document),
        approval_status: String(record.approval_status || "pending").toLowerCase(),
      });
    });

    return res.status(200).json({
      success: true,
      data: Array.from(studentsById.values()),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch students with qualifications",
      error: error.message,
    });
  }
};

export const getStudentQualifications = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const user = await User.findByPk(userId, {
      attributes: ["id", "fName", "lName", "email"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const qualifications = await UserQualification.findAll({
      where: {
        user_id: userId,
        approval_status: {
          [Op.in]: ["pending", "approved", "rejected"],
        },
      },
      include: [
        {
          model: Qualification,
          as: "qualification",
          attributes: ["qualification_id", "qualification_name", "description", "requires_document"],
        },
      ],
      order: [["uploaded_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: qualifications.map(formatUserQualification),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student qualifications",
      error: error.message,
    });
  }
};

export const reviewQualificationDocument = async (req, res) => {
  try {
    const qualificationRecordId = Number(req.params.id);
    const statusRaw = String(req.body.approval_status || "").toLowerCase();
    const rejectionReason = String(req.body.rejection_reason || "").trim();

    if (!qualificationRecordId) {
      return res.status(400).json({
        success: false,
        message: "Invalid user qualification id",
      });
    }

    if (!["approved", "rejected"].includes(statusRaw)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval_status. Allowed values: approved, rejected",
      });
    }

    if (statusRaw === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required when rejecting a qualification",
      });
    }

    const qualificationRecord = await UserQualification.findByPk(qualificationRecordId, {
      include: [
        {
          model: Qualification,
          as: "qualification",
          attributes: ["qualification_id", "qualification_name", "description", "requires_document"],
        },
      ],
    });

    if (!qualificationRecord) {
      return res.status(404).json({
        success: false,
        message: "User qualification record not found",
      });
    }

    qualificationRecord.approval_status = statusRaw;

    if (statusRaw === "approved") {
      qualificationRecord.approved_by = req.auth?.userId || null;
      qualificationRecord.approved_at = new Date();
      qualificationRecord.rejection_reason = null;
    } else {
      qualificationRecord.approved_by = null;
      qualificationRecord.approved_at = null;
      qualificationRecord.rejection_reason = rejectionReason;
    }

    await qualificationRecord.save();

    return res.status(200).json({
      success: true,
      message:
        statusRaw === "approved"
          ? "Qualification document approved"
          : "Qualification document rejected",
      data: formatUserQualification(qualificationRecord),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to review qualification document",
      error: error.message,
    });
  }
};

// Create and save a new qualification
export const createQualification = async (req, res) => {
  try {
    const {
      qualification_name,
      description,
      requires_document
    } = req.body;

    if (!qualification_name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: qualification_name"
      });
    }

    const qualification = await Qualification.create({
      qualification_name,
      description,
      requires_document
    });

    return res.status(201).json({
      success: true,
      data: qualification
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create qualification",
      error: error.message
    });
  }
};

// Retrieve all qualifications
export const listQualifications = async (req, res) => {
  try {
    const qualifications = await Qualification.findAll({
      order: [["qualification_name", "ASC"]]
    });

    return res.status(200).json({
      success: true,
      data: qualifications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch qualifications",
      error: error.message
    });
  }
};

// Retrieve a single qualification by id
export const getQualificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const qualification = await Qualification.findByPk(id);

    if (!qualification) {
      return res.status(404).json({
        success: false,
        message: "Qualification not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: qualification
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch qualification",
      error: error.message
    });
  }
};

// Update a qualification
export const updateQualification = async (req, res) => {
  try {
    const { id } = req.params;

    const qualification = await Qualification.findByPk(id);
    if (!qualification) {
      return res.status(404).json({
        success: false,
        message: "Qualification not found"
      });
    }

    const updatableFields = [
      "qualification_name",
      "description",
      "requires_document"
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        qualification[field] = req.body[field];
      }
    });

    await qualification.save();

    return res.status(200).json({
      success: true,
      data: qualification
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update qualification",
      error: error.message
    });
  }
};

// Delete a qualification by id
export const deleteQualification = async (req, res) => {
  try {
    const { id } = req.params;
    const qualification = await Qualification.findByPk(id);

    if (!qualification) {
      return res.status(404).json({
        success: false,
        message: "Qualification not found"
      });
    }

    await qualification.destroy();

    return res.status(200).json({
      success: true,
      message: "Qualification deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete qualification",
      error: error.message
    });
  }
};

// Upload a qualification document and link it to a user + qualification record
export const uploadQualificationDocument = async (req, res) => {
  try {
    const {
      user_id,
      qualification_id,
      file_name,
      file_content_base64,
      mime_type,
      notes,
    } = req.body;

    if (!user_id || !qualification_id || !file_name || !file_content_base64) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: user_id, qualification_id, file_name, file_content_base64",
      });
    }

    if (mime_type && !ALLOWED_MIME_TYPES.has(mime_type)) {
      return res.status(400).json({
        success: false,
        message:
          "Unsupported file type. Allowed types: application/pdf, image/png, image/jpeg",
      });
    }

    const [user, qualification] = await Promise.all([
      User.findByPk(user_id),
      Qualification.findByPk(qualification_id),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!qualification) {
      return res.status(404).json({
        success: false,
        message: "Qualification not found",
      });
    }

    let buffer;
    try {
      const normalizedBase64 = String(file_content_base64).replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
        throw new Error("Invalid base64 charset");
      }

      buffer = Buffer.from(file_content_base64, "base64");
      if (!buffer.length) {
        throw new Error("Empty decoded buffer");
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid file_content_base64 payload",
      });
    }

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(400).json({
        success: false,
        message: `File exceeds maximum allowed size of ${MAX_UPLOAD_BYTES} bytes`,
      });
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedFileName = `${user_id}-${qualification_id}-${Date.now()}-${safeFileName}`;
    const relativePath = path.join("uploads", "qualifications", storedFileName);
    const absolutePath = path.resolve(process.cwd(), relativePath);

    await fs.writeFile(absolutePath, buffer);

    const existingLink = await UserQualification.findOne({
      where: { user_id, qualification_id },
    });

    if (existingLink) {
      if (existingLink.file_path) {
        const previousAbsolutePath = path.resolve(process.cwd(), existingLink.file_path);
        await fs.unlink(previousAbsolutePath).catch(() => null);
      }

      existingLink.file_name = file_name;
      existingLink.file_path = relativePath;
      existingLink.mime_type = mime_type || null;
      existingLink.notes = notes || null;
      existingLink.uploaded_at = new Date();
      existingLink.approval_status = "pending";
      existingLink.approved_at = null;
      existingLink.approved_by = null;
      existingLink.rejection_reason = null;
      await existingLink.save();

      return res.status(200).json({
        success: true,
        message: "Qualification document replaced and relinked successfully",
        data: existingLink,
      });
    }

    const linkedRecord = await UserQualification.create({
      user_id,
      qualification_id,
      file_name: file_name,
      file_path: relativePath,
      mime_type: mime_type || null,
      notes: notes || null,
      approval_status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
    });

    return res.status(201).json({
      success: true,
      message: "Qualification document uploaded and linked successfully",
      data: linkedRecord,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to upload qualification document",
      error: error.message,
    });
  }
};
