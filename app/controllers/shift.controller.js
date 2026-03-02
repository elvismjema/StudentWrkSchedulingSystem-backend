import db from "../models/index.js";
import { Op } from "sequelize";

const Shift = db.shift;
const UserDepartment = db.userDepartment;
const Availability = db.availability;
const ShiftAcknowledgement = db.shiftAcknowledgement;
const Notification = db.notification;
const ShiftAudit = db.shiftAudit;

const SHIFT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  CHANGED: "changed",
  CANCELLED: "cancelled",
};

const shiftIncludes = [
  { model: db.department, as: "department" },
  { model: db.position, as: "position" },
  { model: db.scheduleTemplate, as: "template" },
  { model: db.user, as: "assignedUser" },
  { model: db.user, as: "creator" },
];

const toMinutes = (timeValue) => {
  const [hours, minutes] = String(timeValue || "00:00").split(":").map(Number);
  return (hours * 60) + (minutes || 0);
};

const getDayOfWeekFromDate = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00`);
  return date.getDay();
};

const deriveShiftStatus = (shift) => {
  if (shift?.trade_status === SHIFT_STATUS.CANCELLED) {
    return SHIFT_STATUS.CANCELLED;
  }
  if (shift?.trade_status === SHIFT_STATUS.CHANGED) {
    return SHIFT_STATUS.CHANGED;
  }
  if (shift?.is_published) {
    return SHIFT_STATUS.PUBLISHED;
  }
  return SHIFT_STATUS.DRAFT;
};

const withShiftStatus = (shift) => {
  const payload = typeof shift?.toJSON === "function" ? shift.toJSON() : shift;
  return {
    ...payload,
    shift_status: deriveShiftStatus(shift),
  };
};

const validateDepartmentMembership = async (departmentId, userId, positionId) => {
  if (!departmentId || !userId) {
    return {
      valid: false,
      message: "Assigned user and department are required for assignment validation.",
      conflictType: "assignment_validation",
    };
  }

  const membership = await UserDepartment.findOne({
    where: {
      user_id: userId,
      department_id: departmentId,
      is_active: true,
    },
  });

  if (!membership) {
    return {
      valid: false,
      message: "Assigned user is not active in this department.",
      conflictType: "department_membership",
    };
  }

  if (!membership.role_id) {
    return {
      valid: false,
      message: "Assigned user does not have an active role assignment in this department.",
      conflictType: "role_mismatch",
    };
  }

  if (positionId && Number(membership.position_id) !== Number(positionId)) {
    return {
      valid: false,
      message: "Assigned user is not qualified for this position in the department.",
      conflictType: "qualification_mismatch",
    };
  }

  return { valid: true };
};

const validateAvailabilityCoverage = async (userId, shiftDate, startTime, endTime) => {
  if (!shiftDate) {
    return { valid: true };
  }

  const dayOfWeek = getDayOfWeekFromDate(shiftDate);
  const shiftStart = toMinutes(startTime);
  const shiftEnd = toMinutes(endTime);

  const availabilityRecords = await Availability.findAll({
    where: {
      userId,
      availabilityType: {
        [Op.in]: ["available", "preferred"],
      },
      requestStatus: {
        [Op.in]: ["approved", "pending"],
      },
      [Op.or]: [
        { specificDate: shiftDate },
        { dayOfWeek, isRecurring: true },
      ],
    },
  });

  if (!availabilityRecords.length) {
    return {
      valid: false,
      message: "Assigned user has no availability record for this shift date/time.",
      conflictType: "availability_conflict",
    };
  }

  const hasCoverage = availabilityRecords.some((availability) => {
    const availabilityStart = toMinutes(availability.startTime);
    const availabilityEnd = toMinutes(availability.endTime);
    return availabilityStart <= shiftStart && availabilityEnd >= shiftEnd;
  });

  if (!hasCoverage) {
    return {
      valid: false,
      message: "Assigned user availability does not fully cover this shift window.",
      conflictType: "availability_conflict",
    };
  }

  return { valid: true };
};

const validateAssignmentEligibility = async (
  departmentId,
  assignedUserId,
  positionId,
  shiftDate,
  startTime,
  endTime,
) => {
  if (!assignedUserId) {
    return { valid: true };
  }

  const departmentValidation = await validateDepartmentMembership(
    departmentId,
    assignedUserId,
    positionId,
  );
  if (!departmentValidation.valid) {
    return departmentValidation;
  }

  return validateAvailabilityCoverage(
    assignedUserId,
    shiftDate,
    startTime,
    endTime,
  );
};

const createShiftNotification = async (userId, title, message) => {
  if (!userId) return;
  await Notification.create({
    userId,
    title,
    message,
    isRead: false,
  });
};

const ensureShiftAcknowledgement = async (shiftId, userId) => {
  if (!shiftId || !userId) return;

  const acknowledgement = await ShiftAcknowledgement.findOne({
    where: {
      shiftId,
      userId,
    },
  });

  if (!acknowledgement) {
    await ShiftAcknowledgement.create({
      shiftId,
      userId,
      acknowledged: false,
      acknowledgedAt: null,
      importedToCalendar: false,
    });
    return;
  }

  await acknowledgement.update({
    acknowledged: false,
    acknowledgedAt: null,
  });
};

const notifyAssignedUserForShift = async (shift, statusLabel) => {
  if (!shift?.assigned_user_id) return;

  const shiftDateLabel = shift.shift_date || "recurring";
  const timeLabel = `${shift.start_time}-${shift.end_time}`;

  if (statusLabel !== SHIFT_STATUS.CANCELLED) {
    await ensureShiftAcknowledgement(shift.shift_id, shift.assigned_user_id);
  }

  const titleByStatus = {
    [SHIFT_STATUS.PUBLISHED]: "Shift Published",
    [SHIFT_STATUS.CHANGED]: "Shift Changed",
    [SHIFT_STATUS.CANCELLED]: "Shift Cancelled",
    [SHIFT_STATUS.DRAFT]: "Shift Assigned",
  };

  await createShiftNotification(
    shift.assigned_user_id,
    titleByStatus[statusLabel] || "Shift Update",
    `Your shift for ${shiftDateLabel} (${timeLabel}) is now ${statusLabel}.`,
  );
};

const createShiftAuditEntry = async (shiftId, actorUserId, action, details = null) => {
  if (!shiftId || !actorUserId) return;
  await ShiftAudit.create({
    shift_id: shiftId,
    actor_user_id: actorUserId,
    action,
    details: details ? JSON.stringify(details) : null,
    created_at: new Date(),
  });
};

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
    shift_date: shiftDate,
    trade_status: {
      [Op.ne]: SHIFT_STATUS.CANCELLED,
    },
  };

  // Exclude current shift if updating
  if (excludeShiftId) {
    whereClause.shift_id = { [Op.ne]: excludeShiftId };
  }

  const existingShifts = await Shift.findAll({
    where: whereClause,
    order: [["start_time", "ASC"]],
  });

  const newStartMinutes = toMinutes(startTime);
  const newEndMinutes = toMinutes(endTime);

  // Check buffer time with each existing shift
  for (const existingShift of existingShifts) {
    const existingStartMinutes = toMinutes(existingShift.start_time);
    const existingEndMinutes = toMinutes(existingShift.end_time);

    // Check if new shift ends too close to when existing shift starts
    const timeBetweenShifts1 = existingStartMinutes - newEndMinutes;
    // Check if existing shift ends too close to when new shift starts
    const timeBetweenShifts2 = newStartMinutes - existingEndMinutes;

    if (timeBetweenShifts1 >= 0 && timeBetweenShifts1 < bufferMinutes) {
      return {
        valid: false,
        message: `Buffer time violation: Only ${timeBetweenShifts1} minutes between new shift end (${endTime}) and existing shift start (${existingShift.start_time}). Required buffer: ${bufferMinutes} minutes.`,
      };
    }

    if (timeBetweenShifts2 >= 0 && timeBetweenShifts2 < bufferMinutes) {
      return {
        valid: false,
        message: `Buffer time violation: Only ${timeBetweenShifts2} minutes between existing shift end (${existingShift.end_time}) and new shift start (${startTime}). Required buffer: ${bufferMinutes} minutes.`,
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
        message: `Shift overlap detected: New shift (${startTime}-${endTime}) overlaps with existing shift (${existingShift.start_time}-${existingShift.end_time}).`,
      };
    }
  }

  return { valid: true };
};

// Create and Save a new Shift
export const createShift = async (req, res) => {
  try {
    const actorUserId = req.auth?.userId || req.body.created_by;

    // Validate request
    if (!req.body.department_id || !req.body.position_id || !req.body.start_time || !req.body.end_time || !actorUserId) {
      return res.status(400).send({
        message: "Missing required fields: department_id, position_id, start_time, end_time, created_by",
      });
    }

    // If shift_date is provided, ignore day_of_week
    if (req.body.shift_date) {
      req.body.day_of_week = null;
    }

    // Validate assignment against membership and availability
    if (req.body.assigned_user_id) {
      const assignmentValidation = await validateAssignmentEligibility(
        req.body.department_id,
        req.body.assigned_user_id,
        req.body.position_id,
        req.body.shift_date,
        req.body.start_time,
        req.body.end_time,
      );

      if (!assignmentValidation.valid) {
        return res.status(409).send({
          success: false,
          message: assignmentValidation.message,
          conflictType: assignmentValidation.conflictType,
        });
      }
    }

    // Validate buffer time if shift is assigned and has a date
    if (req.body.assigned_user_id && req.body.shift_date) {
      const bufferValidation = await validateBufferTime(
        req.body.department_id,
        req.body.shift_date,
        req.body.start_time,
        req.body.end_time,
        req.body.assigned_user_id,
      );

      if (!bufferValidation.valid) {
        return res.status(409).send({
          success: false,
          message: bufferValidation.message,
          conflictType: "buffer_time_violation",
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
      trade_status: req.body.trade_status || null,
      created_by: actorUserId,
      is_template: req.body.is_template || false,
      is_published: req.body.is_published || false,
      is_recurring: req.body.is_recurring || false,
      recurrence_pattern: req.body.recurrence_pattern,
      recurrence_start_date: req.body.recurrence_start_date,
      recurrence_end_date: req.body.recurrence_end_date,
    };

    // Save Shift in the database
    const createdShift = await Shift.create(shift);

    // Return the created shift with associations
    const shiftWithAssociations = await Shift.findByPk(createdShift.shift_id, {
      include: shiftIncludes,
    });

    const status = deriveShiftStatus(shiftWithAssociations);
    if (status === SHIFT_STATUS.PUBLISHED || status === SHIFT_STATUS.CHANGED) {
      await notifyAssignedUserForShift(shiftWithAssociations, status);
    }

    await createShiftAuditEntry(
      createdShift.shift_id,
      actorUserId,
      "created",
      {
        status,
        department_id: shift.department_id,
        position_id: shift.position_id,
      },
    );

    res.status(201).send(withShiftStatus(shiftWithAssociations));
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the Shift.",
    });
  }
};

// Retrieve all Shifts from the database with filters
export const listShifts = async (req, res) => {
  try {
    const { department_id, assigned_user_id, is_published, shift_date, shift_status } = req.query;
    const where = {};

    if (department_id) where.department_id = department_id;
    if (assigned_user_id) where.assigned_user_id = assigned_user_id;
    if (is_published !== undefined) where.is_published = is_published === "true";
    if (shift_date) where.shift_date = shift_date;
    if (shift_status === SHIFT_STATUS.CANCELLED) {
      where.trade_status = SHIFT_STATUS.CANCELLED;
    }

    const shifts = await Shift.findAll({
      where,
      include: shiftIncludes,
      order: [["shift_date", "ASC"], ["start_time", "ASC"]],
    });

    let payload = shifts.map((shift) => withShiftStatus(shift));
    if (shift_status) {
      payload = payload.filter((shift) => shift.shift_status === shift_status);
    }

    res.send(payload);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving shifts.",
    });
  }
};

// Find a single Shift with an id
export const getShiftById = async (req, res) => {
  const id = req.params.id;

  try {
    const shift = await Shift.findByPk(id, {
      include: shiftIncludes,
    });

    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    res.send(withShiftStatus(shift));
  } catch (err) {
    res.status(500).send({
      message: `Error retrieving Shift with id=${id}`,
    });
  }
};

// Retrieve shift audit trail
export const getShiftAuditTrail = async (req, res) => {
  const id = req.params.id;

  try {
    const shift = await Shift.findByPk(id, {
      attributes: ["shift_id"],
    });

    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    const auditEntries = await ShiftAudit.findAll({
      where: {
        shift_id: id,
      },
      include: [
        {
          model: db.user,
          as: "actor",
          attributes: ["id", "fName", "lName", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.send(
      auditEntries.map((entry) => {
        const payload = typeof entry.toJSON === "function" ? entry.toJSON() : entry;
        let parsedDetails = null;
        if (payload.details) {
          try {
            parsedDetails = JSON.parse(payload.details);
          } catch (error) {
            parsedDetails = payload.details;
          }
        }
        return {
          ...payload,
          details: parsedDetails,
        };
      }),
    );
  } catch (err) {
    return res.status(500).send({
      message: `Error retrieving shift audit trail: ${err.message}`,
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
        message: `Shift with id=${id} was not found.`,
      });
    }

    // Validate assignment against membership and availability
    const departmentId = req.body.department_id || existingShift.department_id;
    const assignedUserId = req.body.assigned_user_id !== undefined ? req.body.assigned_user_id : existingShift.assigned_user_id;
    const positionId = req.body.position_id || existingShift.position_id;
    const shiftDate = req.body.shift_date || existingShift.shift_date;
    const startTime = req.body.start_time || existingShift.start_time;
    const endTime = req.body.end_time || existingShift.end_time;

    if (assignedUserId) {
      const assignmentValidation = await validateAssignmentEligibility(
        departmentId,
        assignedUserId,
        positionId,
        shiftDate,
        startTime,
        endTime,
      );

      if (!assignmentValidation.valid) {
        return res.status(409).send({
          success: false,
          message: assignmentValidation.message,
          conflictType: assignmentValidation.conflictType,
        });
      }
    }

    // Validate buffer time if updating assigned user, date, or times
    if (assignedUserId && shiftDate) {
      const bufferValidation = await validateBufferTime(
        departmentId,
        shiftDate,
        startTime,
        endTime,
        assignedUserId,
        id, // Exclude current shift from validation
      );

      if (!bufferValidation.valid) {
        return res.status(409).send({
          success: false,
          message: bufferValidation.message,
          conflictType: "buffer_time_violation",
        });
      }
    }

    const statusSensitiveFields = [
      "department_id",
      "position_id",
      "shift_date",
      "start_time",
      "end_time",
      "assigned_user_id",
    ];

    const changedPublishedShift = existingShift.is_published && statusSensitiveFields.some(
      (field) => req.body[field] !== undefined && req.body[field] !== existingShift[field],
    );

    const updatePayload = { ...req.body };
    if (changedPublishedShift && updatePayload.trade_status === undefined) {
      updatePayload.trade_status = SHIFT_STATUS.CHANGED;
    }

    const [num] = await Shift.update(updatePayload, {
      where: { shift_id: id },
    });

    if (num === 1) {
      const updatedShift = await Shift.findByPk(id, {
        include: shiftIncludes,
      });

      const status = deriveShiftStatus(updatedShift);
      if (
        status === SHIFT_STATUS.PUBLISHED ||
        status === SHIFT_STATUS.CHANGED ||
        status === SHIFT_STATUS.CANCELLED
      ) {
        await notifyAssignedUserForShift(updatedShift, status);
      }

      await createShiftAuditEntry(
        id,
        req.auth?.userId || updatedShift.created_by,
        "updated",
        {
          status,
          updated_fields: Object.keys(updatePayload || {}),
        },
      );

      res.send(withShiftStatus(updatedShift));
    } else {
      res.status(404).send({
        message: `Cannot update Shift with id=${id}. Shift was not found or req.body is empty!`,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: `Error updating Shift with id=${id}: ${err.message}`,
    });
  }
};

// Update shift lifecycle status (draft/published/changed/cancelled)
export const updateShiftStatus = async (req, res) => {
  const id = req.params.id;
  const status = String(req.body.status || "").toLowerCase();

  if (!Object.values(SHIFT_STATUS).includes(status)) {
    return res.status(400).send({
      message: "Valid status is required: draft, published, changed, cancelled.",
    });
  }

  try {
    const shift = await Shift.findByPk(id);
    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    if (status === SHIFT_STATUS.DRAFT) {
      shift.is_published = false;
      shift.trade_status = null;
    } else if (status === SHIFT_STATUS.PUBLISHED) {
      shift.is_published = true;
      shift.trade_status = null;
    } else if (status === SHIFT_STATUS.CHANGED) {
      shift.is_published = true;
      shift.trade_status = SHIFT_STATUS.CHANGED;
    } else if (status === SHIFT_STATUS.CANCELLED) {
      shift.is_published = false;
      shift.trade_status = SHIFT_STATUS.CANCELLED;
    }

    shift.updated_at = new Date();
    await shift.save();

    const updatedShift = await Shift.findByPk(id, {
      include: shiftIncludes,
    });

    if (status !== SHIFT_STATUS.DRAFT) {
      await notifyAssignedUserForShift(updatedShift, status);
    }

    await createShiftAuditEntry(
      id,
      req.auth?.userId || updatedShift.created_by,
      "status_changed",
      { status },
    );

    res.send({
      message: `Shift status updated to ${status}.`,
      data: withShiftStatus(updatedShift),
    });
  } catch (err) {
    res.status(500).send({
      message: `Error updating shift status: ${err.message}`,
    });
  }
};

// Publish a shift
export const publishShift = async (req, res) => {
  req.body.status = SHIFT_STATUS.PUBLISHED;
  return updateShiftStatus(req, res);
};

// Send reminder notification for shift
export const sendShiftReminder = async (req, res) => {
  const id = req.params.id;

  try {
    const shift = await Shift.findByPk(id);
    if (!shift) {
      return res.status(404).send({
        message: `Shift with id=${id} was not found.`,
      });
    }

    if (!shift.assigned_user_id) {
      return res.status(409).send({
        message: "Cannot send reminder for an unassigned shift.",
      });
    }

    await createShiftNotification(
      shift.assigned_user_id,
      "Shift Reminder",
      `Reminder: You have a shift on ${shift.shift_date || "recurring"} from ${shift.start_time} to ${shift.end_time}.`,
    );

    await createShiftAuditEntry(
      shift.shift_id,
      req.auth?.userId || shift.created_by,
      "reminder_sent",
      null,
    );

    res.send({
      message: "Shift reminder notification sent.",
    });
  } catch (err) {
    res.status(500).send({
      message: `Error sending shift reminder: ${err.message}`,
    });
  }
};

// Delete a Shift with the specified id in the request
export const deleteShift = async (req, res) => {
  const id = req.params.id;

  try {
    const num = await Shift.destroy({
      where: { shift_id: id },
    });

    if (num == 1) {
      res.send({
        message: "Shift was deleted successfully!",
      });
    } else {
      res.status(404).send({
        message: `Cannot delete Shift with id=${id}. Shift was not found!`,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: `Could not delete Shift with id=${id}: ${err.message}`,
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
      assigned_user_id,
    } = req.body;

    if (!template_id || !start_date || !end_date) {
      return res.status(400).send({
        message: "template_id, start_date, and end_date are required",
      });
    }

    // Get the template shifts
    const templateShifts = await Shift.findAll({
      where: {
        template_id,
        is_template: true,
        ...(department_id && { department_id }),
        ...(position_id && { position_id }),
      },
      include: [
        { model: db.department, as: "department" },
        { model: db.position, as: "position" },
      ],
    });

    if (!templateShifts.length) {
      return res.status(404).send({
        message: "No template shifts found",
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
      const shiftsForDay = templateShifts.filter((shift) =>
        shift.day_of_week === dayOfWeek,
      );

      // Create a shift for each template shift
      for (const templateShift of shiftsForDay) {
        const shiftDate = new Date(date);

        generatedShifts.push({
          department_id: templateShift.department_id,
          position_id: templateShift.position_id,
          template_id: templateShift.template_id,
          shift_date: shiftDate.toISOString().split("T")[0],
          start_time: templateShift.start_time,
          end_time: templateShift.end_time,
          assigned_user_id: assigned_user_id || templateShift.assigned_user_id,
          created_by: req.auth?.userId || templateShift.created_by,
          is_published: false,
          is_recurring: false,
          trade_status: null,
          shift_status: SHIFT_STATUS.DRAFT,
          department: templateShift.department,
          position: templateShift.position,
        });
      }
    }

    res.send(generatedShifts);
  } catch (err) {
    res.status(500).send({
      message: `Error generating shift preview: ${err.message}`,
    });
  }
};
