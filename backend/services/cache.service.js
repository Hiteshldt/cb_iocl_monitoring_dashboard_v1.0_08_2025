const logger = require('../utils/logger');
const fileStorage = require('../utils/fileStorage');

class CacheService {
  constructor() {
    this.latestData = null;      // Transformed data
    this.rawData = null;         // Raw data before transformation (for calibration)
    this.processedData = null;
    this.lastUpdate = null;
    this.isOnline = false;

    // Consecutive failure tracking for stable online/offline detection
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 5; // 5 real API failures before marking offline
    this.lastError = null;

    // Time-based offline detection (backup check)
    // If no data received for this duration, consider offline
    this.offlineTimeoutMs = 90000; // 90 seconds - covers ~6-9 data intervals at 10-15s each
  }

  /**
   * Update cached data
   */
  updateLatestData(data) {
    this.latestData = data;
    this.lastUpdate = new Date();

    // Mark device as online and reset failure counter
    this.markOnline();

    // Persist to file
    fileStorage.writeJSON('last-data.json', {
      data: data,
      timestamp: this.lastUpdate.toISOString()
    }).catch(err => logger.error('Failed to persist data:', err));

    logger.debug('Cache updated with latest data');
  }

  /**
   * Mark device as online - called when data is successfully received
   * Resets consecutive failure counter
   */
  markOnline() {
    const wasOffline = !this.isOnline;
    this.isOnline = true;
    this.consecutiveFailures = 0;
    this.lastError = null;

    if (wasOffline) {
      logger.info('Device is now ONLINE');
    }
  }

  /**
   * Record a failure - called when polling fails
   * Device goes offline after maxConsecutiveFailures
   */
  recordFailure(error) {
    this.consecutiveFailures++;
    this.lastError = error?.message || 'Unknown error';

    logger.warn(`Poll failure ${this.consecutiveFailures}/${this.maxConsecutiveFailures}: ${this.lastError}`);

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      const wasOnline = this.isOnline;
      this.isOnline = false;

      if (wasOnline) {
        logger.error('Device is now OFFLINE after consecutive failures');
      }
    }
  }

  /**
   * Check if relay control is allowed (device must be online)
   */
  canControlRelays() {
    return this.isOnline;
  }

  /**
   * Update processed data (with calculations)
   */
  updateProcessedData(data) {
    this.processedData = data;
    logger.debug('Cache updated with processed data');
  }

  /**
   * Update raw data (before transformation)
   * Used for calibration where we need the original sensor values
   */
  updateRawData(data) {
    this.rawData = data;
    logger.debug('Cache updated with raw data');
  }

  /**
   * Get cached data (transformed)
   */
  getLatestData() {
    return this.latestData;
  }

  /**
   * Get raw data (before transformation)
   * Used for calibration
   */
  getRawData() {
    return this.rawData;
  }

  /**
   * Get processed data (with calculations)
   */
  getProcessedData() {
    return this.processedData;
  }

  /**
   * Get last update timestamp
   */
  getLastUpdate() {
    return this.lastUpdate;
  }

  /**
   * Check if device is online
   * Primary check: isOnline flag (set by markOnline/recordFailure)
   * Backup check: time since last data (for stale data detection)
   */
  isDeviceOnline() {
    // If we have recent data, we're online (regardless of isOnline flag)
    // This handles the startup case where we loaded persisted data
    if (this.lastUpdate) {
      const timeSinceLastUpdate = Date.now() - this.lastUpdate.getTime();

      // If data is fresh (within timeout), consider online
      if (timeSinceLastUpdate < this.offlineTimeoutMs) {
        // Sync the isOnline flag if it's out of date
        if (!this.isOnline) {
          this.isOnline = true;
          this.consecutiveFailures = 0;
        }
        return true;
      }

      // Data is stale - mark offline if not already
      if (this.isOnline) {
        this.isOnline = false;
        this.lastError = 'No data received for extended period';
        logger.warn(`Device marked OFFLINE: no data for ${Math.round(timeSinceLastUpdate / 1000)}s`);
      }
      return false;
    }

    // No data at all - use the isOnline flag
    return this.isOnline;
  }

  /**
   * Get specific sensor value
   */
  getSensorValue(sensorKey) {
    if (!this.latestData) return null;
    return this.latestData[sensorKey];
  }

  /**
   * Get all relay states
   */
  getRelayStates() {
    if (!this.latestData) return null;

    return {
      i1: this.latestData.i1 || 0,
      i2: this.latestData.i2 || 0,
      i3: this.latestData.i3 || 0,
      i4: this.latestData.i4 || 0,
      i5: this.latestData.i5 || 0,
      i6: this.latestData.i6 || 0,
      i7: this.latestData.i7 || 0,
      i8: this.latestData.i8 || 0,
      i9: this.latestData.i9 || 0,
      i10: this.latestData.i10 || 0
    };
  }

  /**
   * Load persisted data on server start
   */
  async loadPersistedData() {
    try {
      const persistedData = await fileStorage.readJSON('last-data.json');

      if (persistedData && persistedData.data) {
        this.latestData = persistedData.data;
        this.lastUpdate = new Date(persistedData.timestamp);

        // isDeviceOnline() will determine if data is fresh enough
        const online = this.isDeviceOnline();
        logger.info(`Loaded persisted data from file - device is ${online ? 'ONLINE' : 'OFFLINE'}`);
      }
    } catch (error) {
      logger.warn('Could not load persisted data:', error.message);
    }
  }

  /**
   * Get device status summary
   */
  getDeviceStatus() {
    return {
      online: this.isDeviceOnline(),
      lastUpdate: this.lastUpdate,
      hasData: this.latestData !== null,
      gsmSignal: this.latestData ? this.latestData.d38 : null,
      consecutiveFailures: this.consecutiveFailures,
      maxConsecutiveFailures: this.maxConsecutiveFailures,
      lastError: this.lastError,
      canControlRelays: this.canControlRelays()
    };
  }
}

module.exports = new CacheService();
