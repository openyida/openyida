'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const { run } = require('../lib/feedback/feedback');
const { loadTokenSession } = require('../lib/auth/token-store');

jest.mock('../lib/auth/token-store', () => ({
  ...jest.requireActual('../lib/auth/token-store'),
  loadTokenSession: jest.fn(),
}));

const REQUEST_ID = '5d0c5c43-39e3-412f-9065-8b65e8b51659';
const FEEDBACK_ID = 'OYF-9d82ac00-71bf-47bf-8ac7-a2c271dd2895';
const BASE_URL = 'https://feedback-test.example.org';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

describe('feedback evidence review', () => {
  let directory;
  let input;
  let screenshot;
  let logFile;
  let args;
  let fetch;
  let output;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-feedback-evidence-'));
    input = path.join(directory, 'feedback.json');
    screenshot = path.join(directory, 'a screenshot.png');
    logFile = path.join(directory, 'excerpt.log');
    fs.writeFileSync(input, JSON.stringify({
      type: 'error', domain: 'page', impact: 'blocked', title: 'Publish failed',
      description: 'The spinner did not disappear', expected: 'The page opens',
      occurredAt: '2026-11-10T15:00:00+08:00',
    }));
    fs.writeFileSync(screenshot, PNG);
    fs.writeFileSync(logFile, '2026-11-10 request timed out\n');
    args = ['submit', '--input', input, '--request-id', REQUEST_ID, '--json'];
    fetch = jest.spyOn(globalThis, 'fetch');
    output = jest.spyOn(console, 'log').mockImplementation(() => {});
    loadTokenSession.mockReturnValue({ base_url: BASE_URL, access_token: 'test-bearer' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function preview(...flags) {
    await run([...args, ...flags, '--preview']);
    return JSON.parse(output.mock.lastCall[0]);
  }

  function reply(status, data) {
    fetch.mockResolvedValueOnce({ status, json: async () => data });
  }

  test('binds file, text and environment review to JSON evidence bytes, without sending local filenames', async () => {
    const flags = ['--screenshot', screenshot, '--log', logFile, '--include-environment'];
    const reviewed = await preview(...flags);
    expect(fetch).not.toHaveBeenCalled();
    expect(reviewed).toMatchObject({
      submissionPerformed: false, destination: BASE_URL, requestId: REQUEST_ID,
      feedback: { domain: 'page', impact: 'blocked', environment: { arch: process.arch, platform: process.platform } },
      attachments: [
        { kind: 'screenshot', file: 'a screenshot.png', contentType: 'image/png', bytes: PNG.length },
        { kind: 'log', file: 'excerpt.log', contentType: 'text/plain', bytes: 29 },
      ],
    });

    const confirm = digest => [...args, ...flags, '--confirm', '--review-digest', digest];
    await expect(run([...args, ...flags, '--confirm'])).rejects.toMatchObject({ code: 'FEEDBACK_REVIEW_REQUIRED' });
    fs.writeFileSync(logFile, 'Redacted request timed out\n');
    await expect(run(confirm(reviewed.reviewDigest))).rejects.toMatchObject({ code: 'FEEDBACK_REVIEW_REQUIRED' });
    expect(fetch).not.toHaveBeenCalled();

    const updated = await preview(...flags);
    reply(202, { status: 'pending' });
    reply(200, { status: 'submitted', feedbackId: FEEDBACK_ID });
    await expect(run(confirm(updated.reviewDigest))).rejects.toMatchObject({ code: 'FEEDBACK_PENDING' });
    await run(confirm(updated.reviewDigest));
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe(BASE_URL + '/openyida/feedback/submit.json');
    expect(request.headers['Idempotency-Key']).toBe(REQUEST_ID);
    expect(fetch.mock.calls[1][1].body).toEqual(request.body);
    expect(request.headers['Content-Type']).toBe('application/json');
    const payload = JSON.parse(request.body);
    expect(payload).toEqual({
      ...updated.feedback,
      evidence: [
        { kind: 'screenshot', name: 'screenshot-1.png', contentType: 'image/png', contentBase64: PNG.toString('base64') },
        { kind: 'log', name: 'log-1.txt', contentType: 'text/plain', contentBase64: Buffer.from('Redacted request timed out\n').toString('base64') },
      ],
    });
    expect(request.body).not.toContain(directory);
    expect(request.body).not.toContain('a screenshot.png');
  });

  test('rejects credential files, likely credential text, symlinks and binary logs before network access', async () => {
    const dotenv = path.join(directory, '.env');
    fs.writeFileSync(dotenv, 'text');
    await expect(preview('--log', dotenv)).rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_SENSITIVE' });
    fs.writeFileSync(logFile, 'Authorization: Bearer obviously-fake-bearer-value');
    await expect(preview('--log', logFile)).rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_SENSITIVE' });
    const symlink = path.join(directory, 'symlink.log');
    fs.symlinkSync(logFile, symlink);
    await expect(preview('--log', symlink)).rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_INVALID' });
    await expect(preview('--log', directory)).rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_INVALID' });
    fs.writeFileSync(logFile, Buffer.from([0x00, 0xff]));
    await expect(preview('--log', logFile)).rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('rejects excess attachment count, per-file size and the combined size', async () => {
    await expect(preview('--log', logFile, '--log', logFile)).rejects.toMatchObject({
      code: 'FEEDBACK_ATTACHMENT_TOO_LARGE',
    });
    fs.truncateSync(logFile, 512 * 1024 + 1);
    await expect(preview('--log', logFile)).rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_TOO_LARGE' });
    fs.writeFileSync(logFile, 'redacted');
    fs.truncateSync(screenshot, 2 * 1024 * 1024);
    await expect(preview('--screenshot', screenshot, '--screenshot', screenshot, '--log', logFile)).rejects.toMatchObject({
      code: 'FEEDBACK_ATTACHMENT_TOO_LARGE',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('preserves a server attachment rejection and does not submit text separately', async () => {
    const flags = ['--screenshot', screenshot];
    const reviewed = await preview(...flags);
    reply(503, { code: 'feedback_attachments_unavailable' });
    await expect(run([...args, ...flags, '--confirm', '--review-digest', reviewed.reviewDigest])).rejects.toMatchObject({
      code: 'FEEDBACK_ATTACHMENTS_UNAVAILABLE', details: { requestId: REQUEST_ID },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('requires a fresh review after changing organizations on the same origin', async () => {
    const flags = ['--log', logFile];
    loadTokenSession.mockReturnValueOnce({ base_url: BASE_URL, access_token: 'synthetic', corp_id: 'test-org-a' });
    const reviewed = await preview(...flags);
    loadTokenSession.mockReturnValueOnce({ base_url: BASE_URL, access_token: 'synthetic', corp_id: 'test-org-b' });
    await expect(run([...args, ...flags, '--confirm', '--review-digest', reviewed.reviewDigest])).rejects.toMatchObject({
      code: 'FEEDBACK_REVIEW_REQUIRED',
    });
    expect(JSON.stringify(reviewed)).not.toContain('test-org-a');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('does not infer environment or accept extra system information', async () => {
    const reviewed = await preview();
    expect(reviewed.feedback.environment).toBeUndefined();
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Failed', environment: { hostname: 'private' } }));
    await expect(preview()).rejects.toMatchObject({ code: 'FEEDBACK_INPUT_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('requires a feedback file and request ID even on a terminal', async () => {
    const inputTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    const outputTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true });
    try {
      await expect(run(['submit'])).rejects.toMatchObject({ code: 'FEEDBACK_USAGE' });
      await expect(run(['submit', '--input', input, '--preview'])).rejects.toMatchObject({ code: 'FEEDBACK_USAGE' });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      if (inputTTY) {Object.defineProperty(process.stdin, 'isTTY', inputTTY);} else {delete process.stdin.isTTY;}
      if (outputTTY) {Object.defineProperty(process.stderr, 'isTTY', outputTTY);} else {delete process.stderr.isTTY;}
    }
  });

  test('allows three screenshots and rejects a fourth or a second log', async () => {
    const reviewed = await preview('--screenshot', screenshot, '--screenshot', screenshot, '--screenshot', screenshot);
    expect(reviewed.attachments).toHaveLength(3);
    await expect(preview('--screenshot', screenshot, '--screenshot', screenshot, '--screenshot', screenshot, '--screenshot', screenshot))
      .rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_TOO_LARGE' });
    await expect(preview('--log', logFile, '--log', logFile))
      .rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_TOO_LARGE' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([
    ['incident.json', 'application/json'],
    ['incident.jsonl', 'application/x-ndjson'],
    ['incident.ndjson', 'application/x-ndjson'],
    ['incident.txt', 'text/plain'],
  ])('keeps selected log MIME for %s', async (name, contentType) => {
    const file = path.join(directory, name);
    fs.writeFileSync(file, '{"success":false,"errorCode":"500"}\n');
    const reviewed = await preview('--log', file);
    expect(reviewed.attachments[0]).toMatchObject({ kind: 'log', contentType });
  });

  test('keeps gzip bytes while checking the decompressed UTF-8 log', async () => {
    const file = path.join(directory, 'incident.jsonl.gz');
    const bytes = gzipSync(Buffer.from('{"success":false,"errorCode":"500"}\n'));
    fs.writeFileSync(file, bytes);
    const flags = ['--log', file];
    const reviewed = await preview(...flags);
    reply(201, { status: 'submitted', feedbackId: FEEDBACK_ID });
    await run([...args, ...flags, '--confirm', '--review-digest', reviewed.reviewDigest]);
    expect(JSON.parse(fetch.mock.calls[0][1].body).evidence).toEqual([
      { kind: 'log', name: 'log-1.gz', contentType: 'application/gzip', contentBase64: bytes.toString('base64') },
    ]);
    fs.writeFileSync(file, gzipSync(Buffer.from('x'.repeat(512 * 1024 + 1))));
    await expect(preview(...flags)).rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_INVALID' });
    fs.writeFileSync(file, gzipSync(Buffer.from([0xff])));
    await expect(preview(...flags)).rejects.toMatchObject({ code: 'FEEDBACK_ATTACHMENT_INVALID' });
  });

  test('accepts the exact log byte limit and binds review to text, target and request ID', async () => {
    fs.writeFileSync(logFile, 'x'.repeat(512 * 1024));
    const flags = ['--log', logFile];
    const reviewed = await preview(...flags);
    expect(reviewed.attachments[0].bytes).toBe(512 * 1024);
    const secondId = '5d0c5c43-39e3-412f-9065-8b65e8b51658';
    await expect(run(['submit', '--input', input, '--request-id', secondId, ...flags, '--confirm', '--review-digest', reviewed.reviewDigest]))
      .rejects.toMatchObject({ code: 'FEEDBACK_REVIEW_REQUIRED' });
    loadTokenSession.mockReturnValueOnce({ base_url: 'https://other-feedback-test.example.org', access_token: 'synthetic' });
    await expect(run([...args, ...flags, '--confirm', '--review-digest', reviewed.reviewDigest]))
      .rejects.toMatchObject({ code: 'FEEDBACK_REVIEW_REQUIRED' });
    const data = JSON.parse(fs.readFileSync(input, 'utf8'));
    fs.writeFileSync(input, JSON.stringify({ ...data, description: 'A changed description' }));
    await expect(run([...args, ...flags, '--confirm', '--review-digest', reviewed.reviewDigest]))
      .rejects.toMatchObject({ code: 'FEEDBACK_REVIEW_REQUIRED' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('submits native correlation values without mapping and enforces their string limits', async () => {
    const data = {
      type: 'error', description: 'Publishing failed', host: 'QwenWork Desktop', channel: 'beta',
      commandExecutionId: 'original-command-id', traceId: 'original-trace-id', errorCode: '000081',
    };
    fs.writeFileSync(input, JSON.stringify(data));
    const reviewed = await preview();
    const normalized = {
      type: data.type, description: data.description, commandExecutionId: data.commandExecutionId,
      traceId: data.traceId, errorCode: data.errorCode, environment: { host: data.host, releaseChannel: data.channel },
    };
    expect(reviewed.feedback).toEqual(normalized);
    reply(201, { status: 'submitted', feedbackId: FEEDBACK_ID });
    await run([...args, '--confirm', '--review-digest', reviewed.reviewDigest]);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(normalized);
    fs.writeFileSync(input, JSON.stringify({ ...data, errorCode: 'x'.repeat(129) }));
    await expect(preview()).rejects.toMatchObject({ code: 'FEEDBACK_INPUT_INVALID' });
    fs.writeFileSync(input, JSON.stringify({ ...data, errorCode: 500 }));
    await expect(preview()).rejects.toMatchObject({ code: 'FEEDBACK_INPUT_INVALID' });
  });

  test.each(['pending', 'network'])('sends once when the outcome is %s', async outcome => {
    const reviewed = await preview('--log', logFile);
    if (outcome === 'pending') {
      reply(202, { status: 'pending' });
    } else {
      fetch.mockRejectedValueOnce(new Error('synthetic network interruption'));
    }
    await expect(run([...args, '--log', logFile, '--confirm', '--review-digest', reviewed.reviewDigest]))
      .rejects.toMatchObject({ code: outcome === 'pending' ? 'FEEDBACK_PENDING' : 'FEEDBACK_OUTCOME_UNKNOWN' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });


  test('accepts the server environment contract verbatim and omits optional nulls', async () => {
    const environment = {
      cliVersion: 'native build with a custom suffix', nodeVersion: 'custom node runtime',
      platform: 'a future platform', arch: 'a future architecture', host: 'QwenWork Desktop',
      releaseChannel: 'x'.repeat(128),
    };
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Failed', environment }));
    const reviewed = await preview();
    expect(reviewed.feedback.environment).toEqual(environment);
    reply(201, { status: 'submitted', feedbackId: FEEDBACK_ID });
    await run([...args, '--confirm', '--review-digest', reviewed.reviewDigest]);
    expect(JSON.parse(fetch.mock.calls[0][1].body).environment).toEqual(environment);
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Failed', environment: { host: null, releaseChannel: 'beta' } }));
    expect((await preview()).feedback.environment).toEqual({ releaseChannel: 'beta' });
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Failed', environment: null, host: null, channel: null }));
    expect((await preview()).feedback).toEqual({ type: 'error', description: 'Failed' });
  });

  test.each([
    { host: 'x'.repeat(129) }, { arch: 64 }, { hostname: 'private-host' }, { releaseChannel: false },
  ])('rejects malformed environment values %j', async environment => {
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Failed', environment }));
    await expect(preview()).rejects.toMatchObject({ code: 'FEEDBACK_INPUT_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('normalizes root aliases and rejects conflicting environment values', async () => {
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Failed', host: 'QwenWork', channel: 'beta', environment: { host: 'QwenWork', cliVersion: 'native build' } }));
    expect((await preview()).feedback).toEqual({
      type: 'error', description: 'Failed', environment: { host: 'QwenWork', releaseChannel: 'beta', cliVersion: 'native build' },
    });
    fs.writeFileSync(input, JSON.stringify({ type: 'error', description: 'Failed', host: 'QwenWork', environment: { host: 'Terminal' } }));
    await expect(preview()).rejects.toMatchObject({ code: 'FEEDBACK_INPUT_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

});
