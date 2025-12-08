const cacheService = require('./cache.service');
const relayService = require('./relay.service');
const fileStorage = require('../utils/fileStorage');
const logger = require('../utils/logger');

class AutomationService {
  constructor() {
    this.rules = [];
    this.evaluationInterval = null;
    this.isRunning = false;
    this.lastEvaluation = {};
  }

  /**
   * Load automation rules from file
   */
  async loadRules() {
    try {
      const data = await fileStorage.readJSON('automation-rules.json');
      this.rules = data?.rules || [];
      logger.info(`Loaded ${this.rules.length} automation rules`);
      return this.rules;
    } catch (error) {
      logger.error('Error loading automation rules:', error);
      this.rules = [];
      return [];
    }
  }

  /**
   * Save automation rules to file
   */
  async saveRules() {
    try {
      await fileStorage.writeJSON('automation-rules.json', { rules: this.rules });
      logger.debug('Automation rules saved');
    } catch (error) {
      logger.error('Error saving automation rules:', error);
    }
  }

  /**
   * Add or update automation rule
   */
  async addOrUpdateRule(rule) {
    try {
      // Validate rule
      this.validateRule(rule);

      // Check if rule exists
      const existingIndex = this.rules.findIndex(r => r.id === rule.id);

      if (existingIndex >= 0) {
        // Update existing rule
        this.rules[existingIndex] = { ...rule, updatedAt: new Date().toISOString() };
        logger.info(`Updated automation rule: ${rule.id}`);
      } else {
        // Add new rule
        rule.id = rule.id || `rule_${Date.now()}`;
        rule.createdAt = new Date().toISOString();
        this.rules.push(rule);
        logger.info(`Added new automation rule: ${rule.id}`);
      }

      await this.saveRules();
      return rule;
    } catch (error) {
      logger.error('Error adding/updating rule:', error);
      throw error;
    }
  }

