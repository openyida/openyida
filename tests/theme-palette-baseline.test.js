'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { reviewPalette } = require('../scripts/theme-palette-baseline');
const { build } = require('../scripts/build-application-styles');
const { DESIGN_SKILL_ROOT, loadThemeIndex } = require('../lib/design-plan/themes');
const baseline = require('../scripts/theme-palette-baseline.json');

const clone = value => JSON.parse(JSON.stringify(value));
const reports = () => clone(baseline.templates);

test('reviewed main findings remain visible, while strict audit still rejects them', () => {
  const onReview = jest.fn();
  expect(build({ check: true, baseline, onReview })).toEqual([]);
  expect(onReview).toHaveBeenCalledTimes(1);
  const result = onReview.mock.calls[0][0];
  expect(result.map(item => item.themeId)).toEqual(baseline.templates.map(item => item.themeId));
  expect(result.flatMap(item => item.issues)).toHaveLength(10);
  expect(result.flatMap(item => item.unresolved)).toHaveLength(15);
  expect(() => build({ check: true })).toThrow(expect.objectContaining({ code: 'THEME_PALETTE_REVIEW_REQUIRED' }));
});

test.each(['new-theme', 'new-role', 'worse-ratio', 'changed-source', 'changed-pair', 'changed-minimum'])(
  '%s cannot hide behind the approved baseline', mode => {
    const current = reports();
    const item = current.find(report => report.issues.length);
    if (mode === 'new-theme') {item.themeId = 'new-theme';}
    if (mode === 'new-role') {item.issues.push({ ...item.issues[0], role: 'new-role' });}
    if (mode === 'worse-ratio') {item.issues[0].ratio -= 0.01;}
    if (mode === 'changed-source') {item.sourceHash = 'unreviewed-source';}
    if (mode === 'changed-pair') {item.issues[0].foreground = '--different-color';}
    if (mode === 'changed-minimum') {item.issues[0].minimum = 3;}
    expect(reviewPalette(current, baseline).regressions).not.toEqual([]);
  }
);

test('new unresolved backgrounds and lost measurable contrast still block', () => {
  const current = reports();
  const item = current.find(report => report.issues.length);
  const issue = item.issues.shift();
  item.unresolved.push({ ...issue, reason: 'COLOR_OR_SURFACE_UNRESOLVED' });
  expect(reviewPalette(current, baseline).regressions[0].unresolved).toContainEqual(item.unresolved[0]);
});

test('runtime exceptions cannot cover a different selector or reason', () => {
  const current = reports();
  const item = current.find(report => report.unresolved.some(entry => entry.selectors));
  item.unresolved.find(entry => entry.selectors).selectors = ['.different-surface'];
  expect(reviewPalette(current, baseline).regressions).not.toEqual([]);
  const changed = reports();
  changed.find(report => report.unresolved.length).unresolved[0].reason = 'NEW_REASON';
  expect(reviewPalette(changed, baseline).regressions).not.toEqual([]);
});

test('removed or improved findings do not require weakening the threshold', () => {
  expect(reviewPalette([], baseline)).toEqual({ known: [], regressions: [] });
  const current = reports();
  current.find(item => item.issues.length).issues[0].ratio += 0.1;
  expect(reviewPalette(current, baseline).regressions).toEqual([]);
});

test('baseline cannot change the audit seed or contrast threshold', () => {
  for (const change of [{ brandSeed: '#FFFFFF' }, { minimum: 3 }, { sourceCommit: '' }]) {
    expect(() => reviewPalette(reports(), { ...baseline, ...change })).toThrow('Invalid template palette baseline');
  }
});

test('changed risk sources block writes, while CRLF checkouts retain the same baseline', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oy-palette-baseline-'));
  const theme = loadThemeIndex().themes.find(item => item.themeId === 'soft-inset-surfaces');
  try {
    for (const file of [theme.templatePath, theme.cssTemplatePath]) {
      const target = path.join(root, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, fs.readFileSync(path.join(DESIGN_SKILL_ROOT, file), 'utf8').replace(/\r?\n/g, '\r\n'));
    }
    expect(build({ root, themes: [theme], check: true, baseline })).toEqual([]);
    const file = path.join(root, theme.cssTemplatePath);
    fs.appendFileSync(file, '\r\n.changed-rail { background: #FFFFFF; }\r\n');
    const before = fs.readFileSync(file, 'utf8');
    expect(() => build({ root, themes: [theme], baseline })).toThrow(expect.objectContaining({ code: 'THEME_PALETTE_REVIEW_REQUIRED' }));
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  } finally {fs.rmSync(root, { recursive: true, force: true });}
});
