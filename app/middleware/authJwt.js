import authenticate from "../authorization/authorization.js";

// Export authenticate as verifyToken for compatibility
export const verifyToken = authenticate;

export default {
  verifyToken
};
