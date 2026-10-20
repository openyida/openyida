'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, execute, defaultRequestId } = require('../lib/solution-template/solution-template');

const TEMPLATE_ID = 'TPL_NH4BHYQIV87DC5KRDY6D';
let root;
let apps;
let client;

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
      baseUrl: 'https://tenant.aliwork.com', corpId: 'corp-1', userId: 'user-1',
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
    apps.push({ appType: 'APP_LATE', appName: { zh_CN: '合同管理测试' }, systemLink: '' });
    throw new Error('timeout');
  });
  const parsed = parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试']);
  await expect(execute(parsed, { client, root })).rejects.toMatchObject({
    code: 'SOLUTION_TEMPLATE_ENABLE_UNCERTAIN',
    details: { inspectBeforeRetry: true },
  });
  const recovered = await execute(parsed, { client, root });
  expect(recovered).toMatchObject({ success: true, state: 'completed', recoveredByReadback: true,
    resultApp: { appType: 'APP_LATE' } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('repeated enable with no readback blocks resubmission while progress remains unavailable', async () => {
  client.postFormOnce.mockRejectedValueOnce(new Error('timeout'));
  const parsed = parseArgs(['enable', TEMPLATE_ID, '--name', '合同管理测试']);
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
  expect(status).toMatchObject({ success: false, state: 'failed-before-submit', resubmissionBlocked: true });
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
