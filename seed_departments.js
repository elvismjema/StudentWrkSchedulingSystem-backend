import db from "./app/models/index.js";

const departments = [
  { department_name: "The Brew", description: "Campus coffee shop" },
  { department_name: "Fitness Center", description: "Gym and recreation center" },
  { department_name: "Student Success", description: "Student academic support services" },
  { department_name: "Support Central", description: "Campus support and help desk" },
  { department_name: "Library", description: "Campus library services" },
];

const seed = async () => {
  try {
    await db.sequelize.authenticate();
    console.log("Connected to database.");

    // Sync the department table (creates if not exists)
    await db.department.sync();

    for (const dept of departments) {
      const [record, created] = await db.department.findOrCreate({
        where: { department_name: dept.department_name },
        defaults: dept,
      });
      console.log(
        created
          ? `Created: ${dept.department_name}`
          : `Already exists: ${dept.department_name}`
      );
    }

    // Also sync user_departments table
    await db.userDepartment.sync();
    console.log("user_departments table synced.");

    console.log("\nDone! You can now restart the backend.");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err.message);
    process.exit(1);
  }
};

seed();
