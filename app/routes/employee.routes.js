import employees from "../controllers/employee.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

const router = Router();

// Create a new Employee
router.post("/", [authenticate], employees.create);

// Retrieve all Employees
router.get("/", [authenticate], employees.findAll);

// Retrieve a single Employee with id
router.get("/:id", [authenticate], employees.findOne);

// Update an Employee with id
router.put("/:id", [authenticate], employees.update);

// Delete an Employee with id
router.delete("/:id", [authenticate], employees.delete);

export default router;
