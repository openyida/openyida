'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { httpGet, requestWithAutoLogin } = require('../lib/core/utils');

const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');
const navigation = '/dingtalk/web/APP_TEST/query/formnav/getFormNavigationListByOrder.json';
const binding = '/APP_TEST/query/formProcBinding/getBindingByFormUuid.json';
const schemaPath = '/alibaba/web/APP_TEST/_view/query/formdesign/getFormSchema.json';
const forms = ['FORM-A', 'FORM-B'].map(formUuid => ({ formUuid, title: formUuid, formType: 'process' }));
const schema = { pages: [{ componentsTree: [{ componentName: 'TextField',
  props: { fieldId: 'textField_name', label: 'Name' } }] }] };

function runCli({ workspace, env }, args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [BIN, ...args, '--json'], { cwd: workspace, env, timeout: 12000 },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== 'number') {reject(error); return;}
        try {
          const json = stdout.trim() || stderr.match(/^\{[\s\S]*?^\}/m)?.[0];
          resolve({ code: error?.code || 0, output: JSON.parse(json), stdout, stderr });
        }
        catch {reject(new Error(`CLI returned no JSON: ${stdout}\n${stderr}`));}
      });
  });
}

async function withSandbox(options, run) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-sandbox-refresh-'));
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) {delete env[key];}
  }
  const rejectedReads = [];
  const writes = [];
  let refreshes = 0;
  const send = (res, status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };
  const rejectAccess = res => send(res, 401, {});
  const pending = [];
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, endpoint).pathname;
    if (pathname === '/openapi/cli/v1/auth/refresh') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        refreshes++;
        if (options.refreshFailure || refreshes !== 1 || JSON.parse(body).refreshToken !== 'fixture-old-refresh') {
          send(res, 401, { status: 'invalid_refresh_token', message: 'fixture-private-refresh-body' });
          return;
        }
        send(res, 200, { status: 'ok', data: {
          access_token: 'fixture-new-access', refresh_token: 'fixture-new-refresh', base_url: endpoint,
          corp_id: 'fixture-corp', user_id: 'fixture-user',
        } });
      });
      return;
    }
    if (pathname.endsWith('/saveFormSchemaInfo.json') || pathname.endsWith('/startInstance.json')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const title = new URLSearchParams(body).get('title');
        writes.push({ title, authorization: req.headers.authorization });
        rejectAccess(res);
      });
      return;
    }
    const authorization = req.headers.authorization;
    if (authorization === 'Bearer fixture-old-access' && (options.reject || (() => true))(pathname)) {
      rejectedReads.push(pathname);
      pending.push(res);
      if (pending.length === (options.barrier || 1)) {
        if (options.late401) {rejectAccess(pending.shift());}
        else {pending.splice(0).forEach(rejectAccess);}
      }
      return;
    }
    if (authorization === 'Bearer fixture-new-access' && options.late401) {
      pending.splice(0).forEach(rejectAccess);
    }
    if (authorization === 'Bearer fixture-new-access' && options.retryRejected) {rejectAccess(res); return;}
    if (authorization !== 'Bearer fixture-new-access' && authorization !== 'Bearer fixture-old-access') {
      rejectAccess(res);
      return;
    }
    let content = { title: 'Fixture' };
    if (pathname === navigation) {content = forms;}
    if (pathname === binding) {content = { appType: 'APP_TEST', formUuid: 'FORM-A', procCode: 'PROC' };}
    if (pathname === schemaPath) {content = schema;}
    if (pathname.endsWith('/pageProcessVersion.json')) {
      content = { data: [{ processId: 1, processVersion: 1, status: 'PUBLISHED' }] };
    }
    if (pathname.endsWith('/getProcessById.json')) {
      content = { bindingForm: 'FORM-A', schema: { componentName: 'CanvasEngine', children: [
        { componentName: 'ApplyNode' },
        { componentName: 'ApprovalNode', props: { approverRules: { type: 'ext_target_approval_originator',
          mode: 'ApprovalNode_rules_only', approverList: [{ type: 'ext_target_approval' }] } } },
        { componentName: 'EndNode' },
      ] } };
    }
    send(res, 200, { success: true, content });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  Object.assign(env, {
    OPENYIDA_AUTH_MODE: 'token', OPENYIDA_SANDBOX_BINDING_ID: 'fixture-binding',
    OPENYIDA_ENDPOINT: endpoint, OPENYIDA_REFRESH_TOKEN: 'fixture-old-refresh',
    OPENYIDA_TOKEN_CORP_ID: 'fixture-corp', OPENYIDA_TOKEN_USER_ID: 'fixture-user',
    OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_LANG: 'en',
    OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1', NO_COLOR: '1', FORCE_COLOR: '0',
  });
  if (!options.refreshOnly) {env.OPENYIDA_ACCESS_TOKEN = 'fixture-old-access';}
  const previousEnv = process.env;
  try {
    process.env = env;
    await run({ workspace, endpoint, env, rejectedReads, writes, get refreshes() {return refreshes;} });
  } finally {
    process.env = previousEnv;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function requestAuth(sandbox) {
  return { baseUrl: sandbox.endpoint, projectRoot: sandbox.workspace };
}

test('process seed --check recovers both parallel preflight reads without creating instances', async () => {
  await withSandbox({ barrier: 2 }, async sandbox => {
    const recordsPath = path.join(sandbox.workspace, 'records.json');
    fs.writeFileSync(recordsPath, JSON.stringify([{ textField_name: 'Fixture' }]));
    const { code, output } = await runCli(sandbox, ['data', 'seed', 'process', 'APP_TEST', 'FORM-A',
      '--process-code', 'PROC', '--expect-form-name', 'FORM-A', '--records-file', recordsPath, '--check']);
    expect(output).toMatchObject({ success: true, target: { formType: 'process', processCode: 'PROC' } });
    expect(code).toBe(0);
    expect(new Set(sandbox.rejectedReads)).toEqual(new Set([navigation, binding]));
    expect(sandbox.refreshes).toBe(1);
    expect(sandbox.writes).toEqual([]);
    expect(fs.existsSync(`${recordsPath}.seed-receipt.json`)).toBe(false);
  });
}, 15000);

test('get-schema --all recovers both schema reads with command retries disabled', async () => {
  await withSandbox({ barrier: 2, reject: pathname => pathname === schemaPath }, async sandbox => {
    const { output } = await runCli(sandbox, ['get-schema', 'APP_TEST', '--all', '--summary-json',
      '--concurrency', '2', '--retries', '0']);
    expect(output).toMatchObject({ total: 2, successCount: 2, failedCount: 0 });
    expect(sandbox.rejectedReads).toEqual([schemaPath, schemaPath]);
    expect(sandbox.refreshes).toBe(1);
  });
}, 15000);

test.each([false, true])('batch child processes share the refresh (refresh-only bootstrap: %s)', async refreshOnly => {
  await withSandbox({ barrier: 2, refreshOnly }, async sandbox => {
    const file = path.join(sandbox.workspace, 'commands.txt');
    fs.writeFileSync(file, forms.map(({ formUuid }) => `openyida get-form-config APP_TEST ${formUuid} --json`).join('\n'));
    const { code, output } = await runCli(sandbox, ['batch', file, '--concurrency', '2']);
    expect(output).toMatchObject({ success: true, executed: 2, peakConcurrency: 2 });
    expect(code).toBe(0);
    expect(sandbox.rejectedReads).toHaveLength(refreshOnly ? 0 : 2);
    expect(sandbox.refreshes).toBe(1);
  });
}, 15000);

test('a late 401 reuses the cache based on the token sent with that request', async () => {
  await withSandbox({ barrier: 2, late401: true }, async sandbox => {
    const authRef = requestAuth(sandbox);
    const results = await Promise.all(['/first', '/second'].map(endpoint =>
      requestWithAutoLogin(auth => httpGet(auth.baseUrl, endpoint, null, { silentStatus: true }), authRef)));
    expect(results).toMatchObject([{ success: true }, { success: true }]);
    expect(sandbox.rejectedReads).toHaveLength(2);
    expect(sandbox.refreshes).toBe(1);
  });
});

test.each([navigation, binding])('seed refresh failure for %s returns diagnostics without credentials', async requestPath => {
  await withSandbox({ refreshFailure: true, reject: pathname => pathname === requestPath }, async sandbox => {
    const recordsPath = path.join(sandbox.workspace, 'records.json');
    fs.writeFileSync(recordsPath, JSON.stringify([{ textField_name: 'Fixture' }]));
    const { code, output, stdout, stderr } = await runCli(sandbox, ['data', 'seed', 'process', 'APP_TEST', 'FORM-A',
      '--process-code', 'PROC', '--expect-form-name', 'FORM-A', '--records-file', recordsPath, '--check']);
    expect(code).toBe(1);
    expect(output).toMatchObject({ success: false, details: { refreshDiagnostic: {
      requestPath, httpStatus: 401, refreshErrorCode: 'invalid_refresh_token', refreshHttpStatus: 401,
    } } });
    expect(stdout + stderr).not.toMatch(/fixture-(?:old|new|private)/);
    expect(sandbox.writes).toEqual([]);
  });
}, 15000);

test('a read rejected after refresh fails without another retry and strips query parameters', async () => {
  await withSandbox({ retryRejected: true }, async sandbox => {
    const result = await requestWithAutoLogin(auth =>
      httpGet(auth.baseUrl, '/read?private=query', null, { silentStatus: true }), requestAuth(sandbox));
    expect(result).toMatchObject({ success: false, errorCode: 'TOKEN_AUTH_REQUIRED', refreshDiagnostic: {
      requestPath: '/read', httpStatus: 401, reason: 'access_token_rejected_after_refresh',
    } });
    expect(sandbox.refreshes).toBe(1);
  });
});

test('create-form batch refreshes once and records unknown writes without replay', async () => {
  await withSandbox({ barrier: 2 }, async sandbox => {
    const plan = path.join(sandbox.workspace, 'plan.json');
    const entries = ['a', 'b'].map(key => ({ key, title: `Fixture ${key}`, fields: [
      { type: 'TextField', label: 'Name' },
    ] }));
    fs.writeFileSync(plan, JSON.stringify({ forms: entries }));
    const { code, output } = await runCli(sandbox, ['create-form', 'batch', 'APP_TEST', plan, '--concurrency', '2']);
    expect(code).toBe(1);
    expect(output).toMatchObject({ success: false, errorCode: 'FORM_BATCH_PARTIAL_FAILURE',
      recoveryAction: 'inspect_unknown_write_then_reconcile',
      results: { a: { status: 'failed' }, b: { status: 'failed' } },
    });
    expect(sandbox.refreshes).toBe(1);
    expect(sandbox.rejectedReads).toEqual([navigation, navigation]);
    expect(sandbox.writes).toHaveLength(2);
    expect(sandbox.writes.map(write => write.authorization)).toEqual(Array(2).fill('Bearer fixture-new-access'));
    expect(new Set(sandbox.writes.map(write => write.title)).size).toBe(2);
  });
}, 15000);
