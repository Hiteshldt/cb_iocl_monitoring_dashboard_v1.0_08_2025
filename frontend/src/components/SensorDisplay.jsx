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

const SensorDisplay = ({ data }) => {
  const { isDark } = useTheme();
  if (!data) return null;

  const inletSensors = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
  const outletSensors = ['d8', 'd9', 'd10', 'd11', 'd12', 'd13', 'd14'];
  const systemInfo = ['d38', 'd39', 'd40'];

  const renderSensorGroup = (title, sensors, color) => (
    <div className="mb-3">
      <h3 className={`text-xs font-bold mb-2 uppercase tracking-wider ${color}`}>{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {sensors.map((key) => {
          const config = SENSOR_LABELS[key];
          const value = data[key];

          if (value === undefined || value === null) return null;

          const Icon = config.icon;

          return (
            <div
              key={key}
              className={`rounded p-2.5 border transition ${
                isDark
                  ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded ${
                    title.includes('Inlet') ? (isDark ? 'bg-blue-900/50' : 'bg-blue-100') :
                    title.includes('Outlet') ? (isDark ? 'bg-green-900/50' : 'bg-green-100') :
                    (isDark ? 'bg-slate-700/50' : 'bg-gray-100')
                  }`}>
                    <Icon className={`w-3.5 h-3.5 ${
                      title.includes('Inlet') ? (isDark ? 'text-blue-400' : 'text-blue-600') :
                      title.includes('Outlet') ? (isDark ? 'text-green-400' : 'text-green-600') :
                      (isDark ? 'text-slate-400' : 'text-gray-600')
                    }`} />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{config.label}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{key}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {typeof value === 'number' ? value.toFixed(1) : value}
                  </p>
                  {config.unit && (
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{config.unit}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`rounded-lg p-4 border shadow-sm ${isDark ? 'bg-slate-850 border-slate-700' : 'bg-white border-gray-200'}`}>
      <h2 className={`text-sm font-bold mb-3 uppercase tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Sensor Readings
      </h2>

      {renderSensorGroup('Inlet Sensors', inletSensors, isDark ? 'text-blue-400' : 'text-blue-700')}
      {renderSensorGroup('Outlet Sensors', outletSensors, isDark ? 'text-green-400' : 'text-green-700')}
      {renderSensorGroup('System Information', systemInfo, isDark ? 'text-slate-400' : 'text-gray-700')}
    </div>
  );
};

export default SensorDisplay;
