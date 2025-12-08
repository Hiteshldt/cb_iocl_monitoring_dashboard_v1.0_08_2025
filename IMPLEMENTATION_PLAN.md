# IOCL Custom Server - Implementation Plan
**Project:** Corporate Monitoring Dashboard for Air Quality Control System
**Date:** December 8, 2025

---

## 1. PROJECT OVERVIEW

### 1.1 Purpose
Build a corporate monitoring dashboard to manage and monitor an air quality control device (BTTE1250002) with masked identity (IOCL_XTRA_O2_ADMIN) for IOCL operations.

### 1.2 Technology Stack
- **Backend:** Express.js (Node.js)
- **Frontend:** React.js
- **Authentication:** JWT (JSON Web Tokens)
- **Data Storage:** File-based (JSON) - No database
- **Real-time:** WebSocket client connection to AWS IoT
- **Styling:** Modern corporate UI (Tailwind CSS recommended)

### 1.3 Device Mapping
- **Physical Device ID:** BTTE1250002
- **Display Device ID:** IOCL_XTRA_O2_ADMIN
- **Login Credentials:**
  - Username: `IOCL_XTRA_O2_ADMIN`
  - Password: `IOCL_XTRA_O2_ADMIN123`

---

## 2. DATA FIELD DEFINITIONS

### 2.1 Sensor Data Fields (from project.md)

| Code | Label | Unit | Type | Description |
|------|-------|------|------|-------------|
| **d1** | Inlet-CO₂ | % | Sensor | Carbon dioxide level at inlet |
| **d2** | Inlet-Dust PM | PM | Sensor | Particulate matter at inlet |
| **d3** | Inlet-Temperature | °C | Sensor | Temperature at inlet |
| **d4** | Inlet-Humidity | % | Sensor | Humidity at inlet |
| **d5** | Inlet-Water PH | % | Sensor | Water pH at inlet |
| **d6** | Inlet-Water Level | - | Sensor | Water level at inlet |
| **d7** | Inlet-Water Temp | - | Sensor | Water temperature at inlet |
| **d8** | Outlet-CO₂ | - | Sensor | Carbon dioxide at outlet |
| **d9** | Outlet-Dust PM | - | Sensor | Particulate matter at outlet |
| **d10** | Outlet-Temperature | - | Sensor | Temperature at outlet |
| **d11** | Outlet-Humidity | - | Sensor | Humidity at outlet |
| **d12** | Outlet-Water PH | - | Sensor | Water pH at outlet |
| **d13** | Outlet-Water Level | - | Sensor | Water level at outlet |
| **d14** | Outlet-Water Temp | - | Sensor | Water temperature at outlet |
| **d15** | SW Ver | - | Info | Software version |
| **d16** | HW Ver | - | Info | Hardware version |
| **d17** | (Additional) | - | Sensor | Additional sensor data |
| **d18** | (Additional) | - | Sensor | Additional sensor data |
| **d38** | GSM Signal Strength | - | Status | Signal strength indicator |
| **d39** | (Additional) | - | Status | Additional parameter |
| **d40** | (Additional) | - | Status | Additional parameter |

### 2.2 Relay Controls

| Code | Label | State | Description |
|------|-------|-------|-------------|
| **i1** | Relay1 | 0=OFF, 1=ON | Control relay 1 |
| **i2** | Relay2 | 0=OFF, 1=ON | Control relay 2 |
| **i3** | Relay3 | 0=OFF, 1=ON | Control relay 3 |
| **i4** | Relay4 | 0=OFF, 1=ON | Control relay 4 |
| **i5** | Relay5 | 0=OFF, 1=ON | Control relay 5 |
| **i6** | Relay6 | 0=OFF, 1=ON | Control relay 6 |
| **i7** | Relay7 | 0=OFF, 1=ON | Control relay 7 |
| **i8** | Relay8 | 0=OFF, 1=ON | Control relay 8 |
| **i9** | Relay9 | 0=OFF, 1=ON | Control relay 9 |
| **i10** | Relay10 | 0=OFF, 1=ON | Control relay 10 |

### 2.3 Display Parameters (i11-i18)

