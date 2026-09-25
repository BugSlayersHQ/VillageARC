import React from 'react';
import Link from 'next/link';
import { BRAND, AUTH_ROUTES } from '@/constants/brand';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-inner">
          {/* Brand */}
          <div className="footer-brand">
            <Link href="/" className="footer-brand-wordmark" aria-label={`${BRAND.name} Home`}>
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
              {BRAND.name}
            </Link>
            <p className="footer-brand-desc">{BRAND.shortDescription}</p>
          </div>

          {/* Navigation */}
          <nav className="footer-nav" aria-label="Footer navigation">
            <div className="footer-nav-col">
              <h6>Platform</h6>
              <ul>
                <li>
                  <Link href="#about">About</Link>
                </li>
                <li>
                  <Link href="#workflow">How it works</Link>
                </li>
                <li>
                  <Link href="#contact">Contact</Link>
                </li>
              </ul>
            </div>
            <div className="footer-nav-col">
              <h6>Account</h6>
              <ul>
                <li>
                  <Link href={AUTH_ROUTES.signIn}>Sign in</Link>
                </li>
                <li>
                  <Link href={AUTH_ROUTES.signUp}>Get started</Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* Bottom row */}
        <div className="footer-bottom">
          <p className="footer-copyright">{BRAND.copyright(year)}</p>
        </div>
      </div>
    </footer>
  );
}
