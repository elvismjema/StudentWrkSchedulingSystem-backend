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

export default router;
