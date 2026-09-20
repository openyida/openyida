'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('parallel PRD and visual artifact quality fixtures', () => {
  test('fixture prompts keep PRD and visual owner contracts independent', () => {
    const fixturePath = 'scripts/eval/scenarios/yida-design-prd-quality.json';
    const scenarios = JSON.parse(read(fixturePath));

    expect(scenarios).toHaveLength(4);
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'student-management-prd',
      'pet-social-prd',
      'coffee-inventory-prd',
      'ops-command-center-visual',
    ]);

    for (const scenario of scenarios.slice(0, 3)) {
      expect(scenario.expectedSkill).toBe('yida-prd');
      expect(scenario.requiredPatterns).toEqual(expect.arrayContaining([
        'pageSpecHandoff',
        'prd.md',
        'designFile',
        'designRefs',
      ]));
      expect(scenario.forbiddenPatterns.length).toBeGreaterThan(0);
    }

    const visual = scenarios[3];
    expect(visual.expectedSkill).toBe('yida-design');
    expect(visual.requiredPatterns).toEqual(expect.arrayContaining([
      'design.md',
      'schemaVersion',
      'application-global',
      'custom-page',
      'themeProfile',
      'sceneRecipes',
      'components',
      'states',
      'assetStrategy',
      'iconSystem',
      '<a id=',
      '页面任务',
      '首屏焦点',
      '布局',
      '表面与组件',
      '主操作',
      '状态',
      '响应式',
      '验收',
    ]));
    expect(visual.forbiddenPatterns).toEqual(expect.arrayContaining([
      'pageSpecHandoff',
      '资源创建顺序',
      '导航顺序',
      'themeId:',
      'baseDesignSource:',
    ]));
    expect(visual.requiredPatterns).not.toEqual(expect.arrayContaining(['visualScaffold', 'prioritySurface']));
  });

  test('Fast, Plan and page design share one theme catalog', () => {
    const root = 'yida-skills/skills/yida-design';
    const selection = read(`${root}/references/theme-selection.md`);
    const index = JSON.parse(read(`${root}/templates/design-themes/index.json`));
    const fast = read(`${root}/workflow/step-5-visual-states.md`);
    const plan = read(`${root}/sub_skill/yida-design-plan/references/visual-theme-selection.md`);
    const page = read(`${root}/sub_skill/page-design/SKILL.md`);

    expect(selection).toContain('templates/design-themes/index.json');
    expect(selection).toContain('styleSummary');
    for (const entry of [fast, plan, page]) {
      expect(entry).toContain('theme-selection.md');
    }
    expect(index.themes.length).toBeGreaterThan(0);
    for (const theme of index.themes) {
      const template = read(`${root}/${theme.templatePath}`);
      expect(template).toContain(`themeId: ${theme.themeId}`);
      expect(template).toContain('application-global:');
      expect(template).toContain('{{PRIMARY_COLOR}}');
    }
    expect(fs.existsSync(path.join(ROOT, root, 'references/style-designs'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, root, 'sub_skill/yida-design-plan/templates/design-themes'))).toBe(false);
  });

  test('one artifact contract serves separate Fast and Plan authoring paths', () => {
    const root = 'yida-skills/skills/yida-design';
    const contract = read(`${root}/workflow/output-design.md`);
    const fast = read(`${root}/workflow/step-6-handoff.md`);
    const plan = read(`${root}/sub_skill/yida-design-plan/SKILL.md`);
    const planInput = read(`${root}/sub_skill/yida-design-plan/references/build-plan-compact-schema.md`);
    expect(contract).toContain('Fast 手写项目 `design.md`，Plan 由 CLI 物化生成');
    expect(contract).toContain('索引只保存定位信息');
    expect(contract).toContain('每条完整规则只写一次');
    expect(fast).toContain('公共校验通过');
    expect(fast).toContain('openyida check-design');
    expect(plan).toContain('[公共输出契约](../../workflow/output-design.md)');
    for (const field of ['firstScreenFocus', 'layout', 'responsive', 'acceptanceChecks']) {
      expect(planInput).toContain(field);
      expect(plan).toContain(field);
    }
    expect(plan).toContain('旧计划同样不得以继承主题套话补过门槛');
    expect(planInput).toContain('纯原生页无需增加记录');
  });

  test('visual skill owns design.md without taking PRD ownership', () => {
    const scenesDir = path.join(ROOT, 'yida-skills/skills/yida-design/references', 'scenes');
    const skill = read('yida-skills/skills/yida-design/SKILL.md');
    const step3 = read('yida-skills/skills/yida-prd/workflow/step-2-information-architecture.md');
    const step5 = read('yida-skills/skills/yida-design/workflow/step-5-visual-states.md');
    const pageGeneration = read('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');

    expect(fs.existsSync(scenesDir)).toBe(false);
    expect(skill).toContain('视觉设计技能，输出 `design.md`');
    expect(skill).toContain('业务规划始终归 `yida-prd`');
    expect(skill).toContain('输入为校验通过的共享 `requirement-brief.json`');
    expect(skill).toContain('业务规划与配色、组件样式同时准备');
    expect(skill).toContain('页面内容确定后补齐各页设计');
    expect(skill).toContain('由 `yida-app` 核对页面范围和设计引用');
    expect(step3).toContain('页面 `scene` 只作为分类标签和实现提示，不作为固定页面样式');
    expect(step5).toContain('最终内容与格式统一遵守 [输出契约](output-design.md)');
    expect(step5).toContain('Fast 手写后执行公共 check-design');
    expect(pageGeneration).toContain('按 `design.md.assetStrategy` 调用 `yida-image-assets`');
    expect(pageGeneration).toContain('`pages[].materialStatus`');
    expect(pageGeneration).toContain('`assets[].materialStatus=final`');
  });
});
