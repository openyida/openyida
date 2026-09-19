'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { materialize, normalizePlan, renderDesign, renderPrd } = require('../lib/design-plan/materialize');
const { patchPlan } = require('../lib/design-plan/patch');
const { parseDesignDocument, validateDesignDocument } = require('../lib/design/document');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'design-plan.json');

function compactV2(source) {
  const plan = JSON.parse(JSON.stringify(source));
  plan.schemaVersion = '2.0';
  delete plan.overview.businessGraph.nodes;
  delete plan.overview.dataModelSummary;
  delete plan.overview.flowSummary;
  delete plan.overview.pageSummary;
  delete plan.overview.visualSummary;
  delete plan.pages.overview;
  for (const page of plan.pages.customPageDetails || []) {
    delete page.layoutPattern.mode;
    delete page.layoutPattern.mustKeep;
    delete page.contentRichness.requirement;
    delete page.contentRichness.antiFiller;
  }
  const forUser = plan.visualStyle.forUser;
  delete forUser.candidateThemes;
  delete forUser.themeProfile;
  delete forUser.styleSummary;
  delete forUser.styleSource;
  delete forUser.visualMemories;
  delete forUser.hierarchySummary;
  delete forUser.componentToneSummary;
  delete forUser.stateSummary;
  delete forUser.responsiveSummary;
  delete forUser.iconSummary;
  delete forUser.designMdReady;
  const selected = forUser.selectedTheme;
  delete forUser.selectedTheme;
  forUser.visualDirection = {
    label: '稳重流程型',
    description: '强调流程状态、任务处理和异常识别，界面稳定而不沉闷。',
    source: 'user_selected',
  };
  forUser.navigationStyle = {
    structure: 'side',
    tone: 'dark',
    source: 'user_selected',
    selectionReason: '高频流程处理需要稳定入口，深色导航加强模块边界。',
  };
  plan.visualStyle.internal = {
    selectedTheme: {
      themeId: selected.themeId,
      source: selected.source,
      customText: selected.customText,
    },
  };
  forUser.pageApplications = (forUser.pageApplications || []).map(application => ({
    pageId: application.pageId,
    firstScreenFocus: application.firstScreenFocus, layout: application.layout,
    responsive: application.responsive, acceptanceChecks: application.acceptanceChecks,
    surface: application.surface, primaryAction: application.primaryAction, states: application.states,
    visualMemoryApplications: application.visualMemoryApplications,
  }));
  const topology = plan.visualStyle.forDesignMd.productTopologyApplication;
  plan.visualStyle.forDesignMd = { productTopologyApplication: topology };
  return plan;
}

