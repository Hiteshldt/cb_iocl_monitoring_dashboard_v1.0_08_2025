import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { relayAPI, automationAPI } from '../services/api';
import { Power, Settings, Clock, TrendingUp, X } from 'lucide-react';

const SENSOR_OPTIONS = [
  { value: 'd1', label: 'Inlet CO₂' },
  { value: 'd2', label: 'Inlet Dust PM' },
  { value: 'd3', label: 'Inlet Temperature' },
  { value: 'd4', label: 'Inlet Humidity' },
  { value: 'd5', label: 'Inlet pH' },
  { value: 'd6', label: 'Inlet Water Level' },
  { value: 'd7', label: 'Inlet Water Temperature' },
  { value: 'd8', label: 'Outlet CO₂' },
  { value: 'd9', label: 'Outlet Dust PM' },
  { value: 'd10', label: 'Outlet Temperature' },
  { value: 'd11', label: 'Outlet Humidity' },
  { value: 'd12', label: 'Outlet Water pH' },
  { value: 'd13', label: 'Outlet Water Level' },
  { value: 'd14', label: 'Outlet Water Temperature' },
];

const RelayControl = ({ data, relayNames = {} }) => {
  const { isDark } = useTheme();
  const [relays, setRelays] = useState({});
  const [automationRules, setAutomationRules] = useState([]);
  const [editingRelay, setEditingRelay] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAutomationRules();
  }, []);

  useEffect(() => {
    if (data) {
      const relayStates = {};
      for (let i = 1; i <= 10; i++) {
        relayStates[`i${i}`] = data[`i${i}`] || 0;
      }
      setRelays(relayStates);
    }
  }, [data]);

  const fetchAutomationRules = async () => {
    try {
      const response = await automationAPI.getRules();
      setAutomationRules(response.data.rules || []);
    } catch (err) {
      console.error('Failed to fetch automation rules:', err);
    }
  };

  const getRelayRule = (relayId) => {
    return automationRules.find((r) => r.relay === relayId && r.enabled);
  };

  const handleToggleRelay = async (relayId) => {
    const currentState = relays[relayId];
    const newState = currentState === 1 ? 0 : 1;

    setLoading(true);
    try {
      await relayAPI.control(relayId, newState);
      setRelays({ ...relays, [relayId]: newState });
    } catch (err) {
      alert('Failed to control relay');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (relayId, ruleData) => {
    setLoading(true);
    try {
      const rule = {
        ...ruleData,
        relay: relayId,
        id: ruleData.id || `rule_${relayId}_${Date.now()}`,
        enabled: true,
      };

      await automationAPI.saveRule(rule);
      await fetchAutomationRules();
      setEditingRelay(null);
      alert('Automation rule saved successfully');
    } catch (err) {
      alert('Failed to save automation rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (relayId) => {
    const rule = getRelayRule(relayId);
    if (!rule) return;

    if (!confirm('Delete automation rule?')) return;

    setLoading(true);
    try {
      await automationAPI.deleteRule(rule.id);
      await fetchAutomationRules();
      alert('Automation rule deleted');
    } catch (err) {
      alert('Failed to delete automation rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center space-x-2">
          <Power className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <h2 className={`text-base font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Relay Control
          </h2>
        </div>
        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          {Object.values(relays).filter(v => v === 1).length} / 10 Active
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
            const relayId = `i${num}`;
            const isOn = relays[relayId] === 1;
            const rule = getRelayRule(relayId);
            const editing = editingRelay === relayId;
            const name = relayNames[relayId] || `Relay ${num}`;

            return (
              <div
                key={relayId}
                className={`rounded border transition ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700'
                    : 'bg-white border-gray-200 shadow-sm'
                } ${editing ? 'col-span-2 sm:col-span-3 md:col-span-5' : ''}`}
              >
                {/* Relay Header */}
                <div className={`px-3 py-2 border-b flex items-center justify-between ${
                  isDark ? 'bg-slate-700/50 border-slate-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isOn ? 'bg-green-500 shadow-sm shadow-green-500/50' : (isDark ? 'bg-slate-600' : 'bg-gray-300')}`}></div>
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {name}
                    </span>
                  </div>
                  <button
                    onClick={() => setEditingRelay(editing ? null : relayId)}
                    className={`p-1 rounded ${isDark ? 'hover:bg-slate-600' : 'hover:bg-gray-200'}`}
                  >
                    {editing ? (
                      <X className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`} />
                    ) : (
                      <Settings className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`} />
                    )}
                  </button>
                </div>

                {/* Relay Body */}
                <div className="px-3 py-2">
                  {/* Status Row */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                      {relayId.toUpperCase()}
                    </span>
                    <span className={`text-sm font-bold ${isOn ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-slate-500' : 'text-gray-400')}`}>
                      {isOn ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  {/* Current Mode Display */}
                  {rule && !editing && (
                    <div className={`mb-2 rounded px-2 py-1.5 ${isDark ? 'bg-blue-900/30 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'}`}>
                      <div className="flex items-center space-x-1.5">
                        {rule.mode === 'sensor' && <TrendingUp className="w-3.5 h-3.5 text-blue-500" />}
                        {rule.mode === 'time' && <Clock className="w-3.5 h-3.5 text-blue-500" />}
                        <span className={`text-xs font-medium ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                          {rule.mode === 'sensor' && 'Sensor Mode'}
                          {rule.mode === 'time' && 'Timer Mode'}
                          {rule.mode === 'manual' && 'Manual Mode'}
                        </span>
                      </div>
                      {rule.mode === 'sensor' && (
                        <p className={`text-xs mt-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                          {SENSOR_OPTIONS.find((s) => s.value === rule.sensor)?.label || rule.sensor}{' '}
                          {rule.operator} {rule.threshold}
                        </p>
                      )}
                      {rule.mode === 'time' && (
                        <p className={`text-xs mt-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                          {rule.startTime} - {rule.endTime}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Editing Panel */}
                  {editing && (
                    <RelayConfigPanel
                      relayId={relayId}
                      currentRule={rule}
                      onSave={handleSaveRule}
                      onCancel={() => setEditingRelay(null)}
                      onDelete={handleDeleteRule}
                      loading={loading}
                      isDark={isDark}
                    />
                  )}

                  {/* Manual Control */}
                  {!editing && (!rule || rule.mode === 'manual') && (
                    <button
                      onClick={() => handleToggleRelay(relayId)}
                      disabled={loading}
                      className={`w-full py-2 rounded text-sm font-semibold transition uppercase ${
                        isOn
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      } disabled:opacity-50`}
                    >
                      Turn {isOn ? 'OFF' : 'ON'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RelayConfigPanel = ({ relayId, currentRule, onSave, onCancel, onDelete, loading, isDark }) => {
  const [mode, setMode] = useState(currentRule?.mode || 'manual');
  const [sensor, setSensor] = useState(currentRule?.sensor || 'd1');
  const [operator, setOperator] = useState(currentRule?.operator || '<');
  const [threshold, setThreshold] = useState(currentRule?.threshold || 10);
  const [startTime, setStartTime] = useState(currentRule?.startTime || '10:00');
  const [endTime, setEndTime] = useState(currentRule?.endTime || '18:00');

  const handleSubmit = () => {
    const ruleData = {
      mode,
      id: currentRule?.id,
    };

    if (mode === 'sensor') {
      ruleData.sensor = sensor;
      ruleData.operator = operator;
      ruleData.threshold = parseFloat(threshold);
    } else if (mode === 'time') {
      ruleData.startTime = startTime;
      ruleData.endTime = endTime;
    }

    onSave(relayId, ruleData);
  };

  const inputClass = `w-full px-3 py-2 text-sm border rounded ${
    isDark
      ? 'bg-slate-700 border-slate-600 text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
  }`;

  const labelClass = `block text-xs mb-1.5 font-medium uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-600'}`;

  return (
    <div className="space-y-3 mt-2">
      {/* Mode Selector */}
      <div>
        <label className={labelClass}>Operation Mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}>
          <option value="manual">Manual Control</option>
          <option value="sensor">Sensor-Based Automation</option>
          <option value="time">Time-Based Automation</option>
        </select>
      </div>

      {/* Sensor Mode Config */}
      {mode === 'sensor' && (
        <div className={`space-y-3 p-3 rounded border ${isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200'}`}>
          <div className={`flex items-center space-x-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase">Sensor Automation</span>
          </div>

          <div>
            <label className={labelClass}>Trigger Sensor</label>
            <select value={sensor} onChange={(e) => setSensor(e.target.value)} className={inputClass}>
              {SENSOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.value.toUpperCase()} - {opt.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Condition</label>
              <select value={operator} onChange={(e) => setOperator(e.target.value)} className={inputClass}>
                <option value="<">Less than</option>
                <option value=">">Greater than</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Threshold</label>
              <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputClass} step="0.1" />
            </div>
          </div>

          <p className={`text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>
            → Relay turns ON when {sensor.toUpperCase()} {operator} {threshold}
          </p>
        </div>
      )}

      {/* Time Mode Config */}
      {mode === 'time' && (
        <div className={`space-y-3 p-3 rounded border ${isDark ? 'bg-purple-900/20 border-purple-700/50' : 'bg-purple-50 border-purple-200'}`}>
          <div className={`flex items-center space-x-2 ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
            <Clock className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase">Time Automation</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
            </div>
          </div>

          <p className={`text-sm ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
            → Relay ON daily from {startTime} to {endTime}
          </p>
        </div>
      )}

      {/* Manual Mode Info */}
      {mode === 'manual' && (
        <div className={`p-3 rounded border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            Manual mode allows direct control via the toggle button.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 uppercase"
        >
          Save Configuration
        </button>
        <button
          onClick={onCancel}
          className={`flex-1 py-2 rounded text-sm font-semibold uppercase ${
            isDark ? 'bg-slate-600 text-white hover:bg-slate-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cancel
        </button>
      </div>

      {currentRule && (
        <button
          onClick={() => onDelete(relayId)}
          className="w-full bg-red-600 text-white py-2 rounded text-sm font-semibold hover:bg-red-700 uppercase"
        >
          Delete Rule
        </button>
      )}
    </div>
  );
};

export default RelayControl;
