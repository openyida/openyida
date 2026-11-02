'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { saveTokenSession, loadTokenSession } = require('../lib/auth/token-store');

// Exercise the CLI parser, org switch, token login and loopback together without
// contacting DingTalk or opening a real browser.
test('JSON org switch exposes one live authorization URL and persists only the selected organization', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-org-cli-'));
  const projectRoot = path.join(root, 'project');
  const authDir = path.join(root, 'auth');
  fs.mkdirSync(projectRoot);
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/OPENYIDA|QWEN|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) { delete env[key]; }
  }
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url);
    req.resume();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, content: {
      access_token: 'test-target-access', refresh_token: 'test-target-refresh',
      corp_id: 'corp-target', user_id: 'user-test',
    } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  saveTokenSession({ access_token: 'test-source-access', refresh_token: 'test-source-refresh',
    corp_id: 'corp-source', user_id: 'user-test', base_url: baseUrl,
  }, { projectRoot, authDir, env: {} });
  Object.assign(env, { OPENYIDA_AUTH_DIR: authDir, OPENYIDA_NO_AUTO_UPDATE: '1',
    OPENYIDA_SKIP_UPDATE_CHECK: '1', OPENYIDA_OAUTH_TIMEOUT_MS: '5000',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0' });
  const bin = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');
  const child = spawn(process.execPath, [bin, 'org', 'switch', '--corp-id', 'corp-target', '--json', '--no-browser'], {
    cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  const exit = new Promise(resolve => child.on('close', code => resolve(code)));
  try {
    const authUrl = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.stderr.on('data', data => {
        stderr += data;
        const match = stderr.match(/Open this URL to login:\n([^\r\n]+)\n/);
        if (match) { resolve(new URL(match[1])); }
      });
      child.on('close', () => reject(new Error(`No live authorization URL: ${stderr}`)));
    });
    expect(stdout).toBe('');
    expect(loadTokenSession({ projectRoot, authDir, env: {} }).corp_id).toBe('corp-source');
    const callback = new URL(authUrl.searchParams.get('redirect_uri'));
    callback.searchParams.set('state', authUrl.searchParams.get('state'));
    callback.searchParams.set('code', 'test-code');
    await new Promise((resolve, reject) => {
      http.get(callback, res => { res.resume(); res.on('end', resolve); }).on('error', reject);
    });
    expect(await exit).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, can_auto_use: true, corp_id: 'corp-target', switch_source: 'oauth_login' });
    expect(stderr.match(/Open this URL to login/g)).toHaveLength(1);
    expect(calls).toEqual(['/openapi/cli/v1/auth/dingtalk/token']);
    expect(loadTokenSession({ projectRoot, authDir, env: {} }).corp_id).toBe('corp-target');
    expect(stdout + stderr).not.toMatch(/test-(?:source|target)-(?:access|refresh)/);
  } finally {
    child.kill();
    await exit;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 10000);
