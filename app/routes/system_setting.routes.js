import { Router } from "express";
import authenticate from "../authorization/authorization.js";
import requireAdmin from "../authorization/requireAdmin.js";
import controller from "../controllers/systemSetting.controller.js";

const router = Router();

router.get("/",     [authenticate, requireAdmin], controller.getAll);
router.put("/:id",  [authenticate, requireAdmin], controller.update);
router.put("/",     [authenticate, requireAdmin], controller.bulkUpdate);

export default router;
