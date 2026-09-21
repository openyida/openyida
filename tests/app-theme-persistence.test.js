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
const auth = { baseUrl: 'https://example.com', csrfToken: 'csrf' };
const style = { enabled: true, iframePropagation: false, cssUrl: 'https://example.com/desert.css', cssFileName: 'desert.css' };
const saved = { colour: 'custom', themeColor: '#C89B5A', customThemeStyle: JSON.stringify(style), hideAppNav: 'y' };
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
  uploadCustomThemeFile.mockResolvedValue(response({ url: style.cssUrl, name: style.cssFileName }));
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

test('theme upload is followed by reading fresh settings, saving updateApp and checking the persisted resource', async () => {
  httpGet.mockResolvedValueOnce(response({ colour: 'podBlue', hideAppNav: 'y', navTheme: 'dark', layoutDirection: 'top', logoSource: 'customImage' }))
    .mockResolvedValueOnce(response(saved));
  const result = await applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth);
  expect(uploadCustomThemeFile.mock.invocationCallOrder[0]).toBeLessThan(httpGet.mock.invocationCallOrder[0]);
  expect(httpPost.mock.calls[0][1]).toContain('/APP_1/query/app/updateApp.json');
  expect(querystring.parse(httpPost.mock.calls[0][2])).toMatchObject({
    colour: 'custom', themeColor: '#C89B5A', customThemeStyle: JSON.stringify(style), hideAppNav: 'y',
    navTheme: 'dark', layoutDirection: 'top', logoSource: 'customImage',
  });
  expect(result.themeVerification).toEqual({ verified: true, colour: 'custom', themeColor: '#C89B5A', customThemeStyle: style });
});

test('CLI update-app --theme-file exposes the verified resource in its success output', async () => {
  httpGet.mockResolvedValueOnce(response({ colour: 'podBlue' })).mockResolvedValueOnce(response(saved));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['APP_1', '--theme-file', './desert.css']);
    const output = JSON.parse(log.mock.calls.map(([line]) => line).filter((line) => typeof line === 'string' && line.startsWith('{')).pop());
    expect(output).toMatchObject({ success: true, themeVerification: { verified: true, customThemeStyle: style } });
  } finally { log.mockRestore(); }
});

test('HTTP success with an unchanged platform theme is a failure; retries only read', async () => {
  httpGet.mockResolvedValue(response({ colour: 'podBlue', themeColor: '', customThemeStyle: '' }));
  const result = await applyCustomThemeUpdate('APP_1', { themeFile: './desert.css' }, auth);
  expect(result).toMatchObject({ success: false, errorCode: 'APP_THEME_NOT_PERSISTED', themeVerification: { verified: false } });
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(uploadCustomThemeFile).toHaveBeenCalledTimes(1);
  expect(httpGet).toHaveBeenCalledTimes(4);
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
  httpGet.mockResolvedValue(response({ colour: 'custom', themeColor: '#C89B5A', customThemeStyle: '' }));
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
