import admin from "../controllers/admin.controller.js";
import authenticate from "../authorization/authorization.js";
import requireAdmin from "../authorization/requireAdmin.js";
import { Router } from "express";

const router = Router();

router.get("/users", [authenticate, requireAdmin], admin.getAllUsers);
router.delete("/users/:userId", [authenticate, requireAdmin], admin.deleteUser);

router.get(
  "/pending-assignments",
  [authenticate, requireAdmin],
  admin.getPendingAssignments,
);
router.post(
  "/pending-assignments",
  [authenticate, requireAdmin],
  admin.createPendingAssignment,
);
router.delete(
  "/pending-assignments/:id",
  [authenticate, requireAdmin],
  admin.deletePendingAssignment,
);

router.get(
  "/departments/:departmentId/members",
  [authenticate, requireAdmin],
  admin.getDepartmentMembers,
);

export default router;
