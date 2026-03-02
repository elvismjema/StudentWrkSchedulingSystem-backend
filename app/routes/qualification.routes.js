import express from "express";
import {
  createQualification,
  listQualifications,
  getQualificationById,
  updateQualification,
  deleteQualification,
  uploadQualificationDocument,
  listStudentsWithQualifications,
  getStudentQualifications,
  reviewQualificationDocument,
} from "../controllers/qualification.controller.js";
import { verifyToken } from "../middleware/authJwt.js";
import requireManager from "../authorization/requireManager.js";

const router = express.Router();

router.post("/", [verifyToken], createQualification);
router.get("/", [verifyToken], listQualifications);
router.get("/students/qualifications", [verifyToken, requireManager], listStudentsWithQualifications);
router.get("/students/:userId/qualifications", [verifyToken, requireManager], getStudentQualifications);
router.put("/user-qualifications/:id/review", [verifyToken, requireManager], reviewQualificationDocument);
router.post("/upload", [verifyToken], uploadQualificationDocument);
router.get("/:id", [verifyToken], getQualificationById);
router.put("/:id", [verifyToken], updateQualification);
router.delete("/:id", [verifyToken], deleteQualification);

// Upload qualification evidence for current user
// Student-only - POST /api/qualifications/me/upload
router.post("/qualifications/me/upload", [authenticate], upload.single('file'), qualificationController.uploadQualificationEvidence);

export default router;
