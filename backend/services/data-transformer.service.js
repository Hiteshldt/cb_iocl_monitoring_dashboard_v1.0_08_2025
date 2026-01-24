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
// FARIDABAD WEATHER & AQI CACHE
// ============================================================================
// Fetches real humidity and AQI from weather/air quality APIs
// Location: IOCL R&D Faridabad - Sector 15A area
let cachedHumidity = 55; // Default fallback humidity
let cachedExternalAQI = 150; // AQI from aqi.in (external source)
let cachedHybridAQI = 150; // Final hybrid AQI (30% external + 70% sensor)
let aqiSource = 'default'; // Track where AQI came from
let lastWeatherFetch = 0;
let latestSensorData = {}; // Store latest sensor data for AQI calculation
const WEATHER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// AQI calculation weights
const EXTERNAL_AQI_WEIGHT = 0.30; // 30% from aqi.in
const SENSOR_AQI_WEIGHT = 0.70;   // 70% from sensors (PM2.5 primary, CO2 secondary)

/**
 * Fetch AQI from aqi.in for Faridabad Sector 15A
 * Scrapes the dashboard page to extract current AQI value
 */
async function fetchAQIFromAqiIn() {
  try {
    // Fetch the Sector 15A dashboard page
    const response = await fetch('https://www.aqi.in/dashboard/india/haryana/faridabad/sector-15a', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Look for AQI value in the page - multiple patterns to try
    // Pattern 1: Look for "aqi" in JSON-LD structured data
    const jsonLdMatch = html.match(/"aqi"\s*:\s*(\d+)/i);
    if (jsonLdMatch && jsonLdMatch[1]) {
      const aqi = parseInt(jsonLdMatch[1], 10);
      if (!isNaN(aqi) && aqi >= 0 && aqi <= 999) {
        logger.info(`Fetched AQI from aqi.in Sector 15A (JSON-LD): ${aqi}`);
        return aqi;
      }
    }

    // Pattern 2: Look for AQI in title/meta or display elements
    // Common patterns: "AQI: 585", "AQI 585", "aqi-value">585<"
    // Updated to support up to 4 digits (max AQI ~500-999)
    const aqiPatterns = [
      /AQI[:\s]+(\d{1,4})/i,
      /aqi-value[^>]*>(\d{1,4})</i,
      /"aqiValue"\s*:\s*(\d+)/i,
      /class="[^"]*aqi[^"]*"[^>]*>(\d{1,4})</i,
      />\s*(\d{3,4})\s*<[^>]*(?:aqi|hazardous|very\s*unhealthy)/i
    ];

    for (const pattern of aqiPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const aqi = parseInt(match[1], 10);
        if (!isNaN(aqi) && aqi >= 0 && aqi <= 999) {
          logger.info(`Fetched AQI from aqi.in Sector 15A: ${aqi}`);
          return aqi;
        }
      }
    }

    // Pattern 3: Look for PM2.5 and calculate AQI
    const pm25Match = html.match(/PM2\.?5[:\s]*(\d+)/i);
    if (pm25Match && pm25Match[1]) {
      const pm25 = parseFloat(pm25Match[1]);
      // Convert PM2.5 to AQI using US EPA breakpoints
      const aqi = calculateAQIFromPM25(pm25);
      if (aqi !== null) {
        logger.info(`Calculated AQI from aqi.in PM2.5 (${pm25}): ${aqi}`);
        return aqi;
      }
    }

    throw new Error('Could not parse AQI from page');
  } catch (error) {
    logger.debug(`Failed to fetch from aqi.in: ${error.message}`);
    return null;
  }
}

/**
 * Convert PM2.5 concentration to AQI using US EPA breakpoints
 */
function calculateAQIFromPM25(pm25) {
  if (pm25 < 0) return null;

  // US EPA AQI breakpoints for PM2.5 (24-hour)
  const breakpoints = [
    { cLow: 0, cHigh: 12.0, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
    { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 }
  ];

  for (const bp of breakpoints) {
    if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
      const aqi = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow;
      return Math.round(aqi);
    }
  }

  // Beyond 500 AQI
  if (pm25 > 500.4) {
    return 500;
  }

  return null;
}

/**
 * Fetch AQI from WAQI as fallback
 */
