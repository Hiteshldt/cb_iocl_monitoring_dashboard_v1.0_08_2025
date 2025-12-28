import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { relayAPI, automationAPI } from '../services/api';
import { Power, Settings, Clock, TrendingUp, X, WifiOff, Zap, Loader2 } from 'lucide-react';

const SENSOR_OPTIONS = [
  { value: 'd1', label: 'Inlet CO₂' },
  { value: 'd2', label: 'Inlet Dust PM' },
  { value: 'd3', label: 'Inlet Temperature' },
  { value: 'd4', label: 'Inlet Humidity' },
  { value: 'd5', label: 'Inlet pH' },
  { value: 'd6', label: 'Inlet Water Level' },
  { value: 'd7', label: 'Inlet Water Temp' },
  { value: 'd8', label: 'Outlet CO₂' },
  { value: 'd9', label: 'Outlet Dust PM' },
  { value: 'd10', label: 'Outlet Temperature' },
  { value: 'd11', label: 'Outlet Humidity' },
  { value: 'd12', label: 'Outlet Water pH' },
  { value: 'd13', label: 'Outlet Water Level' },
  { value: 'd14', label: 'Outlet Water Temp' },
];

// Mode colors for visual distinction
const getModeColors = (mode, isDark) => {
  switch (mode) {
    case 'sensor':
      return {
        bg: isDark ? 'bg-green-900/20' : 'bg-green-50',
        border: isDark ? 'border-green-700/50' : 'border-green-300',
        text: isDark ? 'text-green-400' : 'text-green-700',
        icon: isDark ? 'text-green-400' : 'text-green-600',
        badge: isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800'
      };
    case 'time':
      return {
        bg: isDark ? 'bg-purple-900/20' : 'bg-purple-50',
        border: isDark ? 'border-purple-700/50' : 'border-purple-300',
        text: isDark ? 'text-purple-400' : 'text-purple-700',
        icon: isDark ? 'text-purple-400' : 'text-purple-600',
        badge: isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-800'
      };
    default: // manual
      return {
        bg: isDark ? 'bg-slate-800/50' : 'bg-gray-50',
        border: isDark ? 'border-slate-700' : 'border-gray-200',
        text: isDark ? 'text-slate-400' : 'text-gray-600',
        icon: isDark ? 'text-slate-400' : 'text-gray-500',
        badge: isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'
      };
  }
};

// Relay mapping: Display name (R1-R8) to internal ID (i1-i8)
const RELAY_MAPPING = [
  { display: 'R1', internal: 'i4' },
  { display: 'R2', internal: 'i1' },
  { display: 'R3', internal: 'i2' },
  { display: 'R4', internal: 'i3' },
  { display: 'R5', internal: 'i8' },
  { display: 'R6', internal: 'i5' },
  { display: 'R7', internal: 'i6' },
  { display: 'R8', internal: 'i7' },
];

