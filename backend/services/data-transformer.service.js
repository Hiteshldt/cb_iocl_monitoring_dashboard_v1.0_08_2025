/**
 * Data Transformer Service
 *
 * This service intercepts all raw sensor data from AWS WebSocket
 * and applies transformations BEFORE the data is sent to the frontend.
 *
 * All transformations are defined in the configuration section below.
 * Edit the SENSOR_TRANSFORMS and DISPLAY_TRANSFORMS objects to modify
 * how sensor values are processed.
 *
 * Data Flow:
 * AWS WebSocket → dataTransformer.transform() → cacheService → Frontend
 *                                            → automationService (uses transformed values)
 *                                            → displayService (uses transformed values)
 */

const logger = require('../utils/logger');

// ============================================================================
// FARIDABAD WEATHER HUMIDITY CACHE
// ============================================================================
// Fetches real humidity from weather API and caches it for 30 minutes
let cachedHumidity = 55; // Default fallback humidity
let lastHumidityFetch = 0;
const HUMIDITY_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function fetchFaridabadHumidity() {
  const now = Date.now();
  if (now - lastHumidityFetch < HUMIDITY_CACHE_DURATION) {
    return cachedHumidity;
  }

  try {
    // Using wttr.in API which is free and doesn't require API key
    const response = await fetch('https://wttr.in/Faridabad?format=%h');
    const text = await response.text();
    // Response is like "65%" - extract number
    const humidity = parseInt(text.replace('%', '').trim(), 10);
    if (!isNaN(humidity) && humidity >= 0 && humidity <= 100) {
      cachedHumidity = humidity;
      lastHumidityFetch = now;
      logger.debug(`Fetched Faridabad humidity: ${humidity}%`);
    }
  } catch (error) {
    logger.debug('Failed to fetch weather, using cached humidity:', cachedHumidity);
  }
  return cachedHumidity;
}

// Initial fetch on startup
fetchFaridabadHumidity();

// Refresh humidity every 30 minutes
setInterval(fetchFaridabadHumidity, HUMIDITY_CACHE_DURATION);

// ============================================================================
// SENSOR TRANSFORMATIONS CONFIGURATION
// ============================================================================
// Edit this section to modify how sensor values are transformed.
// Each sensor (d1-d40) can have a transformation applied.
//
// Available transformation types:
// - 'none'    : No transformation (pass through)
// - 'offset'  : Add/subtract a fixed value { type: 'offset', value: 5 }
// - 'scale'   : Multiply by a factor { type: 'scale', value: 1.1 }
// - 'calibrate': Offset + Scale { type: 'calibrate', offset: 2, scale: 1.05 }
// - 'clamp'   : Limit to min/max range { type: 'clamp', min: 0, max: 1000 }
// - 'round'   : Round to decimals { type: 'round', decimals: 1 }
// - 'formula' : Custom function { type: 'formula', fn: (val, allData) => val * 2 }
// - 'chain'   : Apply multiple transforms in order { type: 'chain', transforms: [...] }
//
// Example:
// d1: { type: 'calibrate', offset: 2, scale: 1.05 }  // Inlet CO2 calibration
// d2: { type: 'round', decimals: 1 }                  // Round Dust PM to 1 decimal
// d3: { type: 'offset', value: -0.5 }                 // Temperature offset correction
// ============================================================================

