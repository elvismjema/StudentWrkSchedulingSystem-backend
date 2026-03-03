import express from "express";
import AdminController from "../controllers/admin.controller.js";
import authenticate from "../authorization/authorization.js";
import requireAdmin from "../authorization/requireAdmin.js";

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

router.get("/users", AdminController.listAllUsers);
router.delete("/users/:id", AdminController.deleteUser);

router.get("/pending-assignments", AdminController.listPendingAssignments);
router.post("/pending-assignments", AdminController.createPendingAssignment);
router.delete("/pending-assignments/:id", AdminController.deletePendingAssignment);

// Keep exact path used by current frontend admin page
router.get("/departments/:departmentId/members", AdminController.getDepartmentMembers);

export default router;