const RelayControl = ({ data, relayNames = {}, deviceStatus = {} }) => {
  const { isDark } = useTheme();
  const [relays, setRelays] = useState({});
  const [automationRules, setAutomationRules] = useState([]);
  const [editingRelay, setEditingRelay] = useState(null);
  const [loading, setLoading] = useState(false);

  // Track pending relay changes awaiting confirmation
  const [pendingRelays, setPendingRelays] = useState({}); // { relayId: { targetState, timestamp } }
  const pendingTimeoutsRef = useRef({}); // Store timeout IDs for cleanup
  const pendingRelaysRef = useRef({}); // Ref to track pending relays for use in useEffect

  // Keep ref in sync with state
  useEffect(() => {
    pendingRelaysRef.current = pendingRelays;
  }, [pendingRelays]);

  // Check if device is offline
  const isOffline = deviceStatus?.hasData !== undefined && !deviceStatus?.online;

  useEffect(() => {
    fetchAutomationRules();

    // Cleanup timeouts on unmount
    return () => {
      Object.values(pendingTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (data) {
      const newRelayStates = {};
      const confirmedRelays = []; // Track which relays got confirmed

      // Only track relays used in RELAY_MAPPING (i1-i8)
      RELAY_MAPPING.forEach(({ internal: relayId }) => {
        newRelayStates[relayId] = data[relayId] || 0;

        // Check if this relay was pending and now matches the target state
        const pending = pendingRelaysRef.current[relayId];
        if (pending) {
          if (newRelayStates[relayId] === pending.targetState) {
            // Relay confirmed!
            confirmedRelays.push(relayId);
          }
        }
      });

      setRelays(newRelayStates);

      // Clear confirmed relays after state update
      if (confirmedRelays.length > 0) {
        confirmedRelays.forEach(relayId => clearPendingRelay(relayId));
      }
    }
  }, [data]);

  const clearPendingRelay = (relayId) => {
    // Clear timeout
    if (pendingTimeoutsRef.current[relayId]) {
      clearTimeout(pendingTimeoutsRef.current[relayId]);
      delete pendingTimeoutsRef.current[relayId];
    }
    // Remove from pending state
    setPendingRelays(prev => {
      const updated = { ...prev };
      delete updated[relayId];
      return updated;
    });
  };

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
    if (isOffline) {
      alert('Device is offline. Cannot control relays.');
      return;
    }

    // Don't allow toggle if this relay is already pending
    if (pendingRelays[relayId]) {
      return;
    }

    const currentState = relays[relayId];
    const newState = currentState === 1 ? 0 : 1;

    // Set pending state BEFORE API call
    setPendingRelays(prev => ({
      ...prev,
      [relayId]: { targetState: newState, timestamp: Date.now() }
    }));

    try {
      await relayAPI.control(relayId, newState);

      // Set a timeout - if not confirmed within 30 seconds, clear pending and show error
      pendingTimeoutsRef.current[relayId] = setTimeout(() => {
        // Check if still pending (not confirmed)
        setPendingRelays(prev => {
          if (prev[relayId]) {
            alert(`Relay ${relayId.toUpperCase()} change not confirmed. Please check device connection.`);
            const updated = { ...prev };
            delete updated[relayId];
            return updated;
          }
          return prev;
        });
        delete pendingTimeoutsRef.current[relayId];
      }, 30000); // 30 second timeout

    } catch (err) {
      // Clear pending state on error
      clearPendingRelay(relayId);

      if (err.response?.status === 503) {
        alert('Device is offline. Cannot control relays.');
      } else {
        alert('Failed to control relay');
      }
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
    <div className={`rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'} ${isOffline ? 'opacity-75' : ''}`}>
      {/* Offline Warning */}
      {isOffline && (
        <div className={`px-4 py-2 flex items-center space-x-2 ${isDark ? 'bg-red-900/30 border-b border-red-700/50' : 'bg-red-50 border-b border-red-200'}`}>
          <WifiOff className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
          <span className={`text-xs font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
            Device is offline. Relay controls are disabled.
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center space-x-2">
          <Power className={`w-5 h-5 ${isOffline ? (isDark ? 'text-slate-500' : 'text-gray-400') : 'text-iocl-orange'}`} />
          <h2 className={`text-base font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Relay Control
          </h2>
        </div>
        <div className="flex items-center space-x-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center space-x-2 text-xs">
            <span className={`px-1.5 py-0.5 rounded ${getModeColors('manual', isDark).badge}`}>Manual</span>
            <span className={`px-1.5 py-0.5 rounded ${getModeColors('sensor', isDark).badge}`}>Sensor</span>
            <span className={`px-1.5 py-0.5 rounded ${getModeColors('time', isDark).badge}`}>Timer</span>
          </div>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
            {Object.values(relays).filter(v => v === 1).length} / 8 Active
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-2">
          {RELAY_MAPPING.map(({ display, internal: relayId }) => {
            const isOn = relays[relayId] === 1;
            const rule = getRelayRule(relayId);
            const editing = editingRelay === relayId;
            const name = relayNames[relayId] || display;
            const mode = rule?.mode || 'manual';
            const modeColors = getModeColors(mode, isDark);
            const isPending = !!pendingRelays[relayId];
            const pendingTarget = pendingRelays[relayId]?.targetState;

            return (
              <div
                key={relayId}
                className={`rounded border transition ${modeColors.bg} ${modeColors.border} ${isPending ? 'ring-2 ring-yellow-500/50' : ''}`}
              >
                {/* Relay Header - Compact */}
                <div className={`px-2 py-1.5 border-b flex items-center justify-between ${isDark ? 'border-slate-700/50' : 'border-gray-200/50'}`}>
                  <div className="flex items-center space-x-1.5">
                    <div className={`w-2 h-2 rounded-full ${
                      isPending
                        ? 'bg-yellow-500 animate-pulse'
                        : isOn
                          ? 'bg-iocl-orange shadow-sm shadow-iocl-orange/50'
                          : (isDark ? 'bg-slate-600' : 'bg-gray-300')
                    }`}></div>
                    <span className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`} title={name}>
                      {name.length > 12 ? name.substring(0, 10) + '...' : name}
                    </span>
                  </div>
                  <button
                    onClick={() => setEditingRelay(editing ? null : relayId)}
                    disabled={isPending}
                    className={`p-0.5 rounded ${isDark ? 'hover:bg-slate-600' : 'hover:bg-gray-200'} ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {editing ? (
                      <X className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`} />
                    ) : (
                      <Settings className={`w-3.5 h-3.5 ${modeColors.icon}`} />
                    )}
                  </button>
                </div>

                {/* Relay Body - Compact */}
                <div className="px-2 py-1.5">
                  {/* Status & Mode Badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                      {display}
                    </span>
                    <div className="flex items-center space-x-1">
                      {isPending && <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />}
                      {mode !== 'manual' && !isPending && (
                        <span className={`text-xs ${modeColors.icon}`}>
                          {mode === 'sensor' ? <TrendingUp className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        </span>
                      )}
                      <span className={`text-xs font-bold ${
                        isPending
                          ? 'text-yellow-500'
                          : isOn
                            ? 'text-iocl-orange'
                            : (isDark ? 'text-slate-500' : 'text-gray-400')
                      }`}>
                        {isPending ? (pendingTarget === 1 ? 'ON...' : 'OFF...') : (isOn ? 'ON' : 'OFF')}
                      </span>
                    </div>
                  </div>

                  {/* Current Mode Display - Compact */}
                  {rule && !editing && (
                    <div className={`mb-1.5 rounded px-1.5 py-1 text-xs ${modeColors.badge}`}>
                      {rule.mode === 'sensor' && (
                        <span className="truncate block">
                          {SENSOR_OPTIONS.find((s) => s.value === rule.sensor)?.label?.split(' ')[1] || rule.sensor} {rule.operator} {rule.threshold}
                        </span>
                      )}
                      {rule.mode === 'time' && (
                        <span>{rule.startTime}-{rule.endTime}</span>
                      )}
                    </div>
                  )}

                  {/* Editing Panel - Compact */}
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

                  {/* Manual Control Button - Compact */}
                  {!editing && (!rule || rule.mode === 'manual') && (
                    <button
                      onClick={() => handleToggleRelay(relayId)}
                      disabled={loading || isOffline || isPending}
                      className={`w-full py-1.5 rounded text-xs font-semibold transition uppercase flex items-center justify-center space-x-1 ${
                        isPending
                          ? 'bg-yellow-600 text-white cursor-wait'
                          : isOffline
                            ? (isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                            : isOn
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                      } disabled:opacity-50`}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Switching...</span>
                        </>
                      ) : (
                        <span>{isOffline ? 'Offline' : isOn ? 'Turn OFF' : 'Turn ON'}</span>
                      )}
                    </button>
                  )}

                  {/* Automation Active Indicator */}
                  {!editing && rule && rule.mode !== 'manual' && (
                    <div className={`w-full py-1.5 rounded text-xs font-medium text-center ${modeColors.badge}`}>
                      <Zap className="w-3 h-3 inline mr-1" />
                      Auto
                    </div>
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
    const ruleData = { mode, id: currentRule?.id };
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

  const selectClass = `w-full px-1 py-0.5 text-xs border rounded ${
    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  return (
    <div className="space-y-1">
      {/* Mode Select */}
      <select value={mode} onChange={(e) => setMode(e.target.value)} className={selectClass}>
        <option value="manual">Manual</option>
        <option value="sensor">Sensor</option>
        <option value="time">Timer</option>
      </select>

      {/* Sensor Config */}
      {mode === 'sensor' && (
        <div className="space-y-1">
          <select value={sensor} onChange={(e) => setSensor(e.target.value)} className={selectClass}>
            {SENSOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex space-x-1">
            <select value={operator} onChange={(e) => setOperator(e.target.value)} className={`${selectClass} w-10 shrink-0`}>
              <option value="<">&lt;</option>
              <option value=">">&gt;</option>
            </select>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className={`${selectClass} flex-1 min-w-0`}
              step="0.1"
              placeholder="Value"
            />
          </div>
        </div>
      )}

      {/* Time Config */}
      {mode === 'time' && (
        <div className="flex space-x-1">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${selectClass} flex-1`} />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${selectClass} flex-1`} />
        </div>
      )}

      {/* Buttons */}
      <div className="flex space-x-1">
        <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-iocl-orange text-white py-1 rounded text-xs hover:bg-iocl-orange-dark">
          ✓
        </button>
        <button onClick={onCancel} className={`flex-1 py-1 rounded text-xs ${isDark ? 'bg-slate-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
          ✕
        </button>
        {currentRule && (
          <button onClick={() => onDelete(relayId)} className="px-1.5 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
            🗑
          </button>
        )}
      </div>
    </div>
  );
};

export default RelayControl;