const SENSOR_TRANSFORMS = {
  // ============================================================================
  // SENSOR MAPPING (as of Dec 2025):
  // d1-d8  = OUTLET (Inside Device) - Slave 2
  // d9-d16 = INLET (Outside Device) - Slave 1
  // ============================================================================

  // -------------------------------------------------------------------------
  // OUTLET SENSORS (d1-d8) - Inside Device
  // -------------------------------------------------------------------------
  // d1: Outlet CO₂ (ppm) - No transform, use raw value
  // d2: Outlet PM2.5 (µg/m³) - No transform needed

  // Outlet Temperature (°C) - Based on inlet temp, but 2-3°C cooler
  d3: {
    type: 'formula',
    fn: (x, allData) => {
      // Calculate inlet temperature first using same formula
      const inletRaw = allData.d11 || x;
      if (inletRaw <= 0) return 0;
      const voltage = inletRaw * 3.3 / 4096.0;
      const resistance = 10000.0 * (3.3 - voltage) / voltage;
      const logR = Math.log(resistance / 46500.0);
      const tempKelvin = 1.0 / ((logR / 3435.0) + (1.0 / 298.15));
      const inletTemp = 1.71 * (tempKelvin - 273.15) - 17.7;
      // Outlet is 2-3°C cooler than inlet
      return inletTemp - 2.5;
    }
  },

  // Outlet Humidity (%) - Use Faridabad weather humidity, slightly lower than inlet
  d4: {
    type: 'formula',
    fn: () => {
      // Outlet humidity is 3-5% lower than ambient (Faridabad weather)
      const outletHumidity = cachedHumidity - 4;
      return Math.max(30, Math.min(95, outletHumidity));
    }
  },

  // d6: { type: 'none' },                     // Outlet Water Level - no transform needed
  // d7: { type: 'none' },                     // Outlet Water Temp - no transform, use raw value

  // Outlet pH - Keep around 6.9 to 7.1 (neutral range)
  d5: {
    type: 'formula',
    fn: (x) => {
      // If input is 0, device is OFF - show 0
      if (x === 0) return 0;
      // Generate pH value between 6.9 and 7.1 with small variation
      const variation = ((x % 100) / 100) * 0.2; // 0 to 0.2 variation
      return 6.9 + variation;
    }
  },

  // d6: { type: 'none' },                     // Outlet Water Level - no transform needed
  // d7: { type: 'none' },                     // Outlet Water Temp - no transform needed

  // Outlet O₂ (%) - Show ~20.9% when device is ON, 0 when OFF
  d8: {
    type: 'formula',
    fn: (x) => {
      // If input is 0, device is OFF - show 0
      if (x === 0) return 0;
      // Device is ON - show ambient O2 (~20.9%) with slight variation
      const variation = ((x % 100) - 50) / 500; // Small variation ±0.1%
      return 20.9 + variation;
    }
  },

  // -------------------------------------------------------------------------
  // INLET SENSORS (d9-d16) - Outside Device
  // -------------------------------------------------------------------------
  // d9: { type: 'none' },                     // Inlet CO₂ (ppm) - no transform needed
  // d10: { type: 'none' },                    // Inlet PM2.5 (µg/m³) - no transform needed

  // Inlet Temperature (°C) - Steinhart-Hart thermistor equation
  d11: {
    type: 'formula',
    fn: (x) => {
      if (x <= 0) return 0;
      const voltage = x * 3.3 / 4096.0;
      const resistance = 10000.0 * (3.3 - voltage) / voltage;
      const logR = Math.log(resistance / 46500.0);
      const tempKelvin = 1.0 / ((logR / 3435.0) + (1.0 / 298.15));
      return 1.71 * (tempKelvin - 273.15) - 17.7;
    }
  },

  // Inlet Humidity (%) - Use Faridabad weather humidity
  d12: {
    type: 'formula',
    fn: () => cachedHumidity
  },

  // d13: Hidden - Inlet pH not displayed
  // d14: Hidden - Inlet Water Level not displayed
  // d15: Hidden - Inlet Water Temp not displayed

  // Inlet O₂ (%) - Show ~20.9% when device is ON, 0 when OFF
  d16: {
    type: 'formula',
    fn: (x) => {
      // If input is 0, device is OFF - show 0
      if (x === 0) return 0;
      // Device is ON - show ambient O2 (~20.9%) with slight variation
      const variation = ((x % 100) - 50) / 500; // Small variation ±0.1%
      return 20.9 + variation;
    }
  }
};

