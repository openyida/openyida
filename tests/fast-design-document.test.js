'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { renderFastDocument, generateFastDocument } = require('../lib/design/fast-document');
const { parseDesignDocument, validateDesignDocument } = require('../lib/design/document');
const { generateThemeCss } = require('../lib/app/theme-source');
const { resolveAssets } = require('../lib/asset/asset-resolve');
const { catalog } = require('../lib/design-plan/init');
const { buildCommandManifest } = require('../lib/core/command-manifest');

const source = path.resolve(__dirname, '../lib/samples/yida-design/fast-design.json');
const fixture = () => JSON.parse(fs.readFileSync(source, 'utf8'));
let dir;
beforeEach(() => {dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-design-'));});
afterEach(() => {fs.rmSync(dir, { recursive: true, force: true });});
function cli(args) {
  const env = { ...process.env, OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    OPENYIDA_SKILLS_DIR: path.join(dir, 'skills'), NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.OPENYIDA_MANAGED_RUN;
  return execFileSync(process.execPath, [path.resolve(__dirname, '../bin/yida.js'), ...args], { cwd: dir, env, encoding: 'utf8', stdio: 'pipe' });
}

test('compact catalog is complete, machine-readable and retains restricted-theme eligibility', () => {
  const before = fs.readdirSync(dir);
  const full = catalog(), compact = JSON.parse(cli(['design-plan', 'catalog', '--compact', '--json']));
  expect(compact.themes.map(t => t.themeId)).toEqual(full.themes.map(t => t.themeId));
  expect(compact.creativeOption.themeId).toBe(full.creativeOption.themeId);
  expect(compact.themes.find(t => t.themeId === 'app-pop').selectionEligibility)
    .toEqual(full.themes.find(t => t.themeId === 'app-pop').selectionEligibility);
  expect(compact.previewDefault).toBe(false);
  expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(full).length / 4);
  expect(fs.readdirSync(dir)).toEqual(before);
});

test('short project decisions generate a complete design and matching CSS without a Plan revision', () => {
  const input = fixture(); input.name = '护肤品牌'; input.primaryColor = '#456';
  const result = renderFastDocument(input, { outputDir: 'prd/品牌' });
  const parsed = parseDesignDocument(result.markdown);
  expect(parsed.metadata).not.toHaveProperty('buildPlanRevision');
  expect(parsed.metadata.themeProfile).toMatchObject({ themeColor: '#445566', contentTone: 'light', navTheme: 'light', themeFile: 'prd/品牌/app-theme.css' });
  expect(result.validation).toMatchObject({ success: true, pages: ['website'] });
  expect(result.markdown).toContain(input.pages[0].primaryTask);
  expect(result.markdown).not.toMatch(/草稿待补充|\{\{/);
  const css = generateThemeCss(result.markdown);
  expect(css).toContain('#445566');
  expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(Buffer.byteLength(result.markdown) / 10);
});

test('three independent pages keep distinct identities and stable PRD references', () => {
  const input = fixture(); input.assetStrategy = { pages: [] };
  input.pages = ['home', 'cases', 'contact'].map(pageId => ({ ...input.pages[0], pageId, name: pageId, sceneKey: pageId }));
  const { markdown } = renderFastDocument(input);
  const metadata = parseDesignDocument(markdown).metadata;
  const prd = '```json\n' + JSON.stringify({ appConfig: {}, resourceBlueprint: [], pages: input.pages.map(page => ({ pageId: page.pageId,
    pageSpecHandoff: { designFile: 'prd/site/design.md', designRefs: ['themeProfile', `sceneRecipes.${page.sceneKey}`] } })) }) + '\n```';
  expect(validateDesignDocument(markdown, { designFile: path.join(dir, 'prd/site/design.md'), baseDir: dir, prdMarkdown: prd }).prdChecked).toBe(true);
  expect(new Set(Object.values(metadata.sceneRecipes).map(v => v.pages[0].anchor)).size).toBe(3);
});

test('required image gaps remain final-acceptance gaps without blocking a preview', async () => {
  const input = fixture(); input.assetStrategy.pages[0].imageNeed = 'required'; input.assetStrategy.pages[0].slots[0].required = true;
  const { metadata } = renderFastDocument(input);
  const result = await resolveAssets([], { assetStrategy: metadata.assetStrategy, online: false,
    status: { canUpload: false, cdnConfigured: false, hostCapabilities: {} } });
  expect(result.materialStatus).toBe('draft');
  expect(result.pages[0].assetGate).toEqual({ implementation: 'unblocked', preview: 'unblocked', finalAssetAcceptance: 'blocked' });
});

test('the public CLI copies an example, generates and checks a real design document', () => {
  const spec = path.join(dir, 'spec.json'), output = path.join(dir, 'prd/design.md');
  cli(['sample', 'yida-design', 'fast-spec', '--output', spec]);
  expect(JSON.parse(fs.readFileSync(spec, 'utf8'))).toEqual(fixture());
  const result = JSON.parse(cli(['sample', 'yida-design', 'document', '--spec-file', spec, '--output', output]));
  expect(result).toMatchObject({ success: true, mode: 'fast', pages: ['website'], designFile: output });
  expect(JSON.parse(cli(result.nextCheckArgv)).success).toBe(true);
  cli(result.nextThemeArgv);
  expect(fs.existsSync(path.join(dir, 'prd/app-theme.css'))).toBe(true);
  expect(fs.existsSync(path.join(dir, 'prd/build-plan.json'))).toBe(false);
});

test('invalid short input reports independent missing decisions together and writes nothing', () => {
  const input = fixture(); delete input.direction; delete input.pages[0].layout; delete input.pages[0].responsive;
  const file = path.join(dir, 'spec.json'); fs.writeFileSync(file, JSON.stringify(input));
  let error;
  try {generateFastDocument(file, path.join(dir, 'new/design.md'));} catch (caught) {error = caught;}
  expect(error.code).toBe('FAST_DESIGN_SPEC_INVALID');
  expect(error.details.issues.map(i => i.path)).toEqual(expect.arrayContaining(['direction', 'pages[0].layout', 'pages[0].responsive']));
  expect(fs.readdirSync(dir)).toEqual(['spec.json']);
});

test('existing designs and input files cannot be overwritten', () => {
  const file = path.join(dir, 'spec.json'), output = path.join(dir, 'design.md');
  fs.writeFileSync(file, JSON.stringify(fixture())); fs.writeFileSync(output, 'existing user design');
  expect(() => generateFastDocument(file, output)).toThrow();
  expect(() => generateFastDocument(file, file)).toThrow();
  expect(fs.readFileSync(output, 'utf8')).toBe('existing user design');
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(fixture());
});

test.each(['unknown-theme', 'app-pop'])('rejects unverified theme selection %s', themeId => {
  const input = fixture(); input.themeId = themeId;
  expect(() => renderFastDocument(input)).toThrow();
});

test('theme layout restrictions, declared primary and contrast are still enforced', () => {
  const input = fixture(); input.themeId = 'dark-rail-fine-lines';
  expect(() => renderFastDocument(input)).toThrow();
  input.themeId = 'app-platinum'; input.tokens = { '--color-brand1-6': '#FF0000' };
  expect(() => renderFastDocument(input)).toThrow();
  input.tokens = { '--color-text1-4': '#FFFFFF', '--pod-page-bg-color': '#FFFFFF' };
  expect(() => renderFastDocument(input)).toThrow();
});

test('published CLI arguments match the manifest and reject options on unrelated samples', () => {
  const commands = buildCommandManifest().commands;
  expect(commands.find(c => c.id === 'design-plan.catalog').args.find(a => a.name === 'compact').builder_options).toEqual(['--compact']);
  expect(commands.find(c => c.id === 'sample').args.find(a => a.name === 'specFile').builder_options).toEqual(['--spec-file']);
  expect(() => cli(['sample', 'yida-design', 'app-theme', '--spec-file', 'spec.json'])).toThrow();
});
