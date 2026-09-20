'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { color, contrast, validateIconContrast } = require('../lib/design/icon-contrast');
const { parseDesignDocument, serializeDesignDocument, validateDesignDocument } = require('../lib/design/document');
const { applyDesignTokens } = require('../lib/app/theme-from-design');
const { materialize } = require('../lib/design-plan/materialize');
const { patchPlan } = require('../lib/design-plan/patch');

const pair = (foreground, background, extra = {}) => ({ name: '统计图标', foreground, background, ...extra });
const check = (value, tokens = {}) => validateIconContrast({ colorPairs: [value] }, tokens);

test('contrast uses linearized sRGB and rejects rounded ratios below 3:1', () => {
  expect(contrast(color('#000'), color('#fff'))).toBe(21);
  expect(check(pair('#949494', 'white'))[0].ratio).toBeGreaterThanOrEqual(3);
  expect(() => check(pair('#959595', 'white'))).toThrow(expect.objectContaining({ details: expect.objectContaining({ issue: 'ICON_CONTRAST_LOW' }) }));
});

test.each([
  ['#FF6548', '#FF795F'], ['#ffffff', '#FF795F'], ['#FF795F', '#FFF0E8'],
  ['rgba(0, 0, 0, 0.15)', '#fff'], ['#00000020', '#fff'],
])('rejects weak foreground %s against %s including transparency', (foreground, background) => {
  expect(() => check(pair(foreground, background))).toThrow(/ICON_CONTRAST_LOW/);
});

test('resolves shared tokens and actual opaque surfaces beneath translucent backgrounds', () => {
  const tokens = { '--icon-fg': 'var(--deep-orange)', '--deep-orange': '#9A3412', '--icon-bg': '#FFF0E8' };
  expect(check(pair('var(--icon-fg)', 'var(--icon-bg)'), tokens)[0].ratio).toBeGreaterThan(3);
  expect(check(pair('white', 'rgba(0 0 0 / 90%)', { surface: '#fff' }))[0].ratio).toBeGreaterThan(3);
  expect(() => check(pair('white', 'rgba(0 0 0 / 90%)', { surface: 'transparent' }))).toThrow(/ICON_OPAQUE_SURFACE_REQUIRED/);
  expect(() => check(pair('#333', 'transparent'))).toThrow(/ICON_OPAQUE_SURFACE_REQUIRED/);
  expect(() => check(pair('#333', 'rgba(0,0,0,.9)', { surface: '#fff' }))).toThrow(/ICON_CONTRAST_LOW/);
});

test.each(['var(--missing)', 'currentColor', 'linear-gradient(red, blue)', 'rgb(255 0, 0)', 'rgb(1 2 3 4)', 'rgb(999,0,0)'])('does not certify unresolved or invalid color %s', foreground => {
  expect(() => check(pair(foreground, '#fff'))).toThrow(/ICON_COLOR_UNRESOLVED/);
});

test('detects cyclic aliases, malformed pairs and duplicated state names', () => {
  expect(() => check(pair('var(--a)', '#fff'), { '--a': 'var(--b)', '--b': 'var(--a)' })).toThrow(/ICON_COLOR_UNRESOLVED/);
  expect(() => check({ name: '按钮', foreground: '#000' })).toThrow(/ICON_COLOR_UNRESOLVED/);
  expect(() => validateIconContrast({ colorPairs: [pair('#000', '#fff'), pair('#000', '#fff')] }, {})).toThrow(/ICON_COLOR_PAIR_INVALID/);
});

test('Plan patch, shared design validation and Fast theme generation enforce the same pairs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-contrast-'));
  const input = path.join(dir, 'build-plan.json');
  try {
    fs.copyFileSync(path.join(__dirname, 'fixtures/design-plan.json'), input);
    const outputs = materialize(input).outputs;
    patchPlan(input, [
      'visualStyle.tokens.--oyd-stat-icon-fg=#9A3412',
      'visualStyle.tokens.--oyd-stat-icon-bg=#FFF0E8',
      'visualStyle.forUser.iconSystem=' + JSON.stringify({ library: 'lucide-react', mappings: { 活动: 'Calendar' },
        colorPairs: [pair('var(--oyd-stat-icon-fg)', 'var(--oyd-stat-icon-bg)')] }),
    ], { materialize: true });
    const design = fs.readFileSync(outputs.design, 'utf8');
    expect(validateDesignDocument(design).iconContrast[0].ratio).toBeGreaterThan(3);
    expect(fs.readFileSync(outputs.theme, 'utf8')).toContain('--oyd-stat-icon-fg: #9A3412;');
    const files = [input, ...Object.values(outputs), path.join(dir, '.build-plan-artifacts.json')];
    const before = files.map(file => fs.readFileSync(file, 'utf8'));
    expect(() => patchPlan(input, ['visualStyle.tokens.--oyd-stat-icon-fg=#FF795F'], { materialize: true })).toThrow(/ICON_CONTRAST_LOW/);
    expect(files.map(file => fs.readFileSync(file, 'utf8'))).toEqual(before);
    const parsed = parseDesignDocument(design);
    parsed.metadata.iconSystem.colorPairs[0].foreground = '#FFF0E8';
    const invalid = serializeDesignDocument(parsed);
    expect(() => validateDesignDocument(invalid)).toThrow(/ICON_CONTRAST_LOW/);
    expect(() => applyDesignTokens(before[4], invalid)).toThrow(/ICON_CONTRAST_LOW/);
  } finally {fs.rmSync(dir, { recursive: true, force: true });}
});
