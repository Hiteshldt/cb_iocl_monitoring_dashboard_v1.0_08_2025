const logger = require('../utils/logger');
const fileStorage = require('../utils/fileStorage');

class CacheService {
  constructor() {
    this.latestData = null;
    this.lastUpdate = null;
    this.isOnline = false;
  }

  /**
   * Update cached data
   */
  updateLatestData(data) {
    this.latestData = data;
    this.lastUpdate = new Date();
    this.isOnline = true;

    // Persist to file
    fileStorage.writeJSON('last-data.json', {
      data: data,
      timestamp: this.lastUpdate.toISOString()
    }).catch(err => logger.error('Failed to persist data:', err));

    logger.debug('Cache updated with latest data');
  }

  /**
   * Get cached data
   */
  getLatestData() {
    return this.latestData;
  }

  /**
   * Get last update timestamp
   */
  getLastUpdate() {
    return this.lastUpdate;
  }

  /**
   * Check if device is online (data received in last 2 minutes)
   */
  isDeviceOnline() {
    if (!this.lastUpdate) return false;

    const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
    const isRecent = this.lastUpdate.getTime() > twoMinutesAgo;

    this.isOnline = isRecent;
    return isRecent;
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
        logger.info('Loaded persisted data from file');
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
      gsmSignal: this.latestData ? this.latestData.d38 : null
    };
  }
}

module.exports = new CacheService();
