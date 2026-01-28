import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { calibrationAPI } from '../services/api';
import {
  X,
  Lock,
  Beaker,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Save,
  Loader2
} from 'lucide-react';

/**
 * pH Calibration Modal
 *
 * Multi-step wizard for calibrating the pH sensor:
 * Step 0: Password verification
 * Step 1: Select calibration type (2-point or 3-point)
 * Step 2: Prepare solutions info
 * Steps 3-N: For each calibration point:
 *   - Enter known pH value
 *   - Place sensor in solution
 *   - Capture raw value
 * Final: Summary and save
 */

const PhCalibrationModal = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();

  // Wizard state
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [calibrationType, setCalibrationType] = useState('2-point');
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [points, setPoints] = useState([]);
  const [currentPhValue, setCurrentPhValue] = useState('');
  const [currentRawValue, setCurrentRawValue] = useState(null);
  const [rawValueHistory, setRawValueHistory] = useState([]);
  const [sensorInSolution, setSensorInSolution] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [calibrationStatus, setCalibrationStatus] = useState(null);

  // Polling interval for raw value
  const pollIntervalRef = useRef(null);

  // Total points based on calibration type
  const totalPoints = calibrationType === '2-point' ? 2 : 3;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setPassword('');
      setPasswordError('');
      setCalibrationType('2-point');
      setCurrentPointIndex(0);
      setPoints([]);
      setCurrentPhValue('');
      setCurrentRawValue(null);
      setRawValueHistory([]);
      setSensorInSolution(false);
      setIsCapturing(false);
      setIsSaving(false);
      setError('');

      // Load current calibration status
      loadCalibrationStatus();
    } else {
      // Stop polling when modal closes
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [isOpen]);

  // Load current calibration status
  const loadCalibrationStatus = async () => {
    try {
      const response = await calibrationAPI.getStatus();
      if (response.data.success) {
        setCalibrationStatus(response.data.ph);
      }
    } catch (err) {
      console.error('Error loading calibration status:', err);
    }
  };

  // Start polling raw value when capturing
  useEffect(() => {
    if (sensorInSolution && !isCapturing) {
      // Start polling
      pollRawValue();
      pollIntervalRef.current = setInterval(pollRawValue, 1000);
    } else {
      // Stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [sensorInSolution, isCapturing]);

  // Poll raw pH value
  const pollRawValue = async () => {
    try {
      const response = await calibrationAPI.getRawValue();
      if (response.data.success && response.data.raw !== null) {
        setCurrentRawValue(response.data.raw);
        setRawValueHistory(prev => {
          const newHistory = [...prev, response.data.raw].slice(-10);
          return newHistory;
        });
      }
    } catch (err) {
      console.error('Error polling raw value:', err);
    }
  };

  // Calculate stability (standard deviation of recent readings)
  const getStability = () => {
    if (rawValueHistory.length < 3) return { stable: false, variance: 0 };

    const mean = rawValueHistory.reduce((a, b) => a + b, 0) / rawValueHistory.length;
    const variance = rawValueHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rawValueHistory.length;
    const stdDev = Math.sqrt(variance);

    // Consider stable if std dev is less than 10
    return {
      stable: stdDev < 10,
      variance: stdDev
    };
  };

  // Verify password
  const handleVerifyPassword = async () => {
    setPasswordError('');

    if (!password) {
      setPasswordError('Please enter the calibration password');
      return;
    }

    try {
      const response = await calibrationAPI.verifyPassword(password);
      if (response.data.success) {
        setStep(1);
      }
    } catch (err) {
      setPasswordError('Invalid calibration password');
    }
  };

  // Handle start calibration
  const handleStartCalibration = () => {
    setPoints([]);
    setCurrentPointIndex(0);
    setStep(2);
  };

  // Handle solutions ready
  const handleSolutionsReady = () => {
    setCurrentPhValue('');
    setCurrentRawValue(null);
    setRawValueHistory([]);
    setSensorInSolution(false);
    setStep(3);
  };

  // Handle pH value input
  const handlePhValueSubmit = () => {
    const phValue = parseFloat(currentPhValue);

    if (isNaN(phValue) || phValue < 0 || phValue > 14) {
      setError('Please enter a valid pH value between 0 and 14');
      return;
    }

    setError('');
    setStep(4);
  };

  // Handle sensor in solution confirmation
  const handleSensorInSolution = () => {
    setSensorInSolution(true);
    setRawValueHistory([]);
    setStep(5);
  };

  // Handle capture point
  const handleCapturePoint = async () => {
    if (!currentRawValue) {
      setError('No raw value available');
      return;
    }

    setIsCapturing(true);

    // Calculate average of recent readings for more accuracy
    const avgRaw = rawValueHistory.length > 0
      ? Math.round(rawValueHistory.reduce((a, b) => a + b, 0) / rawValueHistory.length)
      : currentRawValue;

    const newPoint = {
      ph: parseFloat(currentPhValue),
      raw: avgRaw
    };

    const newPoints = [...points, newPoint];
    setPoints(newPoints);

    setIsCapturing(false);
    setSensorInSolution(false);

    // Check if more points needed
    if (newPoints.length < totalPoints) {
      setCurrentPointIndex(currentPointIndex + 1);
      setCurrentPhValue('');
      setCurrentRawValue(null);
      setRawValueHistory([]);
      setStep(6); // Point captured, continue to next
    } else {
      setStep(7); // All points captured, show summary
    }
  };

  // Handle continue to next point
  const handleContinueToNextPoint = () => {
    setStep(3); // Go back to pH input for next point
  };

  // Handle save calibration
  const handleSaveCalibration = async () => {
    setIsSaving(true);
    setError('');

    try {
      const response = await calibrationAPI.saveCalibration(
        password,
        calibrationType,
        points
      );

      if (response.data.success) {
        setStep(8); // Success
      } else {
        setError(response.data.error || 'Failed to save calibration');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save calibration');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset to default
  const handleResetToDefault = async () => {
    if (!window.confirm('Are you sure you want to reset calibration to default values?')) {
      return;
    }

    try {
      const response = await calibrationAPI.resetCalibration(password);
      if (response.data.success) {
        setCalibrationStatus(response.data.calibration.ph);
        alert('Calibration reset to default');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset calibration');
    }
  };

  if (!isOpen) return null;

  const stability = getStability();

  // Common button styles
  const primaryBtnClass = `px-4 py-2 rounded-lg font-medium transition flex items-center space-x-2 ${
    isDark
      ? 'bg-iocl-orange text-white hover:bg-iocl-orange/90'
      : 'bg-iocl-orange text-white hover:bg-iocl-orange-dark'
  }`;

  const secondaryBtnClass = `px-4 py-2 rounded-lg font-medium transition flex items-center space-x-2 ${
    isDark
      ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
  }`;

  const dangerBtnClass = `px-4 py-2 rounded-lg font-medium transition flex items-center space-x-2 ${
    isDark
      ? 'bg-red-600 text-white hover:bg-red-700'
      : 'bg-red-500 text-white hover:bg-red-600'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-lg mx-4 rounded-xl shadow-2xl ${
        isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center space-x-3">
            <Beaker className="w-6 h-6 text-iocl-orange" />
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              pH Sensor Calibration
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition ${
              isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
            }`}
          >
            <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Step 0: Password */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Lock className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Enter Calibration Password
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Calibration requires authorization
                </p>
              </div>

              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                  placeholder="Enter password"
                  className={`w-full px-4 py-3 rounded-lg border text-center text-lg tracking-widest ${
                    isDark
                      ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-iocl-orange`}
                />
                {passwordError && (
                  <p className="text-red-500 text-sm mt-2 text-center">{passwordError}</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={onClose} className={secondaryBtnClass}>
                  Cancel
                </button>
                <button onClick={handleVerifyPassword} className={primaryBtnClass}>
                  <span>Verify</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Select Calibration Type */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Select Calibration Type
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Choose the number of calibration points
                </p>
              </div>

              <div className="space-y-3">
                <label
                  className={`flex items-start p-4 rounded-lg border cursor-pointer transition ${
                    calibrationType === '2-point'
                      ? (isDark ? 'border-iocl-orange bg-iocl-orange/10' : 'border-iocl-orange bg-orange-50')
                      : (isDark ? 'border-slate-600 hover:border-slate-500' : 'border-gray-300 hover:border-gray-400')
                  }`}
                >
                  <input
                    type="radio"
                    name="calibrationType"
                    value="2-point"
                    checked={calibrationType === '2-point'}
                    onChange={(e) => setCalibrationType(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      2-Point Calibration
                    </span>
                    <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      Requires 2 buffer solutions (e.g., pH 4.0 and pH 7.0)
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start p-4 rounded-lg border cursor-pointer transition ${
                    calibrationType === '3-point'
                      ? (isDark ? 'border-iocl-orange bg-iocl-orange/10' : 'border-iocl-orange bg-orange-50')
                      : (isDark ? 'border-slate-600 hover:border-slate-500' : 'border-gray-300 hover:border-gray-400')
                  }`}
                >
                  <input
                    type="radio"
                    name="calibrationType"
                    value="3-point"
                    checked={calibrationType === '3-point'}
                    onChange={(e) => setCalibrationType(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      3-Point Calibration
                    </span>
                    <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      Requires 3 buffer solutions (e.g., pH 4.0, 7.0, and 10.0). More accurate for wider pH range.
                    </p>
                  </div>
                </label>
              </div>

              {/* Current calibration info */}
              {calibrationStatus && (
                <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                  <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Current Calibration
                  </p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    {calibrationStatus.formula}
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {calibrationStatus.isDefault ? 'Default calibration' : `Calibrated: ${new Date(calibrationStatus.calibratedAt).toLocaleString()}`}
                  </p>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button onClick={handleResetToDefault} className={dangerBtnClass}>
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset to Default</span>
                </button>
                <button onClick={handleStartCalibration} className={primaryBtnClass}>
                  <span>Start Calibration</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Prepare Solutions */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Beaker className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Prepare Your Solutions
                </h3>
              </div>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Please prepare <strong>{totalPoints}</strong> buffer solutions with known pH values.
                </p>
                <ul className={`mt-3 space-y-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  <li>• Common buffers: pH 4.0, 6.86, 7.0, 9.18, 10.0</li>
                  <li>• Make sure solutions are fresh</li>
                  <li>• Solutions should be at room temperature</li>
                  <li>• Have clean water ready to rinse sensor between solutions</li>
                </ul>
              </div>

              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(1)} className={secondaryBtnClass}>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button onClick={handleSolutionsReady} className={primaryBtnClass}>
                  <span>Solutions Ready</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Enter pH Value */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-3 ${
                  isDark ? 'bg-iocl-orange/20' : 'bg-orange-100'
                }`}>
                  <span className="text-iocl-orange font-bold">{currentPointIndex + 1}</span>
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Enter pH of Solution {currentPointIndex + 1}
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  What is the pH of your buffer solution?
                </p>
              </div>

              <div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="14"
                  value={currentPhValue}
                  onChange={(e) => setCurrentPhValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePhValueSubmit()}
                  placeholder="e.g., 7.0"
                  className={`w-full px-4 py-3 rounded-lg border text-center text-2xl font-mono ${
                    isDark
                      ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-iocl-orange`}
                />
                <p className={`text-xs mt-2 text-center ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  Common values: 4.0, 6.86, 7.0, 9.18, 10.0
                </p>
                {error && (
                  <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
                )}
              </div>

              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(currentPointIndex === 0 ? 2 : 6)} className={secondaryBtnClass}>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button onClick={handlePhValueSubmit} className={primaryBtnClass}>
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Place Sensor */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Place Sensor in Solution
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Solution {currentPointIndex + 1}: pH {currentPhValue}
                </p>
              </div>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                <ul className={`space-y-2 text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  <li>1. Place the pH sensor in the pH {currentPhValue} buffer solution</li>
                  <li>2. Make sure the sensor is fully submerged</li>
                  <li>3. Wait 30-60 seconds for the reading to stabilize</li>
                  <li>4. Click the button below when ready</li>
                </ul>
              </div>

              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(3)} className={secondaryBtnClass}>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button onClick={handleSensorInSolution} className={primaryBtnClass}>
                  <span>Sensor is in Solution</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Capture Reading */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Capture Reading
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Solution {currentPointIndex + 1}: pH {currentPhValue}
                </p>
              </div>

              {/* Live raw value display */}
              <div className={`p-6 rounded-lg text-center ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Live Raw Value
                </p>
                <p className={`text-4xl font-bold font-mono mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {currentRawValue !== null ? currentRawValue : '---'}
                </p>

                {/* Stability indicator */}
                <div className="mt-4">
                  <div className="flex items-center justify-center space-x-2">
                    {stability.stable ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-500 font-medium">Stable</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                        <span className="text-sm text-yellow-500 font-medium">Stabilizing...</span>
                      </>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    Variance: ±{stability.variance.toFixed(1)}
                  </p>
                </div>

                {/* Recent readings */}
                {rawValueHistory.length > 0 && (
                  <div className="mt-4">
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                      Recent: {rawValueHistory.slice(-5).join(', ')}
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <div className="flex justify-between mt-6">
                <button onClick={() => { setSensorInSolution(false); setStep(4); }} className={secondaryBtnClass}>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleCapturePoint}
                  disabled={isCapturing || currentRawValue === null}
                  className={`${primaryBtnClass} ${(isCapturing || currentRawValue === null) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isCapturing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Capturing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Capture Point</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Point Captured */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Point {currentPointIndex} Captured!
                </h3>
              </div>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                <div className="flex justify-between items-center">
                  <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>pH Value:</span>
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {points[currentPointIndex - 1]?.ph}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>Raw Value:</span>
                  <span className={`font-bold font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {points[currentPointIndex - 1]?.raw}
                  </span>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-600 bg-slate-800/50' : 'border-gray-300 bg-gray-50'}`}>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  <strong>Next:</strong> Remove the sensor and rinse it with clean water before placing it in the next solution.
                </p>
              </div>

              <div className="flex justify-center mt-6">
                <button onClick={handleContinueToNextPoint} className={primaryBtnClass}>
                  <span>Continue to Solution {currentPointIndex + 1}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Summary */}
          {step === 7 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Calibration Summary
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Review and save your calibration
                </p>
              </div>

              {/* Points summary */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Calibration Points
                </p>
                {points.map((point, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-0 border-slate-700">
                    <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>
                      Point {index + 1}
                    </span>
                    <span className={`font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      pH {point.ph} → Raw {point.raw}
                    </span>
                  </div>
                ))}
              </div>

              {/* Calculated formula preview */}
              {points.length >= 2 && (
                <div className={`p-4 rounded-lg border ${isDark ? 'border-iocl-orange/30 bg-iocl-orange/10' : 'border-orange-200 bg-orange-50'}`}>
                  <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    New Formula
                  </p>
                  <p className={`font-mono text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {(() => {
                      const slope = (points[1].ph - points[0].ph) / (points[1].raw - points[0].raw);
                      const offset = points[0].ph - (slope * points[0].raw);
                      return `pH = (raw × ${slope.toFixed(5)}) + (${offset.toFixed(3)})`;
                    })()}
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center space-x-2 text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button onClick={() => { setPoints([]); setCurrentPointIndex(0); setStep(2); }} className={secondaryBtnClass}>
                  <RotateCcw className="w-4 h-4" />
                  <span>Start Over</span>
                </button>
                <button
                  onClick={handleSaveCalibration}
                  disabled={isSaving}
                  className={`${primaryBtnClass} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Calibration</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 8: Success */}
          {step === 8 && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Calibration Saved!
                </h3>
                <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  The pH sensor is now calibrated. New readings will use the updated calibration formula.
                </p>
              </div>

              <div className="flex justify-center mt-6">
                <button onClick={onClose} className={primaryBtnClass}>
                  <span>Done</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {step > 0 && step < 8 && (
          <div className={`px-6 py-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-center space-x-2">
              {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition ${
                    s <= step
                      ? 'bg-iocl-orange'
                      : (isDark ? 'bg-slate-600' : 'bg-gray-300')
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhCalibrationModal;
