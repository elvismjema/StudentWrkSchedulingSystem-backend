import db from "../models/index.js";
import fs from "fs/promises";
import path from "path";

const Qualification = db.qualification;
const User = db.user;
const UserQualification = db.userQualification;
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "qualifications");
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

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
