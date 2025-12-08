require('dotenv').config();

module.exports = {
  // Server
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // AWS
  AWS_API_BASE_URL: process.env.AWS_API_BASE_URL,

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
  DATA_POLL_INTERVAL: parseInt(process.env.DATA_POLL_INTERVAL || '30000'),
  DISPLAY_UPDATE_INTERVAL: parseInt(process.env.DISPLAY_UPDATE_INTERVAL || '10000'),

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

  // Relay Labels
  RELAY_LABELS: {
    i1: 'Relay 1',
    i2: 'Relay 2',
    i3: 'Relay 3',
    i4: 'Relay 4',
    i5: 'Relay 5',
    i6: 'Relay 6',
    i7: 'Relay 7',
    i8: 'Relay 8',
    i9: 'Relay 9',
    i10: 'Relay 10'
  }
};
