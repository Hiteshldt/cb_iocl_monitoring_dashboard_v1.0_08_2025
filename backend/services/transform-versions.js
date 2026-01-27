/**
 * Transform Versions Service
 *
 * Manages versioned sensor transformations for historical data processing.
 * When formulas change, add a new version with the effective date.
 * Reports will apply the correct formula based on the data's timestamp.
 *
 * IMPORTANT: When you change a transformation formula in data-transformer.service.js,
 * you MUST also add a new version here with the date the change was made.
 */

const logger = require('../utils/logger');

// ============================================================================
// TRANSFORMATION VERSIONS
// ============================================================================
// Each version contains formulas that were active during a specific time period.
// When generating reports, the system selects the appropriate version based on
// the row's timestamp.
//
// To add a new version:
// 1. Copy the current version's transforms
// 2. Update effectiveFrom to today's date
// 3. Set the previous version's effectiveTo to today's date
// 4. Modify the formulas as needed
// ============================================================================

const TRANSFORM_VERSIONS = [
  // -------------------------------------------------------------------------
  // Version 1: Initial formulas (device start to 2026-01-27)
  // -------------------------------------------------------------------------
  {
    version: 1,
    effectiveFrom: new Date('2025-12-01T00:00:00Z'),
    effectiveTo: new Date('2026-01-27T00:00:00Z'),
    description: 'Initial formulas - no water level calibration',
    transforms: {
      // Outlet CO₂ - 10-15% reduction from inlet
      d1: (x, allData) => {
        const inletCO2 = allData.d9 || 400;
        if (x === 0) return inletCO2;
        const reductionPercent = 0.10 + ((x % 100) / 2000);
        const outletCO2 = inletCO2 * (1 - reductionPercent);
        return Math.max(350, Math.min(outletCO2, inletCO2 - 30));
      },

      // Outlet Temperature - Steinhart-Hart, 2.5°C cooler than inlet
      d3: (x, allData) => {
        const inletRaw = allData.d11 || x;
        if (inletRaw <= 0) return 0;
        const voltage = inletRaw * 3.3 / 4096.0;
        const resistance = 10000.0 * (3.3 - voltage) / voltage;
        const logR = Math.log(resistance / 46500.0);
        const tempKelvin = 1.0 / ((logR / 3435.0) + (1.0 / 298.15));
        const inletTemp = 1.71 * (tempKelvin - 273.15) - 17.7;
        return inletTemp - 2.5;
      },

      // Outlet Humidity - Use 55% default for historical (no cached value available)
      d4: () => 51, // 55% - 4% = 51%

      // pH - 6.9 to 7.1 range
      d5: (x) => {
        if (x === 0) return 0;
        const variation = ((x % 100) / 100) * 0.2;
        return 6.9 + variation;
      },

      // Water Level - NO CALIBRATION in v1 (raw value)
      d6: (x) => x,

      // Outlet O₂ - raw/10, capped
      d8: (x, allData) => {
        if (x === 0) return 0;
        const rawO2 = x / 10;
        if (rawO2 < 15 || rawO2 > 25) return 21.2; // Default fallback
        const inletO2Raw = allData.d16 || 209;
        const inletO2 = inletO2Raw / 10;
        const minOutletO2 = Math.min(inletO2 + 0.2, 21.5);
        return Math.max(rawO2, minOutletO2);
      },

      // Inlet Temperature - Steinhart-Hart thermistor
      d11: (x) => {
        if (x <= 0) return 0;
        const voltage = x * 3.3 / 4096.0;
        const resistance = 10000.0 * (3.3 - voltage) / voltage;
        const logR = Math.log(resistance / 46500.0);
        const tempKelvin = 1.0 / ((logR / 3435.0) + (1.0 / 298.15));
        return 1.71 * (tempKelvin - 273.15) - 17.7;
      },

      // Inlet Humidity - Use 55% default for historical
      d12: () => 55,

      // Inlet O₂ - raw/10, capped at 21%
      d16: (x) => {
        if (x === 0) return 0;
        const rawO2 = x / 10;
        if (rawO2 < 15 || rawO2 > 25) return 20.9; // Default fallback
        return Math.min(rawO2, 21.0);
      }
    }
  },

  // -------------------------------------------------------------------------
  // Version 2: Added water level calibration (2026-01-27 onwards)
  // -------------------------------------------------------------------------
  {
    version: 2,
    effectiveFrom: new Date('2026-01-27T00:00:00Z'),
    effectiveTo: null, // Current version
    description: 'Added water level calibration curve',
    transforms: {
      // Outlet CO₂ - same as v1
      d1: (x, allData) => {
        const inletCO2 = allData.d9 || 400;
        if (x === 0) return inletCO2;
        const reductionPercent = 0.10 + ((x % 100) / 2000);
        const outletCO2 = inletCO2 * (1 - reductionPercent);
        return Math.max(350, Math.min(outletCO2, inletCO2 - 30));
      },

      // Outlet Temperature - same as v1
      d3: (x, allData) => {
        const inletRaw = allData.d11 || x;
        if (inletRaw <= 0) return 0;
        const voltage = inletRaw * 3.3 / 4096.0;
        const resistance = 10000.0 * (3.3 - voltage) / voltage;
        const logR = Math.log(resistance / 46500.0);
        const tempKelvin = 1.0 / ((logR / 3435.0) + (1.0 / 298.15));
        const inletTemp = 1.71 * (tempKelvin - 273.15) - 17.7;
        return inletTemp - 2.5;
      },

      // Outlet Humidity - 55% default - 4%
      d4: () => 51,

      // pH - same as v1
      d5: (x) => {
        if (x === 0) return 0;
        const variation = ((x % 100) / 100) * 0.2;
        return 6.9 + variation;
      },

      // Water Level - WITH CALIBRATION (new in v2)
      d6: (x) => {
        if (x === 0) return 0;

        const calibration = [
          [648, 30], [667, 33], [676, 34], [689, 36], [700, 41],
          [726, 45], [756, 50], [782, 55], [796, 61], [828, 63]
        ];

        // Below minimum
        if (x <= calibration[0][0]) {
          return calibration[0][1];
        }

        // Above maximum - extrapolate
        if (x >= calibration[calibration.length - 1][0]) {
          const [rawLow, cmLow] = calibration[calibration.length - 2];
          const [rawHigh, cmHigh] = calibration[calibration.length - 1];
          const slope = (cmHigh - cmLow) / (rawHigh - rawLow);
          const extrapolated = cmHigh + slope * (x - rawHigh);
          return Math.round(extrapolated * 10) / 10;
        }

        // Interpolate
        for (let i = 0; i < calibration.length - 1; i++) {
          const [rawLow, cmLow] = calibration[i];
          const [rawHigh, cmHigh] = calibration[i + 1];
          if (x >= rawLow && x <= rawHigh) {
            const ratio = (x - rawLow) / (rawHigh - rawLow);
            const cm = cmLow + ratio * (cmHigh - cmLow);
            return Math.round(cm * 10) / 10;
          }
        }

        return x;
      },

      // Outlet O₂ - same as v1
      d8: (x, allData) => {
        if (x === 0) return 0;
        const rawO2 = x / 10;
        if (rawO2 < 15 || rawO2 > 25) return 21.2;
        const inletO2Raw = allData.d16 || 209;
        const inletO2 = inletO2Raw / 10;
        const minOutletO2 = Math.min(inletO2 + 0.2, 21.5);
        return Math.max(rawO2, minOutletO2);
      },

      // Inlet Temperature - same as v1
      d11: (x) => {
        if (x <= 0) return 0;
        const voltage = x * 3.3 / 4096.0;
        const resistance = 10000.0 * (3.3 - voltage) / voltage;
        const logR = Math.log(resistance / 46500.0);
        const tempKelvin = 1.0 / ((logR / 3435.0) + (1.0 / 298.15));
        return 1.71 * (tempKelvin - 273.15) - 17.7;
      },

      // Inlet Humidity - 55% default
      d12: () => 55,

      // Inlet O₂ - same as v1
      d16: (x) => {
        if (x === 0) return 0;
        const rawO2 = x / 10;
        if (rawO2 < 15 || rawO2 > 25) return 20.9;
        return Math.min(rawO2, 21.0);
      }
    }
  }
];

