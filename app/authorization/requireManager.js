import logger from "../config/logger.js";
import { resolveHighestRoleForUser } from "./roleAccess.js";

const requireManager = async (req, res, next) => {
  const userId = req.auth?.userId;
  const email = req.auth?.email;

  if (!userId) {
    return res.status(401).send({
      message: "Unauthorized! Missing authenticated user context.",
    });
  }

  try {
    const role = await resolveHighestRoleForUser(userId, email);
    if (role !== "manager" && role !== "admin") {
      return res.status(403).send({
        message: "Forbidden! Manager access required.",
      });
    }

    return next();
  } catch (err) {
    logger.error(`Manager access check failed for user ${userId}: ${err.message}`);
    return res.status(500).send({
      message: "Error while verifying manager access.",
    });
  }
};

export default requireManager;
