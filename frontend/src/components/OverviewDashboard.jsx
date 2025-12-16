import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Thermometer,
  Droplets,
  Wind,
  Leaf,
  Activity,
  Settings,
  RefreshCw,
  ChevronUp
} from 'lucide-react';

// Helper to get cached values from localStorage
const getCachedValues = () => {
  try {
    const cached = localStorage.getItem('dashboardCachedValues');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return {
    co2AbsorbedGrams: 0,
    o2GeneratedLiters: 0,
    aqi: 0,
    temperature: 0,
    humidity: 0,
    co2Difference: 0,
    airflowRate: 100
  };
};

// Helper to save values to localStorage
const saveCachedValues = (values) => {
  try {
    localStorage.setItem('dashboardCachedValues', JSON.stringify(values));
  } catch (e) {
    // Ignore localStorage errors
  }
};

const OverviewDashboard = ({ data, relayNames, onAirflowUpdate, deviceStatus = {} }) => {
  const { isDark } = useTheme();
  const [airflowInput, setAirflowInput] = useState('');
  const [showAirflowSettings, setShowAirflowSettings] = useState(false);

  // Check if device is offline
  const isOffline = deviceStatus?.hasData !== undefined && !deviceStatus?.online;

  // Store previous values to prevent flickering to 0
  const prevValuesRef = useRef(getCachedValues());

  // Update cached values when we get valid data
  useEffect(() => {
    if (!data?.calculated) return;

    const calc = data.calculated;
    let hasChanges = false;

    // Update AQI (any valid number)
    if (typeof calc.aqi?.value === 'number' && !isNaN(calc.aqi.value)) {
      prevValuesRef.current.aqi = calc.aqi.value;
      hasChanges = true;
    }

    // Update Temperature (any valid number)
    if (typeof calc.temperature === 'number' && !isNaN(calc.temperature)) {
      prevValuesRef.current.temperature = calc.temperature;
      hasChanges = true;
    }

    // Update Humidity (any valid number)
    if (typeof calc.humidity === 'number' && !isNaN(calc.humidity)) {
      prevValuesRef.current.humidity = calc.humidity;
      hasChanges = true;
    }

    // Update CO2 difference - ensure non-negative
    if (typeof calc.co2?.difference === 'number' && !isNaN(calc.co2.difference)) {
      prevValuesRef.current.co2Difference = Math.max(0, calc.co2.difference);
      hasChanges = true;
    }

    // Update airflow rate
    if (typeof calc.airflowRate === 'number' && !isNaN(calc.airflowRate) && calc.airflowRate > 0) {
      prevValuesRef.current.airflowRate = calc.airflowRate;
      hasChanges = true;
    }

    // CO2 absorbed - only update if new value is >= previous (never decrease)
    const newCo2 = calc.co2?.absorbedGrams;
    if (typeof newCo2 === 'number' && !isNaN(newCo2) && newCo2 >= 0) {
      prevValuesRef.current.co2AbsorbedGrams = Math.max(prevValuesRef.current.co2AbsorbedGrams, newCo2);
      hasChanges = true;
    }

    // O2 generated - only update if new value is >= previous (never decrease)
    const newO2 = calc.o2?.generatedLiters;
    if (typeof newO2 === 'number' && !isNaN(newO2) && newO2 >= 0) {
      prevValuesRef.current.o2GeneratedLiters = Math.max(prevValuesRef.current.o2GeneratedLiters, newO2);
      hasChanges = true;
    }

    // Save to localStorage for persistence
    if (hasChanges) {
      saveCachedValues(prevValuesRef.current);
    }
  }, [data]);

  if (!data) return null;

  const { relays } = data;

  // Use cached values for display to prevent flickering
  const displayValues = prevValuesRef.current;

  // AQI color mapping
  const getAqiColor = (aqi) => {
    if (aqi <= 50) return { bg: 'bg-green-500', text: 'text-green-500', label: 'Good' };
    if (aqi <= 100) return { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Moderate' };
    if (aqi <= 150) return { bg: 'bg-orange-500', text: 'text-orange-500', label: 'Unhealthy for Sensitive' };
    if (aqi <= 200) return { bg: 'bg-red-500', text: 'text-red-500', label: 'Unhealthy' };
    if (aqi <= 300) return { bg: 'bg-purple-500', text: 'text-purple-500', label: 'Very Unhealthy' };
    return { bg: 'bg-red-900', text: 'text-red-900', label: 'Hazardous' };
  };

  const aqiInfo = getAqiColor(displayValues.aqi);

  // Format CO2 in grams
  const formatCO2 = (grams) => ({
    value: (grams || 0).toFixed(2),
    unit: 'g'
  });

  // Format O2 in liters
  const formatO2 = (liters) => ({
    value: (liters || 0).toFixed(3),
    unit: 'L'
  });

  const handleAirflowSave = () => {
    if (isOffline) {
      alert('Device is offline. Cannot update airflow rate.');
      return;
    }
    const value = parseFloat(airflowInput);
    if (value > 0 && onAirflowUpdate) {
      onAirflowUpdate(value);
      setShowAirflowSettings(false);
      setAirflowInput('');
    }
  };

  // Offline styling classes
  const offlineOverlayClass = isOffline ? 'relative' : '';
  const offlineContentClass = isOffline ? 'opacity-60 grayscale' : '';

  return (
    <div className={`space-y-4 ${offlineOverlayClass}`}>
      {/* Offline indicator overlay */}
      {isOffline && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-start justify-center pt-8">
          <div className={`px-4 py-2 rounded-lg shadow-lg ${isDark ? 'bg-slate-800/90 border border-slate-600' : 'bg-white/90 border border-gray-300'}`}>
            <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Data may be stale - Device offline
            </p>
          </div>
        </div>
      )}

      <div className={offlineContentClass}>
      {/* Main Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* AQI Card */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center space-x-2">
              <Activity className={`w-4 h-4 ${aqiInfo.text}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                Air Quality Index
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-bold tabular-nums ${aqiInfo.text}`}>
                {displayValues.aqi}
              </span>
              <span className={`text-sm font-medium ${aqiInfo.text}`}>{aqiInfo.label}</span>
            </div>
            <div className={`mt-2 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
              <div className={`h-full rounded-full ${aqiInfo.bg}`} style={{ width: `${Math.min(displayValues.aqi / 300 * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Temperature Card */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center space-x-2">
              <Thermometer className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                Temperature
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-baseline space-x-1">
              <span className={`text-3xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {displayValues.temperature.toFixed(1)}
              </span>
              <span className={`text-lg ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>°C</span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Inlet Reading</p>
          </div>
        </div>

        {/* Humidity Card */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center space-x-2">
              <Droplets className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                Humidity
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-baseline space-x-1">
              <span className={`text-3xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {displayValues.humidity.toFixed(1)}
              </span>
              <span className={`text-lg ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>%</span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Inlet Reading</p>
          </div>
        </div>

        {/* CO2 Reduction Card */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center space-x-2">
              <Wind className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                CO₂ Reduction
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-baseline space-x-1">
              <span className={`text-3xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {displayValues.co2Difference.toFixed(1)}
              </span>
              <span className={`text-lg ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>ppm</span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Outlet - Inlet (Purified)</p>
          </div>
        </div>
      </div>

      {/* Accumulated Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CO2 Reduced */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-1 h-4 rounded ${isDark ? 'bg-emerald-500' : 'bg-emerald-600'}`}></div>
                <span className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                  CO₂ Reduced
                </span>
              </div>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Total Accumulated</span>
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <Wind className={`w-8 h-8 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <div className="text-right">
                <span className={`text-2xl font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {formatCO2(displayValues.co2AbsorbedGrams).value}
                </span>
                <span className={`text-sm ml-1 ${isDark ? 'text-emerald-500' : 'text-emerald-700'}`}>
                  {formatCO2(displayValues.co2AbsorbedGrams).unit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* O2 Released */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-1 h-4 rounded ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'}`}></div>
                <span className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                  O₂ Released
                </span>
              </div>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Photobioreactor</span>
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <Leaf className={`w-8 h-8 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
              <div className="text-right">
                <span className={`text-2xl font-bold tabular-nums ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  {formatO2(displayValues.o2GeneratedLiters).value}
                </span>
                <span className={`text-sm ml-1 ${isDark ? 'text-cyan-500' : 'text-cyan-700'}`}>
                  {formatO2(displayValues.o2GeneratedLiters).unit}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Airflow & Relay Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Airflow Settings */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RefreshCw className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  Airflow Rate
                </span>
              </div>
              <button
                onClick={() => setShowAirflowSettings(!showAirflowSettings)}
                className={`p-1 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
              >
                {showAirflowSettings ? (
                  <ChevronUp className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`} />
                ) : (
                  <Settings className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`} />
                )}
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-baseline space-x-1">
              <span className={`text-2xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {displayValues.airflowRate}
              </span>
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>m³/h</span>
            </div>

            {showAirflowSettings && (
              <div className={`mt-3 pt-3 border-t border-dashed flex items-center space-x-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <input
                  type="number"
                  value={airflowInput}
                  onChange={(e) => setAirflowInput(e.target.value)}
                  placeholder="New rate"
                  className={`flex-1 px-3 py-2 text-sm border rounded ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
                <button
                  onClick={handleAirflowSave}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Relay Status */}
        <div className={`lg:col-span-2 rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                Relay Status
              </span>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                {Object.values(relays || {}).filter(v => v === 1).length} / 10 Active
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const relayId = `i${num}`;
                const isOn = relays?.[relayId] === 1;
                const name = relayNames?.[relayId] || `Relay ${num}`;

                return (
                  <div
                    key={relayId}
                    className={`p-2 rounded border text-center transition ${
                      isOn
                        ? (isDark ? 'bg-green-900/40 border-green-600' : 'bg-green-50 border-green-400')
                        : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200')
                    }`}
                    title={name}
                  >
                    <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${isOn ? 'bg-green-500 shadow-sm shadow-green-500/50' : (isDark ? 'bg-slate-600' : 'bg-gray-300')}`} />
                    <p className={`text-xs font-mono font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      {relayId.toUpperCase()}
                    </p>
                    <p className={`text-xs font-semibold ${isOn ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-slate-500' : 'text-gray-400')}`}>
                      {isOn ? 'ON' : 'OFF'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </div>{/* End offlineContentClass wrapper */}
    </div>
  );
};

export default OverviewDashboard;
