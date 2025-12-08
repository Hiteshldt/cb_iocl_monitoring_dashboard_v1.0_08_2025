# IOCL Custom Server - API & Data Flow Analysis
**Device ID:** BTTE1250002
**Analysis Date:** December 8, 2025

---

## 1. AWS API ENDPOINTS OVERVIEW

### Base URL
```
https://vtg0j85nv4.execute-api.us-east-1.amazonaws.com/device
```

---

## 2. REST API ENDPOINTS

### 2.1 GET `/device/{deviceId}/graph/hour`
**Purpose:** Retrieve last 1 hour of device data

**Response Structure:**
```json
{
  "deviceId": "BTTE1250002",
  "period": "hour",
  "count": 300,
  "startTime": 1765182163,
  "endTime": 1765185763,
  "data": [...]
}
```

**Data Point Structure:**
```json
{
  "d": "BTTE1250002",
  "meter": 2.0,
  "offline": 0.0,
  "date": "2025-12-08,13:52:43",
  "device_type": 1.0,
  "imei": "000000000000000",
  "ts": 1765182163.0,
  "expireAt": 1765185763.0,

  // Sensor Data Fields
  "d1": 75.0,   // Inlet-CO₂ (%)
  "d2": 62.0,   // Inlet-Dust PM
  "d3": 96.0,   // Inlet-Temperature (°C)
  "d4": 40.0,   // Inlet-Humidity (%)
  "d5": 15.0,   // Inlet-Water PH (%)
  "d6": 15.0,   // Inlet-Water Level
  "d7": 93.0,   // Inlet-Water Temp
  "d8": 83.0,   // Outlet-CO₂
  "d9": 52.0,   // Outlet-Dust PM
  "d10": 84.0,  // Outlet-Temperature
  "d11": 0.0,   // Outlet-Humidity
  "d12": 3.0,   // Outlet-Water PH
  "d13": 13.0,  // Outlet-Water Level
  "d14": 49.0,  // Outlet-Water Temp
  "d15": 86.0,  // SW Ver
  "d16": 6.0,   // HW Ver
  "d17": 71.0,  // (Additional sensor)
  "d18": 50.0,  // (Additional sensor)
  "d38": 19.0,  // GSM Signal Strength
  "d39": 22.0,  // (Additional parameter)
  "d40": 23.0,  // (Additional parameter)

  // Status Fields
  "s1": 77.0,
  "s2": 77.0,
  "s3": 0.0,

  // Relay States (0 = OFF, 1 = ON)
  "i1": 0.0,    // Relay1
  "i2": 0.0,    // Relay2
  "i3": 0.0,    // Relay3
  "i4": 0.0,    // Relay4
  "i5": 0.0,    // Relay5
  "i6": 0.0,    // Relay6
  "i7": 0.0,    // Relay7
  "i8": 0.0,    // Relay8
  "i9": 0.0,    // Relay9
  "i10": 0.0,   // Relay10

  // Sample Count
  "sampleCount": 108.0
}
```

**Characteristics:**
- Returns up to 300 data points
- Data frequency: ~10 second intervals
- Each data point contains full sensor readings and relay states

---

### 2.2 GET `/device/{deviceId}/graph/day`
**Purpose:** Retrieve aggregated data for the last day

**Response Structure:**
```json
{
  "deviceId": "BTTE1250002",
  "period": "day",
  "count": 4,
  "startTime": 1764862907,
  "endTime": 1764949307,
  "data": [...]
}
```

**Characteristics:**
- Returns aggregated data points (averaged over time windows)
- Fewer data points compared to hourly data
- Same data structure as hourly endpoint
- `sampleCount` field indicates how many samples were aggregated

---

### 2.3 GET `/device/{deviceId}/graph/week`
**Purpose:** Retrieve aggregated data for the last week

