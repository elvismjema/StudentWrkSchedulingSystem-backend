import db from "../models/index.js";
import { Op } from "sequelize";

const Shift = db.shift;

// Helper function to validate buffer time between shifts
export const validateBufferTime = async (departmentId, shiftDate, startTime, endTime, assignedUserId, excludeShiftId = null) => {
  // Get department buffer time setting
  const department = await db.department.findByPk(departmentId);
  if (!department || !department.buffer_time_minutes || department.buffer_time_minutes === 0) {
    return { valid: true }; // No buffer time configured
  }

  const bufferMinutes = department.buffer_time_minutes;

  // If no user is assigned or no date, skip validation
  if (!assignedUserId || !shiftDate) {
    return { valid: true };
  }

  // Find all shifts for this user on the same date
  const whereClause = {
    assigned_user_id: assignedUserId,
    shift_date: shiftDate
  };

  // Exclude current shift if updating
  if (excludeShiftId) {
    whereClause.shift_id = { [Op.ne]: excludeShiftId };
  }

  const existingShifts = await Shift.findAll({
    where: whereClause,
    order: [['start_time', 'ASC']]
  });

  // Convert time strings to minutes for easier comparison
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const newStartMinutes = timeToMinutes(startTime);
  const newEndMinutes = timeToMinutes(endTime);

  // Check buffer time with each existing shift
  for (const existingShift of existingShifts) {
    const existingStartMinutes = timeToMinutes(existingShift.start_time);
    const existingEndMinutes = timeToMinutes(existingShift.end_time);

    // Check if new shift ends too close to when existing shift starts
    const timeBetweenShifts1 = existingStartMinutes - newEndMinutes;
    // Check if existing shift ends too close to when new shift starts
    const timeBetweenShifts2 = newStartMinutes - existingEndMinutes;

    if (timeBetweenShifts1 >= 0 && timeBetweenShifts1 < bufferMinutes) {
      return {
        valid: false,
        message: `Buffer time violation: Only ${timeBetweenShifts1} minutes between new shift end (${endTime}) and existing shift start (${existingShift.start_time}). Required buffer: ${bufferMinutes} minutes.`
      };
    }

    if (timeBetweenShifts2 >= 0 && timeBetweenShifts2 < bufferMinutes) {
      return {
        valid: false,
        message: `Buffer time violation: Only ${timeBetweenShifts2} minutes between existing shift end (${existingShift.end_time}) and new shift start (${startTime}). Required buffer: ${bufferMinutes} minutes.`
      };
    }

    // Check for overlap
    if (
      (newStartMinutes >= existingStartMinutes && newStartMinutes < existingEndMinutes) ||
      (newEndMinutes > existingStartMinutes && newEndMinutes <= existingEndMinutes) ||
      (newStartMinutes <= existingStartMinutes && newEndMinutes >= existingEndMinutes)
    ) {
      return {
        valid: false,
        message: `Shift overlap detected: New shift (${startTime}-${endTime}) overlaps with existing shift (${existingShift.start_time}-${existingShift.end_time}).`
      };
    }
  }

  return { valid: true };
};

// Create and Save a new Shift
export const createShift = async (req, res) => {
  try {
    // Validate request
    if (!req.body.department_id || !req.body.position_id || !req.body.start_time || !req.body.end_time || !req.body.created_by) {
      return res.status(400).send({
        message: "Missing required fields: department_id, position_id, start_time, end_time, created_by"
      });
    }

    // If shift_date is provided, ignore day_of_week
    if (req.body.shift_date) {
      req.body.day_of_week = null;
    }

    // Validate buffer time if shift is assigned and has a date
    if (req.body.assigned_user_id && req.body.shift_date) {
      const bufferValidation = await validateBufferTime(
        req.body.department_id,
        req.body.shift_date,
        req.body.start_time,
        req.body.end_time,
        req.body.assigned_user_id
      );

      if (!bufferValidation.valid) {
        return res.status(409).send({
          success: false,
          message: bufferValidation.message,
          conflictType: 'buffer_time_violation'
        });
      }
    }

    // Create a Shift
    const shift = {
      department_id: req.body.department_id,
      position_id: req.body.position_id,
      template_id: req.body.template_id,
      day_of_week: req.body.day_of_week,
      shift_date: req.body.shift_date,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      assigned_user_id: req.body.assigned_user_id,
      trade_status: req.body.trade_status,
      created_by: req.body.created_by,
      is_template: req.body.is_template || false,
      is_published: req.body.is_published || false,
      is_recurring: req.body.is_recurring || false,
      recurrence_pattern: req.body.recurrence_pattern,
      recurrence_start_date: req.body.recurrence_start_date,
      recurrence_end_date: req.body.recurrence_end_date
    };

    // Save Shift in the database
    const createdShift = await Shift.create(shift);
    
    // Return the created shift with associations
    const shiftWithAssociations = await Shift.findByPk(createdShift.shift_id, {
      include: [
        { model: db.department, as: 'department' },
        { model: db.position, as: 'position' },
        { model: db.scheduleTemplate, as: 'template' },
        { model: db.user, as: 'assignedUser' },
        { model: db.user, as: 'creator' }
      ]
    });

    res.status(201).send(shiftWithAssociations);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the Shift."
    });
  }
};

