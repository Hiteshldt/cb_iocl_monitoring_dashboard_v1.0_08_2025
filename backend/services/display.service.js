const awsService = require('./aws.service');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');
const { DISPLAY_UPDATE_INTERVAL } = require('../config/constants');

class DisplayService {
  constructor() {
    this.updateInterval = null;
    this.isRunning = false;
  }

  /**
   * Start display update service
   */
  start() {
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
      const currentData = cacheService.getLatestData();

      if (!currentData) {
        logger.debug('No data available for display update');
        return;
      }

      // Calculate AQI from outlet data
      const aqi = this.calculateAQI(currentData);

      // Get temperature and humidity from outlet
      const temperature = Math.round(currentData.d10 || 0);
      const humidity = Math.round(currentData.d11 || 0);

      // Get current date/time
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const day = now.getDate();
      const month = now.getMonth() + 1; // Month is 0-indexed
      const year = now.getFullYear() % 100; // Get last 2 digits

      // Prepare display command
      const displayData = {
        i11: aqi,
        i12: temperature,
        i13: humidity,
        i14: hour,
        i15: minute,
        i16: day,
        i17: month,
        i18: year
      };

      // Send command to device
      await awsService.sendCommand(displayData);

      logger.debug(`Display updated: AQI=${aqi}, TEMP=${temperature}, HUM=${humidity}%, ${hour}:${minute} ${day}/${month}/${year}`);
    } catch (error) {
      logger.error('Error updating display:', error.message);
    }
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