describe('design-plan materialize', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-design-plan-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test.each(['visualDirection', 'navigationStyle'])('rejects non-object %s before normalization', field => {
    for (const value of ['简洁', [], null, true]) {
      const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
      plan.visualStyle.forUser[field] = value;
      expect(() => normalizePlan(plan)).toThrow(expect.objectContaining({
        code: 'DESIGN_PLAN_VISUAL_FIELD_TYPE_INVALID',
        details: expect.objectContaining({ path: `visualStyle.forUser.${field}`, expectedType: 'object', example: expect.any(Object) }),
      }));
      expect(plan.visualStyle.forUser[field]).toEqual(value);
    }
  });

  test('writes ordered business blocks once and derives the full plan without losing business differences', () => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    const page = plan.pages.customPageDetails[0];
    page.blocks = [
      { name: '订单核对', purpose: '比较订单金额和采购明细，标记不一致的记录' },
      { name: '处理结果', purpose: '确认后刷新队列，失败时保留输入并显示失败原因' },
    ];
    delete page.contentPriority;
    delete page.contentRichness;
    const customCheck = '金额不一致时阻止确认，并指出差异字段';
    const defaultCheck = `${plan.dataModels[0].name}的字段、必填规则与关系符合数据模型`;
    plan.execution = { acceptanceCriteria: [customCheck, customCheck, defaultCheck], interactionStates: { error: '核对失败时保留用户输入' } };
    const input = path.join(tempDir, 'compact-business.json');
    const before = JSON.stringify(plan);
    fs.writeFileSync(input, before);
    const normalized = normalizePlan(plan);
    const derived = normalized.pages.customPageDetails[0];
    expect(derived.contentPriority).toEqual(['订单核对', '处理结果']);
    expect(derived.contentRichness.contentLayers).toEqual(page.blocks.map(block => `${block.name}：${block.purpose}`));
    expect(derived.signatureInteraction).toBe(page.signatureInteraction);
    expect(normalizePlan(normalized)).toEqual(normalized);
    const result = materialize(input);
    const prd = fs.readFileSync(result.outputs.prd, 'utf8');
    const html = fs.readFileSync(result.outputs.html, 'utf8');
    const design = fs.readFileSync(result.outputs.design, 'utf8');
    for (const block of page.blocks) {
      for (const output of [prd, html, design]) {expect(output).toContain(block.purpose);}
    }
    const handoff = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
    expect(handoff.acceptanceCriteria.filter(item => item === customCheck)).toHaveLength(1);
    expect(handoff.acceptanceCriteria.filter(item => item === defaultCheck)).toHaveLength(1);
    expect(handoff.acceptanceCriteria).toContain('应用主题按 design.md 配置，页面消费同一组 token');
    expect(handoff.interactionStates).toMatchObject({ error: '核对失败时保留用户输入', loading: expect.any(String) });
    expect(html).not.toContain(customCheck);
    expect(fs.readFileSync(input, 'utf8')).toBe(before);
    expect(JSON.stringify(plan)).toBe(before);
  });

  test('preserves separately authored priority and content layers with structured blocks', () => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    const page = plan.pages.customPageDetails[0];
    page.blocks = [{ name: '订单', purpose: '检查采购订单' }];
    const original = JSON.parse(JSON.stringify(page));
    const derived = normalizePlan(plan).pages.customPageDetails[0];
    expect(derived.contentPriority).toEqual(original.contentPriority);
    expect(derived.contentRichness.contentLayers).toEqual(original.contentRichness.contentLayers);
    expect(derived.firstScreenStructure).toBe(original.firstScreenStructure);
    expect(derived.permissionSummary).toBe(original.permissionSummary);
  });

  test.each([
    [{ name: '订单', purpose: '' }],
    [{ name: '订单', purpose: '核对订单', failure: '保留业务约束' }],
    [{ name: '订单', purpose: '核对订单' }, '混合格式'],
    [''],
  ].map(blocks => [blocks]))('rejects incomplete or ambiguous block content before writing artifacts: %j', blocks => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    plan.pages.customPageDetails[0].blocks = blocks;
    const input = path.join(tempDir, 'invalid-blocks.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    expect(() => materialize(input)).toThrow();
    expect(fs.existsSync(path.join(tempDir, 'prd.md'))).toBe(false);
  });

  test('handoff overrides cannot hide malformed structured blocks', () => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    plan.pages.customPageDetails[0].blocks = [{ name: '订单', purpose: '' }];
    plan.pages.customPageDetails[0].pageSpecHandoff = { contentBlocks: ['订单'] };
    const input = path.join(tempDir, 'invalid-override.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    expect(() => materialize(input)).toThrow('未完成的区块说明');
    expect(fs.existsSync(path.join(tempDir, 'prd.md'))).toBe(false);
  });

  test('derives PRD, design contract, and anchor-based HTML from one plan', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);

    const result = materialize(input);

    expect(result.success).toBe(true);
    expect(result.revision).toBe('2026-08-31-01');
    const prd = fs.readFileSync(path.join(tempDir, 'prd.md'), 'utf8');
    const design = fs.readFileSync(path.join(tempDir, 'design.md'), 'utf8');
    const html = fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8');
    expect(prd).toContain('# 采购管理应用 PRD');
    expect(prd).toContain('buildPlanRevision: "2026-08-31-01"');
    const handoff = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
    expect(handoff.resourceCreationOrder).toEqual(['应用与主题配置', '采购申请', '采购订单', '初始示例数据', '采购工作台', '发布与导航排序']);
    expect(handoff.resourceBlueprint.map(resource => resource.type)).toEqual(['process-form', 'normal-form', 'display-page']);
    expect(handoff.pages[0].pageSpecHandoff.designFile).toBe(result.outputs.design);
    for (const reference of handoff.pages[0].pageSpecHandoff.designRefs) {
      const frontmatter = require('js-yaml').load(design.match(/^---\n([\s\S]*?)\n---/)[1]);
      expect(reference.split('.').reduce((value, key) => value?.[key], frontmatter)).toBeDefined();
    }
    expect(design).toContain('"--color-brand1-6": "#6F4E37"');
    expect(design).toContain('buildPlanRevision: "2026-08-31-01"');
    expect(design).toContain('## 项目视觉选择');
    // 物化产物必须携带 Fast 同样消费的规则，而不只留一个实现者可能漏读的引用。
    const continuity = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-design/references/page-continuity.md'), 'utf8').trim().replace(/^(#{1,5}) /gm, '#$1 ');
    expect(design).toContain(continuity);
    expect(design).toContain('顶部导航默认贴顶通栏');
    expect(design).toContain('初始透明，滚动后增加遮罩底色，回到顶部恢复透明');
    expect(design.match(/^### 页面与导航连续性$/gm)).toHaveLength(1);
    expect(design.match(/^## /gm)).toHaveLength(5);
    expect(design).not.toMatch(/^themeId:/m);
    expect(design).not.toMatch(/\{\{[^}]+\}\}|<基于 --color-brand1-6/);
    expect(html).toContain('href="#overview"');
    expect(html).toContain('href="#pages"');
    expect(html).not.toContain(result.revision);
    expect(html).not.toMatch(/第\s*\d+\s*版|buildPlanRevision/);
  });

  test('renders Chinese artifacts over UTF-8 pipes even with inherited Windows encoding', () => {
    const originalEncoding = process.env.PYTHONIOENCODING;
    process.env.PYTHONIOENCODING = 'cp1252';
    try {
      const result = materialize(FIXTURE, { outputDir: tempDir });
      expect(result.success).toBe(true);
      const html = fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8');
      expect(html).toContain('采购管理应用');
      expect(html).toContain('采购申请');
      expect(html).not.toContain('\uFFFD');
    } finally {
      if (originalEncoding === undefined) {delete process.env.PYTHONIOENCODING;}
      else {process.env.PYTHONIOENCODING = originalEncoding;}
    }
  });

  test('one render process fills the preset HTML and returns all artifacts from the same plan', () => {
    const input = path.join(tempDir, 'build-plan.json');
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.overview.dataModelSummary = ['采购订单负责记录每批交货的核对结果'];
    plan.overview.navigationSummary = ['审核人员从待办入口进入采购审批'];
    plan.overview.businessGraph.description = '采购申请关联订单，订单承接交付核对';
    fs.writeFileSync(input, JSON.stringify(plan));
    const spawn = jest.spyOn(require('child_process'), 'spawnSync');
    try {
      jest.isolateModules(() => require('../lib/design-plan/materialize').materialize(input));
      expect(spawn).toHaveBeenCalledTimes(1);
      const [, args, options] = spawn.mock.calls[0];
      expect(args.slice(1)).toEqual(['--input', '-', '--output', '-']);
      const normalized = JSON.parse(options.input);
      const prd = fs.readFileSync(path.join(tempDir, 'prd.md'), 'utf8');
      const html = fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8');
      const handoff = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
      expect(normalized.execution).toEqual(handoff);
      for (const value of [...plan.overview.dataModelSummary, ...plan.overview.navigationSummary, plan.overview.businessGraph.description]) {
        expect(prd).toContain(value);
        expect(html).toContain(value);
      }
      expect(html).toContain('script.async = true');
      expect(html).not.toMatch(/<script\s+src=/);
      expect(html).not.toMatch(/\{\{(?:title|nav_items|content)\}\}/);
    } finally {
      spawn.mockRestore();
    }
  });

  test('business graph renders a visible label for every edge and uses bounded content height', () => {
    materialize(FIXTURE, { outputDir: tempDir });
    const html = fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8');
    const edges = [...html.matchAll(/<path class="object-edge"[^>]*data-label="([^"]+)"/g)];
    const labels = [...html.matchAll(/<text class="object-edge-label"[^>]*><title>(.*?)<\/title>(.*?)<\/text>/g)];
    expect(edges.length).toBeGreaterThan(0);
    expect(labels.map(label => label[1])).toEqual(edges.map(edge => edge[1]));
    expect(labels.every(label => label[2].length > 0)).toBe(true);
    const graphHeight = Number(html.match(/--graph-height:(\d+)px/)[1]);
    const contentHeight = Number(html.match(/--graph-content-height:(\d+)px/)[1]);
    expect(graphHeight).toBe(contentHeight + 60);
    expect(html).toContain('max-height: min(480px, 65vh)');
    expect(html).not.toContain('aspect-ratio: 16 / 9');
    expect(html).toContain('data-graph-fullscreen aria-label="全屏查看业务全景图"');
  });

  test.each(['legacy', 'compact'])('%s preserves summary-only and detailed business rules in both PRD and HTML', schema => {
    const source = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const plan = schema === 'compact' ? compactV2(source) : source;
    const summaryRule = '采购金额超过十万元必须经理复核';
    const detailedRule = '采购审批通过后才允许生成订单';
    plan.overview.flowSummary = [summaryRule];
    plan.businessFlows[0].rules.push(detailedRule);
    const input = path.join(tempDir, 'build-plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));

    materialize(input);

    for (const file of ['prd.md', 'build-plan.html']) {
      const content = fs.readFileSync(path.join(tempDir, file), 'utf8');
      expect(content).toContain(summaryRule);
      expect(content).toContain(detailedRule);
    }
    expect(JSON.parse(fs.readFileSync(input, 'utf8'))).toEqual(plan);
  });

  test('preserves existing summary rules without requiring a business flow', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.businessFlows = [];
    plan.overview.flowSummary = ['订单金额必须大于零'];
    expect(renderPrd(normalizePlan(plan))).toContain('订单金额必须大于零');

    plan.overview.flowSummary = [];
    const prd = renderPrd(normalizePlan(plan));
    expect(prd).not.toContain('### 业务流程与规则摘要');
    expect(prd).toContain('## 6. 业务逻辑与交互状态');
  });

  test.each([false, true])('HTML keeps the review concise without changing generation facts (skip samples: %s)', skipSamples => {
    const input = path.join(tempDir, 'build-plan.json');
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    const page = plan.pages.customPageDetails[0];
    page.pageSpecHandoff = { primaryAction: '核对采购差异', contentBlocks: ['差异核对区'] };
    plan.execution = {
      acceptanceCriteria: ['每笔订单金额与采购明细一致'],
      interactionStates: { error: '采购系统离线时显示重试入口' },
      resourceCreationOrder: ['先初始化采购主题并创建业务资源', ...plan.dataModels.map(model => model.name), page.name, '核验样例后发布采购工作台'],
      pageImplementationOrder: [page.pageId],
    };
    const sampleModel = plan.dataModels.find(model => model.sampleRecords?.length);
    const sampleText = '行政部秋季办公设备采购演示订单';
    const skipReason = '用户要求由采购专员首次录入正式订单';
    if (skipSamples) {
      delete sampleModel.sampleRecords;
      sampleModel.skipSampleReason = skipReason;
    } else {sampleModel.sampleRecords[0]['订单名称'] = sampleText;}
    plan.visualStyle.forUser.assetStrategy = { materialStatus: 'partial', missingAssets: ['企业标志待提供'], notes: '<script>untrusted()</script>' };
    const source = JSON.stringify(plan);
    fs.writeFileSync(input, source);
    materialize(input);
    const html = fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8');
    const prd = fs.readFileSync(path.join(tempDir, 'prd.md'), 'utf8');
    const design = fs.readFileSync(path.join(tempDir, 'design.md'), 'utf8');
    const handoff = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
    for (const value of ['核对采购差异', '差异核对区', '企业标志待提供', '部分已有', '数据来源', '导航顺序', '搭建范围', page.permissionSummary,
      plan.visualStyle.forUser.visualDirection.label, plan.visualStyle.forUser.colorStrategy.usage]) {
      expect(html).toContain(value);
    }
    for (const value of [sampleText, skipReason, '每笔订单金额与采购明细一致', '采购系统离线时显示重试入口',
      plan.execution.resourceCreationOrder[0], plan.execution.resourceCreationOrder.at(-1), '初始示例数据', '交互状态', '页面视觉方案', '搭建顺序', '页面交付顺序', '<h3>验收标准</h3>']) {
      expect(html).not.toContain(value);
    }
    expect(handoff.acceptanceCriteria).toContain(plan.execution.acceptanceCriteria[0]);
    expect(handoff.interactionStates).toMatchObject(plan.execution.interactionStates);
    expect(handoff.resourceCreationOrder).toEqual(plan.execution.resourceCreationOrder);
    expect(handoff.pageImplementationOrder).toEqual(plan.execution.pageImplementationOrder);
    expect(handoff.sampleDataPlan.find(item => item.form === sampleModel.name)).toMatchObject(skipSamples
      ? { records: [], skipReason } : { records: sampleModel.sampleRecords });
    expect(prd).toContain(skipSamples ? skipReason : sampleText);
    const application = plan.visualStyle.forUser.pageApplications[0];
    for (const value of [application.firstScreenFocus, application.layout, application.responsive, application.surface,
      application.primaryAction, application.states, ...application.acceptanceChecks, application.visualMemoryApplications[0].target]) {
      expect(design).toContain(value);
      expect(html).not.toContain(value);
    }
    const pageCard = html.match(/<div class="card page-detail">([\s\S]*?)<\/div>/)[1];
    expect(pageCard).toContain('<p><strong>权限说明：</strong>');
    expect(pageCard).toContain('<p><strong>主操作：</strong>核对采购差异</p>');
    expect(pageCard).not.toContain('<table');
    const visualSection = html.slice(html.indexOf('<h3>视觉设计</h3>')).split('</section>')[0];
    expect(visualSection).not.toContain('<table');
    expect(html.match(/class="nav-item"/g)).toHaveLength(4);
    for (const section of ['overview', 'data-models', 'business-flows', 'pages']) {expect(html).toContain(`id="${section}"`);}
    expect(html).not.toContain('<script>untrusted()</script>');
    expect(html).toContain('&lt;script&gt;untrusted()&lt;/script&gt;');
    expect(html).not.toContain('themeId');
    expect(fs.readFileSync(input, 'utf8')).toBe(source);
  });

  test.each([
    ['platform-l-shape', '平台L型导航', 'l_shape'],
    ['platform-top', '平台顶部导航', 'top'],
    ['platform-side', '平台侧边导航', 'side'],
    ['custom', '自定义导航', 'side'],
  ])('navigation %s stays consistent in PRD, design and HTML', (type, label, layout) => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    const input = path.join(tempDir, 'build-plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    patchPlan(input, [`execution.appConfig.navigationType=${type}`], { materialize: true });
    const prd = fs.readFileSync(path.join(tempDir, 'prd.md'), 'utf8');
    const design = fs.readFileSync(path.join(tempDir, 'design.md'), 'utf8');
    const html = fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8');
    const handoff = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
    const profile = require('js-yaml').load(design.match(/^---\n([\s\S]*?)\n---/)[1]).themeProfile;
    const appSection = prd.split('## 2. 应用配置')[1].split('## 3.')[0];
    expect(appSection).not.toMatch(/appType|corpId|navigationType|hideAppNav|isRenderNav|navTheme|layoutDirection/);
    expect(appSection).toContain(`| 平台应用导航 | ${type === 'custom' ? '隐藏' : '显示'} |`);
    expect(html).not.toMatch(/hideAppNav|isRenderNav/);
    expect(handoff.appConfig).toMatchObject({ navigationType: type, layoutDirection: layout, hideAppNav: type === 'custom' ? 'y' : 'n' });
    expect(profile).toMatchObject(handoff.appConfig.navigationType === 'custom'
      ? { navigationType: 'custom', hideAppNav: 'y' } : { navigationType: type, layoutDirection: layout, hideAppNav: 'n' });
    for (const output of [prd, design, html]) {expect(output).toContain(label);}
    if (type === 'custom') {
      expect(handoff.pageNavigation.map(page => page.name)).toEqual(['采购申请', '采购订单', '采购工作台']);
      expect(handoff.pageNavigation.every(page => page.isRenderNav === false)).toBe(true);
      expect(handoff.pages[0].pageSpecHandoff.entryMode).toBe('standalone');
      expect(html).toContain('<h3>页面导航</h3>');
      expect(handoff.pages[0].navigationPolicy).toMatchObject({ applicationMenuOwner: 'page', renderApplicationMenu: true, pageLayout: 'standalone' });
    } else {
      expect(handoff.pageNavigation).toEqual([]);
      expect(handoff.pages[0].navigationPolicy).toEqual({
        applicationMenuOwner: 'platform', pageLayout: 'content-only', renderApplicationMenu: false,
        localTabs: 'same-task-only', duplicatePlatformMenu: false,
      });
      expect(handoff.acceptanceCriteria).toContain('采购工作台只实现业务内容，同任务分类可用页内 Tab，跨模块使用平台菜单；实际管理入口无重复导航');
      expect(design).toContain('跨模块切换交给平台菜单，不重复自绘管理导航');
      expect(html).toContain('只实现业务内容；跨模块使用平台菜单，同任务分类可用页内 Tab');
    }
  });

  test('standalone without a planned menu keeps no-menu policy in PRD, design and HTML', () => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    plan.execution = { appConfig: { navigationType: 'platform-side' } };
    plan.pages.customPageDetails[0].pageSpecHandoff = { entryMode: 'standalone' };
    const input = path.join(tempDir, 'build-plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    materialize(input);
    const prd = fs.readFileSync(path.join(tempDir, 'prd.md'), 'utf8');
    const handoff = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
    expect(handoff.pages[0].navigationPolicy.applicationMenuOwner).toBe('none');
    expect(handoff.pages[0].navigationPolicy.renderApplicationMenu).toBe(false);
    for (const file of ['prd.md', 'design.md', 'build-plan.html']) {
      expect(fs.readFileSync(path.join(tempDir, file), 'utf8')).toContain('未规划应用菜单，仅实现业务内容');
    }
  });

  test('custom navigation includes all business pages and extra reports despite blueprint ordering', () => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    plan.execution = { appConfig: { navigationType: 'custom' } };
    const readHandoff = () => JSON.parse(renderPrd(plan).match(/```json\n([\s\S]*?)\n```/)[1]);
    plan.execution.resourceBlueprint = [
      { name: '采购汇总', type: 'report' },
      ...readHandoff().resourceBlueprint.reverse(),
    ];
    expect(readHandoff().pageNavigation).toEqual([
      { name: '采购申请', type: 'process-form', isRenderNav: false },
      { name: '采购订单', type: 'normal-form', isRenderNav: false },
      { name: '采购工作台', type: 'display-page', isRenderNav: false },
      { name: '采购汇总', type: 'report', isRenderNav: false },
    ]);

    plan.execution.appConfig.navigationType = 'platform-side';
    expect(readHandoff().pageNavigation).toEqual([]);
    plan.pages.customPageDetails[0].entryMode = 'standalone';
    expect(readHandoff().pageNavigation).toEqual([
      { name: '采购工作台', type: 'display-page', isRenderNav: false },
    ]);
  });

  test.each([
    ['unknown type', blueprint => { blueprint[0].type = 'form'; }, /类型必须/],
    ['wrong form type', blueprint => { blueprint[0].type = 'normal-form'; }, /类型与业务模型或页面不一致/],
    ['wrong page type', blueprint => { blueprint[2].type = 'report'; }, /类型与业务模型或页面不一致/],
    ['missing form', blueprint => { blueprint.splice(0, 1); }, /遗漏业务表单或页面/],
    ['duplicate name', blueprint => { blueprint.push({ ...blueprint[0] }); }, /名称重复/],
    ['undefined form', blueprint => { blueprint.push({ name: '未规划表单', type: 'normal-form' }); }, /必须有对应定义/],
    ['wrong page ID', blueprint => { blueprint[2].pageId = 'another-page'; }, /pageId 与页面定义不一致/],
    ['null resource', blueprint => { blueprint.push(null); }, /资源蓝图缺少名称/],
  ])('rejects %s before writing navigation artifacts', (_, change, error) => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    plan.execution = { appConfig: { navigationType: 'custom' } };
    const handoff = JSON.parse(renderPrd(plan).match(/```json\n([\s\S]*?)\n```/)[1]);
    plan.execution.resourceBlueprint = handoff.resourceBlueprint;
    change(plan.execution.resourceBlueprint);
    const input = path.join(tempDir, 'build-plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    expect(() => materialize(input)).toThrow(error);
    expect(fs.readdirSync(tempDir)).toEqual(['build-plan.json']);
  });

  test('rejects ambiguous names shared by a form and a custom page', () => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    plan.pages.customPageDetails[0].name = plan.dataModels[0].name;
    expect(() => renderPrd(plan)).toThrow(/业务表单与页面名称重复/);
  });

  test('standalone frontend menus preserve platform navigation for the management workspace', () => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    plan.execution = { appConfig: { navigationType: 'platform-side' } };
    const front = JSON.parse(JSON.stringify(plan.pages.customPageDetails[0]));
    front.pageId = 'employee-entry';
    front.sceneKey = 'employee-entry';
    front.name = '员工采购入口';
    front.primaryUsers = ['员工'];
    front.primaryTask = '提交申请并查看自己的处理进度';
    front.pageSpecHandoff = { entryMode: 'standalone', navigation: {
      type: 'custom', variant: 'top', reason: '员工只办理自己的采购事项',
    } };
    plan.pages.customPageDetails.push(front);
    plan.visualStyle.forUser.pageApplications.push({
      ...plan.visualStyle.forUser.pageApplications[0], pageId: front.pageId,
      firstScreenFocus: '员工入口首屏突出新建采购申请，最近提交的申请紧随其后',
      layout: '顶部放新建操作和个人申请状态，下面采用完整宽度的申请列表',
      responsive: '窄屏状态区改为单列，个人申请列表隐藏次要备注列',
      acceptanceChecks: ['只显示当前员工的申请', '新建入口在首屏保持可见'],
    });
    const input = path.join(tempDir, 'build-plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    materialize(input);
    const prd = fs.readFileSync(path.join(tempDir, 'prd.md'), 'utf8');
    const handoff = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
    expect(handoff.appConfig).toMatchObject({ navigationType: 'platform-side', hideAppNav: 'n' });
    expect(handoff.pageNavigation).toEqual([{ name: front.name, type: 'display-page', isRenderNav: false }]);
    expect(handoff.pages[0].pageSpecHandoff.entryMode).toBe('platform-shell');
    expect(handoff.pages[1].pageSpecHandoff.navigation).toEqual(front.pageSpecHandoff.navigation);
    expect(handoff.pages[0].navigationPolicy.renderApplicationMenu).toBe(false);
    expect(handoff.pages[1].navigationPolicy.renderApplicationMenu).toBe(true);
    expect(handoff.resourceBlueprint.filter(item => item.type !== 'display-page')).toHaveLength(plan.dataModels.length);
    for (const file of ['prd.md', 'design.md', 'build-plan.html']) {
      const content = fs.readFileSync(path.join(tempDir, file), 'utf8');
      expect(content).toContain('自定义顶部菜单');
      expect(content).toContain('仅当前入口，应用工作区保留平台导航');
      expect(content).toContain('沿用平台导航');
    }
    patchPlan(input, ['pages.customPageDetails[1].pageSpecHandoff.navigation=' + JSON.stringify({ type: 'none', reason: '仅保留单步办理' })], { materialize: true });
    expect(fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8')).toContain('不设菜单');
    const updated = JSON.parse(fs.readFileSync(path.join(tempDir, 'prd.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
    expect(updated.appConfig.hideAppNav).toBe('n');
    expect(updated.pages[1].navigationPolicy).toMatchObject({ applicationMenuOwner: 'none', renderApplicationMenu: false });
  });

  test.each([
    [{ type: 'custom', variant: 'top', reason: '办事入口', hideAppNav: 'y' }, 'standalone'],
    [{ type: 'platform-side', reason: '错误层级' }, 'standalone'],
    [{ type: 'custom', variant: 'unknown', reason: '办事入口' }, 'standalone'],
    [{ type: 'custom', variant: 'top', reason: '办事入口' }, 'platform-shell'],
  ])('rejects invalid entry menu %j without changing app settings', (navigation, entryMode) => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    plan.execution = { appConfig: { navigationType: 'platform-side' } };
    plan.pages.customPageDetails[0].pageSpecHandoff = { entryMode, navigation };
    const input = path.join(tempDir, 'build-plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    expect(() => materialize(input)).toThrow();
    expect(fs.readdirSync(tempDir)).toEqual(['build-plan.json']);
    expect(plan.execution.appConfig).toEqual({ navigationType: 'platform-side' });
  });

  test('rejects contradictory navigation choices', () => {
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    for (const config of [
      { navigationType: 'unknown' },
      { navigationType: 'custom', hideAppNav: 'n' },
      { navigationType: 'platform-top', layoutDirection: 'side' },
      { navigationType: 'platform-side', hideAppNav: 'y' },
    ]) {
      plan.execution = { appConfig: config };
      expect(() => renderPrd(plan)).toThrow(/导航/);
    }
    plan.execution = { appConfig: { navigationType: 'custom' } };
    plan.pages.customPageDetails[0].entryMode = 'platform-shell';
    expect(() => renderPrd(plan)).toThrow(/standalone/);
  });

  test('check validates all derived artifacts without writing them', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);

    const result = materialize(input, { check: true });

    expect(result.checked).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'prd.md'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'design.md'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'build-plan.html'))).toBe(false);
  });

  test('rejects a selected theme path that does not match the theme index', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.visualStyle.forUser.selectedTheme.templatePath = 'templates/design-themes/dark-inset-hairline.md';

    expect(() => renderDesign(plan)).toThrow(/themeId 与 templatePath/);
  });

  test('renderers are deterministic', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

    expect(renderPrd(plan)).toBe(renderPrd(plan));
    expect(renderDesign(plan)).toBe(renderDesign(plan));
  });

  test('custom output passes the public check-design command from another working directory', () => {
    const result = materialize(FIXTURE, { outputDir: path.join(tempDir, 'exported plan') });
    const checked = spawnSync(process.execPath, [path.join(ROOT, 'bin/yida.js'), 'check-design',
      result.outputs.design, '--prd', result.outputs.prd, '--json'], {
      cwd: os.tmpdir(), encoding: 'utf8', env: { ...process.env, CI: '1' },
    });
    expect({ status: checked.status, stderr: checked.stderr }).toEqual({ status: 0, stderr: '' });
    expect(JSON.parse(checked.stdout)).toMatchObject({ success: true, prdChecked: true });
  });

  test('root gradients survive design and CSS generation without replacing page or card colors', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const gradient = 'linear-gradient(135deg, #F4F8F5, #E8F0EC)';
    plan.visualStyle.tokens = { '--pod-app-root-bg-image': gradient };
    const input = path.join(tempDir, 'gradient-plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    const result = materialize(input, { outputDir: path.join(tempDir, 'gradient') });
    const design = fs.readFileSync(result.outputs.design, 'utf8');
    const tokens = require('../lib/app/theme-from-design').readDesignTokens(design);
    expect(tokens['--pod-app-root-bg-image']).toBe(gradient);
    expect(tokens['--pod-page-bg-color']).toBe('#FAFAFA');
    expect(tokens['--pod-card-bg-color']).toBe('#FFFFFF');
    expect(fs.readFileSync(result.outputs.theme, 'utf8')).toContain(`--pod-app-root-bg-image: ${gradient};`);
  });

  test('Plan preserves the shared Fast theme tokens except for explicit navigation and project choices', () => {
    const { loadThemeIndex, themeTemplatePath, resolveThemeColors } = require('../lib/design-plan/themes');
    const { readDesignTokens } = require('../lib/app/theme-from-design');
    const navigation = new Set(['--pod-shell-theme-bg-color', '--pod-nav-item-text-color', '--pod-nav-item-text-hover-color',
      '--pod-nav-item-text-selected-color', '--pod-nav-menu-bg-hover-color', '--pod-nav-menu-bg-selected-color']);
    for (const theme of loadThemeIndex().themes.filter(item => item.mode !== 'creative')) {
      const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
      plan.visualStyle.forUser.selectedTheme = { themeId: theme.themeId, templatePath: theme.templatePath };
      plan.visualStyle.tokens = {};
      const expected = readDesignTokens(resolveThemeColors(fs.readFileSync(themeTemplatePath(theme), 'utf8')
        .replace(/\{\{PRIMARY_COLOR\}\}/g, plan.visualStyle.forUser.colorStrategy.primaryColor)));
      const actual = readDesignTokens(renderDesign(plan));
      const contentTokens = tokens => Object.fromEntries(Object.entries(tokens).filter(([name]) => !navigation.has(name)));
      expect(contentTokens(actual)).toEqual(contentTokens(expected));
    }
  });

  test.each(['warm-canvas-contrast-panels', 'graphite-bevel-grid'])('carries shared color pairing guidance into %s without overriding project colors', themeId => {
    const { readDesignTokens } = require('../lib/app/theme-from-design');
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.visualStyle.forUser.selectedTheme = { themeId, templatePath: `templates/design-themes/${themeId}.md` };
    plan.visualStyle.tokens = { '--oyd-on-action-color': '#241B18', '--pod-card-bg-color': '#FFF7F2' };
    const design = renderDesign(plan);
    const shared = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/application-theme-consistency.md'), 'utf8');
    const pairing = shared.split('## 指标卡与按钮配色\n')[1].split('\n## ')[0].trim();
    expect(design).toContain(`### 指标卡与按钮配色\n\n${pairing}`);
    const dividers = shared.split('## 分组标题与分割线\n')[1].split('\n## ')[0].trim();
    expect(design).toContain(`### 分组标题与分割线\n\n${dividers}`);
    expect(design.match(/### 分组标题与分割线/g)).toHaveLength(1);
    expect(design.match(/### 指标卡与按钮配色/g)).toHaveLength(1);
    expect(design).not.toContain('## 页面只引用设计值');
    expect(readDesignTokens(design)).toMatchObject(plan.visualStyle.tokens);
    expect(validateDesignDocument(design).success).toBe(true);
  });

  test.each(['light', 'dark'])('generated %s navigation has one final palette in its own section', tone => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.visualStyle.forUser.selectedTheme = { themeId: 'soft-outline-rhythm', templatePath: 'templates/design-themes/soft-outline-rhythm.md' };
    plan.visualStyle.forUser.navigationStyle.tone = tone;
    const design = renderDesign(plan);
    const section = design.split('### 2.2 应用导航')[1].split('### 2.3 ')[0];
    expect(section).toContain(`导航明暗：${tone === 'dark' ? '深色' : '浅色'}`);
    expect(section).not.toMatch(/模板默认|默认近白|生成项目时|项目生成时/);
    expect(design.match(/本项目导航配色/g)).toHaveLength(1);
    expect(validateDesignDocument(design).success).toBe(true);
  });

  test('delivers one compact design contract with real anchors, safe metadata and the actual theme output path', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.meta.appName = '研发 "A": 采购系统';
    plan.pages.customPageDetails[0].pageId = '工作台 / #<采购>';
    plan.visualStyle.forUser.pageApplications[0].pageId = plan.pages.customPageDetails[0].pageId;
    plan.visualStyle.forUser.iconSystem = { library: '@ant-design/icons', mappings: { approval: 'CheckCircleOutlined' } };
    const input = path.join(tempDir, 'build-plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    const result = materialize(input, { outputDir: path.join(tempDir, 'exported plan') });
    const markdown = fs.readFileSync(result.outputs.design, 'utf8');
    const { metadata, body } = parseDesignDocument(markdown);
    expect(metadata.schemaVersion).toBe('1.0');
    expect(metadata.name).toBe(plan.meta.appName);
    expect(metadata.themeProfile.themeFile).toBe(result.outputs.theme);
    expect(metadata.iconSystem).toEqual(plan.visualStyle.forUser.iconSystem);
    expect(body.trimStart()).toMatch(/^# 研发 "A": 采购系统 design\.md\n/);
    expect(body.match(/^## /gm)).toHaveLength(5);
    const page = metadata.sceneRecipes.workbench.pages[0];
    expect(Object.keys(page)).toEqual(['pageId', 'anchor']);
    expect(page.anchor).toMatch(/^#page-[a-f\d]+$/);
    expect(body).toContain(`<a id="${page.anchor.slice(1)}"></a>`);
    for (const item of [...Object.values(metadata.components), ...Object.values(metadata.states)]) {
      expect(Object.keys(item)).toEqual(['anchor']);
      expect(body).toContain(`<a id="${item.anchor.slice(1)}"></a>`);
    }
    expect(JSON.stringify({ ...metadata, tokens: undefined })).not.toContain('rules');
    expect(JSON.stringify(metadata.states).length).toBeLessThan(300);
    const pageBody = body.slice(body.indexOf(`<a id="${page.anchor.slice(1)}"></a>`));
    for (const label of ['页面任务', '首屏焦点', '布局', '表面与组件', '主操作', '状态', '响应式', '验收']) {
      expect(pageBody).toContain(`- ${label}：`);
    }
    const projectChapter = body.slice(body.indexOf('## 5. 项目应用与调整规则'));
    expect(projectChapter).toContain('独立金色／粉色分类和平台状态色保留各自用途');
    expect(projectChapter).toContain('### 主题表达验收');
    expect(projectChapter).not.toMatch(/sRGB|round\(|themeId|生成标记|### 项目页面设计|每页包含以下结果/);
    expect(validateDesignDocument(markdown, { prdMarkdown: fs.readFileSync(result.outputs.prd, 'utf8') }).success).toBe(true);
  });

  test.each(['firstScreenFocus', 'layout', 'responsive', 'acceptanceChecks', 'primaryAction'])(
    'requires the explicit page decision %s before final materialization without changing an older plan', key => {
      const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
      delete plan.visualStyle.forUser.pageApplications[0][key];
      const input = path.join(tempDir, 'build-plan.json');
      const source = JSON.stringify(plan);
      fs.writeFileSync(input, source);
      expect(() => materialize(input)).toThrow(new RegExp(`pageApplications\\[0\\].${key}`));
      expect(fs.readFileSync(input, 'utf8')).toBe(source);
      expect(fs.readdirSync(tempDir)).toEqual(['build-plan.json']);
    }
  );

  test('does not manufacture component or state references when the selected template has no such rules', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const read = fs.readFileSync;
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
      const value = read(file, ...args);
      return path.basename(String(file)) === 'soft-inset-surfaces.md'
        ? value.replace(/## 3\. 基础组件表达[\s\S]*?(?=## 4\.)/, '## 3. 基础组件表达\n\n### 文字层次\n\n正文保持清晰。\n\n') : value;
    });
    try {
      plan.pages.customPageDetails[0].pageSpecHandoff = { designRefs: ['components.table'] };
      expect(() => renderDesign(plan)).toThrow('设计引用不存在');
      plan.pages.customPageDetails[0].pageSpecHandoff.designRefs = ['themeProfile'];
      const { metadata } = parseDesignDocument(renderDesign(plan));
      expect(metadata.components).toEqual({});
      expect(metadata.states).toEqual({});
    } finally {spy.mockRestore();}
  });

  test('compact v2 derives repeated summaries and standard rules without weakening artifacts', () => {
    const legacy = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const compact = compactV2(legacy);
    const compactInput = path.join(tempDir, 'build-plan.json');
    const legacyOutput = path.join(tempDir, 'legacy');
    const compactOutput = path.join(tempDir, 'compact');
    fs.writeFileSync(compactInput, `${JSON.stringify(compact, null, 2)}\n`, 'utf8');

    const normalized = normalizePlan(compact);
    expect(Buffer.byteLength(JSON.stringify(compact, null, 2))).toBeLessThan(
      Buffer.byteLength(JSON.stringify(legacy, null, 2)) * 0.77
    );
    expect(Buffer.byteLength(JSON.stringify(compact))).toBeLessThan(25 * 1024);
    expect(normalized.overview.dataModelSummary).toHaveLength(legacy.dataModels.length);
    expect(normalized.overview.flowSummary).toHaveLength(legacy.businessFlows.length);
    expect(normalized.pages.overview).toHaveLength(legacy.pages.overview.length);
    expect(normalized.pages.customPageDetails[0].layoutPattern).toMatchObject({
      mode: 'adapted',
      id: 'compact-workbench',
      mustKeep: expect.arrayContaining(['高频动作显眼', '首屏至少两层信息']),
    });
    expect(normalized.visualStyle.internal.selectedTheme.templatePath).toBe(
      'templates/design-themes/soft-inset-surfaces.md'
    );
    expect(normalized.visualStyle.forUser.themeProfile).toEqual({});
    expect(normalized.visualStyle.forDesignMd).not.toHaveProperty('componentRules');

    materialize(FIXTURE, { outputDir: legacyOutput });
    materialize(compactInput, { outputDir: compactOutput });
    const legacyDesign = fs.readFileSync(path.join(legacyOutput, 'design.md'), 'utf8');
    const compactDesign = fs.readFileSync(path.join(compactOutput, 'design.md'), 'utf8');
    const componentContract = source => source.slice(source.indexOf('## 3. 基础组件表达'), source.indexOf('## 5. 项目应用与调整规则'));
    expect(componentContract(compactDesign)).toBe(componentContract(legacyDesign));
    expect(compactDesign).toContain('### 交互与反馈状态');
    expect(compactDesign).toContain('### 主题表达验收');
    expect(compactDesign).toContain('柔圆白面板');

    const prd = fs.readFileSync(path.join(compactOutput, 'prd.md'), 'utf8');
    const html = fs.readFileSync(path.join(compactOutput, 'build-plan.html'), 'utf8');
    for (const model of legacy.dataModels) {
      expect(prd).toContain(model.name);
      expect(html).toContain(model.name);
    }
    for (const flow of legacy.businessFlows) {
      expect(prd).toContain(flow.name);
      expect(html).toContain(flow.name);
    }
    expect(prd).not.toContain('按钮、输入、卡片、表格和反馈组件遵循统一项目设计系统');
    expect(prd.match(/^## \d+\./gm)).toHaveLength(11);
    expect(prd).not.toContain('主题模板：');
    expect(compactDesign).toContain('- 视觉方向：稳重流程型');
    expect(compactDesign).toContain('- 导航类型：平台侧边导航');
    expect(compactDesign).toContain('- 导航明暗：深色');
    expect(compactDesign).toContain('- 导航背景：`--pod-shell-theme-bg-color`');
    expect(compactDesign).not.toMatch(/^themeId:/m);
    expect(compactDesign).not.toContain('soft-inset-surfaces');
    expect(html).toContain('<strong>导航结构：</strong>平台侧边导航');
    expect(html).toContain('<strong>导航明暗：</strong>深色');
    expect(html).toContain('高频流程处理需要稳定入口，深色导航加强模块边界。');
  });

  test.each([
    ['custom', undefined, '#FAFAFA'],
    ['platform-top', undefined, '#FAFAFA'],
    ['custom', 'var(--color-brand1-3)', 'var(--color-brand1-3)'],
    ['platform-side', '#FFF8ED', '#FFF8ED'],
  ])('page background is shared for %s navigation while preserving explicit design %s', (navigationType, override, expected) => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.execution = { ...plan.execution, appConfig: { navigationType } };
    plan.visualStyle.tokens = override ? { '--pod-page-bg-color': override } : {};
    const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
    const design = renderDesign(plan);
    expect(readDesignTokens(design)['--pod-page-bg-color']).toBe(expected);
    const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
    const css = applyDesignTokens(template, design);
    expect(css).toContain(`--pod-page-bg-color: ${expected};`);
  });

  test('theme color recipes preserve neutral surfaces unless the project explicitly overrides them', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    delete plan.visualStyle.forUser.themeProfile;
    plan.visualStyle.forUser.selectedTheme = { themeId: 'soft-inset-surfaces', templatePath: 'templates/design-themes/soft-inset-surfaces.md' };
    plan.visualStyle.forUser.colorStrategy = { primaryColor: '#2F9E63', primaryColorName: '自然绿意' };
    plan.visualStyle.forUser.navigationStyle.tone = 'light';
    const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
    const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
    const design = renderDesign(plan);
    const green = readDesignTokens(design);
    expect(green['--pod-shell-theme-bg-color']).toBe('#F7F7F7');
    expect(green['--pod-page-bg-color']).toBe('#FAFAFA');
    expect(green['--pod-card-bg-color']).toBe('#FFFFFF');
    expect(green['--pod-card-border']).toBeUndefined();
    expect(green['--color-line1-2']).toBe('#E8E8E8');
    expect(green['--color-text1-4']).toBe('#303030');
    expect(green['--color-text1-10']).toBe('#606060');
    expect(green['--color-text1-3']).toBe('#767676');
    expect(applyDesignTokens(template, design)).toContain('--pod-shell-theme-bg-color: #F7F7F7;');
    expect(applyDesignTokens(template, design)).toContain('--pod-page-bg-color: #FAFAFA;');
    plan.visualStyle.forUser.colorStrategy.primaryColor = '#6F4E37';
    const brown = readDesignTokens(renderDesign(plan));
    for (const token of ['--color-brand1-3', '--color-brand1-6']) {
      expect(brown[token]).not.toBe(green[token]);
    }
    for (const token of ['--color-line1-2', '--color-fill1-2', '--color-text1-4']) {expect(brown[token]).toBe(green[token]);}
    plan.visualStyle.tokens = { '--pod-page-bg-color': '#FFFFFF', '--pod-card-bg-color': '#FFF8ED' };
    const explicitDesign = renderDesign(plan);
    expect(readDesignTokens(explicitDesign)['--pod-page-bg-color']).toBe('#FFFFFF');
    expect(applyDesignTokens(template, explicitDesign)).toContain('--pod-card-bg-color: #FFF8ED;');
  });

  test.each(['custom', 'platform-top', 'platform-side', 'platform-l-shape'])(
    'selected theme %s navigation keeps shell, native page and canvas surfaces separate', navigationType => {
      const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
      plan.execution = { ...plan.execution, appConfig: { navigationType } };
      plan.visualStyle.forUser.colorStrategy = { primaryColor: '#2F9E63' };
      plan.visualStyle.forUser.navigationStyle.tone = 'light';
      plan.visualStyle.tokens = {};
      const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
      const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
      const design = renderDesign(plan);
      const tokens = readDesignTokens(design);
      expect(tokens['--pod-shell-theme-bg-color']).toBe('#F7F7F7');
      expect(tokens['--pod-page-bg-color']).toBe('#FAFAFA');
      expect(applyDesignTokens(template, design)).toContain('--pod-page-bg-color: #FAFAFA;');
      plan.visualStyle.tokens = {
        '--pod-page-bg-color': '#FFF8ED',
        '--pod-shell-theme-bg-color': '#FAF0E6',
      };
      const explicit = readDesignTokens(renderDesign(plan));
      for (const [token, value] of Object.entries(plan.visualStyle.tokens)) {
        expect(explicit[token]).toBe(value);
      }
    }
  );

  test.each(['light', 'dark'])('selected %s navigation keeps theme colors while other modes keep defaults', tone => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.visualStyle.forUser.navigationStyle.tone = tone;
    plan.visualStyle.tokens = {};
    const { applyDesignTokens, readDesignTokens } = require('../lib/app/theme-from-design');
    const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
    const design = renderDesign(plan);
    const css = applyDesignTokens(template, design);
    const tokens = readDesignTokens(design);
    const scope = (stylesheet, mode) => stylesheet.match(new RegExp(`\\.pod-premium\\.nav-${mode}\\s*\\{([^}]+)\\}`))[1];
    for (const mode of ['light', 'dark', 'white', 'gray']) {
      const background = mode === tone ? tokens['--pod-shell-theme-bg-color']
        : scope(template, mode).match(/--pod-shell-theme-bg-color:\s*([^;]+);/)[1];
      const scoped = scope(css, mode);
      expect(scoped).toContain(`--pod-shell-theme-bg-color: ${background};`);
      const headerBackground = mode === tone ? background
        : scope(template, mode).match(/--pod-page-header-bg-color:\s*([^;]+);/)[1];
      expect(scoped).toContain(`--pod-page-header-bg-color: ${headerBackground};`);
    }
    // Changing the primary color updates the selected theme palette and keeps other modes.
    plan.visualStyle.forUser.colorStrategy.primaryColor = '#1677FF';
    const nextDesign = renderDesign(plan);
    const changed = applyDesignTokens(css + '\n.local-detail { padding: 7px; }\n', nextDesign, design);
    expect(changed).toContain('--color-brand1-6: #1677FF;');
    expect(scope(changed, tone)).toContain(`--pod-shell-theme-bg-color: ${readDesignTokens(nextDesign)['--pod-shell-theme-bg-color']};`);
    for (const mode of ['light', 'dark', 'white', 'gray'].filter(mode => mode !== tone)) {
      expect(scope(changed, mode)).toBe(scope(template, mode));
    }
    expect(changed).toContain('.local-detail { padding: 7px; }');
    expect(applyDesignTokens(changed, renderDesign(plan), renderDesign(plan))).toBe(changed);
  });

  test('dark theme surfaces remain dark without an additional color mode', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    delete plan.visualStyle.forUser.themeProfile;
    plan.visualStyle.forUser.selectedTheme = { themeId: 'dark-inset-hairline', templatePath: 'templates/design-themes/dark-inset-hairline.md' };
    plan.execution = { ...plan.execution, appConfig: { navigationType: 'custom' } };
    const { readDesignTokens } = require('../lib/app/theme-from-design');
    const tokens = readDesignTokens(renderDesign(plan));
    expect(tokens['--pod-page-bg-color']).toBe('#000000');
    expect(tokens['--pod-card-bg-color']).toBe('#0E0E0E');
    expect(tokens['--color-white']).toBe('var(--pod-card-bg-color)');
  });

  test('all registered themes resolve project placeholders and derived color tokens', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.visualStyle.constraints = { accessibility: '所有页面支持用户调整系统字体大小' };
    plan.visualStyle.forDesignMd.productTopologyApplication = '员工端与管理端共享主题，分别组织任务入口';
    const themeIndex = JSON.parse(fs.readFileSync(path.join(
      ROOT,
      'yida-skills',
      'skills',
      'yida-design',
      'templates',
      'design-themes',
      'index.json'
    ), 'utf8'));
    expect(themeIndex.themes.filter(theme => !theme.collection)).toHaveLength(15);
    expect(themeIndex.themes.filter(theme => theme.collection === 'application-styles' && theme.mode === 'template')).toHaveLength(18);

    for (const theme of themeIndex.themes.filter(item => item.mode !== 'creative')) {
      delete plan.visualStyle.forUser.themeProfile;
      plan.visualStyle.forUser.selectedTheme.themeId = theme.themeId;
      plan.visualStyle.forUser.selectedTheme.templatePath = theme.templatePath;
      plan.pages.customPageDetails[0].pageSpecHandoff = { designRefs: ['themeProfile'] };
      const registered = parseDesignDocument(renderDesign(plan)).metadata;
      const designRefs = Object.keys(registered.components).map(name => `components.${name}`)
        .concat(Object.keys(registered.states).map(name => `states.${name}`));
      plan.pages.customPageDetails[0].pageSpecHandoff = {
        ...plan.pages.customPageDetails[0].pageSpecHandoff, designRefs,
      };
      const design = renderDesign(plan);
      expect(design).not.toContain(theme.themeId);
      expect(design).not.toContain(theme.label);
      expect(design).toContain('### 项目视觉选择与事实');
      expect(design).toContain(plan.visualStyle.constraints.accessibility);
      expect(design).toContain(plan.visualStyle.forDesignMd.productTopologyApplication);
      const frontmatter = require('js-yaml').load(design.match(/^---\n([\s\S]*?)\n---/)[1]);
      for (const ref of designRefs) {
        const reference = ref.split('.').reduce((value, name) => value?.[name], frontmatter);
        expect(Object.keys(reference)).toEqual(['anchor']);
        expect(reference.anchor).toMatch(/^#(?:component|state)-/);
        expect(design.slice(design.indexOf('## 3. 基础组件表达'))).toContain(`<a id="${reference.anchor.slice(1)}"></a>`);
      }
      expect(design).toContain('"--color-brand1-6": "#6F4E37"');
      expect(design).not.toMatch(/\{\{[^}]+\}\}|<[^>]*(?:实际色值|生成期标记)[^>]*>/);
      expect(design).not.toMatch(/"--[^"]+"\s*:\s*"AI 根据[^"]*生成[^"]*"/);
      expect(design).toContain('"--color-brand1-1": "#80634F"');
      const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
      const contract = require('../yida-skills/skills/yida-design/templates/design-themes/basic-tokens.json');
      const tokens = readDesignTokens(design);
      expect(Object.keys(tokens)).toEqual(expect.arrayContaining(Object.values(contract.groups).flat()));
      expect(tokens['--font-size-subhead']).toBe('18px');
      expect(tokens['--font-size-table']).toBe('13px');
      expect(tokens['--s-10']).toBe('40px');
      expect(tokens['--color-fill1-10']).toMatch(/^#[0-9A-F]{6}$/);
      expect(tokens['--color-text1-5']).toBe('#FFFFFF');
      expect(design).toContain('--oyd-');
      const css = applyDesignTokens(fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8'), design);
      expect(css).toContain('--font-size-subhead: 18px;');
      expect(css).toContain('--oyd-');
      expect(css).toContain(`--pod-page-bg-color: ${tokens['--pod-page-bg-color']};`);
    }
  });

  test('template identity removal preserves matching words in confirmed project facts', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const fact = '柔灰嵌白是用户确认的展示名称，保留该业务文案';
    plan.visualStyle.constraints = { copy: fact };
    const design = renderDesign(plan);
    expect(design).toContain(fact);
    expect(design).not.toContain('**柔灰嵌白 · soft-inset-surfaces**');
    expect(design).not.toMatch(/^themeId:/m);
  });

  test('template color recipes resolve dependencies, alpha values and per-theme surface parameters', () => {
    const { resolveThemeColors } = require('../lib/design-plan/themes');
    const template = [
      '  "--oyd-alpha": "<生成实际色值：取 --oyd-light 的 sRGB 三通道，alpha 设为 0.12，输出 rgba>"',
      '  "--oyd-light": "<生成实际色值：#FFFFFF 50% + --oyd-base 50%，sRGB 逐通道混合>"',
      '  "--oyd-base": "<生成实际色值：--color-brand1-6 40% + #000000 60%，sRGB 逐通道混合>"',
      '  "--color-brand1-6": "#FFFFFF"',
    ].join('\n');
    const result = resolveThemeColors(template);
    expect(result).toContain('"--oyd-base": "#666666"');
    expect(result).toContain('"--oyd-light": "#B3B3B3"');
    expect(result).toContain('"--oyd-alpha": "rgba(179, 179, 179, 0.12)"');
    expect(() => resolveThemeColors(template.replace('--oyd-base 50%', '--oyd-light 50%'))).toThrow('主题色值无法生成');
    expect(() => resolveThemeColors(template.replace('#000000 60%', '#000000 20%'))).toThrow('主题色值无法生成');
  });

  test('color derivation reads frontmatter without consuming or rewriting body examples', () => {
    const { resolveThemeColors } = require('../lib/design-plan/themes');
    const body = '\n正文示例：\n```yaml\n"--color-brand1-6": "#FF0000"\n```\n';
    const source = [
      '---', 'tokens:',
      '  "--color-brand1-6": "#000000"',
      '  "--color-brand1-1": "<生成实际色值：--color-brand1-6 50% + #FFFFFF 50%，sRGB 逐通道混合>"',
      '---', body,
    ].join('\n');
    const result = resolveThemeColors(source);
    expect(result).toContain('"--color-brand1-1": "#808080"');
    expect(result).toContain(body);
    expect(result).not.toContain('#FF8080');
  });

  test.each([
    ['soft-inset-surfaces', 'dark', '#D6D6D6', '#FFFFFF'],
    ['dark-inset-hairline', 'light', '#606060', '#171717'],
  ])('changing %s navigation to %s adapts every navigation role and keeps page surfaces', (themeId, tone, foreground, selectedForeground) => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.visualStyle.forUser.selectedTheme = { themeId, templatePath: `templates/design-themes/${themeId}.md` };
    plan.visualStyle.forUser.navigationStyle.tone = tone;
    const { readDesignTokens } = require('../lib/app/theme-from-design');
    const tokens = readDesignTokens(renderDesign(plan));
    expect(tokens['--pod-nav-item-text-color']).toBe(foreground);
    expect(tokens['--pod-nav-item-text-selected-color']).toBe(selectedForeground);
    expect(tokens['--pod-nav-menu-bg-hover-color']).not.toBe(tokens['--pod-shell-theme-bg-color']);
    expect(tokens['--pod-nav-menu-bg-selected-color']).not.toBe(tokens['--pod-nav-menu-bg-hover-color']);
    expect(tokens['--pod-page-bg-color']).toBe(themeId === 'soft-inset-surfaces' ? '#FAFAFA' : '#000000');
    plan.visualStyle.tokens = { '--pod-nav-item-text-color': '#ABCDEF' };
    expect(readDesignTokens(renderDesign(plan))['--pod-nav-item-text-color']).toBe('#ABCDEF');
  });

  test('semantic patch increments revision, invalidates confirmation, and rematerializes a color adjustment', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);
    const before = JSON.parse(fs.readFileSync(input, 'utf8'));

    const result = patchPlan(input, [
      'visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C',
      'visualStyle.forUser.colorStrategy.primaryColorName=暖咖啡棕',
    ], { materialize: true });

    const after = JSON.parse(fs.readFileSync(input, 'utf8'));
    const design = fs.readFileSync(path.join(tempDir, 'design.md'), 'utf8');
    const html = fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8');
    expect(result.changed).toBe(true);
    expect(result.revision).toBe('2026-08-31-02');
    expect(after.meta.status).toBe('draft');
    expect(after.meta.planState).toMatchObject({
      presentedRevision: null,
      confirmedRevision: null,
      planConfirmed: false,
      confirmationInteractionId: '',
      confirmedAt: '',
    });
    expect(after.dataModels).toEqual(before.dataModels);
    expect(design).toContain('"--color-brand1-6": "#8B5E3C"');
    expect(html).toContain('#8B5E3C');
  });

  test('internal patches keep the current draft revision; only editing the presented version advances it', () => {
    const input = path.join(tempDir, 'build-plan.json');
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.meta.revision = '1';
    plan.meta.planState = { presentedRevision: null, confirmedRevision: null, planConfirmed: false };
    fs.writeFileSync(input, JSON.stringify(plan));
    const patch = color => patchPlan(input, [`visualStyle.forUser.colorStrategy.primaryColor=${color}`]);
    expect(patch('#123456').revision).toBe('1');
    // Awaiting confirmation alone does not prove a successful user presentation.
    const ready = JSON.parse(fs.readFileSync(input));
    ready.meta.status = 'awaiting_confirmation';
    fs.writeFileSync(input, JSON.stringify(ready));
    expect(patch('#234567').revision).toBe('1');
    const presented = JSON.parse(fs.readFileSync(input));
    presented.meta.planState.presentedRevision = '1';
    fs.writeFileSync(input, JSON.stringify(presented));
    expect(patch('#345678').revision).toBe('2');
    expect(JSON.parse(fs.readFileSync(input)).meta.planState.presentedRevision).toBeNull();
    expect(patch('#456789').revision).toBe('2');
    expect(patch('#456789')).toMatchObject({ changed: false, revision: '2' });
    const beforeFailure = fs.readFileSync(input, 'utf8');
    expect(() => patch('not-a-color')).toThrow();
    expect(fs.readFileSync(input, 'utf8')).toBe(beforeFailure);
  });

  test.each([true, false])('asset progress preserves existing approval (%s) and refreshes documents', (confirmed) => {
    const input = path.join(tempDir, 'build-plan.json');
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.meta.status = confirmed ? 'confirmed' : 'awaiting_confirmation';
    plan.meta.planState = {
      planConfirmed: confirmed, presentedRevision: plan.meta.revision,
      confirmedRevision: confirmed ? plan.meta.revision : null,
      confirmationInteractionId: confirmed ? 'human-approved' : '',
    };
    plan.visualStyle.forUser.assetStrategy.materialStatus = 'draft';
    plan.visualStyle.forUser.assetStrategy.missingAssets = ['待补封面'];
    fs.writeFileSync(input, JSON.stringify(plan));
    const result = patchPlan(input, [
      'visualStyle.forUser.assetStrategy.materialStatus=final',
      'visualStyle.forUser.assetStrategy.missingAssets=[]',
    ], { materialize: true });
    const after = JSON.parse(fs.readFileSync(input, 'utf8'));
    expect(result).toMatchObject({ changed: true, confirmationInvalidated: false, revision: plan.meta.revision, materialized: true });
    expect(after.meta.status).toBe(plan.meta.status);
    expect(after.meta.planState).toEqual(plan.meta.planState);
    expect(after.pages).toEqual(plan.pages);
    const design = fs.readFileSync(path.join(tempDir, 'design.md'), 'utf8');
    expect(design).toContain('"materialStatus":"final"');
    expect(design).not.toContain('待补封面');
  });

  test('asset progress combined with a visual change still invalidates approval', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);
    const result = patchPlan(input, [
      'visualStyle.forUser.assetStrategy.materialStatus=final',
      'visualStyle.forUser.colorStrategy.primaryColor=#123456',
    ], { materialize: true });
    expect(result.confirmationInvalidated).toBe(true);
    expect(JSON.parse(fs.readFileSync(input, 'utf8')).meta.planState.planConfirmed).toBe(false);
  });

  test('changing image requirements still invalidates approval', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);
    const result = patchPlan(input, [
      'visualStyle.forUser.assetStrategy={"materialStatus":"draft","missingAssets":[],"pages":[{"pageId":"procurement-workbench","imageNeed":"required","slots":[{"slotId":"hero","usage":"hero"}]}]}',
    ]);
    expect(result.confirmationInvalidated).toBe(true);
  });

  test('light navigation uses the shared shell token and invalid navigation values are rejected', () => {
    const compact = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    compact.visualStyle.forUser.navigationStyle.tone = 'light';
    const design = renderDesign(compact);

    expect(design).toContain('- 导航背景：`--pod-shell-theme-bg-color`');
    expect(design).not.toMatch(/^themeId:/m);

    compact.visualStyle.forUser.navigationStyle.structure = 'drawer';
    expect(() => renderDesign(compact)).toThrow(/structure 必须是 top 或 side/);
  });

  test('compact v2 stores only the selected visual direction and internal theme binding', () => {
    const compact = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));

    expect(compact.visualStyle.forUser).not.toHaveProperty('selectedTheme');
    expect(compact.visualStyle.forUser).not.toHaveProperty('candidateThemes');
    expect(compact.visualStyle.forUser).not.toHaveProperty('candidateVisualDirections');
    expect(compact.visualStyle.internal.selectedTheme).toEqual(expect.objectContaining({
      themeId: 'soft-inset-surfaces',
    }));
  });

  test('semantic patch rejects unknown and protected paths without changing the source', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);
    const before = fs.readFileSync(input, 'utf8');

    expect(() => patchPlan(input, ['visualStyle.forUser.missingField=value'])).toThrow(/字段路径不存在/);
    expect(() => patchPlan(input, ['meta.revision=manual'])).toThrow(/自动维护/);
    expect(() => patchPlan(input, ['meta={}'])).toThrow(/自动维护/);
    expect(() => patchPlan(input, ['meta.planState[0]=true'])).toThrow(/自动维护/);
    expect(() => patchPlan(input, ['meta.projectName[0]=X'])).toThrow(/字段路径不存在/);
    expect(() => patchPlan(input, ['meta.__proto__.polluted=true'])).toThrow(/危险字段路径/);
    expect(fs.readFileSync(input, 'utf8')).toBe(before);
  });

  test('a patch that restores the original value preserves revision and confirmation', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);
    const before = fs.readFileSync(input, 'utf8');
    const result = patchPlan(input, [
      'visualStyle.forUser.colorStrategy.primaryColor=#123456',
      'visualStyle.forUser.colorStrategy.primaryColor=#6F4E37',
    ]);
    expect(result.changed).toBe(false);
    expect(result.confirmationInvalidated).toBe(false);
    expect(fs.readFileSync(input, 'utf8')).toBe(before);
  });

  test('invalid theme changes leave the source and generated artifacts intact', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);
    materialize(input);
    const files = ['build-plan.json', 'prd.md', 'design.md', 'build-plan.html'];
    const before = files.map(file => fs.readFileSync(path.join(tempDir, file), 'utf8'));
    expect(() => patchPlan(input, ['visualStyle.forUser.colorStrategy.primaryColor=invalid'], { materialize: true }))
      .toThrow(/HEX/);
    expect(files.map(file => fs.readFileSync(path.join(tempDir, file), 'utf8'))).toEqual(before);
  });

  test('execution overrides preserve explicit resource order and page requirements', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.execution = { resourceCreationOrder: ['应用', '采购订单', '采购申请', '采购工作台'], navigationOrder: ['采购工作台', '采购订单'] };
    plan.pages.customPageDetails[0].dataSources = ['采购申请', '采购订单'];
    const handoff = JSON.parse(renderPrd(plan).match(/```json\n([\s\S]*?)\n```/)[1]);
    expect(handoff.resourceCreationOrder).toEqual(plan.execution.resourceCreationOrder);
    expect(handoff.navigationOrder).toEqual(plan.execution.navigationOrder);
    expect(handoff.pages[0].pageSpecHandoff.dataSources).toEqual(['采购申请', '采购订单']);
  });

  test('compact v2 adjustments stay patch-only and rematerialize derived fields', () => {
    const input = path.join(tempDir, 'build-plan.json');
    const compact = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    fs.writeFileSync(input, `${JSON.stringify(compact, null, 2)}\n`, 'utf8');

    const result = patchPlan(input, [
      'visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C',
      'visualStyle.forUser.colorStrategy.primaryColorName=暖咖啡棕',
    ], { materialize: true });

    const saved = JSON.parse(fs.readFileSync(input, 'utf8'));
    const design = fs.readFileSync(path.join(tempDir, 'design.md'), 'utf8');
    const prd = fs.readFileSync(path.join(tempDir, 'prd.md'), 'utf8');
    expect(result.changedPaths).toEqual([
      'visualStyle.forUser.colorStrategy.primaryColor',
      'visualStyle.forUser.colorStrategy.primaryColorName',
    ]);
    expect(saved.schemaVersion).toBe('2.0');
    expect(saved.overview).not.toHaveProperty('visualSummary');
    expect(saved.visualStyle.forUser).not.toHaveProperty('themeProfile');
    expect(design).toContain('"--color-brand1-6": "#8B5E3C"');
    expect(prd).toContain('暖咖啡棕 #8B5E3C');
  });

  test('token patches propagate through design and CSS and invalidate confirmation', () => {
    const input = path.join(tempDir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);
    patchPlan(input, ['visualStyle.tokens={"--pod-card-border-radius":"16px"}'], { materialize: true });
    const saved = JSON.parse(fs.readFileSync(input, 'utf8'));
    expect(saved.meta.planState.planConfirmed).toBe(false);
    const design = fs.readFileSync(path.join(tempDir, 'design.md'), 'utf8');
    const { readDesignTokens } = require('../lib/app/theme-from-design');
    expect(readDesignTokens(design)['--pod-card-border-radius']).toBe('16px');
    const before = fs.readFileSync(input, 'utf8');
    expect(() => patchPlan(input, ['visualStyle.tokens={"--pod-card-border-radius":"<待定>"}'], { materialize: true })).toThrow();
    expect(fs.readFileSync(input, 'utf8')).toBe(before);
  });

  test('business navigation cannot silently override visual choices', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.execution = { appConfig: { navTheme: 'light' } };
    expect(() => renderPrd(plan)).toThrow(/视觉事实冲突/);
  });

  test('Plan Skill delegates derived artifacts to the CLI materializer', () => {
    const workflow = fs.readFileSync(path.join(
      ROOT,
      'yida-skills',
      'skills',
      'yida-app',
      'workflow',
      'plan',
      'step-4-deliver.md'
    ), 'utf8');

    expect(workflow).toContain('openyida design-plan materialize prd/<项目名>/build-plan.json --json');
    expect(workflow).toContain('--check --json');
    expect(workflow).not.toContain('python scripts/render_build_plan.py');
  });
});

