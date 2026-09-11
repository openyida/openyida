'use strict';

const {
  deriveOptimizationFindings,
  buildOptimizationBacklog,
} = require('../scripts/eval/optimization-findings');

describe('eval optimization findings', () => {
  test('平台资源缺失且没有写命令时归因到 skill guidance', () => {
    const scenario = { id: 'crm', expectedResources: [] };
    const evidence = {
      sources: ['platform-readback'],
      resources: [{ type: 'report', name: '现有报表', source: 'platform-readback' }],
      commands: [{ args: ['login', '--check-only'], ok: true }],
    };
    const evidenceChecks = {
      checks: [{
        name: 'resource:report',
        kind: 'resource',
        key: 'report',
        ok: false,
        required: true,
        expectation: { type: 'report', exactCount: 19, requirementId: 'PRD-REPORTS' },
        minCount: 19,
        maxCount: 19,
        actualCount: 1,
        detail: '期望 =19，实际 1',
      }],
    };
    const [finding] = deriveOptimizationFindings({ scenario, evidence, evidenceChecks, status: 'evidence-miss' });
    expect(finding).toMatchObject({
      requirementId: 'PRD-REPORTS',
      severity: 'P1',
      status: 'confirmed',
      attribution: { owner: 'skill-guidance', confidence: 'high' },
      actual: { count: 1 },
      targets: {
        skills: expect.arrayContaining(['yida-report']),
        commands: expect.arrayContaining(['openyida create-report', 'openyida report inspect']),
        files: expect.arrayContaining(['lib/report/create-report.js']),
      },
    });
  });

  test('成功写命令数量足够但平台回读不足时标记 false-success 候选而非 confirmed 根因', () => {
    const evidence = {
      sources: ['platform-readback', 'harness-cli-trace'],
      resources: [],
      commands: [
        { args: ['create-report', 'APP_X'], ok: true, exitCode: 0 },
        { args: ['create-report', 'APP_X'], ok: true, exitCode: 0 },
      ],
    };
    const evidenceChecks = { checks: [{
      name: 'resource:report', kind: 'resource', key: 'report', ok: false, required: true,
      expectation: { type: 'report', exactCount: 2 }, minCount: 2, maxCount: 2, actualCount: 0,
    }] };
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' }, evidence, evidenceChecks, status: 'evidence-miss',
    });
    expect(finding.attribution).toMatchObject({ owner: 'cli-false-success', confidence: 'medium' });
    expect(finding.status).toBe('confirmed');
  });

  test('失败命令只归因到 CLI 或输入契约候选', () => {
    const evidence = {
      sources: ['harness-cli-trace'],
      commands: [{ args: ['integration', 'create', 'APP_X'], ok: false, exitCode: 1 }],
    };
    const evidenceChecks = { checks: [{
      name: 'command:integration create', kind: 'command', key: 'integration create',
      ok: false, required: true, expectation: { name: 'integration create' }, actualCount: 0,
    }] };
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' }, evidence, evidenceChecks, status: 'evidence-miss',
    });
    expect(finding.attribution).toMatchObject({
      owner: 'cli-or-input-contract', confidence: 'medium',
    });
    expect(finding.status).toBe('inferred');
  });

  test('optional 断言缺失不会进入优化 backlog', () => {
    const findings = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidenceChecks: { checks: [{ name: 'skill:yida-chart', ok: false, required: false }] },
      status: 'ok',
    });
    expect(findings).toEqual([]);
  });

  test('命令失败证据即使未单独声明 forbidden 也进入诊断 backlog', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: { findings: [{
        code: 'command-failed', detail: 'create-report APP_X exited 1', source: 'harness-cli-trace',
      }] },
      status: 'evidence-miss',
    });
    expect(finding).toMatchObject({
      category: 'diagnostic',
      status: 'inferred',
      severity: 'P1',
      attribution: { owner: 'cli-or-input-contract', confidence: 'medium' },
      regression: { assertion: 'finding:command-failed' },
    });
  });

  test('--help 失败归因 CLI discoverability 并降为 P2', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: { findings: [{ code: 'command-failed', detail: 'get-schema --help exited 1' }] },
      status: 'evidence-miss',
    });
    expect(finding).toMatchObject({
      severity: 'P2', status: 'confirmed',
      attribution: { owner: 'cli-discoverability', confidence: 'high' },
    });
  });

  test('失败后同命令族成功优先归因 agent 参数规划', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: {
        commands: [{ args: ['get-schema', 'APP_X', 'FORM_X'], ok: true }],
        findings: [{ code: 'command-failed', detail: 'get-schema FORM_X APP_X exited 1' }],
      },
      status: 'evidence-miss',
    });
    expect(finding).toMatchObject({
      severity: 'P2', status: 'inferred',
      attribution: { owner: 'agent-command-planning', confidence: 'high' },
    });
  });

  test('平台回读失败保持 unknown，不误判成 CLI 产品 bug', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: { findings: [{ code: 'platform-readback-failed', detail: 'integration list: timeout' }] },
      status: 'evidence-miss',
    });
    expect(finding).toMatchObject({
      status: 'unknown',
      attribution: { owner: 'eval-readback', confidence: 'low' },
    });
  });

  test('partial replay 不把未观察到的命令误判成 skill 遗漏', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm', diagnostics: { mode: 'replay', traceCompleteness: 'partial' } },
      evidence: { sources: ['platform-readback'], commands: [] },
      evidenceChecks: { checks: [{
        name: 'command:integration create', kind: 'command', key: 'integration create',
        ok: false, required: true, expectation: { name: 'integration create', minCount: 18 },
        minCount: 18, actualCount: 6,
      }] },
      status: 'evidence-miss',
    });
    expect(finding.attribution).toMatchObject({ owner: 'unattributed', confidence: 'low' });
  });

  test('named resource 只使用含资源名的命令做 false-success 相关性判断', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: {
        sources: ['platform-readback'],
        commands: [{ args: ['create-report', 'APP_X', '其他报表'], ok: true }],
      },
      evidenceChecks: { checks: [{
        name: 'resource:目标报表', kind: 'resource', key: '目标报表', ok: false, required: true,
        expectation: { type: 'report', name: '目标报表' }, minCount: 1, actualCount: 0,
      }] },
      status: 'evidence-miss',
    });
    expect(finding.attribution.owner).toBe('skill-guidance');
  });

  test('完全缺少 skills 证据时归因生成结果契约而非武断判断路由错误', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: { skills: [] },
      evidenceChecks: { checks: [{
        name: 'skill:yida-app', kind: 'skill', key: 'yida-app', ok: false, required: true,
        expectation: { name: 'yida-app' },
      }] },
      status: 'evidence-miss',
    });
    expect(finding.attribution).toMatchObject({ owner: 'agent-output-contract', confidence: 'high' });
  });

  test('forbidden finding 已由验收断言覆盖时不重复生成诊断项', () => {
    const findings = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: { findings: [{ code: 'resource-before-login-check', detail: 'bad order' }] },
      evidenceChecks: { checks: [{
        name: 'forbidden:resource-before-login-check', kind: 'forbidden-finding',
        key: 'resource-before-login-check', ok: false, required: true,
        expectation: { code: 'resource-before-login-check' },
      }] },
      status: 'evidence-miss',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: 'acceptance', attribution: { owner: 'safety' } });
  });

  test('只读审计确认差异但保持责任层未归因', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'audit', diagnostics: { mode: 'audit' } },
      evidence: { sources: ['platform-readback'], resources: [] },
      evidenceChecks: { checks: [{
        name: 'resource:integration', kind: 'resource', key: 'integration',
        ok: false, required: true, expectation: { type: 'integration', exactCount: 18 },
        minCount: 18, maxCount: 18, actualCount: 6,
      }] },
      status: 'evidence-miss',
    });
    expect(finding.status).toBe('confirmed');
    expect(finding.attribution).toMatchObject({ owner: 'unattributed', confidence: 'low' });
  });

  test('平台回读确认种子数据不足时归因 test-data', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: {
        sources: ['platform-readback'],
        resources: [{ type: 'sample-data', name: '合同订单', instanceCount: 0, source: 'platform-readback' }],
      },
      evidenceChecks: { checks: [{
        name: 'resource:合同订单', kind: 'resource', key: '合同订单',
        ok: false, required: true,
        expectation: { type: 'sample-data', name: '合同订单', minInstanceCount: 1 },
        minCount: 1, maxCount: null, actualCount: 0,
      }] },
      status: 'evidence-miss',
    });
    expect(finding).toMatchObject({
      status: 'confirmed',
      attribution: { owner: 'test-data', confidence: 'high' },
      scope: 'application-gap',
      affected: {
        skills: expect.arrayContaining(['yida-app', 'yida-data-management']),
        commands: expect.arrayContaining(['openyida data create form', 'openyida data query form']),
        files: expect.arrayContaining(['yida-skills/skills/yida-app/workflow/step-5-seed-records.md']),
      },
      targets: { skills: [], commands: [], files: [] },
    });
  });

  test('运行失败和断言失败可汇总责任层与严重度', () => {
    const runtime = deriveOptimizationFindings({
      scenario: { id: 'crm' }, status: 'agent-error', error: 'ETIMEDOUT',
    });
    const backlog = buildOptimizationBacklog([{ optimizationFindings: runtime }], {
      generatedAt: '2026-08-28T00:00:00.000Z',
    });
    expect(backlog.summary).toEqual({
      total: 1,
      bySeverity: { P1: 1 },
      byOwner: { 'agent-runtime': 1 },
      byStatus: { confirmed: 1 },
      byScope: { 'openyida-optimization': 1 },
      bySkill: {},
      byCommand: {},
      actionable: 1,
      groupCount: 1,
    });
    expect(backlog.findings[0].actual.error).toBe('ETIMEDOUT');
  });

  test('历史 page-sharing gap 被当前权威回读标为 resolved', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: {
        resources: [{ type: 'page-config', id: 'PAGE_X', source: 'platform-readback' }],
        findings: [{ code: 'capability-gap:page-sharing', detail: 'old gap', source: 'agent-report' }],
      },
      status: 'evidence-miss',
    });
    expect(finding).toMatchObject({
      status: 'resolved',
      title: '历史能力缺口已解决：page-sharing',
      attribution: { owner: 'cli-capability-gap', confidence: 'high' },
    });
    const backlog = buildOptimizationBacklog([{ optimizationFindings: [finding] }]);
    expect(backlog.summary).toMatchObject({ total: 1, actionable: 0, groupCount: 1 });
  });

  test('历史 capability gap 映射到具体技能和 CLI', () => {
    const findings = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: { findings: [
        { code: 'capability-gap:automation-advanced-branches' },
        { code: 'capability-gap:i18n-english-labels' },
        { code: 'capability-gap:role-based-permissions' },
      ] },
      status: 'evidence-miss',
    });
    expect(findings[0].targets).toMatchObject({
      skills: expect.arrayContaining(['yida-integration']),
      commands: expect.arrayContaining(['openyida integration create']),
    });
    expect(findings[1].targets).toMatchObject({
      skills: expect.arrayContaining(['yida-i18n']),
      commands: expect.arrayContaining(['openyida i18n']),
    });
    expect(findings[2].targets).toMatchObject({
      skills: expect.arrayContaining(['yida-form-permission', 'yida-app-permission']),
      commands: expect.arrayContaining(['openyida save-permission', 'openyida app-permission']),
    });
  });

  test('重复命令失败按命令族聚合，保留完整 findings', () => {
    const findings = deriveOptimizationFindings({
      scenario: { id: 'crm' },
      evidence: { findings: [
        { code: 'command-failed', detail: 'save-permission APP_X FORM_A exited 1' },
        { code: 'command-failed', detail: 'save-permission APP_X FORM_B exited 1' },
        { code: 'command-failed', detail: 'create-report APP_X 报表 exited 1' },
      ] },
      status: 'evidence-miss',
    });
    const backlog = buildOptimizationBacklog([{ optimizationFindings: findings }]);
    expect(backlog.findings).toHaveLength(3);
    expect(backlog.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'save-permission 命令失败', findingCount: 2,
        scope: 'diagnostic',
        affectedSkills: expect.arrayContaining(['yida-form-permission']),
        diagnosticCommands: expect.arrayContaining(['openyida save-permission']),
        targetCommands: [],
      }),
      expect.objectContaining({
        title: 'create-report 命令失败', findingCount: 1,
        scope: 'diagnostic',
        affectedSkills: expect.arrayContaining(['yida-report']),
        diagnosticCommands: expect.arrayContaining(['openyida create-report']),
        targetCommands: [],
      }),
    ]));
  });

  test('partial replay 的 CRM 资源缺口只标受影响能力，不冒充 OpenYida 优化', () => {
    const [finding] = deriveOptimizationFindings({
      scenario: { id: 'crm', diagnostics: { mode: 'replay', traceCompleteness: 'partial' } },
      evidence: { sources: ['platform-readback'], resources: [], commands: [] },
      evidenceChecks: { checks: [{
        name: 'resource:report', kind: 'resource', key: 'report', ok: false, required: true,
        expectation: { type: 'report', exactCount: 19 }, minCount: 19, maxCount: 19, actualCount: 1,
      }] },
      status: 'evidence-miss',
    });
    expect(finding).toMatchObject({
      scope: 'application-gap',
      affected: { skills: expect.arrayContaining(['yida-report']) },
      targets: { skills: [], commands: [], files: [] },
    });
  });
});
