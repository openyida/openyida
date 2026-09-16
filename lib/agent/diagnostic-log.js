'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { redactString } = require('../core/redact');
const { mkdirPrivate } = require('./private-directory');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FILES = 256;
const FIELDS = new Set([
  'command', 'component', 'errorCode', 'statusCode', 'closeCode', 'endpointId',
  'provider', 'runtimeId', 'sessionId', 'runId', 'attemptId', 'phase', 'status',
  'runtimeVersion', 'providerVersion',
]);

function isProductLog(name) {
  return /^openyida-local-agent-[a-z0-9_-]+-\d{8}T\d{6}Z-\d+(?:\.\d+)?\.jsonl$/.test(name);
}

function cleanup(dir, current) {
  const now = Date.now();
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !isProductLog(entry.name)) {continue;}
    const target = path.join(dir, entry.name);
    const stat = fs.statSync(target);
    if (now - stat.mtimeMs > MAX_AGE_MS) {
      try {fs.unlinkSync(target);} catch { /* best-effort diagnostic cleanup */ }
      continue;
    }
    files.push({ target, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  let total = files.reduce((sum, file) => sum + file.size, 0);
  let remaining = files.length;
  for (const file of files) {
    if (remaining <= MAX_FILES && total <= MAX_TOTAL_BYTES) {break;}
    if (file.target === current) {continue;}
    try {fs.unlinkSync(file.target); total -= file.size; remaining--;} catch { /* retry next launch */ }
  }
}

function createDiagnosticLog(dir) {
  try {
    mkdirPrivate(dir);
    if (!fs.lstatSync(dir).isDirectory()) {return () => {};}
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const file = path.join(dir, `openyida-local-agent-launcher-${stamp}-${process.pid}.jsonl`);
    fs.closeSync(fs.openSync(file, 'a', 0o600));
    cleanup(dir, file);
    return (level, event, values = {}) => {
      try {
        if (!/^[a-z0-9_]{1,100}$/.test(event)) {return;}
        const record = { schema: 'openyida.local_agent.diagnostic.v1', timestamp: new Date().toISOString(), level, event, os: process.platform, arch: process.arch };
        for (const [key, value] of Object.entries(values)) {
          if (!FIELDS.has(key)) {continue;}
          if (typeof value === 'string') {record[key] = redactString(value.slice(0, 512));}
          else if (typeof value === 'boolean' || typeof value === 'number') {record[key] = value;}
        }
        const line = `${JSON.stringify(record)}\n`;
        const currentSize = fs.existsSync(file) ? fs.statSync(file).size : 0;
        if (Buffer.byteLength(line) <= 8192 && currentSize + Buffer.byteLength(line) <= MAX_FILE_BYTES) {
          fs.appendFileSync(file, line, { encoding: 'utf8', mode: 0o600 });
        }
      } catch { /* diagnostics must never affect the product path */ }
    };
  } catch {
    return () => {};
  }
}

function defaultDiagnosticDir(homedir = os.homedir()) {
  return path.join(homedir, '.openyida', 'local-agent', 'logs');
}

// Read only product diagnostic JSONL, not device state, journals or credentials.
// Failed enrollment has no completed Connection, so read the installation log
// directory rather than depending on listConnections finding a paired device.
function readRecentCredentialFailures(dir, now = Date.now()) {
  const reasons = new Set(['protocol_invalid', 'device_invalid', 'access_format_invalid',
    'refresh_format_invalid', 'version_invalid', 'access_expired', 'refresh_expired', 'rotation_binding_invalid']);
  const results = [];
  try {
    const directory = fs.lstatSync(dir);
    if (!directory.isDirectory() || directory.isSymbolicLink()) {return results;}
    const files = fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.startsWith('openyida-local-agent-runtime-') && isProductLog(entry.name))
      .flatMap(entry => {
        try {return [{ file: path.join(dir, entry.name), stat: fs.lstatSync(path.join(dir, entry.name)) }];}
        catch {return [];}
      })
      .filter(item => item.stat.isFile() && !item.stat.isSymbolicLink() &&
        item.stat.size <= MAX_FILE_BYTES && item.stat.mtimeMs >= now - 2 * 60 * 60 * 1000)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs).slice(0, 8);
    for (const { file, stat: snapshot } of files) {
      let raw;
      let fd;
      try {
        fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES || stat.ino !== snapshot.ino || stat.dev !== snapshot.dev) {continue;}
        const data = Buffer.alloc(stat.size);
        const bytes = fs.readSync(fd, data, 0, data.length, 0);
        raw = data.subarray(0, bytes).toString('utf8');
      } catch {continue;} finally {if (fd !== undefined) {fs.closeSync(fd);}}
      for (const line of raw.split('\n')) {
        if (!line || Buffer.byteLength(line) > 8192) {continue;}
        let record;
        try {record = JSON.parse(line);} catch {continue;}
        if (!record || record.schema !== 'openyida.local_agent.diagnostic.v1' ||
          !['runtime_failed', 'connection_error'].includes(record.event) || record.errorCode !== 'DEVICE_CREDENTIAL_RESPONSE_INVALID') {continue;}
        const timestamp = Date.parse(record.timestamp);
        if (!Number.isFinite(timestamp) || timestamp < now - 2 * 60 * 60 * 1000 || timestamp > now + 5 * 60 * 1000) {continue;}
        const safe = { timestamp: new Date(timestamp).toISOString(), errorCode: 'DEVICE_CREDENTIAL_RESPONSE_INVALID', historical: true };
        if (reasons.has(record.credentialReason)) {safe.credentialReason = record.credentialReason;}
        if (['connect', 'run', 'reauthenticate'].includes(record.phase)) {safe.phase = record.phase;}
        if (typeof record.endpointId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(record.endpointId)) {safe.endpointId = redactString(record.endpointId);}
        for (const key of ['accessRemainingSeconds', 'refreshRemainingSeconds']) {
          if (Number.isSafeInteger(record[key])) {safe[key] = record[key];}
        }
        results.push(safe);
        results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        if (results.length > 5) {results.length = 5;}
      }
    }
  } catch { /* Log diagnostics are optional, including while files rotate. */ }
  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
}

module.exports = { createDiagnosticLog, defaultDiagnosticDir, isProductLog, readRecentCredentialFailures };
