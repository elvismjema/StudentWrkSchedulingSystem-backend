
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

import express from "express";
import {
  createRole,
  listRoles,
  getRoleById,
  updateRole,
  deleteRole
} from "../controllers/role.controller.js";
import { verifyToken } from "../middleware/authJwt.js";
import requireManager from "../authorization/requireManager.js";

const router = express.Router();

router.post("/", [verifyToken, requireManager], createRole);
router.get("/", [verifyToken], listRoles);
router.get("/:id", [verifyToken], getRoleById);
router.put("/:id", [verifyToken, requireManager], updateRole);
router.delete("/:id", [verifyToken, requireManager], deleteRole);


export default router;
