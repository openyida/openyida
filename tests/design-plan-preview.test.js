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

test('unsupported and empty facts modules name the offending key next to the allowed list', () => {
  const allowed = 'allowed: overview, dataModels, businessFlows, pages, visualStyle';
  expect(() => update({ execution: {} })).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_PREVIEW_INVALID', details: { reason: `facts modules: execution; ${allowed}` },
  }));
  expect(() => update({})).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_PREVIEW_INVALID', details: { reason: `facts modules: none; ${allowed}` },
  }));
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

test('draft and final HTML hide implementation detail while keeping source facts and complete delivery artifacts', () => {
  const page = source.pages.customPageDetails[0];
  page.pageSpecHandoff = {
    entryMode: 'standalone', navigation: { type: 'custom', variant: 'top', reason: '采购专员从固定菜单处理当日事项' },
    primaryAction: '核对当前采购差异', dataBinding: 'static-empty', dataSources: [],
    emptyReason: '供应商接口将在采购主数据验收后接入',
  };
  const sampleModel = source.dataModels.find(model => model.sampleRecords?.length);
  sampleModel.sampleRecords[0]['订单名称'] = '采购培训专用办公设备演示订单';
  source.execution = {
    interactionStates: { error: '采购网关离线时保留待核对记录并提示重试' },
    acceptanceCriteria: ['采购确认后逐项核验计划金额与订单金额'],
    resourceCreationOrder: ['先准备采购主数据后创建业务页面', ...source.dataModels.map(model => model.name), page.name],
    pageImplementationOrder: [page.pageId],
  };
  source.visualStyle.forUser.assetStrategy = { materialStatus: 'partial', missingAssets: ['采购企业标志待补充'], notes: '<script>previewUntrusted()</script>' };
  const before = JSON.stringify(source);
  fs.writeFileSync(input, before);
  update({ overview: source.overview, dataModels: source.dataModels, businessFlows: source.businessFlows, pages: source.pages, visualStyle: source.visualStyle });
  const draftHtml = read('build-plan.html');
  const draftDesign = read('design.md');
  expect(fs.readFileSync(input, 'utf8')).toBe(before);
  expect(JSON.parse(read('.state.json')).facts).toMatchObject({ dataModels: source.dataModels, pages: source.pages, visualStyle: source.visualStyle });
  const final = materialize(input, { outputDir: path.join(dir, 'final') });
  const finalHtml = fs.readFileSync(final.outputs.html, 'utf8');
  const finalPrd = fs.readFileSync(final.outputs.prd, 'utf8');
  const finalDesign = fs.readFileSync(final.outputs.design, 'utf8');
  const handoff = JSON.parse(finalPrd.match(/```json\n([\s\S]*?)\n```/)[1]);
  const application = source.visualStyle.forUser.pageApplications[0];
  const visualFacts = [application.firstScreenFocus, application.layout, application.responsive, application.surface, application.states, ...application.acceptanceChecks];
  for (const html of [draftHtml, finalHtml]) {
    for (const value of [source.execution.interactionStates.error, ...source.execution.acceptanceCriteria, source.execution.resourceCreationOrder[0],
      sampleModel.sampleRecords[0]['订单名称'], page.pageSpecHandoff.emptyReason, ...visualFacts,
      '初始示例数据', '交互状态', '页面视觉方案', '搭建顺序', '页面交付顺序', '<h3>验收标准</h3>']) {
      expect(html).not.toContain(value);
    }
    for (const value of [page.name, page.primaryTask, page.permissionSummary, '自定义顶部菜单', '应用工作区保留平台导航',
      page.pageSpecHandoff.primaryAction, '采购企业标志待补充', '部分已有', '导航顺序', '搭建范围']) {expect(html).toContain(value);}
    expect(html.match(/class="nav-item"/g)).toHaveLength(4);
    for (const section of ['overview', 'data-models', 'business-flows', 'pages']) {expect(html).toContain(`id="${section}"`);}
    expect(html).not.toContain('<script>previewUntrusted()</script>');
    expect(html).toContain('&lt;script&gt;previewUntrusted()&lt;/script&gt;');
    expect(html.match(/<div class="card page-detail">([\s\S]*?)<\/div>/)[1]).not.toContain('<table');
  }
  expect(handoff.interactionStates).toMatchObject(source.execution.interactionStates);
  expect(handoff.acceptanceCriteria).toContain(source.execution.acceptanceCriteria[0]);
  expect(handoff.resourceCreationOrder).toEqual(source.execution.resourceCreationOrder);
  expect(handoff.pageImplementationOrder).toEqual(source.execution.pageImplementationOrder);
  expect(handoff.sampleDataPlan.find(item => item.form === sampleModel.name).records).toEqual(sampleModel.sampleRecords);
  expect(handoff.pages[0].pageSpecHandoff.emptyReason).toBe(page.pageSpecHandoff.emptyReason);
  for (const value of visualFacts) {
    expect(draftDesign).toContain(value);
    expect(finalDesign).toContain(value);
  }
  expect(fs.readFileSync(input, 'utf8')).toBe(before);
});

