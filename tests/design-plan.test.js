'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { materialize, normalizePlan, renderDesign, renderPrd } = require('../lib/design-plan/materialize');
const { patchPlan } = require('../lib/design-plan/patch');

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
    expect(handoff.pages[0].pageSpecHandoff.designFile).toBe('prd/采购管理应用/design.md');
    for (const reference of handoff.pages[0].pageSpecHandoff.designRefs) {
      const frontmatter = require('js-yaml').load(design.match(/^---\n([\s\S]*?)\n---/)[1]);
      expect(reference.split('.').reduce((value, key) => value?.[key], frontmatter)).toBeDefined();
    }
    expect(design).toContain('"--color-brand1-6": "#6F4E37"');
    expect(design).toContain('buildPlanRevision: "2026-08-31-01"');
    expect(design).toContain('## 项目视觉选择');
    expect(design).not.toMatch(/^themeId:/m);
    expect(design).not.toMatch(/\{\{[^}]+\}\}|<基于 --color-brand1-6/);
    expect(html).toContain('href="#overview"');
    expect(html).toContain('href="#pages"');
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

  test('HTML preserves the complete user plan and resolved business overrides', () => {
    const input = path.join(tempDir, 'build-plan.json');
    const plan = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    const page = plan.pages.customPageDetails[0];
    page.pageSpecHandoff = { primaryAction: '核对采购差异', contentBlocks: ['差异核对区'] };
    plan.execution = {
      acceptanceCriteria: ['每笔订单金额与采购明细一致'],
      interactionStates: { error: '采购系统离线时显示重试入口' },
    };
    plan.visualStyle.forUser.assetStrategy = { missingAssets: ['企业标志待提供'], notes: '<script>untrusted()</script>' };
    const source = JSON.stringify(plan);
    fs.writeFileSync(input, source);
    materialize(input);
    const html = fs.readFileSync(path.join(tempDir, 'build-plan.html'), 'utf8');
    for (const text of ['核对采购差异', '差异核对区', '每笔订单金额与采购明细一致', '采购系统离线时显示重试入口', '企业标志待提供', '初始示例数据', '数据来源', '页面视觉方案', '搭建顺序', '页面交付顺序', '导航顺序']) {
      expect(html).toContain(text);
    }
    const sample = plan.dataModels.find(model => model.sampleRecords?.length).sampleRecords[0];
    for (const value of Object.values(sample)) {expect(html).toContain(String(value));}
    expect(html.match(/class="nav-item"/g)).toHaveLength(4);
    expect(html).toContain('待审批、待收货、待付款和临期订单摘要');
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
    } else {expect(handoff.pageNavigation).toEqual([]);}
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
    plan.visualStyle.forUser.selectedTheme.templatePath = 'templates/design-themes/dark-focus-layered.md';

    expect(() => renderDesign(plan)).toThrow(/themeId 与 templatePath/);
  });

  test('renderers are deterministic', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

    expect(renderPrd(plan)).toBe(renderPrd(plan));
    expect(renderDesign(plan)).toBe(renderDesign(plan));
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
      'templates/design-themes/airy-modular-clarity.md'
    );
    expect(normalized.visualStyle.forUser.themeProfile).toMatchObject({
      tone: 'airy-modular',
      surfaceStyle: 'joined-light-panels',
    });
    expect(normalized.visualStyle.forDesignMd).not.toHaveProperty('componentRules');

    materialize(FIXTURE, { outputDir: legacyOutput });
    materialize(compactInput, { outputDir: compactOutput });
    const legacyDesign = fs.readFileSync(path.join(legacyOutput, 'design.md'), 'utf8');
    const compactDesign = fs.readFileSync(path.join(compactOutput, 'design.md'), 'utf8');
    const componentContract = source => source.slice(source.indexOf('## 组件'), source.indexOf('## 项目应用'));
    expect(componentContract(compactDesign)).toBe(componentContract(legacyDesign));
    expect(compactDesign).toContain('### 状态与交互');
    expect(compactDesign).toContain('### 交付自检');
    expect(compactDesign).toContain('摘要拼接组');

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
    expect(compactDesign).toContain('- 导航背景：`--color-brand1-5`');
    expect(compactDesign).not.toMatch(/^themeId:/m);
    expect(compactDesign).not.toContain('airy-modular-clarity');
    expect(html).toContain('<strong>导航结构：</strong>平台侧边导航');
    expect(html).toContain('<strong>导航明暗：</strong>深色');
    expect(html).toContain('高频流程处理需要稳定入口，深色导航加强模块边界。');
  });

  test.each([
    ['custom', undefined, 'transparent'],
    ['platform-top', undefined, 'var(--pod-page-bg-color, var(--color-white, #fff))'],
    ['custom', 'var(--color-brand1-3)', 'var(--color-brand1-3)'],
    ['platform-side', '#FFF8ED', '#FFF8ED'],
  ])('page background follows %s navigation while preserving explicit design %s', (navigationType, override, expected) => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    plan.execution = { ...plan.execution, appConfig: { navigationType } };
    plan.visualStyle.tokens = override ? { '--oyd-page-background': override } : {};
    const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
    const design = renderDesign(plan);
    expect(readDesignTokens(design)['--oyd-page-background']).toBe(expected);
    const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
    const css = applyDesignTokens(template, design);
    expect(css).toContain(`--oyd-page-background: ${expected};`);
  });

  test('brand atmosphere reaches CSS surfaces and preserves text semantics when the primary color changes', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    delete plan.visualStyle.forUser.themeProfile;
    plan.visualStyle.forUser.selectedTheme = { themeId: 'mist-layered-signal', templatePath: 'templates/design-themes/mist-layered-signal.md' };
    plan.visualStyle.forUser.colorStrategy = { primaryColor: '#2F9E63', primaryColorName: '自然绿意', surfaceTone: 'brand-tinted' };
    const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
    const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
    const design = renderDesign(plan);
    const green = readDesignTokens(design);
    expect(green['--pod-shell-bg-color-light']).toBe('#F3F9F6');
    expect(green['--pod-page-bg-color']).toBeUndefined();
    expect(green['--pod-card-bg-color']).toBe('var(--color-white, #fff)');
    expect(green['--pod-card-border']).toBe('1px solid var(--color-line1-1)');
    expect(green['--color-line1-2']).toBe('#CDE8DA');
    expect(green['--color-text1-4']).toBe('#171717');
    expect(green['--color-text1-10']).toBe('#5F5F5F');
    expect(green['--color-text1-3']).toBe('#929292');
    expect(design.indexOf('## 项目配色适配')).toBeLessThan(design.indexOf('## 设计总览'));
    expect(applyDesignTokens(template, design)).toContain('--pod-shell-bg-color-light: #F3F9F6;');
    expect(applyDesignTokens(template, design)).toContain('--pod-page-bg-color: #ffffff;');
    plan.visualStyle.forUser.colorStrategy.primaryColor = '#6F4E37';
    const brown = readDesignTokens(renderDesign(plan));
    for (const token of ['--pod-shell-bg-color-light', '--color-line1-2', '--color-fill1-2']) {
      expect(brown[token]).not.toBe(green[token]);
    }
    expect(brown['--color-text1-4']).toBe(green['--color-text1-4']);
    plan.visualStyle.tokens = { '--oyd-page-background': '#FFFFFF', '--pod-card-bg-color': '#FFF8ED' };
    const explicitDesign = renderDesign(plan);
    expect(readDesignTokens(explicitDesign)['--oyd-page-background']).toBe('#FFFFFF');
    expect(applyDesignTokens(template, explicitDesign)).toContain('--pod-card-bg-color: #FFF8ED;');
  });

  test.each(['custom', 'platform-top', 'platform-side', 'platform-l-shape'])(
    'brand-tinted %s navigation keeps shell, native page and canvas surfaces separate', navigationType => {
      const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
      plan.execution = { ...plan.execution, appConfig: { navigationType } };
      plan.visualStyle.forUser.colorStrategy = { primaryColor: '#2F9E63', surfaceTone: 'brand-tinted' };
      plan.visualStyle.tokens = {};
      const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
      const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
      const design = renderDesign(plan);
      const tokens = readDesignTokens(design);
      expect(tokens['--pod-shell-bg-color-light']).toBe('#F3F9F6');
      expect(tokens['--oyd-page-background']).toBe(navigationType === 'custom'
        ? 'transparent' : 'var(--pod-page-bg-color, var(--color-white, #fff))');
      expect(applyDesignTokens(template, design)).toContain('--pod-page-bg-color: #ffffff;');
      plan.visualStyle.tokens = {
        '--oyd-page-background': 'var(--color-brand1-3)',
        '--pod-page-bg-color': '#FFF8ED',
        '--pod-shell-bg-color-light': '#FAF0E6',
      };
      const explicit = readDesignTokens(renderDesign(plan));
      for (const [token, value] of Object.entries(plan.visualStyle.tokens)) {
        expect(explicit[token]).toBe(value);
      }
    }
  );

  test('brand atmosphere preserves dark surfaces and rejects unsupported modes', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    delete plan.visualStyle.forUser.themeProfile;
    plan.visualStyle.forUser.selectedTheme = { themeId: 'dark-luminous-modular', templatePath: 'templates/design-themes/dark-luminous-modular.md' };
    plan.execution = { ...plan.execution, appConfig: { navigationType: 'custom' } };
    plan.visualStyle.forUser.colorStrategy.surfaceTone = 'brand-tinted';
    const { readDesignTokens } = require('../lib/app/theme-from-design');
    const tokens = readDesignTokens(renderDesign(plan));
    expect(tokens['--oyd-page-background']).toBe('#101010');
    expect(tokens['--color-white']).toBe('#181818');
    plan.visualStyle.forUser.colorStrategy.surfaceTone = 'invalid';
    expect(() => renderDesign(plan)).toThrow('surfaceTone');
  });

  test('all registered themes resolve project placeholders and derived color tokens', () => {
    const plan = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const themeIndex = JSON.parse(fs.readFileSync(path.join(
      ROOT,
      'yida-skills',
      'skills',
      'yida-design',
      'sub_skill',
      'yida-design-plan',
      'templates',
      'design-themes',
      'index.json'
    ), 'utf8'));
    expect(themeIndex.themes).toHaveLength(19);

    for (const theme of themeIndex.themes) {
      delete plan.visualStyle.forUser.themeProfile;
      plan.visualStyle.forUser.selectedTheme.themeId = theme.themeId;
      plan.visualStyle.forUser.selectedTheme.templatePath = theme.templatePath;
      const design = renderDesign(plan);
      expect(design).toContain('"--color-brand1-6": "#6F4E37"');
      expect(design).not.toMatch(/\{\{[^}]+\}\}|<[^>]*(?:实际色值|生成期标记)[^>]*>/);
      expect(design).not.toMatch(/"--[^"]+"\s*:\s*"AI 根据[^"]*生成[^"]*"/);
      if (theme.themeId === 'airy-media-grid') {
        expect(design).toContain('"--color-brand1-1": "#836753"');
      }
      if (theme.themeId === 'dark-focus-layered') {
        expect(design).toContain('"--oyd-stage-bottom": "#2C231C"');
      }
      if (theme.themeId === 'hairline-runway-clarity') {
        expect(design).toContain('"--color-brand1-1": "#F1EDEB"');
      }
      if (theme.themeId === 'high-contrast-modular') {
        expect(design).toContain('"--oyd-page-background": "var(--pod-page-bg-color, var(--color-white, #fff))"');
        expect(design).toContain('"--oyd-surface-soft": "#EBE9E8"');
        expect(design).toContain('"--oyd-accent-deep": "#44352A"');
      }
      if (theme.themeId === 'interlocked-vivid-modules') {
        expect(design).toContain('"--oyd-page-background": "var(--pod-page-bg-color, var(--color-white, #fff))"');
      }
      if (theme.themeId === 'media-rail-inspector') {
        expect(design).toContain('"--oyd-media-surface": "#F2F0EF"');
        expect(design).toContain('"--oyd-tag-surface": "#E8E5E3"');
        expect(design).toContain('"--oyd-action-deep": "#221D1A"');
      }
      if (theme.themeId === 'mono-grid-signal') {
        expect(design).toContain('"--oyd-pattern-surface": "#E8E6E4"');
      }
      if (theme.themeId === 'status-framed-media-grid') {
        expect(design).toContain('"--oyd-brand-focus-soft": "#F3F1EF"');
      }
      if (theme.themeId === 'dark-luminous-modular') {
        expect(design).toContain('"--color-brand1-2": "#2D251F"');
        expect(design).toContain('"--color-brand1-3": "#1A1614"');
        expect(design).toContain('"--oyd-brand-glow-soft": "rgba(111, 78, 55, 0.18)"');
        expect(design).toContain('"--oyd-brand-chart-strong": "#785943"');
      }
    }
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

  test('light navigation maps to brand1-3 and invalid navigation values are rejected', () => {
    const compact = compactV2(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    compact.visualStyle.forUser.navigationStyle.tone = 'light';
    const design = renderDesign(compact);

    expect(design).toContain('- 导航背景：`--color-brand1-3`');
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
      themeId: 'airy-modular-clarity',
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
    expect(design.components.table.rules).toContain('--color-fill1-1');
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
    expect(workflow).toContain('展示“当前这版方案”');
    expect(workflow).not.toContain('展示当前 revision');
    expect(workflow).toContain('presentedRevision=meta.revision');
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
