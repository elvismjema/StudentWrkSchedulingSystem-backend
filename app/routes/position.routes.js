import express from "express";
import {
  createPosition,
  listPositions,
  getPositionById,
  updatePosition,
  deletePosition
} from "../controllers/position.controller.js";
import { verifyToken } from "../middleware/authJwt.js";

const router = express.Router();

router.post("/", [verifyToken], createPosition);
router.get("/", [verifyToken], listPositions);
router.get("/:id", [verifyToken], getPositionById);
router.put("/:id", [verifyToken], updatePosition);
router.delete("/:id", [verifyToken], deletePosition);

export default router;
