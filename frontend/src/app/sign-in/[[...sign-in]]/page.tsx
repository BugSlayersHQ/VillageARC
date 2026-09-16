import React from 'react';
import Link from 'next/link';
import { BRAND } from '@/constants/brand';

// Dynamic import with fallback for seamless installation
let SignInComponent: React.ComponentType<{ appearance?: Record<string, unknown> }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerk = require('@clerk/nextjs');
  SignInComponent = clerk.SignIn;
} catch {
  SignInComponent = null;
}

export default function SignInPage() {
  return (
    <div className="auth-page-container">
      <div className="auth-header">
        <Link href="/" className="auth-brand-logo">
          <svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect x="2" y="6" width="12" height="14" rx="2" fill="#fe551b" />
            <rect x="6" y="2" width="12" height="14" rx="2" fill="#1c1917" opacity="0.85" />
            <line
              x1="9"
              y1="7"
              x2="15"
              y2="7"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <line
              x1="9"
              y1="10"
              x2="15"
              y2="10"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <line
              x1="9"
              y1="13"
              x2="13"
              y2="13"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span>{BRAND.name}</span>
        </Link>
        <p className="auth-subtitle">Sign in to access your digital land records</p>
      </div>

      {SignInComponent ? (
        <SignInComponent
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg border border-[#e5e5e5] rounded-xl',
              formButtonPrimary: 'bg-[#fe551b] hover:bg-[#e0440f] text-white',
            },
          }}
        />
      ) : (
        <div
          style={{
            background: '#ffffff',
            padding: '24px 32px',
            borderRadius: '12px',
            border: '1px solid #e5e5e5',
            maxWidth: '420px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <p style={{ fontWeight: 700, fontSize: '15px', color: '#000000', marginBottom: '8px' }}>
            Clerk Sign In
          </p>
          <p style={{ fontSize: '13px', color: '#57534d', lineHeight: 1.5, marginBottom: '16px' }}>
            Install the dependency with <code>pnpm add @clerk/nextjs</code> and add your Clerk API
            keys in <code>.env.local</code> to activate the live authentication form.
          </p>
          <Link href="/" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex' }}>
            ← Back to Home
          </Link>
        </div>
      )}
    </div>
  );
}
