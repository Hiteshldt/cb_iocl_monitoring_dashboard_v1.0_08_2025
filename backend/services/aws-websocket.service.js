const WebSocket = require('ws');
const cacheService = require('./cache.service');
const calculationsService = require('./calculations.service');
const relayService = require('./relay.service');
const dataTransformer = require('./data-transformer.service');
const logger = require('../utils/logger');
const { ACTUAL_DEVICE_ID, AWS_WEBSOCKET_URL } = require('../config/constants');

class AWSWebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelayMs = 5000;
    this.heartbeatInterval = null;
    this.deviceId = ACTUAL_DEVICE_ID;
  }

  /**
   * Start the WebSocket connection
   */
  start() {
    logger.info('Starting AWS WebSocket service...');
    this.connect();
  }

  /**
   * Connect to AWS WebSocket
   */
  connect() {
    try {
      logger.info(`Connecting to AWS WebSocket: ${AWS_WEBSOCKET_URL}`);

      this.ws = new WebSocket(AWS_WEBSOCKET_URL);

      this.ws.on('open', () => {
        logger.info('AWS WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Subscribe to device data
        this.subscribe();

        // Start heartbeat to keep connection alive
        this.startHeartbeat();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        logger.error('AWS WebSocket error:', error.message);
      });

      this.ws.on('close', (code, reason) => {
        logger.warn(`AWS WebSocket closed: ${code} - ${reason || 'No reason'}`);
        this.isConnected = false;
        this.stopHeartbeat();

        // Mark device as potentially offline after connection loss
        // (will be marked online again when data is received)

        // Attempt to reconnect
        this.scheduleReconnect();
      });

    } catch (error) {
      logger.error('Failed to create WebSocket connection:', error.message);
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to device data
   */
  subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot subscribe - WebSocket not open');
      return;
    }

    const subscribeMessage = {
      action: 'subscribe',
      deviceId: this.deviceId
    };

    logger.info(`Subscribing to device: ${this.deviceId}`);
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData.toString());

      // Check if it's device data
      if (message.type === 'deviceData' && message.data) {
        logger.debug('Received device data via WebSocket');
        await this.processDeviceData(message.data);
      } else if (message.type === 'error') {
        logger.error('AWS WebSocket error message:', message.message);
      } else {
        logger.debug('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      logger.error('Error parsing WebSocket message:', error.message);
    }
  }

  /**
   * Process incoming device data
   */
  async processDeviceData(data) {
    try {
      // Wait for calculations service to be initialized
      await calculationsService.waitForInit();

      // =====================================================================
      // STEP 1: Store raw data BEFORE transformation (for calibration)
      // This preserves original sensor values (0-4095 range) for pH calibration
      // =====================================================================
      cacheService.updateRawData({ ...data });

      // =====================================================================
      // STEP 2: Transform raw sensor data BEFORE any calculations
      // This applies all configured transformations (offset, scale, etc.)
      // =====================================================================
      const transformedData = dataTransformer.transformSensorData(data);

      // Process transformed data with calculations (AQI, CO2, O2)
      const processedData = calculationsService.processData(transformedData);

      // Update cache with transformed data (not raw)
      // This ensures automation rules also use transformed values
      cacheService.updateLatestData(transformedData);
      cacheService.updateProcessedData(processedData);

      // Verify relay states against user's desired states
      // This will auto-retry if there's a mismatch
      const currentRelayStates = cacheService.getRelayStates();
      if (currentRelayStates) {
        await relayService.verifyRelayStates(currentRelayStates);
      }

      // Add server timestamp to processed data for accurate "last update" tracking
      // This is the exact time the device data was received from AWS WebSocket
      const dataWithTimestamp = {
        ...processedData,
        serverTimestamp: new Date().toISOString()
      };

      // Emit data update to connected clients
      if (global.io) {
        global.io.emit('deviceUpdate', dataWithTimestamp);
        global.io.emit('deviceStatus', cacheService.getDeviceStatus());
      }

      logger.debug('Device data processed successfully');
    } catch (error) {
      logger.error('Error processing device data:', error.message);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat();

    // Send ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          // AWS API Gateway WebSocket expects a specific ping format
          // or we can just re-subscribe to keep connection active
          this.ws.ping();
        } catch (error) {
          logger.warn('Heartbeat ping failed:', error.message);
        }
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);

      // Mark device as offline
      cacheService.recordFailure(new Error('WebSocket connection lost'));

      // Emit offline status
      if (global.io) {
        global.io.emit('deviceStatus', cacheService.getDeviceStatus());
      }

      // Reset attempts after a longer delay to try again later
      setTimeout(() => {
        this.reconnectAttempts = 0;
        this.connect();
      }, 60000); // Try again after 1 minute

      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelayMs * Math.min(this.reconnectAttempts, 5);

    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Stop the WebSocket service
   */
  stop() {
    logger.info('Stopping AWS WebSocket service...');

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      deviceId: this.deviceId,
      deviceStatus: cacheService.getDeviceStatus()
    };
  }
}

module.exports = new AWSWebSocketService();
