'use strict';

const {
  isBrowserMissingError,
  BROWSER_MISSING_HINT,
  slugify,
  normalizeCookies,
} = require('../scripts/eval/screenshot');

describe('eval screenshot', () => {
  test('isBrowserMissingError 识别浏览器二进制缺失横幅', () => {
    expect(isBrowserMissingError("browserType.launch: Executable doesn't exist at /x/chrome")).toBe(true);
    expect(isBrowserMissingError('Please run the following command to download new browsers')).toBe(true);
    expect(isBrowserMissingError('npx playwright install')).toBe(true);
    expect(isBrowserMissingError('chrome-headless-shell not found')).toBe(true);
  });

  test('isBrowserMissingError 对普通错误返回 false', () => {
    expect(isBrowserMissingError('net::ERR_CONNECTION_REFUSED')).toBe(false);
    expect(isBrowserMissingError('Timeout 30000ms exceeded')).toBe(false);
    expect(isBrowserMissingError('')).toBe(false);
    expect(isBrowserMissingError()).toBe(false);
  });

  test('BROWSER_MISSING_HINT 给出可执行的修复指引', () => {
    expect(BROWSER_MISSING_HINT).toMatch(/playwright install/);
  });

  test('slugify / normalizeCookies 基础行为保持', () => {
    expect(slugify('Dashboard 页面!', 'x')).toBe('Dashboard');
    expect(normalizeCookies([{ name: 'a', value: 1, domain: '.x.com' }], 'https://x.com')[0])
      .toMatchObject({ name: 'a', value: '1', domain: '.x.com', path: '/' });
  });
});
