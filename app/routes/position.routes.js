import express from "express";
import {
  createPosition,
  listPositions,
  getPositionById,
  updatePosition,
  deletePosition
} from "../controllers/position.controller.js";
import { verifyToken } from "../middleware/authJwt.js";
import requireManager from "../authorization/requireManager.js";
import requireDepartmentManager from "../authorization/requireDepartmentManager.js";

const router = express.Router();

router.post("/", [verifyToken, requireManager, requireDepartmentManager], createPosition);
router.get("/", [verifyToken], listPositions);
router.get("/:id", [verifyToken], getPositionById);
router.put("/:id", [verifyToken, requireManager, requireDepartmentManager], updatePosition);
router.delete("/:id", [verifyToken, requireManager, requireDepartmentManager], deletePosition);

export default router;
