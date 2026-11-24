'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { setTimeout: delay } = require('timers/promises');

const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');
const APP = 'APP_TEST';
const NAVIGATION = 'getFormNavigationListByOrder.json';
const BINDING = 'getBindingByFormUuid.json';
const CREATE = 'saveFormSchemaInfo.json';
const OLD_ACCESS = 'fixture-old-access';
const OLD_REFRESH = 'fixture-old-refresh';
const NEW_ACCESS = 'fixture-new-access';
const REFRESH_FAILURE_MESSAGE = 'fixture private upstream diagnostic';

function invoke(sandbox, args, options = {}) {
  const { workspace, baseUrl } = sandbox;
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) { delete env[key]; }
  }
  Object.assign(env, {
    OPENYIDA_AUTH_MODE: 'token', OPENYIDA_SANDBOX_BINDING_ID: ' fixture-binding ',
    OPENYIDA_REFRESH_TOKEN: OLD_REFRESH, OPENYIDA_ENDPOINT: baseUrl,
    OPENYIDA_TOKEN_CORP_ID: 'ding-test', OPENYIDA_TOKEN_USER_ID: 'user-test',
    OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_LANG: 'en',
    OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0',
  });
  if (!options.refreshOnly) { env.OPENYIDA_ACCESS_TOKEN = OLD_ACCESS; }
  if (options.cwd) {
    env.QWENWORK_SANDBOX_ID = 'fixture-sandbox';
    if (!options.independentRoots) {env.QWENWORK_WORKSPACE_DIR = workspace;}
  }
  if (options.ordinaryOAuth) {
    delete env.OPENYIDA_AUTH_MODE;
    delete env.OPENYIDA_SANDBOX_BINDING_ID;
    delete env.OPENYIDA_ACCESS_TOKEN;
    delete env.OPENYIDA_REFRESH_TOKEN;
  }
  return new Promise((resolve, reject) => execFile(process.execPath, [BIN, ...args, '--json'], {
    cwd: options.cwd || workspace, env, encoding: 'utf8', timeout: 15000,
  }, (error, stdout, stderr) => {
    if (error && typeof error.code !== 'number') { reject(error); }
    else { resolve({ code: error?.code || 0, stdout, stderr }); }
  }));
}

function respond(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}

function rejectAccess(res) {
  respond(res, 401, { success: false });
}

