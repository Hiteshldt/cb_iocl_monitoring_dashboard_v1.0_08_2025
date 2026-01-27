/**
 * Report Service
 *
 * Fetches raw data from AWS API and transforms it into a clean CSV
 * with proper column names and applied transformations.
 *
 * Processing steps:
 * 1. Download CSV from AWS (contains raw_json column with sensor data)
 * 2. Parse CSV and extract JSON data
 * 3. Downsample: Keep every Nth row to reduce file size
 * 4. Fix date offset: Device clock is behind by a fixed amount
 * 5. Apply sensor transformations
 * 6. Generate clean CSV with proper column names
 */

const axios = require('axios');
const awsService = require('./aws.service');
const transformVersions = require('./transform-versions');
const logger = require('../utils/logger');

// Downsampling: Keep every Nth row (1 = keep all, 10 = keep every 10th)
const DOWNSAMPLE_FACTOR = 10;

// Fixed date offset: Device clock is behind by this amount
// 17 days, 22 hours, 43 minutes, 10 seconds (in milliseconds)
const DATE_OFFSET_MS = (17 * 24 * 60 * 60 * 1000) + // 17 days
                       (22 * 60 * 60 * 1000) +       // 22 hours
                       (43 * 60 * 1000) +            // 43 minutes
                       (10 * 1000);                  // 10 seconds

// Column name mapping for clean CSV output
const COLUMN_NAMES = {
  // Timestamp
  timestamp: 'Timestamp',

  // Inlet sensors (Outside Device)
  d9: 'Inlet_CO2_ppm',
  d10: 'Inlet_PM25_ugm3',
  d11: 'Inlet_Temperature_C',
  d12: 'Inlet_Humidity_percent',
  d16: 'Inlet_O2_percent',

  // Outlet sensors (Inside Device)
  d1: 'Outlet_CO2_ppm',
  d2: 'Outlet_PM25_ugm3',
  d3: 'Outlet_Temperature_C',
  d4: 'Outlet_Humidity_percent',
  d5: 'Outlet_pH',
  d6: 'Outlet_Water_Level_cm',
  d7: 'Outlet_Water_Temperature_C',
  d8: 'Outlet_O2_percent',

  // Relays (R1-R8) - mapped to physical relay names
  i4: 'R1_Culture_Thermal_System',
  i1: 'R2_Aeration_Pneumatic',
  i2: 'R3_Dehumidity_Fall_Lights',
  i3: 'R4_Photosynthetic_Irradiance',
  i8: 'R5_Branding_Lights',
  i6: 'R7_Media_Circulation',
  i5: 'R6_Chassis_Exhaust',
  i7: 'R8_Relay',
};

// Columns to include in output (in order)
const OUTPUT_COLUMNS = [
  'timestamp',
  // Inlet
  'd9', 'd10', 'd11', 'd12', 'd16',
  // Outlet
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8',
  // Relays (in R1-R8 order)
  'i4', 'i1', 'i2', 'i3', 'i8', 'i6', 'i5', 'i7'
];

class ReportService {

  /**
   * Fetch and process report data
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Object} - { csv: string, filename: string }
   */
  async getProcessedReport(startDate, endDate) {
    try {
      logger.info(`Generating processed report for ${startDate} to ${endDate}`);

      // Step 1: Get download link from AWS
      const reportResponse = await awsService.requestReport(startDate, endDate);

      // Check for download URL in response
      const downloadUrl = reportResponse?.downloadUrl || reportResponse?.url || reportResponse?.link;

      if (!downloadUrl) {
        logger.error('AWS response:', JSON.stringify(reportResponse));
        throw new Error('No download URL received from AWS');
      }

      logger.info(`Got download URL from AWS`);

      // Step 2: Download the raw data (CSV format with raw_json column)
      const rawData = await this.downloadData(downloadUrl);

      // Step 3: Parse CSV to extract JSON data from raw_json column
      const allRows = this.parseCsvWithJson(rawData);

      if (allRows.length === 0) {
        throw new Error('No data found in report');
      }

      logger.info(`Parsed ${allRows.length} rows from AWS data`);

      // Step 4: Downsample - keep every Nth row to reduce file size
      const downsampledRows = this.downsampleData(allRows, DOWNSAMPLE_FACTOR);
      logger.info(`Downsampled to ${downsampledRows.length} rows (factor: ${DOWNSAMPLE_FACTOR})`);

      // Step 5: Fix date offset - device clock is behind by fixed amount
      const dateFixedRows = this.fixDateOffset(downsampledRows);

      // Step 6: Transform each row (apply sensor transformations)
      const transformedRows = dateFixedRows.map(row => this.transformRow(row));

      // Step 7: Generate clean CSV
      const cleanCsv = this.generateCsv(transformedRows);

      // Generate filename
      const filename = `IOCL_XtraO2_Report_${startDate}_to_${endDate}.csv`;

      logger.info(`Report generated: ${filename} with ${transformedRows.length} rows`);

      return {
        csv: cleanCsv,
        filename,
        rowCount: transformedRows.length
      };

    } catch (error) {
      logger.error('Error generating processed report:', error.message);
      throw error;
    }
  }

