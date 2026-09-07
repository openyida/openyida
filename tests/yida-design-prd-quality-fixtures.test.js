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
      'visualScaffold',
      'prioritySurface',
      'contentPrimitive',
      'statePrimitive',
      'backgroundLayer',
      'surfaceMaterial',
      'surfaceContrast',
      'colorRoles',
      'densityRule',
      'breathingRule',
      'roundedRule',
    ]));
    expect(visual.forbiddenPatterns).toEqual(expect.arrayContaining([
      'pageSpecHandoff',
      '资源创建顺序',
      '导航顺序',
    ]));
  });

  test('style registry documents built-in visual DNA templates', () => {
    const registry = read('yida-skills/skills/yida-design/references/style-designs/registry.md');
    const template = read('yida-skills/skills/yida-design/references/style-designs/_design-md-template.md');
    const styleDesignEntries = fs.readdirSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/style-designs')).sort();

    expect(registry).toContain('_design-md-template.md');
    expect(registry).toContain('内置设计风格');
    expect(registry).toContain('配色由模型根据行业、品牌、应用主题、业务情绪和用户偏好生成');
    expect(styleDesignEntries).toEqual(expect.arrayContaining([
      '_design-md-template.md',
      'registry.md',
      'soft-analytic-workbench.md',
      'dark-stage-analytic-dashboard.md',
      'filterable-card-catalog.md',
    ]));
    expect(styleDesignEntries.length).toBeGreaterThan(2);
    expect(template).toContain('## 21. 交付自检清单');
    expect(template).toContain('卡片圆角范围 0-32px');
    expect(template).toContain('卡片 padding 必须大于 20');
    expect(template).toContain('卡片之间的 gap 必须小于 20');
    expect(template).toContain('状态摘要、动作条、列表行、空态高度');
    expect(template).toContain('已明确呼吸感规则');
    expect(template).toContain('surfaceContrast');
    expect(template).toContain('页面背景与卡片背景必须形成明显层次对比');
    expect(template).toContain('gray-bg-white-card');
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
    expect(step5).toContain('同一个 `prd/<项目名>/design.md`');
    expect(pageGeneration).toContain('强视觉品牌以 PRD 的素材清单和 `design.md.assetStrategy` 为准');
  });
});
