'use strict';

const fs = require('fs');
const path = require('path');

describe('Schema-as-Code skill State authority', () => {
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

  test('root route exposes schema-managed and direct execution paths', () => {
    const root = fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'SKILL.md'), 'utf8');

    expect(root).toMatch(/schema-managed/);
    expect(root).toMatch(/direct\/standalone/);
    expect(root).toMatch(/schema validate/);
    expect(root).toMatch(/schema plan/);
    expect(root).toMatch(/schema apply/);
    expect(root).toMatch(/resolve_resource_context/);
    expect(root).toMatch(/create missing only/);
  });

  test.each([
    'yida-create-app',
    'yida-create-form-page',
    'yida-create-process',
    'yida-process-rule',
    'yida-create-page',
    'yida-publish-page',
  ])('%s keeps SAC routing as a lightweight direct/schema boundary', skillName => {
    const skill = fs.readFileSync(path.join(
      __dirname,
      '..',
      'yida-skills',
      'skills',
      skillName,
      'SKILL.md'
    ), 'utf8');

    expect(skill).toMatch(/direct\/standalone/);
    expect(skill).toMatch(/schema-managed/);
    expect(skill).toMatch(/schema validate → plan → apply/);
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
