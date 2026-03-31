
import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import {
  getAllRoles,
  getRoleById,
  updateUserRole
} from "../controllers/role.controller.js";

const router = Router();

// Get all roles
router.get("/", authenticate, getAllRoles);

// Get single role by ID
router.get("/:id", authenticate, getRoleById);

// Update user role
router.put("/update-user", authenticate, updateUserRole);


export default router;
