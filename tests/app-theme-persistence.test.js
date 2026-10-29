'use strict';

const querystring = require('querystring');
jest.mock('../lib/core/utils', () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((fn, auth) => fn(auth)),
}));
jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn() }));
jest.mock('../lib/app/custom-theme', () => ({
  ...jest.requireActual('../lib/app/custom-theme'),
  readThemeCssFile: jest.fn(() => ({ themeColor: '#C89B5A' })),
  uploadCustomThemeFile: jest.fn(),
}));

const { httpGet, httpPost } = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');
const { uploadCustomThemeFile } = require('../lib/app/custom-theme');
const { parseArgs, saveAppSettings, applyCustomThemeUpdate, run } = require('../lib/app/update-app');
const { shouldUseStructuredErrorOutput, toErrorPayload } = require('../lib/core/cli-error');
const auth = { baseUrl: 'https://example.com', csrfToken: 'csrf', corpId: 'dingTEST' };
const runtime = (overrides = {}) => `<script>window.pageConfig = ${JSON.stringify({ appType: 'APP_1', corpId: auth.corpId, appThemeEnable: 'y', appThemeMode: 'modern', ...overrides })};</script>`;
const style = { enabled: true, iframePropagation: false, cssUrl: 'https://example.com/desert.css', cssFileName: 'desert.css' };
const disabledStyle = { ...style, enabled: false, iframePropagation: false };
const saved = { colour: 'custom', themeColor: '#C89B5A', customThemeStyle: JSON.stringify(style), hideAppNav: 'y' };
const uploadEvidence = { requested: true, status: 'uploaded', uploadedThisRun: true, appType: 'APP_1',
  sourceFileName: 'desert.css', sourceBytes: 123, sourceSha256: 'a'.repeat(64),
  themeColor: '#C89B5A', cssUrl: style.cssUrl, cssFileName: style.cssFileName, resourceContentVerified: false };
const response = (content) => ({ success: true, content });
let errorSpy;
let stderrSpy;

beforeEach(() => {
  jest.clearAllMocks();
  httpGet.mockReset();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  stderrSpy = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  createAuthRef.mockReturnValue(auth);
  httpPost.mockResolvedValue(response(true));
  uploadCustomThemeFile.mockReset().mockResolvedValue({ ...response({ url: style.cssUrl, name: style.cssFileName }), themeUpload: uploadEvidence });
});

afterEach(() => {
  errorSpy.mockRestore();
  stderrSpy.mockRestore();
});

test.each([
  [['--nav-theme', 'dark'], { navType: 'top_side' }, 'l_shape'],
  [['--nav-theme', 'dark'], { config: { LAY_OUT_DIRECTION: 'hoz', NAVTYPE: 'top_side' } }, 'l_shape'],
  [['--layout', 'top', '--show-app-nav'], { navType: 'top_side', hideAppNav: 'y' }, 'top'],
  [['--layout', 'side', '--show-app-nav'], { layoutDirection: 'top', navType: 'top_fold' }, 'side'],
  [['--layout', 'l_shape', '--show-app-nav'], { layoutDirection: 'side', navType: 'side_only' }, 'l_shape'],
])('CLI %j preserves stored navType and sends layout %s', async (args, current, layout) => {
  httpGet.mockResolvedValueOnce(response(current)).mockImplementation(() =>
    Promise.resolve(response(querystring.parse(httpPost.mock.calls[0][2]))));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['APP_1', ...args]);
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(httpPost.mock.calls[0][1]).toContain('/APP_1/query/app/updateApp.json');
    const body = querystring.parse(httpPost.mock.calls[0][2]);
    expect(body).toMatchObject({
      layoutDirection: layout,
      navType: current.navType || current.config.NAVTYPE,
    });
    if (args.includes('--show-app-nav')) {expect(body.hideAppNav).toBe('n');}
  } finally {log.mockRestore();}
});

