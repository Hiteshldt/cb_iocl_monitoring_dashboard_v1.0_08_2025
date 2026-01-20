const awsService = require('./aws.service');
const cacheService = require('./cache.service');
const dataTransformer = require('./data-transformer.service');
const automationService = require('./automation.service');
const fileStorage = require('../utils/fileStorage');
const logger = require('../utils/logger');
const { DISPLAY_UPDATE_INTERVAL } = require('../config/constants');

/**
 * Display Service
 *
 * Sends display values (i11-i22) to the external LED screen via AWS API.
 *
 * FIXED ISSUES:
 * 1. Uses setTimeout chain instead of setInterval to prevent drift
 * 2. Prevents overlapping updates with isUpdating flag
 * 3. Calculates time right before sending to minimize delay
 * 4. Logs timing for verification
 */
class DisplayService {
  constructor() {
    this.updateTimeout = null;      // Changed from updateInterval
    this.isRunning = false;
    this.enabled = true;
    this.stateLoaded = false;
    this.isUpdating = false;        // Prevents overlapping updates
    this.updateCount = 0;           // Track number of updates for debugging
    this.lastUpdateTime = null;     // Track when last update was sent
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
      logger.info('Display service is disabled; not starting');
      return;
    }

    if (this.isRunning) {
      logger.warn('Display service already running');
      return;
    }

    logger.info(`Starting display update service (interval: ${DISPLAY_UPDATE_INTERVAL}ms = ${DISPLAY_UPDATE_INTERVAL / 1000}s)`);

    this.isRunning = true;
    this.updateCount = 0;

    // Update immediately on start, then schedule next
    this.updateDisplay();
  }

  /**
   * Schedule the next update using setTimeout (prevents drift)
   * Only schedules if service is still running and enabled
   */
  scheduleNextUpdate() {
    if (!this.isRunning || !this.enabled) {
      return;
    }

    // Clear any existing timeout
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // Schedule next update
    this.updateTimeout = setTimeout(() => {
      this.updateDisplay();
    }, DISPLAY_UPDATE_INTERVAL);
  }

  /**
   * Stop display update service
   */
  stop() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    this.isRunning = false;
    this.isUpdating = false;
    logger.info('Display service stopped');
  }

  /**
   * Get current IST time (Indian Standard Time = UTC+5:30)
   * Called right before sending to minimize delay
   */
  getISTTime() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    return new Date(utcTime + istOffset);
  }

  /**
   * Update display with current data
   * Uses overlap prevention and timing verification
   */
  async updateDisplay() {
    // Prevent overlapping updates
    if (this.isUpdating) {
      logger.warn('Display update skipped - previous update still in progress');
      this.scheduleNextUpdate();
      return;
    }

    if (!this.enabled) {
      this.scheduleNextUpdate();
      return;
    }

    this.isUpdating = true;
    const startTime = Date.now();
    this.updateCount++;

    try {
      // Get processed data from cache (already transformed)
      const processedData = cacheService.getProcessedData();
      const currentData = cacheService.getLatestData();

      if (!currentData && !processedData) {
        logger.debug('No data available for display update');
        return;
      }

      // Get automation rules to determine relay modes (manual vs auto)
      const automationRules = await automationService.getRules();

      // Get display values (sensor data, relay states)
      const displayData = dataTransformer.getDisplayValues(processedData || { sensors: currentData }, automationRules);

      if (!displayData) {
        logger.debug('Could not generate display values');
        return;
      }

      // =====================================================================
      // CRITICAL: Calculate time RIGHT BEFORE sending to minimize delay
      // This ensures the time shown on LED is as accurate as possible
      // =====================================================================
      const istTime = this.getISTTime();
      displayData.i14 = istTime.getHours();       // Hour (24h, no leading zero)
      displayData.i15 = istTime.getMinutes();     // Minute (no leading zero)
      displayData.i16 = istTime.getDate();        // Day
      displayData.i17 = istTime.getMonth() + 1;   // Month
      displayData.i18 = istTime.getFullYear() % 100; // Year (last 2 digits)

      // Send command to device
      await awsService.sendCommand(displayData);

      const duration = Date.now() - startTime;
      this.lastUpdateTime = new Date();

      // Log with timing info for verification
      logger.info(`[Display #${this.updateCount}] Sent in ${duration}ms | Time: ${displayData.i14}:${displayData.i15} | Date: ${displayData.i16}/${displayData.i17}/${displayData.i18} | AQI: ${displayData.i11} | Temp: ${displayData.i12}°C | Hum: ${displayData.i13}%`);

      // Warn if update took too long
      if (duration > 5000) {
        logger.warn(`Display update took ${duration}ms - may cause perceived delay`);
      }

    } catch (error) {
      logger.error('Error updating display:', error.message);
    } finally {
      this.isUpdating = false;
      // Schedule next update AFTER this one completes (prevents overlap and drift)
      this.scheduleNextUpdate();
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
   * Calculate AQI from INLET sensor data (Outside Device)
   * This is a simplified AQI calculation fallback
   *
   * Sensor Mapping:
   * - d9  = Inlet CO₂ (ppm)
   * - d10 = Inlet PM2.5 (µg/m³)
   * - d11 = Inlet Temperature (°C)
   * - d12 = Inlet Humidity (%)
   */
  calculateAQI(data) {
    try {
      const co2 = data.d9 || 0;        // Inlet CO₂
      const pm = data.d10 || 0;        // Inlet PM2.5
      const temp = data.d11 || 0;      // Inlet Temperature
      const humidity = data.d12 || 0;  // Inlet Humidity

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
      updateInterval: DISPLAY_UPDATE_INTERVAL,
      updateCount: this.updateCount,
      lastUpdateTime: this.lastUpdateTime,
      isUpdating: this.isUpdating
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