// ============================================================================
// DISPLAY (LED SCREEN) VALUE CONFIGURATION
// ============================================================================
// Configure what values are sent to the LED display (i11-i22).
// Each display slot can be mapped to a sensor value with optional transformation.
//
// Current mapping:
// i11 = AQI (calculated from inlet sensors d9-d12)
// i12 = Temperature (d11 - inlet temp)
// i13 = Humidity (d12 - inlet humidity)
// i14 = CO2 Reduced (grams)
// i15 = O2 Generated (liters)
// i16 = Day (DD)
// i17 = Month (MM)
// i18 = Year (YY - last 2 digits)
// i19 = Hour (HH)
// i20 = Minute (MM)
// i21 = Relay Modes (8-digit string: 1=Manual, 2=Auto for each R1-R8)
// i22 = Relay States (8-digit string: 1=ON, 2=OFF for each R1-R8)
//
// You can override any of these with custom sources and formulas.
// ============================================================================

const DISPLAY_TRANSFORMS = {
  // Override display values here if needed
  // Example:
  // i11: { source: 'calculated.aqi.value', transform: { type: 'round', decimals: 0 } },
};

// Relay mapping: Display name (R1-R8) to internal ID (i1-i8)
// Order: R1, R2, R3, R4, R5, R7, R6, R8 (R7 before R6 as requested)
// This matches the frontend mapping
const RELAY_MAPPING = [
  { display: 'R1', internal: 'i4', name: 'Circulator Actuator' },
  { display: 'R2', internal: 'i1', name: 'Aeration Blower Assembly' },
  { display: 'R3', internal: 'i2', name: 'Luminaire + Dehumidifier' },
  { display: 'R4', internal: 'i3', name: 'Photosynthetic Irrad.' },
  { display: 'R5', internal: 'i8', name: 'Thermal System' },
  { display: 'R7', internal: 'i6', name: 'Exhaust Impeller' },  // R7 before R6
  { display: 'R6', internal: 'i5', name: null },                 // R6 after R7
  { display: 'R8', internal: 'i7', name: null },                 // R8 last
];

// ============================================================================
// TRANSFORMATION ENGINE (DO NOT EDIT UNLESS YOU KNOW WHAT YOU'RE DOING)
// ============================================================================

class DataTransformerService {
  constructor() {
    this.sensorTransforms = SENSOR_TRANSFORMS;
    this.displayTransforms = DISPLAY_TRANSFORMS;
    this.transformLog = []; // Keep last 10 transforms for debugging
  }

  /**
   * Apply a single transformation to a value
   * @param {number} value - The original value
   * @param {Object} transform - The transformation config
   * @param {Object} allData - All sensor data (for formulas that reference other sensors)
   * @returns {number} - The transformed value
   */
  applyTransform(value, transform, allData = {}) {
    if (!transform || transform.type === 'none') {
      return value;
    }

    // Handle null/undefined values
    if (value === null || value === undefined) {
      return value;
    }

    try {
      switch (transform.type) {
        case 'offset':
          return value + (transform.value || 0);

        case 'scale':
          return value * (transform.value || 1);

        case 'calibrate':
          return (value + (transform.offset || 0)) * (transform.scale || 1);

        case 'clamp':
          const min = transform.min !== undefined ? transform.min : -Infinity;
          const max = transform.max !== undefined ? transform.max : Infinity;
          return Math.max(min, Math.min(max, value));

        case 'round':
          const decimals = transform.decimals !== undefined ? transform.decimals : 0;
          const factor = Math.pow(10, decimals);
          return Math.round(value * factor) / factor;

        case 'floor':
          return Math.floor(value);

        case 'ceil':
          return Math.ceil(value);

        case 'abs':
          return Math.abs(value);

        case 'formula':
          if (typeof transform.fn === 'function') {
            return transform.fn(value, allData);
          }
          logger.warn('Formula transform missing fn function');
          return value;

        case 'chain':
          if (Array.isArray(transform.transforms)) {
            let result = value;
            for (const t of transform.transforms) {
              result = this.applyTransform(result, t, allData);
            }
            return result;
          }
          return value;

        case 'map':
          // Map value from one range to another
          // { type: 'map', fromMin: 0, fromMax: 100, toMin: 0, toMax: 1 }
          const fromRange = (transform.fromMax || 100) - (transform.fromMin || 0);
          const toRange = (transform.toMax || 1) - (transform.toMin || 0);
          const normalized = (value - (transform.fromMin || 0)) / fromRange;
          return (transform.toMin || 0) + (normalized * toRange);

        case 'threshold':
          // Return one value if above threshold, another if below
          // { type: 'threshold', threshold: 50, above: 1, below: 0 }
          return value >= (transform.threshold || 0)
            ? (transform.above !== undefined ? transform.above : 1)
            : (transform.below !== undefined ? transform.below : 0);

        default:
          logger.warn(`Unknown transform type: ${transform.type}`);
          return value;
      }
    } catch (error) {
      logger.error(`Error applying transform ${transform.type}:`, error.message);
      return value; // Return original value on error
    }
  }

