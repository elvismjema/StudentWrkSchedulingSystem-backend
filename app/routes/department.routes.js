import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listDepartments,
  removeAllDepartments
} from "../controllers/department.controller.js";
import { verifyToken } from "../middleware/authJwt.js";
import requireManager from "../authorization/requireManager.js";
import requireDepartmentManager from "../authorization/requireDepartmentManager.js";

const router = Router();

// Get all departments - available to authenticated users
router.get("/", [verifyToken], listDepartments);
router.get("/:id", [verifyToken], getDepartmentById);

// Manager routes
router.post("/", [verifyToken, requireManager], createDepartment);
router.put("/:id", [verifyToken, requireManager, requireDepartmentManager], updateDepartment);
router.delete("/:id", [verifyToken, requireManager, requireDepartmentManager], deleteDepartment);
router.delete("/", [verifyToken, requireManager], removeAllDepartments);

export default router;