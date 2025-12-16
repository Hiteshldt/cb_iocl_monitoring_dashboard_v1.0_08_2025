import { AlertTriangle, WifiOff } from 'lucide-react';

const OfflineBanner = ({ lastUpdate, consecutiveFailures, maxFailures }) => {
  const formatLastUpdate = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleTimeString();
  };

  return (
    <div className="bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-red-700 rounded-full">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-bold text-sm uppercase tracking-wide">Device Offline</span>
            </div>
            <p className="text-xs text-red-200 mt-0.5">
              Unable to communicate with the device. Relay controls are disabled.
            </p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="text-red-200">
            Last data received: <span className="font-semibold text-white">{formatLastUpdate(lastUpdate)}</span>
          </p>
          {consecutiveFailures > 0 && (
            <p className="text-red-300 mt-0.5">
              {consecutiveFailures} / {maxFailures} failures
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineBanner;
