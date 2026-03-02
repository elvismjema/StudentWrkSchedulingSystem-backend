import express from "express";
import * as shiftController from "../controllers/shift.controller.js";
import authenticate from "../authorization/authorization.js";

const router = express.Router();

// Create a new Shift
router.post("/", [authenticate], shiftController.createShift);

// Retrieve all Shifts with optional filters
router.get("/", [authenticate], shiftController.listShifts);

// Retrieve a single Shift with id
router.get("/:id", [authenticate], shiftController.getShiftById);

// Update a Shift with id (includes qualification validation for user assignment)
router.put("/:id", [authenticate], shiftController.updateShift);

// Delete a Shift with id
router.delete("/:id", [authenticate], shiftController.deleteShift);

// Preview shifts based on template
router.post("/preview", [authenticate], shiftController.previewShifts);

export default router;
