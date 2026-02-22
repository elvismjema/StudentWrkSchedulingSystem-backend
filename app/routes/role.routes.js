import express from "express";
import {
  createRole,
  listRoles,
  getRoleById,
  updateRole,
  deleteRole
} from "../controllers/role.controller.js";
import { verifyToken } from "../middleware/authJwt.js";

const router = express.Router();

router.post("/", [verifyToken], createRole);
router.get("/", [verifyToken], listRoles);
router.get("/:id", [verifyToken], getRoleById);
router.put("/:id", [verifyToken], updateRole);
router.delete("/:id", [verifyToken], deleteRole);

export default router;
