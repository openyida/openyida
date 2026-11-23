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
      headers: { Authorization: 'Bearer test-bearer', 'Idempotency-Key': REQUEST_ID },
    });
    expect(JSON.parse(request.body)).toEqual(body);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      success: true, status: 'submitted', feedbackId: FEEDBACK_ID, requestId: REQUEST_ID,
    });
  });

  test('preserves the request key for pending and uncertain results, with no feedback number', async () => {
    reply(202, { status: 'pending', feedbackId: FEEDBACK_ID });
    fetch.mockRejectedValueOnce(new Error('network timeout'));
    reply(200, { status: 'submitted', feedbackId: FEEDBACK_ID });

    await expect(run(args)).rejects.toMatchObject({
      code: 'FEEDBACK_PENDING', details: { requestId: REQUEST_ID, status: 'pending' },
    });
    await expect(run(args)).rejects.toMatchObject({
      code: 'FEEDBACK_OUTCOME_UNKNOWN', details: { requestId: REQUEST_ID, status: 'unknown' },
    });
    expect(log).not.toHaveBeenCalled();
    await run(args);
    expect(fetch.mock.calls.map(([, request]) => request.headers['Idempotency-Key'])).toEqual(Array(3).fill(REQUEST_ID));
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
