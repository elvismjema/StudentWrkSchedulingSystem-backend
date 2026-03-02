import db from "../models/index.js";

const UserDepartment = db.userDepartment;
const Role = db.role;

const normalize = (value) => String(value || "").toLowerCase().trim();

const parseEmailList = (value) =>
  String(value || "")
    .split(",")
    .map(normalize)
    .filter(Boolean);

const parseDomainList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => normalize(entry).replace(/^@+/, ""))
    .filter(Boolean);

const ENV_BOOTSTRAP_MANAGER_EMAILS = parseEmailList(
  process.env.BOOTSTRAP_MANAGER_EMAILS || "",
);
const ENV_BOOTSTRAP_ADMIN_EMAILS = parseEmailList(
  process.env.BOOTSTRAP_ADMIN_EMAILS || "",
);

const BOOTSTRAP_MANAGER_EMAILS = new Set(ENV_BOOTSTRAP_MANAGER_EMAILS);

const BOOTSTRAP_ADMIN_EMAILS = new Set(ENV_BOOTSTRAP_ADMIN_EMAILS);

const OPEN_MANAGER_BOOTSTRAP = normalize(
  process.env.OPEN_MANAGER_BOOTSTRAP || "true",
) !== "false";

const OPEN_MANAGER_BOOTSTRAP_DOMAINS = new Set(
  parseDomainList(process.env.OPEN_MANAGER_BOOTSTRAP_DOMAINS || "oc.edu,eagles.oc.edu"),
);

const hasAllowedBootstrapDomain = (email) => {
  const normalizedEmail = normalize(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return false;
  }

  const domain = normalizedEmail.split("@").pop();
  return OPEN_MANAGER_BOOTSTRAP_DOMAINS.has(domain);
};

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

const systemHasAssignedManagerOrAdmin = async () => {
  const memberships = await UserDepartment.findAll({
    where: {
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

  return memberships.some((membership) => {
    const classification = classifyRoleName(membership?.role?.role_name);
    return classification === "admin" || classification === "manager";
  });
};

const canUseOpenManagerBootstrap = async (email) => {
  if (!OPEN_MANAGER_BOOTSTRAP) return false;
  if (!hasAllowedBootstrapDomain(email)) return false;

  // If explicit bootstrap emails are configured, prefer those and keep behavior strict.
  if (ENV_BOOTSTRAP_MANAGER_EMAILS.length > 0 || ENV_BOOTSTRAP_ADMIN_EMAILS.length > 0) {
    return false;
  }

  const hasAssignedManagerOrAdmin = await systemHasAssignedManagerOrAdmin();
  return !hasAssignedManagerOrAdmin;
};

export const resolveHighestRoleForUser = async (userId, email) => {
  const normalizedEmail = normalize(email);
  if (BOOTSTRAP_ADMIN_EMAILS.has(normalizedEmail)) return "admin";

  const memberships = await getUserRoleMemberships(userId);
  const roleTypes = memberships.map((membership) => membership.classification);

  if (roleTypes.includes("admin")) return "admin";
  if (roleTypes.includes("manager")) return "manager";
  if (BOOTSTRAP_MANAGER_EMAILS.has(normalizedEmail)) return "manager";
  if (await canUseOpenManagerBootstrap(normalizedEmail)) return "manager";
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

  if (
    managedFromMemberships.length === 0 &&
    (await canUseOpenManagerBootstrap(normalizedEmail))
  ) {
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
