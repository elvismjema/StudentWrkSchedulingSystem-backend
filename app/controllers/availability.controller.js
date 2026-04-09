import db from "../models/index.js";
import logger from "../config/logger.js";
import { resolveHighestRoleForUser } from "../authorization/roleAccess.js";

const Availability = db.availability;
const User = db.user;
const Op = db.Sequelize.Op;

const exports = {};
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const normalizeTime = (timeValue) =>
  timeValue && timeValue.length === 5 ? `${timeValue}:00` : timeValue;

const toSeconds = (timeValue) => {
  const normalized = normalizeTime(timeValue);
  const [hours, minutes, seconds] = normalized.split(":").map(Number);
  return (hours * 60 + minutes) * 60 + seconds;
};

const validateTimeRange = (startTime, endTime) => {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return {
      valid: false,
      message: "Invalid time format. Use HH:mm or HH:mm:ss.",
    };
  }

  if (toSeconds(startTime) >= toSeconds(endTime)) {
    return {
      valid: false,
      message: "startTime must be earlier than endTime.",
    };
  }

  return { valid: true };
};

const hasAvailabilityConflict = async ({
  userId,
  startTime,
  endTime,
  specificDate,
  dayOfWeek,
  excludeId,
}) => {
  const where = {
    userId,
    [Op.and]: [
      { startTime: { [Op.lt]: normalizeTime(endTime) } },
      { endTime: { [Op.gt]: normalizeTime(startTime) } },
    ],
  };

  if (excludeId) {
    where[Op.and].push({ id: { [Op.ne]: excludeId } });
  }

  if (specificDate) {
    where.specificDate = specificDate;
  } else if (dayOfWeek !== undefined && dayOfWeek !== null && dayOfWeek !== "") {
    where.dayOfWeek = dayOfWeek;
  }

  const existing = await Availability.findOne({ where });
  return Boolean(existing);
};

const toPlainAvailability = (record) =>
  record && typeof record.get === "function" ? record.get({ plain: true }) : record;

const markConflicts = (records) => {
  const plain = records.map(toPlainAvailability);
  const conflictIds = new Set();
  const grouped = new Map();

  for (const item of plain) {
    const scopeKey = item.specificDate
      ? `${item.userId}|date:${item.specificDate}`
      : `${item.userId}|dow:${item.dayOfWeek ?? "none"}`;
    if (!grouped.has(scopeKey)) {
      grouped.set(scopeKey, []);
    }
    grouped.get(scopeKey).push(item);
  }

  for (const items of grouped.values()) {
    const ordered = items
      .filter((entry) => entry.startTime && entry.endTime)
      .sort((a, b) => toSeconds(a.startTime) - toSeconds(b.startTime));

    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        if (toSeconds(ordered[j].startTime) < toSeconds(ordered[i].endTime)) {
          conflictIds.add(ordered[i].id);
          conflictIds.add(ordered[j].id);
        } else {
          break;
        }
      }
    }
  }

  return plain.map((item) => ({
    ...item,
    hasConflict: conflictIds.has(item.id),
  }));
};

/**
 * Helper: check if the authenticated user is allowed to act on behalf of targetUserId.
 * Students can only act on their own data. Managers/admins can act on anyone's.
 * @returns {{ allowed: boolean, role: string }}
 */
const checkOwnership = async (req, targetUserId) => {
  const authUserId = Number(req.auth?.userId);
  const authEmail = req.auth?.email;
  if (authUserId === Number(targetUserId)) {
    return { allowed: true, role: "self" };
  }
  const role = await resolveHighestRoleForUser(authUserId, authEmail);
  if (role === "manager" || role === "admin") {
    return { allowed: true, role };
  }
  return { allowed: false, role };
};

/**
 * Create and Save a new Availability.
 * FIX: Added ownership validation — students can only create availability for themselves.
 */
