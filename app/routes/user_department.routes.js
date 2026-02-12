import userDepartments from "../controllers/user_department.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new User_Department
router.post("/", [authenticate], userDepartments.create);

// Retrieve all User_Departments
router.get("/", [authenticate], userDepartments.findAll);

// Retrieve a single User_Department with id
router.get("/:id", [authenticate], userDepartments.findOne);

// Update a User_Department with id
router.put("/:id", [authenticate], userDepartments.update);

// Delete a User_Department with id
router.delete("/:id", [authenticate], userDepartments.delete);

export default router;
