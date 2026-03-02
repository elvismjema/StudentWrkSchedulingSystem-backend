import express from "express";
import AdminController from "../controllers/admin.controller.js";
import authenticate from "../authorization/authorization.js";
import requireAdmin from "../authorization/requireAdmin.js";

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ─── Users ────────────────────────────────────────────────────────────────────
// Get all users with roles
router.get("/users", AdminController.listAllUsers);

// Hard-delete a user from the database
router.delete("/users/:id", AdminController.deleteUser);

// ─── Pending Assignments (pre-provisioning) ───────────────────────────────────
// List all unfulfilled pending assignments
router.get("/pending-assignments", AdminController.listPendingAssignments);

// Create a new pre-provisioned role assignment (by email, before first login)
router.post("/pending-assignments", AdminController.createPendingAssignment);

// Delete / cancel a pending assignment
router.delete("/pending-assignments/:id", AdminController.deletePendingAssignment);

// ─── Department Members ───────────────────────────────────────────────────────
// Get all members of a specific department
router.get("/departments/:id/members", AdminController.getDepartmentMembers);

export default router;
