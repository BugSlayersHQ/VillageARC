'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BRAND, NAV_FEATURES, AUTH_ROUTES } from '@/constants/brand';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFeaturesOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFeaturesOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header id="mainHeader" className="site-header">
      <div className="container nav-inner">
        {/* ── Left: Brand wordmark ── */}
        <Link href="/" aria-label={`${BRAND.name} Home`} className="nav-brand">
          {/* Brand mark — stacked-document icon with orange accent */}
          <div className="footer-brand-mark" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
          <span
            style={{
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '-0.02em',
              color: '#000000',
            }}
          >
            {BRAND.name}
          </span>
        </Link>

        {/* ── Center: Navigation links with Interactive Dropdown ── */}
        <nav aria-label="Main navigation" className="nav-center">
          <Link href="#about" className="nav-link">
            About
          </Link>

          {/* Features Dropdown */}
          <div
            ref={dropdownRef}
            className="nav-link-dropdown"
            onMouseEnter={() => setFeaturesOpen(true)}
            onMouseLeave={() => setFeaturesOpen(false)}
          >
            <button
              type="button"
              className="nav-link-trigger"
              aria-expanded={featuresOpen}
              aria-haspopup="true"
              id="featuresMenuTrigger"
              onClick={() => setFeaturesOpen(!featuresOpen)}
            >
              <span>Features</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className="nav-chevron"
                style={{ opacity: 0.6 }}
              >
                <path
                  d="M2.5 4.5L6 8L9.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {featuresOpen && (
              <div className="nav-dropdown" role="menu" aria-labelledby="featuresMenuTrigger">
                {NAV_FEATURES.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="nav-dropdown-item"
                    role="menuitem"
                    onClick={() => setFeaturesOpen(false)}
                  >
                    <div className="nav-dropdown-icon-wrap" aria-hidden="true">
                      {item.icon === 'scan' && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                          <line x1="7" y1="12" x2="17" y2="12" />
                        </svg>
                      )}
                      {item.icon === 'extract' && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="4 7 4 4 20 4 20 7" />
                          <line x1="9" y1="20" x2="15" y2="20" />
                          <line x1="12" y1="4" x2="12" y2="20" />
                        </svg>
                      )}
                      {item.icon === 'validate' && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <polyline points="9 12 11 14 15 10" />
                        </svg>
                      )}
                      {item.icon === 'structure' && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                          <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                      )}
                    </div>
                    <div className="nav-dropdown-content">
                      <div className="nav-dropdown-title-row">
                        <span className="nav-dropdown-title">{item.title}</span>
                        {item.badge && <span className="nav-dropdown-badge">{item.badge}</span>}
                      </div>
                      <span className="nav-dropdown-desc">{item.description}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="#workflow" className="nav-link">
            How it works
          </Link>
          <Link href="#contact" className="nav-link">
            Contact
          </Link>
        </nav>

        {/* ── Right: Auth Action CTAs (Sign in & Get started / Sign up) ── */}
        <div className="nav-actions">
          {/* Sign in — text link leading to Clerk sign-in */}
          <Link
            href={AUTH_ROUTES.signIn}
            className="nav-link"
            id="navSignIn"
            style={{ padding: '6px 12px' }}
          >
            Sign in
          </Link>

          {/* Get started — border pill leading to Clerk sign-up */}
          <Link href={AUTH_ROUTES.signUp} className="btn btn-secondary btn-sm" id="navGetStarted">
            Get started
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            id="mobileMenuToggle"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileOpen}
            aria-controls="mobileNavDrawer"
            className="nav-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        id="mobileNavDrawer"
        className={`nav-mobile-drawer${mobileOpen ? ' open' : ''}`}
        role="navigation"
        aria-label="Mobile navigation"
      >
        <Link href="#about" className="nav-link" onClick={() => setMobileOpen(false)}>
          About
        </Link>
        <Link href="#workflow" className="nav-link" onClick={() => setMobileOpen(false)}>
          How it works
        </Link>
        <Link href="#workflow" className="nav-link" onClick={() => setMobileOpen(false)}>
          Features
        </Link>
        <Link href="#contact" className="nav-link" onClick={() => setMobileOpen(false)}>
          Contact
        </Link>
        <div className="nav-mobile-actions">
          <Link
            href={AUTH_ROUTES.signIn}
            className="btn btn-secondary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setMobileOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href={AUTH_ROUTES.signUp}
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setMobileOpen(false)}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
