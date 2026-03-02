import express from "express";
import * as shiftController from "../controllers/shift.controller.js";
import { verifyToken } from "../middleware/authJwt.js";
import requireManager from "../authorization/requireManager.js";
import requireDepartmentManager from "../authorization/requireDepartmentManager.js";

const router = express.Router();

// Create a new Shift
router.post("/", [verifyToken, requireManager, requireDepartmentManager], shiftController.createShift);

// Retrieve all Shifts with optional filters
router.get("/", [verifyToken], shiftController.listShifts);

// Retrieve shift audit trail
router.get("/:id/audit", [verifyToken, requireManager, requireDepartmentManager], shiftController.getShiftAuditTrail);

// Retrieve a single Shift with id
router.get("/:id", [verifyToken], shiftController.getShiftById);

// Update a Shift with id
router.put("/:id", [verifyToken, requireManager, requireDepartmentManager], shiftController.updateShift);

// Update Shift lifecycle status (draft/published/changed/cancelled)
router.patch("/:id/status", [verifyToken, requireManager, requireDepartmentManager], shiftController.updateShiftStatus);

// Publish a shift
router.patch("/:id/publish", [verifyToken, requireManager, requireDepartmentManager], shiftController.publishShift);

// Send shift reminder notification
router.post("/:id/remind", [verifyToken, requireManager, requireDepartmentManager], shiftController.sendShiftReminder);

// Delete a Shift with id
router.delete("/:id", [verifyToken, requireManager, requireDepartmentManager], shiftController.deleteShift);

// Preview shifts based on template
router.post("/preview", [verifyToken, requireManager], shiftController.previewShifts);

export default router;
