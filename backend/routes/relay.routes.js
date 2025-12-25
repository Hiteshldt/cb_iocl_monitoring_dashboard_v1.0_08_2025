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
 * Get all relay states from websocket/cache (source of truth)
 */
router.get('/states', (req, res) => {
  try {
    // Get relay states from cache (websocket data) - this is the source of truth
    const states = cacheService.getRelayStates();

    if (states) {
      res.json({
        success: true,
        states,
        source: 'websocket'
      });
    } else {
      // No websocket data yet - return default states
      res.json({
        success: true,
        states: {
          i1: 0, i2: 0, i3: 0, i4: 0, i5: 0,
          i6: 0, i7: 0, i8: 0, i9: 0, i10: 0
        },
        source: 'default'
      });
    }
  } catch (error) {
    logger.error('Error getting relay states:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching relay states'
    });
  }
});

module.exports = router;
