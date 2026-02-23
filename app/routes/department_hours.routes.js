import express from "express";
import {
  addDepartmentHours,
  listDepartmentHours,
  getDepartmentHoursById,
  updateDepartmentHours,
  deleteDepartmentHours
} from "../controllers/department_hours.controller.js";
import { verifyToken } from "../middleware/authJwt.js";

const router = express.Router();

router.post("/", [verifyToken], addDepartmentHours);
router.get("/", [verifyToken], listDepartmentHours);
router.get("/:id", [verifyToken], getDepartmentHoursById);
router.put("/:id", [verifyToken], updateDepartmentHours);
router.delete("/:id", [verifyToken], deleteDepartmentHours);

export default router;
