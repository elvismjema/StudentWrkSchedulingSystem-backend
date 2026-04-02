import availability from "../controllers/availability.controller.js";
import authenticate from "../authorization/authorization.js";
import requireAdmin from "../authorization/requireAdmin.js";
import { Router } from "express";

const router = Router();

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

// FIX: Delete all Availabilities — restricted to admin only
router.delete("/", [authenticate, requireAdmin], availability.deleteAll);

export default router;
