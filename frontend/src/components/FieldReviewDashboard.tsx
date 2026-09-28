'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * FieldReviewDashboard
 * -----------------------------------------------------------------------
 * Upload a scanned page + paste the OCR JSON, then click a field (or click
 * a word on the image) to see exactly where it sits on the page.
 *
 * IMPORTANT: upload the SAME full-page image that was sent to the OCR
 * model. Any uniform resize is fine (boxes are scaled by the OCR page
 * size stored in the JSON), but a cropped copy will not line up.
 *
 * All CSS lives in the <style> tag below, so no Tailwind is required.
 * Do not ask an AI tool to "restyle" this file.
 * -----------------------------------------------------------------------
 */

type BBox = [number, number, number, number]; // x1, y1, x2, y2 in OCR page pixels

export interface OcrField {
  text: string;
  confidence: number;
  bbox: BBox;
}

export interface OcrPage {
  /** OCR page size in pixels (0 if unknown, e.g. a pasted HTML snippet). */
  width: number;
  height: number;
  fields: OcrField[];
}

interface FieldReviewDashboardProps {
  initialImage?: string;
  initialPages?: OcrPage[];
}

const SAMPLE_PAGES: OcrPage[] = [
  {
    width: 1624,
    height: 2632,
    fields: [
      { bbox: [38, 42, 466, 100], confidence: 0.989, text: 'वर्तमान - जिला : आगर-मालवा' },
      { bbox: [482, 44, 678, 92], confidence: 0.998, text: 'तहसील : आगर' },
      { bbox: [698, 44, 888, 92], confidence: 1.0, text: 'गांव : अभयपुर' },
      { bbox: [1377, 323, 1541, 365], confidence: 0.998, text: 'खसरा पांच' },
      { bbox: [48, 800, 86, 842], confidence: 0.962, text: '१०' },
      { bbox: [147, 802, 233, 842], confidence: 0.984, text: '०.४०' },
      {
        bbox: [277, 792, 539, 910],
        confidence: 0.9,
        text: 'चाँद खाँ पिता अजीज खाँ खा.नं. ७ भूमिस्वामी',
      },
      { bbox: [764, 786, 855, 821], confidence: 0.976, text: 'घास बीड' },
      {
        bbox: [287, 1008, 552, 1218],
        confidence: 0.85,
        text: 'अजीज खाँ पुत्र अब्दुल खाँ व चाँद खाँ पुत्र अजीज खाँ जात-पिंजारा निवासी शिवगढ भूमिस्वामी',
      },
      { bbox: [742, 1008, 862, 1042], confidence: 0.91, text: 'देशी का चना' },
    ],
  },
];

/* ----------------------------- parsing ----------------------------- */

const SPAN_RE = /data-bbox=\\?"([\d\s]+)\\?"\s+data-confidence=\\?"([\d.]+)\\?"[^>]*>([^<]*)</g;

