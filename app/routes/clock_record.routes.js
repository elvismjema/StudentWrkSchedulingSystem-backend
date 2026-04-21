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
  getManagerLiveAttendance,
  createManagerManualEntry,
  deleteManagerManualEntry,
} from "../controllers/clockRecord.controller.js";

const router = Router();

router.post("/clock-in", [authenticate], clockIn);
router.patch("/:id/clock-out", [authenticate], clockOut);
router.get("/me", [authenticate], getMyClockRecords);
router.get("/me/open", [authenticate], getMyOpenClockRecord);
router.get("/manager/live-attendance", [authenticate, requireManager], getManagerLiveAttendance);
router.get("/manager/timecards", [authenticate, requireManager], getManagerTimecards);
router.get("/manager/timecards/:userId", [authenticate, requireManager], getManagerTimecardDetail);
router.patch("/manager/timecards/:userId/status", [authenticate, requireManager], updateManagerTimecardStatus);
router.post("/manager/timecards/approve-all", [authenticate, requireManager], approveAllManagerTimecards);
// Manual time entry — manager creates/deletes a shift-less clock record for a worker
router.post("/manager/timecards/:userId/manual-entry", [authenticate, requireManager], createManagerManualEntry);
router.delete("/manager/entries/:clockId", [authenticate, requireManager], deleteManagerManualEntry);

export default router;
