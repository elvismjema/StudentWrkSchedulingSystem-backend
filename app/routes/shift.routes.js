import express from "express";
import * as shiftController from "../controllers/shift.controller.js";
import { verifyToken } from "../middleware/authJwt.js";
import authenticate from "../authorization/authorization.js";
import requireManager from "../authorization/requireManager.js";
import requireDepartmentManager from "../authorization/requireDepartmentManager.js";

const router = express.Router();

// Create a new Shift
router.post("/", [verifyToken, requireManager, requireDepartmentManager], shiftController.createShift);

// Bulk-publish multiple shifts (US1 AC4, US3 AC4 – consolidated notifications)
// Must appear before /:id routes to avoid matching conflicts
router.post("/bulk-publish", [verifyToken, requireManager, requireDepartmentManager], shiftController.bulkPublishShifts);

// Retrieve all Shifts with optional filters
router.get("/", [authenticate], shiftController.listShifts);

// Retrieve assignable workers for a shift time window
router.get("/assignable-workers", [verifyToken, requireManager, requireDepartmentManager], shiftController.listAssignableWorkers);

// Retrieve shift audit trail
router.get("/:id/audit", [verifyToken, requireManager, requireDepartmentManager], shiftController.getShiftAuditTrail);

// Retrieve a single Shift with id
router.get("/:id", [authenticate], shiftController.getShiftById);

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
