require('dotenv').config();

module.exports = {
  // Server
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // AWS
  AWS_API_BASE_URL: process.env.AWS_API_BASE_URL,
  AWS_WEBSOCKET_URL: process.env.AWS_WEBSOCKET_URL || 'wss://ztw46d04q3.execute-api.us-east-1.amazonaws.com/production',

  // Device
  ACTUAL_DEVICE_ID: process.env.ACTUAL_DEVICE_ID || 'BTTE1250002',
  DISPLAY_DEVICE_ID: process.env.DISPLAY_DEVICE_ID || 'IOCL_XTRA_O2_ADMIN',
  DEVICE_IMEI: process.env.DEVICE_IMEI || '000000000000000',
  DEVICE_METER: parseInt(process.env.DEVICE_METER || '2'),

  // Auth
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,

  // Intervals
  DISPLAY_UPDATE_INTERVAL: parseInt(process.env.DISPLAY_UPDATE_INTERVAL || '10000'),

  // ============================================================================
  // FEATURE TOGGLES
  // Set to true/false to enable/disable features for frontend
  // ============================================================================
  FEATURES: {
    ENABLE_DATA_DOWNLOAD: false,  // Set to true to enable CSV report download in frontend
  },

  // ============================================================================
  // RELAY MAPPING
  // Maps physical relay labels (R1, R2, etc.) to device relay IDs (i1, i2, etc.)
  // Only 8 relays are mapped (R1-R8), i9 and i10 are not connected
  //
  // Physical Panel  →  Device ID
  // R1              →  i4
  // R2              →  i1
  // R3              →  i2
  // R4              →  i3
  // R5              →  i8
  // R6              →  i5
  // R7              →  i6
  // R8              →  i7
  // ============================================================================
  RELAY_MAPPING: {
    'R1': 'i4',
    'R2': 'i1',
    'R3': 'i2',
    'R4': 'i3',
    'R5': 'i8',
    'R6': 'i5',
    'R7': 'i6',
    'R8': 'i7',
  },

  // Active relay IDs (only these are shown in the frontend)
  ACTIVE_RELAYS: ['i4', 'i1', 'i2', 'i3', 'i8', 'i5', 'i6', 'i7'],

  // Sensor Labels
  SENSOR_LABELS: {
    d1: 'Inlet-CO₂',
    d2: 'Inlet-Dust PM',
    d3: 'Inlet-Temperature',
    d4: 'Inlet-Humidity',
    d5: 'Inlet-Water PH',
    d6: 'Inlet-Water Level',
    d7: 'Inlet-Water Temp',
    d8: 'Outlet-CO₂',
    d9: 'Outlet-Dust PM',
    d10: 'Outlet-Temperature',
    d11: 'Outlet-Humidity',
    d12: 'Outlet-Water PH',
    d13: 'Outlet-Water Level',
    d14: 'Outlet-Water Temp',
    d15: 'SW Ver',
    d16: 'HW Ver',
    d17: 'Additional-1',
    d18: 'Additional-2',
    d38: 'GSM Signal Strength',
    d39: 'Additional-3',
    d40: 'Additional-4'
  },

  // Relay Labels - Updated to show physical relay names (R1-R8)
  // Key is device ID, value is the label shown in UI
  RELAY_LABELS: {
    i4: 'R1',  // Device i4 = Physical R1
    i1: 'R2',  // Device i1 = Physical R2
    i2: 'R3',  // Device i2 = Physical R3
    i3: 'R4',  // Device i3 = Physical R4
    i8: 'R5',  // Device i8 = Physical R5
    i5: 'R6',  // Device i5 = Physical R6
    i6: 'R7',  // Device i6 = Physical R7
    i7: 'R8',  // Device i7 = Physical R8
  }
};
