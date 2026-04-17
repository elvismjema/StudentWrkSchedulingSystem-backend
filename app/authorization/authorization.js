import db  from "../models/index.js";
import logger from "../config/logger.js";

const Session = db.session;
const User = db.user;

const resolveUserIdFromSession = async (session) => {
  if (session?.userId) {
    return session.userId;
  }

  const rawEmail = typeof session?.email === "string" ? session.email.trim() : "";
  if (!rawEmail) {
    return null;
  }

  const normalizedEmail = rawEmail.toLowerCase();
  const user = await User.findOne({
    where: db.Sequelize.where(
      db.Sequelize.fn("LOWER", db.Sequelize.col("email")),
      normalizedEmail
    ),
    attributes: ["id"],
  });

  return user?.id || null;
};

const authenticate = async (req, res, next) => {
  let token = null;
 
  let authHeader = req.get("authorization");
  if (authHeader != null) {
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
      try {
        const session = await Session.findOne({ where: { token: token } });

        if (!session) {
          logger.warn("Authentication failed: session not found");
          return res.status(401).send({
            message: "Unauthorized! Invalid token",
          });
        }

        logger.debug(`Token validation - expiration: ${session.expirationDate}`);
        const expirationTime = new Date(session.expirationDate).getTime();
        if (Number.isNaN(expirationTime) || expirationTime < Date.now()) {
          logger.warn("Authentication failed: expired token");
          return res.status(401).send({
            message: "Unauthorized! Expired Token, Logout and Login again",
          });
        }

        const resolvedUserId = await resolveUserIdFromSession(session);

        logger.debug("Token valid, authentication successful");
        req.auth = {
          userId: resolvedUserId,
          email: session.email,
          token: session.token,
          sessionId: session.id,
        };
        next();
        return;
      } catch (err) {
        logger.error(`Authentication error: ${err.message}`);
        return res.status(500).send({
          message: "Error during authentication",
        });
      }
    } else {
      logger.warn('Authentication failed: invalid authorization format (must be Bearer token)');
      return res.status(401).send({
        message: "Unauthorized! Invalid authorization format. Expected 'Bearer <token>'",
      });
    }
  } else {
    logger.warn('Authentication failed: no authorization header');
    return res.status(401).send({
      message: "Unauthorized! No Auth Header",
    });
  }
};



export default authenticate;
