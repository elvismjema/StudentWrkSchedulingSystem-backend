import logger from "../config/logger.js";
import { resolveHighestRoleForUser } from "./roleAccess.js";

const requireAdmin = async (req, res, next) => {
  const userId = req.auth?.userId;
  const email = req.auth?.email;

  if (!userId) {
    return res.status(401).send({
      message: "Unauthorized! Missing authenticated user context.",
    });
  }

  try {
    const role = await resolveHighestRoleForUser(userId, email);
    if (role !== "admin") {
      return res.status(403).send({
        message: "Forbidden! Admin access required.",
      });
    }

    return next();
  } catch (err) {
    logger.error(`Admin access check failed for user ${userId}: ${err.message}`);
    return res.status(500).send({
      message: "Error while verifying admin access.",
    });
  }
};

export default requireAdmin;
