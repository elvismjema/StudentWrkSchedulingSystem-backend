import express from "express";
import * as notificationController from "../controllers/notification.controller.js";
import authenticate from "../authorization/authorization.js";

const router = express.Router();

// Create a new Notification
router.post("/", [authenticate], notificationController.createNotification);

// Retrieve all Notifications (with optional user filter)
router.get("/", [authenticate], notificationController.getAllNotifications);

// Delete all Notifications for the authenticated user (or optional authorized user filter)
router.delete("/", [authenticate], notificationController.deleteAllNotifications);

// Retrieve a single Notification by id
router.get("/:id", [authenticate], notificationController.getNotificationById);

// Update a Notification by id
router.put("/:id", [authenticate], notificationController.updateNotification);

// Delete a Notification by id
router.delete("/:id", [authenticate], notificationController.deleteNotification);

// Mark notification as read
router.patch("/:id/read", [authenticate], notificationController.markAsRead);

export default router;
