'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execute, parseArgs, sanitize, snapshotHash } = require('../lib/plugin/plugin-lifecycle');

let directory;
let client;
let version;
let installed;
let installedConfig;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-plugin-'));
  version = {
    pluginId: 'PLUGIN-TEST', version: '1.0.0',
    frontEndDevInfo: JSON.stringify({ cdnEntry: '/example/remoteEntry.js', extensions: [{ extensionId: 'yida.app.custom-page.component' }] }),
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
        version = { ...version, frontEndDevInfo: params.frontEndDevInfo, backEndDevInfo: params.backEndDevInfo, paramConfig: params.paramConfig };
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

test('runtime list redacts config and does not claim consumer execution', async () => {
  const result = await execute(parseArgs(['runtime-list', '--extensions', 'yida.app.custom-page.component']), client);
  expect(result.items[0].config).toBeUndefined();
  expect(result.items[0].hasConfig).toBe(true);
  expect(result.evidence).toEqual({ registryCandidatesReturned: true, enabledRegistrationCount: 1, consumerExecutionVerified: false });
});

test('probe resolves the platform CDN path and keeps resource and consumer evidence separate', async () => {
  const result = await execute(parseArgs(['probe', 'PLUGIN-TEST', '1.0.0', '--check-resource']), client, {
    probeResource: jest.fn(async url => ({ reachable: true, url, statusCode: 200 })),
  });
  expect(result.plan.cdnUrl).toBe('https://g.alicdn.com/example/remoteEntry.js');
  expect(result.evidence).toEqual({ persistedConfig: true, resourceReachabilityChecked: true, resourceReachable: true, runtimeRegistrationChecked: false, consumerExecutionVerified: false });
});

test('save-dev checks the original hash, writes a backup, validates extensions and never publishes', async () => {
  const configPath = path.join(directory, 'dev.json');
  const backupPath = path.join(directory, 'before.json');
  fs.writeFileSync(configPath, JSON.stringify({ frontEndDevInfo: { cdnEntry: '/next/remoteEntry.js', extensions: [{ extensionId: 'yida.app.custom-page.component' }] }, backEndDevInfo: {}, paramConfig: {} }));
  const args = parseArgs(['save-dev', 'PLUGIN-TEST', '1.0.0', '--config', configPath, '--expected-hash', snapshotHash(version), '--backup', backupPath, '--confirm']);
  const result = await execute(args, client);
  expect(result.readbackVerified).toBe(true);
  expect(result.published).toBe(false);
  expect(fs.existsSync(backupPath)).toBe(true);
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(client.postFormOnce.mock.calls[0][0]).toContain('savePluginDevInfo');
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
