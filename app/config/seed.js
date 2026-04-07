import db from "../models/index.js";
import logger from "./logger.js";

const seedDepartments = async () => {
  const departments = [
    { department_name: "The Brew", description: "Campus coffee shop" },
    { department_name: "Fitness Center", description: "Gym and recreation center" },
    { department_name: "Student Success", description: "Student academic support services" },
    { department_name: "Support Central", description: "Campus support and help desk" },
    { department_name: "Library", description: "Campus library services" },
  ];

  for (const dept of departments) {
    await db.department.findOrCreate({
      where: { department_name: dept.department_name },
      defaults: dept,
    });
  }
};

const seedPositions = async () => {
  const departments = await db.department.findAll();
  const deptMap = {};
  for (const d of departments) {
    deptMap[d.department_name] = d.department_id;
  }

  const positions = [
    { department_name: "The Brew", position_name: "Barista", description: "Makes coffee and espresso drinks" },
    { department_name: "The Brew", position_name: "Cashier", description: "Handles register and customer orders" },
    { department_name: "Fitness Center", position_name: "Front Desk", description: "Check-in and customer service" },
    { department_name: "Fitness Center", position_name: "Lifeguard", description: "Pool safety and supervision", is_critical: true },
    { department_name: "Fitness Center", position_name: "Equipment Attendant", description: "Maintains gym equipment" },
    { department_name: "Student Success", position_name: "Tutor", description: "Provides academic tutoring" },
    { department_name: "Student Success", position_name: "Front Desk", description: "Reception and scheduling" },
    { department_name: "Support Central", position_name: "Help Desk", description: "IT and general support" },
    { department_name: "Support Central", position_name: "Phone Support", description: "Handles phone inquiries" },
    { department_name: "Library", position_name: "Circulation Desk", description: "Book checkout and returns" },
    { department_name: "Library", position_name: "Shelver", description: "Reshelves returned materials" },
  ];

  for (const pos of positions) {
    const deptId = deptMap[pos.department_name];
    if (!deptId) continue;
    await db.position.findOrCreate({
      where: { department_id: deptId, position_name: pos.position_name },
      defaults: {
        department_id: deptId,
        position_name: pos.position_name,
        description: pos.description,
        is_critical: pos.is_critical || false,
      },
    });
  }
};

const seedRoles = async () => {
  const departments = await db.department.findAll();

  const roleTemplates = [
    { role_name: "Student", permission_level: 10, description: "Student worker with basic scheduling access" },
    { role_name: "Manager", permission_level: 60, description: "Department manager with scheduling and approval permissions" },
  ];

  for (const dept of departments) {
    for (const template of roleTemplates) {
      await db.role.findOrCreate({
        where: {
          department_id: dept.department_id,
          role_name: template.role_name,
        },
        defaults: {
          department_id: dept.department_id,
          role_name: template.role_name,
          permission_level: template.permission_level,
          description: template.description,
        },
      });
    }
  }
};

export const runSeeds = async () => {
  try {
    await seedDepartments();
    await seedPositions();
    await seedRoles();
    logger.info("Database seeding completed");
  } catch (err) {
    logger.error(`Database seeding failed: ${err.message}`);
  }
};
