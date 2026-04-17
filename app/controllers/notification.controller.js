import db from "../models/index.js";
import { resolveHighestRoleForUser } from "../authorization/roleAccess.js";

const Notification = db.notification;
const User = db.user;

// Create and Save a new Notification
export const createNotification = async (req, res) => {
  try {
    const { title, message, userId } = req.body;
    
    // Validate request
    if (!title || !message || !userId) {
      return res.status(400).json({
        success: false,
        message: "Title, message, and userId are required"
      });
    }

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with id=${userId} not found`
      });
    }

    // Create notification
    const notification = await Notification.create({
      title,
      message,
      userId,
      isRead: false
    });

    return res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating notification",
      error: error.message
    });
  }
};

// Retrieve all Notifications
export const getAllNotifications = async (req, res) => {
  try {
    const requestedUserId = req.query.userId ? Number(req.query.userId) : null;
    const authUserId = Number(req.auth?.userId);
    const authEmail = req.auth?.email;
    const authRole = await resolveHighestRoleForUser(authUserId, authEmail);
    const isPrivileged = authRole === "manager" || authRole === "admin";

    let condition = {};

    if (requestedUserId) {
      if (isPrivileged) {
        condition.userId = requestedUserId;
      } else {
        // Gracefully tolerate stale clients sending mismatched userId query.
        // Students should only ever receive their own notifications.
        condition.userId = authUserId;
      }
    } else if (!isPrivileged) {
      condition.userId = authUserId;
    }

    const notifications = await Notification.findAll({ 
      where: condition,
      include: [{
        model: User,
        as: "user",
        attributes: ['id', 'fName', 'lName', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error.message
    });
  }
};

// Find a single Notification by id
export const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = Number(req.auth?.userId);
    const authRole = await resolveHighestRoleForUser(authUserId, req.auth?.email);

    const notification = await Notification.findByPk(id, {
      include: [{
        model: User,
        as: "user",
        attributes: ['id', 'fName', 'lName', 'email']
      }]
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: `Notification with id=${id} not found`
      });
    }

    if (notification.userId !== authUserId && authRole !== "manager" && authRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden! You can only read your own notifications.",
      });
    }

    return res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error("Error retrieving notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving notification",
      error: error.message
    });
  }
};

// Update a Notification by id
export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, isRead } = req.body;

    const [updated] = await Notification.update(
      { 
        title,
        message,
        isRead,
        updatedAt: new Date()
      },
      { where: { id } }
    );

    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: `Notification with id=${id} not found or no changes made`
      });
    }

    const updatedNotification = await Notification.findByPk(id);
    
    return res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: updatedNotification
    });
  } catch (error) {
    console.error("Error updating notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating notification",
      error: error.message
    });
  }
};

// Delete a Notification by id
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Notification.destroy({
      where: { id }
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Notification with id=${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error.message
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = Number(req.auth?.userId);
    const authRole = await resolveHighestRoleForUser(authUserId, req.auth?.email);

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: `Notification with id=${id} not found`
      });
    }

    if (notification.userId !== authUserId && authRole !== "manager" && authRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden! You can only update your own notifications.",
      });
    }

    const [updated] = await Notification.update(
      { 
        isRead: true,
        updatedAt: new Date()
      },
      { where: { id } }
    );

    if (updated === 0) {
      return res.status(500).json({
        success: false,
        message: "Notification update failed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read"
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message
    });
  }
};
