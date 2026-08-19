'use strict';

const http = require('http');

const {
  DEFAULT_PORT,
  FALLBACK_PORT,
  buildBridgePageUrl,
  parseArgs,
  startBridgeServer,
} = require('../lib/bridge/bridge');

function requestJson(baseUrl, options = {}) {
  const url = new URL(options.path || '/', baseUrl);
  const bodyText = options.body ? JSON.stringify(options.body) : '';

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        ...(options.origin ? { Origin: options.origin } : {}),
        ...(bodyText ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyText) } : {}),
        ...(options.token ? { 'X-OpenYida-Token': options.token } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: raw ? JSON.parse(raw) : null,
        });
      });
    });
    req.on('error', reject);
    if (bodyText) {
      req.write(bodyText);
    }
    req.end();
  });
}

function requestText(baseUrl, options = {}) {
  const url = new URL(options.path || '/', baseUrl);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        ...(options.origin ? { Origin: options.origin } : {}),
        ...(options.referer ? { Referer: options.referer } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: raw,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseJsonp(text, callbackName) {
  const prefix = `${callbackName}(`;
  expect(text.startsWith(prefix)).toBe(true);
  expect(text.endsWith(');')).toBe(true);
  return JSON.parse(text.slice(prefix.length, -2));
}

describe('bridge command helpers', () => {
  test('parseArgs uses magic default ports and accepts explicit options', () => {
    expect(parseArgs(['start']).options).toMatchObject({
      port: DEFAULT_PORT,
      explicitPort: false,
      origin: 'https://demo.aliwork.com',
    });

    expect(parseArgs(['start', '--port', String(FALLBACK_PORT), '--origin', 'https://example.com', '--token', 'page-token', '--json']).options)
      .toMatchObject({
        port: FALLBACK_PORT,
        explicitPort: true,
        origins: ['https://example.com'],
        pairingToken: 'page-token',
        json: true,
      });
  });

  test('buildBridgePageUrl puts pairing data in the URL fragment', () => {
    const pageUrl = buildBridgePageUrl('https://demo.aliwork.com/s/openyida', {
      localBaseUrl: 'http://127.0.0.1:6736',
      pairingToken: 'pair-token',
    });
    const parsed = new URL(pageUrl);
    const hashParams = new URLSearchParams(parsed.hash.slice(1));

    expect(parsed.search).toBe('');
    expect(hashParams.get('oy_bridge_url')).toBe('http://127.0.0.1:6736');
    expect(hashParams.get('oy_bridge_token')).toBe('pair-token');
  });
});

describe('bridge HTTP protocol', () => {
  let started;
  const origin = 'https://demo.aliwork.com';

  async function startTestBridge(extra = {}) {
    started = await startBridgeServer({
      host: '127.0.0.1',
      port: 0,
      explicitPort: true,
      origin,
      pageUrl: 'https://demo.aliwork.com/s/openyida',
      pairingToken: 'pair-token',
      accessToken: 'access-token',
      checkLogin: () => ({
        status: 'not_logged_in',
        can_auto_use: false,
        diagnostics: {
          projectRoot: '/secret/project',
          tokenFile: '/secret/auth-token-public.json',
          currentEnv: 'public',
          tokenFileFound: true,
          tokenFound: false,
          failure_reason: 'not_logged_in',
        },
      }),
      readFeedbackConfig: () => ({
        publicUrl: 'https://www.aliwork.com/o/openyida-feedback',
      }),
      ...extra,
    });
    return started.localBaseUrl;
  }

  afterEach(async () => {
    if (started && started.server.listening) {
      await new Promise(resolve => started.server.close(resolve));
    }
    started = null;
  });

  test('hello is public, pairing gates privileged actions, and CORS is exact-origin', async () => {
    const baseUrl = await startTestBridge();

    const hello = await requestJson(baseUrl, { path: '/v1/hello', origin });
    expect(hello.status).toBe(200);
    expect(hello.headers['access-control-allow-origin']).toBe(origin);
    expect(hello.body).toMatchObject({
      ok: true,
      protocol: 'openyida.local-bridge',
      paired: false,
    });

    const blocked = await requestJson(baseUrl, {
      path: '/v1/actions/login/check',
      method: 'POST',
      origin,
    });
    expect(blocked.status).toBe(401);

    const wrongOrigin = await requestJson(baseUrl, {
      path: '/v1/hello',
      origin: 'https://evil.example',
    });
    expect(wrongOrigin.status).toBe(403);

    const pair = await requestJson(baseUrl, {
      path: '/v1/pair',
      method: 'POST',
      origin,
      body: { token: 'pair-token' },
    });
    expect(pair.status).toBe(200);
    expect(pair.body.token).toBe('access-token');

    const login = await requestJson(baseUrl, {
      path: '/v1/actions/login/check',
      method: 'POST',
      origin,
      token: pair.body.token,
    });
    expect(login.status).toBe(200);
    expect(JSON.stringify(login.body)).not.toContain('/secret');
    expect(login.body.login.diagnostics).toMatchObject({
      currentEnv: 'public',
      tokenFileFound: true,
      tokenFound: false,
    });
  });

  test('login start and feedback-url return page-safe payloads', async () => {
    const baseUrl = await startTestBridge({
      startLogin: () => ({
        status: 'need_qr_scan',
        qr_url: 'https://login.example.test/qr?code=test',
        session_file: '/secret/session.json',
      }),
    });

    const pair = await requestJson(baseUrl, {
      path: '/v1/pair',
      method: 'POST',
      origin,
      body: { token: 'pair-token' },
    });

    const loginStart = await requestJson(baseUrl, {
      path: '/v1/actions/login/start',
      method: 'POST',
      origin,
      token: pair.body.token,
    });
    expect(loginStart.status).toBe(200);
    expect(loginStart.body.login).toMatchObject({
      status: 'need_qr_scan',
      qrUrl: 'https://login.example.test/qr?code=test',
      pollable: true,
    });
    expect(JSON.stringify(loginStart.body)).not.toContain('/secret/session.json');

    const feedback = await requestJson(baseUrl, {
      path: '/v1/actions/feedback-url',
      method: 'POST',
      origin,
      token: pair.body.token,
      body: {
        tool: 'Codex',
        session: 'secret-thread',
        reason: 'login_loop',
      },
    });
    expect(feedback.status).toBe(200);
    expect(feedback.body.url).toContain('https://www.aliwork.com/o/openyida-feedback?oy_meta=');
    expect(feedback.body.url).not.toContain('secret-thread');
    expect(feedback.body.metadata.session).toMatch(/^anon_/);
  });

  test('default login start returns a non-pollable token payload', async () => {
    const baseUrl = await startTestBridge();

    const pair = await requestJson(baseUrl, {
      path: '/v1/pair',
      method: 'POST',
      origin,
      body: { token: 'pair-token' },
    });

    const loginStart = await requestJson(baseUrl, {
      path: '/v1/actions/login/start',
      method: 'POST',
      origin,
      token: pair.body.token,
    });

    expect(loginStart.status).toBe(200);
    expect(loginStart.body.login).toMatchObject({
      status: 'token_login_required',
      authMode: 'token',
      canAutoUse: false,
      pollable: false,
      loginSessionId: null,
    });
    expect(loginStart.body.login).not.toHaveProperty('qrUrl');
    expect(loginStart.body.login).not.toHaveProperty('pollIntervalMs');
  });

  test('create-app action is authenticated and returns sanitized app payload', async () => {
    const baseUrl = await startTestBridge({
      createApp: (params) => ({
        success: true,
        appType: 'APP_BRIDGE_TEST',
        appName: params.appName,
        corpId: 'corp-secret-123456',
        url: 'https://www.aliwork.com/APP_BRIDGE_TEST/admin',
      }),
    });

    const blocked = await requestJson(baseUrl, {
      path: '/v1/actions/create-app',
      method: 'POST',
      origin,
      body: {
        appName: '客户管理',
      },
    });
    expect(blocked.status).toBe(401);

    const pair = await requestJson(baseUrl, {
      path: '/v1/pair',
      method: 'POST',
      origin,
      body: { token: 'pair-token' },
    });

    const created = await requestJson(baseUrl, {
      path: '/v1/actions/create-app',
      method: 'POST',
      origin,
      token: pair.body.token,
      body: {
        appName: '客户管理',
        description: '销售客户跟进',
      },
    });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      ok: true,
      action: 'openyida.create-app',
      app: {
        success: true,
        appName: '客户管理',
        appType: 'APP_BRIDGE_TEST',
        url: 'https://www.aliwork.com/APP_BRIDGE_TEST/workbench',
        workbenchUrl: 'https://www.aliwork.com/APP_BRIDGE_TEST/workbench',
      },
    });
    expect(created.body.app.corpId).toBe('corp-s...3456');
    expect(JSON.stringify(created.body)).not.toContain('corp-secret-123456');
  });

  test('app-list action is authenticated and returns whitelisted app fields', async () => {
    const baseUrl = await startTestBridge({
      listApps: () => ([
        {
          appName: '售后工单',
          appType: 'APP_AFTER_SALES',
          systemLink: 'https://www.aliwork.com/APP_AFTER_SALES/workbench',
          access_token: 'secret-token',
        },
        {
          name: '异常链接',
          appType: 'APP_UNSAFE_LINK',
          url: 'javascript:alert(1)',
          cookie: 'secret-cookie',
        },
      ]),
    });

    const blocked = await requestJson(baseUrl, {
      path: '/v1/actions/app-list',
      method: 'POST',
      origin,
      body: { size: 20 },
    });
    expect(blocked.status).toBe(401);

    const pair = await requestJson(baseUrl, {
      path: '/v1/pair',
      method: 'POST',
      origin,
      body: { token: 'pair-token' },
    });

    const listed = await requestJson(baseUrl, {
      path: '/v1/actions/app-list',
      method: 'POST',
      origin,
      token: pair.body.token,
      body: { size: 20 },
    });
    expect(listed.status).toBe(200);
    expect(listed.body).toMatchObject({
      ok: true,
      action: 'openyida.app-list',
      count: 2,
      apps: [
        {
          appName: '售后工单',
          appType: 'APP_AFTER_SALES',
          systemLink: 'https://www.aliwork.com/APP_AFTER_SALES/workbench',
        },
        {
          appName: '异常链接',
          appType: 'APP_UNSAFE_LINK',
          systemLink: '',
        },
      ],
    });
    expect(JSON.stringify(listed.body)).not.toContain('secret-token');
    expect(JSON.stringify(listed.body)).not.toContain('secret-cookie');
  });

  test('jsonp fallback pairs and calls authenticated actions without fetch', async () => {
    const baseUrl = await startTestBridge();
    const referer = 'https://demo.aliwork.com/s/openyida#oy_bridge=1';

    const hello = await requestText(baseUrl, {
      path: '/v1/hello?callback=oyHello',
      referer,
    });
    expect(hello.status).toBe(200);
    expect(hello.headers['content-type']).toContain('application/javascript');
    expect(parseJsonp(hello.body, 'oyHello')).toMatchObject({
      ok: true,
      paired: false,
    });

    const blockedReferer = await requestText(baseUrl, {
      path: '/v1/hello?callback=oyHello',
      referer: 'https://evil.example/page',
    });
    expect(parseJsonp(blockedReferer.body, 'oyHello')).toMatchObject({
      ok: false,
      error: 'origin_not_allowed',
    });

    const pair = await requestText(baseUrl, {
      path: '/v1/pair?callback=oyPair&token=pair-token',
      referer,
    });
    const pairBody = parseJsonp(pair.body, 'oyPair');
    expect(pairBody).toMatchObject({
      ok: true,
      token: 'access-token',
    });

    const login = await requestText(baseUrl, {
      path: '/v1/actions/login/check?callback=oyLogin&accessToken=access-token',
      referer,
    });
    const loginBody = parseJsonp(login.body, 'oyLogin');
    expect(loginBody.statusCode).toBe(200);
    expect(loginBody.login.diagnostics).toMatchObject({
      currentEnv: 'public',
      tokenFileFound: true,
    });
    expect(JSON.stringify(loginBody)).not.toContain('/secret');
  });

  test('default login check reports env token mode without secret leakage', async () => {
    const originalAuthMode = process.env.OPENYIDA_AUTH_MODE;
    const originalAccessToken = process.env.OPENYIDA_ACCESS_TOKEN;
    const originalEndpoint = process.env.OPENYIDA_ENDPOINT;
    const originalCorpId = process.env.OPENYIDA_TOKEN_CORP_ID;
    const originalUserId = process.env.OPENYIDA_TOKEN_USER_ID;
    try {
      process.env.OPENYIDA_AUTH_MODE = 'token';
      process.env.OPENYIDA_ACCESS_TOKEN = 'bridge-access-token';
      process.env.OPENYIDA_ENDPOINT = 'https://bridge.example.test';
      process.env.OPENYIDA_TOKEN_CORP_ID = 'corpBridge';
      process.env.OPENYIDA_TOKEN_USER_ID = 'userBridge';
      const baseUrl = await startBridgeServer({
        host: '127.0.0.1',
        port: 0,
        explicitPort: true,
        origin,
        pageUrl: 'https://demo.aliwork.com/s/openyida',
        pairingToken: 'pair-token',
        accessToken: 'access-token',
      }).then((server) => {
        started = server;
        return server.localBaseUrl;
      });

      const pair = await requestJson(baseUrl, {
        path: '/v1/pair',
        method: 'POST',
        origin,
        body: { token: 'pair-token' },
      });
      const login = await requestJson(baseUrl, {
        path: '/v1/actions/login/check',
        method: 'POST',
        origin,
        token: pair.body.token,
      });
      expect(login.body.login).toMatchObject({
        authMode: 'token',
        authSource: 'env',
        status: 'ok',
        canAutoUse: true,
        loggedIn: true,
      });
      expect(JSON.stringify(login.body.login)).not.toContain('bridge-access-token');
    } finally {
      if (originalAuthMode === undefined) {
        delete process.env.OPENYIDA_AUTH_MODE;
      } else {
        process.env.OPENYIDA_AUTH_MODE = originalAuthMode;
      }
      if (originalAccessToken === undefined) {
        delete process.env.OPENYIDA_ACCESS_TOKEN;
      } else {
        process.env.OPENYIDA_ACCESS_TOKEN = originalAccessToken;
      }
      if (originalEndpoint === undefined) {
        delete process.env.OPENYIDA_ENDPOINT;
      } else {
        process.env.OPENYIDA_ENDPOINT = originalEndpoint;
      }
      if (originalCorpId === undefined) {
        delete process.env.OPENYIDA_TOKEN_CORP_ID;
      } else {
        process.env.OPENYIDA_TOKEN_CORP_ID = originalCorpId;
      }
      if (originalUserId === undefined) {
        delete process.env.OPENYIDA_TOKEN_USER_ID;
      } else {
        process.env.OPENYIDA_TOKEN_USER_ID = originalUserId;
      }
    }
  });
});
