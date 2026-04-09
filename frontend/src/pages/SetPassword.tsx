import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { authAPI } from '../services/api';

const SetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token') || '';
  const isResetFlow = location.pathname === '/forgot-password';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await authAPI.requestPasswordSetup(email.trim().toLowerCase());
      setSuccess(res.message || 'If the account exists, a reset link has been sent.');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(
        axiosError?.response?.data?.detail ||
        axiosError?.response?.data?.message ||
        axiosError?.message ||
        'Failed to send reset email.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.confirmPasswordSetup(token, password);
      setSuccess(res.message || 'Password set successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(
        axiosError?.response?.data?.detail ||
        axiosError?.response?.data?.message ||
        axiosError?.message ||
        'Failed to set password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <Link to="/" className="flex items-center justify-center space-x-3 mb-6">
          <img src="/logo.svg" alt="Zeal Catalyst logo" className="w-10 h-10 rounded-xl" />
          <span className="text-xl font-bold gradient-text">Zeal Catalyst</span>
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {token ? 'Set New Password' : isResetFlow ? 'Forgot Password' : 'Get Password Setup Link'}
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          {token
            ? 'Set a new password to login with email and password.'
            : isResetFlow
              ? 'Enter your account email to receive a secure password reset link.'
              : 'Enter your account email to receive a secure setup link.'}
        </p>

        {error && <div className="mb-4 p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}
        {success && <div className="mb-4 p-3 text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg">{success}</div>}

        {!token ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Sending...' : isResetFlow ? 'Send Reset Link' : 'Send Setup Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="At least 8 characters"
              />
            </div>

            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="Re-enter password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? 'Saving...' : isResetFlow ? 'Reset Password' : 'Set Password'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="text-primary-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
};

export default SetPassword;
