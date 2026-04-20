import db from "../models/index.js";
import logger from "../config/logger.js";

const SystemSetting = db.systemSetting;

const exports = {};

// Default settings seeded on first request if table is empty
const DEFAULTS = [
  { setting_key: "app_name", setting_value: "Student Worker Scheduling System", setting_type: "string", category: "general", description: "Application display name" },
  { setting_key: "max_hours_per_week", setting_value: "20", setting_type: "number", category: "scheduling", description: "Maximum hours a student can be scheduled per week" },
  { setting_key: "min_hours_between_shifts", setting_value: "8", setting_type: "number", category: "scheduling", description: "Minimum rest hours between consecutive shifts" },
  { setting_key: "allow_shift_swaps", setting_value: "true", setting_type: "boolean", category: "scheduling", description: "Allow students to request shift swaps" },
  { setting_key: "require_manager_approval_swaps", setting_value: "true", setting_type: "boolean", category: "scheduling", description: "Require manager approval for shift swaps" },
  { setting_key: "clock_in_early_minutes", setting_value: "10", setting_type: "number", category: "attendance", description: "Minutes before shift start that clock-in is allowed" },
  { setting_key: "clock_in_late_minutes", setting_value: "15", setting_type: "number", category: "attendance", description: "Minutes after shift start before flagging as late" },
  { setting_key: "auto_clock_out_hours", setting_value: "12", setting_type: "number", category: "attendance", description: "Auto clock-out after this many hours (safety)" },
  { setting_key: "notification_email_enabled", setting_value: "false", setting_type: "boolean", category: "notifications", description: "Send email notifications" },
  { setting_key: "notification_sms_enabled", setting_value: "false", setting_type: "boolean", category: "notifications", description: "Send SMS notifications" },
];

async function ensureDefaults() {
  try {
    const count = await SystemSetting.count();
    if (count === 0) {
      await SystemSetting.bulkCreate(DEFAULTS);
      logger.info("Seeded default system settings");
    }
  } catch (err) {
    // Table might not exist yet — will be created by sync
    logger.warn(`Could not seed defaults: ${err.message}`);
  }
}

// GET all settings
exports.getAll = async (req, res) => {
  try {
    await ensureDefaults();
    const settings = await SystemSetting.findAll({ order: [["category", "ASC"], ["setting_key", "ASC"]] });

    // Group by category for the frontend
    const grouped = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push({
        id: s.id,
        key: s.setting_key,
        value: castValue(s.setting_value, s.setting_type),
        type: s.setting_type,
        description: s.description,
      });
    }

    return res.json(grouped);
  } catch (err) {
    logger.error(`getAll settings error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
};

// PUT update a single setting
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    const setting = await SystemSetting.findByPk(id);
    if (!setting) return res.status(404).json({ message: "Setting not found" });

    setting.setting_value = String(value);
    setting.updated_by = req.auth?.userId || null;
    await setting.save();

    return res.json({
      id: setting.id,
      key: setting.setting_key,
      value: castValue(setting.setting_value, setting.setting_type),
      type: setting.setting_type,
      description: setting.description,
    });
  } catch (err) {
    logger.error(`update setting error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
};

// PUT bulk update
exports.bulkUpdate = async (req, res) => {
  try {
    const updates = req.body; // Array of { id, value }
    if (!Array.isArray(updates)) return res.status(400).json({ message: "Expected an array of updates" });

    const userId = req.auth?.userId || null;
    for (const u of updates) {
      await SystemSetting.update(
        { setting_value: String(u.value), updated_by: userId },
        { where: { id: u.id } }
      );
    }

    // Return fresh state
    const settings = await SystemSetting.findAll({ order: [["category", "ASC"], ["setting_key", "ASC"]] });
    const grouped = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push({
        id: s.id,
        key: s.setting_key,
        value: castValue(s.setting_value, s.setting_type),
        type: s.setting_type,
        description: s.description,
      });
    }

    return res.json(grouped);
  } catch (err) {
    logger.error(`bulkUpdate settings error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
};

function castValue(raw, type) {
  if (raw === null || raw === undefined) return null;
  switch (type) {
    case "number": return Number(raw);
    case "boolean": return raw === "true" || raw === "1";
    case "json": try { return JSON.parse(raw); } catch { return raw; }
    default: return raw;
  }
}

export default exports;
