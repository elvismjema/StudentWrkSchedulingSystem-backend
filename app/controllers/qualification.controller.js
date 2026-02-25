import db from "../models/index.js";

const Qualification = db.qualification;

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
