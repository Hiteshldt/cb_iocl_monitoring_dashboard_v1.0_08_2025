const express = require('express');
const awsService = require('../services/aws.service');
const cacheService = require('../services/cache.service');
const { transformDeviceData } = require('../utils/deviceMapper');
const { verifyToken } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/device/current
 * Get current device data
 */
router.get('/current', (req, res) => {
  try {
    const latestData = cacheService.getLatestData();
    const deviceStatus = cacheService.getDeviceStatus();

    if (!latestData) {
      return res.status(404).json({
        success: false,
        message: 'No data available'
      });
    }

    // Transform device ID
    const transformedData = transformDeviceData(latestData);

    res.json({
      success: true,
      data: transformedData,
      status: deviceStatus
    });
  } catch (error) {
    logger.error('Error getting current data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching current data'
    });
  }
});

/**
 * GET /api/device/status
 * Get device online/offline status
 */
router.get('/status', (req, res) => {
  try {
    const status = cacheService.getDeviceStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Error getting device status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device status'
    });
  }
});

/**
 * GET /api/device/history/hour
 * Get hourly historical data
 */
router.get('/history/hour', async (req, res) => {
  try {
    const data = await awsService.getHourlyData();

    // Transform device IDs
    const transformedData = {
      ...data,
      deviceId: transformDeviceData({ deviceId: data.deviceId }).deviceId,
      data: transformDeviceData(data.data)
    };

    res.json({
      success: true,
      ...transformedData
    });
  } catch (error) {
    logger.error('Error fetching hourly data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hourly data'
    });
  }
});

/**
 * GET /api/device/history/day
 * Get daily historical data
 */
router.get('/history/day', async (req, res) => {
  try {
    const data = await awsService.getDailyData();

    const transformedData = {
      ...data,
      deviceId: transformDeviceData({ deviceId: data.deviceId }).deviceId,
      data: transformDeviceData(data.data)
    };

    res.json({
      success: true,
      ...transformedData
    });
  } catch (error) {
    logger.error('Error fetching daily data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching daily data'
    });
  }
});

/**
 * GET /api/device/history/week
 * Get weekly historical data
 */
router.get('/history/week', async (req, res) => {
  try {
    const data = await awsService.getWeeklyData();

    const transformedData = {
      ...data,
      deviceId: transformDeviceData({ deviceId: data.deviceId }).deviceId,
      data: transformDeviceData(data.data)
    };

    res.json({
      success: true,
      ...transformedData
    });
  } catch (error) {
    logger.error('Error fetching weekly data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching weekly data'
    });
  }
});

module.exports = router;
