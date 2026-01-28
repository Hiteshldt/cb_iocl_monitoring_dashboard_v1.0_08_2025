/**
 * Calibration Routes
 *
 * API endpoints for pH sensor calibration
 */

const express = require('express');
const calibrationService = require('../services/calibration.service');
const { verifyToken } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/calibration/ph/verify-password
 * Verify calibration password before starting calibration
 */
router.post('/ph/verify-password', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const isValid = calibrationService.verifyPassword(password);

    if (!isValid) {
      logger.warn('Invalid calibration password attempt');
      return res.status(401).json({
        success: false,
        message: 'Invalid calibration password'
      });
    }

    logger.info('Calibration password verified');
    res.json({
      success: true,
      message: 'Password verified'
    });
  } catch (error) {
    logger.error('Error verifying password:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying password'
    });
  }
});

/**
 * GET /api/calibration/ph/status
 * Get current calibration status
 */
router.get('/ph/status', (req, res) => {
  try {
    const status = calibrationService.getCalibrationStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Error getting calibration status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching calibration status'
    });
  }
});

/**
 * GET /api/calibration/ph/raw-value
 * Get current raw pH sensor value (for calibration capture)
 */
router.get('/ph/raw-value', (req, res) => {
  try {
    const result = calibrationService.getRawPhValue();

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error('Error getting raw pH value:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching raw pH value'
    });
  }
});

/**
 * POST /api/calibration/ph/test
 * Test calibration with a raw value
 */
router.post('/ph/test', (req, res) => {
  try {
    const { rawValue } = req.body;

    if (typeof rawValue !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'rawValue is required and must be a number'
      });
    }

    const result = calibrationService.testCalibration(rawValue);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error testing calibration:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing calibration'
    });
  }
});

/**
 * POST /api/calibration/ph/save
 * Save new calibration
 */
router.post('/ph/save', (req, res) => {
  try {
    const { password, type, points } = req.body;

    // Verify password first
    if (!password || !calibrationService.verifyPassword(password)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid calibration password'
      });
    }

    // Validate type
    if (!type || !['2-point', '3-point'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be "2-point" or "3-point"'
      });
    }

    // Validate points
    if (!points || !Array.isArray(points)) {
      return res.status(400).json({
        success: false,
        message: 'Points must be an array'
      });
    }

    const expectedPoints = type === '2-point' ? 2 : 3;
    if (points.length !== expectedPoints) {
      return res.status(400).json({
        success: false,
        message: `${type} calibration requires exactly ${expectedPoints} points`
      });
    }

    // Save calibration
    const result = calibrationService.saveNewCalibration(type, points);

    if (!result.success) {
      return res.status(400).json(result);
    }

    logger.info(`pH calibration saved: ${type}`);
    res.json(result);
  } catch (error) {
    logger.error('Error saving calibration:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving calibration'
    });
  }
});

/**
 * POST /api/calibration/ph/reset
 * Reset calibration to default
 */
router.post('/ph/reset', (req, res) => {
  try {
    const { password } = req.body;

    // Verify password first
    if (!password || !calibrationService.verifyPassword(password)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid calibration password'
      });
    }

    const result = calibrationService.resetToDefault();

    if (!result.success) {
      return res.status(500).json(result);
    }

    logger.info('pH calibration reset to default');
    res.json(result);
  } catch (error) {
    logger.error('Error resetting calibration:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting calibration'
    });
  }
});

module.exports = router;