| Code | Label | Description |
|------|-------|-------------|
| **i11** | AQI | Calculated Air Quality Index |
| **i12** | Temperature | Temperature for display (from outlet) |
| **i13** | Humidity | Humidity % for display (from outlet) |
| **i14** | Hour | Current hour (HH) |
| **i15** | Minute | Current minute (MM) |
| **i16** | Day | Current day (DD) |
| **i17** | Month | Current month (MM) |
| **i18** | Year | Current year (YY) |

**Display Format:** `"AQI: 51     TEMP: 32     HUMIDITY:67%    12:45   27/11/2025"`

---

## 3. SYSTEM ARCHITECTURE

### 3.1 High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     AWS IoT Backend                          │
│  Device: BTTE1250002                                         │
│  - REST APIs (hour/day/week/report)                          │
│  - WebSocket (Real-time data)                                │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              Express.js Backend Server                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WebSocket Client (Persistent Connection)            │   │
│  │  - Subscribe to BTTE1250002                          │   │
│  │  - Receive real-time updates every 10s              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Display Update Service (Every 10s)                  │   │
│  │  - Calculate AQI from outlet data                    │   │
│  │  - Send i11-i18 to device                            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Relay Automation Engine                             │   │
│  │  - Manual mode                                       │   │
│  │  - Sensor-based automation                           │   │
│  │  - Time-based automation                             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  REST API Endpoints                                  │   │
│  │  - /api/auth/login                                   │   │
│  │  - /api/device/current                               │   │
│  │  - /api/device/history/{period}                      │   │
│  │  - /api/relay/control                                │   │
│  │  - /api/automation/rules                             │   │
│  │  - /api/analytics/download                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Data Cache (In-Memory)                              │   │
│  │  - Latest device data                                │   │
│  │  - Relay states                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  File Storage (JSON)                                 │   │
│  │  - automation-rules.json                             │   │
│  │  - relay-states.json                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                React.js Frontend                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Login Page                                          │   │
│  │  - Device ID: IOCL_XTRA_O2_ADMIN                    │   │
│  │  - Password: IOCL_XTRA_O2_ADMIN123                  │   │
│  │  - JWT token storage                                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Dashboard (Overview Tab)                            │   │
│  │  - Real-time sensor values table                     │   │
│  │  - Relay status indicators                           │   │
│  │  - Device status (online/offline)                    │   │
│  │  - GSM signal strength                               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Impact Analysis Tab                                 │   │
│  │  - Inlet vs Outlet comparison                        │   │
│  │  - CO₂ reduction %                                   │   │
│  │  - PM reduction %                                    │   │
│  │  - Temperature/Humidity changes                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Automation Tab                                      │   │
│  │  - Manual relay control                              │   │
│  │  - Sensor-based automation rules                     │   │
│  │  - Time-based scheduling                             │   │
│  │  - Rule editor interface                             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Analytics Tab                                       │   │
│  │  - Week/Month graph selector                         │   │
│  │  - Multi-parameter charts                            │   │
│  │  - CSV download button                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. FRONTEND FEATURES

### 4.1 Login Page
**Features:**
- Clean corporate design
- Device ID input field (auto-filled: IOCL_XTRA_O2_ADMIN)
- Password input field
- Remember me checkbox
- Login button
- Error messaging
- JWT token management

**Validation:**
- Device ID must be: `IOCL_XTRA_O2_ADMIN`
- Password must be: `IOCL_XTRA_O2_ADMIN123`

### 4.2 Dashboard (Overview Tab)
**Layout:**
- Header with device ID and online status
- Sensor values table (3 columns: Code, Label, Value)
- Relay status grid (10 relays with ON/OFF indicators)
- GSM signal strength indicator
- Last update timestamp

