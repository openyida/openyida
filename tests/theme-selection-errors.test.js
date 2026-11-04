'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { run: checkDesign } = require('../lib/design/check-design');
const { run: sample } = require('../lib/core/sample');
const { catalog } = require('../lib/design-plan/init');
const { renderDesign } = require('../lib/design-plan/materialize');
const { parseDesignDocument, serializeDesignDocument } = require('../lib/design/document');
const { prepareFastTheme } = require('../lib/app/fast-theme');
const { exportApplicationStyle } = require('../lib/app/application-style');
const { toErrorPayload } = require('../lib/core/cli-error');
const fixture = require('./fixtures/design-plan.json');
let directory;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-selection-'));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(directory, { recursive: true, force: true }); });

function designWith(themeId) {
  const document = parseDesignDocument(renderDesign(fixture));
  document.metadata.themeProfile.sourceThemeId = themeId;
  // The actual failure also had an invalid delivery field. Report the stale
  // selection before the agent spends time repairing unrelated authoring data.
  document.metadata.themeProfile.themeDelivery = 'file';
  return serializeDesignDocument(document);
}

function errorFrom(action) {
  try { action(); } catch (error) { return error; }
  throw new Error('Expected theme selection to fail');
}

function expectRecovery(error, themeId, field, reason = 'UNLISTED_TEMPLATE') {
  const payload = toErrorPayload(error);
  expect(payload.success).toBe(false);
  expect(payload.details).toMatchObject({
    themeId, path: field, reason,
    catalogCommand: 'openyida design-plan catalog --compact',
    nextArgv: ['design-plan', 'catalog', '--compact'],
    preserveProjectFiles: true, idOnlyReplacementAllowed: false,
    issues: [expect.objectContaining({ path: field, actual: themeId, code: 'APPLICATION_STYLE_UNKNOWN', reason })],
  });
  const current = catalog();
  expect(payload.details.availableThemeIds).toEqual([...current.themes, current.creativeOption].map(item => item.themeId));
  expect(payload.details.availableThemeIds).not.toContain(themeId);
  return payload;
}

test.each([
  ['app-amber', 'UNLISTED_TEMPLATE'],
  ['not-a-theme', 'UNKNOWN_THEME_ID'],
])('check-design locates %s early and returns source repair plus catalog recovery', async (themeId, reason) => {
  const file = path.join(directory, 'design.md');
  const original = designWith(themeId);
  fs.writeFileSync(file, original);
  let error;
  try { await checkDesign([file, '--json']); } catch (caught) { error = caught; }
  expect(error).toMatchObject({ code: 'APPLICATION_STYLE_UNKNOWN' });
  const payload = expectRecovery(error, themeId, 'themeProfile.sourceThemeId', reason);
  expect(payload.details.issues[0].sourcePath).toBe(file);
  expect(payload.repair).toMatchObject({ unchangedRetryAllowed: false, inputs: [{ sourcePath: file, hash: expect.any(String) }] });
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
});

test('legacy app-theme reports the stale source without overwriting CSS or its snapshot', async () => {
  const design = path.join(directory, 'design.md');
  const css = path.join(directory, 'app_theme.css');
  const snapshot = `${css}.tokens.md`;
  fs.writeFileSync(design, designWith('app-amber'));
  fs.writeFileSync(css, '.project-rule { padding: 17px; }');
  fs.writeFileSync(snapshot, 'previous token snapshot');
  const before = [design, css, snapshot].map(file => fs.readFileSync(file, 'utf8'));
  let error;
  try { await sample(['yida-design', 'app-theme', '--design-file', design, '--output', css]); } catch (caught) { error = caught; }
  expect(error).toMatchObject({ code: 'APPLICATION_STYLE_UNKNOWN' });
  expectRecovery(error, 'app-amber', 'themeProfile.sourceThemeId');
  expect([design, css, snapshot].map(file => fs.readFileSync(file, 'utf8'))).toEqual(before);
});

test('Fast theme retains its error contract, explains stale selection and leaves existing output intact', () => {
  const output = path.join(directory, 'app_theme.css');
  fs.writeFileSync(output, '.project-rule { padding: 17px; }');
  const error = errorFrom(() => prepareFastTheme({ styleId: 'app-amber', primaryColor: '#2E6E8E', output }));
  expect(error.code).toBe('FAST_THEME_INVALID');
  const payload = expectRecovery(error, 'app-amber', '--style-id');
  expect(payload).toMatchObject({ stage: 'preflight', retrySafe: true, sideEffectState: 'not_started', mutationPerformed: false });
  expect(fs.readFileSync(output, 'utf8')).toBe('.project-rule { padding: 17px; }');
  expect(fs.readdirSync(directory)).toEqual(['app_theme.css']);
});

test('template export rejects an unlisted on-disk bundle before creating a directory', () => {
  const output = path.join(directory, 'export');
  const error = errorFrom(() => exportApplicationStyle('app-amber', output));
  expect(error.code).toBe('APPLICATION_STYLE_UNKNOWN');
  expectRecovery(error, 'app-amber', '--style-id');
  expect(fs.existsSync(output)).toBe(false);
});

test('a current catalog selection recovers through Fast CSS generation without requiring documents', () => {
  const { themes } = catalog();
  const selected = themes.find(theme => theme.themeId === 'app-platinum');
  expect(selected).toBeDefined();
  const output = path.join(directory, 'app_theme.css');
  const result = prepareFastTheme({ styleId: selected.themeId, primaryColor: '#2E6E8E', output });
  expect(result.success).toBe(true);
  expect(fs.readFileSync(output, 'utf8')).toContain(`openyida-theme-source: ${selected.themeId}`);
  expect(fs.readdirSync(directory)).toEqual(['app_theme.css']);
});
