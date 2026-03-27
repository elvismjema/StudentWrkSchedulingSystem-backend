
import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from "../controllers/department.controller.js";

const router = Router();

// Get all departments
router.get("/", authenticate, getAllDepartments);

// Get single department by ID
router.get("/:id", authenticate, getDepartmentById);

// Create new department
router.post("/", authenticate, createDepartment);

// Update department
router.put("/:id", authenticate, updateDepartment);

// Delete department
router.delete("/:id", authenticate, deleteDepartment);

import express from "express";
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  removeAllDepartments
} from "../controllers/department.controller.js";
import { verifyToken } from "../middleware/authJwt.js";
import requireManager from "../authorization/requireManager.js";
import requireDepartmentManager from "../authorization/requireDepartmentManager.js";

const router = express.Router();

router.post("/", [verifyToken, requireManager], createDepartment);
router.get("/", [verifyToken], listDepartments);
router.get("/:id", [verifyToken], getDepartmentById);
router.put("/:id", [verifyToken, requireManager, requireDepartmentManager], updateDepartment);
router.delete("/:id", [verifyToken, requireManager, requireDepartmentManager], deleteDepartment);
router.delete("/", [verifyToken, requireManager], removeAllDepartments);


export default router;
