import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import requireManager from "../authorization/requireManager.js";
import {
  getManagerOverview,
  getManagerSwapRequests,
  reviewSwapRequest,
} from "../controllers/manager.controller.js";

const router = Router();

router.get("/overview", [authenticate, requireManager], getManagerOverview);

// ── Swap / Cover Approval ───────────────────────────────────────────────────────
router.get("/swap-requests", [authenticate, requireManager], getManagerSwapRequests);
router.put("/swap-requests/:id", [authenticate, requireManager], reviewSwapRequest);

export default router;
