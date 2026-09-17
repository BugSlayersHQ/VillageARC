'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function SignUpPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminId, setAdminId] = useState<string>('1');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (role === 'USER' && !adminId) {
      setError('Admin ID is required for User registration');
      return;
    }

    setLoading(true);

    const payload = {
      email,
      password,
      name,
      role,
      adminId: role === 'USER' ? parseInt(adminId, 10) : undefined,
    };

    const result = await register(payload);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 600);
    } else {
      setError(result.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-header">
        <Link href="/" className="auth-brand-logo">
          <div
            className="footer-brand-mark"
            aria-hidden="true"
            style={{ width: '32px', height: '32px' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect
                x="1"
                y="4"
                width="8"
                height="9"
                rx="1"
                stroke="white"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M4 1h7a1 1 0 0 1 1 1v9"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
              <line
                x1="3"
                y1="7"
                x2="7"
                y2="7"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <line
                x1="3"
                y1="9.5"
                x2="7"
                y2="9.5"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span>{BRAND.name}</span>
        </Link>
        <p className="auth-subtitle">Create an account to start digitizing land records</p>
      </div>

      <div className="auth-card">
        <h1 className="auth-card-title">Create an account</h1>
        <p className="auth-card-desc">Select your account type to register</p>

        {/* Role Selector Tabs */}
        <div className="auth-role-tabs">
          <button
            type="button"
            className={`auth-role-tab ${role === 'USER' ? 'active' : ''}`}
            onClick={() => setRole('USER')}
          >
            <span>User Account</span>
            <span className="auth-role-badge auth-role-badge-user">USER</span>
          </button>
          <button
            type="button"
            className={`auth-role-tab ${role === 'ADMIN' ? 'active' : ''}`}
            onClick={() => setRole('ADMIN')}
          >
            <span>Admin Account</span>
            <span className="auth-role-badge auth-role-badge-admin">ADMIN</span>
          </button>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-alert auth-alert-success" role="status">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Account created successfully! Redirecting...</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label className="auth-label" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              className="auth-input"
              placeholder="e.g. Ravi Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-form-group">
            <label className="auth-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="auth-form-group">
            <label className="auth-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="auth-input"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          {role === 'USER' && (
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="adminId">
                <span>Governing Admin ID</span>
                <span className="auth-label-hint">Required for User role</span>
              </label>
              <input
                id="adminId"
                type="number"
                className="auth-input"
                placeholder="e.g. 1"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                required
                min={1}
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-dark auth-submit-btn"
            disabled={loading || success}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="animate-spin"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Creating account...
              </span>
            ) : (
              `Register as ${role === 'ADMIN' ? 'Admin' : 'User'}`
            )}
          </button>
        </form>

        <div className="auth-footer-link">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
