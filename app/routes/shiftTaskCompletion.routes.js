import { Router } from "express";
import {
  getShiftCompletions,
  completeTask,
  uncompleteTask,
} from "../controllers/shiftTaskCompletion.controller.js";
import authenticate from "../authorization/authorization.js";

const router = Router();

// GET /shift-task-completions/:shift_id
router.get("/:shift_id", [authenticate], getShiftCompletions);

// POST /shift-task-completions  — body: { shift_id, task_list_item_id }
router.post("/", [authenticate], completeTask);

// DELETE /shift-task-completions/:shift_id/:task_list_item_id
router.delete("/:shift_id/:task_list_item_id", [authenticate], uncompleteTask);

export default router;
