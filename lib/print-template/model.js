'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { resolveProjectRoot } = require('../core/utils');

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Fail with a stable code; platform failures retain their native diagnostic. */
function fail(code, detail, details) {
  throw new CliError(t('print_template.error', detail), { code: `PRINT_TEMPLATE_${code}`, details });
}

/** Parse JSON strings used by the native print editor without evaluating them. */
function json(value, label) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; }
  catch (_) { return fail('INVALID_CONFIG', label); }
}

/** Reject prototype keys recursively, including imported native configurations. */
function safe(value) {
  if (!value || typeof value !== 'object') { return; }
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) { fail('INVALID_CONFIG', key); }
    safe(value[key]);
  }
}

/** Normalize translated labels without discarding the original locale object. */
function label(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch (_) { return value; }
  }
  return object(parsed) ? parsed.zh_CN || parsed.en_US || parsed.key || '' : String(parsed ?? '');
}

/** Canonical object key ordering for stale-edit fingerprints. */
function stable(value) {
  if (Array.isArray(value)) { return value.map(stable); }
  return object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
}

/** Compare authored values while allowing the server to add nullable dictionary metadata. */
function matches(expected, actual) {
  if (Array.isArray(expected)) { return Array.isArray(actual) && actual.length === expected.length && expected.every((value, i) => matches(value, actual[i])); }
  if (object(expected)) { return object(actual) && Object.entries(expected).every(([key, value]) => matches(value, actual[key])); }
  return expected === actual;
}

/** Normalize only the native content fields; missing content means an unsaved template. */
function content(raw) {
  if (!object(raw)) { fail('INVALID_RESPONSE', 'template content'); }
  if (!Object.keys(raw).length) { return { termContents: '', termJsonAttr: [], dictionaryList: [], gmtModified: null }; }
  const result = { ...raw, termJsonAttr: json(raw.termJsonAttr ?? [], 'termJsonAttr'),
    dictionaryList: json(raw.dictionaryList ?? [], 'dictionaryList') };
  if (typeof result.termContents !== 'string' || !Array.isArray(result.termJsonAttr) || !Array.isArray(result.dictionaryList)) {
    fail('INVALID_RESPONSE', 'termContents / termJsonAttr / dictionaryList');
  }
  safe(result);
  return result;
}

/** Hash metadata and body together, including the server concurrency timestamp. */
function hash(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(stable({ template: snapshot.template, content: snapshot.content }))).digest('hex');
}

/** Write exports/backups exclusively and keep business configuration private on disk. */
function write(value, filename, kind = 'backup') {
  const output = filename ? path.resolve(filename) : path.join(resolveProjectRoot().projectRoot,
    '.cache', 'openyida', 'print-template', `${kind}-${Date.now()}-${crypto.randomUUID()}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return output;
}

/** Load explicit user-authored input; never consume arbitrary files as instructions. */
function read(filename) {
  const result = json(fs.readFileSync(path.resolve(filename), 'utf8'), filename);
  safe(result);
  return result;
}

/** Strictly recognize native success envelopes, including auth sentinels and false payloads. */
function unwrap(response, endpoint) {
  if (!response || response.success !== true || response.__needLogin || response.__csrfExpired || response.content === false) {
    fail('API_ERROR', response?.errorMsg || response?.message || endpoint,
      { endpoint, platformErrorCode: response?.errorCode, needLogin: !!response?.__needLogin });
  }
  return response.content;
}

module.exports = { object, fail, json, safe, label, stable, matches, content, hash, write, read, unwrap };
