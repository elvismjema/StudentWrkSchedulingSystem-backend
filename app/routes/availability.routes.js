import availability from "../controllers/availability.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Availability
router.post("/", [authenticate], availability.create);

// Retrieve all Availabilities
router.get("/", [authenticate], availability.findAll);

// Retrieve all Availabilities for a specific user
router.get("/user/:userId", [authenticate], availability.findAllForUser);

// Retrieve a single Availability with id
router.get("/:id", [authenticate], availability.findOne);

// Update an Availability with id
router.put("/:id", [authenticate], availability.update);

// Update Availability status (approve/reject)
router.patch("/:id/status", [authenticate], availability.updateStatus);

// Delete an Availability with id
router.delete("/:id", [authenticate], availability.delete);

// Delete all Availabilities
router.delete("/", [authenticate], availability.deleteAll);

export default router;
