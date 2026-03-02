import conflictAlert from "../controllers/conflictAlert.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Conflict Alert
router.post("/", [authenticate], conflictAlert.create);

// Retrieve all Conflict Alerts
router.get("/", [authenticate], conflictAlert.findAll);

// Retrieve all open Conflict Alerts
router.get("/open", [authenticate], conflictAlert.findAllOpen);

// Retrieve all Conflict Alerts for a specific user
router.get("/user/:userId", [authenticate], conflictAlert.findAllForUser);

// Retrieve all Conflict Alerts for a specific shift
router.get("/shift/:shiftId", [authenticate], conflictAlert.findAllForShift);

// Retrieve a single Conflict Alert with id
router.get("/:id", [authenticate], conflictAlert.findOne);

// Update a Conflict Alert with id
router.put("/:id", [authenticate], conflictAlert.update);

// Acknowledge a Conflict Alert
router.patch("/:id/acknowledge", [authenticate], conflictAlert.acknowledge);

// Resolve a Conflict Alert
router.patch("/:id/resolve", [authenticate], conflictAlert.resolve);

// Cancel a Conflict Alert
router.patch("/:id/cancel", [authenticate], conflictAlert.cancel);

// Delete a Conflict Alert with id
router.delete("/:id", [authenticate], conflictAlert.delete);

// Delete all Conflict Alerts
router.delete("/", [authenticate], conflictAlert.deleteAll);

export default router;
