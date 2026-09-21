'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { materialize } = require('../lib/design-plan/materialize');
const { planBase } = require('../lib/design-plan/parallel');

function normalizeDesignPath(content, from, to) {
  return content.replaceAll(JSON.stringify(from), () => JSON.stringify(to))
    .replaceAll(from, () => to);
}

test.each([path.posix, path.win32])('normalizes plain and JSON design paths with separator $sep', paths => {
  const root = paths.resolve('project');
  const from = paths.join(root, 'expected', 'design.md');
  const to = paths.join(root, 'design.md');
  const artifact = file => `Design: ${file}\n${JSON.stringify({ designFile: file, title: '采购工作台' })}`;
  expect(normalizeDesignPath(artifact(from), from, to)).toBe(artifact(to));
});

let dir, input, source, businessFile, visualFile, business, visual;
const save = () => {
  fs.writeFileSync(input, JSON.stringify(source));
  fs.writeFileSync(businessFile, JSON.stringify(business));
  fs.writeFileSync(visualFile, JSON.stringify(visual));
};
const merge = options => materialize(input, { businessFile, visualFile, ...options });
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-parallel-'));
  input = path.join(dir, 'build-plan.json');
  businessFile = path.join(dir, 'business.json');
  visualFile = path.join(dir, 'visual.json');
  source = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
  business = { base: planBase(source), ready: true, facts: {
    overview: source.overview, dataModels: source.dataModels, businessFlows: source.businessFlows, pages: source.pages,
  } };
  visual = { base: planBase(source), ready: true, facts: { visualStyle: source.visualStyle } };
  business = JSON.parse(JSON.stringify(business));
  visual = JSON.parse(JSON.stringify(visual));
  save();
});
afterEach(() => {jest.restoreAllMocks(); fs.rmSync(dir, { recursive: true, force: true });});

test('joins independent results, invalidates old confirmation, and writes one matching artifact set', () => {
  source.meta.status = 'confirmed';
  source.meta.planState = { planConfirmed: true, presentedRevision: source.meta.revision, confirmedRevision: source.meta.revision };
  business.base = visual.base = planBase(source);
  business.facts.overview.summary = '根据已展示方案补充采购目标';
  save();
  const beforeParts = [businessFile, visualFile].map(file => fs.readFileSync(file, 'utf8'));
  const result = JSON.parse(require('child_process').execFileSync(process.execPath, [path.join(__dirname, '../bin/yida.js'),
    'design-plan', 'materialize', input, '--business-file', businessFile, '--visual-file', visualFile, '--json'],
  { cwd: dir, encoding: 'utf8', env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1' } }));
  const merged = JSON.parse(fs.readFileSync(input, 'utf8'));
  expect(result.merged).toBe(true);
  expect(result.revision).not.toBe(source.meta.revision);
  expect(merged.meta).toMatchObject({ status: 'awaiting_confirmation', planState: { planConfirmed: false, confirmedRevision: null, presentedRevision: null } });
  const expectedDir = path.join(dir, 'expected');
  const expected = materialize(input, { outputDir: expectedDir });
  for (const key of ['prd', 'html']) {
    const actual = fs.readFileSync(result.outputs[key], 'utf8');
    const regenerated = fs.readFileSync(expected.outputs[key], 'utf8');
    // Each output directory has its own design file; other content must match.
    if (key === 'prd') {
      expect(actual).toContain(result.outputs.design);
      expect(regenerated).toContain(expected.outputs.design);
    }
    expect(normalizeDesignPath(regenerated, expected.outputs.design, result.outputs.design)).toBe(actual);
  }
  const { parseDesignDocument } = require('../lib/design/document');
  const actualDesign = parseDesignDocument(fs.readFileSync(result.outputs.design, 'utf8'));
  const expectedDesign = parseDesignDocument(fs.readFileSync(expected.outputs.design, 'utf8'));
  expect(actualDesign.metadata.themeProfile.themeFile).toBe(result.outputs.theme);
  expect(expectedDesign.metadata.themeProfile.themeFile).toBe(expected.outputs.theme);
  expectedDesign.metadata.themeProfile.themeFile = actualDesign.metadata.themeProfile.themeFile;
  expect(actualDesign).toEqual(expectedDesign);
  expect([businessFile, visualFile].map(file => fs.readFileSync(file, 'utf8'))).toEqual(beforeParts);
  expect(() => merge()).toThrow('旧版本');
});

test('first assembly keeps revision 1 and still rejects reused parts by digest', () => {
  source.meta.revision = '1';
  source.meta.planState = { presentedRevision: null, confirmedRevision: null, planConfirmed: false };
  business.base = visual.base = planBase(source);
  business.facts.overview.summary = '首次补全业务事实';
  save();
  const result = merge();
  expect(result).toMatchObject({ previousRevision: '1', revision: '1' });
  expect(JSON.parse(fs.readFileSync(input)).meta.status).toBe('awaiting_confirmation');
  for (const name of ['prd', 'design']) {
    expect(fs.readFileSync(result.outputs[name], 'utf8')).toContain('buildPlanRevision: "1"');
  }
  expect(() => merge()).toThrow('旧版本');
});

test.each(['visualDirection', 'navigationStyle'])('rejects string %s with field guidance and no artifact writes', field => {
  visual.facts.visualStyle.forUser[field] = '顶部导航';
  save();
  const before = [input, businessFile, visualFile].map(file => fs.readFileSync(file, 'utf8'));
  expect(() => merge()).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_VISUAL_FIELD_TYPE_INVALID',
    details: expect.objectContaining({ sourcePath: visualFile, path: `facts.visualStyle.forUser.${field}`, expectedType: 'object', receivedType: 'string' }),
  }));
  expect([input, businessFile, visualFile].map(file => fs.readFileSync(file, 'utf8'))).toEqual(before);
  expect(fs.existsSync(path.join(dir, 'prd.html'))).toBe(false);
  expect(fs.existsSync(path.join(dir, 'prd.md'))).toBe(false);
});

