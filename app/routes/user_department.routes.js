import userDepartment from "../controllers/user_department.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// List available departments for joining
router.get("/departments", [authenticate], userDepartment.listAvailableDepartments);

// Submit a department join request
router.post("/", [authenticate], userDepartment.submitJoinRequest);

// List all departments for a specific user
router.get("/user/:userId", [authenticate], userDepartment.listUserDepartments);

// Leave a department (deactivate membership)
router.put("/leave/:id", [authenticate], userDepartment.leaveDepar);

export default router;
