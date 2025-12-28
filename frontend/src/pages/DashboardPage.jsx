import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { deviceAPI } from '../services/api';
import { initSocket, disconnectSocket } from '../services/socket';
import { LogOut, Signal, Clock, Moon, Sun, LayoutDashboard, Activity, Power, Settings, Download, Loader2, Calendar } from 'lucide-react';
import OverviewDashboard from '../components/OverviewDashboard';
import SensorDisplay from '../components/SensorDisplay';
import RelayControl from '../components/RelayControl';
import OfflineBanner from '../components/OfflineBanner';
import xtraO2Logo from '../assets/Xtra_O2_Logo_Final-02_-_Copy-removebg-preview.png';
import carbelimLogo from '../assets/right_logo.png';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [deviceData, setDeviceData] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState({
    online: false,
    consecutiveFailures: 0,
    maxConsecutiveFailures: 3,
    canControlRelays: false
  });
  const [relayNames, setRelayNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [displayStatus, setDisplayStatus] = useState(null);
  const [displayLoading, setDisplayLoading] = useState(false);
  const [displayError, setDisplayError] = useState('');

  // Report download state
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');

  // Backend config (features, relay labels, active relays)
  const [backendConfig, setBackendConfig] = useState({
    features: { ENABLE_DATA_DOWNLOAD: false },
    relayLabels: {},
    activeRelays: []
  });

  useEffect(() => {
    fetchDeviceData();
    fetchRelayNames();
    fetchDisplayStatus();
    fetchBackendConfig();

    const socket = initSocket();

    socket.on('deviceUpdate', (data) => {
      setDeviceData(data);
      // Use device timestamp if available, otherwise server timestamp, fallback to current time
      const timestamp = data.deviceTimestamp || data.serverTimestamp || new Date().toISOString();
      setLastUpdate(new Date(timestamp));
      // When we receive data, the device is definitely online
      // Update online status but preserve other fields
      setDeviceStatus(prevStatus => ({
        ...prevStatus,
        online: true,
        hasData: true,
        consecutiveFailures: 0
      }));
    });

    socket.on('deviceStatus', (status) => {
      // Only update status if we have valid data
      if (status && typeof status.online === 'boolean') {
        setDeviceStatus(prevStatus => ({
          ...prevStatus,
          ...status
        }));
        // Update lastUpdate if status says online and has lastUpdate
        if (status.online && status.lastUpdate) {
          setLastUpdate(new Date(status.lastUpdate));
        }
      }
    });

    // Listen for relay confirmation from backend (state verified)
    socket.on('relayConfirmed', (data) => {
      console.log('Relay confirmed:', data);
      // This is handled by RelayControl component via deviceUpdate
    });

    // Listen for relay failure from backend (max retries exceeded)
    socket.on('relayFailed', (data) => {
      console.error('Relay failed:', data);
      alert(`Failed to change ${data.relay.toUpperCase()}. Device shows ${data.actualState === 1 ? 'ON' : 'OFF'} but wanted ${data.desiredState === 1 ? 'ON' : 'OFF'}.`);
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
        // Merge status data properly
        if (dataRes.data.status) {
          setDeviceStatus(prevStatus => ({
            ...prevStatus,
            ...dataRes.data.status
          }));
        }
        if (dataRes.data.status?.lastUpdate) {
          setLastUpdate(new Date(dataRes.data.status.lastUpdate));
        }
      }

      // Also use statusRes if available
      if (statusRes.data.success && statusRes.data) {
        setDeviceStatus(prevStatus => ({
          ...prevStatus,
          ...statusRes.data
        }));
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

  const fetchDisplayStatus = async () => {
    try {
      const res = await deviceAPI.getDisplayStatus();
      if (res.data.success) {
        setDisplayStatus({
          enabled: res.data.enabled,
          isRunning: res.data.isRunning,
          updateInterval: res.data.updateInterval
        });
      }
      setDisplayError('');
    } catch (err) {
      setDisplayError('Failed to fetch display status');
    }
  };

  const toggleDisplay = async () => {
    if (!displayStatus) return;
    try {
      setDisplayLoading(true);
      const res = await deviceAPI.setDisplayEnabled(!displayStatus.enabled);
      if (res.data.success) {
        setDisplayStatus({
          enabled: res.data.enabled,
          isRunning: res.data.isRunning,
          updateInterval: res.data.updateInterval
        });
        setDisplayError('');
      }
    } catch (err) {
      setDisplayError('Failed to update display setting');
    } finally {
      setDisplayLoading(false);
    }
  };

  const fetchBackendConfig = async () => {
    try {
      const res = await deviceAPI.getConfig();
      if (res.data.success) {
        setBackendConfig({
          features: res.data.features || { ENABLE_DATA_DOWNLOAD: false },
          relayLabels: res.data.relayLabels || {},
          activeRelays: res.data.activeRelays || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch backend config:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDownloadReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      setReportError('Please select both start and end dates');
      return;
    }

    if (new Date(reportStartDate) > new Date(reportEndDate)) {
      setReportError('Start date must be before end date');
      return;
    }

    setReportLoading(true);
    setReportError('');
    setReportSuccess('');

    try {
      const res = await deviceAPI.getReport(reportStartDate, reportEndDate);

      if (res.data.success) {
        // AWS API returns download link - open it in new tab
        if (res.data.downloadUrl || res.data.url || res.data.link) {
          const downloadUrl = res.data.downloadUrl || res.data.url || res.data.link;
          window.open(downloadUrl, '_blank');
          setReportSuccess('Report downloaded successfully!');
        } else {
          // If API returns data directly, show it
          setReportSuccess('Report generated! Check your downloads.');
        }
      } else {
        setReportError(res.data.message || 'Failed to generate report');
      }
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to generate report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'sensors', label: 'Sensors', icon: Activity },
    { id: 'relays', label: 'Relay Control', icon: Power },
    { id: 'settings', label: 'Additional', icon: Settings },
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

  // Check if device is offline
  // Only show offline if we have explicitly received offline status (not just default state)
  // Also don't show offline during initial load
  const isOffline = !deviceStatus.online && deviceStatus.hasData !== undefined;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Offline Banner - shown when device is confirmed offline */}
      {isOffline && (
        <OfflineBanner
          lastUpdate={lastUpdate}
          consecutiveFailures={deviceStatus.consecutiveFailures}
          maxFailures={deviceStatus.maxConsecutiveFailures}
        />
      )}

      {/* Header */}
      <header className={`border-b shadow-sm ${isDark ? 'bg-iocl-blue border-iocl-blue-light' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex justify-between items-center">
            {/* Logo Section */}
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-lg px-3 py-1.5">
                <img
                  src={xtraO2Logo}
                  alt="IOCL Xtra O2"
                  className="h-10 w-auto"
                />
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Device: {user?.deviceId}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Device Status */}
              <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded border ${isDark ? 'bg-iocl-blue-light/50 border-iocl-blue-light' : 'bg-gray-100 border-gray-200'}`}>
                <div className={`w-2 h-2 rounded-full ${
                  deviceStatus.hasData === undefined
                    ? 'bg-yellow-500' // Unknown/Loading
                    : deviceStatus.online
                      ? 'bg-green-500'
                      : 'bg-red-500'
                }`}></div>
                <span className={`text-xs font-semibold ${
                  deviceStatus.hasData === undefined
                    ? (isDark ? 'text-yellow-400' : 'text-yellow-600')
                    : deviceStatus.online
                      ? (isDark ? 'text-green-400' : 'text-green-700')
                      : (isDark ? 'text-red-400' : 'text-red-700')
                }`}>
                  {deviceStatus.hasData === undefined ? 'CONNECTING' : deviceStatus.online ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>

              {/* GSM Signal */}
              {sensorData?.d38 && (
                <div className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded border ${isDark ? 'bg-iocl-blue-light/50 border-iocl-blue-light text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                  <Signal className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{sensorData.d38}</span>
                </div>
              )}

              {/* Last Update */}
              {lastUpdate && (
                <div className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded border ${isDark ? 'bg-iocl-blue-light/50 border-iocl-blue-light text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{lastUpdate.toLocaleTimeString()}</span>
                </div>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded border transition ${isDark ? 'bg-iocl-blue-light/50 border-iocl-blue-light text-gray-300 hover:bg-iocl-blue-light' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'}`}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center px-2 py-1.5 bg-iocl-orange text-white rounded hover:bg-iocl-orange-dark transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Carbelim Logo */}
              <div className="bg-white rounded-lg px-2 py-1.5">
                <img
                  src={carbelimLogo}
                  alt="Carbelim"
                  className="h-8 w-auto"
                />
              </div>
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
                      ? (isDark ? 'border-iocl-orange text-iocl-orange' : 'border-iocl-orange text-iocl-orange')
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
            deviceStatus={deviceStatus}
          />
        )}

        {activeTab === 'sensors' && (
          <SensorDisplay data={sensorData} deviceStatus={deviceStatus} />
        )}

        {activeTab === 'relays' && (
          <RelayControl data={sensorData} relayNames={relayNames} deviceStatus={deviceStatus} />
        )}

        {activeTab === 'settings' && (
          <div className="grid gap-4">
            {/* Download Report Card - Only shown if feature is enabled */}
            {backendConfig.features.ENABLE_DATA_DOWNLOAD && (
              <div className={`${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'} rounded-lg p-4 shadow-sm`}>
                <div className="flex items-center space-x-2 mb-3">
                  <Download className="w-5 h-5 text-iocl-orange" />
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Download Report
                  </h3>
                </div>
                <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  Download device data as CSV for a specific date range.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Start Date
                    </label>
                    <div className="relative">
                      <Calendar className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => {
                          setReportStartDate(e.target.value);
                          setReportError('');
                          setReportSuccess('');
                        }}
                        className={`w-full pl-8 pr-3 py-2 text-sm rounded border ${
                          isDark
                            ? 'bg-slate-700 border-slate-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      End Date
                    </label>
                    <div className="relative">
                      <Calendar className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => {
                          setReportEndDate(e.target.value);
                          setReportError('');
                          setReportSuccess('');
                        }}
                        className={`w-full pl-8 pr-3 py-2 text-sm rounded border ${
                          isDark
                            ? 'bg-slate-700 border-slate-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleDownloadReport}
                      disabled={reportLoading || !reportStartDate || !reportEndDate}
                      className={`px-4 py-2 text-sm font-semibold rounded flex items-center space-x-2 transition ${
                        reportLoading || !reportStartDate || !reportEndDate
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-iocl-orange text-white hover:bg-iocl-orange-dark'
                      }`}
                    >
                      {reportLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {reportError && (
                  <p className="text-xs text-red-500 mt-2">{reportError}</p>
                )}
                {reportSuccess && (
                  <p className="text-xs text-green-500 mt-2">{reportSuccess}</p>
                )}
              </div>
            )}

            {/* Display Updates Card */}
            <div className={`${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'} rounded-lg p-4 shadow-sm`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Display Updates
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    Send AQI/time data to device every {Math.round((displayStatus?.updateInterval || 0) / 1000)} seconds.
                  </p>
                  {displayError && (
                    <p className="text-xs text-red-500 mt-1">{displayError}</p>
                  )}
                </div>
                <button
                  onClick={toggleDisplay}
                  disabled={!displayStatus || displayLoading}
                  className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${
                    displayStatus?.enabled
                      ? 'bg-green-600 text-white border-green-700 hover:bg-green-700'
                      : isDark
                        ? 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
                  } ${displayLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {displayLoading ? 'Updating...' : displayStatus?.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              {displayStatus && (
                <div className={`mt-3 text-xs ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  <span className="font-semibold">Status:</span>{' '}
                  {displayStatus.enabled ? 'Enabled' : 'Disabled'} ·{' '}
                  {displayStatus.isRunning ? 'Service running' : 'Service stopped'}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
