'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, execute: executeCommand, defaultRequestId } = require('../lib/solution-template/solution-template');
const { shouldUseStructuredErrorOutput } = require('../lib/core/cli-error');

const TEMPLATE_ID = 'TPL_NH4BHYQIV87DC5KRDY6D';
let root;
let apps;
let client;

function execute(parsed, options) {
  return executeCommand(parsed, { sleep: jest.fn(async () => {}), now: () => 0, ...options });
}

function detailResponse(overrides = {}) {
  return {
    success: true,
    content: {
      appTplUuid: TEMPLATE_ID,
      title: { zh_CN: '合同管理' },
      description: { zh_CN: '合同全生命周期' },
      aiBuildSupported: true,
      latestOnlineAppTpl: { appType: 'APP_SOURCE', version: '1.0.8' },
      ...overrides,
    },
  };
}

function appListResponse() {
  return { success: true, content: { data: apps, totalCount: apps.length } };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'solution-template-'));
  apps = [{ appType: 'APP_OLD', appName: { zh_CN: '已有应用' }, systemLink: '' }];
  client = {
    getAuthRef: () => ({
      baseUrl: 'https://tenant.aliwork.com', corpId: 'corp-1', corpName: '测试组织', userId: 'user-1',
    }),
    get: jest.fn(async (endpoint) => {
      if (endpoint.includes('getAppTplComplexInfo')) { return detailResponse(); }
      if (endpoint.includes('listFormDataByType')) {
        return { success: true, content: { currentPage: 1, totalCount: 1, hasMore: false, data: [{
          appTplUuid: TEMPLATE_ID, templateTitle: '合同管理', description: '说明', author: '宜搭官方', usageNum: 9,
        }] } };
      }
      if (endpoint.includes('getAppList')) { return appListResponse(); }
      throw new Error(`unexpected endpoint ${endpoint}`);
    }),
    postFormOnce: jest.fn(async () => {
      apps.push({ appType: 'APP_CREATED', appName: { zh_CN: '合同管理测试' }, systemLink: '' });
      return { success: true, content: { isSyncCopy: 'y', desAppType: 'APP_CREATED' } };
    }),
  };
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test('parses discovery, AI handoff, direct enable and status without accepting ambiguous flags', () => {
  expect(parseArgs(['search', '--query', '合同', '--page', '2', '--size', '10'])).toMatchObject({ action: 'search' });
  expect(parseArgs(['detail', TEMPLATE_ID])).toMatchObject({ action: 'detail', templateId: TEMPLATE_ID });
  expect(parseArgs(['ai-build', TEMPLATE_ID])).toMatchObject({ action: 'ai-build' });
  expect(parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试', '--with-data', 'n'])).toMatchObject({ action: 'enable' });
  expect(parseArgs(['status', 'st-12345678'])).toMatchObject({ action: 'status', requestId: 'st-12345678' });
  expect(() => parseArgs(['enable', TEMPLATE_ID])).toThrow();
  expect(() => parseArgs(['enable', TEMPLATE_ID, '--name', 'x', '--with-data', 'maybe'])).toThrow();
  expect(() => parseArgs(['delete', TEMPLATE_ID])).toThrow();
});

test('discovers templates and exposes only readback-backed catalog fields', async () => {
  const result = await execute(parseArgs(['search', '--query', '合同']), { client, root });
  expect(result).toMatchObject({ success: true, action: 'search', totalCount: 1, readbackVerified: true });
  expect(result.data[0]).toMatchObject({ templateId: TEMPLATE_ID, title: '合同管理', author: '宜搭官方' });
  expect(result.data[0].detailUrl).toContain(encodeURIComponent(TEMPLATE_ID));
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('detail distinguishes AI-build support from direct enable source identity', async () => {
  const result = await execute(parseArgs(['detail', TEMPLATE_ID]), { client, root });
  expect(result).toMatchObject({
    success: true,
    aiBuildSupported: true,
    directEnableSupported: true,
    sourceAppType: 'APP_SOURCE',
    sourceVersion: '1.0.8',
  });
  expect(result.aiBuildUrl).toBe(`https://tenant.aliwork.com/dashboard?templateId=${TEMPLATE_ID}`);
});

test('AI build is a verified native handoff and never claims submission or application creation', async () => {
  const result = await execute(parseArgs(['ai-build', TEMPLATE_ID]), { client, root });
  expect(result).toMatchObject({
    action: 'ai-build', submissionAccepted: false, applicationVerified: false,
    nextAction: { action: 'customize-and-submit-in-native-builder' },
  });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('direct enable writes one request, records identity and verifies the created application', async () => {
  const parsed = parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试', '--with-data', 'n']);
  const result = await execute(parsed, { client, root });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  const [endpoint, bodyFactory] = client.postFormOnce.mock.calls[0];
  expect(endpoint).toContain('copyTemplateApp');
  expect(bodyFactory(client.getAuthRef())).toMatchObject({
    appTplUuid: TEMPLATE_ID, sourceAppType: 'APP_SOURCE', withTplData: 'n', fromTemplate: 'y',
  });
  expect(result).toMatchObject({ success: true, state: 'completed', applicationVerified: true,
    resultApp: { appType: 'APP_CREATED', appName: '合同管理测试' } });
  expect(fs.existsSync(result.receiptFile)).toBe(true);
});

test('timeout becomes uncertain and a repeated enable recovers instead of submitting again', async () => {
  client.postFormOnce.mockImplementationOnce(async () => {
    throw new Error('timeout');
  });
  const parsed = parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试', '--wait', '0']);
  await expect(execute(parsed, { client, root })).rejects.toMatchObject({
    code: 'SOLUTION_TEMPLATE_ENABLE_UNCERTAIN',
    details: { inspectBeforeRetry: true },
  });
  apps.push({ appType: 'APP_LATE', appName: { zh_CN: '合同管理测试' }, systemLink: '' });
  const recovered = await execute(parsed, { client, root });
  expect(recovered).toMatchObject({ success: true, state: 'completed', recoveredByReadback: true,
    resultApp: { appType: 'APP_LATE' } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('repeated enable with no readback blocks resubmission while progress remains unavailable', async () => {
  client.postFormOnce.mockRejectedValueOnce(new Error('timeout'));
  const parsed = parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试', '--wait', '0']);
  await expect(execute(parsed, { client, root })).rejects.toBeTruthy();
  const result = await execute(parsed, { client, root });
  expect(result).toMatchObject({ success: false, state: 'uncertain', resubmissionBlocked: true,
    platformProgressSupported: false, inspectBeforeRetry: true });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('definite platform rejection is recorded and never left as an in-flight submission', async () => {
  client.postFormOnce.mockResolvedValueOnce({
    success: false, errorCode: 'NO_PERMISSION', errorMsg: '无权限',
  });
  const parsed = parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试']);
  await expect(execute(parsed, { client, root }))
    .rejects.toMatchObject({ code: 'SOLUTION_TEMPLATE_API_ERROR' });
  const requestId = defaultRequestId(client.getAuthRef(), {
    templateId: TEMPLATE_ID, appName: '合同管理测试', withData: 'y',
  });
  const receipt = JSON.parse(fs.readFileSync(
    path.join(root, '.cache', 'openyida', 'solution-template', `${requestId}.json`), 'utf8',
  ));
  expect(receipt).toMatchObject({ state: 'failed-before-submit', error: { code: 'NO_PERMISSION' } });
  const status = await execute(parseArgs(['status', requestId]), { client, root });
  expect(status).toMatchObject({ success: false, state: 'failed-before-submit', resubmissionBlocked: false,
    explicitRetryRequired: true, error: { code: 'NO_PERMISSION', message: '无权限' } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('status rejects missing receipts and detects multiple same-name candidates as ambiguous', async () => {
  await expect(execute(parseArgs(['status', 'st-missing1']), { client, root }))
    .rejects.toMatchObject({ code: 'SOLUTION_TEMPLATE_REQUEST_NOT_FOUND' });
  const spec = { templateId: TEMPLATE_ID, appName: '合同管理测试', withData: 'y' };
  const requestId = defaultRequestId(client.getAuthRef(), spec);
  const directory = path.join(root, '.cache', 'openyida', 'solution-template');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${requestId}.json`), JSON.stringify({
    version: 1, requestId, state: 'uncertain', ...spec, baselineAppTypes: ['APP_OLD'],
    baseUrl: 'https://tenant.aliwork.com', corpId: 'corp-1',
  }));
  apps.push(
    { appType: 'APP_A', appName: { zh_CN: spec.appName } },
    { appType: 'APP_B', appName: { zh_CN: spec.appName } },
  );
  const result = await execute(parseArgs(['status', requestId]), { client, root });
  expect(result).toMatchObject({ success: false, state: 'ambiguous', resubmissionBlocked: true });
  expect(result.ambiguousCandidates).toHaveLength(2);
});

test('status refuses to inspect a receipt under another environment or organization', async () => {
  const requestId = 'st-target-mismatch';
  const directory = path.join(root, '.cache', 'openyida', 'solution-template');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${requestId}.json`), JSON.stringify({
    version: 1, requestId, state: 'uncertain', templateId: TEMPLATE_ID,
    appName: '合同管理测试', withData: 'y', baselineAppTypes: [],
    baseUrl: 'https://other.aliwork.com', corpId: 'corp-other',
  }));
  await expect(execute(parseArgs(['status', requestId]), { client, root }))
    .rejects.toMatchObject({ code: 'SOLUTION_TEMPLATE_REQUEST_TARGET_MISMATCH' });
  expect(client.get).not.toHaveBeenCalled();
});

test.each([
  { success: false, errorCode: 'NO_PERMISSION', errorMsg: '无权限' },
  { success: true, __needLogin: true },
  { success: true, content: null },
])('does not treat invalid platform responses as successful detail reads', async response => {
  client.get.mockResolvedValue(response);
  await expect(execute(parseArgs(['detail', TEMPLATE_ID]), { client, root })).rejects.toBeTruthy();
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('prepare summarizes the target and duplicates without submitting or predicting entitlement', async () => {
  apps.push({ appType: 'APP_SAME_NAME', appName: { zh_CN: '合同管理测试' } });
  const result = await execute(parseArgs([
    'prepare', TEMPLATE_ID, '--name', '合同管理测试', '--with-data', 'n',
  ]), { client, root });
  expect(result).toMatchObject({
    action: 'prepare', submissionAccepted: false, applicationVerified: false,
    summary: {
      target: { baseUrl: 'https://tenant.aliwork.com', corpId: 'corp-1', corpName: '测试组织' },
      template: { title: '合同管理', sourceVersion: '1.0.8', directEnableSupported: true },
      appName: '合同管理测试', withData: 'n',
      enableEligibility: 'platform-decides-on-submit', existingRequest: null,
      sameNameApps: [{ appType: 'APP_SAME_NAME' }],
    },
  });
  expect(client.postFormOnce).not.toHaveBeenCalled();
  expect(fs.existsSync(path.join(root, '.cache'))).toBe(false);
});

test.each(['--retry', '--wait'])('prepare rejects write and polling flag %s', flag => {
  expect(() => parseArgs(['prepare', TEMPLATE_ID, '--name', 'x', flag, ...(flag === '--wait' ? ['1'] : [])]))
    .toThrow();
});

test.each(['-1', '61', '0.5', 'NaN'])('rejects unbounded or invalid wait %s', wait => {
  expect(() => parseArgs(['status', 'st-12345678', '--wait', wait])).toThrow();
});

test('platform rejection never claims a later same-name app and repeated enable does not retry', async () => {
  client.postFormOnce.mockResolvedValueOnce({ success: false, errorCode: 'NO_PERMISSION', errorMsg: '平台无权限' });
  const parsed = parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试']);
  let rejected;
  try { await execute(parsed, { client, root }); } catch (error) { rejected = error; }
  expect(rejected).toMatchObject({ details: {
    state: 'failed-before-submit', submissionAccepted: false, applicationVerified: false,
    platformErrorCode: 'NO_PERMISSION', summary: { enableEligibility: 'platform-decides-on-submit' },
    nextAction: { action: 'retry-only-on-explicit-user-request' },
  } });
  apps.push({ appType: 'APP_UNRELATED', appName: { zh_CN: '合同管理测试' } });
  client.get.mockClear();
  const result = await execute(parsed, { client, root });
  expect(result).toMatchObject({ state: 'failed-before-submit', applicationVerified: false,
    resultApp: null, error: { code: 'NO_PERMISSION' } });
  expect(client.get).not.toHaveBeenCalled();
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('explicit retry sends one new request and leaves permission decisions to the platform', async () => {
  const args = ['enable', TEMPLATE_ID, '--name', '合同管理测试'];
  client.postFormOnce.mockResolvedValueOnce({ success: false, errorCode: 'NO_PERMISSION', errorMsg: '无权限' });
  await expect(execute(parseArgs(args), { client, root })).rejects.toMatchObject({ code: 'SOLUTION_TEMPLATE_API_ERROR' });
  const result = await execute(parseArgs([...args, '--retry']), { client, root });
  expect(result).toMatchObject({ state: 'completed', applicationVerified: true,
    summary: { existingRequest: { state: 'failed-before-submit' } } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(2);
  const receipt = JSON.parse(fs.readFileSync(result.receiptFile, 'utf8'));
  expect(receipt.attempt).toBe(2);
});

test('explicit retry can be rejected again and preserves the new platform reason', async () => {
  client.postFormOnce.mockResolvedValue({ success: false, errorCode: 'NO_PERMISSION', errorMsg: '仍无权限' });
  const args = ['enable', TEMPLATE_ID, '--name', '合同管理测试'];
  await expect(execute(parseArgs(args), { client, root })).rejects.toBeTruthy();
  await expect(execute(parseArgs([...args, '--retry']), { client, root })).rejects.toMatchObject({
    details: { state: 'failed-before-submit', platformErrorCode: 'NO_PERMISSION' },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(2);
});

test('retry without an existing request cannot create an application', async () => {
  await expect(execute(parseArgs(['enable', TEMPLATE_ID, '--name', 'x', '--retry']), { client, root }))
    .rejects.toMatchObject({ code: 'SOLUTION_TEMPLATE_REQUEST_NOT_FOUND' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('retry cannot replay an unknown outcome, and prepare reports its existing request', async () => {
  const args = ['enable', TEMPLATE_ID, '--name', '合同管理测试', '--wait', '0'];
  client.postFormOnce.mockRejectedValueOnce(new Error('timeout'));
  await expect(execute(parseArgs(args), { client, root })).rejects.toBeTruthy();
  const retry = await execute(parseArgs([...args, '--retry']), { client, root });
  expect(retry).toMatchObject({ state: 'uncertain', resubmissionBlocked: true });
  const prepared = await execute(parseArgs(['prepare', TEMPLATE_ID, '--name', '合同管理测试']), { client, root });
  expect(prepared.summary.existingRequest).toMatchObject({ state: 'uncertain' });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('non-JSON CLI failures retain a structured recovery receipt for unknown outcomes', async () => {
  client.postFormOnce.mockRejectedValueOnce(new Error('timeout'));
  let failure;
  try {
    await execute(parseArgs(['enable', TEMPLATE_ID, '--name', 'x', '--wait', '0']), { client, root });
  } catch (error) { failure = error; }
  expect(shouldUseStructuredErrorOutput(failure, [])).toBe(true);
  expect(failure).toMatchObject({ details: { retrySafe: false, sideEffectState: 'unknown',
    target: { templateId: TEMPLATE_ID }, nextAction: { action: 'check-status' } } });
});

test('the execution summary is delivered before submission and also retained in the receipt', async () => {
  const onSummary = jest.fn(summary => {
    expect(client.postFormOnce).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ template: { sourceVersion: '1.0.8' }, withData: 'n' });
  });
  const result = await execute(parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试', '--with-data', 'n']), {
    client, root, onSummary,
  });
  expect(onSummary).toHaveBeenCalledTimes(1);
  expect(result.summary).toEqual(onSummary.mock.calls[0][0]);
});

test.each([undefined, null, {}, { success: true, content: {} }])('malformed copy response %p is uncertain', async response => {
  client.postFormOnce.mockResolvedValueOnce(response);
  await expect(execute(parseArgs(['enable', TEMPLATE_ID, '--name', 'x']), { client, root }))
    .rejects.toMatchObject({ code: 'SOLUTION_TEMPLATE_ENABLE_UNCERTAIN',
      details: { state: 'uncertain', resubmissionBlocked: true } });
});

test('bounded waiting recovers a delayed application without replaying the copy', async () => {
  client.postFormOnce.mockResolvedValueOnce({ success: true, content: { desAppType: 'APP_DELAYED' } });
  const sleep = jest.fn(async () => {
    if (sleep.mock.calls.length === 2) {
      apps.push({ appType: 'APP_DELAYED', appName: { zh_CN: '合同管理测试' } });
    }
  });
  const onProgress = jest.fn();
  const result = await execute(parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试']), {
    client, root, sleep, onProgress,
  });
  expect(result).toMatchObject({ state: 'completed', applicationVerified: true,
    wait: { budgetSeconds: 10, checks: 3 } });
  expect(sleep.mock.calls.map(call => call[0])).toEqual([1000, 2000]);
  expect(onProgress).toHaveBeenCalled();
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('a timed-out submission can recover during the same bounded readback wait', async () => {
  client.postFormOnce.mockRejectedValueOnce(new Error('timeout'));
  const sleep = jest.fn(async () => {
    apps.push({ appType: 'APP_LATE', appName: { zh_CN: '合同管理测试' } });
  });
  const result = await execute(parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试']), { client, root, sleep });
  expect(result).toMatchObject({ state: 'completed', applicationVerified: true, recoveredByReadback: true });
  expect(result.error).toBeNull();
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('wait exhaustion returns accepted with an actionable status command', async () => {
  client.postFormOnce.mockResolvedValueOnce({ success: true, content: { desAppType: 'APP_DELAYED' } });
  const sleep = jest.fn(async () => {});
  const result = await execute(parseArgs(['enable', TEMPLATE_ID, '--name', 'x', '--wait', '5']), { client, root, sleep });
  expect(sleep.mock.calls.map(call => call[0])).toEqual([1000, 2000, 2000]);
  expect(result).toMatchObject({ success: false, state: 'accepted', submissionAccepted: true,
    applicationVerified: false, wait: { budgetSeconds: 5, checks: 4 }, nextAction: { action: 'check-status' } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  apps.push({ appType: 'APP_DELAYED', appName: { zh_CN: 'x' } });
  const status = await execute(parseArgs(['status', result.requestId, '--wait', '5']), { client, root, sleep });
  expect(status).toMatchObject({ state: 'completed', applicationVerified: true });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('readback time counts against the waiting budget', async () => {
  client.postFormOnce.mockResolvedValueOnce({ success: true, content: { desAppType: 'APP_DELAYED' } });
  const sleep = jest.fn();
  const now = jest.fn().mockReturnValueOnce(0).mockReturnValue(6000);
  const result = await execute(parseArgs(['enable', TEMPLATE_ID, '--name', 'x', '--wait', '5']), {
    client, root, sleep, now,
  });
  expect(result).toMatchObject({ state: 'accepted', wait: { budgetSeconds: 5, checks: 1 } });
  expect(sleep).not.toHaveBeenCalled();
});

test('readback failure preserves accepted state and platform error without retrying the copy', async () => {
  client.postFormOnce.mockImplementationOnce(async () => {
    client.get.mockRejectedValue(new Error('read permission denied'));
    return { success: true, content: { desAppType: 'APP_CREATED' } };
  });
  const sleep = jest.fn();
  const result = await execute(parseArgs(['enable', TEMPLATE_ID, '--name', 'x']), { client, root, sleep });
  expect(result).toMatchObject({ state: 'accepted', submissionAccepted: true, applicationVerified: false,
    lastReadback: { visibility: 'unknown', error: { message: 'read permission denied' } },
    nextAction: { action: 'check-status' } });
  expect(sleep).not.toHaveBeenCalled();
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('historical completion and current visibility remain consistent when an app disappears', async () => {
  const args = ['enable', TEMPLATE_ID, '--name', '合同管理测试'];
  const created = await execute(parseArgs(args), { client, root });
  apps = [];
  // Receipt recovery must also work if the template is subsequently unavailable.
  const get = client.get.getMockImplementation();
  client.get.mockImplementation(endpoint => {
    if (endpoint.includes('getAppTplComplexInfo')) { throw new Error('template removed'); }
    return get(endpoint);
  });
  const result = await execute(parseArgs([...args, '--retry']), { client, root });
  expect(result).toMatchObject({ success: false, state: 'completed', previouslyVerified: true,
    applicationVerified: false, lastReadback: { visibility: 'not-visible' },
    lastVerifiedAt: created.lastVerifiedAt, nextAction: { action: 'check-status' } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});
