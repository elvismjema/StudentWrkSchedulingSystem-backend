import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import requireManager from "../authorization/requireManager.js";
import {
  getManagerOverview,
  getManagerSwapRequests,
  reviewSwapRequest,
  getManagerTimeOffRequests,
  reviewManagerTimeOffRequest,
  getManagerOpenShiftClaims,
  reviewManagerOpenShiftClaim,
} from "../controllers/manager.controller.js";

const router = Router();

router.get("/overview", [authenticate, requireManager], getManagerOverview);

// ── Swap / Cover Approval ───────────────────────────────────────────────────────
router.get("/swap-requests", [authenticate, requireManager], getManagerSwapRequests);
router.put("/swap-requests/:id", [authenticate, requireManager], reviewSwapRequest);
router.get("/time-off-requests", [authenticate, requireManager], getManagerTimeOffRequests);
router.put("/time-off-requests/:id", [authenticate, requireManager], reviewManagerTimeOffRequest);
router.get("/open-shift-claims", [authenticate, requireManager], getManagerOpenShiftClaims);
router.put("/open-shift-claims/:id", [authenticate, requireManager], reviewManagerOpenShiftClaim);

export default router;
