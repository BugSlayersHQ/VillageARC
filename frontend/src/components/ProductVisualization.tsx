'use client';

import React, { useState } from 'react';

// Bounding box entities extracted from the land record
interface BBoxEntity {
  id: string;
  field: string;
  value: string;
  hindiLabel: string;
  tag: string;
  color: 'blue' | 'orange' | 'green' | 'purple' | 'amber';
  confidence: string;
  status: string;
  statusType: string;
}

const EXTRACTED_ENTITIES: BBoxEntity[] = [
  {
    id: 'owner',
    field: 'Owner Name',
    value: 'Ramesh Kumar Singh (रमेश कुमार सिंह)',
    hindiLabel: 'मालिक / रैयत का नाम:',
    tag: '👤 Owner · 99.4%',
    color: 'blue',
    confidence: '99.4%',
    status: 'Validated',
    statusType: 'blue',
  },
  {
    id: 'khasra',
    field: 'Khasra / Plot No',
    value: '147-B / 89 (खसरा संख्या १४७-ख)',
    hindiLabel: 'खसरा / खेसरा संख्या:',
    tag: '📍 Plot 147-B · 98.8%',
    color: 'orange',
    confidence: '98.8%',
    status: 'Cadastral Matched',
    statusType: 'orange',
  },
  {
    id: 'area',
    field: 'Total Area',
    value: '2.45 Bigha (6,170 sq.m)',
    hindiLabel: 'रकबा / क्षेत्रफल:',
    tag: '📐 Area · 99.1%',
    color: 'green',
    confidence: '99.1%',
    status: 'Geo-Verified',
    statusType: 'green',
  },
  {
    id: 'village',
    field: 'Jurisdiction',
    value: 'Barauli, Dist. Saran (सारण)',
    hindiLabel: 'ग्राम / मौजा व थाना:',
    tag: '🏛️ Saran · 97.9%',
    color: 'purple',
    confidence: '97.9%',
    status: 'Revenue Code 8412',
    statusType: 'purple',
  },
  {
    id: 'date',
    field: 'Mutation Date',
    value: '15 March 1994 (Entry #47)',
    hindiLabel: 'दाखिल खारिज दिनांक:',
    tag: '📅 Registered · 99.6%',
    color: 'amber',
    confidence: '99.6%',
    status: 'Certified Record',
    statusType: 'amber',
  },
];

const TABS = [
  { id: 'ocr', label: 'OCR & Bounding Boxes', active: true },
  { id: 'insights', label: 'AI Insights & Validation', active: false },
  { id: 'cadastral', label: 'Cadastral GIS Cross-Check', active: false },
  { id: 'audit', label: 'Proactive Audit & Discrepancies', active: false },
];

