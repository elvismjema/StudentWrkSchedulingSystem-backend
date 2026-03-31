import db from "../models/index.js";

const User = db.user;
const Role = db.role;

// Get all available roles (from the ENUM)
export const getAllRoles = async (req, res) => {
  try {
    // Return the available roles from the ENUM
    const roles = [
      { role_id: "student", role_name: "Student", permission_level: 10 },
      { role_id: "manager", role_name: "Manager", permission_level: 50 },
      { role_id: "admin", role_name: "Administrator", permission_level: 90 }
    ];
    
    res.status(200).json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({
      message: "Error retrieving roles",
      error: error.message
    });
  }
};

// Get single role by ID (for ENUM roles)
export const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const allRoles = [
      { role_id: "student", role_name: "Student", permission_level: 10 },
      { role_id: "manager", role_name: "Manager", permission_level: 50 },
      { role_id: "admin", role_name: "Administrator", permission_level: 90 }
    ];
    
    const role = allRoles.find(r => r.role_id === id);
    
    if (!role) {
      return res.status(404).json({
        message: "Role not found"
      });
    }
    
    res.status(200).json(role);
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({
      message: "Error retrieving role",
      error: error.message
    });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    if (!userId || !role) {
      return res.status(400).json({
        message: "User ID and role are required"
      });
    }
    
    // Validate role is one of the allowed roles
    const allowedRoles = ["student", "manager", "admin"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role. Must be one of: " + allowedRoles.join(", ")
      });
    }
    
    // Update user role in user_department table
    await db.userDepartment.update(
      { role },
      { where: { user_id: userId } }
    );
    
    res.status(200).json({
      message: "User role updated successfully",
      userId,
      role
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      message: "Error updating user role",
      error: error.message
    });
  }
};
