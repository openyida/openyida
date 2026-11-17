'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');

function invoke(baseUrl, workspace, args) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) {delete env[key];}
  }
  Object.assign(env, { OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ACCESS_TOKEN: 'test-only-access',
    OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_ENDPOINT: baseUrl,
    OPENYIDA_TOKEN_CORP_ID: 'ding-test', OPENYIDA_TOKEN_USER_ID: 'user-test',
    OPENYIDA_LANG: 'en', OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0' });
  return new Promise((resolve, reject) => execFile(process.execPath, [BIN, 'update-app', 'APP_TEST', ...args],
    { cwd: workspace, env, encoding: 'utf8', timeout: 20000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') {reject(error);}
      else {resolve({ code: error ? error.code : 0, stdout, stderr });}
    }));
}

test.each(['desc', 'both', 'name', 'unchanged', 'readback-failed', 'rejected', 'invalid-name'])(
  'CLI HTTP boundary verifies metadata and exit status: %s', async scenario => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-metadata-cli-'));
    let writes = 0, reads = 0, writePath;
    const state = { appType: 'APP_TEST', appName: scenario === 'invalid-name' ? null : { zh_CN: 'Original' },
      description: { zh_CN: 'Old description' }, icon: 'crm%%#123456',
      config: { APPMODE: 'normal', COLOUR: 'podBlue', FUTURE_SETTING: 'keep' } };
    const server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) {body += chunk;}
      let result;
      if (req.method === 'GET' && req.url.includes('getAppIncludingAecpInfo.json')) {
        reads++;
        result = scenario === 'readback-failed' && writes
          ? { success: false, errorMsg: 'readback unavailable' } : { success: true, content: state };
      } else if (req.method === 'POST' && /\/updateApp(?:Name)?\.json\?/.test(req.url)) {
        writes++;
        writePath = req.url;
        const payload = new URLSearchParams(body);
        if (!['unchanged', 'rejected'].includes(scenario)) {
          state.appName = JSON.parse(payload.get('appName'));
          if (payload.has('description')) {state.description = JSON.parse(payload.get('description'));}
        }
        result = scenario === 'rejected' ? { success: false, errorCode: 'DENIED', errorMsg: 'permission denied' } : { success: true };
      } else {
        result = { success: false, errorMsg: 'unexpected route' };
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const args = scenario === 'name' ? ['--name', 'Renamed']
        : scenario === 'both' ? ['--name', 'Renamed', '--desc', 'New description'] : ['--desc', 'New description'];
      const result = await invoke(`http://127.0.0.1:${server.address().port}`, workspace, args);
      const success = ['desc', 'both', 'name'].includes(scenario);
      expect(result.code).toBe(success ? 0 : 1);
      expect(writes).toBe(scenario === 'invalid-name' ? 0 : 1);
      if (writes) {expect(writePath).toContain(scenario === 'name' ? '/updateAppName.json?' : '/updateApp.json?');}
      const outputs = result.stdout.split('\n').filter(line => line.startsWith('{')).map(JSON.parse);
      if (success) {
        expect(outputs.at(-1)).toMatchObject({ success: true, metadataVerification: { verified: true } });
        expect(state.appName.zh_CN).toBe(scenario === 'desc' ? 'Original' : 'Renamed');
        expect(state.description.zh_CN).toBe(scenario === 'name' ? 'Old description' : 'New description');
      } else {
        expect(outputs.some(output => output.success)).toBe(false);
        if (['unchanged', 'readback-failed'].includes(scenario)) {
          const start = result.stderr.indexOf('{\n  "success"');
          expect(start).toBeGreaterThanOrEqual(0);
          expect(JSON.parse(result.stderr.slice(start))).toMatchObject({ errorCode: 'APP_METADATA_NOT_PERSISTED',
            mutationAccepted: true, retrySafe: false, readbackAllowed: true,
            details: { metadataVerification: { verified: false }, submittedFields: { desc: 'New description' } } });
        }
      }
      expect(reads).toBeGreaterThanOrEqual(1);
    } finally {
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }, 30000
);
