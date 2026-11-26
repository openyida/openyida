#!/usr/bin/env node
'use strict';

// Explicitly enabled real regression: owned apps/forms and synthetic API keys.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const assert = require('assert/strict');
const { execFile, spawn } = require('child_process');
const { createAuthRef, createYidaClient } = require('../../lib/core/yida-client');
const { redactSensitive, redactString } = require('../../lib/core/redact');
const { parseCliJsonStdout, buildEchoOperation } = require('./connector/runner');
const { normalizeSchemaFields } = require('../../lib/app/schema-field-resolution');
const connectorApi = require('../../lib/connector/api');

const ROOT = path.resolve(__dirname, '../..');

function connectorFixtureNames(runId) {
  const prefix = 'OY560_' + crypto.createHash('sha256').update(runId).digest('hex').slice(0, 8);
  // Current native service accepts 24 characters and rejects 25 as a DB error.
  // Keep fixture labels short without altering user-supplied business names.
  return { header: prefix + '_H', query: prefix + '_Q', headerAccount: prefix + '_HA',
    queryAccount: prefix + '_QA', legacy: prefix + '_OLD', repaired: prefix + '_NEW' };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function echoContent(value, runId, depth = 0) {
  if (!value || depth > 8) { return null; }
  if (typeof value === 'string') {
    try { return echoContent(JSON.parse(value), runId, depth + 1); } catch { return null; }
  }
  if (value.fixtureRunId === runId) { return value; }
  if (typeof value === 'object') {
    for (const child of Object.values(value)) {
      const found = echoContent(child, runId, depth + 1);
      if (found) { return found; }
    }
  }
  return null;
}

function httpbinEchoContent(value, runId, probe, depth = 0) {
  if (!value || depth > 8) { return null; }
  if (typeof value === 'string') {
    try { return httpbinEchoContent(JSON.parse(value), runId, probe, depth + 1); } catch { return null; }
  }
  if (value.url === `https://httpbin.org/anything/${runId}`
    || (typeof value.url === 'string' && value.url.startsWith(`https://httpbin.org/anything/${runId}?`))) {
    if (value.method !== 'GET' || !value.headers || !value.args || typeof probe !== 'string' || !probe) { return null; }
    const authorization = Object.entries(value.headers).find(([name]) => name.toLowerCase() === 'authorization')?.[1];
    return { fixtureRunId: runId, observed: { header: authorization === probe, query: value.args.probe_key === probe } };
  }
  if (typeof value === 'object') {
    for (const child of Object.values(value)) {
      const found = httpbinEchoContent(child, runId, probe, depth + 1);
      if (found) { return found; }
    }
  }
  return null;
}

async function startEchoServer(runId, probe, port = 0) {
  const server = http.createServer((req, res) => {
    req.resume();
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-OpenYida-Fixture', runId);
    if (!['/echo', '/health'].includes(url.pathname)) { res.writeHead(404); res.end('{}'); return; }
    res.end(JSON.stringify({ fixtureRunId: runId, observed: {
      header: req.headers.authorization === probe,
      query: url.searchParams.get('probe_key') === probe,
    } }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}`,
    close() { server.closeAllConnections(); server.close(); } };
}

async function startFixture(dir, runId, probe) {
  const local = await startEchoServer(runId, probe);
  const { server } = local;
  const config = path.join(dir, 'cloudflared.yml');
  fs.writeFileSync(config, '{}\n');
  const child = spawn(process.env.OPENYIDA_E2E_CLOUDFLARED || 'cloudflared', [
    'tunnel', '--config', config, '--no-autoupdate', '--url', `http://127.0.0.1:${server.address().port}`,
    '--protocol', 'http2',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const close = () => { child.kill('SIGTERM'); server.closeAllConnections(); server.close(); };
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Controlled HTTPS tunnel timed out')), 45000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`Controlled HTTPS tunnel exited ${code}/${signal}: ${output.slice(-1500)}`)); });
      let output = '';
      const read = data => {
        output += data.toString();
        const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      };
      child.stderr.on('data', read);
      child.stdout.on('data', read);
    });
    let ready = false;
    for (let attempt = 0; attempt < 12 && !ready; attempt++) {
      try {
        const response = await fetch(url + '/health', { signal: AbortSignal.timeout(5000) });
        ready = response.headers.get('x-openyida-fixture') === runId && (await response.json()).fixtureRunId === runId;
      } catch { /* The new tunnel may still be propagating. */ }
      if (!ready) { await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    assert(ready, 'Controlled fixture ownership probe failed');
    return { url, close };
  } catch (error) { close(); throw error; }
}

async function serveEcho(env = process.env) {
  const runId = env.OPENYIDA_E2E_ISSUE_RUN_ID || `OY_LOCAL_ECHO_${Date.now()}`;
  assert(/^[A-Za-z0-9_-]+$/.test(runId), 'Invalid run ID');
  const port = Number(env.OPENYIDA_E2E_ECHO_PORT || 18760);
  assert(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid local echo port');
  const dir = path.join(ROOT, 'project/.cache/e2e-real/issues-560-479', runId);
  const registry = path.join(dir, 'registry.json');
  const previous = fs.existsSync(registry) ? JSON.parse(fs.readFileSync(registry, 'utf8')) : {};
  const probe = previous.syntheticProbe || 'Bearer OY_FAKE_' + crypto.randomBytes(12).toString('hex');
  const service = await startEchoServer(runId, probe, port);
  const metadata = { status: 'listening', url: service.url, pid: process.pid, runId, startedAt: new Date().toISOString() };
  writeJson(path.join(dir, 'local-echo.json'), metadata);
  process.once('SIGINT', () => service.close());
  process.once('SIGTERM', () => service.close());
  return metadata;
}

async function run(options = {}) {
  const env = options.env || process.env;
  if (env.OPENYIDA_E2E !== '1' || env.OPENYIDA_E2E_ISSUES_560_479 !== '1') {
    return { skipped: true, reason: 'Set OPENYIDA_E2E=1 and OPENYIDA_E2E_ISSUES_560_479=1' };
  }
  const auth = createAuthRef();
  assert(env.OPENYIDA_E2E_CORP_ID && env.OPENYIDA_E2E_CORP_ID === auth.corpId, 'Explicit test organization must match current profile');
  const runId = env.OPENYIDA_E2E_ISSUE_RUN_ID || `OY_560_479_${Date.now()}`;
  assert(/^[A-Za-z0-9_-]+$/.test(runId), 'Invalid run ID');
  const dir = path.join(ROOT, 'project/.cache/e2e-real/issues-560-479', runId);
  const registryPath = path.join(dir, 'registry.json');
  const state = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : {
    runId, corpId: auth.corpId, baseUrl: auth.baseUrl, steps: {}, resources: [], cases: {}, startedAt: new Date().toISOString(),
  };
  assert(state.corpId === auth.corpId && state.baseUrl === auth.baseUrl, 'Resume identity mismatch');
  const persist = () => writeJson(registryPath, state);
  // Keep response artifacts separate from request fixtures, including old runs.
  for (const [name, step] of Object.entries(state.steps)) {
    if (step.output && fs.existsSync(step.output) && path.dirname(step.output) === dir) {
      const output = path.join(dir, 'outputs', name + '.json');
      writeJson(output, JSON.parse(fs.readFileSync(step.output, 'utf8')));
      step.output = output;
    }
  }
  persist();
  const client = createYidaClient({ authRef: auth });
  const commandEnv = { ...env, OPENYIDA_AUTH_PROFILE: auth.authProfile, OPENYIDA_NO_AUTO_UPDATE: '1',
    OPENYIDA_SKIP_UPDATE_CHECK: '1', YIDA_QUIET: '1' };
  async function cli(name, args, write = false, cwd = dir) {
    const previous = state.steps[name];
    if (previous?.status === 'passed' && write) { return JSON.parse(fs.readFileSync(previous.output, 'utf8')); }
    if (write && previous) { throw new Error(`Inspect pending remote write before resuming: ${name}`); }
    fs.mkdirSync(cwd, { recursive: true });
    state.steps[name] = { status: 'running', write, startedAt: new Date().toISOString() };
    persist();
    console.log(`Running ${name}`);
    let commandResult;
    try {
      commandResult = await new Promise((resolve, reject) => execFile('openyida', args, {
        cwd, env: commandEnv, encoding: 'utf8', timeout: 180000, maxBuffer: 20 * 1024 * 1024,
      }, (error, stdout, stderr) => {
        if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
        else { resolve({ stdout, stderr }); }
      }));
      const parsed = parseCliJsonStdout(commandResult.stdout);
      assert(parsed, `${name}: missing JSON response`);
      assert(parsed.success !== false && parsed.ok !== false, `${name}: unsuccessful result`);
      const output = path.join(dir, 'outputs', name + '.json');
      writeJson(output, redactSensitive(parsed, { fullMask: true }));
      state.steps[name] = { ...state.steps[name], status: 'passed', output };
      for (const [key, type] of [['appType', 'app'], ['formUuid', 'form'], ['connectorId', 'connector'], ['connectionId', 'connection'], ['formInstId', 'record'], ['targetAppType', 'imported-app']]) {
        if (write && parsed[key]) { state.resources.push({ type, id: parsed[key], step: name, owned: true }); }
      }
      persist();
      return parsed;
    } catch (error) {
      state.steps[name] = { ...state.steps[name], status: 'failed', code: error.code, signal: error.signal,
        error: redactString(String(error.stderr || error.stdout || error.message)).slice(0, 4000) };
      persist();
      throw error;
    }
  }
  const fixtureFile = (name, data) => { const file = path.join(dir, name + '.json'); writeJson(file, data); return file; };
  async function once(name, action, type) {
    const previous = state.steps[name];
    if (previous?.status === 'passed') { return JSON.parse(fs.readFileSync(previous.output, 'utf8')); }
    assert(!previous, `Inspect pending remote write: ${name}`);
    state.steps[name] = { status: 'running', write: true }; persist();
    console.log(`Running ${name}`);
    try {
      const value = await action();
      const output = path.join(dir, 'outputs', name + '.json');
      writeJson(output, redactSensitive(value, { fullMask: true }));
      state.steps[name] = { status: 'passed', write: true, output };
      if (type) { state.resources.push({ type, id: value.id || value.connectionId, step: name, owned: true }); }
      persist(); return value;
    } catch (error) {
      state.steps[name].status = 'failed'; state.steps[name].error = redactString(error.message); persist(); throw error;
    }
  }
  async function schema(app, form) {
    const response = await client.get(`/alibaba/web/${app}/_view/query/formdesign/getFormSchema.json`, { formUuid: form, schemaVersion: 'V5' });
    assert(response.success === true);
    const value = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;
    assert(Array.isArray(value.pages));
    return value;
  }
  function field(value, type) {
    const fields = normalizeSchemaFields({ content: value }).filter(item => item.componentType === type);
    assert.equal(fields.length, 1, 'Expected exactly one fixture field');
    return fields[0].fieldId;
  }
  function relations(value, found = []) {
    if (!value || typeof value !== 'object') { return found; }
    if (value.componentName === 'AssociationFormField' && value.props?.associationForm) { found.push(value.props.associationForm); }
    for (const child of Object.values(value)) { relations(child, found); }
    return found;
  }
  function record(response) {
    let value = response.content || response;
    if (typeof value === 'string') { value = JSON.parse(value); }
    let data = value.formData || value.formDataJson || {};
    if (typeof data === 'string') { data = JSON.parse(data); }
    const instValue = typeof value.instValue === 'string' ? JSON.parse(value.instValue) : value.instValue;
    if (Array.isArray(instValue)) {
      for (const item of instValue) { if (item.fieldId && item.fieldData) { data[item.fieldId] = item.fieldData.value; } }
    }
    return data;
  }

  async function importCase() {
    const created = await cli('source-app', ['create-app', '--name', runId + '_Source', '--desc', 'Owned regression 560/479', '--no-open', '--json'], true);
    const app = created.appType;
    const aName = runId + '_A', bName = runId + '_B';
    const a = await cli('source-form-a', ['create-form', 'create', app, aName,
      fixtureFile('fields-a', [{ type: 'TextField', label: 'A名称' }]), '--no-open', '--json'], true);
    const aSchema = await schema(app, a.formUuid);
    const aText = field(aSchema, 'TextField');
    const b = await cli('source-form-b', ['create-form', 'create', app, bName,
      fixtureFile('fields-b', [{ type: 'TextField', label: 'B名称' }, { type: 'AssociationFormField', label: '关联A',
        associationForm: { appType: app, formUuid: a.formUuid, formTitle: aName, mainFieldId: aText, mainFieldLabel: 'A名称' } }]), '--no-open', '--json'], true);
    const bText = field(await schema(app, b.formUuid), 'TextField');
    await cli('source-a-link-b', ['create-form', 'update', app, a.formUuid,
      fixtureFile('a-link-b', [{ action: 'add', field: { type: 'AssociationFormField', label: '关联B',
        associationForm: { appType: app, formUuid: b.formUuid, formTitle: bName, mainFieldId: bText, mainFieldLabel: 'B名称' } } }]), '--force', '--no-open', '--json'], true);
    const exportFile = path.join(dir, 'source-export.json');
    await cli('export', ['export', app, exportFile]);
    const exported = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    for (const mode of ['uuid', 'alias']) {
      const copy = JSON.parse(JSON.stringify(exported));
      if (mode === 'alias') {
        for (const item of copy.forms) { item.alias = item.formUuid === a.formUuid ? 'fixture_a' : 'fixture_b'; }
        for (const item of copy.forms) {
          for (const relation of relations(item.schema)) {
            relation.formAlias = relation.formUuid === a.formUuid ? 'fixture_a' : 'fixture_b';
            delete relation.formUuid;
          }
        }
      }
      const input = fixtureFile('import-' + mode, copy);
      const cwd = path.join(dir, mode);
      const imported = await cli('import-' + mode, ['import', input, runId + '_' + mode], true, cwd);
      const report = JSON.parse(fs.readFileSync(path.join(cwd, 'yida-migration-report.json'), 'utf8'));
      assert.equal(report.status, 'complete');
      const targetA = report.forms.find(item => item.oldFormUuid === a.formUuid).newFormUuid;
      const targetB = report.forms.find(item => item.oldFormUuid === b.formUuid).newFormUuid;
      const targetApp = imported.targetAppType;
      assert.notEqual(targetApp, app); assert.notEqual(targetA, a.formUuid); assert.notEqual(targetB, b.formUuid);
      const as = await schema(targetApp, targetA), bs = await schema(targetApp, targetB);
      const ar = relations(as), br = relations(bs);
      assert.equal(ar.length, 1); assert.equal(br.length, 1);
      assert.equal(ar[0].formUuid, targetB); assert.equal(br[0].formUuid, targetA);
      assert.equal(ar[0].appType, targetApp); assert.equal(br[0].appType, targetApp);
      assert.equal(ar[0].mainFieldId, bText); assert.equal(br[0].mainFieldId, aText);
      assert(!('formAlias' in ar[0]) && !('formAlias' in br[0]));
      const aRelation = field(as, 'AssociationFormField'), bRelation = field(bs, 'AssociationFormField');
      const target = (id, title, formUuid) => ({ appType: targetApp, formUuid, formType: 'receipt', instanceId: id, title, subTitle: '' });
      const aTitle = runId + '_A_record', bTitle = runId + '_B_record';
      const aRecord = await cli(mode + '-data-a', ['data', 'create', 'form', targetApp, targetA, '--expect-form-name', aName, '--expect-form-type', 'receipt',
        '--data-file', fixtureFile(mode + '-data-a', { [aText]: aTitle }), '--verify-write', '--json'], true);
      assert(aRecord.formInstId && aRecord.readbackVerified === true);
      const bRecord = await cli(mode + '-data-b', ['data', 'create', 'form', targetApp, targetB, '--expect-form-name', bName, '--expect-form-type', 'receipt',
        '--data-file', fixtureFile(mode + '-data-b', { [bText]: bTitle, [bRelation]: [target(aRecord.formInstId, aTitle, targetA)] }), '--verify-write', '--json'], true);
      assert(bRecord.formInstId && bRecord.readbackVerified === true);
      await cli(mode + '-data-a-link-b', ['data', 'update', 'form', targetApp, '--inst-id', aRecord.formInstId, '--form-uuid', targetA,
        '--expect-form-name', aName, '--expect-form-type', 'receipt', '--data-file', fixtureFile(mode + '-data-a-link-b', { [aRelation]: [target(bRecord.formInstId, bTitle, targetB)] }), '--verify-write', '--json'], true);
      const readA = record(await cli(mode + '-read-a', ['data', 'get', 'form', targetApp, '--inst-id', aRecord.formInstId, '--form-uuid', targetA, '--json']));
      const readB = record(await cli(mode + '-read-b', ['data', 'get', 'form', targetApp, '--inst-id', bRecord.formInstId, '--form-uuid', targetB, '--json']));
      assert.equal(readA[aRelation][0].instanceId, bRecord.formInstId);
      assert.equal(readB[bRelation][0].instanceId, aRecord.formInstId);
      state.cases['479-' + mode] = { status: 'passed', appType: targetApp, targetA, targetB, recordIds: [aRecord.formInstId, bRecord.formInstId] };
      persist();
    }
  }

  async function connectorCase() {
    state.syntheticProbe ||= 'Bearer OY_FAKE_' + crypto.randomBytes(12).toString('hex');
    persist();
    const probe = state.syntheticProbe;
    const operation = buildEchoOperation(); operation.url = '/echo'; operation.method = 'get';
    const publicEcho = env.OPENYIDA_E2E_FIXTURE_KIND === 'httpbin';
    if (publicEcho) { operation.url = '/anything/' + runId; }
    const operations = fixtureFile('connector/echo-operations', [operation]);
    const pairs = {};
    const names = connectorFixtureNames(runId);
    for (const location of ['HEADER', 'QUERY']) {
      const label = location.toLowerCase();
      const connector = await cli('connector-' + label, ['connector', 'create', names[label], auth.baseUrl,
        '--auth', 'API密钥', '--api-key-name', location === 'HEADER' ? 'Authorization' : 'probe_key', '--api-key-location', location,
        '--operations', operations, '--json'], true);
      const account = await cli('account-' + label, ['connector', 'create-connection', String(connector.connectorId), names[label + 'Account'],
        '--api-key', probe, '--json'], true);
      const detail = await connectorApi.getConnectorDetail(connector.connectorName, auth);
      const scheme = JSON.parse(detail.securitySchemes).ApiKeyAuth;
      // A resumed run may already have deliberately downgraded this owned
      // header fixture. Its original configuration was verified before that.
      const pendingLegacy = label === 'header' && state.steps['legacy-scheme']?.status === 'passed'
        && state.steps['repair-account-header']?.status !== 'passed';
      if (pendingLegacy) {
        assert.equal(state.cases['560-header-config']?.status, 'passed');
        assert.equal(scheme.location, label);
      } else {
        assert.equal(scheme.type, 'apiKey'); assert.equal(scheme.in, label); assert.equal(scheme.location, label);
      }
      state.cases['560-' + label + '-config'] = { status: 'passed', connectorId: connector.connectorId, connectionId: account.connectionId };
      pairs[label] = { connector, account }; persist();
    }
    const header = pairs.header;
    const legacy = await once('legacy-scheme', async () => {
      const detail = await connectorApi.getConnectorDetail(header.connector.connectorName, auth);
      const schemes = JSON.parse(detail.securitySchemes); delete schemes.ApiKeyAuth.type; delete schemes.ApiKeyAuth.in;
      const result = await connectorApi.saveConnector({ ...detail, id: header.connector.connectorId, securitySchemes: JSON.stringify(schemes) }, auth);
      return { securitySchemes: JSON.stringify(schemes), readbackVerified: result.readbackVerified };
    });
    const old = await once('legacy-account', () => connectorApi.createConnection({
      connectorName: header.connector.connectorName, connectionName: names.legacy, securitySchemes: legacy.securitySchemes,
      securityValue: JSON.stringify({ token: probe }), authType: 3,
    }, auth), 'connection');
    const repaired = await cli('repair-account-header', ['connector', 'create-connection', String(header.connector.connectorId), names.repaired,
      '--api-key', probe, '--repair-api-key-scheme', '--json'], true);
    assert.equal(repaired.schemeRepaired, true); assert.equal(repaired.existingAccountsUnchanged, true);
    const accounts = await connectorApi.listConnections(header.connector.connectorName, auth);
    assert(accounts.some(account => String(account.id || account.connectionId) === String(old.id || old.connectionId)));
    assert.notEqual(String(repaired.connectionId), String(old.id || old.connectionId));
    header.account = repaired;
    state.cases['560-legacy-repair'] = { status: 'passed', oldAccountId: old.id || old.connectionId, newAccountId: repaired.connectionId }; persist();
    if (env.OPENYIDA_E2E_CONFIG_ONLY === '1') {
      state.cases['560-runtime'] = { status: 'blocked', reason: 'Controlled HTTPS fixture required' }; persist();
      return { status: 'partial', reason: 'Remote creation/readback/repair passed; runtime echo pending' };
    }
    const fixture = publicEcho ? { url: 'https://httpbin.org', close() {} } : env.OPENYIDA_E2E_FIXTURE_URL
      ? { url: env.OPENYIDA_E2E_FIXTURE_URL, close() {} } : await startFixture(dir, runId, probe);
    state.fixture = { url: fixture.url, owned: !publicEcho, kind: publicEcho ? 'public-httpbin' : 'controlled',
      ephemeral: !publicEcho && !env.OPENYIDA_E2E_FIXTURE_URL }; persist();
    try {
      for (const location of ['HEADER', 'QUERY']) {
        const label = location.toLowerCase();
        const { connector, account } = pairs[label];
        await once('bind-fixture-' + label, async () => {
          const detail = await connectorApi.getConnectorDetail(connector.connectorName, auth);
          return connectorApi.saveConnector({ ...detail, id: connector.connectorId, host: new URL(fixture.url).host, baseUrl: '/', scheme: 'https',
            operations: JSON.stringify([operation]) }, auth);
        });
        const tested = await cli('test-' + label, ['connector', 'test', '--connector-id', String(connector.connectorId), '--action', operation.operationId,
          '--account-id', String(account.connectionId), '--json']);
        // CLI output masks credentials. For a public echo, compare the raw
        // response in memory through the same testOperation API, persist only
        // the booleans, and never weaken CLI redaction to make the test pass.
        const rawTest = publicEcho ? await connectorApi.testConnector({
          connector: await connectorApi.getConnectorDetail(connector.connectorName, auth), operation, authId: account.connectionId,
        }, auth) : tested;
        const echo = publicEcho ? httpbinEchoContent(rawTest, runId, probe) : echoContent(rawTest, runId);
        writeJson(path.join(dir, 'observed-test-' + label + '.json'), { echo, statusLine: rawTest.statusLine });
        assert(echo?.observed[label] === true, `${location} not injected in testOperation`);
        const runtime = await client.postFormOnce('/query/publicService/invokeService.json', {
          inputs: JSON.stringify({ path: {}, query: {}, header: {}, body: {} }),
          serviceInfo: JSON.stringify({ connectorInfo: { connectorId: connector.connectorName, actionId: operation.operationId, type: 'httpConnector', connection: String(account.connectionId) } }),
        });
        const actual = publicEcho ? httpbinEchoContent(runtime, runId, probe) : echoContent(runtime, runId);
        writeJson(path.join(dir, 'runtime-' + label + '.json'), publicEcho ? { echo: actual, success: runtime.success }
          : redactSensitive(runtime, { fullMask: true }));
        assert(actual?.observed[label] === true, `${location} not injected in invokeService`);
        state.cases['560-' + label] = { status: 'passed', connectorId: connector.connectorId, connectionId: account.connectionId, testOperation: true, invokeService: true }; persist();
      }
      delete state.cases['560-runtime']; persist();
    } finally { fixture.close(); }
  }
  const cases = env.OPENYIDA_E2E_ISSUE_CASES || 'all';
  for (const [name, fn] of [['479', importCase], ['560', connectorCase]]) {
    if (cases !== 'all' && cases !== name) { continue; }
    if (state.cases[name]?.status === 'passed') { continue; }
    try { state.cases[name] = await fn() || { status: 'passed' }; persist(); }
    catch (error) { state.cases[name] = { status: 'failed', error: redactString(String(error.message)).slice(0, 2000) }; persist(); console.error(`Case ${name} failed: ${state.cases[name].error}`); }
  }
  state.finishedAt = new Date().toISOString();
  state.status = Object.values(state.cases).some(item => item.status === 'failed') ? 'failed'
    : Object.values(state.cases).some(item => item.status !== 'passed') ? 'partial' : 'passed';
  state.cleanup = 'Retained owned test resources for review; no existing resource was deleted.';
  persist();
  return { runId, status: state.status, cases: state.cases, registryPath };
}

if (require.main === module) {
  (process.argv.includes('--serve-echo') ? serveEcho() : run())
    .then(result => { console.log(JSON.stringify(result, null, 2)); if (result.status && !['passed', 'listening'].includes(result.status)) { process.exitCode = 1; } })
    .catch(error => { console.error(redactString(error.message)); process.exitCode = 1; });
}
module.exports = { run, echoContent, httpbinEchoContent, startFixture, startEchoServer, serveEcho, connectorFixtureNames };