exports.create = async (req, res) => {
  // Validate request
  if (!req.body.userId || !req.body.startTime || !req.body.endTime) {
    logger.warn('Availability creation attempt with missing time fields');
    res.status(400).send({
      message: "userId, startTime, and endTime are required!",
    });
    return;
  }

  // FIX: Ownership check — students can only create their own availability
  const { allowed } = await checkOwnership(req, req.body.userId);
  if (!allowed) {
    return res.status(403).send({
      message: "Forbidden! You can only create availability for your own account.",
    });
  }

  const timeValidation = validateTimeRange(req.body.startTime, req.body.endTime);
  if (!timeValidation.valid) {
    logger.warn(`Availability creation rejected due to invalid time fields: ${timeValidation.message}`);
    res.status(400).send({
      message: timeValidation.message,
    });
    return;
  }

  // Create an Availability
  const availability = {
    userId: req.body.userId,
    departmentId: req.body.departmentId || null,
    dayOfWeek: req.body.dayOfWeek || null,
    startTime: normalizeTime(req.body.startTime),
    endTime: normalizeTime(req.body.endTime),
    availabilityType: req.body.availabilityType || 'available',
    specificDate: req.body.specificDate || null,
    isRecurring: req.body.isRecurring || false,
    recurrencePattern: req.body.recurrencePattern || null,
    recurrenceStartDate: req.body.recurrenceStartDate || null,
    recurrenceEndDate: req.body.recurrenceEndDate || null,
    requestStatus: req.body.requestStatus || 'pending',
    approvedBy: req.body.approvedBy || null,
    approvedAt: req.body.approvedAt || null,
    requestNotes: req.body.requestNotes || null,
  };

  logger.debug(`Creating availability for user: ${availability.userId}`);

  try {
    const conflictExists = await hasAvailabilityConflict({
      userId: availability.userId,
      startTime: availability.startTime,
      endTime: availability.endTime,
      specificDate: availability.specificDate,
      dayOfWeek: availability.dayOfWeek,
    });

    if (conflictExists) {
      logger.warn(`Availability conflict detected for user ${availability.userId}`);
      res.status(409).send({
        message:
          "Availability overlaps with an existing record. Please choose a non-conflicting time range.",
      });
      return;
    }

    const data = await Availability.create(availability);
    logger.info(`Availability created successfully: ${data.id}`);
    res.send(data);
  } catch (err) {
    logger.error(`Error creating availability: ${err.message}`);
    res.status(500).send({
      message:
        err.message || "Some error occurred while creating the Availability.",
    });
  }
};

// Retrieve all Availabilities from the database
exports.findAll = async (req, res) => {
  const userId = req.query.userId;
  const departmentId = req.query.departmentId;
  const requestStatus = req.query.requestStatus;
  const availabilityType = req.query.availabilityType;
  const dayOfWeek = req.query.dayOfWeek;
  const specificDate = req.query.specificDate;
  const startTimeFrom = req.query.startTimeFrom;
  const startTimeTo = req.query.startTimeTo;

  const condition = {};

  if (userId) {
    condition.userId = userId;
  }
  if (departmentId) {
    condition.departmentId = departmentId;
  }
  if (requestStatus) {
    condition.requestStatus = requestStatus;
  }
  if (availabilityType) {
    condition.availabilityType = availabilityType;
  }
  if (dayOfWeek !== undefined && dayOfWeek !== null && dayOfWeek !== "") {
    condition.dayOfWeek = dayOfWeek;
  }
  if (specificDate) {
    condition.specificDate = specificDate;
  }

  if (startTimeFrom || startTimeTo) {
    if (startTimeFrom && !TIME_PATTERN.test(startTimeFrom)) {
      return res.status(400).send({
        message: "Invalid startTimeFrom format. Use HH:mm or HH:mm:ss.",
      });
    }
    if (startTimeTo && !TIME_PATTERN.test(startTimeTo)) {
      return res.status(400).send({
        message: "Invalid startTimeTo format. Use HH:mm or HH:mm:ss.",
      });
    }
    condition.startTime = {};
    if (startTimeFrom) {
      condition.startTime[Op.gte] = normalizeTime(startTimeFrom);
    }
    if (startTimeTo) {
      condition.startTime[Op.lte] = normalizeTime(startTimeTo);
    }
  }

  logger.debug(`Fetching availabilities with condition: ${JSON.stringify(condition)}`);

  try {
    const data = await Availability.findAll({
      where: condition,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fName', 'lName', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'fName', 'lName', 'email']
        }
      ]
    });

    const responseWithConflicts = markConflicts(data);
    logger.info(`Retrieved ${responseWithConflicts.length} availabilities`);
    res.send(responseWithConflicts);
  } catch (err) {
    logger.error(`Error retrieving availabilities: ${err.message}`);
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving availabilities.",
    });
  }
};

