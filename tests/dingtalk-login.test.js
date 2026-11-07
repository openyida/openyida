'use strict';

const { PassThrough } = require('stream');
const { selectDingtalkLoginOrigin } = require('../lib/auth/dingtalk-login');
const { DEFAULT_INTERNATIONAL_ENV, inferLoginUrlForBaseUrl } = require('../lib/core/env-manager');

const DOMESTIC = 'https://login.dingtalk.com';
const INTERNATIONAL = 'https://login.dingtalk.io';
const SITE = 'https://www.yidaapps.com';

describe('overseas YiDA DingTalk account selection', () => {
  function terminal() {
    const input = new PassThrough();
    const output = new PassThrough();
    input.isTTY = output.isTTY = true;
    let text = '';
    output.on('data', chunk => { text += chunk; });
    return { input, output, text: () => text };
  }

  test('the international service entry does not force an account system', () => {
    expect(DEFAULT_INTERNATIONAL_ENV.baseUrl).toBe(SITE);
    expect(DEFAULT_INTERNATIONAL_ENV.loginUrl).toBe(`${SITE}/workPlatform`);
    expect(inferLoginUrlForBaseUrl(SITE)).toBe(`${SITE}/workPlatform`);
    expect(inferLoginUrlForBaseUrl('https://customer.yidaapps.com')).toBe('https://customer.yidaapps.com/workPlatform');
  });

  test.each([SITE, 'https://customer.yidaapps.com', 'https://www.aliwork.com'])('non-interactive %s defaults to domestic DingTalk', async baseUrl => {
    await expect(selectDingtalkLoginOrigin({ baseUrl, env: {}, input: { isTTY: false } })).resolves.toBe(DOMESTIC);
  });

  test.each([['', DOMESTIC], ['1', DOMESTIC], ['2', INTERNATIONAL]])('terminal selection %j selects the requested account system', async (answer, expected) => {
    const io = terminal();
    const choice = selectDingtalkLoginOrigin({ ...io, baseUrl: SITE, env: {} });
    expect(io.text()).toContain('1.');
    expect(io.text()).toContain('2.');
    io.input.write(`${answer}\n`);
    await expect(choice).resolves.toBe(expected);
  });

  test('invalid terminal input asks again without choosing international DingTalk', async () => {
    const io = terminal();
    const choice = selectDingtalkLoginOrigin({ ...io, baseUrl: SITE, env: {} });
    io.input.write('invalid\n');
    io.input.write('\n');
    await expect(choice).resolves.toBe(DOMESTIC);
  });

  test('closing the selection cancels authorization', async () => {
    const io = terminal();
    const choice = selectDingtalkLoginOrigin({ ...io, baseUrl: SITE, env: {} });
    const assertion = expect(choice).rejects.toMatchObject({ code: 'LOGIN_CANCELLED' });
    io.input.end();
    await assertion;
  });

  test('quiet calls do not wait for terminal input', async () => {
    const io = terminal();
    await expect(selectDingtalkLoginOrigin({ ...io, baseUrl: SITE, env: {}, quiet: true })).resolves.toBe(DOMESTIC);
    expect(io.text()).toBe('');
  });

  test.each([['domestic', DOMESTIC], ['intl', INTERNATIONAL]])('explicit %s overrides an OAuth entry and skips the terminal choice', async (dingtalkVersion, expected) => {
    const io = terminal();
    await expect(selectDingtalkLoginOrigin({ ...io, baseUrl: SITE, dingtalkVersion,
      env: { OPENYIDA_LOGIN_URL: `${INTERNATIONAL}/oauth2/auth` } })).resolves.toBe(expected);
    expect(io.text()).toBe('');
  });

  test.each([DOMESTIC, INTERNATIONAL])('explicit OAuth entry %s preserves its account system', async origin => {
    const io = terminal();
    await expect(selectDingtalkLoginOrigin({ ...io, baseUrl: SITE,
      env: { OPENYIDA_LOGIN_URL: `${origin}/oauth2/auth` } })).resolves.toBe(origin);
    expect(io.text()).toBe('');
  });

  test('unsupported versions and login origins fail before authorization', async () => {
    await expect(selectDingtalkLoginOrigin({ dingtalkVersion: 'unknown' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENTS' });
    await expect(selectDingtalkLoginOrigin({ loginOrigin: 'https://example.com' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENTS' });
    await expect(selectDingtalkLoginOrigin({ baseUrl: SITE, env: { OPENYIDA_LOGIN_URL: 'https://login.dingtalk.io.example.com/oauth2/auth' }, input: { isTTY: false } })).resolves.toBe(DOMESTIC);
  });
});
