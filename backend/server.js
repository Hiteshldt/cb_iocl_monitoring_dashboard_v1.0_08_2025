const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const { PORT } = require('./config/constants');
const logger = require('./utils/logger');
const fileStorage = require('./utils/fileStorage');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

// Services
const pollingService = require('./services/polling.service');
const automationService = require('./services/automation.service');
const displayService = require('./services/display.service');
const cacheService = require('./services/cache.service');
const calculationsService = require('./services/calculations.service');

// Routes
const authRoutes = require('./routes/auth.routes');
const deviceRoutes = require('./routes/device.routes');
const relayRoutes = require('./routes/relay.routes');
const automationRoutes = require('./routes/automation.routes');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io globally available
global.io = io;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/relay', relayRoutes);
app.use('/api/automation', automationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      polling: pollingService.getStatus(),
      automation: automationService.getStatus(),
      display: displayService.getStatus(),
      device: cacheService.getDeviceStatus()
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Send current processed data immediately
  const processedData = cacheService.getProcessedData();
  if (processedData) {
    socket.emit('deviceUpdate', processedData);
  } else {
    const currentData = cacheService.getLatestData();
    if (currentData) {
      socket.emit('deviceUpdate', currentData);
    }
  }

  // Send device status
  socket.emit('deviceStatus', cacheService.getDeviceStatus());

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Initialize and start server
async function startServer() {
  try {
    logger.info('='.repeat(50));
    logger.info('IOCL Air Quality Control System');
    logger.info('='.repeat(50));

    // Initialize storage
    logger.info('Initializing file storage...');
    await fileStorage.initializeStorage();

    // Load persisted data
    logger.info('Loading persisted data...');
    await cacheService.loadPersistedData();

    // Initialize calculations service
    logger.info('Initializing calculations service...');
    calculationsService.init();

    // Start background services
    logger.info('Starting background services...');

    // Start data polling (every 30 seconds)
    pollingService.start();

    // Start automation engine
    await automationService.start();

    // Start display update service (every 10 seconds)
    await displayService.start();

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info('='.repeat(50));
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info('='.repeat(50));
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  logger.info('Shutting down gracefully...');

  // Stop background services
  pollingService.stop();
  automationService.stop();
  displayService.stop();

  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
}

// Start the server
startServer();
