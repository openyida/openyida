'use strict';

const querystring = require('querystring');
const { parseCreateAppArgs } = require('../lib/app/create-app');
const { createAppResource, updateAppResource } = require('../lib/app/services/app-service');

describe('create-app argument parsing', () => {
  test('keeps backward-compatible positional arguments', () => {
    const parsed = parseCreateAppArgs([
      'CRM',
      'Customer management',
      'xian-qiye',
      '#00B853',
      'deepBlue',
      'light',
      'ver',
    ]);

    expect(parsed).toMatchObject({
      appName: 'CRM',
      description: 'Customer management',
      icon: 'xian-qiye',
      iconColor: '#00B853',
      colour: 'deepBlue',
      navTheme: 'light',
      layoutDirection: 'ver',
    });
  });

  test('supports agent-friendly named options', () => {
    const parsed = parseCreateAppArgs([
      '--name', '电商经营管理看板',
      '--desc', 'E-commerce operations management dashboard demo',
      '--theme', 'deepBlue',
      '--locale', 'ja_JP',
    ]);

    expect(parsed).toMatchObject({
      appName: '电商经营管理看板',
      description: 'E-commerce operations management dashboard demo',
      colour: 'deepBlue',
      icon: 'xian-yingyong',
      iconColor: '#0089FF',
      navTheme: 'dark',
      layoutDirection: 'slide',
      locale: 'ja_JP',
    });
  });

  test('rejects unknown flags instead of treating them as the app name', () => {
    expect(() => parseCreateAppArgs(['--unknown'])).toThrow('Unknown option: --unknown');
  });

  test('rejects unsupported locales', () => {
    expect(() => parseCreateAppArgs(['--name', 'CRM', '--locale', 'ko_KR'])).toThrow('Unsupported locale: ko_KR');
  });
});

describe('shared app service', () => {
  test('creates and updates without writing stdout or changing legacy payload inputs', async () => {
    const requests = [];
    const authRef = {
      baseUrl: 'https://example.test',
      csrfToken: 'csrf',
      cookies: [],
    };
    const services = {
      requestWithAutoLogin: (request, ref) => request(ref),
      httpPost: async (baseUrl, requestPath, body) => {
        requests.push({ requestPath, body });
        if (requestPath.includes('queryCorpAppConfig')) {
          return { success: true, content: {} };
        }
        if (requestPath.includes('registerApp')) {
          return { success: true, content: 'APP_SERVICE' };
        }
        return { success: true };
      },
    };

    const created = await createAppResource({ authRef, services }, {
      appName: 'CRM',
      description: 'CRM',
      contentLocale: 'zh_CN',
    });
    const updated = await updateAppResource({ authRef, services }, {
      appType: created.appType,
      name: 'CRM 2',
    });

    expect(created.appType).toBe('APP_SERVICE');
    expect(updated.appType).toBe('APP_SERVICE');
    expect(requests.map(item => item.requestPath)).toEqual(expect.arrayContaining([
      '/query/app/registerApp.json',
      expect.stringContaining('/query/app/updateAppName.json'),
    ]));
  });

  test('rebuilds app update auth data with the refreshed CSRF context', async () => {
    const requests = [];
    const authRef = {
      baseUrl: 'https://old.example.test',
      csrfToken: 'csrf-old',
      cookies: [{ name: 'session', value: 'old' }],
    };
    const services = {
      async requestWithAutoLogin(request, ref) {
        const first = await request(ref);
        expect(first).toEqual({ __csrfExpired: true });
        ref.baseUrl = 'https://new.example.test';
        ref.csrfToken = 'csrf-new';
        ref.cookies = [{ name: 'session', value: 'new' }];
        return request(ref);
      },
      async httpPost(baseUrl, requestPath, body, cookies) {
        requests.push({
          baseUrl,
          cookies,
          data: querystring.parse(body),
          requestPath,
        });
        return requests.length === 1 ? { __csrfExpired: true } : { success: true };
      },
    };

    const updated = await updateAppResource({ authRef, services }, {
      appType: 'APP_SERVICE',
      name: 'CRM refreshed',
    });

    expect(updated.appType).toBe('APP_SERVICE');
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      baseUrl: 'https://old.example.test',
      cookies: [{ name: 'session', value: 'old' }],
      data: { _csrf_token: 'csrf-old', appType: 'APP_SERVICE' },
    });
    expect(requests[1]).toMatchObject({
      baseUrl: 'https://new.example.test',
      cookies: [{ name: 'session', value: 'new' }],
      data: { _csrf_token: 'csrf-new', appType: 'APP_SERVICE' },
    });
  });

  test('apply lock loss after advisory config read is never swallowed and prevents register', async () => {
    const httpPost = jest.fn().mockResolvedValue({ success: true, content: {} });
    const requestWithAutoLogin = jest.fn();
    let completedPrimitive = 0;
    const lost = Object.assign(new Error('lock lost'), { code: 'SCHEMA_APPLY_LOCK_LOST' });

    await expect(createAppResource({
      authRef: { baseUrl: 'https://example.test', csrfToken: 'csrf', cookies: [] },
      services: { httpPost, requestWithAutoLogin },
      assertRemoteDispatchBoundary(phase) {
        if (phase === 'after' && ++completedPrimitive === 1) {
          throw lost;
        }
      },
    }, { appName: 'CRM' })).rejects.toBe(lost);

    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(httpPost.mock.calls[0][1]).toContain('queryCorpAppConfig');
    expect(requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test.each([
    ['login expiry', { __needLogin: true }],
    ['CSRF expiry', { __csrfExpired: true }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
  ])('schema apply app create never retries register after %s', async (_label, response) => {
    const httpPost = jest.fn(async (_baseUrl, requestPath) => (
      requestPath.includes('queryCorpAppConfig')
        ? { success: true, content: {} }
        : response
    ));
    const requestWithAutoLogin = jest.fn();

    await expect(createAppResource({
      authRef: { baseUrl: 'https://example.test', csrfToken: 'csrf', cookies: [] },
      services: { httpPost, requestWithAutoLogin },
      assertRemoteDispatchBoundary() {},
    }, { appName: 'CRM' })).rejects.toMatchObject({ code: 'APP_CREATE_FAILED' });

    expect(httpPost.mock.calls.filter(call => call[1] === '/query/app/registerApp.json')).toHaveLength(1);
    expect(requestWithAutoLogin).not.toHaveBeenCalled();
  });
});
