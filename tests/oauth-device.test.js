'use strict';

const http = require('http');

function oauthError(statusCode, payload) {
  const error = new Error(`http_${statusCode}`);
  error.statusCode = statusCode;
  error.payload = payload;
  return error;
}

function loadDeviceModule(requestJson) {
  jest.resetModules();
  jest.doMock('../lib/auth/token-auth', () => ({
    requestJson,
    getTokenPayload: (response) => {
      if (!response || typeof response !== 'object') { return response || {}; }
      return response.data || response.content || response;
    },
  }));
  return require('../lib/auth/oauth-device');
}

describe('OAuth device authorization flow', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.dontMock('../lib/auth/token-auth');
    jest.resetModules();
  });

  test('uses the camelCase device contract and resolves relative verification URLs', async () => {
    const requestJson = jest.fn()
      .mockResolvedValueOnce({
        content: {
          deviceCode: 'device-1',
          userCode: 'ABCD-EFGH',
          verificationUri: '/openapi/cli/v1/auth/device/verify',
          verificationUriComplete: '/openapi/cli/v1/auth/device/verify?userCode=ABCD-EFGH',
          expiresIn: 60,
          interval: 0.001,
        },
      })
      .mockResolvedValueOnce({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    const { runDeviceCodeFlow, DEVICE_GRANT_TYPE } = loadDeviceModule(requestJson);
    const states = [];

    const result = await runDeviceCodeFlow({
      authBaseUrl: 'https://example.test/openapi/cli/v1/auth',
      clientId: 'client-1',
      envHint: 'pre',
      quiet: true,
      onState: state => states.push(state),
    });

    expect(requestJson).toHaveBeenNthCalledWith(1, 'POST',
      'https://example.test/openapi/cli/v1/auth/device/code', {
        clientId: 'client-1',
        envHint: 'pre',
      }, {}, expect.objectContaining({ timeoutMs: expect.any(Number) }));
    expect(requestJson).toHaveBeenNthCalledWith(2, 'POST',
      'https://example.test/openapi/cli/v1/auth/device/token', {
        grantType: DEVICE_GRANT_TYPE,
        deviceCode: 'device-1',
        clientId: 'client-1',
      }, {}, expect.objectContaining({ timeoutMs: expect.any(Number) }));
    expect(states[0]).toMatchObject({
      state: 'awaiting_verification',
      verificationUri: 'https://example.test/openapi/cli/v1/auth/device/verify',
      verificationUriComplete:
        'https://example.test/openapi/cli/v1/auth/device/verify?userCode=ABCD-EFGH',
      userCode: 'ABCD-EFGH',
      expiresIn: 60,
    });
    expect(result).toMatchObject({ accessToken: 'access-token' });
  });

  test('stops immediately for permanent OAuth errors', async () => {
    const requestJson = jest.fn().mockRejectedValue(oauthError(400, {
      error: 'invalid_request',
      errorDescription: 'deviceCode is malformed',
    }));
    const { pollDeviceToken } = loadDeviceModule(requestJson);

    await expect(pollDeviceToken({
      authBaseUrl: 'https://example.test/auth',
      clientId: 'client-1',
      deviceCode: 'bad-device',
      intervalMs: 1,
      timeoutMs: 1000,
    })).rejects.toMatchObject({
      code: 'invalid_request',
      message: 'deviceCode is malformed',
    });
    expect(requestJson).toHaveBeenCalledTimes(1);
  });

  test('retries an unstructured gateway 400 and can recover', async () => {
    const requestJson = jest.fn()
      .mockRejectedValueOnce(oauthError(400, { raw: 'temporary gateway response' }))
      .mockResolvedValueOnce({ accessToken: 'recovered-token' });
    const { pollDeviceToken } = loadDeviceModule(requestJson);
    const states = [];

    await expect(pollDeviceToken({
      authBaseUrl: 'https://example.test/auth',
      clientId: 'client-1',
      deviceCode: 'device-1',
      intervalMs: 1,
      timeoutMs: 1000,
      onState: state => states.push(state),
    })).resolves.toMatchObject({ accessToken: 'recovered-token' });
    expect(states).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'poll_retry', statusCode: 400 }),
    ]));
  });

  test('redacts sensitive data in poll_retry body', async () => {
    const requestJson = jest.fn()
      .mockRejectedValueOnce(oauthError(400, { raw: 'token=abc123secret&Cookie: session=xyz' }))
      .mockResolvedValueOnce({ accessToken: 'safe-token' });
    const { pollDeviceToken } = loadDeviceModule(requestJson);
    const states = [];

    await pollDeviceToken({
      authBaseUrl: 'https://example.test/auth',
      clientId: 'client-1',
      deviceCode: 'device-1',
      intervalMs: 1,
      timeoutMs: 1000,
      onState: state => states.push(state),
    });

    const retryState = states.find(s => s.state === 'poll_retry');
    expect(retryState).toBeDefined();
    expect(retryState.body).not.toMatch(/abc123secret/);
    expect(retryState.body).not.toMatch(/session=xyz/);
    expect(retryState.body).toMatch(/\*\*\*/);
  });

  test('does not hang when the real /device/token HTTP response never completes', async () => {
    const server = http.createServer((request, response) => {
      if (request.url === '/auth/device/code') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          deviceCode: 'device-1',
          userCode: 'ABCD-EFGH',
          verificationUri: 'https://example.test/verify',
          expiresIn: 600,
          interval: 0.001,
        }));
      }
      // Intentionally leave /device/token connected without a response.
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
      jest.resetModules();
      const { runDeviceCodeFlow } = require('../lib/auth/oauth-device');
      const startTime = Date.now();
      await expect(runDeviceCodeFlow({
        authBaseUrl: `http://127.0.0.1:${port}/auth`,
        clientId: 'client-1',
        quiet: true,
        timeoutMs: 50,
      })).rejects.toMatchObject({ code: 'device_timeout' });
      expect(Date.now() - startTime).toBeLessThan(5000);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('does not hang when the real /device/code HTTP response never completes', async () => {
    const server = http.createServer(() => {
      // Intentionally accept the request without sending a response.
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
      jest.resetModules();
      const { runDeviceCodeFlow } = require('../lib/auth/oauth-device');
      await expect(runDeviceCodeFlow({
        authBaseUrl: `http://127.0.0.1:${port}/auth`,
        clientId: 'client-1',
        quiet: true,
        timeoutMs: 50,
      })).rejects.toMatchObject({ code: 'device_timeout' });
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('applies slow_down to subsequent polling', async () => {
    jest.useFakeTimers();
    const requestJson = jest.fn()
      .mockRejectedValueOnce(oauthError(400, { error: 'slow_down' }))
      .mockResolvedValueOnce({ accessToken: 'access-token' });
    const { pollDeviceToken } = loadDeviceModule(requestJson);
    const states = [];

    const resultPromise = pollDeviceToken({
      authBaseUrl: 'https://example.test/auth',
      clientId: 'client-1',
      deviceCode: 'device-1',
      intervalMs: 1000,
      timeoutMs: 10000,
      onState: state => states.push(state),
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(6000);

    await expect(resultPromise).resolves.toMatchObject({ accessToken: 'access-token' });
    expect(states).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'slow_down', intervalMs: 6000 }),
    ]));
  });

  test('caps the server device lifetime with the caller timeout', async () => {
    jest.useFakeTimers();
    const requestJson = jest.fn()
      .mockResolvedValueOnce({
        deviceCode: 'device-1',
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://example.test/verify',
        expiresIn: 600,
        interval: 0.001,
      })
      .mockRejectedValue(oauthError(400, { error: 'authorization_pending' }));
    const { runDeviceCodeFlow } = loadDeviceModule(requestJson);

    const resultPromise = runDeviceCodeFlow({
      authBaseUrl: 'https://example.test/auth',
      clientId: 'client-1',
      quiet: true,
      timeoutMs: 30,
    });
    const rejection = expect(resultPromise).rejects.toMatchObject({ code: 'device_timeout' });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(30);

    await rejection;
  });

  test('deducts device-code request time from the polling budget', async () => {
    jest.useFakeTimers();
    const requestJson = jest.fn()
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({
        deviceCode: 'device-1',
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://example.test/verify',
        expiresIn: 600,
        interval: 0.001,
      }), 20)))
      .mockResolvedValueOnce({ accessToken: 'access-token' });
    const { runDeviceCodeFlow } = loadDeviceModule(requestJson);

    const resultPromise = runDeviceCodeFlow({
      authBaseUrl: 'https://example.test/auth',
      clientId: 'client-1',
      quiet: true,
      timeoutMs: 30,
    });
    await jest.advanceTimersByTimeAsync(20);
    await expect(resultPromise).resolves.toMatchObject({ accessToken: 'access-token' });

    const codeBudget = requestJson.mock.calls[0][4].timeoutMs;
    const pollBudget = requestJson.mock.calls[1][4].timeoutMs;
    expect(codeBudget).toBe(30);
    expect(pollBudget).toBeLessThanOrEqual(10);
  });
});
