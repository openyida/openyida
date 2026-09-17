'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { materialize } = require('../lib/design-plan/materialize');
const { planBase } = require('../lib/design-plan/parallel');

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
  for (const key of ['prd', 'design', 'html']) {
    expect(fs.readFileSync(result.outputs[key]).equals(fs.readFileSync(expected.outputs[key]))).toBe(true);
  }
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
