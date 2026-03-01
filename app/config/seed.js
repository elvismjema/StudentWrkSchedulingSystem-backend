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

export const runSeeds = async () => {
  try {
    await seedDepartments();
    logger.info("Database seeding completed");
  } catch (err) {
    logger.error(`Database seeding failed: ${err.message}`);
  }
};
