'use strict';

const fs = require('fs');
const path = require('path');
const { auditPalette, validatePalette } = require('../lib/design/palette-contrast');
const { loadThemeIndex, DESIGN_SKILL_ROOT, resolveThemeColors } = require('../lib/design-plan/themes');
const { applyDesignTokens } = require('../lib/app/theme-from-design');
const { rootDeclarations } = require('../lib/core/theme-brand-scale');
const { parseDesignDocument, serializeDesignDocument } = require('../lib/design/document');
const base = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'references/theme/app-custom-theme-template.css'), 'utf8');
const defaults = rootDeclarations(base.replace(/\/\*[\s\S]*?\*\//g, ''));

test.each(loadThemeIndex().themes)('$themeId keeps text readable across extreme primary colors', theme => {
  const source = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8');
  for (const primary of [theme.previewPrimaryColor || '#6F4E37', '#111111', '#FFFFFF', '#FFDE59', '#1677FF', '#B421FD', '#00CCAA']) {
    const metadata = parseDesignDocument(resolveThemeColors(source.replaceAll('{{PRIMARY_COLOR}}', primary))).metadata;
    // The creative starter has no authored recipe yet; inspect its token defaults.
    if (theme.mode === 'creative') {delete metadata.applicationStyle;}
    const css = applyDesignTokens(base, serializeDesignDocument(metadata, ''));
    const audit = auditPalette(rootDeclarations(css.replace(/\/\*[\s\S]*?\*\//g, '')));
    expect({ primary, issues: audit.issues, unresolved: audit.unresolved }).toEqual({ primary, issues: [], unresolved: [] });
    expect(audit.checks.length).toBeGreaterThanOrEqual(24);
  }
});

test('rejects the reported light-on-light navigation and brown-on-brown content', () => {
  const tokens = { ...defaults, '--pod-shell-theme-bg-color': '#F6FEFD', '--pod-nav-item-text-color': '#B4F5F1',
    '--pod-page-bg-color': '#B96B49', '--color-text1-4': '#733C26' };
  expect(auditPalette(tokens).issues.map(pair => pair.role)).toEqual(expect.arrayContaining(['nav.item', 'page.body']));
  expect(() => validatePalette(tokens)).toThrow(expect.objectContaining({ code: 'DESIGN_THEME_CONTRAST_LOW' }));
});

test('composites transparent hover fills on the navigation surface', () => {
  const tokens = { ...defaults, '--pod-shell-theme-bg-color': '#FFFFFF',
    '--pod-nav-menu-bg-hover-color': 'rgba(0, 0, 0, 0.5)', '--pod-nav-item-text-hover-color': '#FFFFFF' };
  const pair = auditPalette(tokens).checks.find(pair => pair.role === 'nav.hover');
  expect(pair.ratio).toBeCloseTo(3.98, 2);
  tokens['--pod-nav-menu-bg-hover-color'] = 'transparent';
  expect(auditPalette(tokens).checks.find(pair => pair.role === 'nav.hover').ratio).toBe(1);
});

test('unknown colors, missing backgrounds and cycles are unresolved rather than passing', () => {
  for (const value of ['oklch(0.7 0.2 40)', 'var(--missing)', 'var(--pod-card-bg-color)']) {
    const audit = auditPalette({ ...defaults, '--pod-card-bg-color': value });
    expect(audit.unresolved.map(pair => pair.role)).toContain('card.body');
    expect(audit.checks.map(pair => pair.role)).not.toContain('card.body');
  }
});

test('disabled colors and a brand swatch are not mistaken for readable text roles', () => {
  const tokens = { ...defaults, '--color-text1-2': '#FFFFFF', '--color-text1-1': '#FFFFFF',
    '--color-brand1-6': '#FFFFFF', '--pod-nav-item-text-selected-color': '#202020', '--pod-nav-menu-bg-selected-color': '#FFFFFF' };
  expect(auditPalette(tokens).issues).toEqual([]);
});
