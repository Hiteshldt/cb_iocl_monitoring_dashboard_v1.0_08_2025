const express = require('express');
const jwt = require('jsonwebtoken');
const { DISPLAY_DEVICE_ID, ADMIN_PASSWORD, JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', (req, res) => {
  try {
    const { deviceId, password } = req.body;

    // Validate input
    if (!deviceId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Device ID and password are required'
      });
    }

    // Check credentials
    if (deviceId !== DISPLAY_DEVICE_ID || password !== ADMIN_PASSWORD) {
      logger.warn(`Failed login attempt: ${deviceId}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid device ID or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { deviceId: DISPLAY_DEVICE_ID },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info(`Successful login: ${deviceId}`);

    res.json({
      success: true,
      token,
      deviceId: DISPLAY_DEVICE_ID
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify if token is valid
 */
router.post('/verify', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({
      success: true,
      valid: true,
      deviceId: decoded.deviceId
    });
  } catch (error) {
    res.json({
      success: false,
      valid: false,
      message: 'Invalid or expired token'
    });
  }
});

module.exports = router;
