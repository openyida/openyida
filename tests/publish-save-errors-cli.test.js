'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');

test.each([
  ['security', 200, '<html>RGV587<script>token=private-response</script></html>', 'text/html', 'PUBLISH_SECURITY_BLOCKED'],
  ['challenge', 200, '<html><script src="/_____tmd_____/challenge?token=private-response"></script></html>', 'text/html', 'PUBLISH_SECURITY_BLOCKED'],
  ['html', 200, '<html>upstream unavailable</html>', 'text/html', 'PUBLISH_NON_JSON_RESPONSE'],
  ['captcha-text', 200, '<html>Login CAPTCHA</html>', 'text/html', 'PUBLISH_NON_JSON_RESPONSE'],
  ['gateway', 502, 'upstream unavailable', 'text/plain', 'PUBLISH_NON_JSON_RESPONSE'],
  ['empty', 200, '', 'application/json', 'PUBLISH_NON_JSON_RESPONSE'],
  ['forbidden', 403, 'Forbidden', 'text/plain', 'PUBLISH_SAVE_FAILED'],
  ['business', 200, JSON.stringify({ success: false, errorCode: 'BAD_SCHEMA', errorMsg: 'Invalid schema token=private-response' }), 'application/json', 'PUBLISH_SAVE_FAILED'],
])('publish reports %s failures as actionable JSON without replay or protocol fallback', async (
  scenario, status, responseBody, contentType, errorCode
) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-publish-save-'));
  const source = path.join(workspace, 'project/pages/src/test.canvas.jsx');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, 'import React from "react"; export default function YidaComp(){return <button onClick={()=>{}}>Check</button>;}');
  fs.writeFileSync(path.join(workspace, 'project/config.json'), JSON.stringify({ appType: 'APP_TEST' }));
  const requests = [];
  const server = http.createServer(async (req, res) => {
    for await (const chunk of req) { void chunk; } // Drain without retaining credentials or source.
    const url = new URL(req.url, 'http://127.0.0.1');
    requests.push({ method: req.method, path: url.pathname });
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/getFormNavigationListByOrder.json')) {
      res.end(JSON.stringify({ success: true, content: [{ formUuid: 'FORM-TEST', title: 'Test', formType: 'display' }] }));
    } else if (url.pathname.endsWith('/getFormSchema.json')) {
      res.end(JSON.stringify({ success: true, content: { gmtModified: 100, pages: [] } }));
    } else if (url.pathname.endsWith('/codeBundle/save.json')) {
      res.statusCode = status;
      res.setHeader('Content-Type', contentType);
      res.setHeader('eagleeye-traceid', 'trace-publish');
      res.setHeader('x-request-id', 'request-publish');
      res.setHeader('Set-Cookie', 'private-cookie=never-print');
      res.setHeader('Location', '/login?token=private-location');
      res.end(responseBody);
    } else {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, errorMsg: 'Unexpected endpoint' }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) { delete env[key]; }
  }
  Object.assign(env, {
    OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ACCESS_TOKEN: 'test-only-access',
    OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_ENDPOINT: baseUrl,
    OPENYIDA_TOKEN_CORP_ID: 'ding-test', OPENYIDA_TOKEN_USER_ID: 'user-test',
    OPENYIDA_LANG: 'en', OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0',
  });
  try {
    const run = await new Promise((resolve, reject) => execFile(process.execPath,
      [BIN, 'publish', source, 'APP_TEST', 'FORM-TEST', '--canvas', '--no-open', '--json'],
      { cwd: workspace, env, encoding: 'utf8', timeout: 20000 }, (error, stdout, stderr) => {
        if (error && typeof error.code !== 'number') { reject(error); }
        else { resolve({ code: error ? error.code : 0, stdout, stderr }); }
      }));
    expect(run.code).toBe(1);
    expect(run.stdout).toBe('');
    const payload = JSON.parse(run.stderr);
    expect(payload).toMatchObject({
      success: false, errorCode, stage: 'save', retrySafe: false,
      sideEffectState: 'unknown', readbackAllowed: true,
      nextStep: 'openyida get-schema APP_TEST FORM-TEST',
      details: { target: { appType: 'APP_TEST', formUuid: 'FORM-TEST' } },
    });
    expect(payload.details.response).toMatchObject({
      status, contentType, path: '/alibaba/web/APP_TEST/query/codeBundle/save.json',
      eagleeyeTraceId: 'trace-publish', requestId: 'request-publish',
    });
    if (scenario === 'business') { expect(payload.details.serverErrorCode).toBe('BAD_SCHEMA'); }
    if (scenario === 'security') { expect(payload.details.securityMarker).toBe('RGV587'); }
    else if (scenario === 'challenge') { expect(payload.details.securityMarker).toBe('_____tmd_____'); }
    else { expect(payload.details.securityMarker).toBeUndefined(); }
    expect(run.stderr).not.toMatch(/private-response|private-cookie|private-location|never-print|test-only-access|<script>/);
    expect(requests.filter(r => r.method === 'POST')).toEqual([
      { method: 'POST', path: '/alibaba/web/APP_TEST/query/codeBundle/save.json' },
    ]);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 30000);
