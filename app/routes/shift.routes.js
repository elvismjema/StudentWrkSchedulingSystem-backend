import express from "express";
import * as shiftController from "../controllers/shift.controller.js";
import { verifyToken } from "../middleware/authJwt.js";

const router = express.Router();

// Create a new Shift
router.post("/", [verifyToken], shiftController.createShift);

// Retrieve all Shifts with optional filters
router.get("/", [verifyToken], shiftController.listShifts);

// Retrieve a single Shift with id
router.get("/:id", [verifyToken], shiftController.getShiftById);

// Update a Shift with id
router.put("/:id", [verifyToken], shiftController.updateShift);

// Delete a Shift with id
router.delete("/:id", [verifyToken], shiftController.deleteShift);

// Preview shifts based on template
router.post("/preview", [verifyToken], shiftController.previewShifts);

export default router;
