/**
 * Calibration Service
 *
 * Handles pH sensor calibration with 2-point or 3-point calibration.
 * Stores calibration data persistently and applies calibration formula
 * to raw sensor values.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const cacheService = require('./cache.service');

// Calibration password - required to perform calibration
const CALIBRATION_PASSWORD = 'iocl4545';

// Path to calibration data file
const CALIBRATION_FILE = path.join(__dirname, '../data/calibration.json');

// Default calibration based on initial readings
// pH 4 = raw 1588, pH 7 = raw 2353
const DEFAULT_CALIBRATION = {
  ph: {
    type: '2-point',
    points: [
      { ph: 4.0, raw: 1588, timestamp: new Date().toISOString() },
      { ph: 7.0, raw: 2353, timestamp: new Date().toISOString() }
    ],
    coefficients: {
      slope: 0.003922,  // (7-4)/(2353-1588)
      offset: -2.2275   // 4 - (0.003922 * 1588)
    },
    calibratedAt: new Date().toISOString(),
    isDefault: true
  }
};

class CalibrationService {
  constructor() {
    this.calibration = null;
    this.loadCalibration();
  }

  /**
   * Load calibration data from file
   */
  loadCalibration() {
    try {
      if (fs.existsSync(CALIBRATION_FILE)) {
        const data = fs.readFileSync(CALIBRATION_FILE, 'utf8');
        this.calibration = JSON.parse(data);
        logger.info('Calibration data loaded from file');
      } else {
        // Create default calibration file
        this.calibration = { ...DEFAULT_CALIBRATION };
        this.saveCalibration();
        logger.info('Created default calibration file');
      }
    } catch (error) {
      logger.error('Error loading calibration:', error);
      this.calibration = { ...DEFAULT_CALIBRATION };
    }
  }

  /**
   * Save calibration data to file
   */
  saveCalibration() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(CALIBRATION_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(CALIBRATION_FILE, JSON.stringify(this.calibration, null, 2));
      logger.info('Calibration data saved to file');
      return true;
    } catch (error) {
      logger.error('Error saving calibration:', error);
      return false;
    }
  }

  /**
   * Verify calibration password
   * @param {string} password - The password to verify
   * @returns {boolean} - True if password is correct
   */
  verifyPassword(password) {
    return password === CALIBRATION_PASSWORD;
  }

  /**
   * Get current calibration status
   * @returns {Object} - Current calibration info
   */
  getCalibrationStatus() {
    const phCal = this.calibration?.ph || DEFAULT_CALIBRATION.ph;

    return {
      ph: {
        type: phCal.type,
        points: phCal.points,
        coefficients: phCal.coefficients,
        calibratedAt: phCal.calibratedAt,
        isDefault: phCal.isDefault || false,
        formula: `pH = (raw × ${phCal.coefficients.slope.toFixed(5)}) + (${phCal.coefficients.offset.toFixed(3)})`
      }
    };
  }

  /**
   * Get raw pH sensor value from cache
   * Returns the raw d5 value before any transformation (0-4095 range)
   * @returns {Object} - Raw value and stability info
   */
  getRawPhValue() {
    // Get RAW data (before transformation) - this is the original sensor value
    const rawData = cacheService.getRawData();

    if (!rawData) {
      return {
        success: false,
        message: 'No sensor data available',
        raw: null
      };
    }

    // d5 is the pH sensor - get the RAW value before transformation
    // This should be in the 0-4095 range from the ADC
    const rawValue = rawData.d5;

    return {
      success: true,
      raw: rawValue,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate calibration coefficients from points
   * For 2-point: linear interpolation
   * For 3-point: linear regression (best fit line)
   * @param {Array} points - Array of { ph, raw } objects
   * @returns {Object} - { slope, offset }
   */
  calculateCoefficients(points) {
    if (!points || points.length < 2) {
      throw new Error('At least 2 calibration points required');
    }

    if (points.length === 2) {
      // 2-point linear calibration
      const [p1, p2] = points;
      const slope = (p2.ph - p1.ph) / (p2.raw - p1.raw);
      const offset = p1.ph - (slope * p1.raw);

      return { slope, offset };
    } else {
      // 3+ point: linear regression (least squares)
      const n = points.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

      for (const point of points) {
        sumX += point.raw;
        sumY += point.ph;
        sumXY += point.raw * point.ph;
        sumX2 += point.raw * point.raw;
      }

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const offset = (sumY - slope * sumX) / n;

      return { slope, offset };
    }
  }

  /**
   * Validate calibration points
   * @param {Array} points - Array of { ph, raw } objects
   * @returns {Object} - { valid, error }
   */
  validatePoints(points) {
    if (!points || !Array.isArray(points)) {
      return { valid: false, error: 'Points must be an array' };
    }

    if (points.length < 2) {
      return { valid: false, error: 'At least 2 calibration points required' };
    }

    // Check each point
    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      if (typeof point.ph !== 'number' || point.ph < 0 || point.ph > 14) {
        return { valid: false, error: `Point ${i + 1}: pH must be between 0 and 14` };
      }

      if (typeof point.raw !== 'number' || point.raw < 0) {
        return { valid: false, error: `Point ${i + 1}: Raw value must be a positive number` };
      }
    }

    // Check raw values are sufficiently different
    const rawValues = points.map(p => p.raw);
    const minRaw = Math.min(...rawValues);
    const maxRaw = Math.max(...rawValues);

    if (maxRaw - minRaw < 100) {
      return {
        valid: false,
        error: 'Raw values must differ by at least 100 between points for accurate calibration'
      };
    }

    // Check that slope will be positive (higher raw = higher pH typically)
    const sortedByRaw = [...points].sort((a, b) => a.raw - b.raw);
    const expectedPositiveSlope = sortedByRaw[sortedByRaw.length - 1].ph > sortedByRaw[0].ph;

    if (!expectedPositiveSlope) {
      // Warn but don't fail - some sensors might be inverse
      logger.warn('Calibration: negative slope detected (higher raw = lower pH)');
    }

    return { valid: true };
  }

  /**
   * Save new calibration
   * @param {string} type - '2-point' or '3-point'
   * @param {Array} points - Array of { ph, raw } objects
   * @returns {Object} - Result with success status
   */
  saveNewCalibration(type, points) {
    // Validate points
    const validation = this.validatePoints(points);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    try {
      // Calculate coefficients
      const coefficients = this.calculateCoefficients(points);

      // Add timestamps to points
      const pointsWithTimestamp = points.map(p => ({
        ...p,
        timestamp: new Date().toISOString()
      }));

      // Update calibration
      this.calibration.ph = {
        type,
        points: pointsWithTimestamp,
        coefficients,
        calibratedAt: new Date().toISOString(),
        isDefault: false
      };

      // Save to file
      if (!this.saveCalibration()) {
        return {
          success: false,
          error: 'Failed to save calibration to file'
        };
      }

      logger.info(`pH calibration updated: ${type}, slope=${coefficients.slope.toFixed(5)}, offset=${coefficients.offset.toFixed(3)}`);

      return {
        success: true,
        calibration: this.getCalibrationStatus()
      };
    } catch (error) {
      logger.error('Error saving calibration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reset calibration to default
   * @returns {Object} - Result with success status
   */
  resetToDefault() {
    try {
      this.calibration = JSON.parse(JSON.stringify(DEFAULT_CALIBRATION));
      this.saveCalibration();

      logger.info('pH calibration reset to default');

      return {
        success: true,
        calibration: this.getCalibrationStatus()
      };
    } catch (error) {
      logger.error('Error resetting calibration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Apply calibration to raw pH value
   * This is the main function used by data-transformer
   * @param {number} rawValue - Raw sensor value
   * @returns {number} - Calibrated pH value
   */
  applyCalibration(rawValue) {
    if (rawValue === 0 || rawValue === null || rawValue === undefined) {
      return 0; // Device off or no reading
    }

    const phCal = this.calibration?.ph || DEFAULT_CALIBRATION.ph;
    const { slope, offset } = phCal.coefficients;

    // Apply linear calibration: pH = (raw * slope) + offset
    let ph = (rawValue * slope) + offset;

    // Clamp to valid pH range (0-14)
    ph = Math.max(0, Math.min(14, ph));

    // Round to 1 decimal place
    return Math.round(ph * 10) / 10;
  }

  /**
   * Test calibration with a raw value
   * @param {number} rawValue - Raw value to test
   * @returns {Object} - Test result with calculated pH
   */
  testCalibration(rawValue) {
    const ph = this.applyCalibration(rawValue);
    const status = this.getCalibrationStatus();

    return {
      rawValue,
      calculatedPh: ph,
      formula: status.ph.formula,
      coefficients: status.ph.coefficients
    };
  }
}

module.exports = new CalibrationService();
