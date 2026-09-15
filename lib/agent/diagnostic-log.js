'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { redactString } = require('../core/redact');

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
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
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

module.exports = { createDiagnosticLog, defaultDiagnosticDir, isProductLog };