test('theme upload checks runtime first, then reads fresh settings, saving updateApp and checking the persisted resource', async () => {
  httpGet.mockResolvedValueOnce(runtime()).mockResolvedValueOnce(runtime())
    .mockResolvedValueOnce(response({ colour: 'podBlue', hideAppNav: 'y', navTheme: 'dark', layoutDirection: 'top', logoSource: 'customImage' }))
    .mockResolvedValueOnce(response(saved));
  const result = await applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth);
  expect(httpGet.mock.invocationCallOrder[0]).toBeLessThan(uploadCustomThemeFile.mock.invocationCallOrder[0]);
  expect(uploadCustomThemeFile.mock.invocationCallOrder[0]).toBeLessThan(httpGet.mock.invocationCallOrder[2]);
  expect(httpPost.mock.calls[0][1]).toContain('/APP_1/query/app/updateApp.json');
  expect(querystring.parse(httpPost.mock.calls[0][2])).toMatchObject({
    colour: 'custom', themeColor: '#C89B5A', customThemeStyle: JSON.stringify(style), hideAppNav: 'y',
    navTheme: 'dark', layoutDirection: 'top', logoSource: 'customImage',
  });
  expect(result.themeVerification).toEqual({ verified: true, colour: 'custom', themeColor: '#C89B5A', customThemeStyle: style,
    scope: 'configuration_readback', operation: 'bind_resource', runtimeVerified: false });
  expect(result.themeUpload).toEqual(uploadEvidence);
});

test('CLI update-app --theme-file exposes the verified resource in its success output', async () => {
  httpGet.mockResolvedValueOnce(runtime()).mockResolvedValueOnce(runtime())
    .mockResolvedValueOnce(response({ colour: 'podBlue' })).mockResolvedValueOnce(response(saved));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['APP_1', '--theme-file', './desert.css']);
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter((line) => typeof line === 'string' && line.startsWith('{')).pop());
    expect(output).toMatchObject({ success: true, themeUpload: uploadEvidence,
      themeVerification: { verified: true, customThemeStyle: style, scope: 'configuration_readback', operation: 'bind_resource' },
      runtimeVerification: { verified: false, status: 'not_checked' } });
  } finally { log.mockRestore(); }
});

test('HTTP success with an unchanged platform theme is a failure; retries only read', async () => {
  httpGet.mockResolvedValueOnce(runtime()).mockResolvedValueOnce(runtime())
    .mockResolvedValue(response({ colour: 'podBlue', themeColor: '', customThemeStyle: '' }));
  const result = await applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth);
  expect(result).toMatchObject({ success: false, errorCode: 'APP_THEME_NOT_PERSISTED', themeVerification: { verified: false } });
  expect(result.themeUpload).toEqual(uploadEvidence);
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(uploadCustomThemeFile).toHaveBeenCalledTimes(1);
  expect(httpGet).toHaveBeenCalledTimes(6);
});

test('nav updates preserve theme fields from config and detect later theme loss', async () => {
  httpGet.mockResolvedValueOnce(response({ config: {
    COLOUR: saved.colour, THEME_COLOR: saved.themeColor, CUSTOM_THEME_STYLE: style,
  } })).mockResolvedValue(response({ colour: 'podBlue' }));
  const result = await saveAppSettings(parseArgs(['APP_1', '--hide-app-nav']), auth);
  expect(querystring.parse(httpPost.mock.calls[0][2])).toMatchObject({ ...saved, hideAppNav: 'y' });
  expect(result).toMatchObject({ success: false, errorCode: 'APP_THEME_NOT_PERSISTED' });
});

test('CLI fails when the color was saved but the CSS resource is missing', async () => {
  httpGet.mockResolvedValueOnce(runtime()).mockResolvedValueOnce(runtime())
    .mockResolvedValue(response({ colour: 'custom', themeColor: '#C89B5A', customThemeStyle: '' }));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await expect(run(['APP_1', '--theme-file', './desert.css'])).rejects.toMatchObject({ code: 'APP_THEME_NOT_PERSISTED' });
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter((line) => typeof line === 'string' && line.startsWith('{')).pop());
    expect(output).toMatchObject({ success: false, appType: 'APP_1', themeVerification: { verified: false } });
  } finally { log.mockRestore(); }
});

test('readback retries tolerate one stale snapshot without another save', async () => {
  httpGet.mockResolvedValueOnce(response(saved)).mockResolvedValueOnce(response({ colour: 'podBlue' }))
    .mockResolvedValueOnce(response(saved));
  expect(await saveAppSettings(parseArgs(['APP_1', '--hide-app-nav']), auth))
    .toMatchObject({ success: true, themeVerification: { verified: true } });
  expect(httpPost).toHaveBeenCalledTimes(1);
});