/** Pulls every <span data-bbox data-confidence> out of an HTML string (de-duplicated). */
function extractSpans(html: string): OcrField[] {
  const out: OcrField[] = [];
  const seen = new Set<string>();
  const re = new RegExp(SPAN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = m[1].trim().split(/\s+/).map(Number);
    const text = m[3].trim();
    if (n.length !== 4 || !text || n.some(Number.isNaN)) continue;
    const key = `${n.join(',')}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bbox: [n[0], n[1], n[2], n[3]], confidence: parseFloat(m[2]), text });
  }
  return out;
}

interface RawBlock {
  html?: string;
  bbox?: number[];
}
interface RawDoc {
  children?: RawBlock[];
}

/**
 * Accepts the full OCR JSON (one entry per page in `children`) or a raw
 * HTML snippet. Only each page's top-level `html` is read, because child
 * blocks repeat the same spans.
 */
function parseOcr(raw: string): OcrPage[] {
  try {
    const doc = JSON.parse(raw) as RawDoc;
    if (Array.isArray(doc.children)) {
      const pages = doc.children
        .map((p) => ({
          width: p.bbox?.[2] ?? 0,
          height: p.bbox?.[3] ?? 0,
          fields: extractSpans(String(p.html ?? '')),
        }))
        .filter((p) => p.fields.length > 0);
      if (pages.length > 0) return pages;
    }
  } catch {
    /* not JSON — fall through and treat it as raw HTML */
  }
  const fields = extractSpans(raw);
  return fields.length > 0 ? [{ width: 0, height: 0, fields }] : [];
}

function confidenceTier(c: number): 'high' | 'mid' | 'low' {
  if (c >= 0.9) return 'high';
  if (c >= 0.7) return 'mid';
  return 'low';
}

/* ------------------------------ styles ------------------------------ */

const STYLES = `
.frd-app { display: flex; height: 100vh; background: #F1F3EF; color: #1B1E1C; font-family: Inter, system-ui, sans-serif; }
.frd-sidebar { width: 200px; flex: none; background: #171B1E; color: #9AA3A0; display: flex; flex-direction: column; padding: 18px 12px; }
.frd-brand { display: flex; align-items: center; gap: 9px; color: #fff; padding: 4px 8px 20px; }
.frd-brand-mark { width: 22px; height: 22px; border-radius: 5px; background: linear-gradient(135deg, #A63D2F, #B5822A); flex: none; }
.frd-brand-name { font-size: 17px; font-weight: 600; }
.frd-nav-label { font-size: 11px; letter-spacing: .02em; color: #5B6366; margin: 14px 8px 6px; }
.frd-nav-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 7px; font-size: 13.5px; cursor: pointer; color: #9AA3A0; }
.frd-nav-item:hover, .frd-nav-item.active { background: #202528; color: #fff; }
.frd-nav-item.active { box-shadow: inset 2px 0 0 #A63D2F; }
.frd-nav-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .55; flex: none; }
.frd-sidebar-foot { margin-top: auto; padding: 10px 8px; font-size: 11.5px; color: #5B6366; border-top: 1px solid #2A2F31; }
.frd-sidebar-foot b { color: #C9CDC9; }

.frd-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.frd-topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 22px; border-bottom: 1px solid #DDE1DA; background: #fff; }
.frd-crumb { font-size: 13px; color: #767F7C; }
.frd-title { font-size: 17px; margin: 0; font-weight: 600; }
.frd-actions { display: flex; gap: 8px; }
.frd-btn { font-family: Inter, system-ui, sans-serif; font-size: 13px; padding: 8px 14px; border-radius: 7px; border: 1px solid #DDE1DA; background: #fff; color: #1B1E1C; cursor: pointer; }
.frd-btn:hover { background: #F1F3EF; }
.frd-btn-primary { background: #A63D2F; border-color: #A63D2F; color: #fff; }
.frd-btn-primary:hover { background: #8F3427; }

.frd-workspace { flex: 1; display: flex; min-height: 0; }
.frd-canvas-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: auto; padding: 18px; }
.frd-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.frd-upload-label { display: inline-flex; align-items: center; gap: 6px; }
.frd-textarea { width: 100%; height: 110px; border: 1px solid #DDE1DA; border-radius: 8px; padding: 10px; font-family: ui-monospace, monospace; font-size: 11.5px; background: #F1F3EF; color: #1B1E1C; resize: vertical; box-sizing: border-box; }
.frd-paste-row { display: flex; gap: 8px; margin-top: 8px; }
.frd-warn { background: #F6ECD9; border: 1px solid #E5CFA0; color: #7A5514; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; line-height: 1.45; margin-bottom: 12px; }
.frd-stage-frame { flex: 1; border: 1px solid #DDE1DA; border-radius: 10px; background: #fff; display: flex; overflow: auto; position: relative; min-height: 280px; }
.frd-empty { margin: auto; color: #8B938F; text-align: center; padding: 40px; max-width: 340px; font-size: 13.5px; line-height: 1.5; }
.frd-empty b { display: block; font-size: 17px; color: #1B1E1C; margin-bottom: 6px; font-weight: 600; }
.frd-canvas { margin: auto; max-width: 100%; cursor: crosshair; }

.frd-fields-panel { width: 340px; flex: none; border-left: 1px solid #DDE1DA; background: #fff; display: flex; flex-direction: column; min-height: 0; }
.frd-fields-head { padding: 16px 16px 10px; border-bottom: 1px solid #DDE1DA; }
.frd-fields-head h3 { font-size: 15px; margin: 0 0 10px; }
.frd-count-pill { font-size: 11px; color: #767F7C; margin-left: 6px; font-weight: 500; }
.frd-search, .frd-select { width: 100%; padding: 8px 10px; border: 1px solid #DDE1DA; border-radius: 7px; background: #F1F3EF; color: #1B1E1C; font-size: 13px; box-sizing: border-box; }
.frd-select { margin-bottom: 8px; }

.frd-preview-card { margin: 14px 16px; border: 1px solid #DDE1DA; border-radius: 9px; padding: 12px; background: #F1F3EF; }
.frd-snip { width: 100%; min-height: 46px; border-radius: 6px; border: 1px solid #DDE1DA; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 9px; }
.frd-snip img { max-width: 100%; display: block; }
.frd-snip-ph { color: #9AA3A0; font-size: 12px; padding: 14px; text-align: center; }
.frd-preview-text { font-size: 14px; word-break: break-word; margin-bottom: 6px; }
.frd-preview-meta { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: #767F7C; }
.frd-badge { padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.frd-badge-high { background: #E4EBE7; color: #3F6357; }
.frd-badge-mid { background: #F6ECD9; color: #B5822A; }
.frd-badge-low { background: #F4E4E1; color: #A63D2F; }
.frd-dl-link { font-size: 12px; color: #A63D2F; cursor: pointer; background: none; border: none; padding: 0; }

.frd-field-list { flex: 1; overflow-y: auto; padding: 4px 10px 16px; }
.frd-field-row { display: flex; align-items: center; gap: 9px; padding: 9px 8px; border-radius: 7px; cursor: pointer; border: 1px solid transparent; }
.frd-field-row:hover { background: #F1F3EF; }
.frd-field-row.selected { background: #E4EBE7; border-color: #3F6357; }
.frd-swatch { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.frd-swatch-high { background: #3F6357; }
.frd-swatch-mid { background: #B5822A; }
.frd-swatch-low { background: #A63D2F; }
.frd-ftxt { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.frd-fconf { font-size: 11px; color: #8B938F; flex: none; }
.frd-empty-list { padding: 16px 8px; font-size: 12.5px; color: #8B938F; }

@media (max-width: 820px) {
  .frd-sidebar { display: none; }
  .frd-workspace { flex-direction: column; }
  .frd-fields-panel { width: auto; border-left: none; border-top: 1px solid #DDE1DA; max-height: 46vh; }
}
`;

/* ---------------------------- component ---------------------------- */

export default function FieldReviewDashboard({
  initialImage,
  initialPages,
}: FieldReviewDashboardProps) {
  const [pages, setPages] = useState<OcrPage[]>(initialPages ?? []);
  const [pageIdx, setPageIdx] = useState(0);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [selected, setSelected] = useState(-1);
  const [search, setSearch] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // bumped on window resize so the highlight is redrawn

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageFrameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const page: OcrPage | undefined = pages[pageIdx];
  const fields: OcrField[] = page?.fields ?? [];

  // OCR page pixels -> uploaded image pixels (uniform scale, so a resized full page still lines up).
  const scale = imgEl && page && page.width > 0 ? imgEl.naturalWidth / page.width : 1;
  const shapeMismatch =
    !!imgEl &&
    !!page &&
    page.width > 0 &&
    page.height > 0 &&
    Math.abs(imgEl.naturalWidth / imgEl.naturalHeight - page.width / page.height) > 0.03;

  useEffect(() => {
    if (!initialImage) return;
    const image = new Image();
    image.onload = () => setImgEl(image);
    image.src = initialImage;
  }, [initialImage]);

  useEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Draw the page, then the highlight for the selected field.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || (!imgEl && fields.length === 0)) return;

    let w: number;
    let h: number;
    if (imgEl) {
      w = imgEl.naturalWidth;
      h = imgEl.naturalHeight;
    } else if (page && page.width > 0) {
      w = page.width;
      h = page.height;
    } else {
      w = Math.max(900, ...fields.map((f) => f.bbox[2])) + 40;
      h = Math.max(600, ...fields.map((f) => f.bbox[3])) + 40;
    }
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    if (imgEl) {
      ctx.drawImage(imgEl, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#fbfbf8';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e4e6e0';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#9AA3A0';
      ctx.font = '20px Inter, sans-serif';
      ctx.fillText(
        'No scanned image uploaded — showing field positions on a placeholder page',
        24,
        36,
      );
    }

    if (selected < 0 || !fields[selected]) return;

    const [x1, y1, x2, y2] = fields[selected].bbox.map((v) => v * scale);
    // Canvas pixels per on-screen pixel, so line widths look the same at any zoom.
    const shown = canvas.getBoundingClientRect().width;
    const px = shown > 0 ? w / shown : 1;
    const pad = 4 * px;
    const rx = x1 - pad;
    const ry = y1 - pad;
    const rw = x2 - x1 + 2 * pad;
    const rh = y2 - y1 + 2 * pad;

    ctx.save();
    // Dim everything except the selected field.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(rx, ry, rw, rh);
    ctx.fill('evenodd');
    // White halo + blue line: visible on light, dark and reddish scans alike.
    ctx.lineWidth = 6 * px;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.lineWidth = 3 * px;
    ctx.strokeStyle = '#1D4ED8';
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();

    // Scroll the highlighted field to the middle of the viewer (in on-screen pixels).
    const frame = stageFrameRef.current;
    if (frame) {
      const s = 1 / px;
      frame.scrollTo({
        left: Math.max(0, canvas.offsetLeft + ((x1 + x2) / 2) * s - frame.clientWidth / 2),
        top: Math.max(0, canvas.offsetTop + ((y1 + y2) / 2) * s - frame.clientHeight / 2),
        behavior: 'smooth',
      });
    }
  }, [imgEl, page, fields, selected, scale, tick]);

  // Cropped close-up of the selected field.
  useEffect(() => {
    if (selected < 0 || !fields[selected]) {
      setCropUrl(null);
      return;
    }
    const [bx1, by1, bx2, by2] = fields[selected].bbox.map((v) => v * scale);
    const sx = Math.max(0, Math.floor(bx1));
    const sy = Math.max(0, Math.floor(by1));
    const sw = Math.max(1, Math.ceil(bx2) - sx);
    const sh = Math.max(1, Math.ceil(by2) - sy);
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    const cctx = c.getContext('2d');
    if (!cctx) return;
    if (imgEl) {
      cctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, sw, sh);
    } else {
      cctx.fillStyle = '#fbfbf8';
      cctx.fillRect(0, 0, sw, sh);
      cctx.strokeStyle = '#1D4ED8';
      cctx.strokeRect(1, 1, sw - 2, sh - 2);
    }
    setCropUrl(c.toDataURL('image/png'));
  }, [selected, fields, imgEl, scale]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const image = new Image();
      image.onload = () => setImgEl(image);
      image.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleParse = () => {
    const parsed = parseOcr(jsonText);
    if (parsed.length === 0) {
      alert('No data-bbox spans found in the pasted text.');
      return;
    }
    setPages(parsed);
    setPageIdx(0);
    setSelected(-1);
    setSearch('');
    setShowPaste(false);
  };

  const handleClear = () => {
    setImgEl(null);
    setPages([]);
    setPageIdx(0);
    setSelected(-1);
    setJsonText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Click a word on the image -> select the smallest field box under the cursor.
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    let best = -1;
    let bestArea = Infinity;
    fields.forEach((f, i) => {
      const [x1, y1, x2, y2] = f.bbox.map((v) => v * scale);
      if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        const area = (x2 - x1) * (y2 - y1);
        if (area < bestArea) {
          best = i;
          bestArea = area;
        }
      }
    });
    if (best >= 0) {
      setSelected(best);
      setSearch('');
      requestAnimationFrame(() =>
        document.getElementById(`frd-row-${best}`)?.scrollIntoView({ block: 'nearest' }),
      );
    }
  };

  const handleDownloadCrop = () => {
    if (!cropUrl || !fields[selected]) return;
    const a = document.createElement('a');
    a.href = cropUrl;
    a.download = `${fields[selected].text.slice(0, 20).replace(/\s+/g, '_') || 'field'}.png`;
    a.click();
  };

  const q = search.trim().toLowerCase();
  const visibleFields = fields
    .map((f, i) => ({ ...f, index: i }))
    .filter((f) => !q || f.text.toLowerCase().includes(q));

  const hasContent = fields.length > 0 || !!imgEl;
  const selectedField = selected >= 0 ? fields[selected] : null;

  return (
    <div className="frd-app">
      <style>{STYLES}</style>

      <aside className="frd-sidebar">
        <div className="frd-brand">
          <div className="frd-brand-mark" />
          <span className="frd-brand-name">Kshetra</span>
        </div>
        <div className="frd-nav-label">CREATE</div>
        <div className="frd-nav-item active">
          <span className="frd-nav-dot" />
          Field Review
        </div>
        <div className="frd-nav-item">
          <span className="frd-nav-dot" />
          Pipelines
        </div>
        <div className="frd-nav-item">
          <span className="frd-nav-dot" />
          Schemas
        </div>
        <div className="frd-nav-label">EVALUATE</div>
        <div className="frd-nav-item">
          <span className="frd-nav-dot" />
          Collections
        </div>
        <div className="frd-nav-item">
          <span className="frd-nav-dot" />
          Verification Queue
        </div>
        <div className="frd-nav-label">INTEGRATE</div>
        <div className="frd-nav-item">
          <span className="frd-nav-dot" />
          LRMS / DILRMP
        </div>
        <div className="frd-nav-item">
          <span className="frd-nav-dot" />
          API Keys
        </div>
        <div className="frd-sidebar-foot">
          <b>अभयपुर · आगर-मालवा</b>
          <br />
          Khasra bundle · page {pageIdx + 1}
        </div>
      </aside>

      <main className="frd-main">
        <div className="frd-topbar">
          <div>
            <div className="frd-crumb">Land Records / Khasra Verification</div>
            <h2 className="frd-title">Field-to-image review</h2>
          </div>
          <div className="frd-actions">
            <button
              className="frd-btn"
              onClick={() => {
                setPages(SAMPLE_PAGES);
                setPageIdx(0);
                setSelected(-1);
              }}
            >
              Load sample
            </button>
            <button className="frd-btn frd-btn-primary" onClick={() => setShowPaste((s) => !s)}>
              Paste OCR JSON
            </button>
          </div>
        </div>

        <div className="frd-workspace">
          <section className="frd-canvas-panel">
            <div className="frd-toolbar">
              <label className="frd-btn frd-upload-label">
                Upload scanned page
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <button className="frd-btn" onClick={handleClear}>
                Clear
              </button>
            </div>

            {showPaste && (
              <div style={{ marginBottom: 14 }}>
                <textarea
                  className="frd-textarea"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder="Paste the full OCR JSON here (or an HTML snippet with data-bbox / data-confidence spans)."
                />
                <div className="frd-paste-row">
                  <button className="frd-btn frd-btn-primary" onClick={handleParse}>
                    Parse fields
                  </button>
                  <button className="frd-btn" onClick={() => setShowPaste(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {shapeMismatch && imgEl && page && (
              <div className="frd-warn">
                The uploaded image ({imgEl.naturalWidth}×{imgEl.naturalHeight}) is a different shape
                from the page the OCR read ({page.width}×{page.height}), so boxes will land in the
                wrong place. Upload the full-page image that was sent to OCR, not a cropped or
                re-exported copy
                {pages.length > 1
                  ? ', and make sure the page selected on the right matches it.'
                  : '.'}
              </div>
            )}

            <div ref={stageFrameRef} className="frd-stage-frame">
              {!hasContent && (
                <div className="frd-empty">
                  <b>No page loaded yet</b>
                  Upload the scanned image and paste the model&apos;s JSON, or load the sample
                  record to see how a field maps back onto its exact spot on the page.
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="frd-canvas"
                style={{ display: hasContent ? 'block' : 'none' }}
                onClick={handleCanvasClick}
              />
            </div>
          </section>

          <aside className="frd-fields-panel">
            <div className="frd-fields-head">
              <h3>
                Extracted fields
                {fields.length > 0 && <span className="frd-count-pill">· {fields.length}</span>}
              </h3>
              {pages.length > 1 && (
                <select
                  className="frd-select"
                  value={pageIdx}
                  onChange={(e) => {
                    setPageIdx(Number(e.target.value));
                    setSelected(-1);
                    setSearch('');
                  }}
                >
                  {pages.map((p, i) => (
                    <option key={i} value={i}>
                      Page {i + 1} ({p.fields.length} fields)
                    </option>
                  ))}
                </select>
              )}
              <input
                className="frd-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search field text…"
              />
            </div>

            <div className="frd-preview-card">
              <div className="frd-snip">
                {cropUrl ? (
                  <img src={cropUrl} alt="cropped field" />
                ) : (
                  <div className="frd-snip-ph">
                    Select a field below, or click a word on the page
                  </div>
                )}
              </div>
              <div className="frd-preview-text">{selectedField ? selectedField.text : '—'}</div>
              <div className="frd-preview-meta">
                {selectedField ? (
                  <span
                    className={`frd-badge frd-badge-${confidenceTier(selectedField.confidence)}`}
                  >
                    {Math.round(selectedField.confidence * 100)}% confidence
                  </span>
                ) : (
                  <span />
                )}
                {selectedField && (
                  <button className="frd-dl-link" onClick={handleDownloadCrop}>
                    Download crop
                  </button>
                )}
              </div>
            </div>

            <div className="frd-field-list">
              {fields.length === 0 && <div className="frd-empty-list">No fields parsed yet.</div>}
              {visibleFields.map((f) => (
                <div
                  key={f.index}
                  id={`frd-row-${f.index}`}
                  className={`frd-field-row ${f.index === selected ? 'selected' : ''}`}
                  onClick={() => setSelected(f.index)}
                >
                  <span className={`frd-swatch frd-swatch-${confidenceTier(f.confidence)}`} />
                  <span className="frd-ftxt">{f.text}</span>
                  <span className="frd-fconf">{Math.round(f.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
