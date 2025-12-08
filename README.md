# IOCL Air Quality Control System

Complete monitoring and control dashboard for IOCL air quality control device.

## 🎯 Features

### Backend (Express.js)
- ✅ JWT Authentication
- ✅ Data Polling from AWS IoT (every 30 seconds)
- ✅ Relay Control (Manual + Automated)
- ✅ Automation Engine
  - Sensor-based automation
  - Time-based scheduling
  - 24/7 background operation
- ✅ Display Update Service (every 10 seconds)
- ✅ Real-time Socket.IO updates
- ✅ File-based persistence (no database needed)

### Frontend (React + Vite)
- ✅ Corporate professional design
- ✅ JWT Authentication login
- ✅ Real-time sensor display
- ✅ Relay control with 3 modes:
  - Manual control
  - Sensor-based automation
  - Time-based scheduling
- ✅ Live device status monitoring
- ✅ Responsive design

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- npm or yarn

### Installation

1. **Clone or navigate to project directory:**
```bash
cd Carbelim_IOCL_Device3
```

2. **Install Backend Dependencies:**
```bash
cd backend
npm install
```

3. **Install Frontend Dependencies:**
```bash
cd ../frontend
npm install
```

### Running the Application

#### Start Backend Server
```bash
cd backend
npm start
```
Server will run on http://localhost:3001

#### Start Frontend (in a new terminal)
```bash
cd frontend
npm run dev
```
Frontend will run on http://localhost:5173

### Login Credentials
- **Device ID:** `IOCL_XTRA_O2_ADMIN`
- **Password:** `IOCL_XTRA_O2_ADMIN123`

## 📁 Project Structure

```
Carbelim_IOCL_Device3/
├── backend/
│   ├── config/           # Configuration files
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── services/         # Business logic services
│   │   ├── aws.service.js       # AWS API integration
│   │   ├── polling.service.js   # Data polling (30s)
│   │   ├── automation.service.js # Automation engine
│   │   ├── relay.service.js     # Relay control
│   │   ├── display.service.js   # Display updates (10s)
│   │   └── cache.service.js     # In-memory cache
│   ├── storage/          # File-based storage
│   ├── utils/            # Helper utilities
│   └── server.js         # Main server file
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── SensorDisplay.jsx
│   │   │   └── RelayControl.jsx
│   │   ├── pages/        # Page components
│   │   │   ├── LoginPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── services/     # API services
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   ├── context/      # React context
│   │   │   └── AuthContext.jsx
│   │   └── App.jsx       # Main app component
│   └── index.html
│
├── API_ANALYSIS.md       # API documentation
├── IMPLEMENTATION_PLAN.md # Implementation details
└── README.md             # This file
```

## 🔧 Configuration

### Backend (.env)
Located at `backend/.env`
```env
PORT=3001
AWS_API_BASE_URL=https://vtg0j85nv4.execute-api.us-east-1.amazonaws.com/device
ACTUAL_DEVICE_ID=BTTE1250002
DISPLAY_DEVICE_ID=IOCL_XTRA_O2_ADMIN
ADMIN_PASSWORD=IOCL_XTRA_O2_ADMIN123
DATA_POLL_INTERVAL=30000
DISPLAY_UPDATE_INTERVAL=10000
```

### Frontend (.env)
Located at `frontend/.env`
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token

### Device
- `GET /api/device/current` - Get current device data
- `GET /api/device/status` - Get online/offline status
- `GET /api/device/history/{period}` - Get historical data

### Relay Control
- `POST /api/relay/control` - Control relay manually
- `GET /api/relay/states` - Get all relay states

### Automation
- `GET /api/automation/rules` - Get all automation rules
- `POST /api/automation/rules` - Save automation rule
- `DELETE /api/automation/rules/:id` - Delete rule

## 🎛️ Relay Automation Modes

### 1. Manual Mode
- Direct ON/OFF control via button
- No automation rules active

### 2. Sensor-Based Automation
- Trigger relay based on sensor values
- Configure:
  - Sensor (e.g., Outlet-CO₂)
  - Operator (< or >)
  - Threshold value
- Example: "Turn ON when Outlet-CO₂ > 85"

### 3. Time-Based Automation
- Schedule relay ON/OFF times
- Configure:
  - Start time (HH:MM)
  - End time (HH:MM)
- Repeats daily
- Example: "ON from 10:00 to 18:00"

## 🔄 Background Services

All services run 24/7 independent of user dashboard:

1. **Data Polling** - Fetches from AWS every 30s
2. **Automation Engine** - Evaluates rules every 10s
3. **Display Update** - Sends display data every 10s

## 📝 Sensor Parameters

| Code | Label | Unit |
|------|-------|------|
| d1 | Inlet-CO₂ | % |
| d2 | Inlet-Dust PM | PM |
| d3 | Inlet-Temperature | °C |
| d4 | Inlet-Humidity | % |
| d8 | Outlet-CO₂ | - |
| d9 | Outlet-Dust PM | - |
| d10 | Outlet-Temperature | - |
| d11 | Outlet-Humidity | - |
| d38 | GSM Signal Strength | - |

## 🔌 Socket.IO Events

- `deviceUpdate` - Real-time device data
- `deviceStatus` - Device online/offline status
- `automationTriggered` - Automation rule triggered

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Vite HMR
```

## 📦 Production Build

### Backend
```bash
cd backend
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview  # Preview production build
```

## 🐛 Troubleshooting

### Backend not connecting to AWS
- Check `AWS_API_BASE_URL` in `.env`
- Verify `ACTUAL_DEVICE_ID` is correct
- Check network connectivity

### Frontend not connecting to backend
- Ensure backend is running on port 3001
- Check `VITE_API_URL` in frontend `.env`
- Verify CORS settings

### Automation not working
- Check automation rules in `backend/storage/automation-rules.json`
- Verify automation engine is running (check logs)
- Ensure sensor values are being received

## 📄 License

Proprietary - IOCL Internal Use Only

## 👥 Support

For issues or questions, contact the development team.

---

**Built with ❤️ for IOCL Air Quality Control**