test('readback accepts normalized colors and configuration JSON objects', async () => {
  httpGet.mockResolvedValueOnce(response(saved)).mockResolvedValueOnce(response({ config: {
    COLOUR: 'custom', THEME_COLOR: 'rgb(200, 155, 90)', CUSTOM_THEME_STYLE: style, LAY_OUT_DIRECTION: 'top',
  } }));
  expect(await saveAppSettings(parseArgs(['APP_1', '--layout', 'top']), auth))
    .toMatchObject({ success: true, themeVerification: { verified: true } });
});

test('preset switch verifies that the custom resource was cleared', async () => {
  httpGet.mockResolvedValueOnce(response(saved)).mockResolvedValueOnce(response({ colour: 'podGreen' }));
  const result = await saveAppSettings(parseArgs(['APP_1', '--theme', 'podGreen']), auth);
  expect(querystring.parse(httpPost.mock.calls[0][2])).toMatchObject({ colour: 'podGreen', themeColor: '', customThemeStyle: '' });
  expect(result).toMatchObject({ success: true, themeVerification: { verified: true, customThemeStyle: null } });
});

test('a readback failure never reports the theme as saved', async () => {
  httpGet.mockResolvedValueOnce(response(saved)).mockRejectedValue(new Error('readback unavailable'));
  expect(await saveAppSettings(parseArgs(['APP_1', '--hide-app-nav']), auth)).toMatchObject({
    success: false, themeVerification: { verified: false, readbackError: 'readback unavailable' },
  });
});

test('update rejection is returned without a verification read', async () => {
  httpGet.mockResolvedValue(response(saved));
  httpPost.mockResolvedValue({ success: false, errorMsg: 'rejected' });
  expect(await saveAppSettings(parseArgs(['APP_1', '--hide-app-nav']), auth)).toEqual({ success: false, errorMsg: 'rejected' });
  expect(httpGet).toHaveBeenCalledTimes(1);
});

test.each([
  { colour: 'podBlue', themeColor: '#0089FF' },
  saved,
])('CLI navigation-only updates cannot claim a new CSS upload, including when a previous resource exists', async current => {
  httpPost.mockResolvedValue({ success: true, themeUpload: uploadEvidence });
  httpGet.mockResolvedValueOnce(response(current)).mockResolvedValueOnce(response({ ...current, navTheme: 'light' }));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['APP_1', '--nav-theme', 'light']);
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter(line => typeof line === 'string' && line.startsWith('{')).pop());
    expect(output).toMatchObject({ success: true,
      themeUpload: { requested: false, status: 'not_requested', uploadedThisRun: false, appType: 'APP_1' },
      themeVerification: { verified: true, scope: 'configuration_readback', operation: 'preserve', runtimeVerified: false },
      runtimeVerification: { verified: false, status: 'not_checked' } });
    expect(uploadCustomThemeFile).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});

test('upload evidence survives a thrown binding failure without a second upload', async () => {
  httpGet.mockResolvedValueOnce(runtime()).mockResolvedValueOnce(runtime());
  httpGet.mockRejectedValue(new Error('configuration read failed'));
  const error = await applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth).catch(e => e);
  expect(shouldUseStructuredErrorOutput(error, [])).toBe(true);
  expect(toErrorPayload(error)).toMatchObject({ success: false, errorCode: 'APP_THEME_UPDATE_FAILED',
    retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true,
    details: { themeUpload: uploadEvidence, applicationSettingsVerified: false, uploadedResource: JSON.stringify(style) } });
  expect(uploadCustomThemeFile).toHaveBeenCalledTimes(1);
  expect(httpPost).not.toHaveBeenCalled();
});

test('a lost upload response is unknown, never reported as no upload or verified success', async () => {
  httpGet.mockResolvedValue(runtime());
  uploadCustomThemeFile.mockRejectedValue(new Error('connection lost'));
  const error = await applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth).catch(e => e);
  expect(shouldUseStructuredErrorOutput(error, [])).toBe(true);
  expect(toErrorPayload(error)).toMatchObject({ success: false, retrySafe: false,
    details: { themeUpload: { requested: true, status: 'unknown', uploadedThisRun: null, appType: 'APP_1' },
      applicationSettingsVerified: false },
  });
  expect(uploadCustomThemeFile).toHaveBeenCalledTimes(1);
  expect(httpPost).not.toHaveBeenCalled();
});

