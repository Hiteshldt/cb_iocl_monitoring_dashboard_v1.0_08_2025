/**
 * Calculations Service
 * Handles AQI, CO2 absorption, and O2 generation calculations
 * Uses formulas from config/formulas.config.js
 */

const fs = require('fs');
const path = require('path');
const formulas = require('../config/formulas.config');
const fileStorage = require('../utils/fileStorage');

class CalculationsService {
  constructor() {
    this.accumulatedData = {
      co2AbsorbedGrams: 0,
      o2GeneratedLiters: 0,
      lastCalculationTime: null,
      airflowRate: formulas.airflow.defaultRate,
      history: [] // Store last 24 hours of calculations
    };

    this.isInitialized = false;
    this.initPromise = this.loadAccumulatedData();
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInit() {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  /**
   * Load accumulated data from file storage
   */
  async loadAccumulatedData() {
    try {
      const data = await fileStorage.readJSON('accumulated-data.json');
      if (data) {
        // Handle migration from old format (o2GeneratedGrams) to new format (o2GeneratedLiters)
        let o2Liters = data.o2GeneratedLiters || 0;
        if (data.o2GeneratedGrams && !data.o2GeneratedLiters) {
          // Convert old grams to liters
          o2Liters = data.o2GeneratedGrams * formulas.o2.gramsToLiters;
        }

        this.accumulatedData = {
          ...this.accumulatedData,
          co2AbsorbedGrams: data.co2AbsorbedGrams || 0,
          o2GeneratedLiters: o2Liters,
          airflowRate: data.airflowRate || formulas.airflow.defaultRate,
          history: data.history || [],
          lastCalculationTime: data.lastCalculationTime ? new Date(data.lastCalculationTime) : null
        };
        this.isInitialized = true;
        console.log('[Calculations] Loaded accumulated data:', {
          co2: this.accumulatedData.co2AbsorbedGrams.toFixed(2) + ' g',
          o2: this.accumulatedData.o2GeneratedLiters.toFixed(4) + ' L'
        });
      } else {
        this.isInitialized = true;
      }
    } catch (err) {
      console.log('[Calculations] No previous accumulated data found, starting fresh');
      this.isInitialized = true;
    }
  }

  /**
   * Save accumulated data to file storage
   */
  async saveAccumulatedData() {
    try {
      await fileStorage.writeJSON('accumulated-data.json', {
        ...this.accumulatedData,
        lastSaved: new Date().toISOString()
      });
    } catch (err) {
      console.error('[Calculations] Failed to save accumulated data:', err);
    }
  }

  /**
   * Calculate AQI sub-index using breakpoints
   */
  calculateSubIndex(value, breakpoints) {
    for (const bp of breakpoints) {
      if (value >= bp.low && value <= bp.high) {
        // Linear interpolation within the breakpoint range
        const range = bp.high - bp.low;
        const aqiRange = bp.aqiHigh - bp.aqiLow;
        const position = (value - bp.low) / range;
        return bp.aqiLow + (position * aqiRange);
      }
    }
    // If above all breakpoints, return max AQI
    return breakpoints[breakpoints.length - 1].aqiHigh;
  }

  /**
   * Calculate temperature sub-index based on comfort range
   */
  calculateTemperatureSubIndex(temp) {
    const config = formulas.aqi.temperature;
    if (temp >= config.optimalLow && temp <= config.optimalHigh) {
      return 0; // Optimal range
    }

    let deviation;
    if (temp < config.optimalLow) {
      deviation = config.optimalLow - temp;
    } else {
      deviation = temp - config.optimalHigh;
    }

    // Linear scale based on deviation
    const normalized = Math.min(deviation / config.maxDeviation, 1);
    return normalized * config.maxSubIndex;
  }

  /**
   * Calculate humidity sub-index based on comfort range
   */
  calculateHumiditySubIndex(humidity) {
    const config = formulas.aqi.humidity;
    if (humidity >= config.optimalLow && humidity <= config.optimalHigh) {
      return 0; // Optimal range
    }

    let deviation;
    if (humidity < config.optimalLow) {
      deviation = config.optimalLow - humidity;
    } else {
      deviation = humidity - config.optimalHigh;
    }

    // Linear scale based on deviation
    const normalized = Math.min(deviation / config.maxDeviation, 1);
    return normalized * config.maxSubIndex;
  }

  /**
   * Calculate AQI from sensor data
   * Uses INLET sensor values (d9-d12) to measure incoming air quality
   *
   * Sensor Mapping:
   * - d9  = Inlet CO₂ (Outside Device)
   * - d10 = Inlet PM2.5 (Outside Device)
   * - d11 = Inlet Temperature (Outside Device)
   * - d12 = Inlet Humidity (Outside Device)
   *
   * @param {Object} data - Sensor data
   * @returns {Object} - AQI value and category
   */
  calculateAQI() {
    // Use real Faridabad AQI from data-transformer (fetched from aqi.in Sector 15A with fallbacks)
    const dataTransformer = require('./data-transformer.service');
    const aqi = dataTransformer.calculateSimpleAQI();
    const source = dataTransformer.getAQISource ? dataTransformer.getAQISource() : 'Faridabad';

    // Determine category based on AQI value
    let category, color;
    if (aqi <= 50) {
      category = 'Good';
      color = 'green';
    } else if (aqi <= 100) {
      category = 'Moderate';
      color = 'yellow';
    } else if (aqi <= 150) {
      category = 'Unhealthy for Sensitive';
      color = 'orange';
    } else if (aqi <= 200) {
      category = 'Unhealthy';
      color = 'red';
    } else if (aqi <= 300) {
      category = 'Very Unhealthy';
      color = 'purple';
    } else {
      category = 'Hazardous';
      color = 'maroon';
    }

    return {
      value: Math.min(aqi, 500),
      category,
      color,
      source
    };
  }

  /**
   * Calculate CO2 absorbed and O2 generated
   *
   * Sensor Mapping:
   * - d9 = Inlet CO₂ (Outside Device) - Air coming IN
   * - d1 = Outlet CO₂ (Inside Device) - Air going OUT (after processing)
   *
   * CO2 Absorption = Inlet CO2 - Outlet CO2
   * (If device is absorbing CO2, inlet should be higher than outlet)
   *
   * @param {Object} data - Sensor data
   * @returns {Object} - CO2 absorbed (grams) and O2 generated (liters) in this interval
   */
  calculateGasExchange(data) {
    const now = new Date();
    const inletCO2 = data.d9 || 0;   // Inlet CO2 (ppm) - Outside Device
    const outletCO2 = data.d1 || 0;  // Outlet CO2 (ppm) - Inside Device

    // CO2 absorption (ppm) = Inlet - Outlet (inlet is higher before absorption)
    // Clamped to never go negative (can't have negative absorption)
    const co2Diff = Math.max(0, inletCO2 - outletCO2);

    // Debug logging for CO2 calculation
    console.log(`[CO2] Inlet (d9): ${inletCO2} ppm, Outlet (d1): ${outletCO2} ppm, Diff: ${co2Diff} ppm`);

    // Skip if difference is zero or below threshold (no absorption happening)
    if (co2Diff <= formulas.co2.minimumDifference) {
      // Still update lastCalculationTime to keep timing accurate
      this.accumulatedData.lastCalculationTime = now;
      return {
        intervalCO2Grams: 0,
        intervalO2Liters: 0,
        totalCO2Grams: this.accumulatedData.co2AbsorbedGrams,
        totalO2Liters: this.accumulatedData.o2GeneratedLiters
      };
    }

    // Calculate time interval in hours
    let timeIntervalHours = formulas.co2.calculationInterval / 3600; // Default to config interval

    if (this.accumulatedData.lastCalculationTime) {
      const elapsedMs = now - this.accumulatedData.lastCalculationTime;
      timeIntervalHours = elapsedMs / (1000 * 3600);

      // Cap at reasonable maximum (5 minutes) to handle restarts
      timeIntervalHours = Math.min(timeIntervalHours, 5 / 60);
    }

    // CO2 absorbed (grams) = ppm_diff * airflow(m³/h) * time(h) * conversionFactor
    const co2AbsorbedGrams = co2Diff * this.accumulatedData.airflowRate *
      timeIntervalHours * formulas.co2.conversionFactor;

    // O2 generated (grams) = CO2_absorbed * O2_conversion_factor
    const o2GeneratedGrams = co2AbsorbedGrams * formulas.o2.conversionFactor;

    // Convert O2 grams to liters
    const o2GeneratedLiters = o2GeneratedGrams * formulas.o2.gramsToLiters;

    // Update accumulated totals
    this.accumulatedData.co2AbsorbedGrams += co2AbsorbedGrams;
    this.accumulatedData.o2GeneratedLiters += o2GeneratedLiters;
    this.accumulatedData.lastCalculationTime = now;

    console.log(`[CO2] Absorbed this interval: ${co2AbsorbedGrams.toFixed(4)} g, Total: ${this.accumulatedData.co2AbsorbedGrams.toFixed(4)} g`);
    console.log(`[O2] Generated this interval: ${o2GeneratedLiters.toFixed(6)} L, Total: ${this.accumulatedData.o2GeneratedLiters.toFixed(6)} L`);

    // Add to history (keep last 24 hours at 30-second intervals = 2880 entries)
    this.accumulatedData.history.push({
      timestamp: now.toISOString(),
      co2Diff,
      co2Grams: co2AbsorbedGrams,
      o2Liters: o2GeneratedLiters
    });

    // Trim history to last 24 hours
    if (this.accumulatedData.history.length > 2880) {
      this.accumulatedData.history = this.accumulatedData.history.slice(-2880);
    }

    // Save immediately when we have absorption (don't wait for periodic save)
    this.saveAccumulatedData();

    return {
      intervalCO2Grams: co2AbsorbedGrams,
      intervalO2Liters: o2GeneratedLiters,
      totalCO2Grams: this.accumulatedData.co2AbsorbedGrams,
      totalO2Liters: this.accumulatedData.o2GeneratedLiters,
      co2DiffPPM: co2Diff
    };
  }

  /**
   * Get current airflow rate
   */
  getAirflowRate() {
    return this.accumulatedData.airflowRate;
  }

  /**
   * Set airflow rate
   * @param {number} rate - Airflow rate in m³/h
   */
  setAirflowRate(rate) {
    this.accumulatedData.airflowRate = rate;
    this.saveAccumulatedData();
    return this.accumulatedData.airflowRate;
  }

  /**
   * Get accumulated totals
   */
  getAccumulatedTotals() {
    return {
      co2AbsorbedGrams: this.accumulatedData.co2AbsorbedGrams,
      o2GeneratedLiters: this.accumulatedData.o2GeneratedLiters,
      airflowRate: this.accumulatedData.airflowRate,
      lastCalculationTime: this.accumulatedData.lastCalculationTime
    };
  }

  /**
   * Reset accumulated totals
   */
  resetAccumulatedTotals() {
    this.accumulatedData.co2AbsorbedGrams = 0;
    this.accumulatedData.o2GeneratedLiters = 0;
    this.accumulatedData.history = [];
    this.saveAccumulatedData();
    console.log('[Calculations] Accumulated totals reset');
  }

  /**
   * Get relay names from config
   */
  getRelayNames() {
    return formulas.relayNames;
  }

  /**
   * Process sensor data and return all calculated values
   * @param {Object} data - Raw sensor data
   * @returns {Object} - Processed data with all calculations
   */
  processData(data) {
    const aqi = this.calculateAQI(data);
    const gasExchange = this.calculateGasExchange(data);

    // Parse device timestamp from the data (format: "2025-12-14,15:22:07")
    let deviceTimestamp = null;
    if (data.date) {
      try {
        // Convert "2025-12-14,15:22:07" to ISO format
        const [datePart, timePart] = data.date.split(',');
        deviceTimestamp = new Date(`${datePart}T${timePart}`).toISOString();
      } catch (e) {
        deviceTimestamp = new Date().toISOString();
      }
    }

    return {
      // Original sensor data
      sensors: data,

      // Device timestamp (when device recorded the data)
      deviceTimestamp,
      serverTimestamp: new Date().toISOString(),

      // Calculated values
      // Sensor Mapping: d9-d12 = Inlet (Outside), d1-d8 = Outlet (Inside)
      calculated: {
        aqi,
        temperature: data.d11 || 0,   // Inlet Temperature (Outside)
        humidity: data.d12 || 0,      // Inlet Humidity (Outside)
        co2: {
          inlet: data.d9 || 0,        // Inlet CO2 (Outside Device)
          outlet: data.d1 || 0,       // Outlet CO2 (Inside Device)
          difference: Math.max(0, (data.d9 || 0) - (data.d1 || 0)), // Inlet - Outlet = absorption
          absorbedGrams: gasExchange.totalCO2Grams,
          intervalGrams: gasExchange.intervalCO2Grams
        },
        o2: {
          generatedLiters: gasExchange.totalO2Liters,
          intervalLiters: gasExchange.intervalO2Liters
        },
        airflowRate: this.accumulatedData.airflowRate
      },

      // Relay names
      relayNames: formulas.relayNames,

      // Relay states
      relays: {
        i1: data.i1 || 0,
        i2: data.i2 || 0,
        i3: data.i3 || 0,
        i4: data.i4 || 0,
        i5: data.i5 || 0,
        i6: data.i6 || 0,
        i7: data.i7 || 0,
        i8: data.i8 || 0,
        i9: data.i9 || 0,
        i10: data.i10 || 0
      }
    };
  }

  /**
   * Initialize periodic save
   */
  init() {
    // Save accumulated data every minute
    setInterval(() => {
      this.saveAccumulatedData();
    }, formulas.persistence.saveInterval);

    console.log('[Calculations] Service initialized');
  }
}

module.exports = new CalculationsService();
