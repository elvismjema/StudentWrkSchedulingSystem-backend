import bcrypt from "bcryptjs";

// Test data fixtures
export const createTestUsers = async (db) => {
  const hashedPassword = await bcrypt.hash("password123", 8);
  
  // Create manager user
  const manager = await db.user.create({
    fName: "Test",
    lName: "Manager",
    email: "manager@test.com",
    role: "manager",
    password: hashedPassword
  });

  // Create admin user
  const admin = await db.user.create({
    fName: "Test",
    lName: "Admin",
    email: "admin@test.com",
    role: "admin",
    password: hashedPassword
  });

  // Create student users
  const student1 = await db.user.create({
    fName: "Test",
    lName: "Student1",
    email: "student1@test.com",
    role: "student",
    password: hashedPassword
  });

  const student2 = await db.user.create({
    fName: "Test",
    lName: "Student2",
    email: "student2@test.com",
    role: "student",
    password: hashedPassword
  });

  const student3 = await db.user.create({
    fName: "Test",
    lName: "Student3",
    email: "student3@test.com",
    role: "student",
    password: hashedPassword
  });

  return { manager, admin, student1, student2, student3 };
};

export const createTestDepartment = async (db, manager) => {
  return await db.department.create({
    department_name: "Test Department",
    created_by: manager.id
  });
};

export const createTestPositions = async (db, department) => {
  const position1 = await db.position.create({
    position_name: "Cashier",
    description: "Handles cash transactions",
    department_id: department.id
  });

  const position2 = await db.position.create({
    position_name: "Cook",
    description: "Prepares food items",
    department_id: department.id
  });

  return { position1, position2 };
};

export const createTestQualifications = async (db) => {
  const qual1 = await db.qualification.create({
    qualification_name: "Food Safety Certificate",
    description: "Certification for safe food handling",
    requires_document: true
  });

  const qual2 = await db.qualification.create({
    qualification_name: "Customer Service Training",
    description: "Training for customer service skills",
    requires_document: false
  });

  const qual3 = await db.qualification.create({
    qualification_name: "First Aid Certification",
    description: "First aid and CPR certification",
    requires_document: true
  });

  return { qual1, qual2, qual3 };
};

export const createTestPositionQualifications = async (db, positions, qualifications) => {
  // Cashier requires Customer Service Training
  await db.positionQualification.create({
    position_id: positions.position1.position_id,
    qualification_id: qualifications.qual2.qualification_id
  });

  // Cook requires Food Safety Certificate AND First Aid Certification
  await db.positionQualification.create({
    position_id: positions.position2.position_id,
    qualification_id: qualifications.qual1.qualification_id
  });

  await db.positionQualification.create({
    position_id: positions.position2.position_id,
    qualification_id: qualifications.qual3.qualification_id
  });
};

export const createTestUserQualifications = async (db, users, qualifications, manager) => {
  // Student1 has approved Customer Service Training
  await db.userQualification.create({
    user_id: users.student1.id,
    qualification_id: qualifications.qual2.qualification_id,
    approval_status: "APPROVED",
    approved_by_user_id: manager.id,
    approved_at: new Date(),
    document_name: "customer_service_cert.pdf"
  });

  // Student2 has approved Food Safety Certificate but pending First Aid
  await db.userQualification.create({
    user_id: users.student2.id,
    qualification_id: qualifications.qual1.qualification_id,
    approval_status: "APPROVED",
    approved_by_user_id: manager.id,
    approved_at: new Date(),
    document_name: "food_safety_cert.pdf"
  });

  await db.userQualification.create({
    user_id: users.student2.id,
    qualification_id: qualifications.qual3.qualification_id,
    approval_status: "PENDING"
  });

  // Student3 has no qualifications
};

export const createTestSessions = async (db, users) => {
  const managerSession = await db.session.create({
    token: "manager-token",
    expirationDate: Date.now() + 3600000, // 1 hour from now
    user_id: users.manager.id
  });

  const adminSession = await db.session.create({
    token: "admin-token",
    expirationDate: Date.now() + 3600000,
    user_id: users.admin.id
  });

  const studentSession = await db.session.create({
    token: "student-token",
    expirationDate: Date.now() + 3600000,
    user_id: users.student1.id
  });

  return { managerSession, adminSession, studentSession };
};

export const createTestShifts = async (db, department, positions, users) => {
  const shift1 = await db.shift.create({
    department_id: department.id,
    position_id: positions.position1.position_id, // Cashier
    start_time: "09:00:00",
    end_time: "17:00:00",
    shift_date: "2025-03-15",
    created_by: users.manager.id,
    is_published: true
  });

  const shift2 = await db.shift.create({
    department_id: department.id,
    position_id: positions.position2.position_id, // Cook
    start_time: "10:00:00",
    end_time: "18:00:00",
    shift_date: "2025-03-15",
    created_by: users.manager.id,
    is_published: true
  });

  return { shift1, shift2 };
};

export const setupTestData = async (db) => {
  // Clean up existing data
  await db.session.destroy({ where: {} });
  await db.userQualification.destroy({ where: {} });
  await db.positionQualification.destroy({ where: {} });
  await db.shift.destroy({ where: {} });
  await db.position.destroy({ where: {} });
  await db.qualification.destroy({ where: {} });
  await db.department.destroy({ where: {} });
  await db.user.destroy({ where: {} });

  // Create test data
  const users = await createTestUsers(db);
  const department = await createTestDepartment(db, users.manager);
  const positions = await createTestPositions(db, department);
  const qualifications = await createTestQualifications(db);
  await createTestPositionQualifications(db, positions, qualifications);
  await createTestUserQualifications(db, users, qualifications, users.manager);
  const sessions = await createTestSessions(db, users);
  const shifts = await createTestShifts(db, department, positions, users);

  return {
    users,
    department,
    positions,
    qualifications,
    sessions,
    shifts
  };
};
