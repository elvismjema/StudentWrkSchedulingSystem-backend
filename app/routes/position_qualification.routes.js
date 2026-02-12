import positionQualifications from "../controllers/position_qualification.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Position_Qualification
router.post("/", [authenticate], positionQualifications.create);

// Retrieve all Position_Qualifications
router.get("/", [authenticate], positionQualifications.findAll);

// Retrieve a single Position_Qualification with id
router.get("/:id", [authenticate], positionQualifications.findOne);

// Update a Position_Qualification with id
router.put("/:id", [authenticate], positionQualifications.update);

// Delete a Position_Qualification with id
router.delete("/:id", [authenticate], positionQualifications.delete);

export default router;