export default function ProductVisualization() {
  const [activeTab, setActiveTab] = useState('ocr');
  const [activeEntityId, setActiveEntityId] = useState<string | null>('khasra');
  const [subnavTab, setSubnavTab] = useState<'doc' | 'api' | 'audit' | 'gis'>('doc');
  const [copied, setCopied] = useState(false);

  const activeEntity = EXTRACTED_ENTITIES.find((e) => e.id === activeEntityId);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* ── Top Capsule Switcher Tabs (Matching GitBook Hero pattern) ── */}
      <div className="vis-capsule-nav" role="tablist" aria-label="Product views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`vis-capsule-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.id === 'ocr' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" />
              </svg>
            )}
            {tab.id === 'insights' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
            {tab.id === 'cadastral' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            )}
            {tab.id === 'audit' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Orange Decorative Background Glow & Swoosh Ribbons (GitBook Visual DNA) ── */}
      <div className="vis-backdrop-swoosh" aria-hidden="true">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1100 550"
          fill="none"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
        >
          <path
            d="M-50,120 Q300,-40 600,60 T1150,140"
            stroke="url(#orangeGrad1)"
            strokeWidth="54"
            strokeLinecap="round"
            opacity="0.28"
          />
          <path
            d="M-80,480 Q250,560 650,470 T1180,510"
            stroke="url(#orangeGrad2)"
            strokeWidth="60"
            strokeLinecap="round"
            opacity="0.22"
          />
          <defs>
            <linearGradient id="orangeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fe551b" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#febc2e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#fe551b" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="orangeGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fe551b" stopOpacity="0" />
              <stop offset="50%" stopColor="#fe551b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#febc2e" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ── Outer Application Window Mockup ── */}
      <div
        className="product-vis-container"
        role="region"
        aria-label="VillageARC Document Intelligence Sandbox"
      >
        {/* Top Window Bar */}
        <div className="vis-window-top">
          <div className="vis-window-controls">
            <span className="vis-dot vis-dot-red" aria-hidden="true" />
            <span className="vis-dot vis-dot-amber" aria-hidden="true" />
            <span className="vis-dot vis-dot-green" aria-hidden="true" />
          </div>

          <div className="vis-window-brand">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fe551b"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>VillageARC Intelligence</span>
          </div>

          <div className="vis-window-search">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Search Khasra, Owner, Jamabandi ID...</span>
            <span className="vis-kbd">Ctrl K</span>
          </div>

          <div className="vis-window-actions">
            <span className="vis-window-tag">● Live Engine v2.4</span>
          </div>
        </div>

        {/* Sub-Navigation Bar */}
        <div className="vis-subnav">
          <button
            type="button"
            className={`vis-subnav-tab ${subnavTab === 'doc' ? 'active' : ''}`}
            onClick={() => setSubnavTab('doc')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Interactive Document
          </button>
          <button
            type="button"
            className={`vis-subnav-tab ${subnavTab === 'api' ? 'active' : ''}`}
            onClick={() => setSubnavTab('api')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Extracted JSON API
          </button>
          <button
            type="button"
            className={`vis-subnav-tab ${subnavTab === 'audit' ? 'active' : ''}`}
            onClick={() => setSubnavTab('audit')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Cadastral Cross-Check
          </button>
        </div>

        {/* ── Main Split View Body: Left Document Bounding Boxes · Right AI Assistant ── */}
        <div className="vis-content-split">
          {/* ════════ LEFT: Scanned Land Record with Bounding Boxes ════════ */}
          <div className="vis-doc-panel">
            <div className="vis-doc-meta-bar">
              <span>
                Source: <strong>Record of Rights (Khatoni 1994)</strong>
              </span>
              <span className="vis-doc-status-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                5 Bounding Boxes Active
              </span>
            </div>

            {/* Simulated Authenticated Land Deed Sheet */}
            <div className="vis-paper-sheet">
              {/* Official Stamp Watermark */}
              <div className="vis-paper-stamp">
                <span>GOVT OF BIHAR</span>
                <span style={{ fontSize: '7px' }}>★ REVENUE ★</span>
                <span>SEAL 1994</span>
              </div>
              <div className="vis-paper-watermark">VILLAGEARC VERIFIED</div>

              {/* Document Header */}
              <div className="vis-paper-header">
                <div className="vis-paper-title">बिहार सरकार · राजस्व एवं भूमि सुधार विभाग</div>
                <div className="vis-paper-subtitle">
                  GOVERNMENT OF BIHAR — DEPARTMENT OF REVENUE & LAND REFORMS (SARAN)
                </div>
              </div>

              {/* Form Content with Interactive Bounding Boxes */}
              <div className="bbox-container">
                {/* Line 1: Owner Name (Blue Box) */}
                <div className="bbox-line">
                  <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>
                    मालिक / रैयत का नाम:
                  </span>
                  <div
                    className={`bbox-item bbox-blue ${activeEntityId === 'owner' ? 'active' : ''}`}
                    onClick={() => setActiveEntityId('owner')}
                    title="Click to view extracted details"
                  >
                    <span className="bbox-tag">👤 Owner (99.4%)</span>
                    <strong>रमेश कुमार सिंह (Ramesh Kumar Singh)</strong>
                  </div>
                </div>

                {/* Line 2: Khasra & Plot (Orange Box) */}
                <div className="bbox-line">
                  <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>
                    खसरा संख्या (Plot No):
                  </span>
                  <div
                    className={`bbox-item bbox-orange ${activeEntityId === 'khasra' ? 'active' : ''}`}
                    onClick={() => setActiveEntityId('khasra')}
                    title="Click to view extracted details"
                  >
                    <span className="bbox-tag">📍 Khasra 147-B (98.8%)</span>
                    <strong>१४७-ख (Plot 147-B / 89)</strong>
                  </div>
                </div>

                {/* Line 3: Area / Measurement (Green Box) */}
                <div className="bbox-line">
                  <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>
                    रकबा / कुल क्षेत्रफल:
                  </span>
                  <div
                    className={`bbox-item bbox-green ${activeEntityId === 'area' ? 'active' : ''}`}
                    onClick={() => setActiveEntityId('area')}
                    title="Click to view extracted details"
                  >
                    <span className="bbox-tag">📐 Area (99.1%)</span>
                    <strong>२.४५ बीघा (2.45 Bigha / 6,170 m²)</strong>
                  </div>
                </div>

                {/* Line 4: Village & Jurisdiction (Purple Box) */}
                <div className="bbox-line">
                  <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>
                    ग्राम / मौजा व परगना:
                  </span>
                  <div
                    className={`bbox-item bbox-purple ${activeEntityId === 'village' ? 'active' : ''}`}
                    onClick={() => setActiveEntityId('village')}
                    title="Click to view extracted details"
                  >
                    <span className="bbox-tag">🏛️ Village (97.9%)</span>
                    <strong>बरौली, थाना सारण (Barauli, Saran)</strong>
                  </div>
                </div>

                {/* Line 5: Registration Date & Mutation (Amber Box) */}
                <div className="bbox-line">
                  <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>
                    दाखिल खारिज दिनांक:
                  </span>
                  <div
                    className={`bbox-item bbox-amber ${activeEntityId === 'date' ? 'active' : ''}`}
                    onClick={() => setActiveEntityId('date')}
                    title="Click to view extracted details"
                  >
                    <span className="bbox-tag">📅 Registered (99.6%)</span>
                    <strong>१५/०३/१९९४ (Entry #47)</strong>
                  </div>
                </div>
              </div>

              {/* Bottom Document Notice */}
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '10px',
                  borderTop: '1px dashed #cbd5e1',
                  fontSize: '9.5px',
                  color: '#64748b',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>हस्ताक्षर अंचलाधिकारी / Revenue Officer Stamp</span>
                <span>खाता पृष्ठ: 47 / खंड 3</span>
              </div>
            </div>
          </div>

          {/* ════════ RIGHT: GitBook Assistant Style AI Extraction Panel ════════ */}
          <div className="vis-ai-panel">
            <div>
              {/* AI Assistant Header */}
              <div className="vis-ai-header">
                <div className="vis-ai-header-title">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fe551b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>VillageARC Assistant</span>
                </div>
                <div className="vis-ai-header-actions">
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: copied ? '#15803d' : '#79716b',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy JSON'}
                  </button>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              </div>

              {/* Top Chat Query Bubble (GitBook Assistant style) */}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column' }}>
                <div className="vis-chat-bubble">
                  Extract ownership & verify Plot 147-B with State Cadastral DB
                </div>
              </div>

              {/* AI Response Text */}
              <div className="vis-ai-response" style={{ marginTop: '12px' }}>
                <p className="vis-ai-response-text">
                  Document digitized with <strong>98.9% aggregate confidence</strong>. 5 entities
                  cross-verified against Saran District Cadastral Survey:
                </p>

                {/* Extracted Structured Field Cards */}
                <div className="vis-extracted-cards">
                  {EXTRACTED_ENTITIES.map((entity) => {
                    const isSelected = activeEntityId === entity.id;
                    return (
                      <div
                        key={entity.id}
                        className={`vis-field-card ${isSelected ? 'active' : ''}`}
                        onClick={() => setActiveEntityId(entity.id)}
                      >
                        <div className="vis-field-left">
                          <span className="vis-field-name">{entity.field}</span>
                          <span className="vis-field-value">{entity.value}</span>
                        </div>
                        <div className="vis-field-right">
                          <span className={`vis-field-badge vis-badge-${entity.statusType}`}>
                            {entity.status}
                          </span>
                          <span style={{ fontSize: '10px', color: '#79716b', fontWeight: 600 }}>
                            {entity.confidence}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Interactive Query Box (GitBook Assistant bottom chat input) */}
            <div className="vis-chat-input-box">
              <div className="vis-chat-input-placeholder">
                {activeEntity
                  ? `Selected ${activeEntity.field}: ${activeEntity.value}`
                  : 'Ask AI about mutation status, encumbrances, or GIS coordinates...'}
              </div>
              <div className="vis-chat-input-footer">
                <div className="vis-grounded-label">
                  <span style={{ color: '#fe551b', fontWeight: 700 }}>AI</span>
                  <span>Grounded on Bihar Bhumi & 1994 Cadastral Survey</span>
                </div>
                <button
                  type="button"
                  className="vis-chat-send-btn"
                  onClick={() => alert('Analyzing entity in cadastral database...')}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
