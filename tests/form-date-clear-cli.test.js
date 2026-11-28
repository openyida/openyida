'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');

/** Exercise the real CLI, auth client and JSON exit contract against a local API fixture. */
test.each(['verified', 'unchanged-date', 'other-field-changed', 'version-changed', 'required', 'conflict'])('date-clear CLI: %s', async scenario => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-clear-cli-'));
  const dateId = 'dateField_due';
  const components = [
    { componentName: 'DateField', fieldId: dateId, fieldData: { value: 1700000000000 } },
    { componentName: 'TextField', fieldId: 'textField_keep', fieldData: { value: 'private-do-not-echo' } },
  ];
  let writes = 0, reads = 0, submitted;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) { body += chunk; }
    const route = req.url.split('?')[0];
    let result = { success: true, content: {} };
    if (route.endsWith('getFormNavigationListByOrder.json')) {
      result.content = [{ formUuid: 'FORM-TEST', title: 'Date clear', formType: 'receipt' }];
    } else if (route.endsWith('queryOperatePermission.json')) {
      result.content = { OPERATE_EDIT: 'y' };
    } else if (route.endsWith('getFormEditSchema.json')) {
      result.content = { version: 8, pages: [{ id: 'FORM-TEST', componentsTree: components.map(item => ({
        componentName: item.componentName, props: { fieldId: item.fieldId,
          validation: scenario === 'required' && item.fieldId === dateId ? [{ type: 'required' }] : [] },
      })) }], instanceData: [{ id: 'FORM-TEST', formInstId: 'FINST-OLD', flowData: {
        behaviors: components.map(item => ({ fieldId: item.fieldId, fieldBehavior: 'NORMAL' })),
      } }] };
    } else if (route.endsWith('getFormDataById.json')) {
      reads++;
      const values = JSON.parse(JSON.stringify(components));
      if (writes && scenario !== 'unchanged-date') { values[0].fieldData = {}; }
      if (writes && scenario === 'other-field-changed') { values[1].fieldData.value = 'changed-do-not-echo'; }
      result.content = { formInstId: 'FINST-OLD', modelUuid: 'FORM-TEST',
        version: writes && scenario === 'version-changed' ? 8 : 2, gmtModified: 123,
        instValue: JSON.stringify(values), formData: {} };
    } else if (route.endsWith('editFormData.json')) {
      writes++;
      submitted = new URLSearchParams(body);
      result = scenario === 'conflict' ? { success: false, errorCode: '200007', errorMsg: 'modified' }
        : { success: true, content: 'FINST-OLD' };
    } else {
      result = { success: false, errorCode: 'UNEXPECTED_ROUTE' };
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) { delete env[key]; }
    }
    Object.assign(env, { OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ACCESS_TOKEN: 'test-only-access',
      OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
      OPENYIDA_TOKEN_CORP_ID: 'ding-test', OPENYIDA_TOKEN_USER_ID: 'user-test', OPENYIDA_LANG: 'en',
      OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1', NO_COLOR: '1', FORCE_COLOR: '0' });
    const result = await new Promise((resolve, reject) => execFile(process.execPath, [BIN,
      'data', 'update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-OLD',
      '--expect-form-name', 'Date clear', '--expect-form-type', 'receipt', '--data-json', JSON.stringify({ [dateId]: null }), '--json'],
    { cwd: workspace, env, encoding: 'utf8', timeout: 20000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') { reject(error); }
      else { resolve({ code: error ? error.code : 0, stdout, stderr }); }
    }));
    if (scenario === 'verified') {
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ success: true, readbackVerified: true,
        verification: { instanceVersion: 2, verifiedFields: [dateId], preservedFields: ['textField_keep'] } });
    } else {
      expect(result.code).toBe(1);
      const start = result.stderr.indexOf('{\n  "success"');
      expect(start).toBeGreaterThanOrEqual(0);
      const payload = JSON.parse(result.stderr.slice(start));
      expect(payload.errorCode).toBe(scenario === 'required' ? 'DATA_DATE_CLEAR_PREFLIGHT_FAILED'
        : scenario === 'conflict' ? 'DATA_DATE_CLEAR_WRITE_UNVERIFIED' : 'DATA_DATE_CLEAR_READBACK_MISMATCH');
      expect(payload.details.retrySafe).toBe(scenario === 'required');
      if (scenario !== 'required') { expect(payload.details.partial.formInstId).toBe('FINST-OLD'); }
    }
    expect(result.stdout + result.stderr).not.toMatch(/private-do-not-echo|changed-do-not-echo|test-only-access/);
    expect(writes).toBe(scenario === 'required' ? 0 : 1);
    expect(reads).toBe(['required', 'conflict'].includes(scenario) ? 1 : 2);
    if (submitted) {
      expect(submitted.get('version')).toBe('2');
      expect(submitted.get('gmtModified')).toBe('123');
      expect(JSON.parse(submitted.get('value'))).toEqual([{ componentName: 'DateField', fieldId: dateId, fieldData: { value: null } }]);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 30000);
