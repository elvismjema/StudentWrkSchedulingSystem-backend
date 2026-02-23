import express from "express";
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  removeAllDepartments
} from "../controllers/department.controller.js";
import { verifyToken } from "../middleware/authJwt.js";

const router = express.Router();

router.post("/", [verifyToken], createDepartment);
router.get("/", [verifyToken], listDepartments);
router.get("/:id", [verifyToken], getDepartmentById);
router.put("/:id", [verifyToken], updateDepartment);
router.delete("/:id", [verifyToken], deleteDepartment);
router.delete("/", [verifyToken], removeAllDepartments);

export default router;
