  import users from "../controllers/user.controller.js";
  import  authenticate from "../authorization/authorization.js";
  import requireManager from "../authorization/requireManager.js";
  import { Router } from "express";
  var router = Router()


  // Create a new User
  router.post("/", [authenticate], users.create);

  // Retrieve all People
  router.get("/", [authenticate], users.findAll);

  // Check if a user exists by email
  router.get("/check-email/:email", [authenticate], users.findByEmail);

  // Deactivate a User account
  router.patch("/:id/deactivate", [authenticate, requireManager], users.deactivateUser);

  // Permanently delete a user from manager flow (department-scoped permission check in controller)
  router.delete("/:id/permanent-manager", [authenticate, requireManager], users.deleteByManager);

  // Retrieve a single User with id
  router.get("/:id", [authenticate], users.findOne);

  // Update a User with id
  router.put("/:id", [authenticate], users.update);

  // Delete a User with id
  router.delete("/:id", [authenticate], users.delete);


  export default router;
