'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readSkill(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('OpenYida skill contracts', () => {
  test('agent-facing docs use token auth wording instead of legacy cookie login guidance', () => {
    const docs = [
      'AGENTS.md',
      'README.md',
      'README_zhCN.md',
      'scripts/eval/runner.js',
      'scripts/eval/VERIFY.md',
      'yida-skills/skills/yida-app/SKILL.md',
    ].map(readSkill).join('\n');

    expect(docs).toContain('token session');
    expect(docs).not.toContain('登录宜搭并缓存 Cookie');
    expect(docs).not.toContain('有效 cookie 缓存');
    expect(docs).not.toContain('读取 .cache/cookies.json 中的 corpId');
    expect(docs).not.toContain('lib/auth/login.js');
    expect(docs).not.toContain('lib/auth/qr-login.js');
    expect(docs).not.toContain('lib/auth/codex-login.js');
  });

  test('page command examples keep Code Canvas as the default chain', () => {
    const localeDirs = [
      path.join(ROOT, 'lib', 'core', 'locales'),
      path.join(ROOT, 'locales-extra', 'core'),
    ];
    const localeSource = localeDirs.flatMap((localeDir) => {
      if (!fs.existsSync(localeDir)) { return []; }
      return fs.readdirSync(localeDir)
        .filter((file) => file.endsWith('.js'))
        .map((file) => fs.readFileSync(path.join(localeDir, file), 'utf8'));
    })
      .join('\n');

    expect(localeSource).toContain('openyida compile pages/src/home.canvas.jsx');
    expect(localeSource).toContain('openyida check-page pages/src/home.canvas.jsx');
    expect(localeSource).toContain('openyida generate-page <template> --output pages/src/home.canvas.jsx');
  });

  test('root skill uses compact agent-capabilities for default preflight', () => {
    const skill = readSkill('yida-skills/SKILL.md');

    expect(skill).toContain('openyida agent-capabilities --summary-json');
    expect(skill).toContain('`openyida agent-capabilities --json` 是 full capabilities');
    expect(skill).toContain('不要把 full capabilities 放进 `fast_build` 默认链路');
    expect(skill).toContain('`workdir` 对应 full capabilities 的 `active.projectRoot`');
    expect(skill).not.toContain('优先跑一次 `openyida agent-capabilities --json`');
  });

  test('skills index carries machine routing hints for high-confusion skills', () => {
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((skill) => [skill.name, skill]));

    const form = byName.get('yida-create-form-page');
    expect(form.positive_signals).toEqual(expect.arrayContaining(['新增字段']));
    expect(form.negative_signals).toEqual(expect.arrayContaining(['新增记录']));
    expect(form.command_ids).toEqual(expect.arrayContaining(['create-form.create']));

    const data = byName.get('yida-data-management');
    expect(data.positive_signals).toEqual(expect.arrayContaining(['新增记录']));
    expect(data.negative_signals).toEqual(expect.arrayContaining(['修改表单结构']));

    const canvas = byName.get('yida-canvas-custom-page');
    expect(canvas.negative_signals).toEqual(expect.arrayContaining(['强依赖 this.$']));

    const uiux = byName.get('yida-page-uiux');
    expect(uiux.done_when).toContain('视觉方向');
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

  test('sample visual lessons are codified in page uiux, theme, chart, and report skills', () => {
    const pageUiux = readSkill('yida-skills/skills/yida-page-uiux/SKILL.md');
    const theme = readSkill('yida-skills/skills/yida-theme/SKILL.md');
    const chart = readSkill('yida-skills/skills/yida-chart/SKILL.md');
    const report = readSkill('yida-skills/skills/yida-report/SKILL.md');
    const retrospective = readSkill('yida-skills/references/task-retrospective.md');

    expect(pageUiux).toContain('参考 Dribbble');
    expect(pageUiux).toContain('参考转成可执行选择');
    expect(theme).toContain('`--theme` 预置值与自定义主题边界');
    expect(theme).toContain('官方 sample 主题验收纪律');
    expect(theme).toContain('style#yida-global-theme');
    expect(chart).toContain('已有 chart sample / 跨应用迁移修复流程');
    expect(chart).toContain('getFormNavigationListByOrder');
    expect(chart).toContain('report-binding.json');
    expect(report).toContain('作为 chart sample 数据源的绑定纪律');
    expect(report).toContain('REPORT_xxx');
    expect(retrospective).toContain('Chart sample / 原生报表绑定经验');
    expect(retrospective).toContain('工作台是操作首页，不是 demo 页面');
  });
});
