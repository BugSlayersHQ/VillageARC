'use client';

import React from 'react';

// Workflow data derived from the existing WorkflowSection.tsx 6-stage pipeline,
// condensed to 4 canonical steps per design brief (SCAN → EXTRACT → VALIDATE → STRUCTURE)
const STEPS = [
  {
    id: 'scan',
    label: 'Scan',
    desc: 'Bring legacy PDFs, scanned registers, and cadastral maps into the workflow.',
    icon: (
      // Document with scan lines
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="12" y2="17" />
      </svg>
    ),
  },
  {
    id: 'extract',
    label: 'Extract',
    desc: 'Understand document layout and extract relevant field information using document intelligence.',
    icon: (
      // Layers / stack — NLP extraction
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: 'validate',
    label: 'Validate',
    desc: 'Review and verify extracted information against master databases and business rules.',
    icon: (
      // Shield check — validation / governance
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    id: 'structure',
    label: 'Structure',
    desc: 'Turn processed information into usable digital records ready for LRMS and GIS integration.',
    icon: (
      // Database / grid — structured output
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
];

export default function WorkflowSection() {
  return (
    <section id="workflow" className="workflow">
      <div className="container workflow-inner">
        {/* Section header */}
        <div className="workflow-header">
          <p className="eyebrow" style={{ marginBottom: '8px' }}>
            How it works
          </p>
          <h2
            style={{
              fontSize: 'var(--fs-h4)',
              fontWeight: 700,
              color: 'var(--color-ink)',
              letterSpacing: 'var(--ls-h4)',
            }}
          >
            Four steps from paper to digital.
          </h2>
        </div>

        {/* Steps */}
        <div className="workflow-steps" role="list">
          {STEPS.map((step) => (
            <div key={step.id} id={`step-${step.id}`} className="workflow-step" role="listitem">
              {/* Icon circle */}
              <div className="workflow-step-num" aria-hidden="true">
                {step.icon}
              </div>
              <div className="workflow-step-text">
                <span className="workflow-step-label">{step.label}</span>
                <p className="workflow-step-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
