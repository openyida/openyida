'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN = process.env.OPENYIDA_TEST_BIN || path.join(ROOT, 'bin/yida.js');

async function runCli(baseUrl, workspace, mode = 'web', command = 'create-app') {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) { delete env[key]; }
  }
  Object.assign(env, {
    OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ACCESS_TOKEN: 'test-only-access',
    OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_ENDPOINT: baseUrl,
    OPENYIDA_TOKEN_CORP_ID: 'ding-test', OPENYIDA_TOKEN_USER_ID: 'user-test',
    OPENYIDA_LANG: 'en', OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0',
  });
  if (mode === 'web') {
    env.QWENWORK = '1';
    env.QWENWORK_WORKSPACE_DIR = workspace;
  } else {
    env.QWENWORK_INTEGRATION_MODE = '1';
    env.QODER_WORKER_CWD = workspace;
  }
  let args = [BIN, 'create-app', '--name', 'Permission test'];
  if (command === 'import') {
    const filename = path.join(workspace, 'import.json');
    fs.writeFileSync(filename, JSON.stringify({ sourceAppType: 'APP_SOURCE', forms: [{ name: 'Form', formUuid: 'FORM_SOURCE' }] }));
    args = [BIN, 'import', filename];
  }
  return new Promise((resolve, reject) => {
    execFile(process.execPath, args, {
      cwd: workspace, env, encoding: 'utf8', timeout: 20000,
    }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') { reject(error); }
      else { resolve({ code: error ? error.code : 0, stdout, stderr }); }
    });
  });
}

test.each([
  ['web', 'redirect', 'YIDA_PLATFORM_ACCESS_REQUIRED', 'unauth', 'create-app'],
  ['desktop', 'legacy', 'YIDA_APP_CREATE_PERMISSION_REQUIRED', 'noCreateApp', 'create-app'],
  ['web', 'unknown', 'YIDA_PERMISSION_REQUIRED', null, 'create-app'],
  ['desktop', 'config', 'YIDA_PLATFORM_ACCESS_REQUIRED', 'unauth', 'create-app'],
  ['web', 'legacy', 'YIDA_APP_CREATE_PERMISSION_REQUIRED', 'noCreateApp', 'import'],
])('app creation %s/%s outputs one actionable failure and stops', async (mode, scenario, code, type, command) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-permission-cli-'));
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url.split('?')[0]);
    req.resume();
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/query/exclusive/') && scenario !== 'config') {
      res.end(JSON.stringify({ success: true, content: {} }));
    } else if (scenario === 'redirect' || scenario === 'config') {
      res.writeHead(302, { Location: '/defaultPage.html?type=unauth' }); res.end();
    } else {
      res.end(JSON.stringify({ success: false, errorCode: 'TIANSHU_000006',
        errorMsg: scenario === 'legacy' ? '管理员暂未为您分配权限，请联系管理员授权' : 'Other permission denied' }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const result = await runCli(base, workspace, mode, command);
    expect(result.code).toBe(1);
    expect(result.stdout.trim()).toBe('');
    const start = result.stderr.indexOf('{\n  "success"');
    expect(start).toBeGreaterThanOrEqual(0);
    const payload = JSON.parse(result.stderr.slice(start));
    expect(payload).toMatchObject({ success: false, errorCode: code, status: 'permission_required', retryable: false });
    if (type) {
      const label = type === 'unauth' ? 'Request YiDA access' : 'Request permission to create YiDA applications';
      const url = `${base}/defaultPage.html?type=${type}`;
      expect(payload.nextAction).toEqual({ type: 'open_url', label, url });
      expect(payload.nextStep).toContain(`[${label}](${url})`);
      expect(payload.details.permissionLabel).toBe(label);
    } else {
      expect(payload.details.platformErrorCode).toBe('TIANSHU_000006');
      expect(payload).not.toHaveProperty('nextAction');
    }
    expect(calls.filter(p => p === '/query/app/registerApp.json')).toHaveLength(scenario === 'config' ? 0 : 1);
    expect(calls).not.toContain('/openapi/cli/v1/auth/refresh');
    expect(calls).not.toContain('/query/card/send.json');
    expect(JSON.stringify(payload)).not.toContain('test-only-access');
    expect(fs.existsSync(path.join(workspace, 'prd'))).toBe(false);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 30000);
