import db from "../models/index.js";

const DepartmentHours = db.departmentHours;

// Create and save new department hours
export const addDepartmentHours = async (req, res) => {
  try {
    const {
      department_id,
      day_of_week,
      open_time,
      close_time,
      specific_date,
      is_default
    } = req.body;

    if (!department_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: department_id"
      });
    }

    const department = await db.department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    const departmentHours = await DepartmentHours.create({
      department_id,
      day_of_week,
      open_time,
      close_time,
      specific_date,
      is_default
    });

    return res.status(201).json({
      success: true,
      data: departmentHours
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create department hours",
      error: error.message
    });
  }
};

// Retrieve all department hours with optional department filter
export const listDepartmentHours = async (req, res) => {
  try {
    const { department_id } = req.query;
    const where = {};

    if (department_id) {
      where.department_id = department_id;
    }

    const departmentHours = await DepartmentHours.findAll({
      where,
      include: [{ model: db.department, as: "department" }],
      order: [["day_of_week", "ASC"], ["open_time", "ASC"]]
    });

    return res.status(200).json({
      success: true,
      data: departmentHours
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch department hours",
      error: error.message
    });
  }
};

// Retrieve a single department hours entry by id
export const getDepartmentHoursById = async (req, res) => {
  try {
    const { id } = req.params;

    const departmentHours = await DepartmentHours.findByPk(id, {
      include: [{ model: db.department, as: "department" }]
    });

    if (!departmentHours) {
      return res.status(404).json({
        success: false,
        message: "Department hours not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: departmentHours
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch department hours",
      error: error.message
    });
  }
};

// Update department hours
export const updateDepartmentHours = async (req, res) => {
  try {
    const { id } = req.params;

    const departmentHours = await DepartmentHours.findByPk(id);
    if (!departmentHours) {
      return res.status(404).json({
        success: false,
        message: "Department hours not found"
      });
    }

    if (req.body.department_id !== undefined) {
      const department = await db.department.findByPk(req.body.department_id);
      if (!department) {
        return res.status(404).json({
          success: false,
          message: "Department not found"
        });
      }
    }

    const updatableFields = [
      "department_id",
      "day_of_week",
      "open_time",
      "close_time",
      "specific_date",
      "is_default"
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        departmentHours[field] = req.body[field];
      }
    });

    departmentHours.updated_at = new Date();
    await departmentHours.save();

    return res.status(200).json({
      success: true,
      data: departmentHours
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update department hours",
      error: error.message
    });
  }
};

// Delete department hours by id
export const deleteDepartmentHours = async (req, res) => {
  try {
    const { id } = req.params;
    const departmentHours = await DepartmentHours.findByPk(id);

    if (!departmentHours) {
      return res.status(404).json({
        success: false,
        message: "Department hours not found"
      });
    }

    await departmentHours.destroy();

    return res.status(200).json({
      success: true,
      message: "Department hours deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete department hours",
      error: error.message
    });
  }
};