  /**
   * Download data from URL
   */
  async downloadData(url) {
    try {
      const response = await axios.get(url, {
        timeout: 120000, // 2 minute timeout for large files
        responseType: 'text'
      });
      return response.data;
    } catch (error) {
      logger.error('Error downloading data:', error.message);
      throw new Error('Failed to download report from AWS');
    }
  }

  /**
   * Parse CSV format with raw_json column
   * AWS returns: "deviceId","imei","timestamp","ts","raw_json"
   * The raw_json contains the actual sensor data
   */
  parseCsvWithJson(data) {
    const rows = [];

    try {
      const lines = data.split('\n');

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          // Extract the raw_json column (last column, contains JSON string)
          // CSV format: "deviceId","imei","timestamp","ts","{...json...}"
          // The JSON is wrapped in quotes and may have escaped quotes inside

          // Find the position of the raw_json column (starts after 4th comma)
          const jsonMatch = line.match(/,"\{.*\}"?$/);
          if (!jsonMatch) {
            // Try alternative: find JSON starting with {"
            const altMatch = line.match(/,\{.*\}$/);
            if (altMatch) {
              const jsonStr = altMatch[0].substring(1); // Remove leading comma
              const obj = JSON.parse(jsonStr);
              rows.push(obj);
              continue;
            }
            continue;
          }

          // Extract JSON string, removing surrounding quotes and unescaping
          let jsonStr = jsonMatch[0].substring(2); // Remove leading ,"
          if (jsonStr.endsWith('"')) {
            jsonStr = jsonStr.slice(0, -1); // Remove trailing "
          }

          // Unescape double quotes inside JSON (CSV escaping)
          jsonStr = jsonStr.replace(/""/g, '"');

          const obj = JSON.parse(jsonStr);
          rows.push(obj);

        } catch (parseError) {
          // Try alternative parsing for complex CSV
          try {
            const csvParsed = this.parseComplexCsvLine(line);
            if (csvParsed && csvParsed.raw_json) {
              const obj = JSON.parse(csvParsed.raw_json);
              rows.push(obj);
            }
          } catch (e) {
            // Skip invalid lines silently
          }
        }
      }
    } catch (error) {
      logger.error('Error parsing CSV:', error.message);
    }

    return rows;
  }

  /**
   * Parse a complex CSV line handling quoted fields
   */
  parseComplexCsvLine(line) {
    const result = {};
    const headers = ['deviceId', 'imei', 'timestamp', 'ts', 'raw_json'];
    let currentField = '';
    let fieldIndex = 0;
    let inQuotes = false;
    let i = 0;

    while (i < line.length && fieldIndex < headers.length) {
      const char = line[i];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
        i++;
        continue;
      }

      if (char === '"' && inQuotes) {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }

      if (char === ',' && !inQuotes) {
        result[headers[fieldIndex]] = currentField;
        currentField = '';
        fieldIndex++;
        i++;
        continue;
      }

      currentField += char;
      i++;
    }

    // Add last field
    if (fieldIndex < headers.length) {
      result[headers[fieldIndex]] = currentField;
    }

    return result;
  }

  /**
   * Downsample data by keeping every Nth row
   * This reduces file size significantly while maintaining data trends
   * @param {Array} rows - All parsed rows
   * @param {number} factor - Keep every Nth row (e.g., 10 means keep 1 out of every 10)
   * @returns {Array} - Downsampled rows
   */
  downsampleData(rows, factor = 10) {
    if (factor <= 1) return rows;

    const downsampled = [];
    for (let i = 0; i < rows.length; i += factor) {
      downsampled.push(rows[i]);
    }
    return downsampled;
  }

  /**
   * Fix date offset in the data
   * The device's internal clock is behind by a fixed amount:
   * 17 days, 22 hours, 43 minutes, 10 seconds
   *
   * @param {Array} rows - Parsed rows with 'date' field
   * @returns {Array} - Rows with corrected timestamps
   */
  fixDateOffset(rows) {
    if (rows.length === 0) return rows;

    logger.info(`Applying fixed date offset: +17d 22h 43m 10s`);

    // Apply fixed offset to all rows
    return rows.map(row => {
      const correctedRow = { ...row };

      if (row.date) {
        // Parse device date (format: "2026-01-07,06:47:01")
        const cleaned = row.date.replace(',', 'T');
        const deviceDate = new Date(cleaned);

        if (!isNaN(deviceDate.getTime())) {
          // Add the fixed offset
          const correctedDate = new Date(deviceDate.getTime() + DATE_OFFSET_MS);
          correctedRow._correctedDate = correctedDate;
        }
      } else if (row.ts) {
        const deviceDate = new Date(row.ts * 1000);
        const correctedDate = new Date(deviceDate.getTime() + DATE_OFFSET_MS);
        correctedRow._correctedDate = correctedDate;
      }

      return correctedRow;
    });
  }

  /**
   * Transform a single row of data
   * Applies VERSIONED sensor transformations based on the row's timestamp
   * This ensures historical data uses the formulas that were active at that time
   */
  transformRow(row) {
    const transformed = {};

    // Get the timestamp for this row (corrected date)
    let rowTimestamp;
    if (row._correctedDate) {
      rowTimestamp = row._correctedDate;
      transformed.timestamp = this.formatDate(row._correctedDate);
    } else if (row.date) {
      const cleaned = row.date.replace(',', 'T');
      rowTimestamp = new Date(cleaned);
      transformed.timestamp = this.formatTimestamp(row.date);
    } else if (row.ts) {
      rowTimestamp = new Date(row.ts * 1000);
      transformed.timestamp = this.formatTimestamp(row.ts * 1000);
    } else {
      rowTimestamp = new Date();
      transformed.timestamp = '';
    }

    // Build raw data object for transformation
    const rawData = {};
    for (const key of Object.keys(row)) {
      // Only include d1-d16 and i1-i10
      if (/^d\d+$/.test(key) || /^i\d+$/.test(key)) {
        const numValue = parseFloat(row[key]);
        rawData[key] = isNaN(numValue) ? 0 : numValue;
      }
    }

    // Apply VERSIONED transformations based on the row's timestamp
    // This ensures historical data uses the formulas that were active at that time
    const transformedData = transformVersions.applyVersionedTransforms(rawData, rowTimestamp);

    // Map to output columns
    for (const col of OUTPUT_COLUMNS) {
      if (col === 'timestamp') continue; // Already handled

      // Get transformed value or raw value
      let value = transformedData[col] !== undefined ? transformedData[col] : rawData[col];

      if (value !== undefined && value !== null) {
        if (typeof value === 'number') {
          // Different precision for different sensors
          if (col === 'd5') {
            // pH - 2 decimal places
            transformed[col] = value.toFixed(2);
          } else if (col === 'd6') {
            // Water Level - 1 decimal place
            transformed[col] = value.toFixed(1);
          } else if (col === 'd8' || col === 'd16') {
            // O2 - 1 decimal place
            transformed[col] = value.toFixed(1);
          } else if (col.startsWith('d')) {
            // Other sensors - whole numbers
            transformed[col] = Math.round(value);
          } else if (col.startsWith('i')) {
            // Relays - ON/OFF
            transformed[col] = value === 1 ? 'ON' : 'OFF';
          } else {
            transformed[col] = value;
          }
        } else {
          transformed[col] = value;
        }
      } else {
        transformed[col] = '';
      }
    }

    return transformed;
  }

  /**
   * Format a Date object to readable format
   * @param {Date} date - Date object
   * @returns {string} - Formatted date string DD/MM/YYYY HH:MM:SS
   */
  formatDate(date) {
    if (!date || isNaN(date.getTime())) {
      return '';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Format timestamp to readable format
   * Input can be: "2026-01-04,06:48:27" or Unix timestamp (ms)
   */
  formatTimestamp(rawTimestamp) {
    try {
      let date;

      if (typeof rawTimestamp === 'number') {
        // Unix timestamp (in ms)
        date = new Date(rawTimestamp);
      } else if (typeof rawTimestamp === 'string') {
        // Format: "2026-01-04,06:48:27"
        const cleaned = rawTimestamp.replace(',', ' ');
        date = new Date(cleaned);
      }

      return this.formatDate(date);
    } catch (error) {
      return rawTimestamp;
    }
  }

  /**
   * Generate CSV string from transformed rows
   */
  generateCsv(rows) {
    if (rows.length === 0) return '';

    // Generate header row with clean names
    const headers = OUTPUT_COLUMNS.map(col => COLUMN_NAMES[col] || col);
    const csvLines = [headers.join(',')];

    // Generate data rows
    for (const row of rows) {
      const values = OUTPUT_COLUMNS.map(col => {
        const value = row[col];
        // Escape values with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value !== undefined && value !== null ? value : '';
      });
      csvLines.push(values.join(','));
    }

    return csvLines.join('\n');
  }
}

module.exports = new ReportService();
