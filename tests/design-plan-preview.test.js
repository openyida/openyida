'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { preview } = require('../lib/design-plan/preview');
const { planBase } = require('../lib/design-plan/parallel');
const { materialize } = require('../lib/design-plan/materialize');
let dir, input, source;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-preview-'));
  input = path.join(dir, 'build-plan.json');
  source = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
  fs.writeFileSync(input, JSON.stringify(source));
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(dir, { recursive: true, force: true }); });
function update(facts, base = planBase(source)) {
  const file = path.join(dir, 'part.json');
  fs.writeFileSync(file, JSON.stringify({ base, facts }));
  return preview(input, { partFile: file });
}
const read = name => fs.readFileSync(path.join(dir, 'preview', name), 'utf8');

test('business module updates draft PRD and existing HTML section before visual completion', () => {
  const result = update({ dataModels: source.dataModels });
  expect(read('prd.md')).toContain(source.dataModels[0].name);
  expect(read('build-plan.html')).toContain(source.dataModels[0].name);
  expect(read('build-plan.html')).toContain('方案正在完善');
  expect(read('design.md')).toContain('正在完善');
  expect(fs.existsSync(path.join(dir, 'prd.md'))).toBe(false);
  const before = read('build-plan.html').match(/<!-- draft:data-models:start -->([\s\S]*?)<!-- draft:data-models:end -->/)[1];
  update({ businessFlows: source.businessFlows });
  expect(read('build-plan.html')).toContain(before);
  expect(update({ businessFlows: source.businessFlows }).updated).toEqual([]);
  expect(JSON.parse(fs.readFileSync(input))).toEqual(source);
  expect(result.draft).toBe(true);
});

test('visual module produces design and CSS independently and preserves custom CSS during updates', () => {
  update({ visualStyle: source.visualStyle });
  const cssPath = path.join(dir, 'preview/app-theme.css');
  fs.appendFileSync(cssPath, '\n.my-dialog { border: 3px solid purple; }\n');
  const visual = JSON.parse(JSON.stringify(source.visualStyle));
  visual.tokens = { '--custom-panel-radius': '18px' };
  update({ visualStyle: visual });
  expect(read('design.md')).toContain('--custom-panel-radius');
  expect(read('app-theme.css')).toContain('--custom-panel-radius: 18px;');
  expect(read('app-theme.css')).toContain('.my-dialog { border: 3px solid purple; }');
  const result = materialize(input);
  expect(fs.readFileSync(result.outputs.theme, 'utf8')).toContain('.my-dialog { border: 3px solid purple; }');
});

test('stale part and simultaneous writer preserve existing artifacts', () => {
  update({ dataModels: source.dataModels });
  const before = read('prd.md');
  expect(() => update({ businessFlows: [] }, { revision: 'old', digest: 'old' })).toThrow();
  fs.writeFileSync(path.join(dir, 'preview/.write.lock'), '');
  expect(() => update({ businessFlows: [] })).toThrow();
  expect(read('prd.md')).toBe(before);
});

test('failed install rolls back the section state and all affected drafts', () => {
  update({ dataModels: source.dataModels });
  const before = ['prd.md', 'build-plan.html', '.state.json'].map(read);
  const rename = fs.renameSync;
  jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (to === path.join(dir, 'preview/.state.json') && from.endsWith('next')) { throw new Error('write failed'); }
    return rename(from, to);
  });
  expect(() => update({ businessFlows: source.businessFlows })).toThrow('write failed');
  expect(['prd.md', 'build-plan.html', '.state.json'].map(read)).toEqual(before);
});

test('finalization promotes the accumulated facts and invalidates confirmation only after full validation', () => {
  source.meta.status = 'confirmed';
  source.meta.planState = { planConfirmed: true, confirmedRevision: source.meta.revision, presentedRevision: source.meta.revision };
  fs.writeFileSync(input, JSON.stringify(source));
  update({ overview: { ...source.overview, summary: '更新后的客户管理目标' }, dataModels: source.dataModels });
  expect(() => materialize(input, { fromPreview: true })).toThrow();
  expect(fs.existsSync(path.join(dir, 'prd.md'))).toBe(false);
  update({ businessFlows: source.businessFlows, pages: source.pages });
  update({ visualStyle: source.visualStyle });
  const result = materialize(input, { fromPreview: true });
  expect(result.merged).toBe(true);
  expect(Object.keys(result.outputs)).toEqual(['prd', 'design', 'html', 'theme']);
  expect(JSON.parse(fs.readFileSync(input)).meta.planState.planConfirmed).toBe(false);
  expect(fs.readFileSync(result.outputs.prd, 'utf8')).toContain('更新后的客户管理目标');
  expect(fs.readFileSync(result.outputs.html, 'utf8')).toContain('更新后的客户管理目标');
  expect(fs.readFileSync(result.outputs.html, 'utf8')).not.toContain('方案正在完善');
});

test('unchanged design tokens preserve local CSS overrides while changed tokens update', () => {
  const visual = JSON.parse(JSON.stringify(source.visualStyle));
  visual.tokens = { '--custom-panel-radius': '16px' };
  update({ visualStyle: visual });
  const cssFile = path.join(dir, 'preview/app-theme.css');
  fs.writeFileSync(cssFile, read('app-theme.css').replace('--custom-panel-radius: 16px;', '--custom-panel-radius: 24px;'));
  visual.tokens['--custom-panel-gap'] = '8px';
  update({ visualStyle: visual });
  expect(read('app-theme.css')).toContain('--custom-panel-radius: 24px;');
  expect(read('app-theme.css')).toContain('--custom-panel-gap: 8px;');
});

test('a new plan base resets draft sections and does not reuse an old theme', () => {
  update({ visualStyle: source.visualStyle });
  source.meta.revision = 'next';
  fs.writeFileSync(input, JSON.stringify(source));
  update({ dataModels: source.dataModels });
  expect(read('design.md')).toContain('正在完善');
  expect(read('app-theme.css')).not.toContain('--color-brand1-6');
  expect(() => materialize(input)).not.toThrow();
});

test('item upserts add or replace one model without resending the other models', () => {
  update({ dataModels: [source.dataModels[0]] });
  const file = path.join(dir, 'model.json');
  const other = { ...source.dataModels[0], name: '新增对象' };
  fs.writeFileSync(file, JSON.stringify({ base: planBase(source), mode: 'upsert', facts: { dataModels: [other] } }));
  preview(input, { partFile: file });
  const result = JSON.parse(read('.state.json')).facts.dataModels;
  expect(result.map(item => item.name)).toEqual([source.dataModels[0].name, '新增对象']);
  expect(read('prd.md')).toContain('新增对象');
  expect(read('build-plan.html')).toContain(source.dataModels[0].name);
});
