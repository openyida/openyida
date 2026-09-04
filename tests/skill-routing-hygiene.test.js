'use strict';

const fs = require('fs');
const path = require('path');

const RETIRED_ARCHITECTURE_PATTERN = new RegExp([
  'Direct' + '-plus',
  'direct' + '/standalone',
  'schema' + '-managed',
  ['Schema', 'as', 'Code'].join('-'),
  '\\b' + 'S' + 'AC' + '\\b',
].join('|'));

describe('skill resource boundary copy', () => {
  test.each([
    ['root route', path.join(__dirname, '..', 'yida-skills', 'SKILL.md')],
    ['app route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-app', 'SKILL.md')],
    ['create-app route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-create-app', 'SKILL.md')],
    ['create-form route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-create-form-page', 'SKILL.md')],
    ['create-process route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-create-process', 'SKILL.md')],
    ['process-rule route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-process-rule', 'SKILL.md')],
    ['create-page route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-create-page', 'SKILL.md')],
    ['publish-page route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-publish-page', 'SKILL.md')],
    ['page-config route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-page-config', 'SKILL.md')],
    ['report route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-report', 'SKILL.md')],
    ['integration route', path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-integration', 'SKILL.md')],
  ])('%s does not route through generated bindings', (label, skillPath) => {
    const skill = fs.readFileSync(skillPath, 'utf8');

    expect(label).toBeTruthy();
    expect(skill).not.toMatch(/generated\/bindings\.v1\.json/i);
    expect(skill).not.toMatch(/State\s*\/\s*generated bindings/i);
    expect(skill).not.toMatch(/State\s*,\s*generated bindings/i);
  });

  test('root route delegates full-app workflow without internal architecture terms', () => {
    const root = fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'SKILL.md'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-app', 'SKILL.md'), 'utf8');

    expect(root).toMatch(/意图识别只决定入口，不展开执行细节/);
    expect(root).toMatch(/完整搭建 \/ 补齐加载 `yida-app` 后按其 workflow 执行/);
    expect(root).toMatch(/执行 Step 2 时必须读取 \[资源上下文与补齐判定\]/);
    expect(root).toMatch(/Step 2 必读/);
    expect(root).not.toMatch(/默认使用 `create-app \/ create-form \/ create-page \/ publish`/);
    expect(root).not.toMatch(/resolve_resource_context/);
    expect(root).not.toMatch(/resolve forms\/processes → seed records → reserve main page/);
    expect(root).not.toMatch(/字段级命令内置解析/);
    expect(app).toContain('以下 9 步仅用于内部执行，不复制为宿主待办');
    expect(app).toContain('每一步开始前读取对应 workflow 文件');
    expect(app).toContain('按真实依赖满足下游输入后继续');
    expect(app).toContain('每页只等待自身资源，独立校验并发布');
    expect(root).not.toMatch(RETIRED_ARCHITECTURE_PATTERN);
  });

  test.each([
    'yida-create-app',
    'yida-create-form-page',
    'yida-create-process',
    'yida-process-rule',
    'yida-create-page',
    'yida-publish-page',
  ])('%s keeps ordinary resource-first boundaries', skillName => {
    const skill = fs.readFileSync(path.join(
      __dirname,
      '..',
      'yida-skills',
      'skills',
      skillName,
      'SKILL.md'
    ), 'utf8');

    expect(skill).toMatch(/目标不明时先只读确认或询问用户/);
    expect(skill).not.toMatch(RETIRED_ARCHITECTURE_PATTERN);
    expect(skill).not.toMatch(/generic JIT conflict/);
    expect(skill).not.toMatch(/classification=stale_replanned/);
  });

  test('create-process skill pins the process node DSL used by agents', () => {
    const skill = fs.readFileSync(path.join(
      __dirname,
      '..',
      'yida-skills',
      'skills',
      'yida-create-process',
      'SKILL.md'
    ), 'utf8');

    expect(skill).toMatch(/流程定义最小 DSL 合约/);
    expect(skill).toMatch(/"type": "approval"/);
    expect(skill).toMatch(/不要.*startNode/);
    expect(skill).toMatch(/不要.*endNode/);
    expect(skill).toMatch(/不要.*approve/);
    expect(skill).toMatch(/改成 `approval`/);
    expect(skill).toMatch(/自动生成发起节点/);
    expect(skill).toMatch(/自动生成结束节点/);
  });

  test('create-app skill does not teach agents to pass unsupported json flag', () => {
    const skill = fs.readFileSync(path.join(
      __dirname,
      '..',
      'yida-skills',
      'skills',
      'yida-create-app',
      'SKILL.md'
    ), 'utf8');

    expect(skill).toMatch(/不支持 `--json`/);
    expect(skill).toMatch(/不要添加 `--json`/);
    expect(skill).toMatch(/命令本身会输出一行 JSON/);
  });
});
