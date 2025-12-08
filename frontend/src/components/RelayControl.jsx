import { useState, useEffect } from 'react';
import { relayAPI, automationAPI } from '../services/api';
import { Power, Settings, Clock, TrendingUp } from 'lucide-react';

const SENSOR_OPTIONS = [
  { value: 'd1', label: 'Inlet-CO₂' },
  { value: 'd2', label: 'Inlet-Dust PM' },
  { value: 'd3', label: 'Inlet-Temperature' },
  { value: 'd4', label: 'Inlet-Humidity' },
  { value: 'd5', label: 'Inlet-Water PH' },
  { value: 'd6', label: 'Inlet-Water Level' },
  { value: 'd7', label: 'Inlet-Water Temp' },
  { value: 'd8', label: 'Outlet-CO₂' },
  { value: 'd9', label: 'Outlet-Dust PM' },
  { value: 'd10', label: 'Outlet-Temperature' },
  { value: 'd11', label: 'Outlet-Humidity' },
  { value: 'd12', label: 'Outlet-Water PH' },
  { value: 'd13', label: 'Outlet-Water Level' },
  { value: 'd14', label: 'Outlet-Water Temp' },
];

const RelayControl = ({ data }) => {
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
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center uppercase tracking-wide">
        <Power className="w-4 h-4 mr-2 text-blue-600" />
        Relay Control
      </h2>

      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const relayId = `i${num}`;
          const isOn = relays[relayId] === 1;
          const rule = getRelayRule(relayId);
          const editing = editingRelay === relayId;

          return (
            <div key={relayId} className="border border-gray-200 rounded bg-gray-50 p-2.5 hover:border-gray-300 transition">
              {/* Relay Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isOn ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  ></div>
                  <span className="font-semibold text-gray-900 text-xs">
                    Relay {num}
                  </span>
                  <span className="text-[10px] text-gray-500">({relayId})</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs font-bold ${
                      isOn ? 'text-green-700' : 'text-gray-600'
                    }`}
                  >
                    {isOn ? 'ON' : 'OFF'}
                  </span>
                  <button
                    onClick={() =>
                      setEditingRelay(editing ? null : relayId)
                    }
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Settings className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Current Mode Display */}
              {rule && !editing && (
                <div className="mb-2 bg-blue-50 border border-blue-200 rounded p-1.5">
                  <p className="text-xs text-blue-900 font-medium">
                    <strong>Mode:</strong>{' '}
                    {rule.mode === 'sensor' && 'Sensor-Based'}
                    {rule.mode === 'time' && 'Time-Based'}
                    {rule.mode === 'manual' && 'Manual'}
                  </p>
                  {rule.mode === 'sensor' && (
                    <p className="text-[10px] text-blue-700">
                      {SENSOR_OPTIONS.find((s) => s.value === rule.sensor)
                        ?.label || rule.sensor}{' '}
                      {rule.operator} {rule.threshold}
                    </p>
                  )}
                  {rule.mode === 'time' && (
                    <p className="text-[10px] text-blue-700">
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
                  onToggle={handleToggleRelay}
                  loading={loading}
                />
              )}

              {/* Manual Control (only if not editing and mode is manual) */}
              {!editing && (!rule || rule.mode === 'manual') && (
                <button
                  onClick={() => handleToggleRelay(relayId)}
                  disabled={loading}
                  className={`w-full py-1.5 rounded text-xs font-semibold transition uppercase ${
                    isOn
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:opacity-50`}
                >
                  Turn {isOn ? 'OFF' : 'ON'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RelayConfigPanel = ({
  relayId,
  currentRule,
  onSave,
  onCancel,
  onDelete,
  onToggle,
  loading,
}) => {
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

  return (
    <div className="space-y-2 mt-2">
      {/* Mode Selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
          Operation Mode
        </label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="manual">Manual</option>
          <option value="sensor">Sensor-Based</option>
          <option value="time">Time-Based</option>
        </select>
      </div>

      {/* Sensor Mode Config */}
      {mode === 'sensor' && (
        <div className="space-y-2 bg-green-50 p-2 rounded border border-green-200">
          <div className="flex items-center space-x-1.5 text-green-700">
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs font-semibold uppercase">Sensor Automation</span>
          </div>

          <div>
            <label className="block text-[10px] text-gray-700 mb-1 uppercase tracking-wide font-semibold">
              Trigger Sensor
            </label>
            <select
              value={sensor}
              onChange={(e) => setSensor(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-900"
            >
              {SENSOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} - {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-700 mb-1 uppercase tracking-wide font-semibold">
                Operator
              </label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-900"
              >
                <option value="<">{'<'} Less than</option>
                <option value=">">{'>'} Greater than</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-gray-700 mb-1 uppercase tracking-wide font-semibold">
                Threshold
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-900"
                step="0.1"
              />
            </div>
          </div>

          <p className="text-[10px] text-green-800">
            Relay ON when {sensor} {operator} {threshold}
          </p>
        </div>
      )}

      {/* Time Mode Config */}
      {mode === 'time' && (
        <div className="space-y-2 bg-purple-50 p-2 rounded border border-purple-200">
          <div className="flex items-center space-x-1.5 text-purple-700">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-semibold uppercase">Time Automation</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-700 mb-1 uppercase tracking-wide font-semibold">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-700 mb-1 uppercase tracking-wide font-semibold">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-900"
              />
            </div>
          </div>

          <p className="text-[10px] text-purple-800">
            Relay ON daily: {startTime} to {endTime}
          </p>
        </div>
      )}

      {/* Manual Mode Info */}
      {mode === 'manual' && (
        <div className="bg-gray-50 p-2 rounded border border-gray-200">
          <p className="text-xs text-gray-700">
            Manual control via button below
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-1.5">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 uppercase"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-300 text-gray-700 py-1.5 rounded text-xs font-semibold hover:bg-gray-400 uppercase"
        >
          Cancel
        </button>
      </div>

      {currentRule && (
        <button
          onClick={() => onDelete(relayId)}
          className="w-full bg-red-600 text-white py-1.5 rounded text-xs font-semibold hover:bg-red-700 uppercase"
        >
          Delete Rule
        </button>
      )}
    </div>
  );
};

export default RelayControl;
