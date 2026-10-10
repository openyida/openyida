'use strict';

jest.mock('../lib/core/utils', () => ({
  httpPost: jest.fn(), httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn((fn, auth) => fn(auth)),
}));
jest.mock('../lib/app/prepare-app-theme-upgrade', () => ({ prepareAppThemeUpgrade: jest.fn() }));
jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn() }));
const { httpGet, httpPost } = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');
const { parseArgs, parseThemeContext, upgradeAppTheme, run } = require('../lib/app/upgrade-app-theme');
const { flattenCommandManifest } = require('../lib/core/command-manifest');
const params = { appType: 'APP_1', explicitRequest: true, confirm: true };
const ok = content => ({ success: true, content });
const context = (overrides = {}) => `<script>window.pageConfig = ${JSON.stringify({
  appType: 'APP_1', corpId: 'corp-1', agentAppType: 'local', ...overrides,
})};</script>`;
let state;
const writes = () => httpPost.mock.calls.filter(call => call[1].includes('updateSingleConfig'))
  .map(call => Object.fromEntries(new URLSearchParams(call[2])));
const serve = async (_base, url, body) => {
  const { key, value } = Object.fromEntries(new URLSearchParams(body));
  if (url.includes('getSingleConfig')) { return ok(state[key] === undefined ? null : state[key]); }
  state[key] = value;
  return ok(true);
};
beforeEach(() => {
  jest.clearAllMocks();
  httpGet.mockReset().mockResolvedValue(context());
  httpPost.mockReset().mockImplementation(serve);
  state = { CREATED_WITH_MODERN_THEME: null, APP_THEME_MODE: 'legacy' };
  createAuthRef.mockReturnValue({ baseUrl: 'https://private.example', csrfToken: 'csrf', corpId: 'corp-1' });
});

test.each([{}, { explicitRequest: true }, { confirm: true }, { explicitRequest: 'true', confirm: true }])(
  'requires both authorization attestations before login/network: %j', async flags => {
    await expect(upgradeAppTheme({ appType: 'APP_1', ...flags })).rejects.toMatchObject({ code: 'APP_THEME_CONFIRMATION_REQUIRED' });
    expect(createAuthRef).not.toHaveBeenCalled();
    expect(httpGet).not.toHaveBeenCalled();
    expect(httpPost).not.toHaveBeenCalled();
  });