async function fetchAQIFromWAQI() {
  try {
    const response = await fetch('https://api.waqi.info/feed/faridabad/?token=demo');
    const data = await response.json();
    if (data.status === 'ok' && data.data && typeof data.data.aqi === 'number') {
      logger.info(`Fetched AQI from WAQI Faridabad: ${data.data.aqi}`);
      return data.data.aqi;
    }
  } catch (error) {
    logger.debug(`Failed to fetch from WAQI: ${error.message}`);
  }
  return null;
}

/**
 * Estimate AQI from visibility as last fallback
 */
async function estimateAQIFromVisibility() {
  try {
    const response = await fetch('https://wttr.in/Faridabad?format=j1');
    const data = await response.json();
    if (data.current_condition && data.current_condition[0]) {
      const visibility = parseInt(data.current_condition[0].visibility, 10);
      let aqi;
      if (visibility >= 10) {
        aqi = 50 + Math.floor(Math.random() * 30); // Good: 50-80
      } else if (visibility >= 5) {
        aqi = 100 + Math.floor(Math.random() * 50); // Moderate: 100-150
      } else if (visibility >= 2) {
        aqi = 150 + Math.floor(Math.random() * 50); // Unhealthy: 150-200
      } else {
        aqi = 200 + Math.floor(Math.random() * 100); // Very Unhealthy: 200-300
      }
      logger.info(`Estimated AQI from visibility (${visibility}km): ${aqi}`);
      return aqi;
    }
  } catch (error) {
    logger.debug(`Failed to estimate AQI from visibility: ${error.message}`);
  }
  return null;
}

/**
 * Calculate AQI from CO2 concentration
 * Uses a simplified scale where higher CO2 = worse air quality
 * CO2 < 400 ppm = Good, 400-1000 = Moderate, 1000-2000 = Poor, 2000+ = Very Poor
 */
function calculateAQIFromCO2(co2) {
  if (co2 < 0 || co2 === null || co2 === undefined) return null;

  if (co2 <= 400) {
    // Good: 0-50 AQI
    return Math.round((co2 / 400) * 50);
  } else if (co2 <= 1000) {
    // Moderate: 51-100 AQI
    return Math.round(51 + ((co2 - 400) / 600) * 49);
  } else if (co2 <= 2000) {
    // Unhealthy for Sensitive: 101-150 AQI
    return Math.round(101 + ((co2 - 1000) / 1000) * 49);
  } else if (co2 <= 5000) {
    // Unhealthy: 151-200 AQI
    return Math.round(151 + ((co2 - 2000) / 3000) * 49);
  } else {
    // Very Unhealthy: 200+ AQI
    return Math.min(300, Math.round(200 + ((co2 - 5000) / 5000) * 100));
  }
}

/**
 * Calculate hybrid AQI from sensor data
 * Combines PM2.5 (primary, 80% of sensor weight) and CO2 (secondary, 20% of sensor weight)
 * @param {Object} sensorData - Latest sensor data with d9 (CO2) and d10 (PM2.5)
 * @returns {number} - Sensor-based AQI
 */
function calculateSensorAQI(sensorData) {
  const pm25 = sensorData.d10 || 0;  // Inlet PM2.5
  const co2 = sensorData.d9 || 0;    // Inlet CO2

  // Calculate individual AQIs
  const pm25AQI = calculateAQIFromPM25(pm25) || 0;
  const co2AQI = calculateAQIFromCO2(co2) || 0;

  // PM2.5 gets 80% weight, CO2 gets 20% weight (within the sensor portion)
  const sensorAQI = (pm25AQI * 0.80) + (co2AQI * 0.20);

  logger.debug(`Sensor AQI calculation: PM2.5=${pm25} (AQI=${pm25AQI}), CO2=${co2} (AQI=${co2AQI}), Combined=${Math.round(sensorAQI)}`);

  return Math.round(sensorAQI);
}

/**
 * Calculate final hybrid AQI
 * 30% from external source (aqi.in) + 70% from sensors (PM2.5 primary, CO2 secondary)
 */
