'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { materialize, normalizePlan, renderDesign, renderPrd } = require('../lib/design-plan/materialize');
const { patchPlan } = require('../lib/design-plan/patch');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'prd', '采购管理', 'build-plan.json');

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
    expect(prd).toContain('# 采购管理应用 搭建计划（PRD）');
    expect(prd).toContain('buildPlanRevision: "2026-08-31-01"');
    expect(design).toContain('"--color-brand1-6": "#6F4E37"');
    expect(design).toContain('buildPlanRevision: "2026-08-31-01"');
    expect(design).toContain('## 项目视觉选择');
    expect(design).not.toMatch(/^themeId:/m);
    expect(design).not.toMatch(/\{\{[^}]+\}\}|<基于 --color-brand1-6/);
    expect(html).toContain('href="#overview"');
    expect(html).toContain('href="#pages"');
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
    expect(prd).toContain('按钮、输入、卡片、表格和反馈组件遵循统一项目设计系统');
    expect(prd).not.toContain('主题模板：');
    expect(compactDesign).toContain('- 视觉方向：稳重流程型');
    expect(compactDesign).toContain('- 导航结构：侧边导航');
    expect(compactDesign).toContain('- 导航明暗：深色');
    expect(compactDesign).toContain('- 导航背景：`--color-brand1-5`');
    expect(compactDesign).not.toMatch(/^themeId:/m);
    expect(compactDesign).not.toContain('airy-modular-clarity');
    expect(html).toContain('<strong>导航结构：</strong>侧边导航');
    expect(html).toContain('<strong>导航明暗：</strong>深色');
    expect(html).toContain('高频流程处理需要稳定入口，深色导航加强模块边界。');
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
        expect(design).toContain('"--oyd-page-background": "#F1F0EF"');
        expect(design).toContain('"--oyd-surface-soft": "#EBE9E8"');
        expect(design).toContain('"--oyd-accent-deep": "#44352A"');
      }
      if (theme.themeId === 'interlocked-vivid-modules') {
        expect(design).toContain('"--oyd-page-background": "#F4F4F3"');
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
    expect(fs.readFileSync(input, 'utf8')).toBe(before);
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

  test('Plan Skill delegates derived artifacts to the CLI materializer', () => {
    const workflow = fs.readFileSync(path.join(
      ROOT,
      'yida-skills',
      'skills',
      'yida-design',
      'sub_skill',
      'yida-design-plan',
      'workflow',
      'step-4-deliver.md'
    ), 'utf8');

    expect(workflow).toContain('openyida design-plan materialize prd/<项目名>/build-plan.json --json');
    expect(workflow).toContain('--check --json');
    expect(workflow).not.toContain('python scripts/render_build_plan.py');
  });
});
