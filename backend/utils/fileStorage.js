const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const STORAGE_DIR = path.join(__dirname, '../storage');

/**
 * Ensure storage directory exists
 */
const ensureStorageDir = async () => {
  try {
    await fs.access(STORAGE_DIR);
  } catch (error) {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    logger.info('Storage directory created');
  }
};

/**
 * Read JSON file
 */
const readJSON = async (filename) => {
  try {
    await ensureStorageDir();
    const filePath = path.join(STORAGE_DIR, filename);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    logger.error(`Error reading file ${filename}:`, error);
    throw error;
  }
};

/**
 * Write JSON file
 */
const writeJSON = async (filename, data) => {
  try {
    await ensureStorageDir();
    const filePath = path.join(STORAGE_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    logger.debug(`File written: ${filename}`);
  } catch (error) {
    logger.error(`Error writing file ${filename}:`, error);
    throw error;
  }
};

/**
 * Initialize default files if they don't exist
 */
const initializeStorage = async () => {
  try {
    await ensureStorageDir();

    // Initialize automation rules
    const rulesExists = await readJSON('automation-rules.json');
    if (!rulesExists) {
      await writeJSON('automation-rules.json', { rules: [] });
      logger.info('Initialized automation-rules.json');
    }

    // Initialize relay states
    const statesExists = await readJSON('relay-states.json');
    if (!statesExists) {
      const defaultStates = {
        i1: 0, i2: 0, i3: 0, i4: 0, i5: 0,
        i6: 0, i7: 0, i8: 0, i9: 0, i10: 0
      };
      await writeJSON('relay-states.json', defaultStates);
      logger.info('Initialized relay-states.json');
    }

    // Initialize last data
    const lastDataExists = await readJSON('last-data.json');
    if (!lastDataExists) {
      await writeJSON('last-data.json', { data: null, timestamp: null });
      logger.info('Initialized last-data.json');
    }

    // Initialize display settings
    const displaySettingsExists = await readJSON('display-settings.json');
    if (!displaySettingsExists) {
      await writeJSON('display-settings.json', { enabled: true });
      logger.info('Initialized display-settings.json');
    }

    logger.info('Storage initialization complete');
  } catch (error) {
    logger.error('Storage initialization failed:', error);
    throw error;
  }
};

module.exports = {
  readJSON,
  writeJSON,
  initializeStorage
};
