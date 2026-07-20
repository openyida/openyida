'use strict';

const fs = require('fs');
const path = require('path');
const { extractJsonObject, runAgent } = require('../scripts/eval/agent');
const {
  normalizeSkill,
  buildRoutingPrompt,
  evaluateScenario,
  summarize,
  runRoutingEval,
} = require('../scripts/eval/routing');
const {
  autoScoreScreenshots,
  buildHumanScores,
  buildScorePrompt,
  renderScoringMarkdown,
  toMarkdownPath,
} = require('../scripts/eval/score');

describe('eval agent.extractJsonObject', () => {
  test('从带围栏/前后缀文本中抽取 JSON', () => {
    expect(extractJsonObject('前缀 ```json\n{"skill":"yida-report"}\n``` 后缀')).toEqual({ skill: 'yida-report' });
    expect(extractJsonObject('结果是 {"a":1,"b":{"c":2}} 完')).toEqual({ a: 1, b: { c: 2 } });
    expect(extractJsonObject('没有 json')).toBeNull();
  });

  test('runAgent 在缺少 prompt 时返回 ok=false', () => {
    const r = runAgent({ prompt: '', spawn: () => ({ status: 0, stdout: '{}' }) });
    expect(r.ok).toBe(false);
  });

  test('runAgent 解析 claude -p 信封并提取内层 JSON', () => {
    const fakeSpawn = () => ({
      status: 0,
      stdout: JSON.stringify({ type: 'result', result: '{"skill":"yida-dashboard","reason":"看板"}' }),
    });
    const r = runAgent({ prompt: 'x', spawn: fakeSpawn });
    expect(r.ok).toBe(true);
    expect(r.json).toEqual({ skill: 'yida-dashboard', reason: '看板' });
  });

  test('runAgent 把 is_error 信封（如未登录）判为调用失败', () => {
    const fakeSpawn = () => ({
      status: 0, // CLI 退出码可能为 0，但信封标记 is_error
      stdout: JSON.stringify({ type: 'result', is_error: true, result: 'Not logged in · Please run /login' }),
    });
    const r = runAgent({ prompt: 'x', spawn: fakeSpawn });
    expect(r.ok).toBe(false);
    expect(r.json).toBeNull();
    expect(r.error).toMatch(/agent-error/);
    expect(r.error).toMatch(/Not logged in/);
  });
});

