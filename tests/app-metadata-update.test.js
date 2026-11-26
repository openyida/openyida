'use strict';

const querystring = require('querystring');
jest.mock('../lib/core/utils', () => ({
  httpGet: jest.fn(), httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((fn, auth) => fn(auth)),
}));
jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn() }));
const { httpGet, httpPost } = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');
const { run, parseArgs, hasShellUpdate, buildUpdateAppNamePostData, buildUpdateAppPostData, saveAppSettings } = require('../lib/app/update-app');
const { toErrorPayload, shouldUseStructuredErrorOutput } = require('../lib/core/cli-error');

const auth = { baseUrl: 'https://example.com', csrfToken: 'csrf' };
const original = () => ({
  appType: 'APP_1', appName: { type: 'i18n', key: 'app.title', en_US: 'Original', ja_JP: '元の名前', extension: 'keep' },
  description: { type: 'i18n', zh_CN: '原描述', en_US: 'Original description', key: 'app.description' },
  icon: 'crm%%#123456', iconUrl: 'crm%%#123456', appGroupId: 'existing-group',
  managers: [{ emplId: 'owner' }], dataManagers: [{ userId: 'data-owner' }], devManagers: [{ key: 'developer' }],
  managerIdList: 'owner', mainRoleManagerIdList: 'role-owner', dataRoleManagerIdList: 'role-data', devRoleManagerIdList: 'role-dev',
  componentContain: '["component"]', componentConfig: '{"existing":true}', subCorpId: 'sub-org',
  config: { APPMODE: 'normal', APPTYPE: 'multi', COLOUR: 'podBlue',
    NAVTYPE: 'top_side', LAY_OUT_DIRECTION: 'hoz', NAV_THEME: 'gray',
    PAGEHEADER: '<header>existing</header>', PAGEFOOTER: '',
    SHOWNAV: '', SHOWICON: 'n', FORMLOGO: 'https://example.com/form-logo.png',
    SHORTURL: 'existing-url', APP_CATEGORY: 'existing-category',
    CONSULTANTS: 'consultant', DEFAULT_CONSULTANT: 'y',
    ALLOW_EXTERNAL_ADDRESS_BOOK: 'n', NEW_ALLOW_EXTERNAL_ADDRESS_BOOK: 'n',
    FUTURE_SETTING: { enabled: false, nested: ['preserve'] } },
});
let state;
let log;
beforeEach(() => {
  jest.clearAllMocks();
  state = original();
  createAuthRef.mockReturnValue(auth);
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  httpGet.mockReset().mockImplementation(async () => ({ success: true, content: structuredClone(state) }));
  httpPost.mockReset().mockImplementation(async (_base, path, body) => {
    const payload = querystring.parse(body);
    if (payload.appName) {state.appName = JSON.parse(payload.appName);}
    if (path.includes('/updateApp.json')) {
      state.description = JSON.parse(payload.description);
      const fields = { mode: 'APPMODE', type: 'APPTYPE', colour: 'COLOUR', navType: 'NAVTYPE',
        navTheme: 'NAV_THEME', layoutDirection: 'LAY_OUT_DIRECTION', pageHeader: 'PAGEHEADER',
        pageFooter: 'PAGEFOOTER', showNav: 'SHOWNAV', showIcon: 'SHOWICON', formLogo: 'FORMLOGO',
        shortUrl: 'SHORTURL', categoryId: 'APP_CATEGORY', consultants: 'CONSULTANTS',
        defaultConsultant: 'DEFAULT_CONSULTANT', allowExternalAddressBook: 'ALLOW_EXTERNAL_ADDRESS_BOOK',
        newAllowExternalAddressBook: 'NEW_ALLOW_EXTERNAL_ADDRESS_BOOK' };
      // Model the existing endpoint's overwrite semantics, rather than only
      // returning success=true: omitted arguments can reset stored settings.
      for (const [field, key] of Object.entries(fields)) {state.config[key] = payload[field] ?? '';}
      state.icon = payload.icon;
      state.iconUrl = payload.iconUrl;
      state.appGroupId = payload.appGroupId || 'default';
      state.mainRoleManagerIdList = payload.mainRoleManagers || '';
    }
    return { success: true };
  });
});
afterEach(() => {jest.restoreAllMocks();});
const output = () => log.mock.calls.map(([line]) => line).filter(line => typeof line === 'string' && line.startsWith('{')).map(JSON.parse);

