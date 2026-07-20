'use strict';

/**
 * Generate a self-contained SVG radar chart for the 10-dimension eval model.
 *
 * Zero external dependencies — pure string concatenation to build the SVG
 * markup. The output is embeddable directly in HTML (no XML declaration).
 */

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SIZE = 400;
const DEFAULT_LEVELS = 5;

const COLORS = {
  grid: '#e0e0e0',
  fill: 'rgba(54,162,235,0.3)',
  stroke: '#36a2eb',
  labels: '#333',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert polar coordinates to Cartesian, centred at (cx, cy).
 * Angle 0 points upward (12 o'clock).
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} angleRad — angle in radians (0 = up)
 * @returns {{x: number, y: number}}
 */
function polarToCart(cx, cy, radius, angleRad) {
  return {
    x: +(cx + radius * Math.sin(angleRad)).toFixed(2),
    y: +(cy - radius * Math.cos(angleRad)).toFixed(2),
  };
}

/**
 * Build a polygon <path> `d` attribute for a regular polygon with given
 * radii per vertex.
 * @param {number} cx
 * @param {number} cy
 * @param {number[]} radii — one radius per vertex
 * @returns {string}
 */
function polygonPath(cx, cy, radii) {
  const n = radii.length;
  const step = (2 * Math.PI) / n;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const pt = polarToCart(cx, cy, radii[i], step * i);
    parts.push((i === 0 ? 'M' : 'L') + pt.x + ',' + pt.y);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Escape basic XML entities in a string.
 */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

/**
 * Render a radar chart as an SVG string.
 *
 * @param {Array<{key: string, label: string, score: number}>} dimensions
 *   Each score should be 0-100.
 * @param {object} [options]
 * @param {number} [options.size=400]    — width & height of the SVG
 * @param {number} [options.levels=5]    — number of concentric grid rings
 * @param {string} [options.title]       — optional chart title
 * @returns {string} SVG markup (no XML declaration)
 */
function renderRadarSvg(dimensions, options) {
  const opts = options || {};
  const size = opts.size || DEFAULT_SIZE;
  const levels = opts.levels || DEFAULT_LEVELS;
  const title = opts.title || '';

  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.35; // leave room for labels
  const n = dimensions.length;
  const step = (2 * Math.PI) / n;

  const lines = [];

  // Open SVG tag
  lines.push(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size +
    '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size +
    '" style="font-family:sans-serif;font-size:12px;">'
  );

  // Optional title
  if (title) {
    lines.push(
      '  <text x="' + cx + '" y="20" text-anchor="middle" ' +
      'font-size="16" font-weight="bold" fill="' + COLORS.labels + '">' +
      esc(title) + '</text>'
    );
  }

  // Grid polygons (concentric rings at each level)
  for (let lv = 1; lv <= levels; lv++) {
    const lvRadius = (maxRadius * lv) / levels;
    const lvRadii = [];
    for (let gi = 0; gi < n; gi++) {
      lvRadii.push(lvRadius);
    }
    const gridValue = Math.round((100 * lv) / levels);
    lines.push(
      '  <path d="' + polygonPath(cx, cy, lvRadii) +
      '" fill="none" stroke="' + COLORS.grid + '" stroke-width="1"/>'
    );
    // Level value label (placed on first axis)
    const lvPt = polarToCart(cx, cy, lvRadius, 0);
    lines.push(
      '  <text x="' + (lvPt.x + 4) + '" y="' + (lvPt.y - 2) +
      '" fill="' + COLORS.grid + '" font-size="10">' + gridValue + '</text>'
    );
  }

  // Axis lines from centre to each vertex
  for (let ai = 0; ai < n; ai++) {
    const axPt = polarToCart(cx, cy, maxRadius, step * ai);
    lines.push(
      '  <line x1="' + cx + '" y1="' + cy +
      '" x2="' + axPt.x + '" y2="' + axPt.y +
      '" stroke="' + COLORS.grid + '" stroke-width="1"/>'
    );
  }

  // Data polygon
  const dataRadii = [];
  for (let di = 0; di < n; di++) {
    const score = Math.max(0, Math.min(100, dimensions[di].score || 0));
    dataRadii.push((maxRadius * score) / 100);
  }
  lines.push(
    '  <path d="' + polygonPath(cx, cy, dataRadii) +
    '" fill="' + COLORS.fill + '" stroke="' + COLORS.stroke +
    '" stroke-width="2"/>'
  );

  // Score dots + labels
  const labelOffset = maxRadius + 24;
  for (let li = 0; li < n; li++) {
    // Data point dot
    const dPt = polarToCart(cx, cy, dataRadii[li], step * li);
    lines.push(
      '  <circle cx="' + dPt.x + '" cy="' + dPt.y +
      '" r="3" fill="' + COLORS.stroke + '"/>'
    );

    // Score value near the dot
    lines.push(
      '  <text x="' + dPt.x + '" y="' + (dPt.y - 6) +
      '" text-anchor="middle" fill="' + COLORS.stroke +
      '" font-size="10" font-weight="bold">' +
      Math.round(dimensions[li].score || 0) + '</text>'
    );

    // Axis label at the perimeter
    const lPt = polarToCart(cx, cy, labelOffset, step * li);
    let anchor = 'middle';
    if (lPt.x < cx - 10) {
      anchor = 'end';
    } else if (lPt.x > cx + 10) {
      anchor = 'start';
    }
    lines.push(
      '  <text x="' + lPt.x + '" y="' + (lPt.y + 4) +
      '" text-anchor="' + anchor + '" fill="' + COLORS.labels + '">' +
      esc(dimensions[li].label) + '</text>'
    );
  }

  lines.push('</svg>');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry (when run directly)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  // Demo with 10 sample dimensions
  const demoDims = [
    { key: 'routing', label: 'D1 Routing', score: 85 },
    { key: 'generation', label: 'D2 Generation', score: 72 },
    { key: 'output', label: 'D3 Output', score: 90 },
    { key: 'safety', label: 'D4 Safety', score: 95 },
    { key: 'efficiency', label: 'D5 Efficiency', score: 68 },
    { key: 'coverage', label: 'D6 Coverage', score: 80 },
    { key: 'docQuality', label: 'D7 Doc Quality', score: 88 },
    { key: 'stepCompleteness', label: 'D8 Steps', score: 76 },
    { key: 'guardrail', label: 'D9 Guardrail', score: 92 },
    { key: 'visual', label: 'D10 Visual', score: 70 },
  ];

  const svg = renderRadarSvg(demoDims, { title: 'Eval Radar (demo)' });
  const outPath = path.join(__dirname, 'radar-demo.svg');
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log('Wrote demo radar chart to', outPath);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  renderRadarSvg,
};
