import db from "../models/index.js";

const Position = db.position;

// Create and save a new position
export const createPosition = async (req, res) => {
  try {
    const { department_id, position_name, description, color } = req.body;

    if (!department_id || !position_name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: department_id and position_name"
      });
    }

    const department = await db.department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    const position = await Position.create({
      department_id,
      position_name,
      description,
      color: color || null
    });

    const createdPosition = await Position.findByPk(position.position_id, {
      include: [{ model: db.department, as: "department" }]
    });

    return res.status(201).json({
      success: true,
      data: createdPosition
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create position",
      error: error.message
    });
  }
};

// Retrieve all positions with optional department filter
export const listPositions = async (req, res) => {
  try {
    const { department_id } = req.query;
    const where = {};

    if (department_id) {
      where.department_id = department_id;
    }

    const positions = await Position.findAll({
      where,
      include: [{ model: db.department, as: "department" }],
      order: [["position_name", "ASC"]]
    });

    return res.status(200).json({
      success: true,
      data: positions
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch positions",
      error: error.message
    });
  }
};

// Retrieve a single position by id
export const getPositionById = async (req, res) => {
  try {
    const { id } = req.params;

    const position = await Position.findByPk(id, {
      include: [{ model: db.department, as: "department" }]
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: position
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch position",
      error: error.message
    });
  }
};

// Update a position
export const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id, position_name, description } = req.body;

    const position = await Position.findByPk(id);
    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found"
      });
    }

    if (department_id !== undefined) {
      const department = await db.department.findByPk(department_id);
      if (!department) {
        return res.status(404).json({
          success: false,
          message: "Department not found"
        });
      }
      position.department_id = department_id;
    }

    if (position_name !== undefined) {
      position.position_name = position_name;
    }

    if (description !== undefined) {
      position.description = description;
    }

    const { color } = req.body;
    if (color !== undefined) {
      position.color = color || null;
    }

    position.updated_at = new Date();
    await position.save();

    const updatedPosition = await Position.findByPk(id, {
      include: [{ model: db.department, as: "department" }]
    });

    return res.status(200).json({
      success: true,
      data: updatedPosition
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update position",
      error: error.message
    });
  }
};

// Delete a position
export const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const position = await Position.findByPk(id);

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found"
      });
    }

    await position.destroy();

    return res.status(200).json({
      success: true,
      message: "Position deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete position",
      error: error.message
    });
  }
};