// Retrieve all Availabilities for a specific user
exports.findAllForUser = async (req, res) => {
  const userId = req.params.userId;

  logger.debug(`Fetching availabilities for user: ${userId}`);

  try {
    const data = await Availability.findAll({
      where: { userId: userId },
      include: [
        {
          model: db.user,
          as: "user",
          attributes: ["id", "fName", "lName", "email"],
        },
      ],
      order: [["specificDate", "ASC"], ["dayOfWeek", "ASC"], ["startTime", "ASC"]]
    });

    const responseWithConflicts = markConflicts(data);
    logger.info(`Retrieved ${responseWithConflicts.length} availabilities for user ${userId}`);
    res.send(responseWithConflicts);
  } catch (err) {
    logger.error(`Error retrieving availabilities for user ${userId}: ${err.message}`);
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving availabilities.",
    });
  }
};

// Find a single Availability with an id
exports.findOne = (req, res) => {
  const id = req.params.id;
  logger.debug(`Finding availability with id: ${id}`);

  Availability.findByPk(id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fName', 'lName', 'email']
      },
      {
        model: User,
        as: 'approver',
        attributes: ['id', 'fName', 'lName', 'email']
      }
    ]
  })
    .then((data) => {
      if (data) {
        logger.info(`Availability found: ${id}`);
        res.send(data);
      } else {
        logger.warn(`Availability not found with id: ${id}`);
        res.status(404).send({
          message: `Cannot find Availability with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving availability ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error retrieving Availability with id=${id}`,
      });
    });
};

/**
 * Update an Availability by the id.
 * FIX: Added ownership validation — students can only update their own availability.
 */
