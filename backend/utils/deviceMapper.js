const { ACTUAL_DEVICE_ID, DISPLAY_DEVICE_ID } = require('../config/constants');

/**
 * Transform device data from actual device ID to display device ID
 */
const transformDeviceData = (data) => {
  if (!data) return data;

  // If it's an array, transform each item
  if (Array.isArray(data)) {
    return data.map(item => transformDeviceData(item));
  }

  // If it's an object, replace device IDs
  if (typeof data === 'object') {
    const transformed = { ...data };

    if (transformed.deviceId === ACTUAL_DEVICE_ID) {
      transformed.deviceId = DISPLAY_DEVICE_ID;
    }

    if (transformed.d === ACTUAL_DEVICE_ID) {
      transformed.d = DISPLAY_DEVICE_ID;
    }

    return transformed;
  }

  return data;
};

/**
 * Get actual device ID for API calls
 */
const getActualDeviceId = () => ACTUAL_DEVICE_ID;

/**
 * Get display device ID for frontend
 */
const getDisplayDeviceId = () => DISPLAY_DEVICE_ID;

module.exports = {
  transformDeviceData,
  getActualDeviceId,
  getDisplayDeviceId
};
