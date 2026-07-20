'use strict';

const renderRadarSvg = require('../scripts/eval/radar-chart').renderRadarSvg;

const sampleDimensions = [
  { key: 'routing', label: 'D1 Routing', score: 85 },
  { key: 'generation', label: 'D2 Generation', score: 72 },
  { key: 'output', label: 'D3 Output', score: 90 },
  { key: 'safety', label: 'D4 Safety', score: 95 },
  { key: 'efficiency', label: 'D5 Efficiency', score: 68 },
];

describe('renderRadarSvg', function () {
  test('returns string starting with <svg and ending with </svg>', function () {
    const svg = renderRadarSvg(sampleDimensions);

    expect(typeof svg).toBe('string');
    expect(svg.trimStart().startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  test('contains all dimension labels in the SVG', function () {
    const svg = renderRadarSvg(sampleDimensions);

    for (let i = 0; i < sampleDimensions.length; i++) {
      expect(svg).toContain(sampleDimensions[i].label);
    }
  });

  test('respects custom size option', function () {
    const svg = renderRadarSvg(sampleDimensions, { size: 600 });

    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="600"');
  });

  test('handles empty dimensions array without error', function () {
    expect(function () {
      renderRadarSvg([]);
    }).not.toThrow();

    const svg = renderRadarSvg([]);
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  test('handles single dimension', function () {
    const single = [{ key: 'only', label: 'Only Dimension', score: 50 }];
    const svg = renderRadarSvg(single);

    expect(svg).toContain('Only Dimension');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  test('default options produce valid SVG', function () {
    const svg = renderRadarSvg(sampleDimensions);

    // Default size is 400
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="400"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('title option appears in SVG when provided', function () {
    const svg = renderRadarSvg(sampleDimensions, { title: 'My Radar Chart' });

    expect(svg).toContain('My Radar Chart');
  });

  test('title is omitted when not provided', function () {
    const svgWithTitle = renderRadarSvg(sampleDimensions, { title: 'Visible Title' });
    const svgWithout = renderRadarSvg(sampleDimensions);

    expect(svgWithTitle).toContain('Visible Title');
    // The SVG without a title should have fewer text elements
    expect(svgWithout).not.toContain('font-size="16"');
  });
});