test.each([
  [['--desc', '新描述'], false],
  [['--name', '新名称', '--desc', '新描述'], true],
])('CLI %j saves requested metadata and preserves existing settings', async (args, renamed) => {
  const before = structuredClone(state);
  await run(['APP_1', ...args]);
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(httpPost.mock.calls[0][1]).toContain('/APP_1/query/app/updateApp.json?');
  const payload = querystring.parse(httpPost.mock.calls[0][2]);
  expect(payload).toMatchObject({ pageHeader: before.config.PAGEHEADER, pageFooter: '', showNav: '',
    navType: 'top_side', layoutDirection: 'hoz', navTheme: 'gray',
    mainManagers: 'owner', dataManagers: 'data-owner', devManagers: 'developer',
    mainRoleManagers: 'role-owner', dataRoleManagers: 'role-data', devRoleManagers: 'role-dev',
    appGroupId: 'existing-group', componentContain: '["component"]', componentConfig: '{"existing":true}' });
  expect(payload).not.toHaveProperty('FUTURE_SETTING');
  expect(state.config).toEqual(before.config);
  expect(state.appName).toEqual(renamed ? expect.objectContaining({ zh_CN: '新名称' }) : before.appName);
  expect(state.description.zh_CN).toBe('新描述');
  expect(output().at(-1)).toMatchObject({ success: true,
    submittedFields: { desc: '新描述', ...(renamed ? { name: '新名称' } : {}) },
    metadataVerification: { verified: true, checks: { appName: true, description: true, settings: true } } });
});

test('name-only uses the rename endpoint and preserves the original description', async () => {
  const before = structuredClone(state);
  await run(['APP_1', '--name', '新名称']);
  expect(httpPost.mock.calls[0][1]).toContain('/updateAppName.json?');
  expect(querystring.parse(httpPost.mock.calls[0][2])).not.toHaveProperty('description');
  expect(state.description).toEqual(before.description);
  expect(state.config).toEqual(before.config);
  expect(output().at(-1)).toMatchObject({ success: true, metadataVerification: { verified: true } });
});

test('description and theme can change together while other configuration is preserved', async () => {
  const before = structuredClone(state.config);
  await run(['APP_1', '--desc', '新描述', '--theme', 'podGreen']);
  expect(state.config).toEqual({ ...before, COLOUR: 'podGreen' });
  expect(output().at(-1)).toMatchObject({ success: true, metadataVerification: { verified: true, checks: { settings: true } } });
});

test('mixed description and theme updates still detect unrelated configuration loss', async () => {
  const update = httpPost.getMockImplementation();
  httpPost.mockImplementation(async (...args) => {
    const result = await update(...args);
    delete state.config.FUTURE_SETTING;
    return result;
  });
  await expect(run(['APP_1', '--desc', '新描述', '--theme', 'podGreen']))
    .rejects.toMatchObject({ code: 'APP_METADATA_NOT_PERSISTED', details: {
      metadataVerification: { checks: { settings: false } } } });
  expect(httpPost).toHaveBeenCalledTimes(1);
});

test('description-only never builds a rename request carrying description', () => {
  const params = parseArgs(['APP_1', '--desc', '新描述']);
  expect(hasShellUpdate(params)).toBe(true);
  expect(buildUpdateAppNamePostData(params, auth)).not.toHaveProperty('description');
});

test.each([null, '', 'null', '"null"', '   ', {}, [], '{broken', { type: 'i18n' }])(
  'unsafe current name %j blocks description and shell writes but explicit rename can recover', async appName => {
    state.appName = appName;
    await expect(run(['APP_1', '--desc', '新描述'])).rejects.toMatchObject({ code: 'APP_NAME_REPAIR_REQUIRED' });
    await expect(saveAppSettings(parseArgs(['APP_1', '--theme', 'podGreen']), auth))
      .rejects.toMatchObject({ code: 'APP_NAME_REPAIR_REQUIRED' });
    expect(httpPost).not.toHaveBeenCalled();
    await run(['APP_1', '--name', '恢复名称']);
    expect(state.appName.zh_CN).toBe('恢复名称');
    expect(httpPost).toHaveBeenCalledTimes(1);
  }
);

test.each([{ type: 'i18n', key: 'app.title' }, { type: 'i18n', en_US: 'English only', ja_JP: '名前' }])(
  'preserves supported non-Chinese name protocol %j', async appName => {
    state.appName = JSON.stringify(appName);
    await run(['APP_1', '--desc', '新描述']);
    expect(state.appName).toEqual(appName);
    expect(output().at(-1).success).toBe(true);
  }
);

test('unchanged null description is not replaced with the app name during a shell update', () => {
  const payload = buildUpdateAppPostData(parseArgs(['APP_1', '--icon', 'new-icon']), { ...original(), description: null }, auth);
  expect(JSON.parse(payload.description)).toBeNull();
});

test.each(['mode', 'colour', 'icon', 'config'])('incomplete %s snapshot never causes a default-filled write', async missing => {
  if (missing === 'mode') {delete state.config.APPMODE;}
  if (missing === 'colour') {delete state.config.COLOUR;}
  if (missing === 'icon') {delete state.icon; delete state.iconUrl;}
  if (missing === 'config') {delete state.config;}
  await expect(run(['APP_1', '--desc', '新描述'])).rejects.toMatchObject({ code: 'APP_SETTINGS_INCOMPLETE' });
  expect(httpPost).not.toHaveBeenCalled();
});