// Retrieve all Shifts from the database with filters
export const listShifts = async (req, res) => {
  try {
    const { department_id, assigned_user_id, is_published, shift_date } = req.query;
    const where = {};

    if (department_id) where.department_id = department_id;
    if (assigned_user_id) where.assigned_user_id = assigned_user_id;
    if (is_published !== undefined) where.is_published = is_published === 'true';
    if (shift_date) where.shift_date = shift_date;

    const shifts = await Shift.findAll({
      where,
      include: [
        { model: db.department, as: 'department' },
        { model: db.position, as: 'position' },
        { model: db.scheduleTemplate, as: 'template' },
        { model: db.user, as: 'assignedUser' },
        { model: db.user, as: 'creator' }
      ],
      order: [['shift_date', 'ASC'], ['start_time', 'ASC']]
    });

    res.send(shifts);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving shifts."
    });
  }
};

// Find a single Shift with an id
export const getShiftById = async (req, res) => {
  const id = req.params.id;

  try {
    const shift = await Shift.findByPk(id, {
      include: [
        { model: db.department, as: 'department' },
        { model: db.position, as: 'position' },
        { model: db.scheduleTemplate, as: 'template' },
        { model: db.user, as: 'assignedUser' },
        { model: db.user, as: 'creator' }
      ]
    });

    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`
      });
    }

    res.send(shift);
  } catch (err) {
    res.status(500).send({
      message: `Error retrieving Shift with id=${id}`
    });
  }
};

// Update a Shift by the id in the request
export const updateShift = async (req, res) => {
  const id = req.params.id;

  try {
    // Get the existing shift first
    const existingShift = await Shift.findByPk(id);
    
    if (!existingShift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`
      });
    }

    // Validate buffer time if updating assigned user, date, or times
    const departmentId = req.body.department_id || existingShift.department_id;
    const assignedUserId = req.body.assigned_user_id !== undefined ? req.body.assigned_user_id : existingShift.assigned_user_id;
    const shiftDate = req.body.shift_date || existingShift.shift_date;
    const startTime = req.body.start_time || existingShift.start_time;
    const endTime = req.body.end_time || existingShift.end_time;

    if (assignedUserId && shiftDate) {
      const bufferValidation = await validateBufferTime(
        departmentId,
        shiftDate,
        startTime,
        endTime,
        assignedUserId,
        id // Exclude current shift from validation
      );

      if (!bufferValidation.valid) {
        return res.status(409).send({
          success: false,
          message: bufferValidation.message,
          conflictType: 'buffer_time_violation'
        });
      }
    }

    const num = await Shift.update(req.body, {
      where: { shift_id: id }
    });

    if (num == 1) {
      const updatedShift = await Shift.findByPk(id, {
        include: [
          { model: db.department, as: 'department' },
          { model: db.position, as: 'position' },
          { model: db.scheduleTemplate, as: 'template' },
          { model: db.user, as: 'assignedUser' },
          { model: db.user, as: 'creator' }
        ]
      });
      res.send(updatedShift);
    } else {
      res.status(404).send({
        message: `Cannot update Shift with id=${id}. Shift was not found or req.body is empty!`
      });
    }
  } catch (err) {
    res.status(500).send({
      message: `Error updating Shift with id=${id}: ${err.message}`
    });
  }
};

// Delete a Shift with the specified id in the request
export const deleteShift = async (req, res) => {
  const id = req.params.id;

  try {
    const num = await Shift.destroy({
      where: { shift_id: id }
    });

    if (num == 1) {
      res.send({
        message: "Shift was deleted successfully!"
      });
    } else {
      res.status(404).send({
        message: `Cannot delete Shift with id=${id}. Shift was not found!`
      });
    }
  } catch (err) {
    res.status(500).send({
      message: `Could not delete Shift with id=${id}: ${err.message}`
    });
  }
};

// Preview shifts based on template and date range
export const previewShifts = async (req, res) => {
  try {
    const { 
      template_id, 
      start_date, 
      end_date, 
      department_id, 
      position_id, 
      assigned_user_id 
    } = req.body;

    if (!template_id || !start_date || !end_date) {
      return res.status(400).send({
        message: "template_id, start_date, and end_date are required"
      });
    }

    // Get the template shifts
    const templateShifts = await Shift.findAll({
      where: { 
        template_id,
        is_template: true,
        ...(department_id && { department_id }),
        ...(position_id && { position_id })
      },
      include: [
        { model: db.department, as: 'department' },
        { model: db.position, as: 'position' }
      ]
    });

    if (!templateShifts.length) {
      return res.status(404).send({
        message: "No template shifts found"
      });
    }

    // Generate shifts based on the template and date range
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const generatedShifts = [];

    // For each day in the date range
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Find template shifts for this day of the week
      const shiftsForDay = templateShifts.filter(shift => 
        shift.day_of_week === dayOfWeek
      );

      // Create a shift for each template shift
      for (const templateShift of shiftsForDay) {
        const shiftDate = new Date(date);
        
        generatedShifts.push({
          department_id: templateShift.department_id,
          position_id: templateShift.position_id,
          template_id: templateShift.template_id,
          shift_date: shiftDate.toISOString().split('T')[0],
          start_time: templateShift.start_time,
          end_time: templateShift.end_time,
          assigned_user_id: assigned_user_id || templateShift.assigned_user_id,
          created_by: req.user?.id || templateShift.created_by,
          is_published: false,
          is_recurring: false,
          department: templateShift.department,
          position: templateShift.position
        });
      }
    }

    res.send(generatedShifts);
  } catch (err) {
    res.status(500).send({
      message: `Error generating shift preview: ${err.message}`
    });
  }
};
