# 🚀 Quick Start Guide

## Starting the IOCL Air Quality Control System

### Step 1: Start Backend Server

Open a terminal and run:
```bash
cd backend
npm start
```

You should see:
```
==================================================
IOCL Air Quality Control System
==================================================
Server running on port 3001
Environment: development
Health check: http://localhost:3001/health
==================================================
```

**Keep this terminal open!**

### Step 2: Start Frontend

Open a **NEW** terminal and run:
```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 3: Access the Dashboard

1. Open your browser
2. Go to: http://localhost:5173
3. You'll be redirected to the login page

### Step 4: Login

Use these credentials:
- **Device ID:** `IOCL_XTRA_O2_ADMIN` (pre-filled)
- **Password:** `IOCL_XTRA_O2_ADMIN123`

Click "Login" button.

### Step 5: You're In!

You should now see the dashboard with:
- ✅ Device status (Online/Offline)
- ✅ Real-time sensor readings
- ✅ Relay controls
- ✅ GSM signal strength
- ✅ Last update timestamp

---

## 🎛️ Using Relay Control

### Manual Mode
1. Click the ⚙️ (Settings) icon on any relay
2. Select "Manual" mode
3. Click "Save Configuration"
4. Use the "Turn ON/OFF" button to control

### Sensor-Based Automation
1. Click the ⚙️ icon on a relay
2. Select "Sensor-Based" mode
3. Choose a sensor (e.g., "d8 - Outlet-CO₂")
4. Select operator (< or >)
5. Enter threshold value (e.g., 85)
6. Click "Save Configuration"

The relay will now automatically turn ON when the condition is met!

### Time-Based Automation
1. Click the ⚙️ icon on a relay
2. Select "Time-Based" mode
3. Set start time (e.g., 10:00)
4. Set end time (e.g., 18:00)
5. Click "Save Configuration"

The relay will now turn ON daily at start time and OFF at end time!

---

## 🔍 Monitoring

### Device Status
- **Green dot + "Online"** = Device is connected and sending data
- **Red dot + "Offline"** = Device not responding (check connection)

### Sensor Values
- Update every **30 seconds** automatically
- Real-time updates via WebSocket when dashboard is open
- Values are organized by:
  - Inlet Sensors (blue)
  - Outlet Sensors (green)
  - System Information (gray)

### Relay States
- **Green dot** = Relay is ON
- **Gray dot** = Relay is OFF
- **Blue box** = Automation rule is active

---

## ⚠️ Troubleshooting

### "Failed to fetch device data"
- Check if backend server is running
- Verify device is online
- Check internet connection

### "Invalid device ID or password"
- Use: `IOCL_XTRA_O2_ADMIN123` as password
- Device ID is pre-filled, don't change it

### Automation not working
- Ensure device is online
- Check if rule is saved (look for blue box)
- Verify sensor values are being received
- Check backend logs for errors

### "Device Offline"
- Check if AWS API is accessible
- Verify actual device (BTTE1250002) is online
- Wait 30 seconds for next poll

---

## 🛑 Stopping the System

1. Stop frontend: Press `Ctrl+C` in frontend terminal
2. Stop backend: Press `Ctrl+C` in backend terminal

**Note:** Backend automation will stop when server stops!

---

## 📊 Health Check

Visit: http://localhost:3001/health

You'll see status of all services:
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "polling": { "isRunning": true },
    "automation": { "isRunning": true },
    "display": { "isRunning": true },
    "device": { "online": true }
  }
}
```

---

## 💡 Tips

1. **Keep both terminals open** while using the system
2. **Automation runs 24/7** when backend is running
3. **Real-time updates** only work when dashboard is open
4. **Data is saved** to files, survives server restart
5. **Check logs** in backend terminal for debugging

---

**Ready to go! 🎉**
