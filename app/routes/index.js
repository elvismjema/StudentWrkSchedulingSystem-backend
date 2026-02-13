import { Router } from "express";

import AuthRoutes from "./auth.routes.js";
import UserRoutes from "./user.routes.js";
import TutorialRoutes from "./tutorial.routes.js";
import LessonRoutes from "./lesson.routes.js";
import TagRoutes from "./tag.routes.js";
import ShiftTagRoutes from "./shift_tag.routes.js";
import ShiftTradeRoutes from "./shift_trade.routes.js";
import UserDepartmentRoutes from "./user_department.routes.js";
import ClockRecordRoutes from "./clock_record.routes.js";
import PositionQualificationRoutes from "./position_qualification.routes.js";


const router = Router();

router.use("/", AuthRoutes);
router.use("/users", UserRoutes);
router.use("/tutorials", TutorialRoutes);
router.use("/tutorials", LessonRoutes);
router.use("/tags", TagRoutes);
router.use("/shift-tags", ShiftTagRoutes);
router.use("/shift-trades", ShiftTradeRoutes);
router.use("/user-departments", UserDepartmentRoutes);
router.use("/clock-records", ClockRecordRoutes);
router.use("/position-qualifications", PositionQualificationRoutes);

export default router;
