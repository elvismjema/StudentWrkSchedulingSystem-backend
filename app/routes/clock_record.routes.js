import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import {
  clockIn,
  clockOut,
  getMyClockRecords,
  getMyOpenClockRecord,
} from "../controllers/clockRecord.controller.js";

const router = Router();

router.post("/clock-in", [authenticate], clockIn);
router.patch("/:id/clock-out", [authenticate], clockOut);
router.get("/me", [authenticate], getMyClockRecords);
router.get("/me/open", [authenticate], getMyOpenClockRecord);

export default router;
