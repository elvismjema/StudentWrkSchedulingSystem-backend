import clockRecords from "../controllers/clock_record.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Clock_Record
router.post("/", [authenticate], clockRecords.create);

// Retrieve all Clock_Records
router.get("/", [authenticate], clockRecords.findAll);

// Retrieve a single Clock_Record with id
router.get("/:id", [authenticate], clockRecords.findOne);

// Update a Clock_Record with id
router.put("/:id", [authenticate], clockRecords.update);

// Delete a Clock_Record with id
router.delete("/:id", [authenticate], clockRecords.delete);

export default router;
