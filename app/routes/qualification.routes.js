import express from "express";
import {
  createQualification,
  listQualifications,
  getQualificationById,
  updateQualification,
  deleteQualification,
  uploadQualificationDocument
} from "../controllers/qualification.controller.js";
import { verifyToken } from "../middleware/authJwt.js";

const router = express.Router();

router.post("/", [verifyToken], createQualification);
router.get("/", [verifyToken], listQualifications);
router.get("/:id", [verifyToken], getQualificationById);
router.put("/:id", [verifyToken], updateQualification);
router.delete("/:id", [verifyToken], deleteQualification);
router.post("/upload", [verifyToken], uploadQualificationDocument);

export default router;
