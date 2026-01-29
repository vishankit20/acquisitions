import logger from '#config/logger.js';
import { jwttoken } from '#utils/jwt.js';

// Global middleware: attach user from JWT (if present) onto req.user
const attachUserFromToken = (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      // No token -> treat as guest
      req.user = undefined;
      return next();
    }

    const decoded = jwttoken.verify(token);

    // Normalise shape of req.user used across the app
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
    };

    return next();
  } catch (e) {
    logger.warn('Failed to verify JWT token in auth middleware', {
      error: e.message,
    });
    // Invalid token -> treat as unauthenticated/guest; do not block outright here
    req.user = undefined;
    return next();
  }
};

// Route-level middleware factory: require that user is authenticated
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  return next();
};

// Route-level middleware factory: require one of the given roles
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: 'Forbidden: insufficient permissions' });
    }

    return next();
  };
};

export default attachUserFromToken;
