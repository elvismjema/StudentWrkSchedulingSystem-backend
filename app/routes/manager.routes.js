import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import requireManager from "../authorization/requireManager.js";
import { getManagerOverview } from "../controllers/manager.controller.js";

const router = Router();

router.get("/overview", [authenticate, requireManager], getManagerOverview);

export default router;