**Sensor Values Display:**
```
┌─────────┬─────────────────────────┬──────────┐
│ Code    │ Label                   │ Value    │
├─────────┼─────────────────────────┼──────────┤
│ d1      │ Inlet-CO₂               │ 41 %     │
│ d2      │ Inlet-Dust PM           │ 46 PM    │
│ d3      │ Inlet-Temperature       │ 96 °C    │
│ d4      │ Inlet-Humidity          │ 81 %     │
│ d5      │ Inlet-Water PH          │ 28 %     │
│ d6      │ Inlet-Water Level       │ 62       │
│ d7      │ Inlet-Water Temp        │ 24       │
│ d8      │ Outlet-CO₂              │ 90       │
│ d9      │ Outlet-Dust PM          │ 43       │
│ d10     │ Outlet-Temperature      │ 26       │
│ d11     │ Outlet-Humidity         │ 95       │
│ d12     │ Outlet-Water PH         │ 11       │
│ d13     │ Outlet-Water Level      │ 25       │
│ d14     │ Outlet-Water Temp       │ 75       │
│ d38     │ GSM Signal Strength     │ 19       │
└─────────┴─────────────────────────┴──────────┘
```

**Relay Status:**
```
┌─────────────────────────────────────────────────┐
│  Relay 1: ● ON   Relay 2: ● ON   Relay 3: ○ OFF │
│  Relay 4: ○ OFF  Relay 5: ○ OFF  Relay 6: ○ OFF │
│  Relay 7: ○ OFF  Relay 8: ○ OFF  Relay 9: ○ OFF │
│  Relay 10: ○ OFF                                │
└─────────────────────────────────────────────────┘
```

### 4.3 Impact Analysis Tab
**Features:**
- Side-by-side comparison of Inlet vs Outlet
- Calculated impact for each parameter
- Color-coded improvements (green) and degradations (red)
- Percentage reduction display

**Display Example:**
```
┌────────────────┬────────┬─────────┬──────────┬─────────┐
│ Parameter      │ Inlet  │ Outlet  │ Change   │ Impact  │
├────────────────┼────────┼─────────┼──────────┼─────────┤
│ CO₂            │ 41 %   │ 90      │ +49      │ ▲ Worse │
│ Dust PM        │ 46 PM  │ 43      │ -3       │ ▼ Better│
│ Temperature    │ 96 °C  │ 26      │ -70      │ ▼ Better│
│ Humidity       │ 81 %   │ 95      │ +14      │ ▲ Worse │
│ Water PH       │ 28 %   │ 11      │ -17      │ ▼ Better│
│ Water Level    │ 62     │ 25      │ -37      │ ▼ Better│
│ Water Temp     │ 24     │ 75      │ +51      │ ▲ Worse │
└────────────────┴────────┴─────────┴──────────┴─────────┘
```

### 4.4 Automation Tab
**Three Modes:**

#### 4.4.1 Manual Mode
- Direct relay control buttons
- Toggle ON/OFF
- Wait for WebSocket confirmation
- Block UI during update (loading state)
- Timeout after 30 seconds
- Success/Error feedback

#### 4.4.2 Sensor-Based Automation
**Configuration:**
- Select relay (i1-i10)
- Select sensor (d1-d18)
- Set threshold values (min/max)
- Set action (ON when below/above, OFF when below/above)

**Example Rule:**
```
Relay 3:
  Sensor: Outlet-CO₂ (d8)
  Condition: When > 85
  Action: Turn ON

  When < 60
  Action: Turn OFF
```

**UI:**
```
┌─────────────────────────────────────────────────┐
│ Relay 1 - Sensor Automation                     │
│  Mode: ○ Manual  ● Sensor  ○ Time               │
│                                                  │
│  Trigger Sensor: [d8 - Outlet-CO₂     ▼]        │
│  High Threshold: [85        ] → Turn ON         │
│  Low Threshold:  [60        ] → Turn OFF        │
│                                                  │
│  Status: Active  [Save] [Cancel]                │
└─────────────────────────────────────────────────┘
```

#### 4.4.3 Time-Based Automation
**Configuration:**
- Select relay (i1-i10)
- Set daily schedule
- Multiple time slots per day
- Days of week selector
- ON/OFF action per time slot

**Example Rule:**
```
Relay 5:
  Monday-Friday
    08:00 - 18:00: ON
    18:00 - 08:00: OFF

  Saturday-Sunday
    All day: OFF
```