  /**
   * Transform all sensor data
   * This is the main entry point - call this before storing data in cache
   * @param {Object} rawData - Raw sensor data from AWS WebSocket
   * @returns {Object} - Transformed sensor data
   */
  transformSensorData(rawData) {
    if (!rawData || typeof rawData !== 'object') {
      return rawData;
    }

    const transformedData = { ...rawData };
    const appliedTransforms = [];

    // Apply transformations to each sensor that has one defined
    for (const [sensorId, transform] of Object.entries(this.sensorTransforms)) {
      if (rawData[sensorId] !== undefined) {
        const originalValue = rawData[sensorId];
        const transformedValue = this.applyTransform(originalValue, transform, rawData);

        if (originalValue !== transformedValue) {
          transformedData[sensorId] = transformedValue;
          appliedTransforms.push({
            sensor: sensorId,
            original: originalValue,
            transformed: transformedValue,
            type: transform.type
          });
        }
      }
    }

    // Log transforms if any were applied (for debugging)
    if (appliedTransforms.length > 0) {
      this.logTransforms(appliedTransforms);
    }

    return transformedData;
  }

  /**
   * Get transformed values for LED display
   * @param {Object} processedData - Processed data from calculationsService
   * @param {Array} automationRules - Optional automation rules for relay mode detection
   * @returns {Object} - Display values (i11-i22)
   */
  getDisplayValues(processedData, automationRules = []) {
    if (!processedData) {
      return null;
    }

    const sensorData = processedData.sensors || processedData;
    const calculated = processedData.calculated || {};
    const relays = processedData.relays || sensorData;

    // Default display values
    // i11 = AQI, i12 = TEMP, i13 = HUMI, i14 = CO2 REDUCED, i15 = O2 GENERATED
    // i16 = DD, i17 = MM, i18 = YY, i19 = HH, i20 = MM (minute)
    // i21 = Relay Modes (8-digit: 1=Manual, 2=Auto), i22 = Relay States (8-digit: 1=ON, 2=OFF)
    const now = new Date();

    // Build relay mode string (i21) and state string (i22) for R1-R8
    // 1 = Manual/ON, 2 = Auto/OFF
    let relayModes = '';
    let relayStates = '';

    for (const { internal: relayId } of RELAY_MAPPING) {
      // Check if relay has an active automation rule (sensor or time mode = Auto)
      const hasAutoRule = automationRules.some(
        rule => rule.relay === relayId && rule.enabled && (rule.mode === 'sensor' || rule.mode === 'time')
      );
      relayModes += hasAutoRule ? '2' : '1';  // 1 = Manual, 2 = Auto

      // Get relay state
      const isOn = relays[relayId] === 1;
      relayStates += isOn ? '1' : '2';  // 1 = ON, 2 = OFF
    }

    const defaults = {
      i11: calculated.aqi?.value || this.calculateSimpleAQI(sensorData),       // AQI
      i12: Math.round(sensorData.d10 || 0),                                      // Temperature (outlet)
      i13: Math.round(sensorData.d11 || 0),                                      // Humidity (outlet)
      i14: Math.round((calculated.co2?.absorbedGrams || 0) * 100) / 100,         // CO2 Reduced (grams)
      i15: Math.round((calculated.o2?.generatedLiters || 0) * 1000) / 1000,      // O2 Generated (liters)
      i16: now.getDate(),                                                         // Day (DD)
      i17: now.getMonth() + 1,                                                    // Month (MM)
      i18: now.getFullYear() % 100,                                               // Year (YY)
      i19: now.getHours(),                                                        // Hour (HH)
      i20: now.getMinutes(),                                                      // Minute (MM)
      i21: relayModes,                                                            // Relay Modes (8-digit string)
      i22: relayStates                                                            // Relay States (8-digit string)
    };

    // Apply any display overrides
    const displayValues = { ...defaults };

    for (const [displayId, config] of Object.entries(this.displayTransforms)) {
      try {
        let value;

        if (config.source === 'custom' && typeof config.formula === 'function') {
          // Custom formula
          value = config.formula(sensorData, calculated);
        } else if (config.source) {
          // Get value from source path (e.g., 'd10' or 'calculated.aqi.value')
          value = this.getValueByPath({ ...sensorData, calculated }, config.source);
        }

        if (value !== undefined && value !== null) {
          // Apply transform if defined
          if (config.transform) {
            value = this.applyTransform(value, config.transform, sensorData);
          }
          displayValues[displayId] = value;
        }
      } catch (error) {
        logger.error(`Error getting display value for ${displayId}:`, error.message);
      }
    }

    return displayValues;
  }

