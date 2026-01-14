import { useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Thermometer,
  Droplets,
  Wind,
  Leaf,
  Activity
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

// Relay mapping: Display name (R1-R8) to internal ID (i1-i8)
// Order: R1, R2, R3, R4, R5, R7, R6, R8 (R7 before R6 as requested)
const RELAY_MAPPING = [
  { display: 'R1', internal: 'i4', name: 'Circulator Actuator' },
  { display: 'R2', internal: 'i1', name: 'Aeration Blower Assembly' },
  { display: 'R3', internal: 'i2', name: 'Luminaire + Dehumidifier' },
  { display: 'R4', internal: 'i3', name: 'Photosynthetic Irrad.' },
  { display: 'R5', internal: 'i8', name: 'Thermal System' },
  { display: 'R7', internal: 'i6', name: 'Exhaust Impeller' },  // R7 before R6
  { display: 'R6', internal: 'i5', name: null },                 // R6 after R7, no custom name
  { display: 'R8', internal: 'i7', name: null },                 // R8 last, no custom name
];

const OverviewDashboard = ({ data, relayNames, deviceStatus = {} }) => {
  const { isDark } = useTheme();

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
              <Thermometer className="w-4 h-4 text-iocl-orange" />
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
              <Droplets className="w-4 h-4 text-iocl-blue" />
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
              <Wind className="w-4 h-4 text-green-600" />
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
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-iocl-orange/30' : 'bg-white border-iocl-orange/30 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-iocl-orange/10 border-iocl-orange/20' : 'bg-iocl-orange/5 border-iocl-orange/20'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-4 rounded bg-iocl-orange"></div>
                <span className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                  CO₂ Reduced
                </span>
              </div>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Total Accumulated</span>
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <Wind className={`w-8 h-8 ${isDark ? 'text-iocl-orange' : 'text-iocl-orange'}`} />
              <div className="text-right">
                <span className={`text-2xl font-bold tabular-nums ${isDark ? 'text-iocl-orange' : 'text-iocl-orange-dark'}`}>
                  {formatCO2(displayValues.co2AbsorbedGrams).value}
                </span>
                <span className={`text-sm ml-1 ${isDark ? 'text-iocl-orange/70' : 'text-iocl-orange'}`}>
                  {formatCO2(displayValues.co2AbsorbedGrams).unit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* O2 Released */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-iocl-blue/30' : 'bg-white border-iocl-blue/30 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-iocl-blue/10 border-iocl-blue/20' : 'bg-iocl-blue/5 border-iocl-blue/20'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-4 rounded bg-iocl-blue"></div>
                <span className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                  O₂ Released
                </span>
              </div>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Photobioreactor</span>
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <Leaf className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-iocl-blue'}`} />
              <div className="text-right">
                <span className={`text-2xl font-bold tabular-nums ${isDark ? 'text-blue-400' : 'text-iocl-blue'}`}>
                  {formatO2(displayValues.o2GeneratedLiters).value}
                </span>
                <span className={`text-sm ml-1 ${isDark ? 'text-blue-300' : 'text-iocl-blue-light'}`}>
                  {formatO2(displayValues.o2GeneratedLiters).unit}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Relay Status Row */}
      <div className="grid grid-cols-1 gap-4">
        {/* Relay Status */}
        <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                Relay Status
              </span>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                {RELAY_MAPPING.filter(({ internal }) => relays?.[internal] === 1).length} / 8 Active
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {RELAY_MAPPING.map(({ display, internal: relayId, name: relayName }) => {
                const isOn = relays?.[relayId] === 1;
                // Use mapping name, then relayNames prop, then "Relay X" as fallback
                const name = relayName || relayNames?.[relayId] || `Relay ${display.substring(1)}`;

                return (
                  <div
                    key={relayId}
                    className={`p-2 rounded border text-center transition ${
                      isOn
                        ? (isDark ? 'bg-iocl-orange/20 border-iocl-orange' : 'bg-orange-50 border-iocl-orange')
                        : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200')
                    }`}
                    title={name}
                  >
                    <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${isOn ? 'bg-iocl-orange shadow-sm shadow-iocl-orange/50' : (isDark ? 'bg-slate-600' : 'bg-gray-300')}`} />
                    <p className={`text-xs font-mono font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      {display}
                    </p>
                    <p className={`text-xs font-semibold ${isOn ? 'text-iocl-orange' : (isDark ? 'text-slate-500' : 'text-gray-400')}`}>
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
