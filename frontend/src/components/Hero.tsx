import React from 'react';
import Link from 'next/link';
import { BRAND, AUTH_ROUTES } from '@/constants/brand';

export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-bg-overlay" aria-hidden="true" />
      <div className="container">
        <div className="hero-inner">
          {/* ── Announcement badge (matches GitBook "New · Feature →" pill) ── */}
          <div className="hero-badge-wrap">
            <a href="#workflow" className="hero-badge" id="heroBadgeLink">
              <span className="hero-badge-pill">New</span>
              <span className="hero-badge-text">{BRAND.versionBadge}</span>
            </a>
          </div>

          {/* ── Heading — large, centered, with orange accent on the key phrase ── */}
          <h1 className="hero-heading">
            Turn legacy land records into{' '}
            <span className="hero-heading-accent">trusted digital data.</span>
          </h1>

          {/* ── Supporting paragraph — narrow, centered ── */}
          <p className="hero-body">{BRAND.fullDescription}</p>

          {/* ── CTA buttons — dark pill primary + ghost secondary ── */}
          <div className="hero-cta">
            <Link
              href={AUTH_ROUTES.signUp}
              id="heroGetStarted"
              className="btn btn-dark hero-cta-primary"
            >
              Get Started
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <a
              href="#workflow"
              id="heroHowItWorks"
              className="btn btn-secondary hero-cta-secondary"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
              </svg>
              See how it works
            </a>
          </div>

          {/* ── Product visualization — commented out as requested until dashboards are ready ── */}
          {/* <div className="hero-vis-wrap">
            <ProductVisualization />
          </div> */}
        </div>
      </div>
    </section>
  );
}
