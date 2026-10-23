'use strict';

const { findResponsiveLayoutIssues } = require('../lib/app/responsive-layout-guard');
const { lintYidaSource } = require('../lib/app/page-linter');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');

describe('responsive layout guard', () => {
  test('warns when layout changes only from viewport width', () => {
    const source = `
      export function renderJsx() {
        var mobile = window.innerWidth < 768;
        return <div style={{ flexDirection: mobile ? 'column' : 'row' }}>content</div>;
      }
    `;

    expect(findResponsiveLayoutIssues(source)).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'responsive-viewport-only', line: 3 }),
    ]));
    expect(lintYidaSource(source, '/tmp/layout.jsx').warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'responsive-viewport-only' }),
    ]));
  });

  test('accepts container-aware layout with observer cleanup', () => {
    const source = `
      const root = document.querySelector('.page');
      const observer = new ResizeObserver(() => root.getBoundingClientRect().width);
      observer.observe(root);
      function cleanup() { observer.disconnect(); }
      const css = '.page { container-type: inline-size; } @container (max-width: 600px) { .grid { grid-template-columns: 1fr; } }';
    `;

    expect(findResponsiveLayoutIssues(source)).toEqual([]);
  });

  test('warns about observers without cleanup, fixed widths, and page scaling', () => {
    const source = `
      const observer = new window.ResizeObserver(measure);
      const css = '.page { width: 960px; transform: scale(.8); }';
    `;

    expect(findResponsiveLayoutIssues(source).map(issue => issue.rule)).toEqual([
      'resize-observer-cleanup',
      'responsive-fixed-width',
      'responsive-page-scale',
    ]);
  });

  test('Canvas compiler returns the same advisory diagnostics', () => {
    const source = `
      import React from 'react';
      export default function Page() {
        const mobile = window.matchMedia('(max-width: 767px)').matches;
        return <main style={{ flexDirection: mobile ? 'column' : 'row' }}>内容</main>;
      }
    `;
    const result = compileCanvasLocal(source, { sourcePath: 'pages/src/layout.canvas.jsx' });

    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'responsive-viewport-only' }),
    ]));
  });
});
