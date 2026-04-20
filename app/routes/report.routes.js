import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import requireManager from "../authorization/requireManager.js";
import controller from "../controllers/report.controller.js";

const router = Router();

// All report endpoints require at least manager-level access
router.get("/shift-coverage", [authenticate, requireManager], controller.shiftCoverage);
router.get("/hours-worked",   [authenticate, requireManager], controller.hoursWorked);
router.get("/attendance",     [authenticate, requireManager], controller.attendance);
router.get("/time-off",       [authenticate, requireManager], controller.timeOff);
router.get("/task-completion", [authenticate, requireManager], controller.taskCompletion);

export default router;