test('a page without specialty recipes remains visible in draft design with the real preview theme path', () => {
  update({ pages: source.pages });
  const visual = JSON.parse(JSON.stringify(source.visualStyle));
  visual.forUser.pageApplications[0].visualMemoryApplications = [];
  visual.forUser.pageApplications[0].visualMemories = [];
  delete visual.forUser.pageApplications[0].layout;
  const result = update({ visualStyle: visual });
  const { metadata, body } = require('../lib/design/document').parseDesignDocument(read('design.md'));
  expect(metadata.sceneRecipes.workbench.pages[0].pageId).toBe(source.pages.customPageDetails[0].pageId);
  expect(body).toContain(source.pages.customPageDetails[0].name);
  expect(body).toContain('- 布局：草稿待补充');
  expect(metadata.themeProfile.themeFile).toBe(result.outputs.theme);
  expect(result.draft).toBe(true);
  expect(() => materialize(input, { fromPreview: true })).toThrow();
  expect(JSON.parse(fs.readFileSync(input, 'utf8'))).toEqual(source);
  expect(fs.existsSync(path.join(dir, 'design.md'))).toBe(false);
});

test('incomplete page drafts display standalone menus but cannot be finalized', () => {
  const pages = JSON.parse(JSON.stringify(source.pages));
  const page = pages.customPageDetails[0];
  delete page.primaryTask;
  delete page.dataBinding;
  page.pageSpecHandoff = {
    entryMode: 'standalone',
    navigation: { type: 'custom', variant: 'top', reason: '员工只办理自己的事项' },
  };
  update({ pages });
  expect(read('prd.md')).toContain('自定义顶部菜单');
  expect(read('prd.md')).toContain('应用工作区保留平台导航');
  expect(read('build-plan.html')).toContain('自定义顶部菜单');
  expect(JSON.parse(fs.readFileSync(input))).toEqual(source);
  fs.writeFileSync(input, JSON.stringify({ ...source, pages }));
  expect(() => materialize(input)).toThrow();
  expect(fs.existsSync(path.join(dir, 'prd.md'))).toBe(false);
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
  expect(result.revision).toBe('2026-08-31-02');
  expect(Object.keys(result.outputs)).toEqual(['prd', 'design', 'html', 'theme']);
  expect(JSON.parse(fs.readFileSync(input)).meta.planState.planConfirmed).toBe(false);
  expect(fs.readFileSync(result.outputs.prd, 'utf8')).toContain('更新后的客户管理目标');
  expect(fs.readFileSync(result.outputs.html, 'utf8')).toContain('更新后的客户管理目标');
  expect(fs.readFileSync(result.outputs.html, 'utf8')).not.toContain('方案正在完善');
});

test('first preview finalization stays at revision 1 and consumes the old draft base', () => {
  source.meta.revision = '1';
  source.meta.planState = { presentedRevision: null, confirmedRevision: null, planConfirmed: false };
  fs.writeFileSync(input, JSON.stringify(source));
  update({ overview: { ...source.overview, summary: '首次完整方案' }, dataModels: source.dataModels,
    businessFlows: source.businessFlows, pages: source.pages, visualStyle: source.visualStyle });
  expect(materialize(input, { fromPreview: true })).toMatchObject({ previousRevision: '1', revision: '1' });
  expect(() => materialize(input, { fromPreview: true })).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_PREVIEW_INVALID', details: { reason: 'stale base' },
  }));
});

test('identical finalized facts preserve an existing confirmation', () => {
  source.meta.status = 'confirmed';
  source.meta.planState = { planConfirmed: true, presentedRevision: source.meta.revision, confirmedRevision: source.meta.revision };
  fs.writeFileSync(input, JSON.stringify(source));
  update({ overview: source.overview, dataModels: source.dataModels, businessFlows: source.businessFlows,
    pages: source.pages, visualStyle: source.visualStyle });
  expect(materialize(input, { fromPreview: true }).revision).toBe(source.meta.revision);
  expect(JSON.parse(fs.readFileSync(input)).meta).toEqual(source.meta);
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