test('an upload rejection stops before binding and reports no accepted upload', async () => {
  httpGet.mockResolvedValue(runtime());
  uploadCustomThemeFile.mockResolvedValue({ success: false, errorMsg: 'scan rejected', themeUpload: {
    requested: true, status: 'rejected', uploadedThisRun: false, appType: 'APP_1',
  } });
  await expect(applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth)).rejects.toMatchObject({
    details: { themeUpload: { status: 'rejected', uploadedThisRun: false }, applicationSettingsVerified: false },
  });
  expect(httpPost).not.toHaveBeenCalled();
});

test('CLI uses the color of the uploaded bytes when the file changed after preflight', async () => {
  const actualColor = '#2F6B57';
  uploadCustomThemeFile.mockResolvedValue({ ...response({ url: style.cssUrl, name: style.cssFileName }),
    themeUpload: { ...uploadEvidence, themeColor: actualColor } });
  httpGet.mockResolvedValueOnce(runtime()).mockResolvedValueOnce(runtime())
    .mockResolvedValueOnce(response({ colour: 'podBlue' })).mockResolvedValueOnce(response({ ...saved, themeColor: actualColor }));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['APP_1', '--theme-file', './desert.css']);
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter(line => typeof line === 'string' && line.startsWith('{')).pop());
    expect(querystring.parse(httpPost.mock.calls[0][2]).themeColor).toBe(actualColor);
    expect(output.updatedFields.themeColor).toBe(actualColor);
    expect(output.themeVerification.themeColor).toBe(actualColor);
  } finally { log.mockRestore(); }
});


test('renaming uses the app-scoped endpoint and verifies the persisted name', async () => {
  httpGet.mockResolvedValue(response({ appName: { zh_CN: 'Renamed app' } }));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['APP_1', '--name', 'Renamed app']);
    expect(httpPost.mock.calls[0][1]).toMatch(/^\/APP_1\/query\/app\/updateAppName\.json\?/);
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(httpGet.mock.calls[0][1]).toBe('/APP_1/query/app/getAppIncludingAecpInfo.json');
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter((line) => typeof line === 'string' && line.startsWith('{')).pop());
    expect(output).toMatchObject({ success: true, nameVerification: { verified: true, name: 'Renamed app' } });
  } finally { log.mockRestore(); }
});

test('rename success response with unchanged persisted name does not report success or repeat the write', async () => {
  httpGet.mockResolvedValue(response({ appName: { zh_CN: 'Original app' } }));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await expect(run(['APP_1', '--name', 'Renamed app'])).rejects.toMatchObject({ code: 'APP_NAME_NOT_PERSISTED' });
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.some(([line]) => typeof line === 'string' && line.startsWith('{') && JSON.parse(line).success === true)).toBe(false);
  } finally { log.mockRestore(); }
});

test('failed rename readback cannot be treated as verified success', async () => {
  httpGet.mockRejectedValue(new Error('readback unavailable'));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await expect(run(['APP_1', '--name', 'Renamed app'])).rejects.toThrow('readback unavailable');
    expect(httpPost).toHaveBeenCalledTimes(1);
  } finally { log.mockRestore(); }
});

test('navigation-only updates verify every requested setting and expose readback evidence', async () => {
  const values = { navTheme: 'dark', layoutDirection: 'l_shape', hideAppNav: 'n', logoSource: 'appIcon' };
  httpGet.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(values));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['APP_1', '--nav-theme', 'dark', '--layout', 'l_shape', '--show-app-nav', '--logo-source', 'appIcon']);
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter(line => typeof line === 'string' && line.startsWith('{')).pop());
    expect(output).toMatchObject({ success: true, navigationVerification: { verified: true, ...values } });
    expect(output).not.toHaveProperty('themeVerification');
    expect(httpGet).toHaveBeenCalledTimes(2);
    expect(httpPost).toHaveBeenCalledTimes(1);
  } finally {log.mockRestore();}
});

test.each([
  ['top', { config: { LAY_OUT_DIRECTION: 'hoz', NAVTYPE: 'top_fold' } }],
  ['l_shape', { config: { LAY_OUT_DIRECTION: 'hoz', NAVTYPE: 'top_side' } }],
  ['side', { layoutDirection: 'ver', navType: 'top_side' }],
  ['top', { navType: 'top_fold' }],
  ['l_shape', { navType: 'top_side' }],
  ['side', { layoutDirection: 'side', navType: 'top_fold' }],
])('navigation readback normalizes stored layout to %s', async (layout, actual) => {
  httpGet.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(actual));
  expect(await saveAppSettings(parseArgs(['APP_1', '--layout', layout]), auth))
    .toMatchObject({ success: true, navigationVerification: { verified: true, layoutDirection: layout } });
});

