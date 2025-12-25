const express = require('express');
const awsService = require('../services/aws.service');
const cacheService = require('../services/cache.service');
const calculationsService = require('../services/calculations.service');
const displayService = require('../services/display.service');
const { transformDeviceData } = require('../utils/deviceMapper');
const { verifyToken } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/device/current
 * Get current device data with calculations
 */
router.get('/current', (req, res) => {
  try {
    const processedData = cacheService.getProcessedData();
    const deviceStatus = cacheService.getDeviceStatus();

    if (!processedData) {
      // Fallback to raw data if processed not available
      const latestData = cacheService.getLatestData();
      if (!latestData) {
        return res.status(404).json({
          success: false,
          message: 'No data available'
        });
      }

      const transformedData = transformDeviceData(latestData);
      return res.json({
        success: true,
        data: transformedData,
        status: deviceStatus
      });
    }

    // Return processed data with calculations
    res.json({
      success: true,
      data: processedData,
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
 * GET /api/device/airflow
 * Get current airflow rate setting
 */
router.get('/airflow', (req, res) => {
  try {
    const airflowRate = calculationsService.getAirflowRate();
    res.json({
      success: true,
      airflowRate,
      unit: 'm³/h'
    });
  } catch (error) {
    logger.error('Error getting airflow rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching airflow rate'
    });
  }
});

/**
 * PUT /api/device/airflow
 * Update airflow rate setting
 */
router.put('/airflow', (req, res) => {
  try {
    const { airflowRate } = req.body;

    if (typeof airflowRate !== 'number' || airflowRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid airflow rate. Must be a positive number.'
      });
    }

    const updatedRate = calculationsService.setAirflowRate(airflowRate);

    res.json({
      success: true,
      airflowRate: updatedRate,
      unit: 'm³/h'
    });
  } catch (error) {
    logger.error('Error updating airflow rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating airflow rate'
    });
  }
});

/**
 * GET /api/device/accumulated
 * Get accumulated CO2 and O2 totals
 */
router.get('/accumulated', (req, res) => {
  try {
    const totals = calculationsService.getAccumulatedTotals();
    res.json({
      success: true,
      ...totals
    });
  } catch (error) {
    logger.error('Error getting accumulated totals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching accumulated totals'
    });
  }
});

/**
 * POST /api/device/accumulated/reset
 * Reset accumulated CO2 and O2 totals
 */
router.post('/accumulated/reset', (req, res) => {
  try {
    calculationsService.resetAccumulatedTotals();
    res.json({
      success: true,
      message: 'Accumulated totals reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting accumulated totals:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting accumulated totals'
    });
  }
});

/**
 * GET /api/device/relay-names
 * Get relay names configuration
 */
router.get('/relay-names', (req, res) => {
  try {
    const relayNames = calculationsService.getRelayNames();
    res.json({
      success: true,
      relayNames
    });
  } catch (error) {
    logger.error('Error getting relay names:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching relay names'
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
 * GET /api/device/display
 * Get display update service status
 */
router.get('/display', (req, res) => {
  try {
    const status = displayService.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Error getting display status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching display status'
    });
  }
});

/**
 * PUT /api/device/display
 * Enable or disable display updates
 */
router.put('/display', async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload: "enabled" must be a boolean'
      });
    }

    const status = enabled
      ? await displayService.enable()
      : await displayService.disable();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Error updating display status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating display status'
    });
  }
});

/**
 * GET /api/device/history/hour
 * Get hourly historical data (for charts/reports, NOT live data)
 */
router.get('/history/hour', async (req, res) => {
  try {
    const data = await awsService.getHourlyGraphData();

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
 * Get daily historical data (for charts/reports)
 */
router.get('/history/day', async (req, res) => {
  try {
    const data = await awsService.getDailyGraphData();

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
 * Get weekly historical data (for charts/reports)
 */
router.get('/history/week', async (req, res) => {
  try {
    const data = await awsService.getWeeklyGraphData();

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

/**
 * GET /api/device/report
 * Request report generation for date range
 * Returns a download link from AWS
 */
router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required (format: YYYY-MM-DD)'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be before or equal to endDate'
      });
    }

    logger.info(`Report requested for ${startDate} to ${endDate}`);
    const data = await awsService.requestReport(startDate, endDate);

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    logger.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating report. Please try again.'
    });
  }
});

module.exports = router;
