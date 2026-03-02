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
