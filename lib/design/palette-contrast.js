'use strict';

const { color, composite, contrast } = require('./icon-contrast');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

// These are actual text/surface roles, not arbitrary combinations of palette
// swatches. Disabled text, borders, charts and decorative accents are excluded.
const root = ['--pod-app-root-bg-color'];
const page = ['--pod-page-bg-color', ...root];
const card = ['--pod-card-bg-color', ...page];
const nav = ['--pod-shell-theme-bg-color', ...root];
const input = ['--input-bg-color', ...card];
const PAIRS = [
  ['page.body', '--color-text1-4', page],
  ['page.secondary', '--color-text1-3', page],
  ['card.body', '--color-text1-4', card],
  ['card.secondary', '--color-text1-3', card],
  ['table.body', '--color-text1-4', ['--pod-table-cell-color', ...card]],
  ['table.heading', '--color-text1-10', ['--color-fill1-1', ...card]],
  ['form.label', '--pod-form-label-color', ['--yida-form-content-bgcolor', ...page]],
  ['input.value', '--color-text1-4', input],
  ['input.placeholder', '--color-text1-10', input],
  ['input.hover', '--color-text1-4', ['--input-hover-bg-color', ...input]],
  ['input.focus', '--color-text1-4', ['--input-focus-bg-color', ...input]],
  ['detail.value', '--pod-field-preview-text-color', ['--pod-field-preview-bg-color', ...card]],
  ['nav.item', '--pod-nav-item-text-color', nav],
  ['nav.hover', '--pod-nav-item-text-hover-color', ['--pod-nav-menu-bg-hover-color', ...nav]],
  ['nav.selected', '--pod-nav-item-text-selected-color', ['--pod-nav-menu-bg-selected-color', ...nav]],
  ['nav.popup', '--pod-nav-item-text-color', ['--pod-nav-popup-bg-color', ...nav]],
  ['nav.group', '--pod-nav-l-group-label-color', nav],
  ['nav.l-item', '--pod-nav-item-text-color', ['--pod-nav-l-container-bg', ...nav]],
  ['nav.l-group', '--pod-nav-l-group-label-color', ['--pod-nav-l-container-bg', ...nav]],
  ['header.title', '--pod-page-header-text-color', ['--pod-page-header-bg-color', ...nav]],
  ...['', '-hover', '-active'].flatMap(state => [
    [`search${state}.value`, '--pod-nav-search-text-color', [`--pod-nav-search-bg${state}-color`, ...nav]],
    [`search${state}.placeholder`, '--pod-nav-search-placeholder-color', [`--pod-nav-search-bg${state}-color`, ...nav]],
  ]),
];

/** Check resolved text roles, compositing translucent fills on their owning surface.
 * Unknown colors are reported separately; this is not a browser/gradient audit.
 */
function auditPalette(tokens) {
  const checks = [], issues = [], unresolved = [];
  const paint = names => {
    if (!names.length) {return null;}
    const front = color(tokens[names[0]], tokens);
    if (!front) {return null;}
    if (front[3] === 1) {return front;}
    const back = paint(names.slice(1));
    return back ? composite(front, back) : null;
  };
  for (const [role, foreground, backgrounds] of PAIRS) {
    const entry = { role, foreground, background: backgrounds[0], minimum: 4.5 };
    const fg = color(tokens[foreground], tokens), bg = paint(backgrounds);
    if (!fg || !bg) {unresolved.push({ ...entry, reason: 'COLOR_OR_SURFACE_UNRESOLVED' }); continue;}
    const ratio = contrast(composite(fg, bg), bg);
    const result = { ...entry, ratio: Math.round(ratio * 100) / 100 };
    checks.push(result);
    if (ratio < entry.minimum) {issues.push(result);}
  }
  return { checks, issues, unresolved };
}

/** Reject known unreadable pairs without silently changing a project's palette. */
function validatePalette(tokens) {
  const result = auditPalette(tokens);
  if (result.issues.length) {
    throw new CliError(t('design_document.invalid', 'tokens', 'TEXT_CONTRAST_LOW'), {
      code: 'DESIGN_THEME_CONTRAST_LOW', details: { issue: 'TEXT_CONTRAST_LOW', issues: result.issues, unresolved: result.unresolved },
    });
  }
  return result;
}

module.exports = { auditPalette, validatePalette };
