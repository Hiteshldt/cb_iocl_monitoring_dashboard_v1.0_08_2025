# IOCL Backend Server

Express.js backend server for IOCL Air Quality Control System.

## Features

- ✅ JWT Authentication
- ✅ Data Polling (every 30s from AWS)
- ✅ Relay Control (manual + automated)
- ✅ Automation Engine (sensor-based & time-based)
- ✅ Display Update Service (every 10s)
- ✅ Real-time Socket.IO updates
- ✅ File-based persistence (no database)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure `.env` file (already created)

3. Start server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token

### Device Data
- `GET /api/device/current` - Get current device data
- `GET /api/device/status` - Get device online/offline status
- `GET /api/device/history/hour` - Get hourly data
- `GET /api/device/history/day` - Get daily data
- `GET /api/device/history/week` - Get weekly data

### Relay Control
- `POST /api/relay/control` - Control relay (manual)
- `GET /api/relay/states` - Get all relay states

### Automation
- `GET /api/automation/rules` - Get all automation rules
- `POST /api/automation/rules` - Add/update automation rule
- `DELETE /api/automation/rules/:id` - Delete automation rule
- `GET /api/automation/status` - Get automation engine status

### Health Check
- `GET /health` - Server health check

## Background Services

All these run 24/7:

1. **Data Polling** - Fetches data from AWS every 30s
2. **Automation Engine** - Evaluates rules every 10s
3. **Display Update** - Sends display data every 10s

## Socket.IO Events

- `deviceUpdate` - Real-time device data updates
- `deviceStatus` - Device online/offline status
- `automationTriggered` - Automation rule triggered event
