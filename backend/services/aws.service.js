const axios = require('axios');
const { AWS_API_BASE_URL, ACTUAL_DEVICE_ID, DEVICE_IMEI, DEVICE_METER } = require('../config/constants');
const logger = require('../utils/logger');

class AWSService {
  constructor() {
    this.baseURL = AWS_API_BASE_URL;
    this.deviceId = ACTUAL_DEVICE_ID;
  }

  /**
   * Fetch hourly data
   */
  async getHourlyData() {
    try {
      const url = `${this.baseURL}/${this.deviceId}/graph/hour`;
      logger.debug('Fetching hourly data from:', url);

      const response = await axios.get(url, { timeout: 10000 });
      return response.data;
    } catch (error) {
      logger.error('Error fetching hourly data:', error.message);
      throw error;
    }
  }

  /**
   * Fetch daily data
   */
  async getDailyData() {
    try {
      const url = `${this.baseURL}/${this.deviceId}/graph/day`;
      const response = await axios.get(url, { timeout: 10000 });
      return response.data;
    } catch (error) {
      logger.error('Error fetching daily data:', error.message);
      throw error;
    }
  }

  /**
   * Fetch weekly data
   */
  async getWeeklyData() {
    try {
      const url = `${this.baseURL}/${this.deviceId}/graph/week`;
      const response = await axios.get(url, { timeout: 10000 });
      return response.data;
    } catch (error) {
      logger.error('Error fetching weekly data:', error.message);
      throw error;
    }
  }

  /**
   * Generate report (CSV download)
   */
  async generateReport(startDate, endDate) {
    try {
      const url = `${this.baseURL}/${this.deviceId}/report?startDate=${startDate}&endDate=${endDate}`;
      const response = await axios.get(url, { timeout: 15000 });
      return response.data;
    } catch (error) {
      logger.error('Error generating report:', error.message);
      throw error;
    }
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
   * Get latest data point from hourly data
   */
  async getLatestData() {
    try {
      const hourlyData = await this.getHourlyData();

      if (hourlyData && hourlyData.data && hourlyData.data.length > 0) {
        // Get the most recent data point
        const latestData = hourlyData.data[hourlyData.data.length - 1];
        return latestData;
      }

      return null;
    } catch (error) {
      logger.error('Error getting latest data:', error.message);
      throw error;
    }
  }
}

module.exports = new AWSService();
