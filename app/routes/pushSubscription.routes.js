import { Router } from "express";
import {
  getVapidPublicKey,
  saveSubscription,
  deleteSubscription,
  sendTestPush,
} from "../controllers/pushSubscription.controller.js";
import authenticate from "../authorization/authorization.js";

const router = Router();

// Public — no auth needed to retrieve the VAPID public key
router.get("/vapid-public-key", getVapidPublicKey);

// Authenticated routes
router.post("/", [authenticate], saveSubscription);
router.delete("/", [authenticate], deleteSubscription);

// Self-serve test: send a canned push to all of the authenticated user's
// devices. Scoped to req.auth.userId — no target id in path or body.
router.post("/me/test", [authenticate], sendTestPush);

export default router;