describe('eval routing', () => {
  test('Phase 1 routing fixture contract covers SAC ownership, replacement plans, legacy, and deferred resources', () => {
    const fixturePath = path.join(__dirname, '..', 'scripts', 'eval', 'scenarios', 'routing-core.json');
    const scenarios = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const phaseOne = Object.fromEntries(
      scenarios.filter((scenario) => scenario.id.startsWith('schema-phase1-'))
        .map((scenario) => [scenario.id, scenario])
    );

    expect(Object.keys(phaseOne).sort()).toEqual([
      'schema-phase1-automation-deferred',
      'schema-phase1-delete-pull-deferred',
      'schema-phase1-explicit-manifest',
      'schema-phase1-page-config-deferred',
      'schema-phase1-report-deferred',
      'schema-phase1-stale-replanned',
      'schema-phase1-standalone-integration-legacy',
      'schema-phase1-standalone-legacy',
      'schema-phase1-standalone-page-config-legacy',
      'schema-phase1-standalone-report-legacy',
      'schema-phase1-state-owned-form',
    ]);
    expect(phaseOne['schema-phase1-explicit-manifest'].expectedSkill).toBe('yida-app');
    expect(phaseOne['schema-phase1-state-owned-form'].expectedSkill).toBe('yida-create-form-page');
    expect(phaseOne['schema-phase1-stale-replanned'].note).toMatch(/不自动 apply/);
    expect(phaseOne['schema-phase1-standalone-legacy'].expectedSkill).toBe('yida-publish-page');
    expect(phaseOne['schema-phase1-report-deferred'].note).toMatch(/禁止 fallback/);
    expect(phaseOne['schema-phase1-automation-deferred'].note).toMatch(/禁止 fallback/);
    expect(phaseOne['schema-phase1-page-config-deferred'].note).toMatch(/不伪造 Manifest/);
    expect(phaseOne['schema-phase1-delete-pull-deferred'].note).toMatch(/无 live routing target/);
    expect(phaseOne['schema-phase1-standalone-report-legacy'].expectedSkill).toBe('yida-report');
    expect(phaseOne['schema-phase1-standalone-integration-legacy'].expectedSkill).toBe('yida-integration');
    expect(phaseOne['schema-phase1-standalone-page-config-legacy'].expectedSkill).toBe('yida-page-config');

    const rootSkill = fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'SKILL.md'), 'utf8');
    const appSkill = fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-app', 'SKILL.md'), 'utf8');
    const guide = fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'references', 'schema-as-code-phase1.md'), 'utf8');
    for (const document of [rootSkill, appSkill, guide]) {
      expect(document).toMatch(/planId/);
      expect(document).toMatch(/显式批准/);
      expect(document).toMatch(/绝不自动 apply|不能授予.*write|不能授予 `mixed\/write`/);
      expect(document).toMatch(/report/);
      expect(document).toMatch(/automation/);
      expect(document).toMatch(/page config|page-config/);
    }
    expect(guide).toMatch(/先在 workspace 内创建或替换 companion source/);
    expect(guide).toMatch(/nextAction.*只用于错误恢复或业务取舍/);
    expect(guide).toMatch(/正常结果不触发错误恢复型.*ask_human/);
    expect(guide).toMatch(/plan 完成后都必须独立暂停/);

    const directSkills = {
      report: fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-report', 'SKILL.md'), 'utf8'),
      integration: fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-integration', 'SKILL.md'), 'utf8'),
      pageConfig: fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-page-config', 'SKILL.md'), 'utf8'),
    };
    for (const skill of Object.values(directSkills)) {
      expect(skill).toMatch(/SAC.*Phase 1|Phase 1.*SAC/);
      expect(skill).toMatch(/standalone\/unmanaged/);
      expect(skill).toMatch(/不得.*降级|不执行/);
    }
  });

  test('normalizeSkill 去斜杠/大小写', () => {
    expect(normalizeSkill('/Yida-Dashboard')).toBe('yida-dashboard');
  });

  test('buildRoutingPrompt 嵌入请求与子技能名', () => {
    const p = buildRoutingPrompt({
      request: '做个看板',
      routingContext: 'ROUTING-DOC',
      skillNames: ['yida-dashboard', 'yida-report'],
    });
    expect(p).toContain('ROUTING-DOC');
    expect(p).toContain('做个看板');
    expect(p).toContain('yida-dashboard');
    expect(p).toContain('mode');
    expect(p).toContain('defaultLoadSkills');
  });

  test('evaluateScenario 命中判定', () => {
    const fakeAgent = () => ({ available: true, json: { skill: 'yida-report', reason: 'r' } });
    const r = evaluateScenario({
      scenario: { id: 's1', prompt: '统计报表', expectedSkill: 'yida-report' },
      routingContext: 'doc',
      skillNames: ['yida-report'],
      runAgent: fakeAgent,
    });
    expect(r.hit).toBe(true);
    expect(r.status).toBe('ok');
  });

  test('evaluateScenario 校验默认建访客系统走 yida-app fast_build 且不默认加载可选技能', () => {
    const scenario = {
      id: 'visitor-fast-build',
      prompt: '帮我搭建一个访客系统，按默认方案搭建，不要追问，直接创建',
      expectedSkill: 'yida-app',
      expectedMode: 'fast_build',
      forbiddenDefaultSkills: [
        'yida-page-uiux',
        'yida-canvas-custom-page',
        'yida-data-source-connectors',
        'yida-data-management',
        'yida-nav-group',
      ],
    };
    const fakeAgent = () => ({
      available: true,
      json: {
        skill: 'yida-app',
        mode: 'fast_build',
        defaultLoadSkills: [
          'yida-app',
          'yida-create-app',
          'yida-create-form-page',
          'yida-create-page',
          'yida-custom-page',
          'yida-publish-page',
        ],
        reason: '默认方案直接创建',
      },
    });
    const r = evaluateScenario({
      scenario,
      routingContext: 'doc',
      skillNames: ['yida-app', 'yida-page-uiux', 'yida-data-source-connectors'],
      runAgent: fakeAgent,
    });

    expect(r.hit).toBe(true);
    expect(r.modeHit).toBe(true);
    expect(r.defaultLoadSkills).toContain('yida-app');
    expect(r.forbiddenDefaultSkillHits).toEqual([]);
  });

  test('evaluateScenario 允许 fast_build 默认加载 Canvas，但加载 UIUX / 数据源判为未命中', () => {
    const fakeAgent = () => ({
      available: true,
      json: {
        skill: 'yida-app',
        mode: 'fast_build',
        defaultLoadSkills: ['yida-app', 'yida-page-uiux', 'yida-canvas-custom-page', 'yida-data-source-connectors'],
      },
    });
    const r = evaluateScenario({
      scenario: {
        id: 'visitor-fast-build',
        prompt: '帮我搭建一个访客系统，按默认方案搭建，不要追问，直接创建',
        expectedSkill: 'yida-app',
        expectedMode: 'fast_build',
        forbiddenDefaultSkills: ['yida-page-uiux', 'yida-data-source-connectors'],
      },
      routingContext: 'doc',
      skillNames: ['yida-app', 'yida-page-uiux', 'yida-data-source-connectors'],
      runAgent: fakeAgent,
    });

    expect(r.hit).toBe(false);
    expect(r.forbiddenDefaultSkillHits).toEqual(['yida-page-uiux', 'yida-data-source-connectors']);
  });

  test('evaluateScenario 未命中与 agent 不可用', () => {
    const miss = evaluateScenario({
      scenario: { id: 's2', prompt: 'x', expectedSkill: 'yida-report' },
      routingContext: 'doc',
      skillNames: ['yida-report', 'yida-chart'],
      runAgent: () => ({ available: true, json: { skill: 'yida-chart' } }),
    });
    expect(miss.hit).toBe(false);

    const unavailable = evaluateScenario({
      scenario: { id: 's3', prompt: 'x', expectedSkill: 'yida-report' },
      routingContext: 'doc',
      skillNames: ['yida-report'],
      runAgent: () => ({ available: false }),
    });
    expect(unavailable.status).toBe('agent-unavailable');

    const errored = evaluateScenario({
      scenario: { id: 's4', prompt: 'x', expectedSkill: 'yida-report' },
      routingContext: 'doc',
      skillNames: ['yida-report'],
      runAgent: () => ({ available: true, ok: false, json: null, text: 'Not logged in', error: 'agent-error: Not logged in' }),
    });
    expect(errored.status).toBe('agent-error');
    expect(errored.hit).toBeNull();
  });

  test('summarize 计算准确率与混淆对', () => {
    const results = [
      { status: 'ok', hit: true, expected: 'a', actual: 'a' },
      { status: 'ok', hit: false, expected: 'a', actual: 'b' },
      { status: 'ok', hit: false, expected: 'a', actual: 'b' },
      { status: 'agent-unavailable' },
    ];
    const s = summarize(results);
    expect(s.evaluated).toBe(3);
    expect(s.hits).toBe(1);
    expect(s.accuracy).toBeCloseTo(0.3333, 3);
    expect(s.confusion[0]).toEqual({ pair: 'a → b', count: 2 });
  });

  test('runRoutingEval 端到端（注入 agent，无真实调用）', () => {
    const scenarios = [
      { id: '1', prompt: '看板', expectedSkill: 'yida-dashboard' },
      { id: '2', prompt: '报表', expectedSkill: 'yida-report' },
    ];
    const answers = { 看板: 'yida-dashboard', 报表: 'yida-chart' };
    const fakeAgent = ({ prompt }) => {
      const key = Object.keys(answers).find((k) => prompt.includes(`「${k}`) || prompt.includes(k));
      return { available: true, json: { skill: answers[key] } };
    };
    const outcome = runRoutingEval({
      scenarios,
      routingContext: 'doc',
      skillNames: ['yida-dashboard', 'yida-report', 'yida-chart'],
      runAgent: fakeAgent,
    });
    expect(outcome.summary.total).toBe(2);
    expect(outcome.summary.hits).toBe(1);
  });
});

