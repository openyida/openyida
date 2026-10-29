'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { entryPlan, execute, isAllowedEntryUrl, parseArgs, probeResource, sanitize, snapshotHash, validateDevConfig } = require('../lib/plugin/plugin-lifecycle');

let directory;
let client;
let version;
let installed;
let installedConfig;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-plugin-'));
  version = {
    pluginId: 'PLUGIN-TEST', version: '1.0.0',
    frontEndDevInfo: JSON.stringify({ cdnEntry: '/example/remoteEntry.js', extensions: [{ extensionId: 'yida.app.custom-page.component', config: { componentNameList: ['OpenYidaTimeline'] } }] }),
    backEndDevInfo: '{}', paramConfig: '{}', status: 'develop',
  };
  installed = { pluginId: 'PLUGIN-TEST', isEnabled: 'y', version: '1.0.0', config: '{"secret":"hidden"}' };
  installedConfig = { password: 'hidden' };
  client = {
    get: jest.fn(async (endpoint, params) => {
      if (endpoint.includes('pagePluginBasicInfo')) { return { success: true, content: { data: [{ pluginId: 'PLUGIN-TEST', pluginName: 'Test' }], totalCount: 1 } }; }
      if (endpoint.includes('getPluginBasicInfo')) { return { success: true, content: { pluginId: params.pluginId, pluginName: 'Test', status: 'develop' } }; }
      if (endpoint.includes('pagePluginVersion')) { return { success: true, content: { data: [version], totalCount: 1 } }; }
      if (endpoint.includes('getPluginVersionInfo')) { return { success: true, content: JSON.parse(JSON.stringify(version)) }; }
      if (endpoint.includes('getPluginExtensions')) { return { success: true, content: [{ extensionId: 'yida.app.custom-page.component', type: 'frontEnd' }] }; }
      if (endpoint.includes('pageInstalledPlugins')) { return { success: true, content: { data: installed ? [installed] : [], totalCount: installed ? 1 : 0 } }; }
      if (endpoint.includes('getInstalledPluginConfigInfo')) { return { success: true, content: { pluginId: params.pluginId, config: installedConfig } }; }
      if (endpoint.includes('getFrontExtPluginInfos')) { return { success: true, content: [{ ...installed, cdnUrl: 'https://g.alicdn.com/example/remoteEntry.js', extensions: ['yida.app.custom-page.component'] }] }; }
      throw new Error(endpoint);
    }),
    postFormOnce: jest.fn(async (endpoint, params) => {
      if (endpoint.includes('newPluginWithDefaultVersion')) { return { success: true, content: 'PLUGIN-CREATED' }; }
      if (endpoint.includes('newPluginVersion')) { version = { ...version, version: params.version }; return { success: true, content: true }; }
      if (endpoint.includes('savePluginDevInfo')) {
        version = { ...version, frontEndDevInfo: params.frontEndDevInfo, backEndDevInfo: params.backEndDevInfo, paramConfig: params.paramConfig, extensionInfo: params.extensionInfo };
        return { success: true, content: true };
      }
      if (endpoint.includes('modifyPluginState')) { installed = { ...installed, isEnabled: params.isEnabled }; return { success: true, content: true }; }
      if (endpoint.includes('uninstallPlugin')) { installed = null; return { success: true, content: true }; }
      if (endpoint.includes('upgradePlugin')) { installed = { ...installed, version: '2.0.0' }; return { success: true, content: true }; }
      if (endpoint.includes('savePluginConfig')) { installedConfig = JSON.parse(params.config); return { success: true, content: true }; }
      throw new Error(endpoint);
    }),
  };
});

afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

test('parses read actions but requires explicit confirmation for organization writes', () => {
  expect(parseArgs(['dev-list', '--search', 'AI'])).toMatchObject({ action: 'dev-list' });
  expect(() => parseArgs(['disable', 'PLUGIN-TEST'])).toThrow('disable');
  expect(parseArgs(['disable', 'PLUGIN-TEST', '--confirm'])).toMatchObject({ action: 'disable' });
});

