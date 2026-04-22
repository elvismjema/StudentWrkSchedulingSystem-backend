import db from "../models/index.js";
import { canManageDepartment, resolveHighestRoleForUser } from "./roleAccess.js";

const findDepartmentIdFromRequest = async (req) => {
  if (req.body?.department_id) return Number(req.body.department_id);
  if (req.body?.departmentId) return Number(req.body.departmentId);
  if (req.params?.departmentId) return Number(req.params.departmentId);
  if (req.query?.department_id) return Number(req.query.department_id);
  if (req.query?.departmentId) return Number(req.query.departmentId);

  const routePath = `${req.baseUrl || ""}${req.path || ""}`.toLowerCase();

  if (routePath.includes("/departments/") && req.params?.id) {
    return Number(req.params.id);
  }

  if (routePath.includes("/positions/") && req.params?.id) {
    const position = await db.position.findByPk(req.params.id, {
      attributes: ["department_id"],
    });
    return Number(position?.department_id || 0);
  }

  if (routePath.includes("/shifts/") && req.params?.id) {
    const shift = await db.shift.findByPk(req.params.id, {
      attributes: ["department_id"],
    });
    return Number(shift?.department_id || 0);
  }

  return 0;
};

const requireDepartmentManager = async (req, res, next) => {
  try {
    const userId = req.auth?.userId;
    const email = req.auth?.email;

    if (!userId) {
      return res.status(401).send({
        message: "Unauthorized! Missing authenticated user context.",
      });
    }

    const role = await resolveHighestRoleForUser(userId, email);
    if (role === "admin") {
      return next();
    }

    const departmentId = await findDepartmentIdFromRequest(req);
    if (!departmentId) {
      return res.status(400).send({
        message: "A valid department scope is required for this action.",
      });
    }

    const allowed = await canManageDepartment(userId, email, departmentId);
    if (!allowed) {
      return res.status(403).send({
        message: "Forbidden! You can only manage your own department.",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).send({
      message: `Failed department access check: ${error.message}`,
    });
  }
};

export default requireDepartmentManager;