test.each([[], ['APP_1', '--confirm'], ['APP_1', '--yes'], ['APP_1', '--force'], ['../APP_1', '--explicit-request', '--confirm']]
  .map(args => ({ args })))('rejects invalid input $args', async ({ args }) => {
  await expect(run(args)).rejects.toBeDefined();
  expect(httpGet).not.toHaveBeenCalled();
  expect(httpPost).not.toHaveBeenCalled();
});
test('writes both configs with target identity and verifies configuration only', async () => {
  await expect(upgradeAppTheme(params)).resolves.toMatchObject({
    success: true, changed: true, verified: true, verificationScope: 'config', runtimeVerified: false,
    createdWithModernTheme: 'y', appThemeMode: 'modern',
  });
  expect(writes()).toEqual([
    { appType: 'APP_1', key: 'CREATED_WITH_MODERN_THEME', value: 'y', _csrf_token: 'csrf' },
    { appType: 'APP_1', key: 'APP_THEME_MODE', value: 'modern', _csrf_token: 'csrf' },
  ]);
  expect(httpPost.mock.calls.every(call => call[0] === 'https://private.example')).toBe(true);
  expect(httpGet).toHaveBeenCalledTimes(1);
  expect(httpGet.mock.calls[0][1]).toBe('/APP_1/admin');
  expect(httpPost.mock.calls.slice(-2).map(call => new URLSearchParams(call[2]).get('key')))
    .toEqual(['CREATED_WITH_MODERN_THEME', 'APP_THEME_MODE']);
});
test.each(['local', 'cloud', 'qwenwork', ' CLOUD '])('only agent type qualifies: %s', async agentAppType => {
  httpGet.mockResolvedValue(context({ agentAppType, appTag: 'SPACE', appThemeEnable: 'n', appThemeMode: 'legacy', platformVersion: 'V3' }));
  await expect(upgradeAppTheme(params)).resolves.toMatchObject({ success: true });
  expect(httpGet).toHaveBeenCalledTimes(1); // No gray queries or runtime-mode gate.
});
test.each(['none', '', 'unknown'])('non-AI type %s never writes even with theme enabled', async agentAppType => {
  httpGet.mockResolvedValue(context({ agentAppType, appThemeEnable: 'y', aiApp: 'y' }));
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ code: 'APP_THEME_AI_APP_REQUIRED' });
  expect(httpPost).not.toHaveBeenCalled();
});
test.each([{ appType: 'OTHER' }, { corpId: 'other-corp' }, { agentAppType: null }])('wrong or missing identity rejects %j', async fields => {
  httpGet.mockResolvedValue(context(fields));
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ code: 'APP_THEME_CONTEXT_UNVERIFIED' });
  expect(httpPost).not.toHaveBeenCalled();
});
test('both values already set is a no-op', async () => {
  state = { CREATED_WITH_MODERN_THEME: 'y', APP_THEME_MODE: 'modern' };
  await expect(upgradeAppTheme(params)).resolves.toMatchObject({ changed: false, verified: true });
  expect(writes()).toEqual([]);
});
test.each([
  { before: { CREATED_WITH_MODERN_THEME: 'y', APP_THEME_MODE: null }, key: 'APP_THEME_MODE' },
  { before: { CREATED_WITH_MODERN_THEME: null, APP_THEME_MODE: 'modern' }, key: 'CREATED_WITH_MODERN_THEME' },
])('repairs only the missing config: $key', async ({ before, key }) => {
  state = before;
  await expect(upgradeAppTheme(params)).resolves.toMatchObject({ updatedKeys: [key] });
  expect(writes().map(write => write.key)).toEqual([key]);
});
test.each([null, 'n', 'unexpected'])('old creation marker %j is upgraded', async value => {
  state.CREATED_WITH_MODERN_THEME = value;
  await expect(upgradeAppTheme(params)).resolves.toMatchObject({ createdWithModernTheme: 'y' });
});
test.each([undefined, [], { unexpected: true }])('invalid pre-read %j refuses all writes', async value => {
  httpPost.mockResolvedValueOnce(ok(value));
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ code: 'APP_THEME_READ_FAILED' });
  expect(writes()).toEqual([]);
});
test('second pre-read failure also refuses all writes', async () => {
  httpPost.mockResolvedValueOnce(ok(null)).mockResolvedValueOnce({ success: false });
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ code: 'APP_THEME_READ_FAILED' });
  expect(writes()).toEqual([]);
});
test.each(['CREATED_WITH_MODERN_THEME', 'APP_THEME_MODE'])('write failure for %s reports partial progress and stops', async failedKey => {
  httpPost.mockImplementation(async (base, url, body) => {
    if (url.includes('updateSingleConfig') && new URLSearchParams(body).get('key') === failedKey) { return ok(false); }
    return serve(base, url, body);
  });
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ code: 'APP_THEME_UPGRADE_FAILED', details: {
    attemptedKey: failedKey, writeOutcomeMayBePartial: true, configVerified: false,
    verifiedWrites: failedKey === 'APP_THEME_MODE' ? ['CREATED_WITH_MODERN_THEME'] : [],
  } });
  expect(writes()).toHaveLength(failedKey === 'APP_THEME_MODE' ? 2 : 1);
});
test('network failure after a write is reported as unknown, without retry/rollback', async () => {
  httpPost.mockImplementation(async (base, url, body) => {
    const result = await serve(base, url, body);
    if (url.includes('updateSingleConfig')) { throw new Error('network disconnected'); }
    return result;
  });
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ details: {
    attemptedKey: 'CREATED_WITH_MODERN_THEME', verifiedWrites: [], writeOutcomeMayBePartial: true,
  } });
  expect(writes()).toHaveLength(1);
});
test('first config not persisted stops before second write', async () => {
  httpPost.mockImplementation(async (base, url, body) => url.includes('updateSingleConfig') ? ok(true) : serve(base, url, body));
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ code: 'APP_THEME_NOT_PERSISTED' });
  expect(writes()).toHaveLength(1);
});
test('final readback detects concurrent marker change after mode update', async () => {
  httpPost.mockImplementation(async (base, url, body) => {
    const result = await serve(base, url, body);
    if (url.includes('updateSingleConfig') && new URLSearchParams(body).get('key') === 'APP_THEME_MODE') {
      state.CREATED_WITH_MODERN_THEME = 'n';
    }
    return result;
  });
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ code: 'APP_THEME_NOT_PERSISTED' });
  expect(writes()).toHaveLength(2);
});
test.each([
  '<html>Login required</html>', '<script>window.pageConfig = getConfig();</script>',
  '<script>window.pageConfig = {...other};</script>', '<script>window.pageConfig = {agentAppType: execute()};</script>',
  context() + context(), context().replace('"agentAppType":"local"', '"agentAppType":"local","agentAppType":"none"'),
])('unverifiable config rejects without execution', html => {
  expect(() => parseThemeContext(html)).toThrow();
});
test('help is local', async () => {
  await run(['--help']);
  expect(httpGet).not.toHaveBeenCalled();
  expect(httpPost).not.toHaveBeenCalled();
});
test('manifest still requires confirmation', () => {
  const command = flattenCommandManifest().find(entry => entry.id === 'upgrade-app-theme');
  expect(command.permission.mode).toBe('ask');
  expect(command.sideEffect.mutates_yida).toBe(true);
  expect(parseArgs(['APP_1', '--explicit-request', '--confirm'])).toMatchObject(params);
});

