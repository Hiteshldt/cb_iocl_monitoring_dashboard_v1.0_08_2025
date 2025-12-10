const awsService = require('./aws.service');
const cacheService = require('./cache.service');
const calculationsService = require('./calculations.service');
const logger = require('../utils/logger');
const { DATA_POLL_INTERVAL } = require('../config/constants');

class PollingService {
  constructor() {
    this.pollingInterval = null;
    this.isRunning = false;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 5;
  }

  /**
   * Start polling AWS API
   */
  start() {
    if (this.isRunning) {
      logger.warn('Polling service already running');
      return;
    }

    logger.info(`Starting data polling service (interval: ${DATA_POLL_INTERVAL}ms)`);

    // Poll immediately on start
    this.pollData();

    // Then poll at intervals
    this.pollingInterval = setInterval(() => {
      this.pollData();
    }, DATA_POLL_INTERVAL);

    this.isRunning = true;
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isRunning = false;
      logger.info('Polling service stopped');
    }
  }

  /**
   * Poll data from AWS
   */
  async pollData() {
    try {
      logger.debug('Polling data from AWS...');

      // Wait for calculations service to be initialized
      await calculationsService.waitForInit();

      // Fetch latest data
      const latestData = await awsService.getLatestData();

      if (latestData) {
        // Process data with calculations (AQI, CO2, O2)
        const processedData = calculationsService.processData(latestData);

        // Update cache with both raw and processed data
        cacheService.updateLatestData(latestData);
        cacheService.updateProcessedData(processedData);

        // Emit to connected clients (if Socket.IO is available)
        if (global.io) {
          global.io.emit('deviceUpdate', processedData);
        }

        // Reset error counter on success
        this.consecutiveErrors = 0;

        logger.debug('Data poll successful');
      } else {
        logger.warn('No data received from AWS');
      }
    } catch (error) {
      this.consecutiveErrors++;

      logger.error(`Data poll failed (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, error.message);

      // If too many consecutive errors, alert
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        logger.error('MAX CONSECUTIVE ERRORS REACHED - Device may be offline');

        // Emit offline status
        if (global.io) {
          global.io.emit('deviceStatus', { online: false, error: 'Device offline' });
        }
      }
    }
  }

  /**
   * Get polling status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: DATA_POLL_INTERVAL,
      consecutiveErrors: this.consecutiveErrors
    };
  }
}

module.exports = new PollingService();
