'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { buildCommandManifest } = require('../lib/core/command-manifest');
const { parseArgs } = require('../lib/solution-template/solution-template');
const index = require('../yida-skills/skills-index.json');
const scenarios = require('../scripts/eval/scenarios/routing-solution-template-explicit.json');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const skill = read('yida-skills/skills/yida-solution-template/SKILL.md');
const entry = buildCommandManifest().commands.find(command => command.id === 'solution-template');
const tokens = text => (text.match(/'[^']*'|"[^"]*"|\S+/g) || [])
  .map(token => token.replace(/^(['"])(.*)\1$/, '$2'));

describe('solution template explicit intent and contract boundaries', () => {
  test('discovery metadata matches the explicit-only Skill and avoids a generic app-template alias', () => {
    const metadata = index.skills.find(item => item.name === 'yida-solution-template');
    expect(metadata.description).toBe(yaml.load(skill.split('---')[1]).description);
    expect(metadata.description).toContain('仅供独立本地 Agent');
    expect(metadata.description).toContain('用户明确要求');
    expect(metadata.aliases).not.toContain('应用模板');
    expect(metadata.command_ids).toEqual(['solution-template']);
    expect(metadata.negative_signals).toContain('普通应用创建');
    expect(metadata.negative_signals).toContain('只引用模板或提供链接而未要求操作');
    expect(metadata.negative_signals).toContain('云端原生模板AI搭');
  });

  test('root routing and template workflow preserve ordinary creation and operation-specific consent', () => {
    const routing = read('yida-skills/SKILL.md');
    expect(routing).toContain('普通应用创建继续走 `yida-app`');
    expect(routing).toContain('不默认搜索、推荐或启用方案模板');
    expect(routing).toContain('启用、拒绝后的重试及另建一份分别需要用户明确授权');
    expect(skill).toContain('仅查询就止于查询');
    expect(skill).toContain('用户明确要求启用或复制所选方案模板');
    expect(skill).toContain('普通建应用授权、查询请求或模板详情中的复制源不代替启用授权');
    expect(skill).toContain('本地命令只准备链接');
    expect(skill).toContain('在当前绑定应用内继续搭建');
    expect(routing).toContain('云端平台已注入模板参考 PRD');
    expect(skill).not.toContain('用户允许创建应用且名称已明确时');
    expect(read('yida-skills/skills/yida-app/SKILL.md')).not.toContain('solution-template');
  });

  test('manifest retains platform rights, read-only discovery and an explicit enable permission gate', () => {
    expect(entry.permission.ask_actions).toEqual(['enable']);
    expect(entry.permission.read_actions).toEqual(['search', 'detail', 'prepare', 'ai-build', 'status']);
    expect(entry.side_effect.mutating_actions).toEqual(['enable']);
    expect(entry.managed_run.scope).toBe('denied');
    expect(entry.notes.join(' ')).toContain('Ordinary app creation stays with yida-app');
    expect(entry.notes.join(' ')).toContain('each require explicit user authorization');
    expect(entry.notes.join(' ')).toContain('Permissions and entitlements are decided exclusively by the platform');
    expect(entry.notes.join(' ')).toContain('Independent local agents only');
    expect(entry.notes.join(' ')).toContain('before auth, HTTP or receipt writes');
  });

  test('all six manifest actions and documented examples remain accepted by the current CLI parser', () => {
    expect(entry.args.find(arg => arg.name === 'action').choices)
      .toEqual(['search', 'detail', 'prepare', 'ai-build', 'enable', 'status']);
    const skillExamples = [...skill.matchAll(/^openyida solution-template (.+)$/gm)].map(match => match[1]);
    expect(skillExamples).toHaveLength(7);
    for (const example of [...skillExamples, ...entry.examples.map(text => text.replace(/^openyida solution-template /, ''))]) {
      expect(() => parseArgs(tokens(example))).not.toThrow();
    }
  });

  test('routing evaluation includes explicit operations and ordinary app non-trigger cases', () => {
    expect(new Set(scenarios.map(item => item.id)).size).toBe(scenarios.length);
    expect(scenarios.filter(item => item.expectedSkill === 'yida-solution-template')).toHaveLength(4);
    const ordinary = scenarios.filter(item => item.expectedSkill === 'yida-app');
    expect(ordinary).toHaveLength(9);
    for (const scenario of ordinary) {
      expect(scenario.mustNotTrigger).toContain('yida-solution-template');
      expect(scenario.forbiddenDefaultSkills).toContain('yida-solution-template');
    }
  });
});