test('identical reassembly preserves a confirmed version and its approval', () => {
  source.meta.status = 'confirmed';
  source.meta.planState = { planConfirmed: true, presentedRevision: source.meta.revision, confirmedRevision: source.meta.revision };
  business.base = visual.base = planBase(source);
  save();
  const result = merge();
  expect(result.revision).toBe(source.meta.revision);
  expect(JSON.parse(fs.readFileSync(input)).meta).toEqual(source.meta);
});

test.each([
  ['unfinished visual', () => {visual.ready = false;}],
  ['old base even with the same revision', () => {source.overview.summary = 'changed after dispatch';}],
  ['business writing visual fields', () => {business.facts.visualStyle = {};}],
  ['visual writing business fields', () => {visual.facts.pages = source.pages;}],
  ['business changing revision', () => {business.facts.meta = { revision: '999' };}],
  ['missing page binding', () => {visual.facts.visualStyle.forUser.pageApplications = [];}],
  ['unknown page binding', () => {visual.facts.visualStyle.forUser.pageApplications[0].pageId = 'unknown';}],
])('rejects %s without changing any existing artifact', (_name, change) => {
  materialize(input);
  change(); save();
  const files = [input, path.join(dir, 'prd.md'), path.join(dir, 'design.md'), path.join(dir, 'build-plan.html')];
  const before = files.map(file => fs.readFileSync(file, 'utf8'));
  expect(() => merge()).toThrow();
  expect(files.map(file => fs.readFileSync(file, 'utf8'))).toEqual(before);
});

test('check-only does not publish the merged source or artifacts', () => {
  const before = fs.readFileSync(input, 'utf8');
  const result = merge({ check: true });
  expect(result.checked).toBe(true);
  expect(fs.readFileSync(input, 'utf8')).toBe(before);
  expect(fs.existsSync(result.outputs.html)).toBe(false);
});

test('rolls source and artifacts back together if an artifact write fails', () => {
  materialize(input);
  visual.facts.visualStyle.forUser.colorStrategy.primaryColor = '#8B5E3C';
  save();
  const files = [input, path.join(dir, 'prd.md'), path.join(dir, 'design.md'), path.join(dir, 'build-plan.html')];
  const before = files.map(file => fs.readFileSync(file, 'utf8'));
  const rename = fs.renameSync;
  let failed = false;
  jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (!failed && to === path.join(dir, 'design.md')) {failed = true; throw new Error('simulated disk failure');}
    return rename(from, to);
  });
  expect(() => merge()).toThrow('simulated disk failure');
  expect(files.map(file => fs.readFileSync(file, 'utf8'))).toEqual(before);
});

test('requires both input parts and records their options in the public manifest', () => {
  expect(() => materialize(input, { businessFile })).toThrow('同时提供');
  expect(() => merge({ visualFile: businessFile })).toThrow('独立文件');
  const command = require('../lib/core/command-manifest').buildCommandManifest().commands.find(item => item.id === 'design-plan.materialize');
  expect(command.args.map(arg => arg.builder_options[0])).toEqual(expect.arrayContaining(['--business-file', '--visual-file', '--check', '--output-dir', '--json']));
});