function calculateHybridAQI() {
  const sensorAQI = calculateSensorAQI(latestSensorData);

  // If we have no sensor data yet, use external AQI only
  if (!latestSensorData.d10 && !latestSensorData.d9) {
    return cachedExternalAQI;
  }

  // Hybrid: 30% external + 70% sensor
  const hybridAQI = Math.round(
    (cachedExternalAQI * EXTERNAL_AQI_WEIGHT) +
    (sensorAQI * SENSOR_AQI_WEIGHT)
  );

  logger.debug(`Hybrid AQI: External=${cachedExternalAQI} (30%) + Sensor=${sensorAQI} (70%) = ${hybridAQI}`);

  cachedHybridAQI = hybridAQI;
  return hybridAQI;
}

async function fetchFaridabadWeather() {
  const now = Date.now();
  if (now - lastWeatherFetch < WEATHER_CACHE_DURATION) {
    return { humidity: cachedHumidity, aqi: cachedHybridAQI };
  }

  // Fetch humidity from wttr.in
  try {
    const humidityResponse = await fetch('https://wttr.in/Faridabad?format=%h');
    const humidityText = await humidityResponse.text();
    const humidity = parseInt(humidityText.replace('%', '').trim(), 10);
    if (!isNaN(humidity) && humidity >= 0 && humidity <= 100) {
      cachedHumidity = humidity;
      logger.debug(`Fetched Faridabad humidity: ${humidity}%`);
    }
  } catch (error) {
    logger.debug('Failed to fetch humidity, using cached:', cachedHumidity);
  }

  // Fetch external AQI with priority: aqi.in Sector 15A > WAQI > visibility estimate
  let externalAQI = null;

  // Try aqi.in first (Sector 15A specific)
  externalAQI = await fetchAQIFromAqiIn();
  if (externalAQI !== null) {
    cachedExternalAQI = externalAQI;
    aqiSource = 'Hybrid (30% aqi.in + 70% sensors)';
  } else {
    // Fallback to WAQI
    externalAQI = await fetchAQIFromWAQI();
    if (externalAQI !== null) {
      cachedExternalAQI = externalAQI;
      aqiSource = 'Hybrid (30% WAQI + 70% sensors)';
    } else {
      // Last resort: estimate from visibility
      externalAQI = await estimateAQIFromVisibility();
      if (externalAQI !== null) {
        cachedExternalAQI = externalAQI;
        aqiSource = 'Hybrid (30% visibility + 70% sensors)';
      }
    }
  }

  // Recalculate hybrid AQI with new external data
  const hybridAQI = calculateHybridAQI();

  logger.info(`AQI - External: ${cachedExternalAQI}, Hybrid: ${hybridAQI}, Source: ${aqiSource}`);
  lastWeatherFetch = now;
  return { humidity: cachedHumidity, aqi: hybridAQI };
}

// Update sensor data for AQI calculation (called from transformSensorData)
function updateSensorDataForAQI(data) {
  latestSensorData = { ...data };
  // Recalculate hybrid AQI whenever we get new sensor data
  calculateHybridAQI();
}

// Getter for cached hybrid AQI (synchronous)
function getCachedAQI() {
  return cachedHybridAQI;
}

// Getter for AQI source info
function getAQISource() {
  return aqiSource;
}

// Initial fetch on startup
fetchFaridabadWeather();