test('prepare pulls source inventory without confirmation or remote config writes', async () => {
  const { prepareAppThemeUpgrade } = require('../lib/app/prepare-app-theme-upgrade');
  prepareAppThemeUpgrade.mockResolvedValue({ success: true, stage: 'prepared', appUpgradeComplete: false });
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await expect(run(['APP_1', '--explicit-request', '--prepare', '--output-dir', '/tmp/new-backup', '--json']))
      .resolves.toMatchObject({ stage: 'prepared', appUpgradeComplete: false });
    expect(prepareAppThemeUpgrade).toHaveBeenCalledWith(expect.objectContaining({ appType: 'APP_1', outputDir: '/tmp/new-backup' }), expect.any(Object));
    expect(httpPost).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
test('prepare and confirm cannot accidentally be combined', async () => {
  await expect(run(['APP_1', '--explicit-request', '--prepare', '--confirm', '--output-dir', '/tmp/new-backup']))
    .rejects.toBeDefined();
  expect(httpGet).not.toHaveBeenCalled();
  expect(httpPost).not.toHaveBeenCalled();
});

test('accepts empty-object content for unset configuration', async () => {
  httpPost.mockImplementation(async (base, url, body) => {
    const result = await serve(base, url, body);
    return result.content === null ? ok({}) : result;
  });
  await expect(upgradeAppTheme(params)).resolves.toMatchObject({ success: true });
  expect(writes()).toHaveLength(2);
});


test.each([
  ['slide', 'side', 'default', 'light'],
  ['ver', 'side', 'light', 'white'],
  ['hoz', 'top', 'dark', 'dark'],
])('upgrade migrates legacy layout %s and color %s before enabling the theme', async (layout, modernLayout, navTheme, modernTheme) => {
  state.LAY_OUT_DIRECTION = layout;
  state.NAV_THEME = navTheme;
  state.NAVTYPE = 'top_side_fold';
  const result = await upgradeAppTheme(params);
  expect(state).toMatchObject({ LAY_OUT_DIRECTION: modernLayout, NAV_THEME: modernTheme,
    NAVTYPE: 'top_side_fold', APP_THEME_MODE: 'modern', CREATED_WITH_MODERN_THEME: 'y' });
  expect(result.navigation).toEqual({ layoutDirection: modernLayout, navTheme: modernTheme });
  expect(writes()[0].key).toBe('LAY_OUT_DIRECTION');
  expect(writes().at(-1).key).toBe('APP_THEME_MODE');
  expect(writes().some(write => write.key === 'NAVTYPE')).toBe(false);
  httpPost.mockClear();
  expect(await upgradeAppTheme(params)).toMatchObject({ changed: false });
  expect(writes()).toHaveLength(0);
});

test.each(['white', 'gray', 'light', 'dark'])('already modern %s stays unchanged', async navTheme => {
  state = { CREATED_WITH_MODERN_THEME: 'y', APP_THEME_MODE: 'modern', LAY_OUT_DIRECTION: 'l_shape', NAV_THEME: navTheme };
  expect(await upgradeAppTheme(params)).toMatchObject({ changed: false, navigation: { navTheme } });
  expect(writes()).toHaveLength(0);
});

test.each([['ver', 'side_only', 'side'], ['ver', 'top_side', 'l_shape'], ['hoz', 'top_side', 'l_shape']])(
  'upgrade honors historical shell structure %s/%s', async (layout, navType, expected) => {
    state.LAY_OUT_DIRECTION = layout; state.NAVTYPE = navType;
    await upgradeAppTheme(params);
    expect(state.LAY_OUT_DIRECTION).toBe(expected);
  });

test('navigation migration failure does not enable the new theme', async () => {
  state.LAY_OUT_DIRECTION = 'slide';
  httpPost.mockImplementation(async (base, url, body) => {
    if (url.includes('updateSingleConfig')) {return ok(false);}
    return serve(base, url, body);
  });
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ details: {
    attemptedKey: 'LAY_OUT_DIRECTION', verifiedWrites: [], writeOutcomeMayBePartial: true,
  } });
  expect(state.APP_THEME_MODE).toBe('legacy');
  expect(writes().map(write => write.key)).toEqual(['LAY_OUT_DIRECTION']);
});

test('navigation pre-read failure refuses all writes', async () => {
  httpPost.mockImplementation(async (base, url, body) => {
    if (new URLSearchParams(body).get('key') === 'NAV_THEME') {return { success: false };}
    return serve(base, url, body);
  });
  await expect(upgradeAppTheme(params)).rejects.toMatchObject({ code: 'APP_THEME_READ_FAILED' });
  expect(writes()).toHaveLength(0);
});


test('legacy ver without explicit L-shaped structure upgrades to side', async () => {
  state.LAY_OUT_DIRECTION = 'ver';
  await upgradeAppTheme(params);
  expect(state.LAY_OUT_DIRECTION).toBe('side');
});
