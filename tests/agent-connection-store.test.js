'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { installation, prepareConnection, listConnections } = require('../lib/agent/connection-store');
const { removeFixture } = require('./helpers/agent-bundle-fixture');

describe('local Agent multi-organization connection store', () => {
  let root;

  beforeEach(() => {root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-connections-'));});
  afterEach(() => removeFixture(root));

  test('read-only discovery does not initialize an unused state root', () => {
    const missing = path.join(root, 'not-created');
    expect(listConnections(missing)).toEqual([]);
    expect(fs.existsSync(missing)).toBe(false);
  });

  test('one installation is shared by independently enrolled organization connections', () => {
    const first = prepareConnection(root, `enroll-A.${'a'.repeat(40)}`);
    const second = prepareConnection(root, `enroll-B.${'b'.repeat(40)}`);
    expect(first.installationId).toBe(second.installationId);
    expect(first.stateDir).not.toBe(second.stateDir);
    expect(JSON.parse(fs.readFileSync(path.join(first.stateDir, 'device.json')))).toEqual({ installationId: first.installationId });

    fs.writeFileSync(path.join(first.stateDir, 'device.json'), JSON.stringify({
      installationId: first.installationId, endpoint: 'https://agent.example.test', endpointId: 'prod', deviceId: 'connection-A', expiresAt: 1,
    }), { mode: 0o600 });
    fs.writeFileSync(path.join(second.stateDir, 'device.json'), JSON.stringify({
      installationId: second.installationId, endpoint: 'https://agent.example.test', endpointId: 'prod', deviceId: 'connection-B', expiresAt: 1,
    }), { mode: 0o600 });

    expect(listConnections(root).map(({ connectionId }) => connectionId)).toEqual(['connection-A', 'connection-B']);
  });

  test('rejects symlinked connection roots and cross-installation state', () => {
    const prepared = prepareConnection(root, `enroll-A.${'a'.repeat(40)}`);
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-other-install-'));
    try {
      fs.writeFileSync(path.join(prepared.stateDir, 'device.json'), JSON.stringify({
        installationId: installation(other), endpoint: 'https://agent.example.test', endpointId: 'prod', deviceId: 'connection-A',
      }), { mode: 0o600 });
      expect(() => listConnections(root)).toThrow(expect.objectContaining({ code: 'AGENT_CONNECTION_STATE_INVALID' }));
    } finally {removeFixture(other);}
  });

  test('a re-enrolled organization connection keeps only its newest credential generation', () => {
    const first = prepareConnection(root, `enroll-A.${'a'.repeat(40)}`);
    const second = prepareConnection(root, `enroll-B.${'b'.repeat(40)}`);
    for (const [prepared, credentialVersion] of [[first, 1], [second, 2]]) {
      fs.writeFileSync(path.join(prepared.stateDir, 'device.json'), JSON.stringify({
        installationId: prepared.installationId, endpoint: 'https://agent.example.test', endpointId: 'prod',
        deviceId: 'same-server-connection', credentialVersion,
      }), { mode: 0o600 });
    }
    expect(listConnections(root)).toEqual([expect.objectContaining({
      connectionId: 'same-server-connection', stateDir: second.stateDir,
    })]);
  });

  test('restores loopback HTTP connections but rejects non-loopback plaintext endpoints', () => {
    const local = prepareConnection(root, `enroll-A.${'a'.repeat(40)}`);
    fs.writeFileSync(path.join(local.stateDir, 'device.json'), JSON.stringify({
      installationId: local.installationId, endpoint: 'http://127.0.0.1:8000',
      endpointId: 'local', deviceId: 'connection-local',
    }), { mode: 0o600 });
    expect(listConnections(root)).toEqual([expect.objectContaining({
      endpoint: 'http://127.0.0.1:8000', connectionId: 'connection-local',
    })]);

    fs.writeFileSync(path.join(local.stateDir, 'device.json'), JSON.stringify({
      installationId: local.installationId, endpoint: 'http://agent.example.test',
      endpointId: 'local', deviceId: 'connection-local',
    }), { mode: 0o600 });
    expect(() => listConnections(root)).toThrow(expect.objectContaining({
      code: 'AGENT_CONNECTION_STATE_INVALID',
    }));
  });
});
