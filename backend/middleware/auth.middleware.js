const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Verify JWT token middleware
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = decoded;

    next();
  } catch (error) {
    logger.error('Token verification failed:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

module.exports = { verifyToken };
