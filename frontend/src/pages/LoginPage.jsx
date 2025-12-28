import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';
import xtraO2Logo from '../assets/Xtra_O2_Logo_Final-02_-_Copy-removebg-preview.png';

const LoginPage = () => {
  const [deviceId, setDeviceId] = useState('IOCL_XTRA_O2_ADMIN');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(deviceId, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Company Header with Logo */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center bg-white rounded-xl shadow-lg p-3 mb-3">
            <img
              src={xtraO2Logo}
              alt="IOCL Xtra O2"
              className="h-16 w-auto"
            />
          </div>
          <p className="text-iocl-blue text-xs uppercase tracking-wide font-semibold">
            Air Quality Control System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-iocl-orange to-iocl-orange-dark px-4 py-2.5">
            <h2 className="text-white font-semibold text-xs uppercase tracking-wide">System Access</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Device ID
              </label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 focus:ring-1 focus:ring-iocl-orange focus:border-iocl-orange outline-none transition"
                required
                disabled
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-iocl-orange focus:border-iocl-orange outline-none transition"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-iocl-orange to-iocl-orange-dark text-white py-2 rounded font-semibold text-xs uppercase tracking-wide hover:from-iocl-orange-dark hover:to-iocl-orange focus:outline-none focus:ring-2 focus:ring-iocl-orange focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Authenticating...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="px-4 py-2.5 bg-iocl-blue border-t border-gray-200">
            <p className="text-xs text-iocl-white text-center font-medium">
              Authorized Personnel Only
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-3">
          <p className="text-xs text-iocl-blue font-medium">
            © 2025 Indian Oil Corporation Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
