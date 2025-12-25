const awsService = require('./aws.service');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');

class RelayService {
  constructor() {
    this.pendingCommands = new Map();
    // Store user's desired relay states for verification
    // Format: { relayId: { state: 0|1, timestamp: Date, retries: number } }
    this.desiredStates = new Map();
    this.maxRetries = 3;
    this.retryDelayMs = 5000; // 5 seconds between retries
  }

  /**
   * Control a relay - sends command to AWS
   * The actual state change will be confirmed via websocket data
   */
  async controlRelay(relayId, state, isRetry = false) {
    try {
      // Check if device is online before attempting control
      if (!cacheService.canControlRelays()) {
        const error = new Error('Device is offline. Cannot control relay.');
        error.code = 'DEVICE_OFFLINE';
        throw error;
      }

      // Validate relay ID
      if (!relayId.match(/^i([1-9]|10)$/)) {
        throw new Error('Invalid relay ID');
      }

      // Validate state
      const numericState = parseInt(state);
      if (![0, 1].includes(numericState)) {
        throw new Error('Invalid state (must be 0 or 1)');
      }

      logger.info(`Controlling relay ${relayId} -> ${numericState === 1 ? 'ON' : 'OFF'}${isRetry ? ' (retry)' : ''}`);

      // Store user's desired state for verification
      const existing = this.desiredStates.get(relayId);
      this.desiredStates.set(relayId, {
        state: numericState,
        timestamp: Date.now(),
        retries: isRetry ? (existing?.retries || 0) + 1 : 0
      });

      // Send command to AWS
      const commandData = {
        [relayId]: numericState
      };

      await awsService.sendCommand(commandData);

      // State change will be verified when next websocket data arrives
      // via verifyRelayStates() method

      return {
        success: true,
        relay: relayId,
        state: numericState
      };
    } catch (error) {
      logger.error(`Error controlling relay ${relayId}:`, error);
      throw error;
    }
  }

  /**
   * Verify relay states against user's desired states
   * Called when new websocket data arrives
   * @param {Object} currentStates - Current relay states from websocket data
   */
  async verifyRelayStates(currentStates) {
    if (!currentStates) return;

    const now = Date.now();
    const staleThresholdMs = 60000; // Consider desired state stale after 60 seconds

    for (const [relayId, desired] of this.desiredStates.entries()) {
      const currentState = currentStates[relayId];

      // Skip if desired state is stale (user hasn't tried in a while)
      if (now - desired.timestamp > staleThresholdMs) {
        this.desiredStates.delete(relayId);
        continue;
      }

      // Check if current state matches desired state
      if (currentState === desired.state) {
        // Match! Clear the desired state
        logger.info(`Relay ${relayId} confirmed: state is ${currentState}`);
        this.desiredStates.delete(relayId);

        // Emit confirmation to frontend
        if (global.io) {
          global.io.emit('relayConfirmed', { relay: relayId, state: currentState });
        }
      } else if (desired.retries < this.maxRetries) {
        // Mismatch - need to retry
        logger.warn(`Relay ${relayId} mismatch: wanted ${desired.state}, got ${currentState}. Retrying... (attempt ${desired.retries + 1}/${this.maxRetries})`);

        // Delay before retry to avoid overwhelming the device
        setTimeout(async () => {
          try {
            await this.controlRelay(relayId, desired.state, true);
          } catch (err) {
            logger.error(`Retry failed for ${relayId}:`, err.message);
          }
        }, this.retryDelayMs);
      } else {
        // Max retries reached - give up and notify
        logger.error(`Relay ${relayId} failed to change to ${desired.state} after ${this.maxRetries} retries`);
        this.desiredStates.delete(relayId);

        // Emit failure to frontend
        if (global.io) {
          global.io.emit('relayFailed', {
            relay: relayId,
            desiredState: desired.state,
            actualState: currentState,
            message: `Failed to set relay after ${this.maxRetries} attempts`
          });
        }
      }
    }
  }

  /**
   * Get pending desired states (for debugging/status)
   */
  getPendingStates() {
    const pending = {};
    for (const [relayId, desired] of this.desiredStates.entries()) {
      pending[relayId] = desired;
    }
    return pending;
  }

  /**
   * Clear a desired state (e.g., user cancelled)
   */
  clearDesiredState(relayId) {
    this.desiredStates.delete(relayId);
  }

  /**
   * Get all relay states from cache (websocket data)
   * This is the source of truth
   */
  getAllRelayStates() {
    const states = cacheService.getRelayStates();
    return states || {
      i1: 0, i2: 0, i3: 0, i4: 0, i5: 0,
      i6: 0, i7: 0, i8: 0, i9: 0, i10: 0
    };
  }

  /**
   * Execute multiple relay commands at once
   */
  async executeMultipleCommands(commands) {
    try {
      // Check if device is online before attempting control
      if (!cacheService.canControlRelays()) {
        const error = new Error('Device is offline. Cannot control relays.');
        error.code = 'DEVICE_OFFLINE';
        throw error;
      }

      const commandData = {};

      for (const cmd of commands) {
        commandData[cmd.relay] = cmd.state;
      }

      logger.info('Executing multiple relay commands:', commandData);

      await awsService.sendCommand(commandData);

      // Note: We do NOT persist states here
      // The websocket data from AWS is the source of truth

      return { success: true, commands: commandData };
    } catch (error) {
      logger.error('Error executing multiple commands:', error);
      throw error;
    }
  }
}

module.exports = new RelayService();
