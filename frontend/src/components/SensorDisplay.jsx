import { Thermometer, Droplets, Wind, Activity } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const SENSOR_LABELS = {
  d1: { label: 'Inlet CO₂', unit: 'ppm', icon: Wind },
  d2: { label: 'Inlet Dust PM', unit: 'µg/m³', icon: Activity },
  d3: { label: 'Inlet Temperature', unit: '°C', icon: Thermometer },
  d4: { label: 'Inlet Humidity', unit: '%', icon: Droplets },
  d5: { label: 'Inlet pH', unit: 'pH', icon: Droplets },
  d6: { label: 'Inlet Water Level', unit: '', icon: Droplets },
  d7: { label: 'Inlet Water Temperature', unit: '°C', icon: Thermometer },
  d8: { label: 'Outlet CO₂', unit: 'ppm', icon: Wind },
  d9: { label: 'Outlet Dust PM', unit: 'µg/m³', icon: Activity },
  d10: { label: 'Outlet Temperature', unit: '°C', icon: Thermometer },
  d11: { label: 'Outlet Humidity', unit: '%', icon: Droplets },
  d12: { label: 'Outlet Water pH', unit: 'pH', icon: Droplets },
  d13: { label: 'Outlet Water Level', unit: '', icon: Droplets },
  d14: { label: 'Outlet Water Temperature', unit: '°C', icon: Thermometer },
  d38: { label: 'GSM Signal', unit: '', icon: Activity },
  d39: { label: 'Software Version', unit: '', icon: Activity },
  d40: { label: 'Hardware Version', unit: '', icon: Activity },
};

const SensorDisplay = ({ data, deviceStatus = {} }) => {
  const { isDark } = useTheme();

  // Check if device is offline
  // Only show offline if we have confirmed status (hasData is defined) and device is not online
  // This prevents flickering during initial load/connecting state
  const isOffline = deviceStatus?.hasData !== undefined && !deviceStatus?.online;

  if (!data) return null;

  const inletSensors = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
  const outletSensors = ['d8', 'd9', 'd10', 'd11', 'd12', 'd13', 'd14'];
  const systemInfo = ['d38', 'd39', 'd40'];

  const renderSensorGroup = (title, sensors, accentColor) => (
    <div className="mb-4">
      <div className={`flex items-center space-x-2 mb-3 pb-2 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className={`w-1 h-4 rounded ${accentColor}`}></div>
        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
          {title}
        </h3>
        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          ({sensors.filter(k => data[k] !== undefined).length} sensors)
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {sensors.map((key) => {
          const config = SENSOR_LABELS[key];
          const value = data[key];

          if (value === undefined || value === null) return null;

          const Icon = config.icon;

          return (
            <div
              key={key}
              className={`rounded border transition ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  : 'bg-white border-gray-200 hover:border-gray-400 shadow-sm'
              }`}
            >
              {/* Header with ID */}
              <div className={`px-3 py-1.5 border-b flex items-center justify-between ${
                isDark ? 'bg-slate-700/50 border-slate-700' : 'bg-gray-50 border-gray-200'
              }`}>
                <span className={`text-xs font-mono font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  {key.toUpperCase()}
                </span>
                <Icon className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
              </div>

              {/* Value */}
              <div className="px-3 py-2">
                <div className="flex items-baseline space-x-1">
                  <span className={`text-xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {typeof value === 'number' ? value.toFixed(1) : value}
                  </span>
                  {config.unit && (
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {config.unit}
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  {config.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'} ${isOffline ? 'opacity-60 grayscale' : ''}`}>
      {/* Offline indicator */}
      {isOffline && (
        <div className={`px-4 py-2 flex items-center justify-center ${isDark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-gray-100 border-b border-gray-200'}`}>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Data may be stale - Device offline
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`px-4 py-3 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-base font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Sensor Readings
        </h2>
      </div>

      {/* Content */}
      <div className="p-4">
        {renderSensorGroup('Inlet Sensors', inletSensors, 'bg-iocl-orange')}
        {renderSensorGroup('Outlet Sensors', outletSensors, 'bg-iocl-blue')}
        {renderSensorGroup('System Information', systemInfo, 'bg-slate-500')}
      </div>
    </div>
  );
};

export default SensorDisplay;
