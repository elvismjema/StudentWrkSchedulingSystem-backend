import db from "../models/index.js";
import { Op } from "sequelize";

const Shift = db.shift;
const User = db.user;
const Qualification = db.qualification;
const UserQualification = db.userQualification;
const PositionQualification = db.positionQualification;

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
        { model: db.user, as: 'position' },
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
        { model: db.user, as: 'position' },
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
        { model: db.user, as: 'position' },
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
    // If assigning a user, validate qualifications first
    if (req.body.assigned_user_id) {
      // Find the shift with position info
      const shift = await Shift.findByPk(id, {
        include: [
          { model: db.position, as: 'position' }
        ]
      });

      if (!shift) {
        return res.status(404).send({
          message: "Shift not found."
        });
      }

      // Verify the user exists and is a student
      const user = await User.findByPk(req.body.assigned_user_id);
      if (!user) {
        return res.status(404).send({
          message: "User not found."
        });
      }

      if (user.role !== 'student') {
        return res.status(400).send({
          message: "Only students can be assigned to shifts."
        });
      }

      // Get required qualifications for the position
      const requiredQualifications = await PositionQualification.findAll({
        where: { position_id: shift.position_id },
        include: [
          {
            model: Qualification,
            as: 'qualification',
            attributes: ['qualification_id', 'qualification_name']
          }
        ]
      });

      if (requiredQualifications.length > 0) {
        // Get user's qualifications
        const userQualifications = await UserQualification.findAll({
          where: { user_id: req.body.assigned_user_id },
          include: [
            {
              model: Qualification,
              as: 'qualification',
              attributes: ['qualification_id', 'qualification_name']
            }
          ]
        });

        // Check qualification requirements
        const missingQualifications = [];
        const notApprovedQualifications = [];

        for (const requiredQual of requiredQualifications) {
          const userQual = userQualifications.find(uq => uq.qualification_id === requiredQual.qualification_id);
          
          if (!userQual) {
            missingQualifications.push({
              qualification_id: requiredQual.qualification.qualification_id,
              qualification_name: requiredQual.qualification.qualification_name
            });
          } else if (userQual.approval_status !== 'APPROVED') {
            notApprovedQualifications.push({
              qualification_id: requiredQual.qualification.qualification_id,
              qualification_name: requiredQual.qualification.qualification_name,
              approval_status: userQual.approval_status
            });
          }
        }

        if (missingQualifications.length > 0 || notApprovedQualifications.length > 0) {
          let message = 'Student cannot be assigned to this shift.';
          
          if (missingQualifications.length > 0 && notApprovedQualifications.length > 0) {
            message = `Missing ${missingQualifications.length} qualification(s) and ${notApprovedQualifications.length} qualification(s) not approved.`;
          } else if (missingQualifications.length > 0) {
            message = `Missing ${missingQualifications.length} required qualification(s).`;
          } else {
            message = `${notApprovedQualifications.length} qualification(s) not approved.`;
          }

          return res.status(400).send({
            message,
            missingQualifications,
            notApprovedQualifications
          });
        }
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
        { model: db.user, as: 'position' }
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

// Assign user to shift with qualification validation
export const assignUserToShift = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { user_id } = req.body;

    // Validate request
    if (!user_id) {
      return res.status(400).send({
        message: "Missing required field: user_id"
      });
    }

    // Find the shift
    const shift = await Shift.findByPk(shiftId, {
      include: [
        { model: db.position, as: 'position' }
      ]
    });

    if (!shift) {
      return res.status(404).send({
        message: "Shift not found."
      });
    }

    // Verify the user exists and is a student
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).send({
        message: "User not found."
      });
    }

    if (user.role !== 'student') {
      return res.status(400).send({
        message: "Only students can be assigned to shifts."
      });
    }

    // Get required qualifications for the position
    const requiredQualifications = await PositionQualification.findAll({
      where: { position_id: shift.position_id },
      include: [
        {
          model: Qualification,
          as: 'qualification',
          attributes: ['qualification_id', 'qualification_name']
        }
      ]
    });

    if (requiredQualifications.length === 0) {
      // No qualifications required, assign directly
      const updatedShift = await Shift.update(
        { assigned_user_id: user_id },
        { 
          where: { shift_id: shiftId },
          returning: true
        }
      );

      res.status(200).send({
        message: "User assigned to shift successfully.",
        shift: updatedShift[0]
      });
      return;
    }

    // Get user's qualifications
    const userQualifications = await UserQualification.findAll({
      where: { user_id: user_id },
      include: [
        {
          model: Qualification,
          as: 'qualification',
          attributes: ['qualification_id', 'qualification_name']
        }
      ]
    });

    // Check qualification requirements
    const missingQualifications = [];
    const notApprovedQualifications = [];

    for (const requiredQual of requiredQualifications) {
      const userQual = userQualifications.find(uq => uq.qualification_id === requiredQual.qualification_id);
      
      if (!userQual) {
        missingQualifications.push({
          qualification_id: requiredQual.qualification.qualification_id,
          qualification_name: requiredQual.qualification.qualification_name
        });
      } else if (userQual.approval_status !== 'APPROVED') {
        notApprovedQualifications.push({
          qualification_id: requiredQual.qualification.qualification_id,
          qualification_name: requiredQual.qualification.qualification_name,
          approval_status: userQual.approval_status
        });
      }
    }

    if (missingQualifications.length > 0 || notApprovedQualifications.length > 0) {
      let message = 'Student cannot be assigned to this shift.';
      
      if (missingQualifications.length > 0 && notApprovedQualifications.length > 0) {
        message = `Missing ${missingQualifications.length} qualification(s) and ${notApprovedQualifications.length} qualification(s) not approved.`;
      } else if (missingQualifications.length > 0) {
        message = `Missing ${missingQualifications.length} required qualification(s).`;
      } else {
        message = `${notApprovedQualifications.length} qualification(s) not approved.`;
      }

      return res.status(400).send({
        message,
        missingQualifications,
        notApprovedQualifications
      });
    }

    // All qualifications met, assign user to shift
    const updatedShift = await Shift.update(
      { assigned_user_id: user_id },
      { 
        where: { shift_id: shiftId },
        returning: true
      }
    );

    res.status(200).send({
      message: "User assigned to shift successfully.",
      shift: updatedShift[0]
    });

  } catch (error) {
    console.error('Error assigning user to shift:', error);
    res.status(500).send({
      message: "Error assigning user to shift."
    });
  }
};
