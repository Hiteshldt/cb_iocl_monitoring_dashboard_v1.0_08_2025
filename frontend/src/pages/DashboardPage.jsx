import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { deviceAPI } from '../services/api';
import { initSocket, disconnectSocket } from '../services/socket';
import { LogOut, Signal, Clock, Moon, Sun, LayoutDashboard, Activity, Power } from 'lucide-react';
import OverviewDashboard from '../components/OverviewDashboard';
import SensorDisplay from '../components/SensorDisplay';
import RelayControl from '../components/RelayControl';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [deviceData, setDeviceData] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState({ online: false });
  const [relayNames, setRelayNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDeviceData();
    fetchRelayNames();

    const socket = initSocket();

    socket.on('deviceUpdate', (data) => {
      setDeviceData(data);
      setLastUpdate(new Date());
      setDeviceStatus({ online: true });
    });

    socket.on('deviceStatus', (status) => {
      setDeviceStatus(status);
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  const fetchDeviceData = async () => {
    try {
      const [dataRes, statusRes] = await Promise.all([
        deviceAPI.getCurrent(),
        deviceAPI.getStatus(),
      ]);

      if (dataRes.data.success) {
        setDeviceData(dataRes.data.data);
        setDeviceStatus(dataRes.data.status);
        setLastUpdate(new Date(dataRes.data.status.lastUpdate));
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to fetch device data');
      setLoading(false);
    }
  };

  const fetchRelayNames = async () => {
    try {
      const res = await deviceAPI.getRelayNames();
      if (res.data.success) {
        setRelayNames(res.data.relayNames);
      }
    } catch (err) {
      console.error('Failed to fetch relay names:', err);
    }
  };

  const handleAirflowUpdate = async (rate) => {
    try {
      await deviceAPI.updateAirflow(rate);
    } catch (err) {
      alert('Failed to update airflow rate');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'sensors', label: 'Sensors', icon: Activity },
    { id: 'relays', label: 'Relay Control', icon: Power },
  ];

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !deviceData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`px-5 py-3 rounded ${isDark ? 'bg-red-900/20 border border-red-700 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <p className="font-semibold text-sm">Error</p>
          <p className="text-xs">{error || 'No data available'}</p>
          <button
            onClick={fetchDeviceData}
            className="mt-3 bg-red-600 text-white px-3 py-1.5 rounded text-xs hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Extract sensor data for SensorDisplay
  const sensorData = deviceData?.sensors || deviceData;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`border-b shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-base font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
                IOCL Air Quality Control System
              </h1>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                Device: {user?.deviceId}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {/* Device Status */}
              <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-100 border-gray-200'}`}>
                <div className={`w-2 h-2 rounded-full ${deviceStatus.online ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-xs font-semibold ${deviceStatus.online ? (isDark ? 'text-green-400' : 'text-green-700') : (isDark ? 'text-red-400' : 'text-red-700')}`}>
                  {deviceStatus.online ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>

              {/* GSM Signal */}
              {sensorData?.d38 && (
                <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded border ${isDark ? 'bg-slate-700/50 border-slate-600 text-slate-300' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                  <Signal className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{sensorData.d38}</span>
                </div>
              )}

              {/* Last Update */}
              {lastUpdate && (
                <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded border ${isDark ? 'bg-slate-700/50 border-slate-600 text-slate-300' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{lastUpdate.toLocaleTimeString()}</span>
                </div>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded border transition ${isDark ? 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'}`}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition text-xs font-semibold uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className={`border-b ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? (isDark ? 'border-blue-500 text-blue-400' : 'border-blue-600 text-blue-600')
                      : (isDark ? 'border-transparent text-slate-400 hover:text-slate-300' : 'border-transparent text-gray-500 hover:text-gray-700')
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {activeTab === 'overview' && (
          <OverviewDashboard
            data={deviceData}
            relayNames={relayNames}
            onAirflowUpdate={handleAirflowUpdate}
          />
        )}

        {activeTab === 'sensors' && (
          <SensorDisplay data={sensorData} />
        )}

        {activeTab === 'relays' && (
          <RelayControl data={sensorData} relayNames={relayNames} />
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