**Response Structure:**
```json
{
  "deviceId": "BTTE1250002",
  "period": "week",
  "count": 2,
  "startTime": 1764344600,
  "endTime": 1764949400,
  "data": [...]
}
```

**Characteristics:**
- Higher aggregation level (longer time windows)
- `sampleCount`: 324.0 (indicates multiple samples aggregated)
- Same data point structure

---

### 2.4 GET `/device/{deviceId}/report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
**Purpose:** Generate and download CSV report for custom date range

**Response Structure:**
```json
{
  "status": "success",
  "deviceId": "BTTE1250002",
  "startDate": "2025-12-02",
  "endDate": "2025-12-06",
  "recordCount": 817,
  "downloadUrl": "https://devicedatalongterm.s3.amazonaws.com/athena-results/...",
  "expiresIn": "1 hour"
}
```

**Characteristics:**
- Returns pre-signed S3 URL for CSV download
- URL expires in 1 hour
- **IMPORTANT:** Need to modify CSV data:
  - Replace `"d"` field value with `"IOCL_XTRA_O2_ADMIN"`
  - Replace `"deviceId"` field value with `"IOCL_XTRA_O2_ADMIN"`

---

### 2.5 POST `/device/{deviceId}/command`
**Purpose:** Send control commands to the device (relay control)

**Request Body:**
```json
{
  "imei": "860710081332028",
  "meter": "2",
  "i1": 0
}
```

**Multiple Relays:**
```json
{
  "imei": "860710081332028",
  "meter": "2",
  "i1": 0,
  "i2": 1,
  "i3": 1
}
```

**Characteristics:**
- Control individual relays (i1 - i10)
- Values: 0 = OFF, 1 = ON
- Must include `imei` and `meter` fields
- Changes are reflected in next WebSocket update

**IMPORTANT - Display Update Command:**
The device also needs display updates sent every 10 seconds:
```json
{
  "imei": "000000000000000",
  "d": "BTTE1250002",
  "meter": 2,
  "i11": 51,   // AQI value
  "i12": 32,   // Temperature
  "i13": 67,   // Humidity %
  "i14": 12,   // Hour (HH)
  "i15": 45,   // Minute (MM)
  "i16": 27,   // Day (DD)
  "i17": 11,   // Month (MM)
  "i18": 25    // Year (YY)
}
```

---

## 3. WEBSOCKET CONNECTION

### 3.1 Connection Details
**URL:** `wss://ztw46d04q3.execute-api.us-east-1.amazonaws.com/production`

### 3.2 Subscribe to Device
**Send:**
```json
{
  "action": "subscribe",
  "deviceId": "BTTE1250002"
}
```

### 3.3 Real-time Data Stream
**Receive:**
```json
{
  "type": "deviceData",
  "deviceId": "BTTE1250002",
  "data": {
    "imei": "000000000000000",
    "d": "BTTE1250002",
    "meter": 2,
    "offline": 0,
    "date": "2025-12-05,21:14:23",
    "d38": 19,
    "d39": 22,
    "d40": 23,
    "device_type": 1,
    "s1": 77,
    "s2": 77,
    "s3": 0,
    "d1": 3,
    "d2": 87,
    "d3": 81,
    "d4": 61,
    "d5": 18,
    "d6": 73,
    "d7": 60,
    "d8": 53,
    "d9": 24,
    "d10": 99,
    "d11": 81,
    "d12": 79,
    "d13": 51,
    "d14": 70,
    "d15": 90,
    "d16": 79,
    "d17": 40,
    "d18": 46,
    "i1": 1,
    "i2": 1,
    "i3": 1,
    "i4": 1,
    "i5": 1,
    "i6": 1,
    "i7": 1,
    "i8": 0,
    "i9": 0,
    "i10": 0,
    "deviceId": "BTTE1250002",
    "ts": 1764949464,
    "expireAt": 1764953064
  }
}
```

