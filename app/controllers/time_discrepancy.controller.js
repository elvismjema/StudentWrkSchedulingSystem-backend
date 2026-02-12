import db from "../models/index.js";

// Create a new time discrepancy
export const createTimeDiscrepancy = async (req, res) => {
  try {
    const { clock_record_id, user_id, shift_id, discrepancy_type, minutes_variance, resolution_notes } = req.body;

    // Validate required fields
    if (!clock_record_id || !user_id || !shift_id || !discrepancy_type || minutes_variance === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: clock_record_id, user_id, shift_id, discrepancy_type, and minutes_variance are required" 
      });
    }

    const timeDiscrepancy = await db.timeDiscrepancy.create({
      clock_record_id,
      user_id,
      shift_id,
      discrepancy_type,
      minutes_variance,
      resolution_notes: resolution_notes || null,
      created_at: new Date()
    });

    return res.status(201).json({
      success: true,
      data: timeDiscrepancy
    });
  } catch (error) {
    console.error("Error creating time discrepancy:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create time discrepancy",
      error: error.message
    });
  }
};

// Get all time discrepancies
export const listTimeDiscrepancies = async (req, res) => {
  try {
    const { resolved } = req.query;
    const whereClause = {};
    
    if (resolved !== undefined) {
      whereClause.is_resolved = resolved === 'true';
    }

    const timeDiscrepancies = await db.timeDiscrepancy.findAll({
      where: whereClause,
      include: [
        { model: db.clockRecord, as: 'clockRecord' },
        { model: db.user, as: 'user' },
        { model: db.shift, as: 'shift' },
        { model: db.user, as: 'resolver' }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: timeDiscrepancies
    });
  } catch (error) {
    console.error("Error fetching time discrepancies:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch time discrepancies",
      error: error.message
    });
  }
};

// Get time discrepancy by ID
export const getTimeDiscrepancyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const timeDiscrepancy = await db.timeDiscrepancy.findByPk(id, {
      include: [
        { model: db.clockRecord, as: 'clockRecord' },
        { model: db.user, as: 'user' },
        { model: db.shift, as: 'shift' },
        { model: db.user, as: 'resolver' }
      ]
    });

    if (!timeDiscrepancy) {
      return res.status(404).json({
        success: false,
        message: "Time discrepancy not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: timeDiscrepancy
    });
  } catch (error) {
    console.error("Error fetching time discrepancy:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch time discrepancy",
      error: error.message
    });
  }
};

// Update time discrepancy
export const updateTimeDiscrepancy = async (req, res) => {
  try {
    const { id } = req.params;
    const { discrepancy_type, minutes_variance, resolution_notes, manager_notified } = req.body;

    const timeDiscrepancy = await db.timeDiscrepancy.findByPk(id);
    
    if (!timeDiscrepancy) {
      return res.status(404).json({
        success: false,
        message: "Time discrepancy not found"
      });
    }

    // Update fields if provided
    if (discrepancy_type !== undefined) timeDiscrepancy.discrepancy_type = discrepancy_type;
    if (minutes_variance !== undefined) timeDiscrepancy.minutes_variance = minutes_variance;
    if (resolution_notes !== undefined) timeDiscrepancy.resolution_notes = resolution_notes;
    if (manager_notified !== undefined) timeDiscrepancy.manager_notified = manager_notified;

    await timeDiscrepancy.save();

    return res.status(200).json({
      success: true,
      data: timeDiscrepancy
    });
  } catch (error) {
    console.error("Error updating time discrepancy:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update time discrepancy",
      error: error.message
    });
  }
};

// Resolve time discrepancy
export const resolveTimeDiscrepancy = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved_by, resolution_notes } = req.body;

    if (!resolved_by) {
      return res.status(400).json({
        success: false,
        message: "resolved_by is required to resolve a time discrepancy"
      });
    }

    const timeDiscrepancy = await db.timeDiscrepancy.findByPk(id);
    
    if (!timeDiscrepancy) {
      return res.status(404).json({
        success: false,
        message: "Time discrepancy not found"
      });
    }

    timeDiscrepancy.is_resolved = true;
    timeDiscrepancy.resolved_by = resolved_by;
    timeDiscrepancy.resolved_at = new Date();
    
    if (resolution_notes !== undefined) {
      timeDiscrepancy.resolution_notes = resolution_notes;
    }

    await timeDiscrepancy.save();

    return res.status(200).json({
      success: true,
      data: timeDiscrepancy
    });
  } catch (error) {
    console.error("Error resolving time discrepancy:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resolve time discrepancy",
      error: error.message
    });
  }
};

// Delete time discrepancy
export const deleteTimeDiscrepancy = async (req, res) => {
  try {
    const { id } = req.params;

    const timeDiscrepancy = await db.timeDiscrepancy.findByPk(id);
    
    if (!timeDiscrepancy) {
      return res.status(404).json({
        success: false,
        message: "Time discrepancy not found"
      });
    }

    await timeDiscrepancy.destroy();

    return res.status(200).json({
      success: true,
      message: "Time discrepancy deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting time discrepancy:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete time discrepancy",
      error: error.message
    });
  }
};
