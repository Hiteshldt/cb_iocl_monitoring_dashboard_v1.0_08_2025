const awsService = require('./aws.service');
const cacheService = require('./cache.service');
const dataTransformer = require('./data-transformer.service');
const fileStorage = require('../utils/fileStorage');
const logger = require('../utils/logger');
const { DISPLAY_UPDATE_INTERVAL } = require('../config/constants');

class DisplayService {
  constructor() {
    this.updateInterval = null;
    this.isRunning = false;
    this.enabled = true;
    this.stateLoaded = false;
  }

  async loadState() {
    if (this.stateLoaded) return;

    const saved = await fileStorage.readJSON('display-settings.json');
    if (saved && typeof saved.enabled === 'boolean') {
      this.enabled = saved.enabled;
    } else {
      await this.saveState();
    }
    this.stateLoaded = true;
  }

  async saveState() {
    await fileStorage.writeJSON('display-settings.json', { enabled: this.enabled });
  }

  /**
   * Start display update service
   */
  async start() {
    await this.loadState();

    if (!this.enabled) {
      logger.info('Display service is disabled; not starting interval');
      return;
    }

    if (this.isRunning) {
      logger.warn('Display service already running');
      return;
    }

    logger.info(`Starting display update service (interval: ${DISPLAY_UPDATE_INTERVAL}ms)`);

    // Update immediately on start
    this.updateDisplay();

    // Then update at intervals
    this.updateInterval = setInterval(() => {
      this.updateDisplay();
    }, DISPLAY_UPDATE_INTERVAL);

    this.isRunning = true;
  }

  /**
   * Stop display update service
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.isRunning = false;
      logger.info('Display service stopped');
    }
  }

  /**
   * Update display with current data
   */
  async updateDisplay() {
    try {
      if (!this.enabled) {
        return;
      }

      // Get processed data from cache (already transformed)
      const processedData = cacheService.getProcessedData();
      const currentData = cacheService.getLatestData();

      if (!currentData && !processedData) {
        logger.debug('No data available for display update');
        return;
      }

      // =====================================================================
      // Use dataTransformer to get display values
      // This allows custom configuration of what values go to the LED screen
      // Edit DISPLAY_TRANSFORMS in data-transformer.service.js to customize
      // =====================================================================
      const displayData = dataTransformer.getDisplayValues(processedData || { sensors: currentData });

      if (!displayData) {
        logger.debug('Could not generate display values');
        return;
      }

      // Send command to device
      await awsService.sendCommand(displayData);

      logger.debug(`Display updated: AQI=${displayData.i11}, TEMP=${displayData.i12}, HUM=${displayData.i13}%, ${displayData.i14}:${displayData.i15} ${displayData.i16}/${displayData.i17}/${displayData.i18}`);
    } catch (error) {
      logger.error('Error updating display:', error.message);
    }
  }

  /**
   * Enable display updates
   */
  async enable() {
    await this.loadState();
    this.enabled = true;
    await this.saveState();
    await this.start();
    return this.getStatus();
  }

  /**
   * Disable display updates
   */
  async disable() {
    await this.loadState();
    this.enabled = false;
    await this.saveState();
    this.stop();
    return this.getStatus();
  }

  /**
   * Calculate AQI from outlet sensor data
   * This is a simplified AQI calculation
   * In production, use proper AQI formula based on pollutant standards
   */
  calculateAQI(data) {
    try {
      const co2 = data.d8 || 0;        // Outlet-CO₂
      const pm = data.d9 || 0;         // Outlet-Dust PM
      const temp = data.d10 || 0;      // Outlet-Temperature
      const humidity = data.d11 || 0;  // Outlet-Humidity

      // Simplified AQI calculation
      // Weight: CO2 (40%), PM (40%), Temp (10%), Humidity (10%)
      let aqi = (co2 * 0.4) + (pm * 0.4) + (temp * 0.1) + (humidity * 0.1);

      // Ensure AQI is within valid range (0-500)
      aqi = Math.max(0, Math.min(500, Math.round(aqi)));

      return aqi;
    } catch (error) {
      logger.error('Error calculating AQI:', error);
      return 0;
    }
  }

  /**
   * Get display service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      enabled: this.enabled,
      updateInterval: DISPLAY_UPDATE_INTERVAL
    };
  }

  /**
   * Get AQI category based on value
   */
  getAQICategory(aqi) {
    if (aqi <= 50) return { category: 'Good', color: 'green' };
    if (aqi <= 100) return { category: 'Moderate', color: 'yellow' };
    if (aqi <= 150) return { category: 'Unhealthy for Sensitive Groups', color: 'orange' };
    if (aqi <= 200) return { category: 'Unhealthy', color: 'red' };
    if (aqi <= 300) return { category: 'Very Unhealthy', color: 'purple' };
    return { category: 'Hazardous', color: 'maroon' };
  }
}

module.exports = new DisplayService();