**Characteristics:**
- Real-time updates (approximately every 10 seconds)
- Same data structure as REST API responses
- Wraps data in a message with `type` and `deviceId` fields
- Immediate feedback after sending commands

---

## 4. DATA FIELD MAPPING

### 4.1 Sensor Parameters

| Code | Label | Unit | Description |
|------|-------|------|-------------|
| d1 | Inlet-CO₂ | % | Carbon dioxide at inlet |
| d2 | Inlet-Dust PM | PM | Particulate matter at inlet |
| d3 | Inlet-Temperature | °C | Temperature at inlet |
| d4 | Inlet-Humidity | % | Humidity at inlet |
| d5 | Inlet-Water PH | % | Water pH at inlet |
| d6 | Inlet-Water Level | - | Water level at inlet |
| d7 | Inlet-Water Temp | - | Water temperature at inlet |
| d8 | Outlet-CO₂ | - | Carbon dioxide at outlet |
| d9 | Outlet-Dust PM | - | Particulate matter at outlet |
| d10 | Outlet-Temperature | - | Temperature at outlet |
| d11 | Outlet-Humidity | - | Humidity at outlet |
| d12 | Outlet-Water PH | - | Water pH at outlet |
| d13 | Outlet-Water Level | - | Water level at outlet |
| d14 | Outlet-Water Temp | - | Water temperature at outlet |
| d15 | SW Ver | - | Software version |
| d16 | HW Ver | - | Hardware version |
| d38 | GSM Signal | - | Signal strength (0-31) |

### 4.2 Relay Controls

| Code | Label | Value |
|------|-------|-------|
| i1 | Relay1 | 0=OFF, 1=ON |
| i2 | Relay2 | 0=OFF, 1=ON |
| i3 | Relay3 | 0=OFF, 1=ON |
| i4 | Relay4 | 0=OFF, 1=ON |
| i5 | Relay5 | 0=OFF, 1=ON |
| i6 | Relay6 | 0=OFF, 1=ON |
| i7 | Relay7 | 0=OFF, 1=ON |
| i8 | Relay8 | 0=OFF, 1=ON |
| i9 | Relay9 | 0=OFF, 1=ON |
| i10 | Relay10 | 0=OFF, 1=ON |

### 4.3 Display Parameters (Command Only)

| Code | Label | Description |
|------|-------|-------------|
| i11 | AQI | Calculated Air Quality Index |
| i12 | Temperature | Temperature for display |
| i13 | Humidity | Humidity percentage |
| i14 | Hour | Current hour (HH) |
| i15 | Minute | Current minute (MM) |
| i16 | Day | Current day (DD) |
| i17 | Month | Current month (MM) |
| i18 | Year | Current year (YY) |

---

## 5. DATA FLOW ANALYSIS

### 5.1 REST API Data Flow
```
Client → GET /device/{deviceId}/graph/{period}
       ← JSON Response with historical data
```

**Use Cases:**
- Initial page load
- Historical data visualization
- Graph rendering (hour/day/week views)

### 5.2 WebSocket Data Flow
```
Client → Subscribe: {"action": "subscribe", "deviceId": "BTTE1250002"}
       ← Real-time updates every ~10 seconds
```

**Use Cases:**
- Live dashboard updates
- Real-time monitoring
- Instant relay state feedback

### 5.3 Command Flow
```
Client → POST /device/{deviceId}/command with relay states
Device ← Receives command
       → Updates relay hardware
       → Sends new state via WebSocket
Client ← Receives confirmation via WebSocket
```

**Important:**
- UI should wait for WebSocket confirmation before unblocking relay controls
- Timeout if confirmation not received within 30 seconds

### 5.4 Display Update Flow (Every 10 seconds)
```
Server → Calculate AQI from outlet data
       → Format current time
       → POST /device/{deviceId}/command with i11-i18 parameters
Device ← Updates display screen
```

---

## 6. SERVER REQUIREMENTS

