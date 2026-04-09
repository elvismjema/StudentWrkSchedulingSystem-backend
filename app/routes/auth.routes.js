  import auth from "../controllers/auth.controller.js";
  import authenticate from "../authorization/authorization.js";
  import { Router } from "express";
  var router = Router()



  // Login
  router.post("/login", auth.login);
  router.post("/auth/google", auth.login);

  // Authorization
  router.post("/authorize", auth.authorize);
  router.post("/authorize/:id", auth.authorize);

  // Current authenticated user
  router.get("/auth/me", [authenticate], auth.me);
  router.get("/user", [authenticate], auth.me);

  // Logout
  router.post("/logout", auth.logout);

 export default router