  /**
   * Delete automation rule
   */
  async deleteRule(ruleId) {
    try {
      const initialLength = this.rules.length;
      this.rules = this.rules.filter(r => r.id !== ruleId);

      if (this.rules.length < initialLength) {
        await this.saveRules();
        logger.info(`Deleted automation rule: ${ruleId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting rule:', error);
      throw error;
    }
  }

  /**
   * Get all automation rules
   */
  async getRules() {
    return this.rules;
  }

  /**
   * Validate automation rule
   */
  validateRule(rule) {
    if (!rule.relay || !rule.relay.match(/^i([1-9]|10)$/)) {
      throw new Error('Invalid relay ID');
    }

    if (!['manual', 'sensor', 'time'].includes(rule.mode)) {
      throw new Error('Invalid mode');
    }

    if (rule.mode === 'sensor') {
      if (!rule.sensor) throw new Error('Sensor required for sensor mode');
      if (!rule.operator || !['<', '>'].includes(rule.operator)) {
        throw new Error('Invalid operator');
      }
      if (rule.threshold === undefined || rule.threshold === null) {
        throw new Error('Threshold required');
      }
    }

    if (rule.mode === 'time') {
      if (!rule.startTime || !rule.endTime) {
        throw new Error('Start and end time required for time mode');
      }
    }

    return true;
  }

  /**
   * Start automation engine
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Automation engine already running');
      return;
    }

    logger.info('Starting automation engine');

    // Load rules
    await this.loadRules();

    // Evaluate immediately
    await this.evaluateAllRules();

    // Then evaluate every 10 seconds
    this.evaluationInterval = setInterval(() => {
      this.evaluateAllRules();
    }, 10000);

    this.isRunning = true;
  }

  /**
   * Stop automation engine
   */
  stop() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      this.isRunning = false;
      logger.info('Automation engine stopped');
    }
  }

  /**
   * Evaluate all automation rules
   */
  async evaluateAllRules() {
    try {
      const currentData = cacheService.getLatestData();

      if (!currentData) {
        logger.debug('No data available for rule evaluation');
        return;
      }

      for (const rule of this.rules) {
        if (!rule.enabled) continue;

        // Skip manual mode
        if (rule.mode === 'manual') continue;

        // Evaluate sensor-based rules
        if (rule.mode === 'sensor') {
          await this.evaluateSensorRule(rule, currentData);
        }

        // Evaluate time-based rules
        if (rule.mode === 'time') {
          await this.evaluateTimeRule(rule);
        }
      }
    } catch (error) {
      logger.error('Error evaluating automation rules:', error);
    }
  }

  /**
   * Evaluate sensor-based rule
   */
  async evaluateSensorRule(rule, currentData) {
    try {
      const sensorValue = currentData[rule.sensor];

      if (sensorValue === undefined || sensorValue === null) {
        logger.warn(`Sensor ${rule.sensor} not found in data`);
        return;
      }

      let shouldActivate = false;

      // Evaluate condition
      if (rule.operator === '<') {
        shouldActivate = sensorValue < rule.threshold;
      } else if (rule.operator === '>') {
        shouldActivate = sensorValue > rule.threshold;
      }

      const targetState = shouldActivate ? 1 : 0;

      // Check if state needs to change
      const currentRelayStates = await relayService.getAllRelayStates();
      const currentState = currentRelayStates[rule.relay];

      if (currentState !== targetState) {
        logger.info(
          `Automation triggered: ${rule.relay} -> ${targetState === 1 ? 'ON' : 'OFF'} ` +
          `(${rule.sensor} ${rule.operator} ${rule.threshold}, value: ${sensorValue})`
        );

        await relayService.controlRelay(rule.relay, targetState);

        // Emit event
        if (global.io) {
          global.io.emit('automationTriggered', {
            ruleId: rule.id,
            relay: rule.relay,
            state: targetState,
            reason: `${rule.sensor} (${sensorValue}) ${rule.operator} ${rule.threshold}`
          });
        }
      }
    } catch (error) {
      logger.error(`Error evaluating sensor rule ${rule.id}:`, error);
    }
  }

  /**
   * Evaluate time-based rule
   */
  async evaluateTimeRule(rule) {
    try {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Parse start and end times
      const [startHour, startMin] = rule.startTime.split(':').map(Number);
      const [endHour, endMin] = rule.endTime.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let shouldBeOn = false;

      if (startMinutes <= endMinutes) {
        // Normal case: start time is before end time
        shouldBeOn = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Crosses midnight
        shouldBeOn = currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      const targetState = shouldBeOn ? 1 : 0;

      // Check if state needs to change
      const currentRelayStates = await relayService.getAllRelayStates();
      const currentState = currentRelayStates[rule.relay];

      // Prevent duplicate executions
      const evalKey = `${rule.id}_${currentTime}`;
      if (this.lastEvaluation[evalKey] === targetState) {
        return; // Already executed this minute
      }

      if (currentState !== targetState) {
        logger.info(
          `Time automation triggered: ${rule.relay} -> ${targetState === 1 ? 'ON' : 'OFF'} ` +
          `(schedule: ${rule.startTime}-${rule.endTime}, current: ${currentTime})`
        );

        await relayService.controlRelay(rule.relay, targetState);

        this.lastEvaluation[evalKey] = targetState;

        // Emit event
        if (global.io) {
          global.io.emit('automationTriggered', {
            ruleId: rule.id,
            relay: rule.relay,
            state: targetState,
            reason: `Time schedule: ${rule.startTime}-${rule.endTime}`
          });
        }
      }
    } catch (error) {
      logger.error(`Error evaluating time rule ${rule.id}:`, error);
    }
  }

  /**
   * Get automation engine status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      rulesCount: this.rules.length,
      activeRulesCount: this.rules.filter(r => r.enabled).length
    };
  }
}

module.exports = new AutomationService();
