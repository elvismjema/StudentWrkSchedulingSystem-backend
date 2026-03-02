import scheduleGapAlert from "../controllers/scheduleGapAlert.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Schedule Gap Alert
router.post("/", [authenticate], scheduleGapAlert.create);

// Retrieve all Schedule Gap Alerts
router.get("/", [authenticate], scheduleGapAlert.findAll);

// Retrieve all open Schedule Gap Alerts
router.get("/open", [authenticate], scheduleGapAlert.findAllOpen);

// Retrieve Schedule Gap Alerts by date range
router.get("/date-range", [authenticate], scheduleGapAlert.findByDateRange);

// Retrieve all Schedule Gap Alerts for a specific department
router.get("/department/:departmentId", [authenticate], scheduleGapAlert.findAllForDepartment);

// Retrieve a single Schedule Gap Alert with id
router.get("/:id", [authenticate], scheduleGapAlert.findOne);

// Update a Schedule Gap Alert with id
router.put("/:id", [authenticate], scheduleGapAlert.update);

// Update Schedule Gap Alert status
router.patch("/:id/status", [authenticate], scheduleGapAlert.updateStatus);

// Delete a Schedule Gap Alert with id
router.delete("/:id", [authenticate], scheduleGapAlert.delete);

// Delete all Schedule Gap Alerts
router.delete("/", [authenticate], scheduleGapAlert.deleteAll);

export default router;
