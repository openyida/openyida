'use strict';
const { buildHostAssetCapabilities } = require('../lib/asset/host-capabilities');
const { auditAssetExecution } = require('../lib/asset/asset-execution');
const { evaluatePrdCompleteness } = require('../lib/app/check-prd-completeness');
const at = seconds => new Date(Date.UTC(2026, 8, 16, 7, 0, seconds)).toISOString();
const task = (extra = {}) => ({ taskKey: '/assets/home.json', pageId: 'home', status: 'completed',
  executionMode: 'background_shell', toolName: 'Bash', backgroundOption: 'run_in_background=true',
  hostTaskId: 'real-job', startedAt: at(1), dispatchReturnedAt: at(2), endedAt: at(30), ...extra });
const record = (extra = {}, businessWork = [{ startedAt: at(3), endedAt: at(12) }]) => ({ tasks: [task(extra)], businessWork });

describe('host-adaptive asset execution', () => {
  test.each(['qwenwork', 'codex', 'mulerun'])('%s host name never proves background execution', tool => {
    const caps = buildHostAssetCapabilities({ env: {}, runtime: { tool, runtime: 'desktop_shell' } });
    expect(caps.background_agent.available).toBeNull();
    expect(caps.background_shell.available).toBeNull();
    expect(caps.execution.selected_mode).toBe('host_inventory_required');
  });
  test.each([
    ['0', '1', 'background_shell'], ['1', '1', 'background_agent'], ['0', '0', 'synchronous'],
    ['unexpected', '0', 'host_inventory_required'],
  ])('separates Agent=%s and Bash=%s', (agent, shell, mode) => {
    const caps = buildHostAssetCapabilities({ runtime: { tool: 'qwenwork' }, env: {
      OPENYIDA_AGENT_BACKGROUND_AGENT: agent, OPENYIDA_AGENT_BACKGROUND_SHELL: shell,
    } });
    expect(caps.execution.selected_mode).toBe(mode);
    expect(caps.execution.shell.foregroundWork).toContain('visual_image_review');
  });
  test('accepts recorded nonblocking dispatch and real interval overlap', () => {
    expect(auditAssetExecution(record()).status).toBe('verified');
  });
  test.each([
    [{ dispatchReturnedAt: at(30) }, 'background_dispatch_unproven'],
    [{ hostTaskId: '' }, 'background_dispatch_unproven'],
    [{ backgroundOption: '' }, 'background_dispatch_unproven'],
    [{ endedAt: undefined }, 'asset_interval_incomplete'],
    [{ status: 'running' }, 'asset_interval_incomplete'],
    [{ executionMode: 'Agent' }, 'execution_mode_unknown'],
  ])('flags missing or synchronous dispatch evidence %j', (change, code) => {
    expect(auditAssetExecution(record(change))).toMatchObject({ status: 'needs_review', issues: expect.arrayContaining([expect.objectContaining({ code })]) });
  });
  test.each([[31, 40], [0, 1]])('business interval %i-%i does not prove overlap', (start, end) => {
    const result = auditAssetExecution(record({ claimedParallel: true }, [{ startedAt: at(start), endedAt: at(end) }]));
    expect(result.issues.map(item => item.code)).toEqual(['asset_business_overlap_missing', 'parallel_claim_unproven']);
  });
  test('work finished before background dispatch returns cannot prove main-flow overlap', () => {
    expect(auditAssetExecution(record({ dispatchReturnedAt: at(20) })).issues[0].code).toBe('asset_business_overlap_missing');
  });
  test('synchronous fallback accepts business first, rejects the whole collection before business', () => {
    const change = { executionMode: 'synchronous', fallbackReason: 'Host only supports synchronous tools', hostTaskId: undefined };
    expect(auditAssetExecution(record(change, [{ startedAt: at(0), endedAt: at(1) }])).status).toBe('verified');
    expect(auditAssetExecution(record(change, [{ startedAt: at(30), endedAt: at(40) }])).issues[0].code).toBe('assets_before_business');
    expect(auditAssetExecution(record({ ...change, fallbackReason: '' })).issues[0].code).toBe('synchronous_reason_missing');
  });
  test('no independent work is an explicit exception, never a parallel claim', () => {
    const data = { ...record({}, []), independentWork: 'none', noIndependentWorkReason: 'Only replacing this page image' };
    expect(auditAssetExecution(data).status).toBe('verified');
    data.tasks[0].claimedParallel = true;
    expect(auditAssetExecution(data).issues[0].code).toBe('parallel_claim_unproven');
  });
  test('missing records are not verified and expected task omissions need review', () => {
    expect(auditAssetExecution(undefined).status).toBe('not_checked');
    expect(auditAssetExecution(undefined, [task()]).status).toBe('needs_review');
    expect(auditAssetExecution({ tasks: [], businessWork: [] }, [task()]).issues[0].code).toBe('task_record_missing');
    expect(auditAssetExecution({ tasks: [null], businessWork: [null] }).status).toBe('needs_review');
    expect(auditAssetExecution({ tasks: [task(), task()], businessWork: [] }).issues.map(x => x.code)).toContain('task_identity_invalid');
  });
  test('verified reuse does not invent background timing', () => {
    expect(auditAssetExecution({ tasks: [{ taskKey: 'home', executionMode: 'reused', status: 'completed', reuseEvidence: 'existing final manifest verified' }], businessWork: [] }).status).toBe('verified');
  });
  test('completeness surfaces asset serial execution even when resource readback passes', async () => {
    const result = await evaluatePrdCompleteness('', { appType: 'APP', buildManifest: {
      resources: [{ name: 'Home', type: 'display-page', formUuid: 'FORM' }],
      assetTasks: [task()], assetExecution: record({ dispatchReturnedAt: at(30) }, [{ startedAt: at(31), endedAt: at(40) }]),
    } }, { fetchForms: async () => [{ formUuid: 'FORM', formName: 'Home', formType: 'display' }] });
    expect(result.verdict).toBe('needs_review');
    expect(result.assetExecution.status).toBe('needs_review');
    expect(result.items.map(x => x.id)).toContain('asset_execution_asset_business_overlap_missing');
    expect(result.hardFailures).toEqual([]);
  });
});
