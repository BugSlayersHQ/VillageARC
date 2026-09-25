import React from 'react';

export default function ValueSection() {
  return (
    <section id="about" className="value">
      <div className="container">
        <div className="value-inner">
          {/* Eyebrow */}
          <p className="eyebrow value-eyebrow">Why this platform</p>

          {/* Heading */}
          <h2 className="value-heading">From paper archives to a reliable digital land layer.</h2>

          {/* Supporting text */}
          <p className="value-body">
            Old registers should not stay locked inside scans. Platform is designed around the real
            workflow: ingest the document, understand its layout, extract its fields, validate the
            result, and hand it to the people and systems that need it.
          </p>
        </div>
      </div>
    </section>
  );
}