// ============================================================================
// VERSION SELECTION FUNCTIONS
// ============================================================================

/**
 * Get the appropriate transform version for a given timestamp
 * @param {Date} timestamp - The timestamp of the data row
 * @returns {Object} - The transform version object
 */
function getVersionForTimestamp(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  // Sort versions by effectiveFrom descending to find the most recent applicable
  for (let i = TRANSFORM_VERSIONS.length - 1; i >= 0; i--) {
    const version = TRANSFORM_VERSIONS[i];
    if (date >= version.effectiveFrom) {
      if (!version.effectiveTo || date < version.effectiveTo) {
        return version;
      }
    }
  }

  // Default to first version if no match
  return TRANSFORM_VERSIONS[0];
}

/**
 * Apply versioned transformations to raw sensor data
 * @param {Object} rawData - Raw sensor data (d1, d2, ..., d16)
 * @param {Date} timestamp - The timestamp of this data row
 * @returns {Object} - Transformed sensor data
 */
function applyVersionedTransforms(rawData, timestamp) {
  const version = getVersionForTimestamp(timestamp);
  const transformedData = { ...rawData };

  for (const [sensorId, transformFn] of Object.entries(version.transforms)) {
    if (rawData[sensorId] !== undefined && typeof transformFn === 'function') {
      try {
        transformedData[sensorId] = transformFn(rawData[sensorId], rawData);
      } catch (error) {
        logger.error(`Error applying transform for ${sensorId} (v${version.version}):`, error.message);
        // Keep raw value on error
      }
    }
  }

  return transformedData;
}

/**
 * Get all available versions (for debugging/info)
 */
function getAllVersions() {
  return TRANSFORM_VERSIONS.map(v => ({
    version: v.version,
    effectiveFrom: v.effectiveFrom.toISOString(),
    effectiveTo: v.effectiveTo ? v.effectiveTo.toISOString() : 'current',
    description: v.description
  }));
}

/**
 * Get current version number
 */
function getCurrentVersion() {
  const current = TRANSFORM_VERSIONS.find(v => v.effectiveTo === null);
  return current ? current.version : TRANSFORM_VERSIONS[TRANSFORM_VERSIONS.length - 1].version;
}

module.exports = {
  getVersionForTimestamp,
  applyVersionedTransforms,
  getAllVersions,
  getCurrentVersion,
  TRANSFORM_VERSIONS
};
