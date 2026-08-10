'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('yida-prd PRD quality fixtures', () => {
  test('fixture prompts assert pageSpecHandoff and design handoff primitives', () => {
    const fixturePath = 'scripts/eval/scenarios/yida-prd-quality.json';
    const scenarios = JSON.parse(read(fixturePath));

    expect(scenarios).toHaveLength(4);
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'student-management-workbench',
      'pet-social-workbench',
      'coffee-inventory-dashboard',
      'ops-command-center',
    ]);

    for (const scenario of scenarios) {
      expect(scenario.expectedSkill).toBe('yida-prd');
      expect(scenario.requiredPatterns).toEqual(expect.arrayContaining([
        'pageSpecHandoff',
        'prd.md',
        'design.md',
        'designFile',
        'prdRefs',
        'designRefs',
        'contentBlocks',
      ]));
      expect(scenario.forbiddenPatterns.length).toBeGreaterThan(0);
    }
  });

  test('style registry documents built-in visual DNA templates', () => {
    const registry = read('yida-skills/skills/yida-design/references/style-designs/registry.md');
    const template = read('yida-skills/skills/yida-design/references/style-designs/_design-md-template.md');
    const styleDesignEntries = fs.readdirSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/style-designs')).sort();

    expect(registry).toContain('_design-md-template.md');
    expect(registry).toContain('内置视觉 DNA 模板');
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

  test('prd and design skills use prd.md and design.md instead of scene docs', () => {
    const scenesDir = path.join(ROOT, 'yida-skills/skills/yida-design/references', 'scenes');
    const prd = read('yida-skills/skills/yida-prd/SKILL.md');
    const skill = read('yida-skills/skills/yida-design/SKILL.md');
    const step3 = read('yida-skills/skills/yida-prd/workflow/step-3-information-architecture.md');
    const step5 = read('yida-skills/skills/yida-design/workflow/step-5-visual-states.md');
    const pageGeneration = read('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');

    expect(fs.existsSync(scenesDir)).toBe(false);
    expect(prd).toContain('并生成 `prd/<项目名>/prd.md`');
    expect(skill).toContain('生成 `prd/<项目名>/design.md` 和精简视觉配置');
    expect(skill).toContain('`.cache/openyida/<项目名>/design-runtime.json`');
    expect(step3).toContain('页面 `scene` 只作为分类标签和实现提示，不作为页面模板');
    expect(step5).toContain('同一个 `prd/<项目名>/design.md`');
    expect(pageGeneration).toContain('强视觉品牌从 `prdRefs` 读取素材和 CTA，从 `designRefs` 读取构图与视觉节奏');
  });
});
