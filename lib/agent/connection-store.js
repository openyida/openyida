'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const ID = /^[A-Za-z0-9_-]{1,128}$/;

function failure(code = 'AGENT_CONNECTION_STATE_INVALID') {
  return new CliError(t('agent.identity_invalid'), { code });
}

function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {throw failure();}
  if (process.platform !== 'win32') {
    fs.chmodSync(directory, 0o700);
    if ((fs.statSync(directory).mode & 0o077) !== 0) {throw failure();}
  }
  return directory;
}

function readJson(file, allowedKeys) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024) {throw failure();}
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {throw failure();}
  let value;
  try {value = JSON.parse(fs.readFileSync(file, 'utf8'));} catch {throw failure();}
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some(key => !allowedKeys.includes(key))) {throw failure();}
  return value;
}

function atomicJson(file, value) {
  const directory = privateDirectory(path.dirname(file));
  const temporary = path.join(directory, `.pending-${process.pid}-${crypto.randomBytes(12).toString('hex')}`);
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: 'wx' });
  fs.renameSync(temporary, file);
  if (process.platform !== 'win32') {fs.chmodSync(file, 0o600);}
}

function storedEndpoint(value) {
  let endpoint;
  try {endpoint = new URL(value);} catch {throw failure();}
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if ((endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && loopback)) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {throw failure();}
  return endpoint.toString().replace(/\/+$/, '');
}

function installation(root) {
  privateDirectory(root);
  const file = path.join(root, 'installation.json');
  if (fs.existsSync(file)) {
    const value = readJson(file, ['schemaVersion', 'installationId']);
    if (value.schemaVersion !== 1 || !ID.test(value.installationId || '')) {throw failure();}
    return value.installationId;
  }
  const installationId = crypto.randomUUID();
  try {
    fs.writeFileSync(file, `${JSON.stringify({ schemaVersion: 1, installationId })}\n`, { mode: 0o600, flag: 'wx' });
    return installationId;
  } catch (error) {
    if (error && error.code === 'EEXIST') {return installation(root);}
    throw error;
  }
}

function enrollmentSlot(token) {
  const enrollmentId = typeof token === 'string' ? token.split('.', 1)[0] : '';
  return ID.test(enrollmentId) ? enrollmentId : crypto.randomUUID();
}

function prepareConnection(root, enrollmentToken) {
  const installationId = installation(root);
  const connections = privateDirectory(path.join(root, 'connections'));
  const stateDir = privateDirectory(path.join(connections, enrollmentSlot(enrollmentToken)));
  const publicState = path.join(stateDir, 'device.json');
  if (fs.existsSync(publicState)) {
    const existing = readJson(publicState, [
      'installationId', 'endpoint', 'endpointId', 'deviceId', 'devicePublicKey',
      'expiresAt', 'refreshExpiresAt', 'credentialVersion', 'refreshActionId',
    ]);
    if (existing.installationId !== installationId) {throw failure();}
  } else {
    atomicJson(publicState, { installationId });
  }
  return { installationId, stateDir };
}

function listConnections(root) {
  if (!fs.existsSync(root)) {return [];}
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (process.platform !== 'win32' && (rootStat.mode & 0o077) !== 0)) {throw failure();}
  const installationFile = path.join(root, 'installation.json');
  const connections = path.join(root, 'connections');
  if (!fs.existsSync(installationFile) || !fs.existsSync(connections)) {return [];}
  const installationState = readJson(installationFile, ['schemaVersion', 'installationId']);
  if (installationState.schemaVersion !== 1 || !ID.test(installationState.installationId || '')) {throw failure();}
  const installId = installationState.installationId;
  const connectionsStat = fs.lstatSync(connections);
  if (!connectionsStat.isDirectory() || connectionsStat.isSymbolicLink() || (process.platform !== 'win32' && (connectionsStat.mode & 0o077) !== 0)) {throw failure();}
  const byConnection = new Map();
  for (const name of fs.readdirSync(connections).sort()) {
    if (!ID.test(name)) {continue;}
    const stateDir = path.join(connections, name);
    let stat;
    try {stat = fs.lstatSync(stateDir);} catch {continue;}
    if (!stat.isDirectory() || stat.isSymbolicLink()) {throw failure();}
    const file = path.join(stateDir, 'device.json');
    if (!fs.existsSync(file)) {continue;}
    const value = readJson(file, [
      'installationId', 'endpoint', 'endpointId', 'deviceId', 'devicePublicKey',
      'expiresAt', 'refreshExpiresAt', 'credentialVersion', 'refreshActionId',
    ]);
    if (value.installationId !== installId) {throw failure();}
    if (!value.deviceId) {continue;}
    if (!ID.test(value.deviceId) || !ID.test(value.endpointId || '')) {throw failure();}
    const candidate = {
      installationId: installId,
      stateDir,
      endpoint: storedEndpoint(value.endpoint),
      endpointId: value.endpointId,
      connectionId: value.deviceId,
      credentialVersion: Number.isSafeInteger(value.credentialVersion) ? value.credentialVersion : 0,
      modifiedAt: fs.statSync(file).mtimeMs,
    };
    const previous = byConnection.get(candidate.connectionId);
    if (!previous || candidate.credentialVersion > previous.credentialVersion ||
        (candidate.credentialVersion === previous.credentialVersion && candidate.modifiedAt > previous.modifiedAt)) {
      byConnection.set(candidate.connectionId, candidate);
    }
  }
  return [...byConnection.values()]
    .sort((a, b) => a.connectionId.localeCompare(b.connectionId))
    .map(connection => ({
      installationId: connection.installationId,
      stateDir: connection.stateDir,
      endpoint: connection.endpoint,
      endpointId: connection.endpointId,
      connectionId: connection.connectionId,
    }));
}

module.exports = { installation, prepareConnection, listConnections };
