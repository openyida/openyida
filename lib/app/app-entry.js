'use strict';

const { createAuthRef, createYidaClient, unwrapYidaResponse } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { throwUsage } = require('../core/command-errors');
const { fetchFormPageList } = require('./form-navigation');

/** Keep complete runtime URLs; the server verifies tenant and resource ownership. */
function normalizeUrl(value, appType) {
  const input = String(value || '').trim();
  if (!input) { throw new Error(t('app_entry.invalid_url')); }
  // eslint-disable-next-line no-control-regex -- reject control characters in persisted URLs
  if (input.length > 2048 || /[\\\s\x00-\x1f\x7f]/.test(input)) {
    throw new Error(t('app_entry.invalid_url'));
  }
  const match = /^https?:\/\/[^/?#]+(\/[^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i.exec(input);
  if (!match) { throw new Error(t('app_entry.invalid_url')); }
  const url = new URL(input);
  const route = match[1];
  const prefix = `/${appType}/`;
  const parts = route.startsWith(prefix) ? route.slice(prefix.length).split('/') : [];
  const short = /^\/(?:s\/[A-Za-z0-9_-]+|o\/[A-Za-z0-9_-]+(?:\/FORM-[A-Za-z0-9_-]+)?)$/.test(route);
  const runtime = ['custom', 'workbench', 'submission', 'manage'].includes(parts[0]) &&
    ((parts.length === 1 && parts[0] === 'workbench') ||
      (parts.length === 2 && /^[A-Za-z0-9_-]+$/.test(parts[1])));
  if (url.username || url.password || url.pathname !== route || (!short && !runtime)) {
    throw new Error(t('app_entry.invalid_url'));
  }
  if (match[2] !== undefined) {
    const seen = new Set();
    for (const parameter of match[2].split('&')) {
      const pair = /^(corpid|locale|viewUuid|processCode|hideLeftNav|noShowTopBottom)=([A-Za-z0-9_-]+)$/.exec(parameter);
      if (!pair || seen.has(pair[1]) ||
        (['hideLeftNav', 'noShowTopBottom'].includes(pair[1]) && !/^(true|false|y|n|0|1)$/.test(pair[2]))) {
        throw new Error(t('app_entry.invalid_url'));
      }
      seen.add(pair[1]);
    }
  }
  if (match[3] !== undefined && !/^[A-Za-z0-9_/-]+$/.test(match[3])) {
    throw new Error(t('app_entry.invalid_url'));
  }
  return input;
}

/** Resolve a page identifier into the canonical entry URL the platform expects. */
async function resolveEntryUrl(authRef, appType, key, formUuid) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(formUuid || ''))) {
    throw new Error(t('app_entry.invalid_url'));
  }
  const forms = await fetchFormPageList(appType, authRef);
  const form = Array.isArray(forms) ? forms.find((item) => item.formUuid === formUuid) : null;
  if (!form) { throw new Error(t('app_entry.page_not_in_app', formUuid)); }
  if (key === 'frontend') {
    if (String(form.formType).toLowerCase() !== 'display') { throw new Error(t('app_entry.frontend_display_required', formUuid)); }
    if (!form.pathName) { throw new Error(t('app_entry.page_offline', formUuid)); }
    return normalizeUrl(`${authRef.baseUrl}/${appType}/custom/${formUuid}`, appType);
  }
  return normalizeUrl(`${authRef.baseUrl}/${appType}/workbench/${formUuid}`, appType);
}

/** Reject duplicate or ambiguous flags; omissions never clear stored entries. */
function parseArgs(args) {
  const [action, appType, ...flags] = args;
  if (!['get', 'set'].includes(action) || !/^[A-Za-z0-9_-]+$/.test(appType || '')) {
    throwUsage(t('app_entry.usage'));
  }
  const values = {};
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index];
    if (flag === '--json') {
      continue;
    }
    const match = /^--(clear-)?(frontend|management)(-page)?$/.exec(flag);
    if (action !== 'set' || !match || (match[1] && match[3]) ||
      Object.prototype.hasOwnProperty.call(values, match[2])) {
      throwUsage(t('app_entry.usage'));
    }
    const kind = match[1] ? 'clear' : (match[3] ? 'page' : 'url');
    const value = kind === 'clear' ? null : flags[++index];
    if (kind !== 'clear' && (!value || value.startsWith('--'))) {
      throwUsage(t('app_entry.usage'));
    }
    values[match[2]] = { kind, value };
  }
  if (action === 'set' && !Object.keys(values).length) {
    throwUsage(t('app_entry.usage'));
  }
  return { action, appType, values };
}

/** Read the revision used for a conditional partial write. */
async function readEntries(client, appType) {
  const result = unwrapYidaResponse(await client.get(`/${appType}/query/app/getAccessEntries.json`));
  if (!result || typeof result.revision !== 'string' || !result.revision ||
      !result.accessEntries || typeof result.accessEntries !== 'object' || Array.isArray(result.accessEntries)) {
    throw new Error(t('app_entry.invalid_response'));
  }
  return result;
}

/** Persist only supplied entries and verify them through a separate read. */
async function run(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(t('app_entry.usage'));
    return;
  }
  const { action, appType, values } = parseArgs(args);
  const authRef = createAuthRef();
  const client = createYidaClient({ authRef });
  const patch = {};
  for (const [key, spec] of Object.entries(values)) {
    if (spec.kind === 'clear') {
      patch[key] = null;
    } else if (spec.kind === 'page') {
      patch[key] = { url: await resolveEntryUrl(authRef, appType, key, spec.value) };
    } else {
      const url = normalizeUrl(spec.value, appType);
      patch[key] = { url };
    }
  }
  let result = await readEntries(client, appType);
  if (action === 'set') {
    unwrapYidaResponse(await client.postForm(`/${appType}/query/app/saveAccessEntries.json`, {
      accessEntries: JSON.stringify(patch), revision: result.revision,
    }));
    result = await readEntries(client, appType);
    for (const [key, entry] of Object.entries(patch)) {
      if ((result.accessEntries[key]?.url || '') !== (entry?.url || '')) {
        throw new Error(t('app_entry.readback_failed'));
      }
    }
  }
  const urls = {};
  for (const key of ['frontend', 'management']) {
    if (result.accessEntries[key]?.url) {
      urls[key] = normalizeUrl(result.accessEntries[key].url, appType);
    }
  }
  console.log(JSON.stringify({ appType, ...result, urls }, null, 2));
  return result;
}

module.exports = { run, parseArgs, normalizeUrl, resolveEntryUrl };
