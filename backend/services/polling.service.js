const awsService = require('./aws.service');
const cacheService = require('./cache.service');
const calculationsService = require('./calculations.service');
const relayService = require('./relay.service');
const logger = require('../utils/logger');
const { DATA_POLL_INTERVAL } = require('../config/constants');

class PollingService {
  constructor() {
    this.pollingInterval = null;
    this.isRunning = false;
    this.wasOffline = true; // Track if device was offline (starts as offline)
    this.isRestoringRelays = false; // Prevent multiple restore attempts
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
        // Check if device just came back online (was offline before)
        const justReconnected = this.wasOffline;
        this.wasOffline = false; // Device is now online

        // Process data with calculations (AQI, CO2, O2)
        const processedData = calculationsService.processData(latestData);

        // Update cache with both raw and processed data
        // This also marks device as online via cacheService.markOnline()
        cacheService.updateLatestData(latestData);
        cacheService.updateProcessedData(processedData);

        // Emit data update to connected clients
        if (global.io) {
          global.io.emit('deviceUpdate', processedData);
          // Also emit updated device status (now online)
          global.io.emit('deviceStatus', cacheService.getDeviceStatus());
        }

        // If device just reconnected, restore relay states
        if (justReconnected && !this.isRestoringRelays) {
          this.restoreRelayStates(latestData);
        }

        logger.debug('Data poll successful');
      } else {
        // No new data received from AWS - this is NOT necessarily an error
        // The API responded successfully but returned no data points
        // Don't treat this as a failure - just log it
        logger.debug('No new data available from AWS (API responded but no data points)');

        // Still emit current status to clients (maintains current state)
        if (global.io) {
          global.io.emit('deviceStatus', cacheService.getDeviceStatus());
        }
      }
    } catch (error) {
      // Record failure in cache service (handles consecutive failure tracking)
      // Only REAL errors (network, timeout, API errors) count as failures
      cacheService.recordFailure(error);

      // If device goes offline, mark it for relay restoration on reconnect
      if (!cacheService.isDeviceOnline()) {
        this.wasOffline = true;
      }

      logger.error(`Data poll failed:`, error.message);

      // Emit updated status to clients (may now be offline)
      if (global.io) {
        global.io.emit('deviceStatus', cacheService.getDeviceStatus());
      }
    }
  }

  /**
   * Restore relay states when device reconnects
   * Compares persisted states with device's current states and sends commands to restore
   */
  async restoreRelayStates(deviceData) {
    this.isRestoringRelays = true;

    try {
      logger.info('Device reconnected - checking relay states for restoration...');

      // Get our persisted relay states (what we want)
      const persistedStates = await relayService.getAllRelayStates();

      // Get current device relay states (what the device has)
      const deviceStates = {
        i1: deviceData.i1 || 0,
        i2: deviceData.i2 || 0,
        i3: deviceData.i3 || 0,
        i4: deviceData.i4 || 0,
        i5: deviceData.i5 || 0,
        i6: deviceData.i6 || 0,
        i7: deviceData.i7 || 0,
        i8: deviceData.i8 || 0,
        i9: deviceData.i9 || 0,
        i10: deviceData.i10 || 0
      };

      // Find relays that need to be restored
      const commandsToSend = [];

      for (let i = 1; i <= 10; i++) {
        const relayId = `i${i}`;
        const persistedState = persistedStates[relayId];
        const deviceState = deviceStates[relayId];

        // Only restore if persisted state exists and differs from device state
        if (persistedState !== undefined && persistedState !== deviceState) {
          commandsToSend.push({
            relay: relayId,
            state: persistedState
          });
          logger.info(`Relay ${relayId} mismatch: device=${deviceState}, persisted=${persistedState} - will restore`);
        }
      }

      // Send restoration commands if needed
      if (commandsToSend.length > 0) {
        logger.info(`Restoring ${commandsToSend.length} relay(s) to persisted state...`);

        // Send commands one by one with a small delay to avoid overwhelming the device
        for (const cmd of commandsToSend) {
          try {
            await relayService.controlRelay(cmd.relay, cmd.state);
            logger.info(`Restored ${cmd.relay} to state ${cmd.state}`);

            // Small delay between commands
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            logger.error(`Failed to restore ${cmd.relay}:`, err.message);
          }
        }

        logger.info('Relay state restoration complete');
      } else {
        logger.info('All relay states match - no restoration needed');
      }
    } catch (error) {
      logger.error('Error during relay state restoration:', error.message);
    } finally {
      this.isRestoringRelays = false;
    }
  }

  /**
   * Get polling status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: DATA_POLL_INTERVAL,
      deviceStatus: cacheService.getDeviceStatus()
    };
  }
}

module.exports = new PollingService();
