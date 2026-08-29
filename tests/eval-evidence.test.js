'use strict';

const {
  checkExpectedSkills,
  checkExpectedCommands,
  checkExpectedResources,
  checkForbiddenFindings,
  deriveCommandFindings,
  buildGenerationEvidence,
  evaluateGenerationEvidence,
} = require('../scripts/eval/evidence');

describe('eval generation evidence', () => {
  const commands = [
    { name: 'openyida', args: ['login', '--check-only', '--json'], ok: true, exitCode: 0 },
    { name: 'openyida', args: ['create-app', 'CRM'], ok: true, exitCode: 0 },
    { name: 'openyida', args: ['create-form', 'create', 'APP_X'], ok: true, exitCode: 0 },
  ];

  test('技能 required 影响通过，optional 只记录覆盖', () => {
    const result = checkExpectedSkills(['yida-app'], {
      required: ['yida-app'], optional: ['yida-report'],
    });
    expect(result.pass).toBe(true);
    expect(result.checks.find((check) => check.name === 'skill:yida-report')).toMatchObject({
      ok: false, required: false,
    });
  });

  test('命令支持前缀、参数与次数断言', () => {
    const result = checkExpectedCommands(commands, {
      required: [
        { name: 'login', argsIncludes: ['--check-only'] },
        { name: 'create-form create', minCount: 1 },
      ],
      optional: ['create-report'],
    });
    expect(result.pass).toBe(true);
    expect(result.checks.find((check) => check.name === 'command:create-report').required).toBe(false);
  });

  test('资源支持类型、名称与最小数量', () => {
    const result = checkExpectedResources([
      { type: 'form', name: '线索' },
      { type: 'form', name: '客户' },
      { type: 'page', name: 'CRM 首页' },
    ], {
      required: [{ type: 'form', minCount: 2 }, { type: 'page', nameIncludes: 'CRM' }],
    });
    expect(result.pass).toBe(true);
  });

  test('资源支持 exactCount 与 maxCount', () => {
    const resources = [
      { type: 'report', name: 'A' },
      { type: 'report', name: 'B' },
    ];
    const exact = checkExpectedResources(resources, {
      required: [{ type: 'report', exactCount: 19, requirementId: 'PRD-REPORTS' }],
    });
    expect(exact.pass).toBe(false);
    expect(exact.checks[0]).toMatchObject({
      minCount: 19,
      maxCount: 19,
      actualCount: 2,
      kind: 'resource',
      detail: '期望 =19，实际 2',
    });

    const bounded = checkExpectedResources(resources, {
      required: [{ type: 'report', minCount: 1, maxCount: 2 }],
    });
    expect(bounded.pass).toBe(true);
  });

  test('资源支持报表、权限、状态和公开路径质量元数据', () => {
    const actual = [
      {
        type: 'report', name: '经营报表', schemaVersion: 'V5', componentCount: 7,
        chartCount: 3, unknownCubeCount: 0,
      },
      { type: 'permission', name: '客户', packageCount: 2 },
      { type: 'sample-data', name: '客户', instanceCount: 2 },
      { type: 'integration', name: '通知', status: 'y' },
      { type: 'page-config', name: '工作台', openUrl: '/o/crm' },
    ];
    const result = checkExpectedResources(actual, { required: [
      { type: 'report', schemaVersion: 'V5', minComponentCount: 7, minChartCount: 3, maxUnknownCubeCount: 0 },
      { type: 'permission', minPackageCount: 2 },
      { type: 'sample-data', minInstanceCount: 1 },
      { type: 'integration', status: 'y' },
      { type: 'page-config', openUrl: '/o/crm' },
    ] });
    expect(result.pass).toBe(true);
    expect(result.checks.every((check) => check.ok)).toBe(true);
  });

  test('禁止项只要命中即失败', () => {
    const result = checkForbiddenFindings(
      [{ code: 'resource-before-login-check' }],
      ['resource-before-login-check', 'protected-resource-referenced'],
    );
    expect(result.pass).toBe(false);
    expect(result.checks[0].ok).toBe(false);
    expect(result.checks[1].ok).toBe(true);
  });

  test('命令轨迹派生登录护栏和受保护资源 findings', () => {
    const findings = deriveCommandFindings([
      { args: ['create-app', 'CRM'], ok: true },
      { args: ['list-forms', 'APP_REFERENCE'], ok: true },
    ], { protectedResourceIds: ['APP_REFERENCE'] });
    expect(findings.map((item) => item.code)).toEqual(expect.arrayContaining([
      'resource-before-login-check', 'protected-resource-referenced',
    ]));
  });

  test('build evidence 不采信 agent 自报 commands，使用 harness trace', () => {
    const evidence = buildGenerationEvidence({
      result: {
        targets: [{ type: 'page', stage: 'page', url: 'https://x/p' }],
        evidence: {
          skills: ['yida-app'],
          commands: [{ args: ['fake-command'], ok: true }],
          resources: [{ type: 'app', name: 'CRM', id: 'APP_X' }],
        },
      },
      agentResult: { commandTrace: commands },
    });
    expect(evidence.commands).toEqual(commands);
    expect(evidence.resources.map((item) => item.type)).toEqual(expect.arrayContaining(['app', 'page']));
    expect(evidence.sources).toEqual(expect.arrayContaining(['agent-report', 'harness-cli-trace']));
  });

  test('platform readback 对同类型资源计数优先于 agent 自报和 generation target', () => {
    const evidence = buildGenerationEvidence({
      result: {
        targets: [{ type: 'page', url: 'https://x/APP_X/workbench/FORM_PAGE' }],
        evidence: {
          resources: [
            { type: 'form', id: 'FORM_PAGE', name: 'CRM工作台' },
            { type: 'page', id: 'FORM_OTHER', name: 'Agent only page' },
          ],
        },
      },
      extraEvidence: {
        resources: [
          { type: 'page', id: 'FORM_PAGE', name: 'CRM工作台', source: 'platform-readback' },
        ],
        sources: ['platform-readback'],
      },
    });
    expect(evidence.resources).toEqual([
      { type: 'page', id: 'FORM_PAGE', name: 'CRM工作台', source: 'platform-readback' },
    ]);
  });

  test('统一 evidence 断言形成 pass/fail', () => {
    const scenario = {
      expectedSkills: ['yida-app'],
      expectedCommands: ['create-app'],
      expectedResources: [{ type: 'form', minCount: 2 }],
      forbiddenFindings: ['resource-before-login-check'],
    };
    const result = evaluateGenerationEvidence(scenario, {
      skills: ['yida-app'], commands, resources: [{ type: 'form' }], findings: [],
    });
    expect(result.pass).toBe(false);
    expect(result.checks.find((check) => check.name === 'resource:form').ok).toBe(false);
  });

  test('mergeEvidence merges before/after schema snapshots', () => {
    const { mergeEvidence } = require('../scripts/eval/evidence');
    expect(mergeEvidence(
      { schemaSnapshots: { before: { a: 1 } } },
      { schemaSnapshots: { after: { a: 2 } } },
    ).schemaSnapshots).toEqual({ before: { a: 1 }, after: { a: 2 } });
  });
});
