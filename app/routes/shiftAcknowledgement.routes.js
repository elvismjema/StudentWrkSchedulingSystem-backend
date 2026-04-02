import shiftAcknowledgement from "../controllers/shiftAcknowledgement.controller.js";
import authenticate from "../authorization/authorization.js";
import requireAdmin from "../authorization/requireAdmin.js";
import { Router } from "express";

const router = Router();

// Create a new Shift Acknowledgement
router.post("/", [authenticate], shiftAcknowledgement.create);

// Retrieve all Shift Acknowledgements
router.get("/", [authenticate], shiftAcknowledgement.findAll);

// Retrieve all unacknowledged Shift Acknowledgements
router.get("/unacknowledged", [authenticate], shiftAcknowledgement.findAllUnacknowledged);

// Retrieve all Shift Acknowledgements for a specific user
router.get("/user/:userId", [authenticate], shiftAcknowledgement.findAllForUser);

// Retrieve all Shift Acknowledgements for a specific shift
router.get("/shift/:shiftId", [authenticate], shiftAcknowledgement.findAllForShift);

// Retrieve a single Shift Acknowledgement with id
router.get("/:id", [authenticate], shiftAcknowledgement.findOne);

// Update a Shift Acknowledgement with id
router.put("/:id", [authenticate], shiftAcknowledgement.update);

// Acknowledge a shift
router.patch("/:id/acknowledge", [authenticate], shiftAcknowledgement.acknowledge);

// Mark shift as imported to calendar
router.patch("/:id/calendar-import", [authenticate], shiftAcknowledgement.markCalendarImported);

// Delete a Shift Acknowledgement with id
router.delete("/:id", [authenticate], shiftAcknowledgement.delete);

// FIX: Delete all Shift Acknowledgements — restricted to admin only
router.delete("/", [authenticate, requireAdmin], shiftAcknowledgement.deleteAll);

export default router;
