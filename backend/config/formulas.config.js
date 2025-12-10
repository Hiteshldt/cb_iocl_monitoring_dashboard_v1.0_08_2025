/**
 * IOCL Air Quality Control System - Formulas Configuration
 *
 * This file contains all configurable formulas and constants for:
 * - AQI (Air Quality Index) calculation
 * - CO2 absorption calculation
 * - O2 generation calculation (Photobioreactor)
 *
 * Modify values here to adjust calculations without changing code logic.
 */

module.exports = {
  /**
   * AIRFLOW CONFIGURATION
   * Default airflow rate in cubic meters per hour (m³/h)
   * This value can be updated via API or manually here
   */
  airflow: {
    defaultRate: 100, // m³/h - adjust based on your system's actual airflow
    unit: 'm³/h'
  },

  /**
   * AQI CALCULATION FORMULA
   *
   * AQI is calculated using weighted average of pollutant sub-indices
   * Formula: AQI = (CO2_weight * CO2_subindex) + (PM_weight * PM_subindex) +
   *                (Temp_weight * Temp_subindex) + (Humidity_weight * Humidity_subindex)
   *
   * Each sub-index is calculated based on breakpoints (EPA standards adapted)
   */
  aqi: {
    // Weights for each parameter (must sum to 1.0)
    weights: {
      co2: 0.35,      // CO2 has highest impact on indoor air quality
      pm: 0.35,       // Particulate matter is equally important
      temperature: 0.15,
      humidity: 0.15
    },

    // CO2 breakpoints (ppm) -> AQI sub-index
    // Based on indoor air quality standards
    co2Breakpoints: [
      { low: 0, high: 400, aqiLow: 0, aqiHigh: 50 },       // Good
      { low: 401, high: 1000, aqiLow: 51, aqiHigh: 100 },  // Moderate
      { low: 1001, high: 2000, aqiLow: 101, aqiHigh: 150 }, // Unhealthy for sensitive
      { low: 2001, high: 5000, aqiLow: 151, aqiHigh: 200 }, // Unhealthy
      { low: 5001, high: 10000, aqiLow: 201, aqiHigh: 300 }, // Very Unhealthy
      { low: 10001, high: 50000, aqiLow: 301, aqiHigh: 500 } // Hazardous
    ],

    // PM2.5 breakpoints (µg/m³) -> AQI sub-index
    // Based on EPA PM2.5 standards
    pmBreakpoints: [
      { low: 0, high: 12, aqiLow: 0, aqiHigh: 50 },
      { low: 12.1, high: 35.4, aqiLow: 51, aqiHigh: 100 },
      { low: 35.5, high: 55.4, aqiLow: 101, aqiHigh: 150 },
      { low: 55.5, high: 150.4, aqiLow: 151, aqiHigh: 200 },
      { low: 150.5, high: 250.4, aqiLow: 201, aqiHigh: 300 },
      { low: 250.5, high: 500, aqiLow: 301, aqiHigh: 500 }
    ],

    // Temperature comfort range (°C)
    // Optimal: 20-26°C, deviation increases AQI contribution
    temperature: {
      optimalLow: 20,
      optimalHigh: 26,
      maxDeviation: 15, // Max deviation from optimal before max AQI contribution
      maxSubIndex: 100
    },

    // Humidity comfort range (%)
    // Optimal: 40-60%, deviation increases AQI contribution
    humidity: {
      optimalLow: 40,
      optimalHigh: 60,
      maxDeviation: 40,
      maxSubIndex: 100
    }
  },

  /**
   * CO2 ABSORPTION CALCULATION
   *
   * Formula: CO2_absorbed (grams) = (Inlet_CO2 - Outlet_CO2) * Airflow * Time * CO2_density
   *
   * CO2 concentration difference (ppm) is converted to mass using:
   * - Airflow rate (m³/h)
   * - CO2 molar mass: 44.01 g/mol
   * - Molar volume at STP: 24.45 L/mol (at 25°C, 1 atm)
   * - 1 ppm = 1 µL/L = 1 mL/m³
   *
   * CO2 mass (g) = ppm_diff * airflow(m³/h) * time(h) * (44.01/24.45) * 0.001
   *              = ppm_diff * airflow * time * 0.0018 g
   */
  co2: {
    molarMass: 44.01, // g/mol
    molarVolume: 24.45, // L/mol at 25°C
    conversionFactor: 0.0018, // g per ppm per m³

    // Calculation interval in seconds (how often to accumulate)
    calculationInterval: 30, // seconds (matches polling interval)

    // Minimum CO2 difference to consider (noise filter)
    minimumDifference: 0, // ppm - set higher to filter noise
  },

  /**
   * O2 GENERATION CALCULATION (Photobioreactor)
   *
   * Based on photosynthesis stoichiometry:
   * 6CO2 + 6H2O → C6H12O6 + 6O2
   *
   * Molar ratio: 6 mol CO2 : 6 mol O2 = 1:1
   * Mass ratio: 44.01 g CO2 : 32.00 g O2 = 1.375:1
   *
   * Therefore: O2_generated = CO2_absorbed * (32/44.01) * efficiency
   *
   * To convert O2 grams to Liters:
   * At STP (25°C, 1 atm): 1 mol O2 = 24.45 L
   * 1 mol O2 = 32 g, so 1 g O2 = 24.45/32 = 0.764 L
   *
   * Efficiency factors:
   * - Photobioreactor efficiency (typically 80-95%)
   * - Light availability
   * - Algae/culture health
   */
  o2: {
    molarMass: 32.00, // g/mol
    molarVolume: 24.45, // L/mol at 25°C

    // Stoichiometric ratio (O2 mass / CO2 mass)
    stoichiometricRatio: 32.00 / 44.01, // ≈ 0.727

    // Photobioreactor efficiency (0.0 to 1.0)
    // Adjust based on your system's actual performance
    reactorEfficiency: 0.85, // 85% conversion efficiency

    // Grams to Liters conversion factor
    // L = grams * (molarVolume / molarMass) = grams * 0.764
    gramsToLiters: 24.45 / 32.00, // ≈ 0.764

    // Combined conversion factor: stoichiometric ratio * efficiency
    // O2_grams = CO2_grams * conversionFactor
    get conversionFactor() {
      return this.stoichiometricRatio * this.reactorEfficiency;
    }
  },

  /**
   * RELAY DEFAULT NAMES
   * Customize relay names for your installation
   */
  relayNames: {
    i1: 'Circulation Unit',
    i2: 'Air Dispensing Unit',
    i3: 'Fan Unit 1',
    i4: 'Fan Unit 2',
    i5: 'Water Pump',
    i6: 'UV Sterilizer',
    i7: 'LED Growth Light',
    i8: 'CO2 Injector',
    i9: 'Misting System',
    i10: 'Emergency Vent'
  },

  /**
   * DATA PERSISTENCE SETTINGS
   */
  persistence: {
    // How often to save accumulated values to file (ms)
    saveInterval: 60000, // 1 minute

    // File path for accumulated data
    dataFile: 'accumulated-data.json'
  }
};
