'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execute, parseArgs, decodeCard } = require('../lib/app/cool-card');
const { resolveManagedPolicy } = require('../lib/core/managed-policy');
const { assertManagedInvocation } = require('../lib/agent/managed-run');
const settings = require('../lib/app/app-settings');

let dir, client, card;
const args = (action, flags = []) => parseArgs([action, 'APP_TEST', ...(action === 'get' ? ['form123'] : []), ...flags]);
const clone = x => JSON.parse(JSON.stringify(x));
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cool-card-'));
  card = { appId: 'APP_TEST', cardPageCode: 'form123', cardName: '订单', cardType: 'im', cardTemplateId: 'template-123', cardTag: '',
    cardSchema: JSON.stringify({ templateId: 'template-123', publishStatus: 'build', extension: { platform: 'im', unknown: true },
      editorData: JSON.stringify({ schemaVersion: '2.0.0', variableList: [{ id: 'orders', type: 'loopArray', schema: [{ id: 'total', type: 'number' }] }],
        schema: { componentsTree: [{ componentName: 'Card', children: [{ componentName: 'BaseText', props: { text: '${total}' } },
          { componentName: 'Loop', children: [{ componentName: 'Grid', children: [{ componentName: 'BaseText' }] }] }] }] },
        mockData: { orders: [{ total: 12 }] }, unknown: { preserve: true } }), widgetInfo: { original: true }, renderTemplate: '<original/>' }) };
  client = { getAuthRef: () => ({ baseUrl: 'https://tenant.aliwork.com' }),
    get: jest.fn(async (endpoint, params) => ({ success: true, content: endpoint.includes('list')
      ? { data: [clone(card)], totalCount: 52, pageSize: params.pageSize, currentPage: params.currentPage } : clone(card) })),
    postFormOnce: jest.fn(async (endpoint, params) => {
      card.cardType = params.cardType; card.cardName = params.cardName;
      return { success: true, content: clone(card) };
    }),
  };
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test('reads complex nested components and variables while preserving the exact raw template snapshot', async () => {
  const out = path.join(dir, 'snapshot.json');
  const result = await execute(args('get', ['--out', out]), client);
  expect(client.get).toHaveBeenCalledWith('/APP_TEST/query/cardDesign/getCardSchema.json', { cardAppId: 'APP_TEST', cardPageCode: 'form123' });
  expect(result.components).toEqual(['BaseText', 'Card', 'Grid', 'Loop']);
  expect(result.variableList[0].schema[0].id).toBe('total');
  expect(result.template.widgetInfo).toEqual({ original: true });
  expect(result.editorData.unknown.preserve).toBe(true);
  expect(JSON.parse(fs.readFileSync(out)).card.cardSchema).toBe(card.cardSchema);
  // Windows reports synthesized mode bits rather than POSIX owner/group permissions.
  if (process.platform !== 'win32') { expect(fs.statSync(out).mode & 0o777).toBe(0o600); }
  expect(result.capabilities).toMatchObject({ save: false, publish: false, send: false });
  expect(result).toMatchObject({ readbackVerified: true, configurationVerified: false, deliveryVerified: false });
  expect(result.urls.editorUrl).toContain('scene=yida_card&bizId=APP_TEST.form123');
  expect(result.nextAction).toEqual({ actor: 'user', action: 'review-or-edit', target: 'cool-card-management',
    url: 'https://tenant.aliwork.com/APP_TEST/admin/appSetting/coolCardManage',
    verificationCommand: 'openyida cool-card get APP_TEST form123 --json' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});
test('exports snapshots with owner-only mode requested and exclusive creation on every platform', async () => {
  const out = path.join(dir, 'secure-snapshot.json');
  const writeFile = jest.spyOn(fs, 'writeFileSync');
  try {
    await execute(args('get', ['--out', out]), client);
    expect(writeFile).toHaveBeenCalledWith(out, expect.any(String), { mode: 0o600, flag: 'wx' });
    expect(JSON.parse(fs.readFileSync(out)).card.cardSchema).toBe(card.cardSchema);
  } finally {
    writeFile.mockRestore();
  }
});
test.each(['im', 'onebox'])('creates a %s resource with only name and type, once, and verifies it', async type => {
  const result = await execute(args('create', ['--name', '验证', '--type', type]), client);
  expect(client.postFormOnce.mock.calls).toEqual([['/APP_TEST/query/cardDesign/createCard.json', { cardName: '验证', cardType: type }]]);
  expect(result.card.cardType).toBe(type);
  expect(result.resourceType).toBe('native-cool-card');
  expect(result.nextAction).toMatchObject({ actor: 'user', action: 'configure-and-save', target: 'official-editor',
    url: result.urls.editorUrl });
});
test.each(['https://yida-group.alibaba-inc.com', 'https://YIDA-GROUP.alibaba-inc.com/'])(
  'rejects creation on the authenticated group endpoint %s before any card API or file write', async baseUrl => {
    client.getAuthRef = () => ({ baseUrl });
    for (const type of ['im', 'onebox']) {
      const out = path.join(dir, `${type}.json`);
      await expect(execute(args('create', ['--name', '验证', '--type', type, '--out', out]), client))
        .rejects.toMatchObject({ code: 'COOL_CARD_UNSUPPORTED_ENVIRONMENT', details: { environment: 'alibaba' } });
      expect(fs.existsSync(out)).toBe(false);
    }
    expect(client.get).not.toHaveBeenCalled();
    expect(client.postFormOnce).not.toHaveBeenCalled();
  }
);
test('uses the authenticated endpoint rather than a different global environment setting', async () => {
  const previous = process.env.OPENYIDA_ENV;
  process.env.OPENYIDA_ENV = 'alibaba';
  try {
    await execute(args('create', ['--name', '验证', '--type', 'im']), client);
    expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  } finally {
    if (previous === undefined) { delete process.env.OPENYIDA_ENV; }
    else { process.env.OPENYIDA_ENV = previous; }
  }
});
test('a blank card is a resource rather than a completed design', async () => {
  card.cardSchema = '';
  const result = await execute(args('create', ['--name', '空卡片', '--type', 'im']), client);
  expect(result.template).toBeNull();
  expect(result.schemaReadbackVerified).toBe(false);
  expect(result.completion).toBe('resource-only');
  expect(result.configurationVerified).toBe(false);
});
test('passes pagination, native type and search without fetching editor service or writing', async () => {
  const result = await execute(args('list', ['--type', 'onebox', '--page', '2', '--size', '10', '--search', '订单']), client);
  expect(client.get.mock.calls[0]).toEqual(['/APP_TEST/query/cardDesign/listCards.json', {
    cardType: 'onebox', currentPage: 2, pageSize: 10, searchName: '订单', excludeOfficialCard: false,
  }]);
  expect(result.totalCount).toBe(52);
  expect(result.data[0]).not.toHaveProperty('cardSchema');
  expect(client.postFormOnce).not.toHaveBeenCalled();
});
test('catalog can contain platform templates in another app, without granting mutation authority', async () => {
  card.appId = 'APP_OFFICIAL';
  await execute(args('templates', ['--type', 'im']), client);
  expect(client.get.mock.calls[0][0]).toBe('/APP_TEST/query/cardDesign/listTpls.json');
  expect(client.get.mock.calls[0][1]).not.toHaveProperty('excludeOfficialCard');
  expect(client.postFormOnce).not.toHaveBeenCalled();
});
test.each([
  ['create', 'APP_TEST', '--name', 'a'],
  ['templates', 'APP_TEST'], ['list', 'APP_TEST', '--size', '0'], ['list', 'APP_TEST', '--page', '2.5'],
  ['get', 'APP_TEST', 'CARD-123'], ['get', 'APP_TEST', 'FORM-123'],
  ['get', 'APP_TEST', 'form123', '--type', 'im'], ['list', 'APP_TEST', '--type', 'report'],
  ['create', 'APP_TEST', '--type', 'im', '--name', 'a', '--app-tag', 'override'],
  ['create', 'APP_TEST', '--type', 'im', '--name', 'a', '--quota', '999'],
  ['create', 'APP_TEST', '--type', 'im', '--name', 'a', '--allow-send'],
  ['save', 'APP_TEST', 'form123'], ['publish', 'APP_TEST', 'form123'], ['send', 'APP_TEST', 'form123'],
  ['copy', 'APP_TEST', 'form123'], ['delete', 'APP_TEST', 'form123'], ['edit', 'APP_TEST', 'form123'],
  ['list', 'APP_TEST', '--json', '--json'],
])('rejects unsupported or cross-resource input %j before writes', (...argv) => {
  expect(() => parseArgs(argv)).toThrow();
  expect(client.postFormOnce).not.toHaveBeenCalled();
});
test('programmatic calls cannot smuggle entitlement fields into a creation body', async () => {
  await expect(execute({ action: 'create', appType: 'APP_TEST', flags: { '--name': 'a', '--type': 'im', '--app-tag': 'override' } }, client))
    .rejects.toMatchObject({ code: 'COOL_CARD_USAGE' });
  expect(client.get).not.toHaveBeenCalled(); expect(client.postFormOnce).not.toHaveBeenCalled();
});
test.each(['NO_PERMISSION', 'EDGE_990412'])('retains platform denial %s without altering rights or retrying', async errorCode => {
  client.postFormOnce.mockResolvedValue({ success: false, errorCode, errorMsg: '拒绝创建，请核对权限与权益' });
  await expect(execute(args('create', ['--name', '验证', '--type', 'im']), client))
    .rejects.toMatchObject({ code: 'COOL_CARD_API_ERROR', details: { platformErrorCode: errorCode } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1); expect(client.get).not.toHaveBeenCalled();
});
test('write timeouts are not replayed', async () => {
  client.postFormOnce.mockRejectedValue(new Error('timeout'));
  await expect(execute(args('create', ['--name', '验证', '--type', 'im']), client)).rejects.toThrow('timeout');
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});
test('readback failure retains the newly created identity for recovery', async () => {
  client.get.mockRejectedValue(new Error('read timeout'));
  await expect(execute(args('create', ['--name', '验证', '--type', 'im']), client))
    .rejects.toMatchObject({ details: { resourceCreated: true, appType: 'APP_TEST', cardPageCode: 'form123', inspectBeforeRetry: true } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});
test('new resource with missing template reports metadata success and preserves schema failure', async () => {
  const get = client.get.getMockImplementation();
  client.get.mockImplementation(async (endpoint, params) => endpoint.includes('getCardSchema')
    ? { success: false, errorCode: '500', errorMsg: '卡片模板不存在' } : get(endpoint, params));
  const result = await execute(args('create', ['--name', '验证', '--type', 'im']), client);
  expect(result).toMatchObject({ success: true, completion: 'resource-only', readbackVerified: true, schemaReadbackVerified: false,
    schemaReadbackError: { details: { platformErrorCode: '500' } } });
  expect(result).not.toHaveProperty('editorData');
  expect(result.nextAction).toMatchObject({ actor: 'user', action: 'configure-and-save', url: result.urls.editorUrl });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});
test('creation falls back to tenant management when no supported direct editor URL is available', async () => {
  client.getAuthRef = () => ({ baseUrl: 'https://private.example.test' });
  const result = await execute(args('create', ['--name', '验证', '--type', 'im']), client);
  expect(result.urls.editorUrl).toBeNull();
  expect(result.nextAction).toMatchObject({ actor: 'user', action: 'configure-and-save', target: 'cool-card-management',
    url: 'https://private.example.test/APP_TEST/admin/appSetting/coolCardManage' });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});
test('creation with invalid response is uncertain rather than safe to repeat', async () => {
  client.postFormOnce.mockResolvedValue({ success: true, content: true });
  await expect(execute(args('create', ['--name', '验证', '--type', 'im']), client))
    .rejects.toMatchObject({ details: { mutationAccepted: true, inspectBeforeRetry: true } });
});
test.each(['appId', 'cardPageCode'])('rejects mismatched %s in readback', async key => {
  card[key] = key === 'appId' ? 'APP_OTHER' : 'formOther';
  await expect(execute(args('get'), client)).rejects.toMatchObject({ code: 'COOL_CARD_TARGET_MISMATCH' });
});
test.each([{ success: true, __needLogin: true }, { success: false, errorCode: 'DENIED' }, { success: true, content: null }])('rejects false successful reads %j', async response => {
  client.get.mockResolvedValue(response);
  await expect(execute(args('get'), client)).rejects.toThrow();
  expect(client.postFormOnce).not.toHaveBeenCalled();
});
test('refuses malformed schema and retains different template version identifiers without rewriting either', () => {
  expect(() => decodeCard({ cardSchema: '{' })).toThrow();
  expect(decodeCard({ cardSchema: JSON.stringify({ templateId: 'other' }), cardTemplateId: 'real' }))
    .toMatchObject({ templateIdsMatch: false, template: { templateId: 'other' } });
  expect(() => decodeCard({ cardSchema: JSON.stringify({ editorData: JSON.stringify({ schema: { componentsTree: {} } }) }) })).toThrow();
});
test('existing export files stop creation before the remote write', async () => {
  const out = path.join(dir, 'snapshot.json'); fs.writeFileSync(out, 'original');
  await expect(execute(args('create', ['--type', 'im', '--name', 'a', '--out', out]), client)).rejects.toMatchObject({ code: 'COOL_CARD_OUTPUT_EXISTS' });
  expect(client.postFormOnce).not.toHaveBeenCalled(); expect(fs.readFileSync(out, 'utf8')).toBe('original');
});
test('managed execution restricts the app and rejects unregistered mutating actions', () => {
  for (const action of ['list', 'templates', 'get', 'create']) {
    expect(resolveManagedPolicy('cool-card', [action, 'APP_TEST']).policy.scope).toBe('app');
  }
  expect(resolveManagedPolicy('cool-card', ['send', 'APP_TEST'])).toBeNull();
  const env = { OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_BOUND', OPENYIDA_AGENT_CORP_ID: 'corp', OPENYIDA_AGENT_USER_ID: 'user', OPENYIDA_AGENT_RUN_ID: 'run', OPENYIDA_AGENT_ATTEMPT_ID: 'attempt', OPENYIDA_AGENT_BASE_URL: 'https://platform.example.test', OPENYIDA_AGENT_TASK_GRANT: 'test_' + 'g'.repeat(48) };
  expect(() => assertManagedInvocation('cool-card', ['create', 'APP_OTHER'], { env })).toThrow();
});
test('cool-card entry is derived from the verified tenant app and does not update settings', async () => {
  client.get.mockResolvedValue({ success: true, content: { appType: 'APP_TEST' } });
  const result = await settings.execute(settings.parseArgs(['APP_TEST', '--section', 'cool-card']), client);
  expect(result.url).toBe('https://tenant.aliwork.com/APP_TEST/admin/appSetting/coolCardManage');
  expect(result.runtimeVerified).toBe(false);
  expect(client.postFormOnce).not.toHaveBeenCalled();
});
