'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');

function runCli(workspace, endpoint, args, authenticated = true) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) { delete env[key]; }
  }
  Object.assign(env, { OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_ENDPOINT: endpoint,
    OPENYIDA_LANG: 'en', OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0' });
  if (authenticated) {
    Object.assign(env, { OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ACCESS_TOKEN: 'fixture-only-access',
      OPENYIDA_TOKEN_CORP_ID: 'fixture-corp', OPENYIDA_TOKEN_USER_ID: 'fixture-user' });
  }
  return new Promise((resolve, reject) => execFile(process.execPath, [BIN, 'batch', ...args, '--json'],
    { cwd: workspace, env, encoding: 'utf8', timeout: 20000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') { reject(error); }
      else { resolve({ code: error?.code || 0, stdout, stderr }); }
    }));
}

async function fixture(handler, run) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-batch-cli-'));
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', part => { body += part; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      handler(new URLSearchParams(body).get('formUuid'), res, req.url);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(workspace, `http://127.0.0.1:${server.address().port}`); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test('real child processes overlap network work, respect the limit and retain input order', async () => {
  const waiting = new Map(), arrivals = [];
  let active = 0, peak = 0;
  const finish = form => {
    const res = waiting.get(form); waiting.delete(form); active--;
    res.end(JSON.stringify({ success: true, content: { title: form } }));
  };
  await fixture((form, res) => {
    arrivals.push(form); active++; peak = Math.max(peak, active); waiting.set(form, res);
    // Neither first request finishes until both child processes are inside HTTP work.
    if (waiting.has('FORM-A') && waiting.has('FORM-B')) { finish('FORM-B'); }
    if (form === 'FORM-C') { finish('FORM-C'); finish('FORM-A'); }
  }, async (workspace, endpoint) => {
    const commands = ['A', 'B', 'C'].map(id => `openyida get-form-config APP_TEST FORM-${id} --json`);
    const file = path.join(workspace, 'ready tasks.txt'); fs.writeFileSync(file, commands.join('\n'));
    const result = await runCli(workspace, endpoint, [file, '--concurrency', '2']);
    expect(result.code).toBe(0);
    const summary = JSON.parse(result.stdout);
    expect(summary).toMatchObject({ success: true, total: 3, executed: 3, peakConcurrency: 2 });
    expect(new Set(arrivals.slice(0, 2))).toEqual(new Set(['FORM-A', 'FORM-B']));
    expect(peak).toBe(2);
    expect(summary.results.map(item => item.output.formUuid)).toEqual(['FORM-A', 'FORM-B', 'FORM-C']);
    expect(summary.results[1].endedAt <= summary.results[2].startedAt).toBe(true);
    expect(summary.results[0].startedAt < summary.results[2].endedAt).toBe(true);
  });
}, 30000);

test('real CLI reports a child business failure and exits nonzero', async () => {
  await fixture((_form, res) => res.end(JSON.stringify({ success: false, errorCode: 'FIXTURE_FAILURE', errorMsg: 'Fixture failure' })),
    async (workspace, endpoint) => {
      const result = await runCli(workspace, endpoint, ['--commands', 'get-form-config APP_TEST FORM-BAD --json']);
      expect(result.code).toBe(1);
      const summary = JSON.parse(result.stdout);
      expect(summary).toMatchObject({ success: false, failedCount: 1, results: [{ success: false, exitCode: 1,
        output: { success: false, errorCode: 'FIXTURE_FAILURE' } }] });
    });
}, 30000);

test('local compile failures do not start login and retain structured diagnostics', async () => {
  await fixture((_form, res) => res.end('{}'), async (workspace, endpoint) => {
    const result = await runCli(workspace, endpoint, ['--commands', 'compile missing.jsx --json'], false);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ success: false, results: [{ output: {
      success: false, errorCode: 'COMPILE_SOURCE_NOT_FOUND',
    } }] });
    expect(result.stderr).not.toContain('oauth');
  });
}, 30000);
