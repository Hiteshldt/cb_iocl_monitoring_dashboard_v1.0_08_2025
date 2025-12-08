const awsService = require('./aws.service');
const fileStorage = require('../utils/fileStorage');
const logger = require('../utils/logger');

class RelayService {
  constructor() {
    this.pendingCommands = new Map();
  }

  /**
   * Control a relay (manual mode)
   */
  async controlRelay(relayId, state) {
    try {
      // Validate relay ID
      if (!relayId.match(/^i([1-9]|10)$/)) {
        throw new Error('Invalid relay ID');
      }

      // Validate state
      const numericState = parseInt(state);
      if (![0, 1].includes(numericState)) {
        throw new Error('Invalid state (must be 0 or 1)');
      }

      logger.info(`Controlling relay ${relayId} -> ${numericState === 1 ? 'ON' : 'OFF'}`);

      // Send command to AWS
      const commandData = {
        [relayId]: numericState
      };

      await awsService.sendCommand(commandData);

      // Update persisted relay states
      await this.updateRelayState(relayId, numericState);

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
   * Update relay state in storage
   */
  async updateRelayState(relayId, state) {
    try {
      const currentStates = await fileStorage.readJSON('relay-states.json') || {};

      currentStates[relayId] = state;

      await fileStorage.writeJSON('relay-states.json', currentStates);

      logger.debug(`Relay state persisted: ${relayId} = ${state}`);
    } catch (error) {
      logger.error('Error updating relay state:', error);
    }
  }

  /**
   * Get all relay states
   */
  async getAllRelayStates() {
    try {
      const states = await fileStorage.readJSON('relay-states.json');
      return states || {
        i1: 0, i2: 0, i3: 0, i4: 0, i5: 0,
        i6: 0, i7: 0, i8: 0, i9: 0, i10: 0
      };
    } catch (error) {
      logger.error('Error getting relay states:', error);
      return {};
    }
  }

  /**
   * Execute multiple relay commands at once
   */
  async executeMultipleCommands(commands) {
    try {
      const commandData = {};

      for (const cmd of commands) {
        commandData[cmd.relay] = cmd.state;
      }

      logger.info('Executing multiple relay commands:', commandData);

      await awsService.sendCommand(commandData);

      // Update all states
      for (const cmd of commands) {
        await this.updateRelayState(cmd.relay, cmd.state);
      }

      return { success: true, commands: commandData };
    } catch (error) {
      logger.error('Error executing multiple commands:', error);
      throw error;
    }
  }
}

module.exports = new RelayService();