async function withSandbox(handle, run, options = {}) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-sandbox-refresh-'));
  const requests = [];
  const refreshTokens = [];
  const oldReads = [];
  let barrierTimeout;
  let delayedChallenge;
  let serverError;
  const server = http.createServer(async (req, res) => {
    try {
      let body = '';
      for await (const chunk of req) { body += chunk; }
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/openapi/cli/v1/auth/refresh') {
        const { refreshToken } = JSON.parse(body);
        refreshTokens.push(refreshToken);
        if (options.failRefresh) {
          respond(res, 503, { success: false, message: REFRESH_FAILURE_MESSAGE, content: { status: 'service_unavailable' } });
          return;
        }
        if (refreshToken !== OLD_REFRESH || refreshTokens.length !== 1) {
          respond(res, 400, { success: false, content: { status: 'invalid_refresh_token' } });
          return;
        }
        // A refresh-only client has no business request to use as a barrier.
        if (options.refreshOnly) { await delay(500); }
        respond(res, 200, { success: true, content: {
          status: 'ok', accessToken: NEW_ACCESS, refreshToken: 'fixture-new-refresh',
          expiresIn: 3600, corpId: 'ding-test', userId: 'user-test',
        } });
        return;
      }
      const endpoint = url.pathname.split('/').pop();
      const token = req.headers.authorization;
      const params = new URLSearchParams(body);
      const id = url.searchParams.get('formUuid') || params.get('formUuid') || params.get('navUuid');
      requests.push({ endpoint, token, method: req.method, id });
      if (req.method === 'GET' && token === `Bearer ${OLD_ACCESS}`) {
        oldReads.push(res);
        if (oldReads.length === 1) {
          barrierTimeout = setTimeout(() => {
            serverError = new Error(`Only one old-token GET reached the refresh barrier: ${endpoint}`);
            oldReads.splice(0).forEach(rejectAccess);
          }, 5000);
        }
        // Both callers must reach the server with the original credential.
        if (oldReads.length === 2) {
          clearTimeout(barrierTimeout);
          const [first, second] = oldReads.splice(0);
          rejectAccess(first);
          if (options.delaySecondChallenge) { delayedChallenge = second; }
          else { rejectAccess(second); }
        }
        return;
      }
      if (token !== `Bearer ${NEW_ACCESS}`) { rejectAccess(res); return; }
      if (delayedChallenge) {
        // Deliver the second rejection after the first caller starts its retry.
        rejectAccess(delayedChallenge);
        delayedChallenge = undefined;
      }
      handle({ res, endpoint, params, id });
    } catch (error) {
      serverError = error;
      respond(res, 500, { success: false });
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await run({ workspace, baseUrl: `http://127.0.0.1:${server.address().port}`, requests, refreshTokens });
  } catch (error) {
    throw serverError || error;
  } finally {
    clearTimeout(barrierTimeout);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
  if (serverError) { throw serverError; }
}

function readFormList({ res, endpoint }) {
  if (endpoint !== NAVIGATION) { throw new Error(`Unexpected endpoint: ${endpoint}`); }
  respond(res, 200, { success: true, content: [{ formUuid: 'FORM-TEST', title: 'Customers', formType: 'receipt' }] });
}

function seedArgs(workspace) {
  const source = path.join(workspace, 'records.json');
  fs.writeFileSync(source, JSON.stringify([{ name: 'Fixture' }]));
  return ['data', 'seed', 'form', APP, 'FORM-TEST', '--expect-form-name', 'Customers', '--records-file', source];
}

test('seed recovers both parallel preflight reads when the second 401 arrives after rotation', async () => {
  let stored;
  await withSandbox(({ res, endpoint, params }) => {
    if (endpoint === NAVIGATION) { readFormList({ res, endpoint }); return; }
    const result = { success: true };
    if (endpoint === BINDING) { result.content = { formUuid: 'FORM-TEST', procCode: '' }; }
    else if (endpoint === 'getFormSchema.json') {
      result.content = { pages: [{ componentsTree: [{ componentName: 'TextField', props: { fieldId: 'name' } }] }] };
    } else if (endpoint === 'saveFormData.json') {
      stored = JSON.parse(params.get('formDataJson'));
      result.content = 'FINST-TEST';
    } else if (endpoint === 'getFormDataById.json') {
      result.content = { formInstId: 'FINST-TEST', modelUuid: 'FORM-TEST', formData: stored };
    } else { throw new Error(`Unexpected endpoint: ${endpoint}`); }
    respond(res, 200, result);
  }, async sandbox => {
    const result = await invoke(sandbox, seedArgs(sandbox.workspace));
    expect(sandbox.refreshTokens).toEqual([OLD_REFRESH]);
    expect(result).toMatchObject({ code: 0 });
    expect(JSON.parse(result.stdout)).toMatchObject({ success: true, completed: 1, readbackVerified: true });
    for (const endpoint of [NAVIGATION, BINDING]) {
      expect(sandbox.requests.filter(request => request.endpoint === endpoint).map(request => request.token))
        .toEqual([`Bearer ${OLD_ACCESS}`, `Bearer ${NEW_ACCESS}`]);
    }
    expect(sandbox.requests.filter(request => request.endpoint === 'saveFormData.json')).toHaveLength(1);
    expect(stored).toEqual({ name: 'Fixture' });
  }, { delaySecondChallenge: true });
}, 20000);

test('seed preserves bounded refresh diagnostics and sends no writes when refresh fails', async () => {
  await withSandbox(readFormList, async sandbox => {
    const result = await invoke(sandbox, seedArgs(sandbox.workspace));
    expect(result.code).toBe(1);
    const payload = JSON.parse(result.stderr.slice(result.stderr.indexOf('{\n  "success"')));
    expect(payload.details.refreshFailure).toMatchObject({
      requestPath: expect.stringMatching(/\/(getFormNavigationListByOrder|getBindingByFormUuid)\.json$/),
      httpStatus: 401, refreshHttpStatus: 503, refreshErrorCode: 'service_unavailable',
    });
    expect(result.stdout + result.stderr).not.toContain(REFRESH_FAILURE_MESSAGE);
    expect(sandbox.requests.filter(request => request.method !== 'GET')).toHaveLength(0);
  }, { failRefresh: true });
}, 20000);

test('seed preserves refresh-only failure details without a business request', async () => {
  await withSandbox(readFormList, async sandbox => {
    const result = await invoke(sandbox, seedArgs(sandbox.workspace), { refreshOnly: true });
    expect(result.code).toBe(1);
    const payload = JSON.parse(result.stderr.slice(result.stderr.indexOf('{\n  "success"')));
    expect(payload.details.refreshFailure).toEqual({
      refreshPath: '/openapi/cli/v1/auth/refresh',
      refreshHttpStatus: 503,
      refreshErrorCode: 'service_unavailable',
    });
    expect(sandbox.requests).toHaveLength(0);
  }, { failRefresh: true });
}, 20000);

test('list-forms keeps its ordinary OAuth top-level error code', async () => {
  await withSandbox(readFormList, async sandbox => {
    const {workspace, baseUrl} = sandbox;
    const {saveTokenSession} = require('../lib/auth/token-store');
    const session = saveTokenSession({
      base_url: baseUrl, client_id: 'fixture-client', corp_id: 'ding-test', user_id: 'user-test',
      access_token: OLD_ACCESS, refresh_token: OLD_REFRESH,
    }, { projectRoot: workspace, authDir: path.join(workspace, 'auth'), env: {} });
    expect(session.auth_profile).toBeTruthy();
    const results = await Promise.all([1, 2].map(() => invoke(sandbox, ['list-forms', APP], { ordinaryOAuth: true })));
    for (const result of results) {
      expect(result.code).toBe(1);
      const payload = JSON.parse(result.stderr.slice(result.stderr.indexOf('{\n  "success"')));
      expect(payload.errorCode).toBe('CLI_COMMAND_FAILED');
      expect(payload.details?.refreshFailure).toBeUndefined();
    }
  }, { failRefresh: true });
}, 20000);

test.each([
  [false, false], [true, false], [false, true], [true, true],
])('independent CLI processes refresh once (refresh-only=%s, independent roots=%s)', async (refreshOnly, independentRoots) => {
  await withSandbox(readFormList, async sandbox => {
    const workdirs = ['first', 'second'].map(name => path.join(sandbox.workspace, name));
    workdirs.forEach(dir => {
      fs.mkdirSync(dir);
      if (independentRoots) {fs.writeFileSync(path.join(dir, 'config.json'), '{}');}
    });
    const results = await Promise.all(workdirs.map(cwd => invoke(sandbox, ['list-forms', APP], { refreshOnly, cwd, independentRoots })));
    expect(sandbox.refreshTokens).toEqual([OLD_REFRESH]);
    for (const result of results) {
      expect(result).toMatchObject({ code: 0 });
      expect(JSON.parse(result.stdout)).toEqual([expect.objectContaining({ formUuid: 'FORM-TEST' })]);
    }
    const oldReads = sandbox.requests.filter(request => request.token === `Bearer ${OLD_ACCESS}`);
    const newReads = sandbox.requests.filter(request => request.token === `Bearer ${NEW_ACCESS}`);
    expect(oldReads).toHaveLength(refreshOnly ? 0 : 2);
    expect(newReads).toHaveLength(2);
  }, { refreshOnly });
}, 20000);

test('form batch preserves verified success and does not replay a create challenged after auth recovery', async () => {
  const forms = new Map();
  const creates = [];
  await withSandbox(({ res, endpoint, params, id }) => {
    const result = { success: true, content: {} };
    if (endpoint === NAVIGATION) {
      result.content = [...forms].map(([formUuid, form]) => ({ id: 1, navUuid: formUuid, formUuid,
        parentNavUuid: 'NAV-ROOT', parentId: 0, navType: 'PAGE', formType: 'receipt', title: form.title,
        icon: '', hidden: 'n', mobileHidden: 'n', formStatus: 'ONLINE', relateFormUuid: formUuid }));
    } else if (endpoint === CREATE) {
      const title = JSON.parse(params.get('title')).zh_CN;
      creates.push(title);
      if (title === 'Unknown') { rejectAccess(res); return; }
      const formUuid = 'FORM-VERIFIED';
      forms.set(formUuid, { title, view: { defaultConfig: { showFields: 'all' }, staticConfig: {} } });
      result.content = { formUuid };
    } else if (endpoint === 'saveFormSchema.json') {
      forms.get(id).schema = JSON.parse(params.get('content'));
    } else if (endpoint === 'getFormSchema.json') {
      Object.assign(result, { appType: APP, formUuid: id, gmtModified: 101 });
      result.content = forms.get(id)?.schema || { gmtModified: 100 };
    } else if (endpoint === 'getFormSchemaInfo.json') {
      result.content = { multiViewInfos: [{ viewUuid: `VIEW-${id}`, viewType: 'table', name: '{}', status: '{}' }] };
    } else if (endpoint === 'getViewConfig.json') {
      result.content = { ...forms.get(id).view, viewUuid: `VIEW-${id}` };
    } else if (endpoint === 'getDataViewPanel.json') {
      result.content = { componentValueVoList: [{ id: 'name', componentName: 'TextField', supportVisible: true, showTerm: 'y', showOrder: 0 }] };
    } else if (endpoint === 'updateConfig.json') {
      forms.get(id).view = { staticConfig: JSON.parse(params.get('staticConfig')), defaultConfig: JSON.parse(params.get('defaultConfig')) };
    } else if (endpoint !== 'updateFormNavigation.json') { throw new Error(`Unexpected endpoint: ${endpoint}`); }
    respond(res, 200, result);
  }, async sandbox => {
    const source = path.join(sandbox.workspace, 'forms.json');
    fs.writeFileSync(source, JSON.stringify({ forms: ['Verified', 'Unknown'].map(title => ({
      key: title.toLowerCase(), title, fields: [{ key: 'name', type: 'TextField', label: 'Name' }],
    })) }));
    const args = ['create-form', 'batch', APP, source, '--concurrency', '2'];
    const result = await invoke(sandbox, args);
    if (!result.stdout) { throw new Error(result.stderr); }
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ errorCode: 'FORM_BATCH_PARTIAL_FAILURE',
      recoveryAction: 'inspect_unknown_write_then_reconcile', results: {
        verified: { status: 'success', formUuid: 'FORM-VERIFIED', fields: [{ label: 'Name', componentName: 'TextField' }] },
        unknown: { status: 'failed', errorCode: 'NON_IDEMPOTENT_RESULT_UNKNOWN' },
      } });
    expect(sandbox.refreshTokens).toEqual([OLD_REFRESH]);
    expect([...creates].sort()).toEqual(['Unknown', 'Verified']);
    expect(sandbox.requests.filter(request => request.endpoint === CREATE).map(request => request.token))
      .toEqual([`Bearer ${NEW_ACCESS}`, `Bearer ${NEW_ACCESS}`]);
    const readbacks = () => sandbox.requests.filter(request => request.endpoint === 'getFormSchema.json' && request.id === 'FORM-VERIFIED');
    const readsBeforeRerun = readbacks().length;
    expect(readsBeforeRerun).toBeGreaterThan(0);
    expect((await invoke(sandbox, args)).code).toBe(1);
    expect(creates).toHaveLength(2);
    expect(readbacks()).toHaveLength(readsBeforeRerun + 1);
    expect(sandbox.refreshTokens).toEqual([OLD_REFRESH]);
  });
}, 30000);
