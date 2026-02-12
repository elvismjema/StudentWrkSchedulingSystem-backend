import db from "../models/index.js";

// Create a new schedule template
export const createScheduleTemplate = async (req, res) => {
  try {
    const { department_id, template_name, recurrence_type, created_by } = req.body;

    // Validate required fields
    if (!department_id || !template_name || !recurrence_type || !created_by) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: department_id, template_name, recurrence_type, and created_by are required" 
      });
    }

    // Validate recurrence_type
    const validRecurrenceTypes = ["weekly", "biweekly", "monthly"];
    if (!validRecurrenceTypes.includes(recurrence_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid recurrence_type. Must be one of: weekly, biweekly, monthly"
      });
    }

    const scheduleTemplate = await db.scheduleTemplate.create({
      department_id,
      template_name,
      recurrence_type,
      created_by,
      created_at: new Date(),
      updated_at: new Date()
    });

    return res.status(201).json({
      success: true,
      data: scheduleTemplate
    });
  } catch (error) {
    console.error("Error creating schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create schedule template",
      error: error.message
    });
  }
};

// Get all schedule templates with optional filters
export const listScheduleTemplates = async (req, res) => {
  try {
    const { department_id, is_active } = req.query;
    const whereClause = {};
    
    if (department_id) {
      whereClause.department_id = department_id;
    }
    
    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true';
    }

    const scheduleTemplates = await db.scheduleTemplate.findAll({
      where: whereClause,
      include: [
        { model: db.department, as: 'department' },
        { model: db.user, as: 'creator', attributes: ['user_id', 'first_name', 'last_name', 'email'] }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: scheduleTemplates
    });
  } catch (error) {
    console.error("Error fetching schedule templates:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch schedule templates",
      error: error.message
    });
  }
};

// Get a single schedule template by ID
export const getScheduleTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const scheduleTemplate = await db.scheduleTemplate.findByPk(id, {
      include: [
        { model: db.department, as: 'department' },
        { model: db.user, as: 'creator', attributes: ['user_id', 'first_name', 'last_name', 'email'] }
      ]
    });

    if (!scheduleTemplate) {
      return res.status(404).json({
        success: false,
        message: "Schedule template not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: scheduleTemplate
    });
  } catch (error) {
    console.error("Error fetching schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch schedule template",
      error: error.message
    });
  }
};

// Update a schedule template
export const updateScheduleTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id, template_name, recurrence_type } = req.body;

    const scheduleTemplate = await db.scheduleTemplate.findByPk(id);
    
    if (!scheduleTemplate) {
      return res.status(404).json({
        success: false,
        message: "Schedule template not found"
      });
    }

    // Update fields if provided
    if (department_id !== undefined) scheduleTemplate.department_id = department_id;
    if (template_name !== undefined) scheduleTemplate.template_name = template_name;
    if (recurrence_type !== undefined) {
      // Validate recurrence_type if provided
      const validRecurrenceTypes = ["weekly", "biweekly", "monthly"];
      if (!validRecurrenceTypes.includes(recurrence_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid recurrence_type. Must be one of: weekly, biweekly, monthly"
        });
      }
      scheduleTemplate.recurrence_type = recurrence_type;
    }

    scheduleTemplate.updated_at = new Date();
    await scheduleTemplate.save();

    return res.status(200).json({
      success: true,
      data: scheduleTemplate
    });
  } catch (error) {
    console.error("Error updating schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update schedule template",
      error: error.message
    });
  }
};

// Set schedule template active status
export const setScheduleTemplateActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: "is_active is required in the request body"
      });
    }

    const scheduleTemplate = await db.scheduleTemplate.findByPk(id);
    
    if (!scheduleTemplate) {
      return res.status(404).json({
        success: false,
        message: "Schedule template not found"
      });
    }

    scheduleTemplate.is_active = is_active;
    scheduleTemplate.updated_at = new Date();
    await scheduleTemplate.save();

    return res.status(200).json({
      success: true,
      data: scheduleTemplate
    });
  } catch (error) {
    console.error("Error updating schedule template status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update schedule template status",
      error: error.message
    });
  }
};

// Delete a schedule template
export const deleteScheduleTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const scheduleTemplate = await db.scheduleTemplate.findByPk(id);
    
    if (!scheduleTemplate) {
      return res.status(404).json({
        success: false,
        message: "Schedule template not found"
      });
    }

    await scheduleTemplate.destroy();

    return res.status(200).json({
      success: true,
      message: "Schedule template deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting schedule template:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete schedule template",
      error: error.message
    });
  }
};