test('navigation readback tolerates stale values and config storage without another write', async () => {
  httpGet.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ navTheme: 'light', hideAppNav: 'n' }))
    .mockResolvedValueOnce(response({ config: { NAV_THEME: 'dark', HIDE_APP_NAV: 'y', LOGO_SOURCE: 'customImage' } }));
  expect(await saveAppSettings(parseArgs(['APP_1', '--nav-theme', 'dark', '--hide-app-nav', '--logo-source', 'customImage']), auth))
    .toMatchObject({ success: true, navigationVerification: { verified: true, navTheme: 'dark', hideAppNav: 'y', logoSource: 'customImage' } });
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(httpGet).toHaveBeenCalledTimes(3);
});

test('persisted theme with rejected navigation fails without uploading or writing again', async () => {
  httpGet.mockResolvedValueOnce(response(saved)).mockResolvedValue(response({ ...saved, navTheme: 'light' }));
  const result = await saveAppSettings(parseArgs(['APP_1', '--nav-theme', 'dark']), auth);
  expect(result).toMatchObject({ success: false, errorCode: 'APP_NAVIGATION_NOT_PERSISTED',
    themeVerification: { verified: true }, navigationVerification: {
      verified: false, expected: { navTheme: 'dark' }, actual: { navTheme: 'light' },
    } });
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
  expect(httpGet).toHaveBeenCalledTimes(4);
});

test('missing layout evidence cannot verify the default side layout', async () => {
  httpGet.mockResolvedValue(response({}));
  expect(await saveAppSettings(parseArgs(['APP_1', '--layout', 'side']), auth))
    .toMatchObject({ success: false, errorCode: 'APP_NAVIGATION_NOT_PERSISTED', navigationVerification: {
      verified: false, expected: { layoutDirection: 'side' }, actual: { layoutDirection: null },
    } });
});

test('CLI navigation verification failure is nonzero and keeps query failure evidence', async () => {
  httpGet.mockResolvedValueOnce(response({})).mockRejectedValue(new Error('navigation readback unavailable'));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await expect(run(['APP_1', '--hide-app-nav'])).rejects.toMatchObject({ code: 'APP_NAVIGATION_NOT_PERSISTED', exitCode: 1 });
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter(line => typeof line === 'string' && line.startsWith('{')).pop());
    expect(output).toMatchObject({ success: false, navigationVerification: {
      verified: false, expected: { hideAppNav: 'y' }, readbackError: 'navigation readback unavailable',
    } });
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(httpGet).toHaveBeenCalledTimes(4);
  } finally {log.mockRestore();}
});


test.each([['side', 'ver'], ['l_shape', 'ver'], ['top', 'hoz']])(
  'legacy save and readback use the exact persisted %s -> %s protocol', async (layout, expected) => {
    httpGet.mockResolvedValueOnce(response({ appThemeEnable: 'n', appThemeMode: 'legacy' }))
      .mockResolvedValueOnce(response({ config: { LAY_OUT_DIRECTION: expected, NAV_THEME: 'light' } }));
    const result = await saveAppSettings(parseArgs(['APP_1', '--layout', layout, '--nav-theme', 'white']), auth);
    expect(querystring.parse(httpPost.mock.calls[0][2])).toMatchObject({ layoutDirection: expected, navTheme: 'light' });
    expect(result).toMatchObject({ success: true, navigationVerification: {
      verified: true, layoutDirection: expected, navTheme: 'light',
    } });
  });

test('legacy readback rejects an unconverted modern value instead of claiming persistence', async () => {
  httpGet.mockResolvedValueOnce(response({ appThemeEnable: 'n', appThemeMode: 'legacy' }))
    .mockResolvedValue(response({ layoutDirection: 'side' }));
  expect(await saveAppSettings(parseArgs(['APP_1', '--layout', 'side']), auth)).toMatchObject({
    success: false, errorCode: 'APP_NAVIGATION_NOT_PERSISTED', navigationVerification: {
      verified: false, expected: { layoutDirection: 'ver' }, actual: { layoutDirection: 'side' },
    },
  });
  expect(httpPost).toHaveBeenCalledTimes(1);
});


