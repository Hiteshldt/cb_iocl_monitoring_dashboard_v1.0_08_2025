const axios = require('axios');
const { AWS_API_BASE_URL, ACTUAL_DEVICE_ID, DEVICE_IMEI, DEVICE_METER } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * AWS REST API Service
 *
 * NOTE: For real-time device data, use aws-websocket.service.js instead.
 * This service is for:
 * - Sending commands to the device (relay control, display updates)
 * - Fetching historical data for graphs/reports
 */
class AWSService {
  constructor() {
    this.baseURL = AWS_API_BASE_URL;
    this.deviceId = ACTUAL_DEVICE_ID;
  }

  /**
   * Send command to device (relay control or display update)
   */
  async sendCommand(commandData) {
    try {
      const url = `${this.baseURL}/${this.deviceId}/command`;

      const payload = {
        imei: DEVICE_IMEI,
        meter: DEVICE_METER,
        ...commandData
      };

      logger.debug('Sending command:', payload);

      const response = await axios.post(url, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('Command sent successfully:', commandData);
      return response.data;
    } catch (error) {
      logger.error('Error sending command:', error.message);
      throw error;
    }
  }

  /**
   * Fetch hourly graph data (for charts, NOT for live data)
   */
  async getHourlyGraphData() {
    try {
      const url = `${this.baseURL}/${this.deviceId}/graph/hour`;
      logger.debug('Fetching hourly graph data from:', url);

      const response = await axios.get(url, { timeout: 15000 });
      return response.data;
    } catch (error) {
      logger.error('Error fetching hourly graph data:', error.message);
      throw error;
    }
  }

  /**
   * Fetch daily graph data (for charts)
   */
  async getDailyGraphData() {
    try {
      const url = `${this.baseURL}/${this.deviceId}/graph/day`;
      const response = await axios.get(url, { timeout: 15000 });
      return response.data;
    } catch (error) {
      logger.error('Error fetching daily graph data:', error.message);
      throw error;
    }
  }

  /**
   * Fetch weekly graph data (for charts)
   */
  async getWeeklyGraphData() {
    try {
      const url = `${this.baseURL}/${this.deviceId}/graph/week`;
      const response = await axios.get(url, { timeout: 15000 });
      return response.data;
    } catch (error) {
      logger.error('Error fetching weekly graph data:', error.message);
      throw error;
    }
  }

  /**
   * Request report generation (CSV download)
   * AWS API prepares the report and returns a download link
   */
  async requestReport(startDate, endDate) {
    try {
      const url = `${this.baseURL}/${this.deviceId}/report?startDate=${startDate}&endDate=${endDate}`;
      logger.info(`Requesting report: ${url}`);

      const response = await axios.get(url, { timeout: 30000 }); // Longer timeout for report generation

      logger.info('Report request successful');
      return response.data;
    } catch (error) {
      logger.error('Error requesting report:', error.message);
      throw error;
    }
  }
}

module.exports = new AWSService();
