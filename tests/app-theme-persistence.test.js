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

beforeEach(() => {
  jest.clearAllMocks();
  createAuthRef.mockReturnValue(auth);
  httpPost.mockResolvedValue(response(true));
  uploadCustomThemeFile.mockResolvedValue(response({ url: style.cssUrl, name: style.cssFileName }));
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
    COLOUR: 'custom', THEME_COLOR: 'rgb(200, 155, 90)', CUSTOM_THEME_STYLE: style,
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
