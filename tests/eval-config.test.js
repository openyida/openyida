'use strict';

const {
  resolveConfig,
  mapSkillToStages,
  expandStages,
  parseArgs,
  buildE2eEnv,
  toBool,
} = require('../scripts/eval/config');

const coverage = {
  'yida-dashboard': { level: 'real-e2e', stages: ['dashboard'] },
  'yida-report': { level: 'real-e2e', stages: ['report'] },
  'yida-logout': { level: 'offline-unit', reason: 'real logout would destroy session' },
  'yida-create-process': { level: 'opt-in-real-e2e', stages: ['process'] },
};

describe('eval config', () => {
  test('toBool 识别常见真假串', () => {
    expect(toBool('1', false)).toBe(true);
    expect(toBool('off', true)).toBe(false);
    expect(toBool(undefined, true)).toBe(true);
    expect(toBool('garbage', false)).toBe(false);
  });

  test('parseArgs 解析 flag 与 --key=value', () => {
    const out = parseArgs(['--mode', 'all', '--skill=yida-report', '--no-screenshot', '--auto-score', 'extra']);
    expect(out.mode).toBe('all');
    expect(out.skill).toBe('yida-report');
    expect(out.screenshot).toBe(false);
    expect(out.autoScore).toBe(true);
    expect(out.rest).toEqual(['extra']);
  });

  test('mapSkillToStages 对 real-e2e 技能返回 stages', () => {
    const m = mapSkillToStages('yida-dashboard', coverage);
    expect(m.ok).toBe(true);
    expect(m.stages).toEqual(['dashboard']);
  });

  test('mapSkillToStages 对非 real-e2e 技能返回 ok=false 与原因', () => {
    const m = mapSkillToStages('yida-logout', coverage);
    expect(m.ok).toBe(false);
    expect(m.reason).toMatch(/logout|offline/i);
  });

  test('mapSkillToStages 对未知技能抛错', () => {
    expect(() => mapSkillToStages('yida-nope', coverage)).toThrow(/未知子技能/);
  });

  test('优先级 CLI > env > file > 默认', () => {
    const config = resolveConfig({
      argv: ['--mode', 'e2e', '--skill', 'yida-report'],
      env: { OPENYIDA_EVAL_MODE: 'routing', OPENYIDA_EVAL_SCREENSHOT: '0' },
      fileConfig: { mode: 'all', screenshot: true, autoScore: true },
      coverage,
    });
    expect(config.mode).toBe('e2e'); // CLI 覆盖 env/file
    expect(config.screenshot).toBe(false); // env 覆盖 file
    expect(config.autoScore).toBe(true); // file 覆盖默认
    // report 自动展开上游依赖 auth,app,form
    expect(config.resolvedStages).toBe('auth,app,form,report');
    expect(config.targetStages).toEqual(['report']);
  });

  test('expandStages 展开上游依赖并按规范顺序排列', () => {
    expect(expandStages(['dashboard'])).toEqual(['auth', 'app', 'dashboard']);
    expect(expandStages(['report'])).toEqual(['auth', 'app', 'form', 'report']);
    expect(expandStages(['data'])).toEqual(['auth', 'app', 'form', 'data']);
    expect(expandStages(['auth'])).toEqual(['auth']);
    // 已含上游时不重复
    expect(expandStages(['app', 'dashboard'])).toEqual(['auth', 'app', 'dashboard']);
  });

  test('skill 反查的 stages 自动展开上游依赖', () => {
    const config = resolveConfig({
      argv: ['--skill', 'yida-dashboard'], env: {}, fileConfig: {}, coverage,
    });
    expect(config.resolvedStages).toBe('auth,app,dashboard');
    expect(config.targetStages).toEqual(['dashboard']);
  });

  test('显式 --stages 优先于 skill 反查', () => {
    const config = resolveConfig({
      argv: ['--skill', 'yida-dashboard', '--stages', 'app,form'],
      env: {},
      fileConfig: {},
      coverage,
    });
    expect(config.resolvedStages).toBe('app,form');
  });

  test('routing 模式不做 skill→stage 反查', () => {
    const config = resolveConfig({
      argv: ['--mode', 'routing', '--skill', 'yida-logout'],
      env: {},
      fileConfig: {},
      coverage,
    });
    expect(config.skillMapping).toBeNull();
    expect(config.resolvedStages).toBeNull();
  });

  test('buildE2eEnv 注入 OPENYIDA_E2E_STAGES（含展开的上游依赖）', () => {
    const config = resolveConfig({ argv: ['--skill', 'yida-report'], env: {}, fileConfig: {}, coverage });
    const env = buildE2eEnv(config, { FOO: 'bar' });
    expect(env.OPENYIDA_E2E_STAGES).toBe('auth,app,form,report');
    expect(env.FOO).toBe('bar');
  });

  test('未知 mode 抛错', () => {
    expect(() => resolveConfig({ argv: ['--mode', 'wat'], env: {}, fileConfig: {}, coverage }))
      .toThrow(/未知 --mode/);
  });

  test('doc-quality 和 coverage 是合法 mode', () => {
    const c1 = resolveConfig({ argv: ['--mode', 'doc-quality'], env: {}, fileConfig: {}, coverage });
    expect(c1.mode).toBe('doc-quality');
    const c2 = resolveConfig({ argv: ['--mode', 'coverage'], env: {}, fileConfig: {}, coverage });
    expect(c2.mode).toBe('coverage');
  });

  test('doc-quality 模式不做 skill→stage 反查', () => {
    const config = resolveConfig({
      argv: ['--mode', 'doc-quality', '--skill', 'yida-dashboard'],
      env: {}, fileConfig: {}, coverage,
    });
    expect(config.skillMapping).toBeNull();
    expect(config.resolvedStages).toBeNull();
  });

  test('agentCommand 默认 claude', () => {
    const config = resolveConfig({ argv: [], env: {}, fileConfig: {}, coverage });
    expect(config.agentCommand).toBe('claude');
  });

  test('--agent-cmd 覆盖默认，且优先级高于 env', () => {
    const config = resolveConfig({
      argv: ['--agent-cmd', 'qodercli'],
      env: { OPENYIDA_EVAL_AGENT_CMD: 'claude' },
      fileConfig: {},
      coverage,
    });
    expect(config.agentCommand).toBe('qodercli');
  });

  test('OPENYIDA_EVAL_AGENT_CMD 环境变量生效', () => {
    const config = resolveConfig({
      argv: [], env: { OPENYIDA_EVAL_AGENT_CMD: 'qodercli' }, fileConfig: {}, coverage,
    });
    expect(config.agentCommand).toBe('qodercli');
  });
});
