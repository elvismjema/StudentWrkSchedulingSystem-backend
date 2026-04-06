import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import requireManager from "../authorization/requireManager.js";
import {
  clockIn,
  clockOut,
  getMyClockRecords,
  getMyOpenClockRecord,
  getManagerTimecards,
  getManagerTimecardDetail,
  updateManagerTimecardStatus,
  approveAllManagerTimecards,
} from "../controllers/clockRecord.controller.js";

const router = Router();

router.post("/clock-in", [authenticate], clockIn);
router.patch("/:id/clock-out", [authenticate], clockOut);
router.get("/me", [authenticate], getMyClockRecords);
router.get("/me/open", [authenticate], getMyOpenClockRecord);
router.get("/manager/timecards", [authenticate, requireManager], getManagerTimecards);
router.get("/manager/timecards/:userId", [authenticate, requireManager], getManagerTimecardDetail);
router.patch("/manager/timecards/:userId/status", [authenticate, requireManager], updateManagerTimecardStatus);
router.post("/manager/timecards/approve-all", [authenticate, requireManager], approveAllManagerTimecards);

export default router;