test('reads native developer resources without mutating the platform', async () => {
  const result = await execute(parseArgs(['version-get', 'PLUGIN-TEST', '1.0.0']), client);
  expect(result.snapshotHash).toHaveLength(64);
  expect(result.item.pluginId).toBe('PLUGIN-TEST');
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('create keeps connector default but omits connector fields for other extensions', async () => {
  const args = ['create', '--name', 'Timeline', '--description', 'Custom page', '--logo', 'https://example.test/logo.png', '--confirm'];
  await execute(parseArgs(args), client);
  expect(client.postFormOnce.mock.calls[0][1]).toMatchObject({ pluginType: 'ConnectorPlugin', type: 'ConnectorPlugin' });
  client.postFormOnce.mockClear();
  const result = await execute(parseArgs([...args, '--type', 'other']), client);
  const params = client.postFormOnce.mock.calls[0][1];
  expect(params).not.toHaveProperty('type');
  expect(params).not.toHaveProperty('pluginType');
  expect(result).toMatchObject({ pluginId: 'PLUGIN-CREATED', readbackVerified: true, published: false });
  expect(() => parseArgs([...args, '--type', 'custom-page'])).toThrow();
  expect(() => parseArgs(['get', 'PLUGIN-TEST', '--type', 'other'])).toThrow();
});

test('create reports the created resource without replay when other type is rewritten', async () => {
  const original = client.get.getMockImplementation();
  client.get.mockImplementation(async (endpoint, params) => endpoint.includes('getPluginBasicInfo')
    ? { success: true, content: { pluginId: params.pluginId, type: 'ConnectorPlugin' } } : original(endpoint, params));
  await expect(execute(parseArgs(['create', '--name', 'Timeline', '--description', 'Custom page', '--logo', 'https://example.test/logo.png', '--type', 'other', '--confirm']), client))
    .rejects.toMatchObject({ code: 'PLUGIN_READBACK_MISMATCH', details: { pluginId: 'PLUGIN-CREATED', resourceCreated: true } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('runtime list redacts config and does not claim consumer execution', async () => {
  const result = await execute(parseArgs(['runtime-list', '--extensions', 'yida.app.custom-page.component']), client);
  expect(result.items[0].config).toBeUndefined();
  expect(result.items[0].hasConfig).toBe(true);
  expect(result.evidence).toEqual({ registryCandidatesReturned: true, enabledRegistrationCount: 1, consumerExecutionVerified: false });
});

test('probe marks a known official CDN path as an unverified candidate', async () => {
  version.frontEndDevInfo = JSON.stringify({ cdnEntry: '/yida-components/calendar/1.0.0/remoteEntry.js' });
  const result = await execute(parseArgs(['probe', 'PLUGIN-TEST', '1.0.0', '--check-resource']), client, {
    probeResource: jest.fn(async url => ({ reachable: true, url, statusCode: 200 })),
  });
  expect(result.plan.cdnUrl).toBe('https://g.alicdn.com/yida-components/calendar/1.0.0/remoteEntry.js');
  expect(result.plan.urlResolution).toBe('official-default-candidate');
  expect(result.evidence).toEqual({ persistedConfig: true, resourceReachabilityChecked: true, resourceReachable: true, runtimeRegistrationChecked: false, consumerExecutionVerified: false });
});

test('probe does not invent a CDN host for custom relative namespaces', async () => {
  const probe = jest.fn();
  const result = await execute(parseArgs(['probe', 'PLUGIN-TEST', '1.0.0', '--check-resource']), client, { probeResource: probe });
  expect(result.plan).toMatchObject({ entry: '/example/remoteEntry.js', cdnUrl: null, urlResolution: 'unresolved-relative-path' });
  expect(result.evidence.resourceReachabilityChecked).toBe(false);
  expect(probe).not.toHaveBeenCalled();
});

test('probe preserves external URLs and reports SDK container hints separately from host proof', async () => {
  const url = 'https://cdn.example.test/plugins/calendar/1.0.0/remoteEntry.js?v=2';
  version.frontEndDevInfo = JSON.stringify({ cdnEntry: url });
  const result = await execute(parseArgs(['probe', 'PLUGIN-TEST', '1.0.0']), client);
  expect(result.plan).toMatchObject({
    entry: url, cdnUrl: url, entryKind: 'https-url', urlResolution: 'verbatim',
    runtimeContract: { containerName: 'TEST', classification: 'third-party', verifiedInCurrentHost: false },
  });
  expect(result.evidence.resourceReachable).toBeNull();
  expect(result.evidence.consumerExecutionVerified).toBe(false);
  expect(result.hostingGuide).toBe(path.resolve(__dirname, '../yida-skills/skills/yida-plugin-frontend-deploy/SKILL.md'));
  expect(fs.existsSync(result.hostingGuide)).toBe(true);
  expect(entryPlan('https://cdn.example.test/yida-components/remoteEntry.js', 'PLUGIN-TEST').runtimeContract)
    .toMatchObject({ classification: 'official-substring-match', containerName: null });
});

test('probe without version does not claim missing developer config was read', async () => {
  const result = await execute(parseArgs(['probe', 'PLUGIN-TEST']), client);
  expect(result.evidence.persistedConfig).toBe(false);
  expect(result.nextAction).toBe('PROBE_EXPLICIT_VERSION');
  expect(() => parseArgs(['probe', 'PLUGIN-TEST', 'latest'])).toThrow();
});

test('allows loopback HTTP only for local plugin development', () => {
  expect(isAllowedEntryUrl('http://localhost:41739/remoteEntry.js')).toBe(true);
  expect(isAllowedEntryUrl('http://127.0.0.1:41739/remoteEntry.js')).toBe(true);
  expect(isAllowedEntryUrl('http://0.0.0.0:41739/remoteEntry.js')).toBe(true);
  expect(isAllowedEntryUrl('http://[::1]:41739/remoteEntry.js')).toBe(true);
  expect(isAllowedEntryUrl('http://example.com/remoteEntry.js')).toBe(false);
  expect(isAllowedEntryUrl('https://example.com/remoteEntry.js')).toBe(true);
  expect(entryPlan('http://127.0.0.1:41739/remoteEntry.js', 'PLUGIN-TEST').localDebugOnly).toBe(true);
});

test.each([
  '//evil.test/remoteEntry.js', 'https://', 'https:///example.com/entry.js',
  'https://user:secret@example.test/entry.js', 'https://example.test/entry.js#fragment',
  ' https://example.test/entry.js', 'https://example.test/\nentry.js', 'https://example.test\\entry.js',
  '/path/../entry.js', '/path/%2e%2e/entry.js', '/path?redirect=//evil.test', '', null, 12,
])('rejects malformed or ambiguous resource entries: %s', entry => {
  expect(isAllowedEntryUrl(entry)).toBe(false);
});

test('HEAD probe distinguishes an HTML response from JavaScript and bounds redirects', async () => {
  const methods = [];
  const server = http.createServer((request, response) => {
    methods.push(request.method);
    if (request.url === '/redirect') { response.writeHead(302, { location: '/script.js' }); }
    else if (request.url === '/loop') { response.writeHead(302, { location: '/loop' }); }
    else if (request.url === '/broken') { response.writeHead(302, { location: 'https://[' }); }
    else if (request.url === '/script.js') { response.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); }
    else if (request.url === '/missing') { response.writeHead(404, { 'content-type': 'text/html' }); }
    else { response.writeHead(200, { 'content-type': 'text/html' }); }
    response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    expect(await probeResource(`${base}/redirect`)).toMatchObject({ reachable: true, javascriptContentType: true, scriptExecutionVerified: false });
    expect(await probeResource(`${base}/login.html`)).toMatchObject({ reachable: true, javascriptContentType: false, scriptExecutionVerified: false });
    expect(await probeResource(`${base}/missing`)).toMatchObject({ reachable: false, statusCode: 404 });
    expect(await probeResource(`${base}/broken`)).toMatchObject({ reachable: false, reason: 'invalid_redirect' });
    expect(await probeResource(`${base}/loop`)).toMatchObject({ reachable: false, reason: 'invalid_or_redirect_limit' });
    expect(methods.every(method => method === 'HEAD')).toBe(true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('normalizes only the runtime alias and rejects conflicting entries', () => {
  const url = 'https://cdn.example.test/calendar/remoteEntry.js';
  const input = { frontEndDevInfo: { cdnUrl: url } };
  expect(validateDevConfig(input, new Set()).config.frontEndDevInfo).toEqual({ cdnEntry: url });
  expect(input.frontEndDevInfo).toEqual({ cdnUrl: url });
  expect(() => validateDevConfig({ frontEndDevInfo: { cdnEntry: url, cdnUrl: `${url}?v=2` } }, new Set()))
    .toThrow('cdnEntry/cdnUrl');
});

test.each([undefined, [], [''], ['One', 'One'], [12]])('rejects missing or invalid custom-page component names before saving: %j', names => {
  expect(() => validateDevConfig({ frontEndDevInfo: { extensions: [{ extensionId: 'yida.app.custom-page.component', config: { componentNameList: names } }] } }, new Set(['yida.app.custom-page.component'])))
    .toThrow('componentNameList');
});

test('saves external runtime aliases as cdnEntry without rewriting the URL or namespace', async () => {
  const configPath = path.join(directory, 'external.json');
  const url = 'https://static.example.test/my-assets/calendar/1.0.0/remoteEntry.js';
  fs.writeFileSync(configPath, JSON.stringify({ frontEndDevInfo: { cdnUrl: url } }));
  const result = await execute(parseArgs(['save-dev', 'PLUGIN-TEST', '1.0.0', '--config', configPath, '--expected-hash', snapshotHash(version), '--backup', path.join(directory, 'external.before.json'), '--confirm']), client);
  expect(JSON.parse(client.postFormOnce.mock.calls[0][1].frontEndDevInfo)).toEqual({ cdnEntry: url });
  expect(JSON.parse(result.item.frontEndDevInfo)).toEqual({ cdnEntry: url });
  expect(result.readbackVerified).toBe(true);
});

test.each(['frontEndDevInfo', 'backEndDevInfo', 'paramConfig', 'extensionInfo'])('detects server rewriting %s despite successful save', async field => {
  const configPath = path.join(directory, 'rewritten.json');
  const backupPath = path.join(directory, 'rewrite.before.json');
  fs.writeFileSync(configPath, JSON.stringify({ frontEndDevInfo: { cdnEntry: 'https://cdn.example.test/remoteEntry.js', extensions: [{ extensionId: 'yida.app.custom-page.component', config: { componentNameList: ['OpenYidaTimeline'] } }] }, backEndDevInfo: {}, paramConfig: {} }));
  client.postFormOnce.mockImplementationOnce(async (_endpoint, params) => {
    version = { ...version, frontEndDevInfo: params.frontEndDevInfo, backEndDevInfo: params.backEndDevInfo, paramConfig: params.paramConfig, extensionInfo: params.extensionInfo };
    version[field] = JSON.stringify({ ...JSON.parse(params[field]), changedByServer: true });
    return { success: true, content: true };
  });
  await expect(execute(parseArgs(['save-dev', 'PLUGIN-TEST', '1.0.0', '--config', configPath, '--expected-hash', snapshotHash(version), '--backup', backupPath, '--confirm']), client))
    .rejects.toMatchObject({ code: 'PLUGIN_READBACK_MISMATCH', details: { mismatchedFields: [field], resourceMayHaveBeenChanged: true, backupPath } });
  expect(fs.existsSync(backupPath)).toBe(true);
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('save-dev checks the original hash, writes a backup, validates extensions and never publishes', async () => {
  const configPath = path.join(directory, 'dev.json');
  const backupPath = path.join(directory, 'before.json');
  fs.writeFileSync(configPath, JSON.stringify({ frontEndDevInfo: { cdnEntry: '/next/remoteEntry.js', extensions: [{ extensionId: 'yida.app.custom-page.component', config: { componentNameList: ['OpenYidaTimeline'] } }] }, backEndDevInfo: {}, paramConfig: {} }));
  const args = parseArgs(['save-dev', 'PLUGIN-TEST', '1.0.0', '--config', configPath, '--expected-hash', snapshotHash(version), '--backup', backupPath, '--confirm']);
  const result = await execute(args, client);
  expect(result.readbackVerified).toBe(true);
  expect(result.published).toBe(false);
  expect(fs.existsSync(backupPath)).toBe(true);
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(client.postFormOnce.mock.calls[0][0]).toContain('savePluginDevInfo');
});

test.each([
  { extensionIds: ['old'], metadata: { keep: true } },
  [{ extensionId: 'old' }],
])('saves a publishable extensionInfo object and preserves object metadata', async original => {
  version.extensionInfo = JSON.stringify(original);
  const configPath = path.join(directory, 'extensions.json');
  fs.writeFileSync(configPath, JSON.stringify({ frontEndDevInfo: { extensions: [{ extensionId: 'yida.app.custom-page.component', config: { componentNameList: ['OpenYidaTimeline'] } }] } }));
  const result = await execute(parseArgs(['save-dev', 'PLUGIN-TEST', '1.0.0', '--config', configPath, '--expected-hash', snapshotHash(version), '--backup', path.join(directory, 'extension.before.json'), '--confirm']), client);
  const actual = JSON.parse(result.item.extensionInfo);
  expect(actual).toEqual({ ...(Array.isArray(original) ? {} : original), extensionIds: ['yida.app.custom-page.component'] });
  expect(Array.isArray(actual)).toBe(false);
  expect(JSON.parse(fs.readFileSync(path.join(directory, 'extension.before.json'), 'utf8')).item.extensionInfo).toBe(JSON.stringify(original));
});

test('save-dev stops before writing on conflict or unknown extension', async () => {
  const configPath = path.join(directory, 'bad.json');
  const backupPath = path.join(directory, 'before.json');
  fs.writeFileSync(configPath, JSON.stringify({ frontEndDevInfo: { extensions: [{ extensionId: 'unknown.extension' }] } }));
  await expect(execute(parseArgs(['save-dev', 'PLUGIN-TEST', '1.0.0', '--config', configPath, '--expected-hash', '0'.repeat(64), '--backup', backupPath, '--confirm']), client)).rejects.toMatchObject({ code: 'PLUGIN_CONFLICT' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
  await expect(execute(parseArgs(['save-dev', 'PLUGIN-TEST', '1.0.0', '--config', configPath, '--expected-hash', snapshotHash(version), '--backup', backupPath, '--confirm']), client)).rejects.toMatchObject({ code: 'PLUGIN_UNKNOWN_EXTENSION' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('disable and uninstall verify installed-state readback', async () => {
  const disabled = await execute(parseArgs(['disable', 'PLUGIN-TEST', '--confirm']), client);
  expect(disabled.plugin.isEnabled).toBe('n');
  expect(disabled.runtimeNote).toContain('existing uses may remain effective');
  const removed = await execute(parseArgs(['uninstall', 'PLUGIN-TEST', '--confirm']), client);
  expect(removed.plugin).toBeNull();
  expect(removed.readbackVerified).toBe(true);
});

test('configure requires the original config hash, creates a backup and verifies readback', async () => {
  const configPath = path.join(directory, 'install.json');
  const backupPath = path.join(directory, 'install.before.json');
  fs.writeFileSync(configPath, JSON.stringify({ endpoint: 'https://example.test' }));
  const read = await execute(parseArgs(['installed-get', 'PLUGIN-TEST']), client);
  const result = await execute(parseArgs(['configure', 'PLUGIN-TEST', '--config', configPath, '--expected-hash', read.configHash, '--backup', backupPath, '--confirm']), client);
  expect(result.readbackVerified).toBe(true);
  expect(fs.existsSync(backupPath)).toBe(true);
  expect(installedConfig).toEqual({ endpoint: 'https://example.test' });
});

test('sanitizes nested secret-like keys and opaque config values', () => {
  expect(sanitize({ accessToken: 'x', nested: { password: 'y' }, config: '{}' })).toEqual({ accessToken: '[REDACTED]', nested: { password: '[REDACTED]' }, hasConfig: false });
});

test('skill anchors the official development guide and connector contracts', () => {
  const skill = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-plugin-lifecycle/SKILL.md'), 'utf8');
  const guide = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-plugin-lifecycle/references/development-guide.md'), 'utf8');
  expect(skill).toContain('./references/development-guide.md');
  expect(guide).toContain('https://docs.aliwork.com/docs/yida_support/_13/isxkg8bbkick91q7');
  for (const contract of ['willFetch', 'didFetch', 'serviceUuid', 'content.outputs', '$CORP_ID', '$DING_UID', 'query', 'body', 'header', 'path']) {
    expect(guide).toContain(contract);
  }
  expect(guide).toContain('密钥参数必须标记为加密');
  expect(guide).toContain('发布到组织测试');
  expect(guide).toContain('插件中心上架');
});

test('skill separates hosting guidance, manual consent and unverified runtime hints', () => {
  const skill = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-plugin-lifecycle/SKILL.md'), 'utf8');
  const deploy = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-plugin-frontend-deploy/SKILL.md'), 'utf8');
  const hosting = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-plugin-frontend-deploy/references/frontend-hosting.md'), 'utf8');
  const contract = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-plugin-frontend-deploy/references/frontend-contract.md'), 'utf8');
  expect(skill).toContain('https://ding.aliwork.com/o/Plug-in');
  expect(skill).toContain('不代勾选、代同意');
  expect(skill).toContain('PLUGIN_READBACK_MISMATCH');
  expect(skill).toContain('use_skill("yida-plugin-frontend-deploy",');
  expect(skill).not.toContain('./references/frontend-hosting.md');
  expect(deploy).toContain('use_skill("yida-plugin-lifecycle",');
  expect(deploy).toContain('用户明确禁止或暂缓某渠道');
  for (const term of ['集团开发环境', '非集团开发环境', '码云 + 阿里云 OSS', '企业静态资源服务器', 'GitHub Actions + Pages']) {
    expect(hosting).toContain(term);
  }
  for (const term of ['verifiedInCurrentHost=false', 'unresolved-relative-path', 'publicPath', 'createPluginRuntimeRegistry']) {
    expect(contract).toContain(term);
  }
  expect(contract).toContain('消费者交互仍须独立验收');
});

test('frontend deploy skill has its own routing and coverage entry', () => {
  const index = require('../yida-skills/skills-index.json');
  const { SKILL_COVERAGE } = require('../scripts/e2e-real/skill-coverage');
  const name = 'yida-plugin-frontend-deploy';
  const route = index.skills.find(item => item.name === name);
  expect(route).toMatchObject({ path: `skills/${name}/SKILL.md`, requires_login: false, command_ids: ['plugin'] });
  expect(route.negative_signals).toContain('普通网站部署');
  expect(fs.existsSync(path.join(__dirname, '../yida-skills', route.path))).toBe(true);
  expect(SKILL_COVERAGE[name]).toMatchObject({ level: 'offline-unit', tests: expect.arrayContaining(['tests/plugin-lifecycle.test.js']) });
  const entry = fs.readFileSync(path.join(__dirname, '../yida-skills/SKILL.md'), 'utf8');
  expect(entry).toContain('`yida-plugin-frontend-deploy`');
});