test.each([
  { appThemeEnable: 'n', appThemeMode: 'legacy' },
  { appThemeEnable: 'n', appThemeMode: 'modern' },
  { appThemeEnable: 'y', appThemeMode: 'legacy' },
])('legacy runtime %j blocks CSS before upload and save', async flags => {
  httpGet.mockResolvedValue(runtime(flags));
  await expect(applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth))
    .rejects.toMatchObject({ code: 'LEGACY_APP_CUSTOM_THEME_CONFIRMATION_REQUIRED' });
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
  expect(httpPost).not.toHaveBeenCalled();
});

test('unknown theme capability requires human confirmation', async () => {
  httpGet.mockResolvedValue(`<script>window.pageConfig = ${JSON.stringify({ appType: 'APP_1', corpId: auth.corpId })};</script>`);
  await expect(applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth))
    .rejects.toMatchObject({ code: 'LEGACY_APP_CUSTOM_THEME_CONFIRMATION_REQUIRED' });
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
});

test.each([{ appType: 'APP_OTHER' }, { corpId: 'dingOTHER' }])('mismatched runtime identity %j blocks CSS', async flags => {
  httpGet.mockResolvedValue(runtime(flags));
  await expect(applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth))
    .rejects.toMatchObject({ code: 'APP_THEME_CONTEXT_UNVERIFIED' });
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
  expect(httpPost).not.toHaveBeenCalled();
});

test('direct stylesheet binding also requires runtime confirmation', async () => {
  httpGet.mockResolvedValue(runtime({ appThemeEnable: 'n', appThemeMode: 'legacy' }));
  await expect(saveAppSettings({ appType: 'APP_1', customThemeStyle: JSON.stringify(style) }, auth))
    .rejects.toMatchObject({ code: 'LEGACY_APP_CUSTOM_THEME_CONFIRMATION_REQUIRED' });
  expect(httpPost).not.toHaveBeenCalled();
});

test('fresh legacy runtime after upload blocks binding without repeating upload', async () => {
  httpGet.mockResolvedValueOnce(runtime()).mockResolvedValueOnce(runtime({ appThemeEnable: 'n', appThemeMode: 'legacy' }));
  await expect(applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth))
    .rejects.toMatchObject({ code: 'LEGACY_APP_CUSTOM_THEME_CONFIRMATION_REQUIRED' });
  expect(uploadCustomThemeFile).toHaveBeenCalledTimes(1);
  expect(httpPost).not.toHaveBeenCalled();
});

test('explicit approval permits legacy application CSS without upgrading its theme', async () => {
  const legacy = { ...saved, appThemeEnable: 'n', appThemeMode: 'legacy', layoutDirection: 'ver', navTheme: 'light' };
  httpGet.mockResolvedValueOnce(runtime({ appThemeEnable: 'n', appThemeMode: 'legacy' }))
    .mockResolvedValueOnce(runtime({ appThemeEnable: 'n', appThemeMode: 'legacy' }))
    .mockResolvedValue(response(legacy));
  const result = await applyCustomThemeUpdate('APP_1', { themeFile: './desert.css', confirmLegacyAppStyle: true }, auth);
  expect(result.success).toBe(true);
  expect(uploadCustomThemeFile).toHaveBeenCalledTimes(1);
  const payload = querystring.parse(httpPost.mock.calls[0][2]);
  expect(payload).toMatchObject({ layoutDirection: 'ver', navTheme: 'light' });
  expect(payload).not.toHaveProperty('appThemeMode');
});

test('disable retains CSS resource and verifies boolean flags without upload', async () => {
  httpGet.mockResolvedValueOnce(response({ ...saved, appThemeMode: 'legacy', layoutDirection: 'ver', navTheme: 'light' }))
    .mockResolvedValue(response({ ...saved, layoutDirection: 'ver', navTheme: 'light', customThemeStyle: JSON.stringify(disabledStyle) }));
  const result = await saveAppSettings(parseArgs(['APP_1', '--disable-custom-theme']), auth);
  expect(querystring.parse(httpPost.mock.calls[0][2])).toMatchObject({
    customThemeStyle: JSON.stringify(disabledStyle), colour: 'custom', themeColor: saved.themeColor, layoutDirection: 'ver', navTheme: 'light', hideAppNav: 'y',
  });
  expect(result).toMatchObject({ success: true, themeVerification: { verified: true, customThemeStyle: disabledStyle } });
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
});