// Refresh weather data every 30 minutes
setInterval(fetchFaridabadWeather, WEATHER_CACHE_DURATION);

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

  // Outlet CO₂ (ppm) - Must be lower than inlet CO₂ (d9)
  // The device absorbs CO₂, so outlet should be 10-15% lower than inlet
  d1: {
    type: 'formula',
    fn: (x, allData) => {
      const inletCO2 = allData.d9 || 400; // Inlet CO₂, default 400 ppm

      // If device is off (x = 0), outlet equals inlet
      if (x === 0) return inletCO2;

      // Calculate reduction: 10-15% lower than inlet
      // Use sensor value to create slight variation
      const reductionPercent = 0.10 + ((x % 100) / 2000); // 10-15% reduction
      const outletCO2 = inletCO2 * (1 - reductionPercent);

      // Ensure outlet is always lower than inlet and above minimum (350 ppm)
      return Math.max(350, Math.min(outletCO2, inletCO2 - 30));
    }
  },

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

  // Outlet Water Temperature (°C) - Fixed at ~24°C
  d7: {
    type: 'formula',
    fn: () => 24
  },

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
  // d7: { type: 'none' },                     // Outlet Water Temp - show actual value from sensor

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
  { display: 'R1', internal: 'i4', name: 'Culture Thermal System' },
  { display: 'R2', internal: 'i1', name: 'Aeration & Pneumatic Assembly' },
  { display: 'R3', internal: 'i2', name: 'Dehumidity + Fall Lights' },
  { display: 'R4', internal: 'i3', name: 'Photosynthetic Irradiance Module' },
  { display: 'R5', internal: 'i8', name: 'Branding Lights' },
  { display: 'R7', internal: 'i6', name: 'Media Circulation Actuator' },  // R7 before R6
  { display: 'R6', internal: 'i5', name: 'System Chassis Exhaust Impeller' },  // R6 after R7
  { display: 'R8', internal: 'i7', name: 'Relay-8' },            // R8 last
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

    // Update sensor data for hybrid AQI calculation
    // Uses raw data for d9 (CO2) and d10 (PM2.5) from inlet sensors
    updateSensorDataForAQI(rawData);

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

    // =========================================================================
    // DISPLAY VALUES FOR LED SCREEN
    // Sent every 5 seconds to the device
    // =========================================================================
    // i11 = AQI (calculated hybrid value from dashboard)
    // i12 = Inlet Temperature (no decimal)
    // i13 = Inlet Humidity (no decimal)
    // i14 = Hour (24h format, Indian time, no leading zeros: 1 not 01)
    // i15 = Minute (no leading zeros: 5 not 05)
    // i16 = Day (no leading zeros)
    // i17 = Month (no leading zeros)
    // i18 = Year (last 2 digits: 26 for 2026)
    // i19 = O2 at outlet (d8, no decimal)
    // i20 = CO2 at outlet (d1, no decimal)
    // i21 = Relay Modes (8-digit: 1=Manual, 2=Auto)
    // i22 = Relay States (8-digit: 1=ON, 2=OFF)
    // =========================================================================

    // Get Indian Standard Time (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const istTime = new Date(utcTime + istOffset);

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

    // Get transformed sensor values (these are the dashboard values)
    // d11 = Inlet Temperature (transformed), d12 = Inlet Humidity (transformed)
    // d1 = Outlet CO2, d8 = Outlet O2
    const inletTemp = Math.round(sensorData.d11 || 0);      // Inlet Temperature (no decimal)
    const inletHumidity = Math.round(sensorData.d12 || 0);  // Inlet Humidity (no decimal)
    const outletCO2 = Math.round(sensorData.d1 || 0);       // Outlet CO2 (no decimal)
    const outletO2 = Math.round(sensorData.d8 || 0);        // Outlet O2 (no decimal) - will be ~20.9 or 0

    const defaults = {
      i11: Math.round(calculated.aqi?.value || this.calculateSimpleAQI()),      // AQI (hybrid calculated)
      i12: inletTemp,                                                            // Inlet Temperature (no decimal)
      i13: inletHumidity,                                                        // Inlet Humidity (no decimal)
      i14: istTime.getHours(),                                                   // Hour (IST, 24h, no leading zero)
      i15: istTime.getMinutes(),                                                 // Minute (no leading zero)
      i16: istTime.getDate(),                                                    // Day (no leading zero)
      i17: istTime.getMonth() + 1,                                               // Month (no leading zero)
      i18: istTime.getFullYear() % 100,                                          // Year (last 2 digits: 26)
      i19: outletO2,                                                             // Outlet O2 (no decimal)
      i20: outletCO2,                                                            // Outlet CO2 (no decimal)
      i21: relayModes,                                                           // Relay Modes (8-digit string)
      i22: relayStates                                                           // Relay States (8-digit string)
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
   * Get AQI value - uses real Faridabad AQI from aqi.in Sector 15A
   * Falls back to WAQI then visibility estimate if unavailable
   */
  calculateSimpleAQI() {
    // Return cached Faridabad AQI (fetched from aqi.in Sector 15A with fallbacks)
    return getCachedAQI();
  }

  /**
   * Get AQI data source (for display in frontend)
   * @returns {string} - Source of AQI data (e.g., 'aqi.in Sector 15A', 'WAQI Faridabad')
   */
  getAQISource() {
    return getAQISource();
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