### 6.1 Backend Tasks
1. **WebSocket Client Management**
   - Maintain persistent connection to AWS WebSocket
   - Auto-reconnect on disconnect
   - Subscribe to device on connection

2. **Data Caching**
   - Cache latest device data in memory
   - Store relay automation rules in JSON file
   - Persist automation state

3. **Display Update Service**
   - Run every 10 seconds
   - Calculate AQI from outlet sensor data
   - Send i11-i18 parameters to device

4. **Relay Automation Engine**
   - Monitor sensor values
   - Apply automation rules
   - Execute scheduled relay changes

5. **API Proxy**
   - Proxy AWS API requests
   - Transform deviceId (BTTE1250002 → IOCL_XTRA_O2_ADMIN)
   - Handle authentication

### 6.2 Frontend Requirements
1. **Authentication**
   - Login with 8-character password
   - JWT token management

2. **Dashboard**
   - Display all sensor values in table format
   - Real-time updates via WebSocket
   - Color coding for status

3. **Impact Analysis Tab**
   - Calculate Inlet - Outlet difference for each parameter
   - Show improvement/degradation

4. **Automation Tab**
   - Manual relay control
   - Sensor-based automation rules
   - Time-based scheduling

5. **Analytics Tab**
   - Weekly/Monthly graphs
   - Download CSV reports

---

## 7. KEY IMPLEMENTATION NOTES

### 7.1 Device ID Masking
- **Actual Device:** BTTE1250002
- **Display to User:** IOCL_XTRA_O2_ADMIN
- **Transform in:** CSV downloads, UI displays
- **Keep original in:** AWS API calls, WebSocket subscription

### 7.2 Relay Control Safety
- Wait for WebSocket confirmation before unblocking UI
- Implement timeout (30 seconds)
- Show loading state during update

### 7.3 AQI Calculation
- Use outlet sensor data (d8, d9, d10, d11)
- Calculate composite AQI
- Update display every 10 seconds

### 7.4 Data Storage
- No database required (single device)
- Store automation rules in `automation-config.json`
- Cache latest data in memory
- Restart-safe persistence

---

## 8. WEBSOCKET MESSAGE TYPES

### 8.1 Subscription Request
```json
{
  "action": "subscribe",
  "deviceId": "BTTE1250002"
}
```

### 8.2 Device Data Update
```json
{
  "type": "deviceData",
  "deviceId": "BTTE1250002",
  "data": { ... }
}
```

### 8.3 Connection Events
- Connection established
- Connection closed
- Error events

---

## 9. ERROR HANDLING

### 9.1 API Errors
- Network timeout: Retry with exponential backoff
- 401/403: Re-authenticate
- 500: Show error, retry after delay

### 9.2 WebSocket Errors
- Disconnect: Auto-reconnect with exponential backoff
- Subscription failure: Retry subscription
- Message parse error: Log and skip

### 9.3 Command Errors
- Timeout: Show error, allow retry
- Invalid response: Show error
- Network error: Queue for retry

---

## 10. PERFORMANCE OPTIMIZATION

### 10.1 Caching Strategy
- Cache hour/day/week data for 1 minute
- Invalidate on new WebSocket data
- Cache report URLs until expiry

### 10.2 WebSocket Optimization
- Single persistent connection
- Reconnect with exponential backoff
- Buffer messages during reconnection

### 10.3 Frontend Optimization
- Debounce graph updates
- Virtual scrolling for large datasets
- Lazy load historical data

---

## SUMMARY

The system architecture consists of:
1. AWS IoT backend providing REST APIs and WebSocket streams
2. Express server as middleware (authentication, caching, automation)
3. React frontend for visualization and control

The device (BTTE1250002) sends data every ~10 seconds via WebSocket and stores historical data accessible via REST APIs. The server must:
- Maintain WebSocket connection for real-time updates
- Calculate and send display data every 10 seconds
- Execute relay automation based on rules
- Proxy and transform API responses for the frontend