**UI:**
```
┌─────────────────────────────────────────────────┐
│ Relay 2 - Time Automation                       │
│  Mode: ○ Manual  ○ Sensor  ● Time               │
│                                                  │
│  Schedule:                                       │
│  ☑ Mon ☑ Tue ☑ Wed ☑ Thu ☑ Fri ☐ Sat ☐ Sun    │
│                                                  │
│  Time Slot 1:                                    │
│  From: [08:00] To: [18:00] Action: [ON ▼]      │
│                                                  │
│  [+ Add Time Slot]                              │
│                                                  │
│  Status: Active  [Save] [Cancel]                │
└─────────────────────────────────────────────────┘
```

### 4.5 Analytics Tab
**Features:**
- Period selector (Week / Month)
- Parameter multi-select (choose which sensors to display)
- Line chart visualization
- Zoom/Pan controls
- Export to CSV button
- Date range picker for custom reports

**Chart Display:**
- X-axis: Time
- Y-axis: Sensor values
- Multiple lines for different parameters
- Legend with color coding
- Tooltips on hover

**Download Options:**
- Quick download (current week)
- Quick download (current month)
- Custom date range download
- CSV format with all parameters

---

## 5. BACKEND FEATURES

### 5.1 Server Structure
```
backend/
├── server.js                 # Main entry point
├── config/
│   ├── constants.js          # Device ID, credentials, AWS endpoints
│   └── jwt.js                # JWT secret and config
├── services/
│   ├── websocket.service.js  # AWS WebSocket client
│   ├── display.service.js    # Display update (every 10s)
│   ├── automation.service.js # Relay automation engine
│   ├── aqi.service.js        # AQI calculation
│   └── aws.service.js        # AWS API proxy
├── middleware/
│   ├── auth.middleware.js    # JWT verification
│   └── error.middleware.js   # Error handling
├── routes/
│   ├── auth.routes.js        # Login endpoint
│   ├── device.routes.js      # Device data endpoints
│   ├── relay.routes.js       # Relay control
│   ├── automation.routes.js  # Automation rules
│   └── analytics.routes.js   # Analytics and download
├── storage/
│   ├── cache.js              # In-memory data cache
│   ├── automation-rules.json # Persisted automation rules
│   └── relay-states.json     # Persisted relay states
└── utils/
    ├── logger.js             # Logging utility
    └── deviceMapper.js       # Device ID transformation
```

### 5.2 API Endpoints

#### 5.2.1 Authentication
```
POST /api/auth/login
Body: {
  "deviceId": "IOCL_XTRA_O2_ADMIN",
  "password": "IOCL_XTRA_O2_ADMIN123"
}
Response: {
  "token": "jwt_token_here",
  "deviceId": "IOCL_XTRA_O2_ADMIN"
}
```

#### 5.2.2 Device Data
```
GET /api/device/current
Headers: Authorization: Bearer {token}
Response: {
  "deviceId": "IOCL_XTRA_O2_ADMIN",
  "online": true,
  "lastUpdate": "2025-12-08T14:30:45Z",
  "data": { d1, d2, ... i1, i2, ... },
  "gsmSignal": 19
}

GET /api/device/history/hour
GET /api/device/history/day
GET /api/device/history/week
Response: {
  "deviceId": "IOCL_XTRA_O2_ADMIN",
  "period": "hour",
  "count": 300,
  "data": [...]
}
```

#### 5.2.3 Relay Control
```
POST /api/relay/control
Body: {
  "relay": "i1",
  "state": 1  // 0=OFF, 1=ON
}
Response: {
  "success": true,
  "relay": "i1",
  "state": 1,
  "confirmed": false  // Will be true after WebSocket confirmation
}

GET /api/relay/states
Response: {
  "i1": 1,
  "i2": 1,
  "i3": 0,
  ...
}
```

#### 5.2.4 Automation Rules
```
GET /api/automation/rules
Response: {
  "rules": [
    {
      "id": "rule_1",
      "relay": "i3",
      "mode": "sensor",
      "sensor": "d8",
      "highThreshold": 85,
      "lowThreshold": 60,
      "enabled": true
    },
    {
      "id": "rule_2",
      "relay": "i5",
      "mode": "time",
      "schedule": [
        {
          "days": [1,2,3,4,5],
          "slots": [
            { "start": "08:00", "end": "18:00", "action": 1 }
          ]
        }
      ],
      "enabled": true
    }
  ]
}

POST /api/automation/rules
Body: { rule object }
Response: { "success": true, "ruleId": "..." }

PUT /api/automation/rules/:id
DELETE /api/automation/rules/:id
```

