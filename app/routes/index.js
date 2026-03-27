import { Router } from "express";

import AuthRoutes from "./auth.routes.js";
import UserRoutes from "./user.routes.js";
import TutorialRoutes from "./tutorial.routes.js";
import LessonRoutes from "./lesson.routes.js";
import NotificationRoutes from "./notification.routes.js";
import TimeDiscrepancyRoutes from "./time_discrepancy.routes.js";
import AvailabilityRoutes from "./availability.routes.js";
import ShiftRoutes from "./shift.routes.js";
import QualificationRoutes from "./qualification.routes.js";
import DepartmentRoutes from "./department.routes.js";
import RoleRoutes from "./role.routes.js";

const router = Router();

// API Routes
router.use("/", AuthRoutes);
router.use("/users", UserRoutes);
router.use("/tutorials", TutorialRoutes);
router.use("/tutorials", LessonRoutes);
router.use("/notifications", NotificationRoutes);
router.use("/time_discrepancies", TimeDiscrepancyRoutes);
router.use("/availabilities", AvailabilityRoutes);
router.use("/shifts", ShiftRoutes);
router.use("/qualifications", QualificationRoutes);
router.use("/departments", DepartmentRoutes);
router.use("/roles", RoleRoutes);

export default router;
