'use strict';

const { assertInlineCssStructure, findCssStructureIssue } = require('../lib/app/inline-css-guard');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');

const broken = '.action:hover { background: var(--hover, var(--overlay, rgba(83,88,97,.16)); }\n.card { height: 100%; }';
const fixed = broken.replace('rgba(83,88,97,.16));', 'rgba(83,88,97,.16)));');
const page = (css) => `export default function Page() { return <style>{${JSON.stringify(css)}}</style>; }`;

test('a missing var() parenthesis blocks canvas compilation before publishing', () => {
  expect(() => compileCanvasLocal(page(broken), { sourcePath: 'activities.canvas.jsx' })).toThrow(
    expect.objectContaining({ code: 'OPENYIDA_CANVAS_INLINE_CSS_INVALID', details: expect.objectContaining({ sourcePath: 'activities.canvas.jsx' }) })
  );
  expect(compileCanvasLocal(page(fixed)).runtimeCode).toContain('height: 100%');
});

test('checks static templates and const references with source locations', () => {
  const source = 'const css = `\n' + broken + '`;\nexport default function Page() { return <style>{css}</style>; }';
  expect(() => assertInlineCssStructure(source)).toThrow(expect.objectContaining({ details: expect.objectContaining({ line: 2 }) }));
});

test.each(['.x { color: var(--x; }', '.x {', '.x { color: red; /* missing', '.x { content: "missing', '.x { content: "trailing\\'])('rejects unclosed CSS structure: %s', (css) => {
  expect(findCssStructureIssue(css)).not.toBeNull();
});

test('ignores delimiters in CSS comments, strings, and escaped selectors', () => {
  const css = '.escaped\\(name { content: "})]("; /* var( */ background: url("https://example.com/a(b).png"); }';
  expect(findCssStructureIssue(css)).toBeNull();
});

test('does not execute dynamic styles or inspect unrelated JavaScript strings', () => {
  expect(() => assertInlineCssStructure('const message = "var("; export default function Page({ color }) { return <style>{`.x {color: ${color}}`}</style>; }')).not.toThrow();
});
