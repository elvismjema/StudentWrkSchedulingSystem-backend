import { Router } from "express";
import {
  listTaskLists,
  getTaskList,
  createTaskList,
  updateTaskList,
  deleteTaskList,
} from "../controllers/taskList.controller.js";
import authenticate from "../authorization/authorization.js";

const router = Router();

router.get("/", [authenticate], listTaskLists);
router.get("/:id", [authenticate], getTaskList);
router.post("/", [authenticate], createTaskList);
router.put("/:id", [authenticate], updateTaskList);
router.delete("/:id", [authenticate], deleteTaskList);

export default router;
