import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import {
  getAllRoles,
  getRoleById,
  updateUserRole,
  createRole,
  updateRole,
  deleteRole
} from "../controllers/role.controller.js";
import { verifyToken } from "../middleware/authJwt.js";
import requireManager from "../authorization/requireManager.js";

const router = Router();

// Public routes (with authenticate)
router.get("/", authenticate, getAllRoles);
router.get("/:id", authenticate, getRoleById);
router.put("/update-user", authenticate, updateUserRole);

// Manager routes
router.post("/", [verifyToken, requireManager], createRole);
router.put("/:id", [verifyToken, requireManager], updateRole);
router.delete("/:id", [verifyToken, requireManager], deleteRole);

export default router;