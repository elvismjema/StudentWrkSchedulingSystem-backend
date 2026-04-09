import userDepartment from "../controllers/user_department.controller.js";
import authenticate from "../authorization/authorization.js";
import requireManager from "../authorization/requireManager.js";
import { Router } from "express";

var router = Router();

// List available departments for joining
router.get("/departments", [authenticate], userDepartment.listAvailableDepartments);

// Submit a department join request
router.post("/", [authenticate], userDepartment.submitJoinRequest);

// Get user's active department
router.get("/active-department/:userId", [authenticate], userDepartment.getStudentActiveDepartment);

// List all departments for a specific user
router.get("/user/:userId", [authenticate], userDepartment.listUserDepartments);

// Leave a department (deactivate membership)
router.put("/leave/:id", [authenticate], userDepartment.leaveDepar);

// Manager: Get pending join requests for managed departments
router.get("/pending", [authenticate, requireManager], userDepartment.getPendingRequests);

// Manager: Approve a join request
router.put("/approve/:id", [authenticate, requireManager], userDepartment.approveJoinRequest);

// Manager: Reject a join request
router.put("/reject/:id", [authenticate, requireManager], userDepartment.rejectJoinRequest);

// Admin: Get all users with their roles
router.get("/admin/users-with-roles", [authenticate, requireManager], userDepartment.getAllUsersWithRoles);

// Admin: Assign or update user role
router.post("/admin/assign-role", [authenticate, requireManager], userDepartment.assignUserRole);

// Manager: Add or reactivate worker membership in managed department
router.post("/assign-worker", [authenticate, requireManager], userDepartment.assignWorker);

// Admin: Remove user role from department
router.delete("/admin/remove-role/:id", [authenticate, requireManager], userDepartment.removeUserRole);

// Get user's active roles across all departments
router.get("/roles/:userId", [authenticate], userDepartment.getUserRoles);

export default router;
