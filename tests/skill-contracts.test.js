'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readSkill(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('OpenYida skill contracts', () => {
  test('root skill uses compact agent-capabilities for default preflight', () => {
    const skill = readSkill('yida-skills/SKILL.md');

    expect(skill).toContain('openyida agent-capabilities --summary-json');
    expect(skill).toContain('`openyida agent-capabilities --json` 是 full capabilities');
    expect(skill).toContain('不要把 full capabilities 放进 `fast_build` 默认链路');
    expect(skill).toContain('`workdir` 对应 full capabilities 的 `active.projectRoot`');
    expect(skill).not.toContain('优先跑一次 `openyida agent-capabilities --json`');
  });

  test('yida-app fast_build forbids unbound dataSourceMap by default', () => {
    const skill = readSkill('yida-skills/skills/yida-app/SKILL.md');

    expect(skill).toContain('默认页面源码不得使用 `this.dataSourceMap.*`');
    expect(skill).toContain('`this.utils.yida.searchFormDatas`');
    expect(skill).toContain('发布输出出现 `No custom page data sources to preserve`');
    expect(skill).toContain('`yida-data-source-connectors`');
  });

  test('yida-custom-page fast_build uses compact native defaults and reads references on demand', () => {
    const skill = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');

    expect(skill).toContain('`fast_build` 默认不得生成依赖 dataSourceMap 的代码');
    expect(skill).toContain('不得在 fast_build 里写 `this.dataSourceMap.<name>.load()`');
    expect(skill).toContain('## Available Files');
    expect(skill).toContain('check-page 报错、复杂交互、状态管理问题、`deep_design`');
    expect(skill).not.toContain('编写页面代码前**必须完整阅读**');
    expect(skill).not.toContain('编写任何页面代码前必读');
  });

  test('yida-get-schema documents compact field-map first', () => {
    const skill = readSkill('yida-skills/skills/yida-get-schema/SKILL.md');

    expect(skill).toContain('openyida get-schema <appType> <formUuid> [--summary-json|--field-map-json]');
    expect(skill).toContain('页面开发默认使用 compact 输出');
    expect(skill).toContain('不内联完整 Schema');
  });

  test('yida-publish-page treats missing preserved data sources as incomplete when code uses dataSourceMap', () => {
    const skill = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');

    expect(skill).toContain('源码包含 `this.dataSourceMap.`');
    expect(skill).toContain('`No custom page data sources to preserve`');
    expect(skill).toContain('本次发布不能视为完成');
  });
});
