'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { createAuthRef, createYidaClient } = require('../core/yida-client');

const PREFIX = '/query/openPlugin/';
const ENDPOINTS = Object.freeze({
  devList: 'pagePluginBasicInfo', basic: 'getPluginBasicInfo', versions: 'pagePluginVersion',
  version: 'getPluginVersionInfo', extensions: 'getPluginExtensions', create: 'newPluginWithDefaultVersion',
  createVersion: 'newPluginVersion', saveDev: 'savePluginDevInfo', installedList: 'pageInstalledPlugins',
  installedConfig: 'getInstalledPluginConfigInfo', runtime: 'getFrontExtPluginInfos', state: 'modifyPluginState',
  upgrade: 'upgradePlugin', uninstall: 'uninstallPlugin', configure: 'savePluginConfig',
});
const READ_ACTIONS = new Set(['dev-list', 'get', 'version-list', 'version-get', 'extensions', 'installed-list', 'installed-get', 'runtime-list', 'probe']);
const WRITE_ACTIONS = new Set(['create', 'create-version', 'save-dev', 'enable', 'disable', 'configure', 'upgrade', 'uninstall']);
const PLUGIN_ID = /^PLUGIN-[A-Z0-9]+$/i;
const VERSION = /^\d+\.\d+\.\d+$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function fail(code, detail, details) {
  throw new CliError(t('plugin_lifecycle.failed', detail || code), { code: `PLUGIN_${code}`, details });
}
function stable(value) {
  if (Array.isArray(value)) { return value.map(stable); }
  if (!object(value)) { return value; }
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function snapshotHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
function parseJson(value, label) {
  if (typeof value !== 'string') { return value; }
  try { return JSON.parse(value); } catch (_) { fail('INVALID_RESPONSE', label); }
}
function unwrap(response, endpoint) {
  if (!response || response.success !== true || response.__needLogin || response.__csrfExpired) {
    fail('API_ERROR', response?.errorMsg || response?.message || endpoint, { endpoint, platformErrorCode: response?.errorCode });
  }
  return response.content;
}
function listOf(content) {
  if (Array.isArray(content)) { return content; }
  return content?.data || content?.list || content?.records || content?.items || [];
}
function totalOf(content, list) {
  return content?.totalCount ?? content?.total ?? content?.count ?? list.length;
}
function i18nText(value) {
  return JSON.stringify({ type: 'i18n', zh_CN: value, en_US: value });
}
function readConfig(filename) {
  try {
    const value = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
    if (!object(value)) { fail('INVALID_CONFIG', filename); }
    return value;
  } catch (error) {
    if (error instanceof CliError) { throw error; }
    fail('INVALID_CONFIG', `${filename}: ${error.message}`);
  }
}
function writeBackup(filename, payload) {
  const output = path.resolve(filename);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(payload, null, 2), { flag: 'wx', mode: 0o600 });
  return output;
}
function sanitize(value) {
  if (Array.isArray(value)) { return value.map(sanitize); }
  if (!object(value)) { return value; }
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|secret|password|credential|privatekey/i.test(key)) { output[key] = '[REDACTED]'; }
    else if (key === 'config') { output.hasConfig = item !== undefined && item !== null && item !== '' && item !== '{}'; }
    else { output[key] = sanitize(item); }
  }
  return output;
}
function installedConfigValue(value) {
  const candidate = object(value) && (Object.hasOwn(value, 'config') || Object.hasOwn(value, 'pluginConfig'))
    ? (value.config ?? value.pluginConfig)
    : value;
  return parseJson(candidate, 'installedPluginConfig');
}
function extensionIdsFrom(config) {
  const frontend = parseJson(config.frontEndDevInfo || {}, 'frontEndDevInfo') || {};
  const backend = parseJson(config.backEndDevInfo || {}, 'backEndDevInfo') || {};
  const ids = [];
  for (const extension of [...(frontend.extensions || []), ...(backend.extensions || [])]) {
    const id = extension?.extensionId || extension?.id;
    if (typeof id === 'string' && id) { ids.push(id); }
  }
  return [...new Set(ids)];
}
function validateDevConfig(config, knownExtensions) {
  for (const key of Object.keys(config)) {
    if (!['frontEndDevInfo', 'backEndDevInfo', 'paramConfig'].includes(key)) { fail('INVALID_CONFIG', `unsupported key ${key}`); }
  }
  for (const key of ['frontEndDevInfo', 'backEndDevInfo', 'paramConfig']) {
    if (config[key] !== undefined && !object(config[key])) { fail('INVALID_CONFIG', key); }
  }
  const ids = extensionIdsFrom(config);
  const unknown = ids.filter(id => !knownExtensions.has(id));
  if (unknown.length) { fail('UNKNOWN_EXTENSION', unknown.join(', ')); }
  const entry = config.frontEndDevInfo?.cdnEntry || config.frontEndDevInfo?.cdnUrl;
  if (entry !== undefined && (typeof entry !== 'string' || (!entry.startsWith('/') && !/^https:\/\//.test(entry)))) {
    fail('INVALID_CONFIG', 'frontEndDevInfo.cdnEntry');
  }
  return { ids, entry };
}
function resolveCdnUrl(value) {
  if (!value) { return null; }
  if (/^https:\/\//.test(value)) { return value; }
  if (value.startsWith('/')) { return `https://g.alicdn.com${value}`; }
  return null;
}
function probeResource(url, redirects = 0) {
  return new Promise(resolve => {
    if (!/^https:\/\//.test(url || '') || redirects > 3) { resolve({ reachable: false, url, reason: 'invalid_or_redirect_limit' }); return; }
    const request = https.request(url, { method: 'HEAD', timeout: 8000, headers: { 'user-agent': 'openyida-plugin-probe' } }, response => {
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && location) {
        response.resume();
        probeResource(new URL(location, url).href, redirects + 1).then(resolve);
        return;
      }
      response.resume();
      resolve({ reachable: response.statusCode >= 200 && response.statusCode < 400, url, statusCode: response.statusCode, contentType: response.headers['content-type'] || null });
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', error => resolve({ reachable: false, url, reason: error.message }));
    request.end();
  });
}
function parseArgs(args = []) {
  const positional = [], flags = {};
  const booleans = new Set(['--json', '--confirm', '--check-resource', '--help', '-h']);
  const valued = new Set(['--page', '--size', '--search', '--name', '--description', '--logo', '--version', '--config', '--expected-hash', '--backup', '--extensions', '--source']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (booleans.has(arg)) { if (flags[arg]) { fail('USAGE', arg); } flags[arg] = true; }
    else if (valued.has(arg)) {
      if (Object.hasOwn(flags, arg) || !args[i + 1] || args[i + 1].startsWith('--')) { fail('USAGE', arg); }
      flags[arg] = args[++i];
    } else if (arg.startsWith('-')) { fail('USAGE', arg); }
    else { positional.push(arg); }
  }
  if (flags['--help'] || flags['-h']) { return { help: true }; }
  const [action, pluginId, positionalVersion] = positional;
  const allowed = {
    'dev-list': ['--page', '--size', '--search'], get: [], 'version-list': ['--page', '--size'], 'version-get': [], extensions: [],
    'installed-list': ['--page', '--size', '--search', '--source'], 'installed-get': [], 'runtime-list': ['--extensions'], probe: ['--check-resource'],
    create: ['--name', '--description', '--logo', '--confirm'], 'create-version': ['--version', '--description', '--confirm'],
    'save-dev': ['--config', '--expected-hash', '--backup', '--confirm'], configure: ['--config', '--expected-hash', '--backup', '--confirm'],
    enable: ['--confirm'], disable: ['--confirm'], upgrade: ['--confirm'], uninstall: ['--confirm'],
  };
  const positionalCount = { 'dev-list': 1, extensions: 1, 'installed-list': 1, 'runtime-list': 1, create: 1, 'version-get': 3, 'save-dev': 3 };
  const positionalsValid = action === 'probe' ? [2, 3].includes(positional.length) : positional.length === (positionalCount[action] || 2);
  if ((!READ_ACTIONS.has(action) && !WRITE_ACTIONS.has(action)) || !positionalsValid
    || Object.keys(flags).some(flag => flag !== '--json' && !(allowed[action] || []).includes(flag))) {
    fail('USAGE', t('plugin_lifecycle.usage'));
  }
  if (WRITE_ACTIONS.has(action) && !flags['--confirm']) { fail('CONFIRM_REQUIRED', action); }
  const idRequired = !['dev-list', 'extensions', 'installed-list', 'runtime-list', 'create'].includes(action);
  if (idRequired && !PLUGIN_ID.test(pluginId || '')) { fail('USAGE', 'pluginId'); }
  if (action === 'create' && (!flags['--name'] || !flags['--description'] || !flags['--logo'])) { fail('USAGE', action); }
  if (action === 'create-version' && (!VERSION.test(flags['--version'] || '') || !flags['--description'])) { fail('USAGE', action); }
  if (action === 'version-get' && !VERSION.test(positionalVersion || flags['--version'] || '')) { fail('USAGE', action); }
  if (action === 'save-dev' && (!VERSION.test(positionalVersion || '') || !flags['--config'] || !/^[a-f0-9]{64}$/.test(flags['--expected-hash'] || '') || !flags['--backup'])) { fail('USAGE', action); }
  if (action === 'configure' && (!flags['--config'] || !/^[a-f0-9]{64}$/.test(flags['--expected-hash'] || '') || !flags['--backup'])) { fail('USAGE', action); }
  if (action === 'runtime-list' && !flags['--extensions']) { fail('USAGE', action); }
  for (const flag of ['--page', '--size']) {
    if (flags[flag] && (!/^\d+$/.test(flags[flag]) || +flags[flag] < 1 || +flags[flag] > (flag === '--size' ? 100 : 1000))) { fail('USAGE', flag); }
  }
  return { action, pluginId, version: positionalVersion || flags['--version'], flags };
}

async function execute(parsed, client = createYidaClient({ authRef: createAuthRef() }), options = {}) {
  const { action, pluginId, version, flags } = parsed;
  const get = async (endpoint, params = {}) => unwrap(await client.get(PREFIX + ENDPOINTS[endpoint] + '.json', params), ENDPOINTS[endpoint]);
  const post = async (endpoint, params = {}) => unwrap(await client.postFormOnce(PREFIX + ENDPOINTS[endpoint] + '.json', params), ENDPOINTS[endpoint]);
  const page = { pageNo: +(flags['--page'] || 1), pageSize: +(flags['--size'] || 50) };
  const list = async (endpoint, params) => {
    const content = await get(endpoint, { ...page, ...params });
    const items = listOf(content);
    return { items: sanitize(items), totalCount: totalOf(content, items), pageNo: page.pageNo, pageSize: page.pageSize };
  };
  const readBasic = async id => get('basic', { pluginId: id });
  const readVersion = async (id, targetVersion) => get('version', { pluginId: id, version: targetVersion });
  const installed = async () => list('installedList', { source: flags['--source'] || '', keyWords: flags['--search'] || '' });

  if (action === 'dev-list') { return { success: true, action, ...(await list('devList', { keyWords: flags['--search'] || '' })) }; }
  if (action === 'get') { const plugin = await readBasic(pluginId); return { success: true, action, plugin: sanitize(plugin), snapshotHash: snapshotHash(plugin) }; }
  if (action === 'version-list') { return { success: true, action, pluginId, ...(await list('versions', { pluginId })) }; }
  if (action === 'version-get') { const item = await readVersion(pluginId, version); return { success: true, action, pluginId, version, item: sanitize(item), snapshotHash: snapshotHash(item) }; }
  if (action === 'extensions') { const items = listOf(await get('extensions')); return { success: true, action, items: sanitize(items), totalCount: items.length }; }
  if (action === 'installed-list') { return { success: true, action, ...(await installed()) }; }
  if (action === 'installed-get') {
    const entry = (await installed()).items.find(item => item.pluginId === pluginId);
    if (!entry) { fail('NOT_INSTALLED', pluginId); }
    const rawConfig = await get('installedConfig', { pluginId });
    return { success: true, action, plugin: entry, config: sanitize(rawConfig), configHash: snapshotHash(installedConfigValue(rawConfig)) };
  }
  if (action === 'runtime-list') {
    const extensionIds = [...new Set(flags['--extensions'].split(',').map(value => value.trim()).filter(Boolean))];
    if (!extensionIds.length) { fail('USAGE', '--extensions'); }
    const content = await get('runtime', { extensionIds: JSON.stringify(extensionIds) });
    const items = listOf(content).map(item => sanitize(item));
    return { success: true, action, extensionIds, items, totalCount: items.length, evidence: { registryCandidatesReturned: true, enabledRegistrationCount: items.filter(item => item.isEnabled === 'y').length, consumerExecutionVerified: false } };
  }
  if (action === 'probe') {
    const item = version ? await readVersion(pluginId, version) : await readBasic(pluginId);
    const frontend = parseJson(item.frontEndDevInfo || {}, 'frontEndDevInfo') || {};
    const extensionIds = extensionIdsFrom(item);
    const cdnUrl = resolveCdnUrl(frontend.cdnUrl || frontend.cdnEntry || null);
    const resource = flags['--check-resource'] && cdnUrl ? await (options.probeResource || probeResource)(cdnUrl) : null;
    return { success: true, action, pluginId, version: version || item.version || null, plan: { cdnUrl, extensionIds }, resource, evidence: { persistedConfig: true, resourceReachabilityChecked: !!resource, resourceReachable: resource?.reachable ?? null, runtimeRegistrationChecked: false, consumerExecutionVerified: false }, nextAction: cdnUrl ? 'Query runtime-list for the required extension points, then load the entry with an isolated createPluginRuntimeRegistry instance in the actual host and verify the extension consumer.' : 'Save a front-end entry before runtime loading.' };
  }
  if (action === 'create') {
    const created = await post('create', { pluginName: i18nText(flags['--name']), description: i18nText(flags['--description']), logo: flags['--logo'], pluginType: 'ConnectorPlugin', type: 'ConnectorPlugin' });
    const createdId = typeof created === 'string' ? created : created?.pluginId;
    if (!PLUGIN_ID.test(createdId || '')) { fail('INVALID_RESPONSE', ENDPOINTS.create, { resourceMayHaveBeenCreated: true, response: sanitize(created) }); }
    let plugin;
    try { plugin = await readBasic(createdId); } catch (error) { error.details = { ...(error.details || {}), pluginId: createdId, resourceCreated: true }; throw error; }
    return { success: true, action, pluginId: createdId, plugin: sanitize(plugin), readbackVerified: plugin.pluginId === createdId, published: false };
  }
  if (action === 'create-version') {
    await post('createVersion', { pluginId, version: flags['--version'], description: flags['--description'] });
    const item = await readVersion(pluginId, flags['--version']);
    return { success: true, action, pluginId, version: flags['--version'], item: sanitize(item), readbackVerified: String(item.version) === flags['--version'], published: false };
  }
  if (action === 'save-dev') {
    const before = await readVersion(pluginId, version);
    const beforeHash = snapshotHash(before);
    if (beforeHash !== flags['--expected-hash']) { fail('CONFLICT', pluginId, { expectedHash: flags['--expected-hash'], actualHash: beforeHash }); }
    const backupPath = writeBackup(flags['--backup'], { pluginId, version, snapshotHash: beforeHash, item: before });
    const config = readConfig(flags['--config']);
    const catalog = listOf(await get('extensions'));
    const { ids } = validateDevConfig(config, new Set(catalog.map(item => item.extensionId || item.id)));
    await post('saveDev', { pluginId, version, frontEndDevInfo: JSON.stringify(config.frontEndDevInfo || {}), backEndDevInfo: JSON.stringify(config.backEndDevInfo || {}), extensionInfo: JSON.stringify(ids.map(extensionId => ({ extensionId }))), paramConfig: JSON.stringify(config.paramConfig || {}) });
    const after = await readVersion(pluginId, version);
    const afterIds = extensionIdsFrom(after);
    if (ids.some(id => !afterIds.includes(id))) { fail('READBACK_MISMATCH', pluginId, { pluginId, version, backupPath }); }
    return { success: true, action, pluginId, version, item: sanitize(after), snapshotHash: snapshotHash(after), backupPath, readbackVerified: true, published: false };
  }
  if (action === 'configure') {
    const config = readConfig(flags['--config']);
    const before = await get('installedConfig', { pluginId });
    const actualHash = snapshotHash(installedConfigValue(before));
    if (actualHash !== flags['--expected-hash']) { fail('CONFLICT', pluginId, { expectedHash: flags['--expected-hash'], actualHash }); }
    const backupPath = writeBackup(flags['--backup'], { pluginId, configHash: actualHash, config: before });
    await post('configure', { pluginId, config: JSON.stringify(config) });
    const after = await get('installedConfig', { pluginId });
    const readbackHash = snapshotHash(installedConfigValue(after));
    if (readbackHash !== snapshotHash(config)) { fail('READBACK_MISMATCH', pluginId, { pluginId, backupPath, readbackHash }); }
    return { success: true, action, pluginId, readback: sanitize(after), configHash: readbackHash, backupPath, readbackVerified: true };
  }
  if (['enable', 'disable'].includes(action)) {
    await post('state', { pluginId, isEnabled: action === 'enable' ? 'y' : 'n' });
  } else if (action === 'upgrade') { await post('upgrade', { pluginId }); }
  else if (action === 'uninstall') { await post('uninstall', { pluginId }); }
  const after = await installed();
  const entry = after.items.find(item => item.pluginId === pluginId);
  if (action === 'uninstall' && entry) { fail('READBACK_MISMATCH', pluginId); }
  if (action !== 'uninstall' && !entry) { fail('READBACK_MISMATCH', pluginId); }
  if (action === 'enable' && entry.isEnabled !== 'y') { fail('READBACK_MISMATCH', pluginId); }
  if (action === 'disable' && entry.isEnabled !== 'n') { fail('READBACK_MISMATCH', pluginId); }
  return { success: true, action, pluginId, plugin: entry || null, readbackVerified: true, runtimeNote: action === 'disable' ? 'Disabled plugins cannot be selected in new scenes; platform guidance says existing uses may remain effective, so consumer runtime was not claimed as unloaded.' : undefined };
}

async function run(args = []) {
  const parsed = parseArgs(args);
  if (parsed.help) { console.log(t('plugin_lifecycle.usage')); return; }
  console.log(JSON.stringify(await execute(parsed), null, 2));
}

module.exports = { ENDPOINTS, PREFIX, execute, extensionIdsFrom, installedConfigValue, parseArgs, probeResource, resolveCdnUrl, run, sanitize, snapshotHash, validateDevConfig };
