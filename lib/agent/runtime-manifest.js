'use strict';

const crypto = require('crypto');
const { TextDecoder } = require('util');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_BINARY_BYTES = 256 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const PRODUCTION_RUNTIME_PLATFORMS = Object.freeze(['darwin', 'win32']);
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function invalid(code = 'AGENT_RUNTIME_INVALID_MANIFEST', key = 'manifest_invalid') {
  return new CliError(t(`agent.${key}`), { code });
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

// JSON.parse alone silently accepts duplicate keys. Keep signed metadata
// unambiguous across Go and Node JSON implementations, including escaped keys.
function parseStrictJson(bytes, maxBytes = MAX_MANIFEST_BYTES) {
  if (!Buffer.isBuffer(bytes) || bytes.length > maxBytes || !bytes.length) {throw invalid();}
  try {
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const result = JSON.parse(source);
    const tokens = source.match(/"(?:[^"\\]|\\.)*"|[{}[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g);
    let index = 0;
    const visit = (depth) => {
      if (depth > 32) {throw invalid();}
      const token = tokens[index++];
      if (token === '{') {
        const keys = new Set();
        while (tokens[index] !== '}') {
          const key = JSON.parse(tokens[index++]);
          if (keys.has(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {throw invalid();}
          keys.add(key);
          index++; // colon; JSON.parse has already checked the grammar
          visit(depth + 1);
          if (tokens[index] !== ',') {break;}
          index++;
        }
        index++;
      } else if (token === '[') {
        while (tokens[index] !== ']') {
          visit(depth + 1);
          if (tokens[index] !== ',') {break;}
          index++;
        }
        index++;
      }
    };
    visit(0);
    return result;
  } catch {throw invalid();}
}

function positive(value) {return Number.isSafeInteger(value) && value >= 1;}
function range(value) {return exactKeys(value, ['min', 'max']) && positive(value.min) && positive(value.max) && value.min <= value.max;}

function decodeManifestV2(bytes) {
  const m = parseStrictJson(bytes);
  if (!exactKeys(m, ['schemaVersion', 'product', 'runtimeVersion', 'sourceRevision', 'platform', 'arch', 'launcherProtocol', 'wireProtocol', 'stateSchema', 'binary', 'releaseId', 'keyId']) ||
      m.schemaVersion !== 2 || m.product !== 'openyida-local-agent-runtime' ||
      typeof m.runtimeVersion !== 'string' || m.runtimeVersion.length > 100 || !VERSION.test(m.runtimeVersion) ||
      typeof m.sourceRevision !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(m.sourceRevision) ||
      !PRODUCTION_RUNTIME_PLATFORMS.includes(m.platform) || !['arm64', 'x64'].includes(m.arch) ||
      !range(m.launcherProtocol) || !range(m.wireProtocol) ||
      !exactKeys(m.stateSchema, ['write', 'readMin', 'readMax']) ||
      !positive(m.stateSchema.write) || !positive(m.stateSchema.readMin) || !positive(m.stateSchema.readMax) ||
      m.stateSchema.readMin > m.stateSchema.write || m.stateSchema.write > m.stateSchema.readMax ||
      !exactKeys(m.binary, ['file', 'size', 'sha256']) ||
      m.binary.file !== `bin/openyida-agent-runtime${m.platform === 'win32' ? '.exe' : ''}` ||
      !positive(m.binary.size) || m.binary.size > MAX_BINARY_BYTES || !SHA256.test(m.binary.sha256) ||
      typeof m.releaseId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(m.releaseId) ||
      typeof m.keyId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(m.keyId)) {throw invalid();}
  return m;
}

function verifyManifestSignature(bytes, signatureBytes, manifest, trustedKeys) {
  const key = trustedKeys && Object.hasOwn(trustedKeys, manifest.keyId) && trustedKeys[manifest.keyId];
  if (!key || key.revoked || typeof key.publicKey !== 'string') {throw invalid('AGENT_RUNTIME_SIGNATURE_FAILED', 'signature_failed');}
  try {
    const encoded = signatureBytes.toString('ascii');
    if (!/^[A-Za-z0-9+/]{86}==\n?$/.test(encoded)) {throw invalid();}
    const signature = Buffer.from(encoded.trim(), 'base64');
    const publicKey = crypto.createPublicKey(key.publicKey);
    if (signature.toString('base64') !== encoded.trim() || publicKey.asymmetricKeyType !== 'ed25519' ||
        !crypto.verify(null, bytes, publicKey, signature)) {throw invalid();}
  } catch {throw invalid('AGENT_RUNTIME_SIGNATURE_FAILED', 'signature_failed');}
}

module.exports = { MAX_MANIFEST_BYTES, MAX_BINARY_BYTES, SHA256, PRODUCTION_RUNTIME_PLATFORMS, decodeManifestV2, verifyManifestSignature, parseStrictJson, exactKeys };
