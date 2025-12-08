const logger = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO]`, message, data || '');
  },

  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR]`, message, error || '');
  },

  warn: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN]`, message, data || '');
  },

  debug: (message, data = null) => {
    const timestamp = new Date().toISOString();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${timestamp}] [DEBUG]`, message, data || '');
    }
  }
};

module.exports = logger;
