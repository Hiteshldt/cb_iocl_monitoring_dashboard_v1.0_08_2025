# IOCL Air Quality Control System - Complete Documentation

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Data Flow](#3-data-flow)
4. [Folder Structure](#4-folder-structure)
5. [Backend Services](#5-backend-services)
6. [Frontend Components](#6-frontend-components)
7. [API Endpoints](#7-api-endpoints)
8. [Configuration Files](#8-configuration-files)
9. [Data Transformer Guide](#9-data-transformer-guide)
10. [Sensor & Relay Reference](#10-sensor--relay-reference)
11. [Environment Setup](#11-environment-setup)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Project Overview

### What is this system?
The **IOCL Air Quality Control System** is a real-time monitoring and control dashboard for an air quality management device (Photobioreactor). It:

- Monitors air quality sensors (CO2, Temperature, Humidity, Dust PM, Water pH, etc.)
- Controls 10 relays (pumps, fans, UV sterilizers, etc.)
- Calculates AQI (Air Quality Index)
- Tracks CO2 absorption and O2 generation
- Displays data on an LED screen attached to the device
- Allows automation rules (turn relay ON/OFF based on sensor values or time)

### Key Components
| Component | Purpose |
|-----------|---------|
| **Physical Device** | Hardware device with sensors and relays (Device ID: BTTE1250001) |
| **AWS Cloud** | Stores device data, provides WebSocket for real-time updates |
| **Backend Server** | Node.js server that connects to AWS, processes data, serves frontend |
| **Frontend Dashboard** | React web application for monitoring and control |
| **LED Display** | Physical display on device showing AQI, temperature, time |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHYSICAL DEVICE                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Sensors   │    │   Relays    │    │ LED Display │    │  GSM Module │  │
│  │  d1 - d40   │    │  i1 - i10   │    │  i11 - i18  │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘  │
└──────────────────────────────────────────────────────────────────┼──────────┘
                                                                   │
                                                          (GSM/Internet)
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                AWS CLOUD                                     │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────────┐ │
│  │     REST API (Lambda)       │    │        WebSocket API Gateway        │ │
│  │  - Send commands            │    │  - Real-time data push              │ │
│  │  - Get historical data      │    │  - Subscribe to device              │ │
│  │  - Generate reports         │    │  URL: wss://ztw46d04q3...           │ │
│  └─────────────────────────────┘    └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┬──────────┘
                                                                   │
                                                        (WebSocket + REST)
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND SERVER                                    │
│                          (Node.js - Port 3001)                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ AWS WebSocket    │  │ Data Transformer │  │ Calculations Service     │  │
│  │ Service          │─▶│ Service          │─▶│ (AQI, CO2, O2)           │  │
│  │ (Real-time data) │  │ (Modify values)  │  │                          │  │
│  └──────────────────┘  └──────────────────┘  └───────────┬──────────────┘  │
│                                                          │                  │
│  ┌──────────────────┐  ┌──────────────────┐              ▼                  │
│  │ Automation       │  │ Display Service  │◀───┌──────────────────┐        │
│  │ Service          │◀─│ (LED updates)    │    │  Cache Service   │        │
│  │ (Relay rules)    │  └──────────────────┘    │  (Central store) │        │
│  └──────────────────┘                          └────────┬─────────┘        │
│                                                          │                  │
│  ┌──────────────────────────────────────────────────────┼───────────────┐  │
│  │                     Socket.IO Server                  │               │  │
│  │                (Real-time updates to frontend)        │               │  │
│  └───────────────────────────────────────────────────────┼───────────────┘  │
└──────────────────────────────────────────────────────────┼──────────────────┘
                                                           │
                                                    (Socket.IO + REST)
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND DASHBOARD                                 │
│                         (React - Port 5173/3000)                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Overview Tab   │  │   Sensors Tab   │  │      Relay Control Tab      │  │
│  │  - AQI display  │  │  - All sensors  │  │  - Toggle relays            │  │
│  │  - CO2/O2 stats │  │  - Inlet/Outlet │  │  - Automation rules         │  │
│  │  - Charts       │  │  - Water data   │  │  - Sensor/Time triggers     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Additional Tab                                    ││
│  │  - Download CSV reports    - Enable/Disable LED display updates         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 Real-Time Data Flow (Sensor Data)

```
AWS WebSocket
    │
    │  (Raw sensor data: d1, d2, d3, ... d40, i1, i2, ... i10)
    ▼
┌─────────────────────────────────────────┐
│     aws-websocket.service.js            │
│     - Receives data every ~10-15 sec    │
│     - Calls data transformer            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│     data-transformer.service.js         │  ◀── EDIT THIS FILE TO MODIFY VALUES
│     - Applies transformations           │
│     - Offset, scale, custom formulas    │
└─────────────────┬───────────────────────┘
                  │
                  │  (Transformed data)
                  ▼
┌─────────────────────────────────────────┐
│     calculations.service.js             │
│     - Calculates AQI                    │
│     - Calculates CO2 absorbed           │
│     - Calculates O2 generated           │
└─────────────────┬───────────────────────┘
                  │
                  │  (Processed data with calculations)
                  ▼
┌─────────────────────────────────────────┐
│     cache.service.js                    │
│     - Stores latest data                │
│     - Tracks online/offline status      │
│     - Persists to file                  │
└─────────────────┬───────────────────────┘
                  │
       ┌──────────┼──────────┬────────────────┐
       │          │          │                │
       ▼          ▼          ▼                ▼
   Frontend   Automation   Display        Relay
   (Socket.IO) Service     Service        Verification
```

### 3.2 Relay Control Flow

```
User clicks "Turn ON" button
    │
    ▼
Frontend sends POST /api/relay/control
    │
    ▼
relay.service.js
    │
    ├── Stores desired state in memory
    │
    ▼
aws.service.js → AWS REST API → Physical Device
    │
    │  (Device receives command, changes relay)
    │
    ▼
AWS WebSocket pushes new data with updated relay state
    │
    ▼
relay.service.js verifies relay state matches
    │
    ├── If matches: emit 'relayConfirmed' to frontend
    │
    └── If NOT matches: retry up to 3 times
            │
            └── If still fails: emit 'relayFailed' to frontend
```

### 3.3 LED Display Flow

```
display.service.js (runs every 10 seconds when enabled)
    │
    ▼
Gets processed data from cache.service.js
    │
    ▼
data-transformer.service.js.getDisplayValues()  ◀── Configure what shows on LED
    │
    ├── i11: AQI value
    ├── i12: Temperature
    ├── i13: Humidity
    ├── i14: Hour
    ├── i15: Minute
    ├── i16: Day
    ├── i17: Month
    └── i18: Year (last 2 digits)
    │
    ▼
aws.service.js → AWS REST API → Device LED Display
```

---

## 4. Folder Structure

```
Cabrelim_IOCL_Device/
│
├── backend/                          # Node.js Backend Server
│   ├── config/
│   │   ├── constants.js              # Environment variables, sensor labels
│   │   └── formulas.config.js        # AQI, CO2, O2 calculation formulas
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js        # JWT token verification
│   │   └── error.middleware.js       # Error handling
│   │
│   ├── routes/
│   │   ├── auth.routes.js            # Login endpoint
│   │   ├── automation.routes.js      # Automation rules CRUD
│   │   ├── device.routes.js          # Device data, history, reports
│   │   └── relay.routes.js           # Relay control
│   │
│   ├── services/
│   │   ├── aws.service.js            # AWS REST API calls (commands, reports)
│   │   ├── aws-websocket.service.js  # AWS WebSocket connection (real-time data)
│   │   ├── automation.service.js     # Automation rule evaluation
│   │   ├── cache.service.js          # In-memory data store
│   │   ├── calculations.service.js   # AQI, CO2, O2 calculations
│   │   ├── data-transformer.service.js # ★ Data transformation layer
│   │   ├── display.service.js        # LED display updates
│   │   └── relay.service.js          # Relay control with verification
│   │
│   ├── utils/
│   │   ├── deviceMapper.js           # Device ID mapping
│   │   ├── fileStorage.js            # File persistence
│   │   └── logger.js                 # Console logging
│   │
│   ├── data/                         # Persisted data files
│   │   ├── accumulated-data.json     # CO2/O2 totals
│   │   ├── automation-rules.json     # Saved automation rules
│   │   ├── display-settings.json     # Display enabled/disabled
│   │   └── last-data.json            # Last received sensor data
│   │
│   ├── server.js                     # Main entry point
│   ├── package.json
│   └── .env                          # Environment variables
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── OfflineBanner.jsx     # Offline warning banner
│   │   │   ├── OverviewDashboard.jsx # Main dashboard view
│   │   │   ├── RelayControl.jsx      # Relay toggle & automation
│   │   │   └── SensorDisplay.jsx     # Sensor data display
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # Authentication state
│   │   │   └── ThemeContext.jsx      # Dark/light theme
│   │   │
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx     # Main dashboard page
│   │   │   └── LoginPage.jsx         # Login page
│   │   │
│   │   ├── services/
│   │   │   ├── api.js                # REST API calls
│   │   │   └── socket.js             # Socket.IO connection
│   │   │
│   │   ├── App.jsx                   # App router
│   │   └── main.jsx                  # Entry point
│   │
│   ├── package.json
│   └── .env                          # Frontend environment
│
└── DOCUMENTATION.md                  # This file
```

---

## 5. Backend Services

### 5.1 aws-websocket.service.js
**Purpose:** Connects to AWS WebSocket to receive real-time sensor data.

- Maintains persistent WebSocket connection
- Auto-reconnects on disconnection (up to 10 attempts)
- Subscribes to device ID on connect
- Passes data through transformer before caching

**Key Methods:**
- `start()` - Initiate WebSocket connection
- `subscribe()` - Subscribe to device data
- `processDeviceData(data)` - Transform and cache incoming data

### 5.2 data-transformer.service.js ★
**Purpose:** Central place to modify all sensor values before they reach the frontend.

See [Section 9: Data Transformer Guide](#9-data-transformer-guide) for detailed instructions.

### 5.3 calculations.service.js
**Purpose:** Performs all environmental calculations.

- **AQI Calculation:** Weighted average of CO2, PM, Temperature, Humidity
- **CO2 Absorption:** Tracks grams of CO2 absorbed (inlet - outlet difference)
- **O2 Generation:** Calculates liters of O2 produced (photosynthesis ratio)

**Formulas are configurable in:** `config/formulas.config.js`

### 5.4 cache.service.js
**Purpose:** Central data store for the application.

- Stores latest sensor data (already transformed)
- Tracks device online/offline status
- Persists data to file for recovery after restart
- Other services read from here

### 5.5 automation.service.js
**Purpose:** Evaluates automation rules and controls relays.

**Rule Types:**
1. **Sensor Mode:** Turn relay ON/OFF based on sensor value
   - Example: "Turn ON pump when temperature > 30"
2. **Time Mode:** Turn relay ON/OFF based on schedule
   - Example: "Turn ON lights from 08:00 to 18:00"
3. **Manual Mode:** No automation, user controls manually

**Rules are stored in:** `data/automation-rules.json`

### 5.6 relay.service.js
**Purpose:** Controls relays with verification.

- Sends relay commands to AWS
- Stores desired state in memory
- Verifies actual state matches desired state
- Auto-retries up to 3 times if mismatch
- Emits `relayConfirmed` or `relayFailed` events

### 5.7 display.service.js
**Purpose:** Updates the LED display on the physical device.

- Runs every 10 seconds (when enabled)
- Sends: AQI, Temperature, Humidity, Date, Time
- Uses data-transformer for value configuration

### 5.8 aws.service.js
**Purpose:** REST API calls to AWS (commands only, not data polling).

- `sendCommand(data)` - Send relay/display commands
- `requestReport(startDate, endDate)` - Request CSV report
- `getHourlyGraphData()` - Get historical data for charts

---

## 6. Frontend Components

### 6.1 DashboardPage.jsx
Main page with 4 tabs:

| Tab | Description |
|-----|-------------|
| **Overview** | AQI gauge, CO2/O2 stats, mini sensor readings |
| **Sensors** | Detailed view of all sensors (inlet, outlet, water) |
| **Relay Control** | Toggle relays, configure automation rules |
| **Additional** | Download reports, enable/disable LED display |

### 6.2 OverviewDashboard.jsx
- Large AQI display with color coding
- CO2 absorbed (grams) and O2 generated (liters)
- Quick sensor summary cards

### 6.3 SensorDisplay.jsx
- Organized by category: Inlet, Outlet, Water, System
- Shows all d1-d40 values with labels

### 6.4 RelayControl.jsx
- 10 relay toggle buttons
- Click settings icon to configure automation
- Shows mode (Manual/Sensor/Timer)
- Pending state with spinner during relay change

---

## 7. API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with deviceId + password |

### Device Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/device/current` | Get current sensor data |
| GET | `/api/device/status` | Get online/offline status |
| GET | `/api/device/history/hour` | Get last hour data (charts) |
| GET | `/api/device/history/day` | Get last day data (charts) |
| GET | `/api/device/history/week` | Get last week data (charts) |
| GET | `/api/device/report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | Download CSV report |

### Relay Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/relay/control` | Control a relay `{relay: "i1", state: 1}` |
| GET | `/api/relay/states` | Get all relay states |

### Automation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/rules` | Get all rules |
| POST | `/api/automation/rules` | Create/update rule |
| DELETE | `/api/automation/rules/:id` | Delete rule |

### Display
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/device/display` | Get display service status |
| PUT | `/api/device/display` | Enable/disable `{enabled: true}` |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/device/airflow` | Get airflow rate setting |
| PUT | `/api/device/airflow` | Update airflow rate |
| GET | `/api/device/accumulated` | Get CO2/O2 totals |
| POST | `/api/device/accumulated/reset` | Reset CO2/O2 totals |

---

## 8. Configuration Files

### 8.1 backend/.env
```env
# Server
PORT=3001
NODE_ENV=development

# AWS
AWS_API_BASE_URL=https://your-api-gateway.amazonaws.com/production
AWS_WEBSOCKET_URL=wss://ztw46d04q3.execute-api.us-east-1.amazonaws.com/production

# Device
ACTUAL_DEVICE_ID=BTTE1250001
DISPLAY_DEVICE_ID=IOCL_XTRA_O2_ADMIN

# Auth
JWT_SECRET=your-secret-key
ADMIN_PASSWORD=your-admin-password

# Intervals
DISPLAY_UPDATE_INTERVAL=10000
```

### 8.2 config/constants.js
Contains:
- Sensor labels (d1-d40)
- Relay labels (i1-i10)
- Default values

### 8.3 config/formulas.config.js
Contains:
- AQI breakpoints and weights
- CO2 absorption formula constants
- O2 generation formula constants
- Relay default names

---

## 9. Data Transformer Guide

### What is the Data Transformer?
The Data Transformer is a **single file** where you can modify sensor values BEFORE they reach the frontend. Any changes here affect:
- What the dashboard displays
- What automation rules evaluate
- What the LED display shows

### File Location
```
backend/services/data-transformer.service.js
```

### How to Add a Transformation

#### Step 1: Open the file
Open `backend/services/data-transformer.service.js` in any text editor.

#### Step 2: Find the SENSOR_TRANSFORMS section
Look for this section near the top of the file:

```javascript
const SENSOR_TRANSFORMS = {
  // Your transformations go here
};
```

#### Step 3: Add your transformation
Add a line for each sensor you want to modify:

```javascript
const SENSOR_TRANSFORMS = {
  d1: { type: 'offset', value: 5 },      // Add 5 to Inlet CO2
  d3: { type: 'scale', value: 1.1 },     // Multiply Inlet Temp by 1.1
  d8: { type: 'round', decimals: 1 },    // Round Outlet CO2 to 1 decimal
};
```

#### Step 4: Restart the server
Stop and restart the backend server for changes to take effect:
```bash
cd backend
node server.js
```

### Available Transformation Types

#### 1. `offset` - Add or subtract a fixed value
```javascript
d1: { type: 'offset', value: 10 }     // Add 10
d3: { type: 'offset', value: -5 }     // Subtract 5
```

#### 2. `scale` - Multiply by a factor
```javascript
d1: { type: 'scale', value: 1.5 }     // Multiply by 1.5 (50% increase)
d2: { type: 'scale', value: 0.8 }     // Multiply by 0.8 (20% decrease)
```

#### 3. `calibrate` - Offset first, then scale
```javascript
d1: { type: 'calibrate', offset: 2, scale: 1.05 }
// Result: (originalValue + 2) * 1.05
```

#### 4. `round` - Round to decimal places
```javascript
d3: { type: 'round', decimals: 0 }    // Round to whole number
d4: { type: 'round', decimals: 2 }    // Round to 2 decimal places
```

#### 5. `clamp` - Limit to a range
```javascript
d1: { type: 'clamp', min: 0, max: 1000 }
// If value < 0, returns 0
// If value > 1000, returns 1000
```

#### 6. `formula` - Custom JavaScript function
```javascript
d8: {
  type: 'formula',
  fn: (value, allData) => {
    // 'value' is the current sensor value (d8)
    // 'allData' contains all sensor values
    return value * 0.9 + allData.d1 * 0.01;
  }
}
```

#### 7. `chain` - Apply multiple transformations in order
```javascript
d3: {
  type: 'chain',
  transforms: [
    { type: 'offset', value: -2 },
    { type: 'scale', value: 1.1 },
    { type: 'round', decimals: 1 }
  ]
}
// First subtracts 2, then multiplies by 1.1, then rounds to 1 decimal
```

### Example Configurations

#### Example 1: Sensor Calibration
Your temperature sensor reads 2 degrees too high:
```javascript
const SENSOR_TRANSFORMS = {
  d3: { type: 'offset', value: -2 },   // Inlet Temperature correction
  d10: { type: 'offset', value: -2 },  // Outlet Temperature correction
};
```

#### Example 2: Scale CO2 Values
Your CO2 sensor needs 10% adjustment:
```javascript
const SENSOR_TRANSFORMS = {
  d1: { type: 'scale', value: 1.1 },   // Inlet CO2 +10%
  d8: { type: 'scale', value: 1.1 },   // Outlet CO2 +10%
};
```

#### Example 3: Complex Calibration
Temperature needs offset and rounding:
```javascript
const SENSOR_TRANSFORMS = {
  d3: {
    type: 'chain',
    transforms: [
      { type: 'offset', value: -1.5 },
      { type: 'round', decimals: 1 }
    ]
  },
};
```

#### Example 4: Custom Formula
Humidity depends on temperature:
```javascript
const SENSOR_TRANSFORMS = {
  d4: {
    type: 'formula',
    fn: (humidity, allData) => {
      // Adjust humidity based on temperature
      const temp = allData.d3;
      if (temp > 30) {
        return humidity * 0.95;  // Reduce by 5% when hot
      }
      return humidity;
    }
  },
};
```

### Configuring LED Display Values

The LED display shows 8 values (i11-i18). You can customize what each slot shows:

Find the `DISPLAY_TRANSFORMS` section in the same file:

```javascript
const DISPLAY_TRANSFORMS = {
  // Default: i11 = AQI, i12 = Temp, i13 = Humidity, i14-i18 = DateTime

  // Override example:
  i11: {
    source: 'd1',  // Show Inlet CO2 instead of AQI
    transform: { type: 'round', decimals: 0 }
  },

  i12: {
    source: 'custom',
    formula: (data) => Math.round(data.d3 + data.d10) / 2  // Average of both temps
  },
};
```

---

## 10. Sensor & Relay Reference

### Sensors (d1 - d40)

| ID | Label | Unit | Description |
|----|-------|------|-------------|
| d1 | Inlet-CO₂ | ppm | CO2 concentration at inlet |
| d2 | Inlet-Dust PM | µg/m³ | Particulate matter at inlet |
| d3 | Inlet-Temperature | °C | Air temperature at inlet |
| d4 | Inlet-Humidity | % | Relative humidity at inlet |
| d5 | Inlet-Water pH | pH | Water acidity at inlet |
| d6 | Inlet-Water Level | - | Water level sensor at inlet |
| d7 | Inlet-Water Temp | °C | Water temperature at inlet |
| d8 | Outlet-CO₂ | ppm | CO2 concentration at outlet |
| d9 | Outlet-Dust PM | µg/m³ | Particulate matter at outlet |
| d10 | Outlet-Temperature | °C | Air temperature at outlet |
| d11 | Outlet-Humidity | % | Relative humidity at outlet |
| d12 | Outlet-Water pH | pH | Water acidity at outlet |
| d13 | Outlet-Water Level | - | Water level sensor at outlet |
| d14 | Outlet-Water Temp | °C | Water temperature at outlet |
| d15 | SW Ver | - | Software version |
| d16 | HW Ver | - | Hardware version |
| d38 | GSM Signal | - | GSM signal strength |

### Relays (i1 - i10)

| ID | Default Name | Purpose |
|----|--------------|---------|
| i1 | Circulation Unit | Air circulation system |
| i2 | Air Dispensing Unit | Air distribution |
| i3 | Fan Unit 1 | Cooling/ventilation |
| i4 | Fan Unit 2 | Cooling/ventilation |
| i5 | Water Pump | Water circulation |
| i6 | UV Sterilizer | Water/air sterilization |
| i7 | LED Growth Light | Algae growth lights |
| i8 | CO2 Injector | CO2 injection system |
| i9 | Misting System | Humidity control |
| i10 | Emergency Vent | Emergency ventilation |

### LED Display Slots (i11 - i18)

| ID | Default Value |
|----|---------------|
| i11 | AQI (calculated) |
| i12 | Temperature (d10) |
| i13 | Humidity (d11) |
| i14 | Hour (current time) |
| i15 | Minute (current time) |
| i16 | Day (current date) |
| i17 | Month (current date) |
| i18 | Year (last 2 digits) |

---

## 11. Environment Setup

### Prerequisites
- Node.js 18 or higher
- npm (comes with Node.js)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env  # Create .env and fill in values
node server.js
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Running Both Together
Terminal 1:
```bash
cd backend && node server.js
```

Terminal 2:
```bash
cd frontend && npm run dev
```

### Default Login
- **Device ID:** BTTE1250001 (or as configured in .env)
- **Password:** (as set in ADMIN_PASSWORD in .env)

---

## 12. Troubleshooting

### Problem: Dashboard shows "Connecting..." or "Offline"

**Possible causes:**
1. Backend server not running
2. AWS WebSocket disconnected
3. Device is actually offline

**Solution:**
1. Check if backend is running: `curl http://localhost:3001/health`
2. Check server logs for WebSocket errors
3. Verify AWS_WEBSOCKET_URL in .env is correct

### Problem: Relay not changing

**Possible causes:**
1. Device is offline (check status indicator)
2. AWS API error
3. Network timeout

**Solution:**
1. Wait 30 seconds - the system auto-retries
2. Check for "relayFailed" alert
3. Check server logs for API errors

### Problem: Data not updating

**Possible causes:**
1. WebSocket disconnected
2. Device stopped sending data

**Solution:**
1. Check health endpoint: `/health` - look for `awsWebSocket.isConnected`
2. Server will auto-reconnect within 5-60 seconds
3. Check device GSM signal strength (d38)

### Problem: Transformation not working

**Solution:**
1. Make sure you saved the file
2. Restart the backend server
3. Check server console for errors
4. Verify sensor ID is correct (d1, not D1)

### Problem: Port already in use

```bash
# Windows
netstat -ano | findstr :3001
taskkill /F /PID <PID_NUMBER>

# Linux/Mac
lsof -i :3001
kill -9 <PID_NUMBER>
```

### Checking Server Health
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "awsWebSocket": { "isConnected": true },
    "automation": { "isRunning": true, "rulesCount": 10 },
    "display": { "isRunning": true, "enabled": true },
    "device": { "online": true }
  }
}
```

---

## Quick Reference

### Common Tasks

| Task | How to do it |
|------|--------------|
| Start backend | `cd backend && node server.js` |
| Start frontend | `cd frontend && npm run dev` |
| Check server health | `curl http://localhost:3001/health` |
| Modify sensor values | Edit `backend/services/data-transformer.service.js` |
| Change AQI formula | Edit `backend/config/formulas.config.js` |
| Add automation rule | Use UI: Relay Control → Click settings icon on relay |
| Download report | Use UI: Additional tab → Select dates → Download |
| Enable LED display | Use UI: Additional tab → Click Enable button |

### Key Files

| Purpose | File |
|---------|------|
| Modify sensor values | `backend/services/data-transformer.service.js` |
| AQI/CO2/O2 formulas | `backend/config/formulas.config.js` |
| Environment config | `backend/.env` |
| Sensor/Relay labels | `backend/config/constants.js` |
| Main server | `backend/server.js` |
| Main dashboard | `frontend/src/pages/DashboardPage.jsx` |

---

*Last updated: December 2024*
*System Version: 1.0*
