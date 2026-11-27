'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../lib/feedback/feedback');
const { loadTokenSession } = require('../lib/auth/token-store');

jest.mock('../lib/auth/token-store', () => ({
  ...jest.requireActual('../lib/auth/token-store'),
  loadTokenSession: jest.fn(),
}));

const REQUEST_ID = '5d0c5c43-39e3-412f-9065-8b65e8b51659';
const FEEDBACK_ID = 'OYF-9d82ac00-71bf-47bf-8ac7-a2c271dd2895';
const DIAGNOSTIC_REF = '576633a9-e042-4d51-8b71-ed21afc18699';
const BASE_URL = 'https://feedback-test.example.org';
const SESSION = { base_url: BASE_URL, access_token: 'test-bearer' };

describe('feedback customer intake', () => {
  let fetch;
  let log;
  let directory;
  let input;
  let args;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-feedback-intake-'));
    input = path.join(directory, 'feedback.json');
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Publish failed' }));
    args = ['submit', '--input', input, '--request-id', REQUEST_ID, '--json', '--confirm'];
    loadTokenSession.mockReturnValue(SESSION);
    fetch = jest.spyOn(globalThis, 'fetch');
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function reply(status, payload) {
    fetch.mockResolvedValueOnce({ status, json: async () => payload });
  }

  test.each([
    ['no session', null],
    ['expired token', { ...SESSION, expires_at: Date.now() - 1000 }],
    ['refresh token only', { base_url: BASE_URL, refresh_token: 'test-refresh' }],
  ])('returns the public login feedback form for %s in text and JSON', async (_, session) => {
    loadTokenSession.mockReturnValue(session);
    const publicUrl = 'https://xmtrf1.aliwork.com/o/openyida-login-75bacb3e';
    await run(['url']);
    expect(log.mock.lastCall[0]).toBe(publicUrl);
    await run(['url', '--json']);
    expect(JSON.parse(log.mock.lastCall[0])).toEqual({ success: true, url: publicUrl });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('keeps the tenant URL until the access token expires', async () => {
    loadTokenSession.mockReturnValue({ ...SESSION, expires_at: Date.now() + 30000 });
    await run(['url']);
    expect(log.mock.lastCall[0]).toBe(BASE_URL + '/openyida/feedback');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('legacy setup performs no writes and old config does not affect the controlled URL', async () => {
    fs.writeFileSync(input, JSON.stringify({ publicUrl: 'https://legacy.example.org/o/public' }));
    await expect(run(['setup', 'TEST_APP'])).rejects.toMatchObject({ code: 'FEEDBACK_SETUP_RETIRED' });
    await run(['url', '--config', input, '--diagnostics', 'private-context', '--json']);

    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ success: true, url: BASE_URL + '/openyida/feedback' });
  });

  test('rejects unconfirmed or invalid submissions before any HTTP call', async () => {
    await expect(run(args.slice(0, -1))).rejects.toMatchObject({ code: 'FEEDBACK_CONFIRMATION_REQUIRED' });
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Failure', corpId: 'attacker' }));
    await expect(run(args)).rejects.toMatchObject({ code: 'FEEDBACK_INPUT_INVALID' });
    fs.writeFileSync(input, 'x'.repeat(16 * 1024 + 1));
    await expect(run(args)).rejects.toMatchObject({ code: 'FEEDBACK_INPUT_TOO_LARGE' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('does not submit without a login session or forward credentials to an insecure origin', async () => {
    loadTokenSession.mockReturnValueOnce(null).mockReturnValueOnce({ ...SESSION, base_url: 'http://invalid.test' });
    await expect(run(args)).rejects.toMatchObject({ code: 'FEEDBACK_AUTH_REQUIRED' });
    await expect(run(args)).rejects.toMatchObject({ code: 'FEEDBACK_ENDPOINT_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([false, true])('only sends approved fields and returns the confirmed receipt (diagnostic: %s)', async diagnostic => {
    const body = { type: 'error', description: 'Publish failed' };
    if (diagnostic) {
      body.diagnosticRef = DIAGNOSTIC_REF;
    }
    fs.writeFileSync(input, JSON.stringify(body));
    reply(201, { status: 'submitted', feedbackId: FEEDBACK_ID, internalInstanceId: 'do-not-output' });

    await run(args);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe(BASE_URL + '/openyida/feedback/submit.json');
    expect(request).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: 'Bearer test-bearer', Referer: BASE_URL + '/openyida/feedback', 'Idempotency-Key': REQUEST_ID },
    });
    expect(JSON.parse(request.body)).toEqual(body);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      success: true, status: 'submitted', feedbackId: FEEDBACK_ID, requestId: REQUEST_ID,
    });
  });

  test('binds the feedback Referer and credential to the same captured session target', async () => {
    const target = 'https://tenant-feedback.example.org:8443';
    loadTokenSession.mockClear().mockReturnValueOnce({ ...SESSION, base_url: target, access_token: 'target-bearer' })
      .mockReturnValue({ ...SESSION, base_url: 'https://changed-profile.example.org', access_token: 'other-bearer' });
    reply(201, { status: 'submitted', feedbackId: FEEDBACK_ID });

    await run(args);

    expect(loadTokenSession).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe(target + '/openyida/feedback/submit.json');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer target-bearer', Referer: target + '/openyida/feedback' });
    expect(new URL(request.headers.Referer).origin).toBe(new URL(url).origin);
    expect(request.redirect).toBe('error');
  });

  describe('host-injected credentials', () => {
    const store = jest.requireActual('../lib/auth/token-store');
    const endpoint = 'https://tenant.example.org:8443';
    const cachedOrigin = 'https://tenant.example.org';

    function useSession(env) {
      jest.replaceProperty(process, 'env', env);
      const options = { env, envName: 'public', projectRoot: directory, authDir: directory };
      loadTokenSession.mockImplementation(() => store.loadTokenSession(options));
      reply(201, { status: 'submitted', feedbackId: FEEDBACK_ID });
      return options;
    }

    test.each(['token', ''])('uses the injected origin for preview and POST despite a same-corp cache (mode %s)', async mode => {
      const options = useSession({
        OPENYIDA_AUTH_MODE: mode, OPENYIDA_ACCESS_TOKEN: 'host-access',
        OPENYIDA_ENDPOINT: endpoint, OPENYIDA_TOKEN_CORP_ID: 'test-corp',
      });
      store.saveBusinessContext({ corp_id: 'test-corp', base_url: cachedOrigin }, options);
      expect(store.loadTokenSession(options).base_url).toBe(cachedOrigin);

      await run([...args.slice(0, -1), '--preview']);
      const review = JSON.parse(log.mock.lastCall[0]);
      expect(review.destination).toBe(endpoint);
      expect(fetch).not.toHaveBeenCalled();
      await run([...args, '--review-digest', review.reviewDigest]);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe(endpoint + '/openyida/feedback/submit.json');
      expect(fetch.mock.calls[0][1].headers).toMatchObject({
        Authorization: 'Bearer host-access', Referer: endpoint + '/openyida/feedback',
      });
    });

    test.each([undefined, 'http://tenant.example.org'])('requires a trusted HTTPS endpoint before sending (%s)', async target => {
      const options = useSession({
        OPENYIDA_ACCESS_TOKEN: 'host-access', OPENYIDA_ENDPOINT: target, OPENYIDA_TOKEN_CORP_ID: 'test-corp',
      });
      store.saveBusinessContext({ corp_id: 'test-corp', base_url: cachedOrigin }, options);
      await expect(run(args)).rejects.toMatchObject({ code: 'FEEDBACK_ENDPOINT_INVALID' });
      expect(fetch).not.toHaveBeenCalled();
    });

    test('sends a rotated sandbox token to the endpoint its cache is keyed by', async () => {
      const options = useSession({
        OPENYIDA_AUTH_MODE: 'token', OPENYIDA_REFRESH_TOKEN: 'host-refresh',
        OPENYIDA_SANDBOX_BINDING_ID: 'sample-binding', OPENYIDA_ENDPOINT: endpoint,
      });
      store.saveTokenSession({ auth_source: 'env', access_token: 'rotated-access', base_url: cachedOrigin }, options);
      await run(args);
      expect(fetch.mock.calls[0][0]).toBe(endpoint + '/openyida/feedback/submit.json');
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer rotated-access');
    });

    test('uses a legacy project token in host mode only when its origin matches', async () => {
      const options = useSession({ OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ENDPOINT: endpoint });
      const legacy = { access_token: 'legacy-access', base_url: cachedOrigin };
      store.saveProjectLegacyTokenSession(legacy, options);
      await expect(run(args)).rejects.toMatchObject({ code: 'FEEDBACK_ENDPOINT_INVALID' });
      expect(fetch).not.toHaveBeenCalled();
      store.saveProjectLegacyTokenSession({ ...legacy, base_url: endpoint }, options);
      await run(args);
      expect(fetch.mock.calls[0][0]).toBe(endpoint + '/openyida/feedback/submit.json');
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer legacy-access');
    });

    test('uses the origin paired with a local profile even when an endpoint is configured', async () => {
      const options = useSession({ OPENYIDA_ENDPOINT: endpoint });
      store.saveTokenSession({ ...SESSION, client_id: 'cli', corp_id: 'test-corp', user_id: 'test-user' }, options);
      await run(args);
      expect(fetch.mock.calls[0][0]).toBe(BASE_URL + '/openyida/feedback/submit.json');
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-bearer');
    });
  });

  test('preserves valid pending feedback IDs and the request key without automatic retries', async () => {
    reply(202, { status: 'pending', feedbackId: FEEDBACK_ID });
    reply(202, { status: 'pending', feedbackId: 'untrusted-feedback-id' });
    fetch.mockRejectedValueOnce(new Error('network timeout'));
    reply(200, { status: 'submitted', feedbackId: FEEDBACK_ID });

    await expect(run(args)).rejects.toMatchObject({
      code: 'FEEDBACK_PENDING', details: { requestId: REQUEST_ID, status: 'pending', feedbackId: FEEDBACK_ID },
    });
    await expect(run(args)).rejects.toHaveProperty('details', { requestId: REQUEST_ID, status: 'pending' });
    await expect(run(args)).rejects.toHaveProperty('details', { requestId: REQUEST_ID, status: 'unknown' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(log).not.toHaveBeenCalled();
    await run(args);
    expect(fetch.mock.calls.map(([, request]) => request.headers['Idempotency-Key'])).toEqual(Array(4).fill(REQUEST_ID));
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ feedbackId: FEEDBACK_ID });
  });

  test.each([
    [404, 'feedback_not_enabled', 'FEEDBACK_NOT_ENABLED'],
    [403, 'feedback_blocked', 'FEEDBACK_BLOCKED'],
    [403, 'feedback_credential_not_allowed', 'FEEDBACK_CREDENTIAL_NOT_ALLOWED'],
    [429, 'rate_limited', 'FEEDBACK_RATE_LIMITED'],
    [409, 'idempotency_conflict', 'FEEDBACK_IDEMPOTENCY_CONFLICT'],
    [409, 'feedback_request_conflict', 'FEEDBACK_IDEMPOTENCY_CONFLICT'],
  ])('reports controlled error %s %s without an extra request', async (status, code, expected) => {
    reply(status, { status: 'error', code, message: 'do-not-output' });
    await expect(run(args)).rejects.toMatchObject({ code: expected });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });
});
