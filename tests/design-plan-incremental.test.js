'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { materialize } = require('../lib/design-plan/materialize');
const { patchPlan } = require('../lib/design-plan/patch');
const { mergeDocument } = require('../lib/design-plan/artifact-updates');

let dir, input;
const file = name => path.join(dir, name);
const read = name => fs.readFileSync(file(name), 'utf8');
const names = ['build-plan.json', 'prd.md', 'design.md', 'build-plan.html', 'app-theme.css', '.build-plan-artifacts.json'];
const snapshot = () => names.map(read);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-incremental-'));
  input = file('build-plan.json');
  fs.copyFileSync(path.join(__dirname, 'fixtures/design-plan.json'), input);
});
afterEach(() => {jest.restoreAllMocks(); fs.rmSync(dir, { recursive: true, force: true });});

test('color edits preserve local notes, HTML shell and custom CSS; unchanged outputs are not written', () => {
  materialize(input);
  const prd = read('prd.md').replace('## 3. 数据结构', '<!-- 保留业务备注 -->\n\n## 3. 数据结构');
  const design = read('design.md').replace('## 3.', '<!-- 保留组件备注 -->\n\n## 3.');
  const html = read('build-plan.html').replace('</head>', '<!-- 保留页面样式 -->\n</head>');
  const css = read('app-theme.css') + '\n.my-page { background: linear-gradient(red, blue); }\n';
  for (const [name, value] of Object.entries({ 'prd.md': prd, 'design.md': design, 'build-plan.html': html, 'app-theme.css': css })) {fs.writeFileSync(file(name), value);}
  const result = patchPlan(input, ['visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C'], { materialize: true });
  expect(result.updated.map(value => path.basename(value))).toEqual(expect.arrayContaining(['prd.md', 'design.md', 'build-plan.html', 'app-theme.css']));
  expect(read('prd.md')).toContain('<!-- 保留业务备注 -->');
  expect(read('design.md')).toContain('<!-- 保留组件备注 -->');
  expect(read('build-plan.html')).toContain('<!-- 保留页面样式 -->');
  expect(read('app-theme.css')).toContain('.my-page { background: linear-gradient(red, blue); }');
  for (const name of ['prd.md', 'design.md', 'build-plan.html', 'app-theme.css']) {expect(read(name)).toContain('#8B5E3C');}
  const before = snapshot();
  const mtimes = names.map(name => fs.statSync(file(name)).mtimeMs);
  expect(materialize(input).updated).toEqual([]);
  expect(snapshot()).toEqual(before);
  expect(names.map(name => fs.statSync(file(name)).mtimeMs)).toEqual(mtimes);
});

test('business-only edit leaves theme CSS unchanged', () => {
  materialize(input);
  const css = read('app-theme.css'), mtime = fs.statSync(file('app-theme.css')).mtimeMs;
  const result = patchPlan(input, ['overview.summary=围绕采购登记与审批处理安排页面'], { materialize: true });
  expect(read('prd.md')).toContain('围绕采购登记与审批处理安排页面');
  expect(read('build-plan.html')).toContain('围绕采购登记与审批处理安排页面');
  expect(result.updated).not.toContain(file('app-theme.css'));
  expect(read('app-theme.css')).toBe(css);
  expect(fs.statSync(file('app-theme.css')).mtimeMs).toBe(mtime);
});

test('preserved design token edits also reach the existing theme stylesheet', () => {
  materialize(input);
  const design = read('design.md').replace(/("--corner-2":\s*)"[^"]+"/, '$1"19px"');
  expect(design).toContain('"--corner-2": "19px"');
  fs.writeFileSync(file('design.md'), design);
  patchPlan(input, ['overview.summary=同步已有设计与业务说明'], { materialize: true });
  expect(read('design.md')).toContain('"--corner-2": "19px"');
  expect(read('app-theme.css')).toMatch(/--corner-2:\s*19px/);
});

test('overlapping local edits fail without changing source, outputs or baseline', () => {
  materialize(input);
  const plan = JSON.parse(read('build-plan.json'));
  fs.writeFileSync(file('prd.md'), read('prd.md').replace(plan.overview.summary, '本地修改的业务说明'));
  const before = snapshot();
  expect(() => patchPlan(input, ['overview.summary=新的业务说明'], { materialize: true }))
    .toThrow(expect.objectContaining({ code: 'DESIGN_PLAN_UPDATE_CONFLICT', details: { file: file('prd.md'), section: 'chapter-1' } }));
  expect(snapshot()).toEqual(before);
});

test('failed save rolls back source, changed documents and baseline together', () => {
  materialize(input);
  const before = snapshot();
  const rename = fs.renameSync;
  jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (to === file('.build-plan-artifacts.json') && path.basename(from) === 'next') {throw new Error('disk failure');}
    return rename(from, to);
  });
  expect(() => patchPlan(input, ['overview.summary=更新业务说明'], { materialize: true })).toThrow('disk failure');
  expect(snapshot()).toEqual(before);
});