#### 5.2.5 Analytics
```
GET /api/analytics/download?startDate=2025-12-01&endDate=2025-12-08
Response: {
  "downloadUrl": "modified_csv_url",
  "recordCount": 817,
  "expiresIn": "1 hour"
}
```

### 5.3 WebSocket Client Service
**Responsibilities:**
- Maintain persistent connection to AWS WebSocket
- Auto-reconnect on disconnect (exponential backoff)
- Subscribe to BTTE1250002 on connection
- Emit events to Express app when data received
- Handle connection errors

**Implementation:**
```javascript
// Pseudo-code
class WebSocketService {
  connect() {
    this.ws = new WebSocket(AWS_WS_URL);
    this.ws.on('open', () => this.subscribe());
    this.ws.on('message', (data) => this.handleMessage(data));
    this.ws.on('close', () => this.reconnect());
  }

  subscribe() {
    this.ws.send({
      action: 'subscribe',
      deviceId: 'BTTE1250002'
    });
  }

  handleMessage(data) {
    const message = JSON.parse(data);
    if (message.type === 'deviceData') {
      cache.updateLatestData(message.data);
      io.emit('deviceUpdate', message.data);
    }
  }
}
```

### 5.4 Display Update Service
**Responsibilities:**
- Run every 10 seconds
- Calculate AQI from outlet sensor data (d8, d9, d10, d11)
- Get current date/time
- Send command to device with i11-i18 parameters

**AQI Calculation:**
```javascript
function calculateAQI(data) {
  // Simplified AQI calculation based on outlet data
  const co2 = data.d8;
  const pm = data.d9;
  const temp = data.d10;
  const humidity = data.d11;

  // AQI formula (simplified)
  // This should be replaced with proper AQI calculation
  const aqi = Math.round(
    (co2 * 0.4) + (pm * 0.4) + (temp * 0.1) + (humidity * 0.1)
  );

  return Math.min(500, Math.max(0, aqi));
}
```

**Command Structure:**
```javascript
{
  "imei": "000000000000000",
  "d": "BTTE1250002",
  "meter": 2,
  "i11": 51,   // AQI
  "i12": 26,   // Temperature (d10)
  "i13": 95,   // Humidity (d11)
  "i14": 14,   // Hour
  "i15": 30,   // Minute
  "i16": 8,    // Day
  "i17": 12,   // Month
  "i18": 25    // Year (2025 → 25)
}
```

### 5.5 Automation Engine
**Responsibilities:**
- Monitor sensor values
- Evaluate automation rules
- Execute relay commands based on rules
- Handle conflicts between rules

**Execution Flow:**
```
1. Load automation rules from automation-rules.json
2. On each WebSocket update:
   a. Check sensor-based rules
   b. Evaluate thresholds
   c. Execute relay commands if conditions met
3. Every minute:
   a. Check time-based rules
   b. Execute scheduled relay changes
4. Manual commands always override automation
5. Log all automation actions
```

### 5.6 Data Persistence
**Files:**
- `automation-rules.json` - All automation rules
- `relay-states.json` - Last known relay states
- `server-state.json` - Server configuration

**Format:**
```json
// automation-rules.json
{
  "rules": [
    {
      "id": "rule_1",
      "relay": "i3",
      "mode": "sensor",
      "sensor": "d8",
      "highThreshold": 85,
      "lowThreshold": 60,
      "highAction": 1,
      "lowAction": 0,
      "enabled": true,
      "createdAt": "2025-12-08T10:00:00Z"
    }
  ]
}
```

---

## 6. IMPLEMENTATION PHASES

### Phase 1: Backend Foundation (Day 1-2)
- [x] Express server setup
- [x] JWT authentication
- [x] AWS API proxy endpoints
- [x] File-based storage
- [x] Error handling middleware

### Phase 2: WebSocket Integration (Day 2-3)
- [x] WebSocket client service
- [x] Connection management
- [x] Real-time data caching
- [x] Socket.io for frontend updates

### Phase 3: Display Service (Day 3)
- [x] AQI calculation
- [x] Display update timer (10s)
- [x] Command posting

