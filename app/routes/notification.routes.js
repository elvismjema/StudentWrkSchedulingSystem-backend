import express from "express";
import * as notificationController from "../controllers/notification.controller.js";

const router = express.Router();

// Create a new Notification
router.post("/", notificationController.createNotification);

// Retrieve all Notifications (with optional user filter)
router.get("/", notificationController.getAllNotifications);

// Retrieve a single Notification by id
router.get("/:id", notificationController.getNotificationById);

// Update a Notification by id
router.put("/:id", notificationController.updateNotification);

// Delete a Notification by id
router.delete("/:id", notificationController.deleteNotification);

// Mark notification as read
router.patch("/:id/read", notificationController.markAsRead);

export default router;
