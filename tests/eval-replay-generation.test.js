'use strict';

const {
  parseArgs,
  recoverGenerationResult,
  replayGeneration,
} = require('../scripts/eval/replay-generation');

describe('eval generation replay', () => {
  test('parseArgs 默认把历史 trace 视为 partial', () => {
    expect(parseArgs(['--report', 'old.json', '--scenario=scenario.json', '--app-type', 'APP_X']))
      .toMatchObject({
        reportPath: 'old.json', scenarioPath: 'scenario.json', appType: 'APP_X',
        traceCompleteness: 'partial', resultIndex: 0,
      });
  });

  test('recoverGenerationResult 用当前 parser 兼容旧 created 结果合同', () => {
    const raw = JSON.stringify({
      baseUrl: 'https://ding.aliwork.com', appType: 'APP_X',
      created: [{ type: 'display', id: 'PAGE_X', name: '工作台' }],
      skillsUsed: ['yida-app'],
    });
    const result = recoverGenerationResult({ result: { raw }, evidence: { commands: [] } });
    expect(result.targets).toEqual([
      expect.objectContaining({ type: 'page', url: expect.stringContaining('PAGE_X') }),
    ]);
    expect(result.evidence.skills).toEqual(expect.arrayContaining(['yida-app']));
  });

  test('历史失败命令与当前平台资源共同生成诊断 findings', () => {
    const scenario = {
      id: 'crm', prompt: 'build crm',
      expectedCommands: { required: [{ name: 'create-report', minCount: 1 }] },
      expectedResources: { required: [{
        type: 'report', exactCount: 2, requirementId: 'PRD-REPORTS-2',
      }] },
      readback: { enabled: true },
    };
    const archivedResult = {
      id: 'old-crm', status: 'evidence-miss', appType: 'APP_X',
      result: { appType: 'APP_X', targets: [], evidence: {}, raw: '' },
      evidence: {
        skills: [], resources: [],
        commands: [{ args: ['create-report', 'APP_X', '经营报表'], ok: false, exitCode: 1 }],
      },
    };
    const outcome = replayGeneration({
      scenario, archivedResult, appType: 'APP_X', traceCompleteness: 'partial',
      collectEvidence: () => ({
        resources: [{ type: 'report', id: 'REPORT_X', name: '经营报表', source: 'platform-readback' }],
        targets: [{ type: 'report', stage: 'report', url: 'https://x/report' }],
        findings: [], sources: ['platform-readback'],
      }),
    });
    expect(outcome.status).toBe('evidence-miss');
    expect(outcome.replay).toMatchObject({ sourceResultId: 'old-crm', traceCompleteness: 'partial', commandCount: 1 });
    expect(outcome.optimizationFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requirementId: 'PRD-REPORTS-2',
        attribution: expect.objectContaining({ owner: 'cli-or-input-contract' }),
      }),
      expect.objectContaining({
        category: 'diagnostic',
        regression: { assertion: 'finding:command-failed' },
      }),
    ]));
  });
});
