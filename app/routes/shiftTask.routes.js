import shiftTask from "../controllers/shiftTask.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Shift Task
router.post("/", [authenticate], shiftTask.create);

// Retrieve all Shift Tasks
router.get("/", [authenticate], shiftTask.findAll);

// Retrieve all pending Shift Tasks
router.get("/pending", [authenticate], shiftTask.findAllPending);

// Retrieve all Shift Tasks for a specific shift
router.get("/shift/:shiftId", [authenticate], shiftTask.findAllForShift);

// Retrieve all Shift Tasks for a specific user
router.get("/user/:userId", [authenticate], shiftTask.findAllForUser);

// Retrieve a single Shift Task with id
router.get("/:id", [authenticate], shiftTask.findOne);

// Update a Shift Task with id
router.put("/:id", [authenticate], shiftTask.update);

// Start a Shift Task
router.patch("/:id/start", [authenticate], shiftTask.start);

// Complete a Shift Task
router.patch("/:id/complete", [authenticate], shiftTask.complete);

// Cancel a Shift Task
router.patch("/:id/cancel", [authenticate], shiftTask.cancel);

// Delete a Shift Task with id
router.delete("/:id", [authenticate], shiftTask.delete);

// Delete all Shift Tasks
router.delete("/", [authenticate], shiftTask.deleteAll);

export default router;
