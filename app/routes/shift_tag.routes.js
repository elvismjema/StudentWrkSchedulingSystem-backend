import shiftTags from "../controllers/shift_tag.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Shift_Tag
router.post("/", [authenticate], shiftTags.create);

// Retrieve all Shift_Tags
router.get("/", [authenticate], shiftTags.findAll);

// Retrieve a single Shift_Tag with id
router.get("/:id", [authenticate], shiftTags.findOne);

// Update a Shift_Tag with id
router.put("/:id", [authenticate], shiftTags.update);

// Delete a Shift_Tag with id
router.delete("/:id", [authenticate], shiftTags.delete);

export default router;