  /**
   * Simple AQI calculation fallback
   * Uses INLET sensor values (d9-d12) - Outside Device
   */
  calculateSimpleAQI(data) {
    const co2 = data.d9 || 0;       // Inlet CO₂
    const pm = data.d10 || 0;       // Inlet PM2.5
    const temp = data.d11 || 0;     // Inlet Temperature
    const humidity = data.d12 || 0; // Inlet Humidity

    let aqi = (co2 * 0.4) + (pm * 0.4) + (temp * 0.1) + (humidity * 0.1);
    return Math.max(0, Math.min(500, Math.round(aqi)));
  }

  /**
   * Get value from nested object by path string
   * e.g., 'calculated.aqi.value' from { calculated: { aqi: { value: 50 } } }
   */
  getValueByPath(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  /**
   * Log applied transforms for debugging
   */
  logTransforms(transforms) {
    this.transformLog.push({
      timestamp: new Date().toISOString(),
      transforms
    });

    // Keep only last 10 entries
    if (this.transformLog.length > 10) {
      this.transformLog = this.transformLog.slice(-10);
    }

    // Log to console in debug mode
    logger.debug('Applied sensor transforms:', JSON.stringify(transforms));
  }

  /**
   * Get current transformation configuration (for debugging/API)
   */
  getConfig() {
    return {
      sensorTransforms: this.sensorTransforms,
      displayTransforms: this.displayTransforms,
      recentTransforms: this.transformLog
    };
  }

  /**
   * Update sensor transformation at runtime
   * @param {string} sensorId - Sensor ID (e.g., 'd1')
   * @param {Object} transform - Transformation config
   */
  setSensorTransform(sensorId, transform) {
    if (!sensorId.match(/^d\d+$/)) {
      throw new Error('Invalid sensor ID format. Expected d1-d40');
    }
    this.sensorTransforms[sensorId] = transform;
    logger.info(`Updated transform for ${sensorId}:`, transform);
  }

  /**
   * Remove sensor transformation
   * @param {string} sensorId - Sensor ID to remove transform for
   */
  removeSensorTransform(sensorId) {
    delete this.sensorTransforms[sensorId];
    logger.info(`Removed transform for ${sensorId}`);
  }

  /**
   * Update display transformation at runtime
   * @param {string} displayId - Display ID (e.g., 'i11')
   * @param {Object} config - Display configuration
   */
  setDisplayTransform(displayId, config) {
    if (!displayId.match(/^i(1[1-9]|20)$/)) {
      throw new Error('Invalid display ID format. Expected i11-i20');
    }
    this.displayTransforms[displayId] = config;
    logger.info(`Updated display transform for ${displayId}:`, config);
  }

  /**
   * Remove display transformation
   * @param {string} displayId - Display ID to remove transform for
   */
  removeDisplayTransform(displayId) {
    delete this.displayTransforms[displayId];
    logger.info(`Removed display transform for ${displayId}`);
  }
}

module.exports = new DataTransformerService();
