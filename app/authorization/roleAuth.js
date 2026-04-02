import db from "../models/index.js";

const isManager = async (req, res, next) => {
  try {
    // Get user from session token
    let token = null;
    let authHeader = req.get("authorization");
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    if (!token) {
      return res.status(401).send({
        message: "Unauthorized! No token provided."
      });
    }

    const session = await db.session.findOne({
      where: { token: token },
      include: [{ model: db.user, as: 'user' }]
    });

    if (!session || session.expirationDate < Date.now()) {
      return res.status(401).send({
        message: "Unauthorized! Invalid or expired token."
      });
    }

    const user = session.user;
    if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
      return res.status(403).send({
        message: "Access denied! Manager or admin role required."
      });
    }

    // Attach user info to request for use in controllers
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    console.error('Role authorization error:', error);
    return res.status(500).send({
      message: "Error during authorization check."
    });
  }
};

const isManagerOrSelf = async (req, res, next) => {
  try {
    // Get user from session token
    let token = null;
    let authHeader = req.get("authorization");
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    if (!token) {
      return res.status(401).send({
        message: "Unauthorized! No token provided."
      });
    }

    const session = await db.session.findOne({
      where: { token: token },
      include: [{ model: db.user, as: 'user' }]
    });

    if (!session || session.expirationDate < Date.now()) {
      return res.status(401).send({
        message: "Unauthorized! Invalid or expired token."
      });
    }

    const user = session.user;
    const targetUserId = parseInt(req.params.userId || req.params.id);
    
    // Allow access if user is manager/admin or accessing their own data
    if (user.role === 'manager' || user.role === 'admin' || user.id === targetUserId) {
      req.user = user;
      req.session = session;
      next();
    } else {
      return res.status(403).send({
        message: "Access denied! Manager role or self-access required."
      });
    }
  } catch (error) {
    console.error('Role authorization error:', error);
    return res.status(500).send({
      message: "Error during authorization check."
    });
  }
};

export { isManager, isManagerOrSelf };
