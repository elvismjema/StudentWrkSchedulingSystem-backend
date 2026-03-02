import express from "express";
import * as qualificationController from "../controllers/qualification.controller.js";
import { isManager } from "../authorization/roleAuth.js";
import authenticate from "../authorization/authorization.js";
import { upload } from "../controllers/qualification.controller.js";

const router = express.Router();

// Get all students with their qualifications (optional filter by qualificationId)
// Manager-only - matches frontend path: students/qualifications
router.get("/students/qualifications", [authenticate, isManager], qualificationController.getStudentsWithQualifications);

// Get qualifications for a specific student
// Manager-only - matches frontend path: students/:userId/qualifications
router.get("/students/:userId/qualifications", [authenticate, isManager], qualificationController.getStudentQualifications);

// Get required qualifications for a position
// Manager-only - matches frontend path: positions/:positionId/required-qualifications
router.get("/positions/:positionId/required-qualifications", [authenticate, isManager], qualificationController.getPositionRequiredQualifications);

// Get all available qualifications
// Authenticated users - matches frontend path: qualifications
router.get("/qualifications", [authenticate], qualificationController.getAllQualifications);

// Check if user is qualified for a position
// Manager-only - matches frontend path: qualifications/check
router.post("/qualifications/check", [authenticate, isManager], qualificationController.checkUserQualificationForPosition);

// Upload qualification evidence for current user
// Student-only - POST /api/qualifications/me/upload
router.post("/qualifications/me/upload", [authenticate], upload.single('file'), qualificationController.uploadQualificationEvidence);

export default router;