describe('Plan contract and file consistency', () => {
  let dir;
  let input;
  const read = () => JSON.parse(fs.readFileSync(input, 'utf8'));
  const save = plan => fs.writeFileSync(input, JSON.stringify(plan));
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-plan-contract-'));
    input = path.join(dir, 'build-plan.json');
    fs.copyFileSync(FIXTURE, input);
  });
  afterEach(() => { jest.restoreAllMocks(); fs.rmSync(dir, { recursive: true, force: true }); });

  test('adds optional children without replacing siblings and rejects unknown or derived fields', () => {
    patchPlan(input, ['execution.appConfig.corpId=CORP1', 'visualStyle.tokens.--pod-card-border-radius=12px']);
    patchPlan(input, ['execution.acceptanceCriteria=["采购登记后可查询"]', 'visualStyle.tokens.--corner-2=6px']);
    expect(read().execution.appConfig.corpId).toBe('CORP1');
    expect(read().visualStyle.tokens).toEqual({ '--pod-card-border-radius': '12px', '--corner-2': '6px' });
    const before = fs.readFileSync(input, 'utf8');
    for (const expression of ['execution.unknown=true', 'execution.appConfig.corpId={}', 'pages.customPageDetails[99].scene=detail', 'visualStyle.forUser.themeProfile.radiusScale=small', 'execution.acceptanceCriteria=[]', 'pages.customPageDetails[0].pageSpecHandoff={"unknown":true}']) {
      expect(() => patchPlan(input, [expression])).toThrow();
      expect(fs.readFileSync(input, 'utf8')).toBe(before);
    }
  });

  test.each(['1.0', '2.0'])('rejects silent themeProfile overrides for schema %s', schemaVersion => {
    const plan = read(); plan.schemaVersion = schemaVersion;
    plan.visualStyle.forUser.themeProfile.radiusScale = 'small';
    save(plan);
    expect(() => materialize(input)).toThrow(/只读主题摘要/);
    expect(fs.existsSync(path.join(dir, 'design.md'))).toBe(false);
  });

  test('preserves explicit references and validates them against generated design keys', () => {
    patchPlan(input, ['pages.customPageDetails[0].pageSpecHandoff.designRefs=["states.empty","components.table"]'], { materialize: true });
    const prd = fs.readFileSync(path.join(dir, 'prd.md'), 'utf8');
    const handoff = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]).pages[0].pageSpecHandoff;
    expect(handoff.designRefs).toEqual(['themeProfile', 'sceneRecipes.workbench', 'states.empty', 'components.table']);
    const design = require('js-yaml').load(fs.readFileSync(path.join(dir, 'design.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1]);
    expect(design.components.table).toEqual({ anchor: '#component-table' });
    expect(fs.readFileSync(path.join(dir, 'design.md'), 'utf8')).toContain('<a id="component-table"></a>');
    for (const expression of ['pages.customPageDetails[0].pageStructure=unknown', 'pages.customPageDetails[0].pageSpecHandoff.designRefs=["components.missing"]', 'pages.customPageDetails[0].pageSpecHandoff.designFile=wrong.md']) {
      expect(() => patchPlan(input, [expression], { materialize: true })).toThrow();
    }
  });

  test('requires meaningful sample records and explicit data binding or an explained empty state', () => {
    const plan = read();
    delete plan.dataModels[1].sampleRecords;
    save(plan);
    expect(() => materialize(input)).toThrow(/业务示例记录/);
    plan.dataModels[1].skipSampleReason = '用户明确不要示例数据';
    delete plan.pages.customPageDetails[0].dataBinding;
    save(plan);
    expect(() => materialize(input)).toThrow(/明确 dataBinding/);
    Object.assign(plan.pages.customPageDetails[0], { dataBinding: 'static-empty', dataSources: [], emptyReason: '本轮只交付登记入口，暂不展示记录' });
    save(plan);
    materialize(input);
    const prd = fs.readFileSync(path.join(dir, 'prd.md'), 'utf8');
    expect(prd).toContain('用户明确不要示例数据');
    expect(prd).toContain('本轮只交付登记入口');
    expect(() => patchPlan(input, ['dataModels[1].sampleRecords=[{"不存在的字段":"值"}]'])).toThrow();
  });

  test.each([1, 2, 3, 4])('failed replacement %i restores source and all existing artifacts', failure => {
    materialize(input);
    const files = ['build-plan.json', 'prd.md', 'design.md', 'build-plan.html'].map(name => path.join(dir, name));
    const before = files.map(file => fs.readFileSync(file));
    const rename = fs.renameSync;
    let replacements = 0;
    jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (path.basename(from) === 'next' && ++replacements === failure) {throw new Error('injected install failure');}
      return rename(from, to);
    });
    expect(() => patchPlan(input, ['visualStyle.forUser.colorStrategy.primaryColor=#123456'], { materialize: true })).toThrow(/injected/);
    expect(files.map(file => fs.readFileSync(file))).toEqual(before);
    expect(fs.readdirSync(dir).filter(name => name.startsWith('.openyida-write-'))).toEqual([]);
  });

  test('failed first materialization removes newly installed files', () => {
    const before = fs.readFileSync(input);
    const rename = fs.renameSync;
    let replacements = 0;
    jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (path.basename(from) === 'next' && ++replacements === 3) {throw new Error('injected install failure');}
      return rename(from, to);
    });
    expect(() => materialize(input)).toThrow(/injected/);
    expect(fs.readFileSync(input)).toEqual(before);
    expect(fs.readdirSync(dir)).toEqual(['build-plan.json']);
  });

  test('human output hides raw revision while JSON preserves exact confirmation identity', async () => {
    const { run } = require('../lib/design-plan/design-plan');
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(['patch', input, '--set', 'visualStyle.tokens.--corner-2=6px']);
    expect(log.mock.calls.flat().join(' ')).not.toContain(read().meta.revision);
    log.mockClear();
    await run(['materialize', input, '--check', '--json']);
    expect(JSON.parse(log.mock.calls[0][0]).revision).toBe(read().meta.revision);
    const workflow = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-app/workflow/plan/step-4-deliver.md'), 'utf8');
    expect(workflow).toContain('展示“当前方案”');
    expect(workflow).not.toContain('第 N 版方案');
    expect(workflow).not.toContain('展示当前 revision');
    expect(workflow).toContain('presentedRevision=meta.revision');
  });

  test('plan confirmation atomically delivers the workspace preview and revision', () => {
    const interactionContract = fs.readFileSync(
      path.join(
        ROOT,
        'yida-skills/skills/yida-design/references/ask-human-interaction-contract.md',
      ),
      'utf8',
    );
    const workflow = fs.readFileSync(
      path.join(
        ROOT,
        'yida-skills/skills/yida-app/workflow/plan/step-4-deliver.md',
      ),
      'utf8',
    );

    for (const content of [interactionContract, workflow]) {
      expect(content).toContain('attachments');
      expect(content).toContain('prd/<项目名>/build-plan.html');
      expect(content).toContain('revision');
    }
    expect(interactionContract).toContain('同一次 `ask_human`');
    expect(interactionContract).toContain('附件、问题与 `revision` 是一个原子交互');
    expect(workflow).toContain('实际调用 `ask_human` 创建结构化提问');
    expect(workflow).toContain('一次成功调用同时建立方案展示、版本绑定和最终选择');
  });

  test('plan final confirmation uses the callable single-select ask_human schema only', () => {
    const interactionContract = fs.readFileSync(
      path.join(
        ROOT,
        'yida-skills/skills/yida-design/references/ask-human-interaction-contract.md',
      ),
      'utf8',
    );
    const workflow = fs.readFileSync(
      path.join(
        ROOT,
        'yida-skills/skills/yida-app/workflow/plan/step-4-deliver.md',
      ),
      'utf8',
    );
    const example = interactionContract.match(
      /#### 最终确认 `ask_human` payload[\s\S]*?```json\n([\s\S]*?)\n```/,
    );

    expect(example).not.toBeNull();
    const payload = JSON.parse(example[1]);
    expect(Object.keys(payload).sort()).toEqual([
      'attachments',
      'options',
      'question',
      'revision',
      'submitLabel',
      'title',
    ]);
    expect(payload.question).toBe('是否按当前方案开始搭建？');
    expect(payload.options.map(option => option.value)).toEqual([
      'confirm_build',
      'continue_editing',
    ]);
    expect(payload.options).toHaveLength(2);
    expect(payload.attachments).toEqual([
      {
        name: 'build-plan.html',
        path: 'prd/<项目名>/build-plan.html',
      },
    ]);
    expect(payload.revision).toBe('{revision}');
    expect([payload.title, payload.question, ...payload.attachments.map(item => item.name)].join(' ')).not.toMatch(/第\s*(?:N|\d+)\s*版|\{revision\}/);
    expect(payload.submitLabel).toBeTruthy();
    expect(JSON.stringify(payload)).not.toMatch(
      /"(?:fields|text|textarea)"\s*:|调整说明/,
    );

    for (const content of [interactionContract, workflow]) {
      expect(content).toContain('`confirm_build`');
      expect(content).toContain('`continue_editing`');
      expect(content).toContain('下一次交互');
    }
    expect(interactionContract).toContain('顶层字段集合固定为');
    expect(workflow).toContain('唯一 payload schema');
  });

  test('staging failure changes no source or artifact', () => {
    materialize(input);
    const files = ['build-plan.json', 'prd.md', 'design.md', 'build-plan.html'].map(name => path.join(dir, name));
    const before = files.map(file => fs.readFileSync(file));
    const write = fs.writeFileSync;
    jest.spyOn(fs, 'writeFileSync').mockImplementation((file, ...args) => {
      if (path.basename(file) === 'next') {throw new Error('injected staging failure');}
      return write(file, ...args);
    });
    expect(() => patchPlan(input, ['visualStyle.tokens.--corner-2=4px'], { materialize: true })).toThrow(/staging/);
    expect(files.map(file => fs.readFileSync(file))).toEqual(before);
  });
});
