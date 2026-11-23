'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { version } = require('../../package.json');

const MAX_FILES = { screenshot: 3, log: 1 };
const MAX_JSON_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const MAX_LOG_BYTES = 512 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VERSION = /^v?\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/;
const ENVIRONMENT_VALIDATORS = {
  cliVersion: value => VERSION.test(value),
  nodeVersion: value => VERSION.test(value),
  platform: value => ['aix', 'android', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', 'win32'].includes(value),
  arch: value => ['arm', 'arm64', 'ia32', 'loong64', 'mips', 'mipsel', 'ppc', 'ppc64', 'riscv64', 's390', 's390x', 'x64'].includes(value),
};
const PRIVATE_DIRECTORY = /(?:^|[\\/])(?:\.ssh|\.aws|\.gnupg|\.kube|\.docker|\.openyida[\\/]auth)(?:[\\/]|$)/i;
const PRIVATE_FILENAME = /^(?:\.(?:env(?:\..*)?|npmrc|netrc)|id_(?:rsa|ed25519|ecdsa)|(?:credentials?|secrets?|token(?:-store|-session)?)(?:\..*)?|auth-(?:token|profile)(?:[-.].*)?)$|\.(?:pem|p12|pfx|key)$/i;
const CREDENTIAL = /(?:-----BEGIN [^-]*PRIVATE KEY-----|\b(?:gh[pousr]_|github_pat_)[a-z0-9_]{16,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|https?:\/\/[^\s/@:]+:[^\s/@]+@)/i;
const CREDENTIAL_FIELD = /\b(?:authorization|set-cookie|cookie|[\w-]*(?:token|secret|password|passwd|api[_-]?key))["']?\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\r\n,;}]+))/gi;
const REDACTED = /^(?:\[(?:redacted|masked|removed)\]|<redacted>|\*{3,}|\[\]|null|false)$/i;

function evidenceError(key, code) {
  return new CliError(t('feedback_intake.' + key), { code });
}

function readRegularFile(file, maxBytes) {
  // Reject directories, pipes and symlinks before opening, then verify the
  // opened file again. Limit the bytes read even if the file grows.
  if (!fs.lstatSync(file).isFile()) {
    throw new Error('not a regular file');
  }
  const { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
  const fd = fs.openSync(file, O_RDONLY | (O_NOFOLLOW || 0) | (O_NONBLOCK || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error('not a regular file');
    }
    if (stat.size > maxBytes) {
      return null;
    }
    const buffer = Buffer.alloc(maxBytes + 1);
    let size = 0;
    while (size < buffer.length) {
      const count = fs.readSync(fd, buffer, size, buffer.length - size, null);
      if (count === 0) {
        break;
      }
      size += count;
    }
    return size <= maxBytes ? buffer.subarray(0, size) : null;
  } finally {
    fs.closeSync(fd);
  }
}

function containsCredential(text) {
  return CREDENTIAL.test(text) || /\bBearer\s+[a-z0-9._~+/-]{8,}/i.test(text) ||
    Array.from(text.matchAll(CREDENTIAL_FIELD)).some(match => {
      const value = (match[1] ?? match[2] ?? match[3]).trim();
      return value && !REDACTED.test(value);
    });
}

function environmentSummary() {
  return { cliVersion: version, platform: process.platform, arch: process.arch, nodeVersion: process.versions.node };
}

function validateEnvironment(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length > 0 && Object.entries(value).every(([key, item]) =>
    Object.hasOwn(ENVIRONMENT_VALIDATORS, key) && typeof item === 'string' &&
    item.length <= 64 && item === item.trim() && ENVIRONMENT_VALIDATORS[key](item));
}

function readAttachment(file, kind, index) {
  const label = path.basename(file);
  if (PRIVATE_DIRECTORY.test(path.resolve(file)) || PRIVATE_FILENAME.test(label)) {
    throw evidenceError('attachment_sensitive', 'FEEDBACK_ATTACHMENT_SENSITIVE');
  }
  let bytes;
  try {
    bytes = readRegularFile(file, kind === 'screenshot' ? MAX_SCREENSHOT_BYTES : MAX_LOG_BYTES);
  } catch {
    throw evidenceError('attachment_file', 'FEEDBACK_ATTACHMENT_INVALID');
  }
  if (!bytes) {
    throw evidenceError('attachment_limit', 'FEEDBACK_ATTACHMENT_TOO_LARGE');
  }
  let contentType;
  let extension;
  if (kind === 'screenshot') {
    if (bytes.length > PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      contentType = 'image/png';
      extension = 'png';
    } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      contentType = 'image/jpeg';
      extension = 'jpg';
    } else {
      throw evidenceError('attachment_image', 'FEEDBACK_ATTACHMENT_INVALID');
    }
  } else {
    let text;
    const compressed = path.extname(file).toLowerCase() === '.gz';
    try {
      const decoded = compressed ? gunzipSync(bytes, { maxOutputLength: MAX_LOG_BYTES }) : bytes;
      text = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
    } catch {
      throw evidenceError('attachment_log', 'FEEDBACK_ATTACHMENT_INVALID');
    }
    // eslint-disable-next-line no-control-regex -- reject binary control bytes in selected logs
    if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text)) {
      throw evidenceError('attachment_log', 'FEEDBACK_ATTACHMENT_INVALID');
    }
    if (containsCredential(text)) {
      throw evidenceError('attachment_sensitive', 'FEEDBACK_ATTACHMENT_SENSITIVE');
    }
    extension = compressed ? 'gz' : path.extname(file).toLowerCase().slice(1);
    contentType = ({ gz: 'application/gzip', json: 'application/json', jsonl: 'application/x-ndjson', ndjson: 'application/x-ndjson' })[extension] || 'text/plain';
    if (contentType === 'text/plain') { extension = 'txt'; }
  }
  return { kind, label, bytes, contentType, name: `${kind}-${index + 1}.${extension}` };
}

function selectedAttachments(options) {
  if (Object.entries(MAX_FILES).some(([kind, count]) => options[kind].length > count)) {
    throw evidenceError('attachment_limit', 'FEEDBACK_ATTACHMENT_TOO_LARGE');
  }
  const attachments = [
    ...options.screenshot.map((file, index) => readAttachment(file, 'screenshot', index)),
    ...options.log.map((file, index) => readAttachment(file, 'log', index)),
  ];
  if (attachments.reduce((size, attachment) => size + attachment.bytes.length, 0) > MAX_TOTAL_BYTES) {
    throw evidenceError('attachment_limit', 'FEEDBACK_ATTACHMENT_TOO_LARGE');
  }
  return attachments;
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function prepareRequest(data, attachments, requestId, destination) {
  const feedback = JSON.stringify(data);
  const reviewDigest = sha256(JSON.stringify({
    requestId,
    destination,
    feedback,
    attachments: attachments.map(({ kind, name, label, bytes }) => ({ kind, name, label, sha256: sha256(bytes) })),
  }));
  const manifest = {
    requestId,
    destination: destination.origin,
    feedback: data,
    attachments: attachments.map(({ kind, label, contentType, bytes }) => ({
      kind,
      // eslint-disable-next-line no-control-regex -- file names must not control the terminal
      file: label.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '?'),
      contentType,
      bytes: bytes.length,
    })),
    reviewDigest,
  };
  const payload = attachments.length ? {
    ...data,
    evidence: attachments.map(({ kind, name, contentType, bytes }) => ({
      kind, name, contentType, contentBase64: bytes.toString('base64'),
    })),
  } : data;
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > MAX_JSON_BYTES) {
    throw evidenceError('request_too_large', 'FEEDBACK_INPUT_TOO_LARGE');
  }
  return { manifest, contentType: 'application/json', body };
}

module.exports = { containsCredential, environmentSummary, validateEnvironment, readRegularFile, selectedAttachments, prepareRequest };