test('disable detects still enabled CSS even when no brand color was set', async () => {
  httpGet.mockResolvedValue(response({ colour: 'podBlue', customThemeStyle: JSON.stringify(style) }));
  const result = await saveAppSettings(parseArgs(['APP_1', '--disable-custom-theme']), auth);
  expect(result).toMatchObject({ success: false, errorCode: 'APP_THEME_NOT_PERSISTED' });
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
});


test('human approval never bypasses a mismatched runtime application', async () => {
  httpGet.mockResolvedValue(runtime({ appType: 'APP_OTHER' }));
  await expect(applyCustomThemeUpdate('APP_1', { themeFile: './desert.css', confirmLegacyAppStyle: true }, auth))
    .rejects.toMatchObject({ code: 'APP_THEME_CONTEXT_UNVERIFIED' });
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
  expect(httpPost).not.toHaveBeenCalled();
});

test('CLI disable-custom-theme reports retained resource and pending runtime verification', async () => {
  httpGet.mockResolvedValueOnce(response(saved)).mockResolvedValue(response({ ...saved, customThemeStyle: JSON.stringify(disabledStyle) }));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['APP_1', '--disable-custom-theme']);
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter(line => typeof line === 'string' && line.startsWith('{')).pop());
    expect(output).toMatchObject({ success: true, runtimeVerification: { verified: false }, updatedFields: { customThemeStyle: disabledStyle },
      themeVerification: { verified: true, themeColor: saved.themeColor, customThemeStyle: disabledStyle } });
    expect(uploadCustomThemeFile).not.toHaveBeenCalled();
  } finally {log.mockRestore();}
});


test('unverified runtime identity blocks upload even with human approval and never executes scripts', async () => {
  httpGet.mockResolvedValue('<script>window.pageConfig = execute();</script>');
  await expect(applyCustomThemeUpdate('APP_1', { themeFile: './desert.css', confirmLegacyAppStyle: true }, auth))
    .rejects.toMatchObject({ code: 'APP_THEME_CONTEXT_UNVERIFIED' });
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
  expect(httpPost).not.toHaveBeenCalled();
});


test.each([
  { ...disabledStyle, enabled: 'false' },
  { ...disabledStyle, iframePropagation: 'false' },
  { cssUrl: style.cssUrl, cssFileName: style.cssFileName },
  { enabled: false, iframePropagation: false },
  { ...disabledStyle, cssUrl: 'https://example.com/other.css' },
  { ...disabledStyle, cssFileName: 'changed.css' },
  '',
])('disable rejects incomplete or nonboolean readback %j', async actual => {
  httpGet.mockResolvedValueOnce(response(saved))
    .mockResolvedValue(response({ ...saved, customThemeStyle: actual }));
  const result = await saveAppSettings(parseArgs(['APP_1', '--disable-custom-theme']), auth);
  expect(result).toMatchObject({ success: false, errorCode: 'APP_THEME_NOT_PERSISTED', themeVerification: { verified: false } });
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(uploadCustomThemeFile).not.toHaveBeenCalled();
});

test('disable fails before POST if latest existing CSS config cannot be parsed', async () => {
  httpGet.mockResolvedValue(response({ ...saved, customThemeStyle: '[]' }));
  await expect(saveAppSettings(parseArgs(['APP_1', '--disable-custom-theme']), auth))
    .rejects.toMatchObject({ code: 'APP_CUSTOM_THEME_CONFIG_INVALID' });
  expect(httpPost).not.toHaveBeenCalled();
});


test('disable detects unexpected navigation or logo changes after save', async () => {
  const current = { ...saved, layoutDirection: 'slide', logoSource: 'customImage', homepageLogo: 'https://example.com/logo.png' };
  httpGet.mockResolvedValueOnce(response(current)).mockResolvedValue(response({ ...current,
    customThemeStyle: disabledStyle, layoutDirection: 'ver', homepageLogo: '' }));
  const result = await saveAppSettings(parseArgs(['APP_1', '--disable-custom-theme']), auth);
  expect(result).toMatchObject({ success: false, errorCode: 'APP_NAVIGATION_NOT_PERSISTED',
    themeVerification: { verified: true }, navigationVerification: { verified: false,
      expected: { layoutDirection: 'slide', homepageLogo: current.homepageLogo },
      actual: { layoutDirection: 'ver', homepageLogo: '' } } });
});