test.each([
  ['missing binding', apps => apps.splice(0), 'missing_page'],
  ['extra native form', apps => apps.push({ pageId: 'native-form', visualMemoryApplications: [] }), 'unexpected_page'],
  ['duplicate binding', apps => apps.push({ ...apps[0] }), 'duplicate_page'],
  ['missing memories array', apps => { delete apps[0].visualMemoryApplications; }, 'expected_array'],
  ['wrong memories type', apps => { apps[0].visualMemoryApplications = 'none'; }, 'expected_array'],
  ['null binding', apps => { apps[0] = null; }, 'expected_object'],
  ['missing pageId', apps => { delete apps[0].pageId; }, 'expected_nonempty_string'],
])('diagnoses %s and repairs the existing draft without deleting artifacts', (_name, change, issueCode) => {
  materialize(input);
  const validApps = JSON.parse(JSON.stringify(visual.facts.visualStyle.forUser.pageApplications));
  change(visual.facts.visualStyle.forUser.pageApplications);
  save();
  const files = [input, businessFile, visualFile, path.join(dir, 'prd.md'), path.join(dir, 'design.md'), path.join(dir, 'build-plan.html')];
  const before = files.map(file => fs.readFileSync(file, 'utf8'));
  expect(() => merge()).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_PAGE_BINDINGS_REQUIRED',
    details: expect.objectContaining({
      sourcePath: visualFile,
      expectedPageIds: business.facts.pages.customPageDetails.map(page => page.pageId),
      issues: expect.arrayContaining([expect.objectContaining({ code: issueCode, path: expect.any(String) })]),
    }),
  }));
  expect(files.map(file => fs.readFileSync(file, 'utf8'))).toEqual(before);
  visual.facts.visualStyle.forUser.pageApplications = validApps;
  fs.writeFileSync(visualFile, JSON.stringify(visual));
  const result = merge();
  expect(fs.readFileSync(result.outputs.html, 'utf8')).toContain(source.pages.customPageDetails[0].name);
  expect(fs.readFileSync(result.outputs.prd, 'utf8')).toContain(source.overview.summary);
  const repaired = JSON.parse(fs.readFileSync(input));
  expect(repaired.visualStyle.forUser.pageApplications).toEqual(validApps);
  expect(repaired.meta.status).toBe('awaiting_confirmation');
  expect(repaired.meta.planState?.planConfirmed).not.toBe(true);
  // The fixed parts also remain usable for a draft preview; no source reset needed.
  const { preview } = require('../lib/design-plan/preview');
  fs.writeFileSync(visualFile, JSON.stringify({ ...visual, base: planBase(repaired) }));
  const draft = preview(input, { partFile: visualFile });
  expect(draft.draft).toBe(true);
  expect(fs.existsSync(draft.outputs.html)).toBe(true);
});

test('reports all binding errors together in the CLI JSON response', () => {
  visual.facts.visualStyle.forUser.pageApplications = [{ pageId: 'native-form' }];
  save();
  const result = require('child_process').spawnSync(process.execPath, [path.join(__dirname, '../bin/yida.js'),
    'design-plan', 'materialize', input, '--business-file', businessFile, '--visual-file', visualFile, '--json'],
  { cwd: dir, encoding: 'utf8', env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1', OPENYIDA_LANG: 'en' } });
  expect(result.status).toBe(1);
  const payload = JSON.parse(result.stderr);
  expect(payload.errorCode).toBe('DESIGN_PLAN_PAGE_BINDINGS_REQUIRED');
  expect(payload.details.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['missing_page', 'unexpected_page', 'expected_array']));
  expect(payload.errorMsg).toContain('customPageDetails');
  expect(payload.details.nextStep).toContain('Do not delete');
});


test.each([undefined, null, {}])('invalid applications container %s has structured diagnostics', value => {
  visual.facts.visualStyle.forUser.pageApplications = value;
  save();
  expect(() => merge()).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_PAGE_BINDINGS_REQUIRED',
    details: expect.objectContaining({ issues: expect.arrayContaining([
      expect.objectContaining({ code: 'expected_array', path: 'facts.visualStyle.forUser.pageApplications' }),
    ]) }),
  }));
});

test.each([null, {}, { pageId: '' }])('invalid business page %s points to business.json', value => {
  business.facts.pages.customPageDetails = [value];
  save();
  expect(() => merge()).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_PAGE_BINDINGS_REQUIRED',
    details: expect.objectContaining({ issues: expect.arrayContaining([
      expect.objectContaining({ code: 'expected_nonempty_string', sourcePath: businessFile, path: 'facts.pages.customPageDetails[0].pageId' }),
    ]) }),
  }));
});

test('native-form-only planning needs no invented visual page binding', () => {
  business.facts.pages.customPageDetails = [];
  visual.facts.visualStyle.forUser.pageApplications = [];
  save();
  const merged = require('../lib/design-plan/parallel').mergeParts(source, businessFile, visualFile);
  expect(merged.visualStyle.forUser.pageApplications).toEqual([]);
});