### Phase 4: Relay Control (Day 3-4)
- [x] Relay control endpoints
- [x] Command confirmation logic
- [x] State persistence

### Phase 5: Automation Engine (Day 4-5)
- [x] Rule storage
- [x] Sensor-based automation
- [x] Time-based automation
- [x] Rule evaluation engine

### Phase 6: Frontend Foundation (Day 5-6)
- [x] React app setup
- [x] Routing
- [x] Login page
- [x] JWT storage
- [x] API client

### Phase 7: Dashboard (Day 6-7)
- [x] Overview tab
- [x] Real-time updates
- [x] Sensor value table
- [x] Relay status display

### Phase 8: Impact Analysis (Day 7)
- [x] Comparison logic
- [x] Impact calculations
- [x] Visualization

### Phase 9: Automation UI (Day 8-9)
- [x] Manual control
- [x] Sensor rule editor
- [x] Time schedule editor
- [x] Rule management

### Phase 10: Analytics (Day 9-10)
- [x] Chart integration
- [x] Period selection
- [x] CSV download
- [x] Date range picker

### Phase 11: Polish & Testing (Day 10-11)
- [x] Error handling
- [x] Loading states
- [x] Responsive design
- [x] Testing
- [x] Documentation

---

## 7. TECHNICAL REQUIREMENTS

### 7.1 Backend Dependencies
```json
{
  "express": "^4.18.2",
  "jsonwebtoken": "^9.0.2",
  "ws": "^8.14.2",
  "socket.io": "^4.6.1",
  "axios": "^1.6.2",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "node-cron": "^3.0.3"
}
```

### 7.2 Frontend Dependencies
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "axios": "^1.6.2",
  "socket.io-client": "^4.6.1",
  "recharts": "^2.10.0",
  "tailwindcss": "^3.3.6",
  "lucide-react": "^0.294.0"
}
```

---

## 8. SECURITY CONSIDERATIONS

### 8.1 Authentication
- JWT tokens with expiration (24 hours)
- Secure password storage (even though it's hardcoded)
- HTTPS required for production
- CORS configuration

### 8.2 API Security
- All device endpoints require JWT
- Rate limiting on login endpoint
- Input validation
- SQL injection prevention (N/A - no database)

### 8.3 WebSocket Security
- Authenticated WebSocket connections
- Message validation
- Reconnection limits

---

## 9. PERFORMANCE OPTIMIZATION

### 9.1 Caching Strategy
- In-memory cache for latest device data
- 1-minute cache for historical data
- Lazy loading for analytics

### 9.2 Real-time Updates
- Socket.io room-based broadcasting
- Debounced graph updates
- Throttled relay commands

### 9.3 File I/O
- Async file operations
- Atomic writes for JSON files
- File locking for concurrent access

---

## 10. ERROR HANDLING

### 10.1 Backend Errors
- AWS API failures → Retry with backoff
- WebSocket disconnect → Auto-reconnect
- File I/O errors → Log and alert
- Invalid commands → Validation errors

### 10.2 Frontend Errors
- Network errors → Retry logic
- Authentication errors → Redirect to login
- Command timeouts → User notification
- WebSocket disconnect → Reconnection UI

---

## 11. MONITORING & LOGGING

### 11.1 Logs to Track
- WebSocket connection status
- Relay command executions
- Automation rule triggers
- API errors
- Display update failures

### 11.2 Health Checks
- WebSocket connection status
- Last data update timestamp
- Automation engine status
- File system health

---

## SUMMARY

This implementation plan provides a complete blueprint for building a corporate monitoring dashboard for the IOCL air quality control system. The system will:

1. **Authenticate** users with masked device ID
2. **Monitor** real-time sensor data from AWS IoT
3. **Control** relays manually or via automation
4. **Analyze** inlet/outlet impact
5. **Visualize** historical trends
6. **Export** data for reporting

The architecture is designed for:
- **Reliability:** Auto-reconnecting WebSocket, error handling
- **Performance:** In-memory caching, optimized updates
- **Maintainability:** Clean code structure, documented APIs
- **Scalability:** Easy to add more devices in future

All components are designed to work together seamlessly while maintaining separation of concerns and following best practices for Express.js and React.js development.