exports.update = async (req, res) => {
  const id = req.params.id;

  logger.debug(`Updating availability with id: ${id}`);

  try {
    const existing = await Availability.findByPk(id);
    if (!existing) {
      logger.warn(`Availability not found with id ${id} for update`);
      res.status(404).send({
        message: `Cannot find Availability with id=${id}.`,
      });
      return;
    }

    // FIX: Ownership check — students can only update their own availability
    const { allowed } = await checkOwnership(req, existing.userId);
    if (!allowed) {
      return res.status(403).send({
        message: "Forbidden! You can only update your own availability.",
      });
    }

    const effectiveStartTime = req.body.startTime || existing.startTime;
    const effectiveEndTime = req.body.endTime || existing.endTime;
    const effectiveSpecificDate =
      req.body.specificDate !== undefined
        ? req.body.specificDate
        : existing.specificDate;
    const effectiveDayOfWeek =
      req.body.dayOfWeek !== undefined ? req.body.dayOfWeek : existing.dayOfWeek;
    const effectiveUserId = req.body.userId || existing.userId;

    const timeValidation = validateTimeRange(effectiveStartTime, effectiveEndTime);
    if (!timeValidation.valid) {
      logger.warn(`Availability update rejected due to invalid time fields: ${timeValidation.message}`);
      res.status(400).send({
        message: timeValidation.message,
      });
      return;
    }

    const conflictExists = await hasAvailabilityConflict({
      userId: effectiveUserId,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      specificDate: effectiveSpecificDate,
      dayOfWeek: effectiveDayOfWeek,
      excludeId: id,
    });

    if (conflictExists) {
      logger.warn(`Availability update conflict detected for id=${id}`);
      res.status(409).send({
        message:
          "Availability overlaps with an existing record. Please choose a non-conflicting time range.",
      });
      return;
    }

    const updatePayload = { ...req.body };
    if (updatePayload.startTime) {
      updatePayload.startTime = normalizeTime(updatePayload.startTime);
    }
    if (updatePayload.endTime) {
      updatePayload.endTime = normalizeTime(updatePayload.endTime);
    }

    const [num] = await Availability.update(updatePayload, {
      where: { id: id },
    });

    if (num === 1) {
      logger.info(`Availability updated successfully: ${id}`);
      res.send({
        message: "Availability was updated successfully.",
      });
      return;
    }

    logger.warn(`Cannot update availability with id ${id}. Availability not found or req.body is empty`);
    res.status(404).send({
      message: `Cannot update Availability with id=${id}. Maybe Availability was not found or req.body is empty!`,
    });
  } catch (err) {
    logger.error(`Error updating availability ${id}: ${err.message}`);
    res.status(500).send({
      message: `Error updating Availability with id=${id}`,
    });
  }
};

// Delete an Availability with the specified id
exports.delete = (req, res) => {
  const id = req.params.id;

  logger.debug(`Deleting availability with id: ${id}`);

  Availability.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Availability deleted successfully: ${id}`);
        res.send({
          message: "Availability was deleted successfully!",
        });
      } else {
        logger.warn(`Cannot delete availability with id ${id}. Availability not found`);
        res.status(404).send({
          message: `Cannot delete Availability with id=${id}. Maybe Availability was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error deleting availability ${id}: ${err.message}`);
      res.status(500).send({
        message: `Could not delete Availability with id=${id}`,
      });
    });
};

// Delete all Availabilities from the database
exports.deleteAll = (req, res) => {
  logger.warn('Attempting to delete all availabilities');

  Availability.destroy({
    where: {},
    truncate: false,
  })
    .then((nums) => {
      logger.info(`${nums} availabilities deleted successfully`);
      res.send({ message: `${nums} Availabilities were deleted successfully!` });
    })
    .catch((err) => {
      logger.error(`Error deleting all availabilities: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all availabilities.",
      });
    });
};

// Approve or Reject an Availability request
exports.updateStatus = (req, res) => {
  const id = req.params.id;
  const { requestStatus, approvedBy } = req.body;

  if (!requestStatus || !['approved', 'rejected', 'cancelled'].includes(requestStatus)) {
    logger.warn(`Invalid status update attempt for availability ${id}`);
    res.status(400).send({
      message: "Valid request status is required (approved, rejected, or cancelled).",
    });
    return;
  }

  logger.debug(`Updating availability ${id} status to: ${requestStatus}`);

  const updateData = {
    requestStatus: requestStatus,
  };

  if (requestStatus === 'approved' && approvedBy) {
    updateData.approvedBy = approvedBy;
    updateData.approvedAt = new Date();
  }

  Availability.update(updateData, {
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        logger.info(`Availability ${id} status updated to ${requestStatus}`);
        res.send({
          message: "Availability status was updated successfully.",
        });
      } else {
        logger.warn(`Cannot update availability status with id ${id}`);
        res.status(404).send({
          message: `Cannot update Availability status with id=${id}. Maybe Availability was not found!`,
        });
      }
    })
    .catch((err) => {
      logger.error(`Error updating availability status ${id}: ${err.message}`);
      res.status(500).send({
        message: `Error updating Availability status with id=${id}`,
      });
    });
};

export default exports;
