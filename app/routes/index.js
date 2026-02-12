import { Router } from "express";

import AuthRoutes from "./auth.routes.js";
import UserRoutes from "./user.routes.js";
import TutorialRoutes from "./tutorial.routes.js";
import LessonRoutes from "./lesson.routes.js";
import NotificationRoutes from "./notification.routes.js";

import TimeDiscrepancyRoutes from "./time_discrepancy.routes.js";
=======
import AvailabilityRoutes from "./availability.routes.js";


const router = Router();

// API Routes
router.use("/", AuthRoutes);
router.use("/users", UserRoutes);
router.use("/tutorials", TutorialRoutes);
router.use("/tutorials", LessonRoutes);
router.use("/notifications", NotificationRoutes);

router.use("/time_discrepancies", TimeDiscrepancyRoutes);
=======
router.use("/availabilities", AvailabilityRoutes);


export default router;
