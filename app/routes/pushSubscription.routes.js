import { Router } from "express";
import {
  getVapidPublicKey,
  saveSubscription,
  deleteSubscription,
} from "../controllers/pushSubscription.controller.js";
import authenticate from "../authorization/authorization.js";

const router = Router();

// Public — no auth needed to retrieve the VAPID public key
router.get("/vapid-public-key", getVapidPublicKey);

// Authenticated routes
router.post("/", [authenticate], saveSubscription);
router.delete("/", [authenticate], deleteSubscription);

export default router;