describe('eval score', () => {
  test('buildScorePrompt 含截图路径与维度', () => {
    const p = buildScorePrompt({ screenshotPath: '/tmp/a.png', url: 'u', stage: 'dashboard' });
    expect(p).toContain('/tmp/a.png');
    expect(p).toContain('layout');
  });

  test('autoScoreScreenshots 用注入 agent 打分', () => {
    // 隔离 ambient OPENYIDA_EVAL_AGENT_CMD，确定性断言默认 agent（不受控制台/CI 启动环境影响）
    const saved = process.env.OPENYIDA_EVAL_AGENT_CMD;
    delete process.env.OPENYIDA_EVAL_AGENT_CMD;
    try {
      const shots = [{ stage: 'dashboard', url: 'u', ok: true, path: '/tmp/a.png' }];
      const fakeAgent = () => ({ available: true, json: { overall: 8, comment: '不错' } });
      const { available, scores } = autoScoreScreenshots({ screenshots: shots, runAgent: fakeAgent });
      expect(available).toBe(true);
      expect(scores[0].auto.overall).toBe(8);
      expect(scores[0].auto.model).toBe('claude -p');
    } finally {
      if (saved === undefined) { delete process.env.OPENYIDA_EVAL_AGENT_CMD; } else { process.env.OPENYIDA_EVAL_AGENT_CMD = saved; }
    }
  });

  test('autoScoreScreenshots 在 agent 不可用时降级', () => {
    const shots = [{ stage: 'dashboard', ok: true, path: '/tmp/a.png' }];
    const { available, scores } = autoScoreScreenshots({
      screenshots: shots,
      runAgent: () => ({ available: false }),
    });
    expect(available).toBe(false);
    expect(scores[0].auto).toBeNull();
  });

  test('buildHumanScores 生成占位项', () => {
    const scores = buildHumanScores([{ stage: 'dashboard', url: 'u', ok: true, path: '/tmp/a.png' }]);
    expect(scores[0].auto).toBeNull();
    expect(scores[0].human).toBeNull();
  });

  test('renderScoringMarkdown 内嵌截图相对路径与空白评分项', () => {
    const md = renderScoringMarkdown({
      config: { skill: 'yida-dashboard', resolvedStages: 'dashboard' },
      scores: [{ stage: 'dashboard', url: 'https://x/p', screenshot: '/work/eval-screenshots/a.png', auto: null, human: null }],
      workDir: '/work',
    });
    expect(md).toContain('https://x/p');
    expect(md).toContain('eval-screenshots/a.png');
    expect(md).toContain('人工评分');
  });

  test('toMarkdownPath 在 Windows 路径下输出 Markdown 友好的斜杠', () => {
    expect(toMarkdownPath('C:\\work\\eval-screenshots\\a.png', 'C:\\work')).toBe('eval-screenshots/a.png');
  });
});