test('source-only edits skip HTML rendering and later materialize includes all pending changes', () => {
  materialize(input);
  const before = names.slice(1).map(read);
  const spawn = jest.spyOn(require('child_process'), 'spawnSync').mockImplementation(() => {throw new Error('unexpected renderer');});
  jest.isolateModules(() => {
    const { patchPlan: sourcePatch } = require('../lib/design-plan/patch');
    sourcePatch(input, ['overview.summary=仅修改计划源']);
    sourcePatch(input, ['visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C']);
  });
  expect(spawn).not.toHaveBeenCalled();
  expect(names.slice(1).map(read)).toEqual(before);
  spawn.mockRestore();
  materialize(input);
  expect(read('prd.md')).toContain('仅修改计划源');
  expect(read('build-plan.html')).toContain('#8B5E3C');
});

test('existing generated plans can start incremental editing without a saved baseline', () => {
  materialize(input);
  fs.unlinkSync(file('.build-plan-artifacts.json'));
  fs.appendFileSync(file('prd.md'), '\n<!-- 原有备注 -->\n');
  patchPlan(input, ['visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C'], { materialize: true });
  expect(read('prd.md')).toContain('<!-- 原有备注 -->');
  expect(read('prd.md')).toContain('#8B5E3C');
  expect(fs.existsSync(file('.build-plan-artifacts.json'))).toBe(true);
});

test('chapter-like text in code fences is not a document boundary', () => {
  const before = '# 文档\n## 1. 正文\n```md\n## 9. 示例\n```\n旧内容\n## 2. 结尾\n保留\n';
  const current = before.replace('保留\n', '本地备注\n');
  expect(mergeDocument(before, before.replace('旧内容', '新内容'), current, 'prd.md'))
    .toBe(current.replace('旧内容', '新内容'));
});

test('source-only edits retain layout validation without running the HTML renderer', () => {
  const before = read('build-plan.json');
  expect(() => patchPlan(input, ['pages.customPageDetails[0].layoutPattern.mode=invalid']))
    .toThrow(/layoutPattern.mode/);
  expect(read('build-plan.json')).toBe(before);
});

test('CLI accepts one batch and reports the actual updated artifact paths', async () => {
  materialize(input);
  const output = jest.spyOn(console, 'log').mockImplementation(() => {});
  await require('../lib/design-plan/design-plan').run(['patch', input,
    '--set', 'visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C',
    '--set', 'visualStyle.forUser.colorStrategy.primaryColorName=咖啡色', '--materialize', '--json']);
  const result = JSON.parse(output.mock.calls[0][0]);
  expect(result.changedPaths).toHaveLength(2);
  expect(result.updated).toContain(result.outputs.html);
  expect(read('build-plan.html')).toContain('#8B5E3C');
  output.mockClear();
  await require('../lib/design-plan/design-plan').run(['patch', input,
    '--set', 'visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C', '--materialize', '--json']);
  expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({ changed: false, updated: [] });
});

test('materialize reuses validation and theme output for identical inputs', () => {
  jest.isolateModules(() => {
    const document = require('../lib/design/document');
    const theme = require('../lib/app/theme-from-design');
    const validate = jest.spyOn(document, 'validateDesignDocument');
    const apply = jest.spyOn(theme, 'applyDesignTokens');
    const { materialize: generate } = require('../lib/design-plan/materialize');
    const { patchPlan: patch } = require('../lib/design-plan/patch');
    generate(input);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    validate.mockClear(); apply.mockClear();
    patch(input, ['overview.summary=复用相同输入的计算结果'], { materialize: true });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(2);
  });
});

test('invalid local design metadata is still validated before saving a business edit', () => {
  materialize(input);
  const original = read('design.md');
  const edited = original.replace(/("themeDelivery":\s*)"app-custom-theme-file"/, '$1"invalid"');
  expect(edited).not.toBe(original);
  fs.writeFileSync(file('design.md'), edited);
  const before = snapshot();
  expect(() => patchPlan(input, ['overview.summary=业务更新不得掩盖无效设计'], { materialize: true }))
    .toThrow(expect.objectContaining({ code: 'DESIGN_DOCUMENT_INVALID', details: { field: 'themeProfile.themeDelivery', issue: 'INVALID_THEME_DELIVERY' } }));
  expect(snapshot()).toEqual(before);
});

test('empty existing theme is rejected instead of reusing the generated base theme', () => {
  materialize(input);
  fs.writeFileSync(file('app-theme.css'), '');
  const before = snapshot();
  expect(() => patchPlan(input, ['overview.summary=不得覆盖损坏主题'], { materialize: true })).toThrow();
  expect(snapshot()).toEqual(before);
});
