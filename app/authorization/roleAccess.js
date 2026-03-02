import db from "../models/index.js";

const UserDepartment = db.userDepartment;
const Role = db.role;

const BOOTSTRAP_MANAGER_EMAILS = new Set(
  String(process.env.BOOTSTRAP_MANAGER_EMAILS || "")
    .split(",")
    .map((email) => email.toLowerCase().trim())
    .filter(Boolean),
);

const BOOTSTRAP_ADMIN_EMAILS = new Set(
  String(process.env.BOOTSTRAP_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.toLowerCase().trim())
    .filter(Boolean),
);

const normalize = (value) => String(value || "").toLowerCase().trim();

const classifyRoleName = (roleName) => {
  const normalized = normalize(roleName);
  if (!normalized) return "student";
  if (normalized.includes("admin")) return "admin";
  if (
    normalized.includes("manager") ||
    normalized.includes("supervisor")
  ) {
    return "manager";
  }
  return "student";
};

const getUserRoleMemberships = async (userId) => {
  if (!userId) return [];

  const memberships = await UserDepartment.findAll({
    where: {
      user_id: userId,
      is_active: true,
    },
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["role_name"],
      },
    ],
  });

  return memberships.map((membership) => ({
    departmentId: membership.department_id,
    roleName: membership?.role?.role_name || "",
    classification: classifyRoleName(membership?.role?.role_name),
  }));
};

export const resolveHighestRoleForUser = async (userId, email) => {
  const normalizedEmail = normalize(email);
  if (BOOTSTRAP_ADMIN_EMAILS.has(normalizedEmail)) return "admin";

  const memberships = await getUserRoleMemberships(userId);
  const roleTypes = memberships.map((membership) => membership.classification);

  if (roleTypes.includes("admin")) return "admin";
  if (roleTypes.includes("manager")) return "manager";
  if (BOOTSTRAP_MANAGER_EMAILS.has(normalizedEmail)) return "manager";
  return "student";
};

export const getManagedDepartmentIds = async (userId, email) => {
  const normalizedEmail = normalize(email);
  const memberships = await getUserRoleMemberships(userId);
  const managedFromMemberships = memberships
    .filter((membership) =>
      membership.classification === "admin" ||
      membership.classification === "manager",
    )
    .map((membership) => membership.departmentId)
    .filter(Boolean);

  if (BOOTSTRAP_ADMIN_EMAILS.has(normalizedEmail)) {
    const allDepartments = await db.department.findAll({
      attributes: ["department_id"],
    });
    return allDepartments.map((department) => department.department_id);
  }

  if (BOOTSTRAP_MANAGER_EMAILS.has(normalizedEmail) && managedFromMemberships.length === 0) {
    const allDepartments = await db.department.findAll({
      attributes: ["department_id"],
    });
    return allDepartments.map((department) => department.department_id);
  }

  return [...new Set(managedFromMemberships)];
};

export const canManageDepartment = async (userId, email, departmentId) => {
  if (!departmentId) return false;
  const managedDepartmentIds = await getManagedDepartmentIds(userId, email);
  return managedDepartmentIds.includes(Number(departmentId));
};
