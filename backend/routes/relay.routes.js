const express = require('express');
const relayService = require('../services/relay.service');
const cacheService = require('../services/cache.service');
const { verifyToken } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/relay/control
 * Control a single relay
 */
router.post('/control', async (req, res) => {
  try {
    const { relay, state } = req.body;

    if (!relay || state === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Relay ID and state are required'
      });
    }

    const result = await relayService.controlRelay(relay, state);

    res.json({
      success: true,
      ...result,
      deviceStatus: cacheService.getDeviceStatus()
    });
  } catch (error) {
    logger.error('Error controlling relay:', error);

    // Return 503 Service Unavailable when device is offline
    const statusCode = error.code === 'DEVICE_OFFLINE' ? 503 : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error controlling relay',
      deviceStatus: cacheService.getDeviceStatus()
    });
  }
});

/**
 * GET /api/relay/states
 * Get all relay states
 */
router.get('/states', async (req, res) => {
  try {
    const states = await relayService.getAllRelayStates();

    res.json({
      success: true,
      states
    });
  } catch (error) {
    logger.error('Error getting relay states:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching relay states'
    });
  }
});

module.exports = router;
