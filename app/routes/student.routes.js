/**
 * Student Routes
 *
 * All student-facing endpoints consolidated under /student.
 * Every route requires authentication. Ownership is enforced in the controller.
 */

import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import {
  // 1. Dashboard
  getDashboard,
  // 2. My Schedule
  getMySchedule,
  // 3. Open Shifts
  getOpenShifts,
  claimOpenShift,
  // 4. Shift Swap
  findCover,
  createSwapRequest,
  getSwapRequests,
  respondToSwapRequest,
  // 5. Time Off
  submitTimeOff,
  getTimeOffRequests,
  // 6. Availability
  getMyAvailability,
  updateMyAvailability,
  // 7. Clock In/Out & Breaks
  studentClockIn,
  studentClockOut,
  startBreak,
  endBreak,
  // 8. Timesheet
  getTimesheet,
  // 9. Notifications
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  // 10. Profile
  getProfile,
  updateProfile,
  // 11. Acknowledgements
  getPendingAcknowledgements,
  acknowledgeShift,
} from "../controllers/student.controller.js";

const router = Router();

// ── 1. Dashboard ─────────────────────────────────────────────────────────────
router.get("/dashboard", [authenticate], getDashboard);

// ── 2. My Schedule ───────────────────────────────────────────────────────────
router.get("/my-schedule", [authenticate], getMySchedule);

// ── 3. Open Shifts ───────────────────────────────────────────────────────────
router.get("/open-shifts", [authenticate], getOpenShifts);
router.post("/open-shifts/:id/claim", [authenticate], claimOpenShift);

// ── 4. Shift Swap / Find Cover ──────────────────────────────────────────────
router.post("/shifts/:id/find-cover", [authenticate], findCover);
router.post("/shifts/:id/swap-request", [authenticate], createSwapRequest);
router.get("/swap-requests", [authenticate], getSwapRequests);
router.put("/swap-requests/:id", [authenticate], respondToSwapRequest);

// ── 5. Time Off ──────────────────────────────────────────────────────────────
router.post("/time-off", [authenticate], submitTimeOff);
router.get("/time-off", [authenticate], getTimeOffRequests);

// ── 6. Availability ──────────────────────────────────────────────────────────
router.get("/availability", [authenticate], getMyAvailability);
router.put("/availability", [authenticate], updateMyAvailability);

// ── 7. Clock In/Out & Breaks ─────────────────────────────────────────────────
router.post("/clock-in", [authenticate], studentClockIn);
router.post("/clock-out", [authenticate], studentClockOut);
router.post("/break/start", [authenticate], startBreak);
router.post("/break/end", [authenticate], endBreak);

// ── 8. Timesheet ─────────────────────────────────────────────────────────────
router.get("/timesheet", [authenticate], getTimesheet);

// ── 9. Notifications ─────────────────────────────────────────────────────────
router.get("/notifications", [authenticate], getNotifications);
// IMPORTANT: read-all must come BEFORE :id to avoid matching "read-all" as an id
router.put("/notifications/read-all", [authenticate], markAllNotificationsRead);
router.put("/notifications/:id/read", [authenticate], markNotificationRead);

// ── 10. Profile ──────────────────────────────────────────────────────────────
router.get("/profile", [authenticate], getProfile);
router.put("/profile", [authenticate], updateProfile);

// ── 11. Shift Acknowledgements ───────────────────────────────────────────────
router.get("/acknowledgements", [authenticate], getPendingAcknowledgements);
router.put("/acknowledgements/:id", [authenticate], acknowledgeShift);

export default router;
