import { Router } from "express";

import AuthRoutes from "./auth.routes.js";
import UserRoutes from "./user.routes.js";
import EmployeeRoutes from "./employee.routes.js";
import TutorialRoutes from "./tutorial.routes.js";
import LessonRoutes from "./lesson.routes.js";
import NotificationRoutes from "./notification.routes.js";
import ClockRecordRoutes from "./clock_record.routes.js";
import TimeDiscrepancyRoutes from "./time_discrepancy.routes.js";
import AvailabilityRoutes from "./availability.routes.js";
import ShiftRoutes from "./shift.routes.js";
import ScheduleGapAlertRoutes from "./scheduleGapAlert.routes.js";
import ShiftAcknowledgementRoutes from "./shiftAcknowledgement.routes.js";
import ConflictAlertRoutes from "./conflictAlert.routes.js";
import ShiftTaskRoutes from "./shiftTask.routes.js";
import PositionRoutes from "./position.routes.js";
import DepartmentRoutes from "./department.routes.js";
import RoleRoutes from "./role.routes.js";
import DepartmentHoursRoutes from "./department_hours.routes.js";
import QualificationRoutes from "./qualification.routes.js";

import UserDepartmentRoutes from "./user_department.routes.js";
import ManagerRoutes from "./manager.routes.js";
import AdminRoutes from "./admin.routes.js";
import ScheduleTemplateRoutes from "./schedule_template.routes.js";
import ShiftTradeRoutes from "./shift_trade.routes.js";
import PositionQualificationRoutes from "./position_qualification.routes.js";
import ShiftTagRoutes from "./shift_tag.routes.js";
import TagRoutes from "./tag.routes.js";

import ReportRoutes from "./report.routes.js";
import SystemSettingRoutes from "./system_setting.routes.js";

// ── NEW: Student Dashboard Routes ────────────────────────────────────────────
import StudentRoutes from "./student.routes.js";


const router = Router();

// API Routes
router.use("/", AuthRoutes);
router.use("/users", UserRoutes);
router.use("/employees", EmployeeRoutes);
router.use("/tutorials", TutorialRoutes);
router.use("/tutorials", LessonRoutes);
router.use("/notifications", NotificationRoutes);
router.use("/clock-records", ClockRecordRoutes);
router.use("/time_discrepancies", TimeDiscrepancyRoutes);
router.use("/availabilities", AvailabilityRoutes);
router.use("/shifts", ShiftRoutes);
router.use("/schedule-gap-alerts", ScheduleGapAlertRoutes);
router.use("/shift-acknowledgements", ShiftAcknowledgementRoutes);
router.use("/conflict-alerts", ConflictAlertRoutes);
router.use("/shift-tasks", ShiftTaskRoutes);
router.use("/positions", PositionRoutes);
router.use("/departments", DepartmentRoutes);
router.use("/roles", RoleRoutes);
router.use("/department-hours", DepartmentHoursRoutes);
router.use("/qualifications", QualificationRoutes);

router.use("/user-departments", UserDepartmentRoutes);
router.use("/manager", ManagerRoutes);
router.use("/admin", AdminRoutes);
router.use("/schedule-templates", ScheduleTemplateRoutes);
router.use("/shift-trades", ShiftTradeRoutes);
router.use("/position-qualifications", PositionQualificationRoutes);
router.use("/shift-tags", ShiftTagRoutes);
router.use("/tags", TagRoutes);

router.use("/reports", ReportRoutes);
router.use("/system-settings", SystemSettingRoutes);

// ── NEW: Student Dashboard ───────────────────────────────────────────────────
router.use("/student", StudentRoutes);


export default router;
