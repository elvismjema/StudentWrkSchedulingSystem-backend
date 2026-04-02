import tags from "../controllers/tag.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Tag
router.post("/", [authenticate], tags.create);

// Retrieve all Tags
router.get("/", [authenticate], tags.findAll);

// Retrieve a single Tag with id
router.get("/:id", [authenticate], tags.findOne);

// Update a Tag with id
router.put("/:id", [authenticate], tags.update);

// Delete a Tag with id
router.delete("/:id", [authenticate], tags.delete);

export default router;