test('current detail response can omit legacy appGroupId without blocking description or changing categoryId', async () => {
  delete state.appGroupId;
  const before = structuredClone(state.config);
  await run(['APP_1', '--desc', '新描述']);
  const payload = querystring.parse(httpPost.mock.calls[0][2]);
  expect(payload).not.toHaveProperty('appGroupId');
  expect(payload.categoryId).toBe(before.APP_CATEGORY);
  expect(state.config).toEqual(before);
  expect(output().at(-1)).toMatchObject({ success: true, metadataVerification: { verified: true } });
});

test.each([undefined, 'true', 'false'])('preserves raw SHOWAPPTITLE %j rather than the derived API Boolean', async stored => {
  if (stored !== undefined) {state.config.SHOWAPPTITLE = stored;}
  state.showAppTitle = stored !== 'false';
  const update = httpPost.getMockImplementation();
  httpPost.mockImplementation(async (...args) => {
    const result = await update(...args);
    const payload = querystring.parse(args[2]);
    if (payload.showAppTitle) {state.config.SHOWAPPTITLE = payload.showAppTitle;}
    state.showAppTitle = Object.hasOwn(state.config, 'SHOWAPPTITLE') ? state.config.SHOWAPPTITLE === 'true' : true;
    return result;
  });
  await run(['APP_1', '--desc', '新描述']);
  const payload = querystring.parse(httpPost.mock.calls[0][2]);
  if (stored === undefined) {
    expect(payload).not.toHaveProperty('showAppTitle');
    expect(state.config).not.toHaveProperty('SHOWAPPTITLE');
  } else {expect(payload.showAppTitle).toBe(stored);}
  expect(output().at(-1)).toMatchObject({ success: true, metadataVerification: { checks: { showAppTitle: true } } });
});

test.each(['null', '{"literal":"description"}', '123'])('description %s is sent as literal user text', async desc => {
  await run(['APP_1', '--desc', desc]);
  expect(state.description.zh_CN).toBe(desc);
  expect(output().at(-1).success).toBe(true);
});

test.each(['description', 'appName', 'unknown-config', 'readback'])('success with failed %s verification fails without replay', async failure => {
  const before = structuredClone(state);
  httpGet.mockReset().mockResolvedValueOnce({ success: true, content: before });
  if (failure === 'readback') {httpGet.mockRejectedValue(new Error('readback unavailable'));}
  else {
    const after = { ...before, description: { zh_CN: '新描述' } };
    if (failure === 'description') {after.description = before.description;}
    if (failure === 'appName') {after.appName = null;}
    if (failure === 'unknown-config') {after.config = { ...before.config, FUTURE_SETTING: null };}
    httpGet.mockResolvedValue({ success: true, content: after });
  }
  let error;
  try {await run(['APP_1', '--desc', '新描述']);} catch (caught) {error = caught;}
  expect(error).toMatchObject({ code: 'APP_METADATA_NOT_PERSISTED', details: {
    mutationAccepted: true, retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true,
    submittedFields: { desc: '新描述' }, metadataVerification: { verified: false } } });
  expect(shouldUseStructuredErrorOutput(error)).toBe(true);
  expect(toErrorPayload(error).details.metadataVerification.verified).toBe(false);
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(httpGet).toHaveBeenCalledTimes(4);
  expect(output().some(result => result.success)).toBe(false);
});

test('rename cannot report success if description changed unexpectedly', async () => {
  const before = structuredClone(state);
  httpGet.mockReset().mockResolvedValueOnce({ success: true, content: before })
    .mockResolvedValue({ success: true, content: { appName: { zh_CN: '新名称' }, description: null } });
  await expect(run(['APP_1', '--name', '新名称'])).rejects.toMatchObject({ code: 'APP_NAME_NOT_PERSISTED' });
  expect(httpPost).toHaveBeenCalledTimes(1);
});

test('rejected request retains backend reason and is never replayed', async () => {
  httpPost.mockResolvedValue({ success: false, errorCode: 'DENIED', errorMsg: 'permission denied' });
  await expect(run(['APP_1', '--desc', '新描述'])).rejects.toMatchObject({ code: 'DENIED', message: 'permission denied' });
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(httpGet).toHaveBeenCalledTimes(1);
  expect(output().some(result => result.success)).toBe(false);
});

test('lost write response reports uncertain state with submitted fields', async () => {
  httpPost.mockRejectedValue(new Error('connection lost'));
  await expect(run(['APP_1', '--desc', '新描述'])).rejects.toMatchObject({ details: {
    target: { appType: 'APP_1' }, submittedFields: { desc: '新描述' }, retrySafe: false, sideEffectState: 'unknown' } });
  expect(httpPost).toHaveBeenCalledTimes(1);
});
