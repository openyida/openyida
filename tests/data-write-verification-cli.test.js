'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');

function invoke(baseUrl, workspace, data) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) {delete env[key];}
  }
  Object.assign(env, {
    OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ACCESS_TOKEN: 'test-only-access',
    OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_ENDPOINT: baseUrl,
    OPENYIDA_TOKEN_CORP_ID: 'ding-test', OPENYIDA_TOKEN_USER_ID: 'user-test',
    OPENYIDA_LANG: 'en', OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0',
  });
  return new Promise((resolve, reject) => execFile(process.execPath, [BIN, 'data', 'create', 'form', 'APP_TEST', 'FORM-TEST',
    '--expect-form-name', 'Verification', '--expect-form-type', 'receipt', '--verify-write', '--json',
    '--data-json', JSON.stringify(data)], { cwd: workspace, env, encoding: 'utf8', timeout: 20000 },
  (error, stdout, stderr) => {
    if (error && typeof error.code !== 'number') {reject(error);}
    else {resolve({ code: error ? error.code : 0, stdout, stderr });}
  }));
}

test.each(['verified', 'empty', 'foreign', 'conflicting-ids', 'preflight'])('CLI verifies the persisted fields and preserves accepted writes: %s', async scenario => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-data-verify-cli-'));
  let writes = 0, readbacks = 0, persisted;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) {body += chunk;}
    const route = req.url.split('?')[0];
    let result = { success: true, content: {} };
    if (route.endsWith('getFormNavigationListByOrder.json')) {
      result.content = [{ formUuid: 'FORM-TEST', title: 'Verification', formType: 'receipt' }];
    } else if (route.endsWith('getFormSchema.json')) {
      result.content = { pages: [{ componentsTree: [
        { componentName: 'TextField', props: { fieldId: 'textField_name', label: 'Customer' } },
        { componentName: 'NumberField', props: { fieldId: 'numberField_total', label: 'Total' } },
      ] }] };
    } else if (route.endsWith('saveFormData.json')) {
      writes++;
      persisted = JSON.parse(new URLSearchParams(body).get('formDataJson'));
      result = scenario === 'conflicting-ids'
        ? { success: true, formInstId: 'FINST-A', content: { formInstId: 'FINST-B' } }
        : { success: true, content: 'FINST-NEW' };
    } else if (route.endsWith('getFormDataById.json')) {
      readbacks++;
      result.content = { formInstId: 'FINST-NEW', modelUuid: scenario === 'foreign' ? 'FORM-OTHER' : 'FORM-TEST',
        formData: scenario === 'empty' ? {} : { ...persisted, numberField_total: '0' } };
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await invoke(`http://127.0.0.1:${server.address().port}`, workspace,
      scenario === 'preflight' ? { Customer: 'do-not-echo', numberField_total: '0' } : { textField_name: 'do-not-echo', numberField_total: 0 });
    if (scenario === 'verified') {
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ formInstId: 'FINST-NEW', readbackVerified: true });
    } else {
      expect(result.code).toBe(1);
      const start = result.stderr.indexOf('{\n  "success"');
      expect(start).toBeGreaterThanOrEqual(0);
      const payload = JSON.parse(result.stderr.slice(start));
      const errorCode = scenario === 'preflight' ? 'DATA_WRITE_PREFLIGHT_FAILED'
        : scenario === 'empty' ? 'DATA_WRITE_READBACK_MISMATCH' : 'DATA_WRITE_READBACK_UNVERIFIED';
      expect(payload.errorCode).toBe(errorCode);
      expect(JSON.stringify(payload)).not.toContain('do-not-echo');
      expect(JSON.stringify(payload)).not.toContain('test-only-access');
      if (scenario === 'preflight') {
        expect(payload.details.issues).toHaveLength(2);
        expect(payload.details.sideEffectState).toBe('none');
      } else {
        expect(payload.details).toMatchObject({ mutationAccepted: true, retrySafe: false, readbackVerified: false });
        expect(payload.details.partial).toMatchObject(scenario === 'conflicting-ids'
          ? { formInstId: null, candidateIds: ['FINST-A', 'FINST-B'] } : { formInstId: 'FINST-NEW' });
      }
    }
    expect(writes).toBe(scenario === 'preflight' ? 0 : 1);
    expect(readbacks).toBe(['preflight', 'conflicting-ids'].includes(scenario) ? 0 : 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 30000);
