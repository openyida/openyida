'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { CliError } = require('../../core/cli-error');
const { t } = require('../../core/i18n');

function invalid(reason) {
  throw new CliError(t('create_form.batch_invalid'), { code: 'FORM_BATCH_INVALID', details: { reason } });
}

function parseArgs(args) {
  const options = { concurrency: 3, check: false };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--concurrency') {
      options.concurrency = Number(args[++i]);
    } else if (args[i] === '--check') {
      options.check = true;
    } else if (args[i] !== '--json' && args[i] !== '--quiet') {
      if (args[i].startsWith('--')) { invalid(args[i]); }
      positional.push(args[i]);
    }
  }
  if (positional.length !== 2 || !Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 4) {
    invalid('create-form batch <appType> <plan.json> [--concurrency 1..4] [--check] [--json]');
  }
  return { ...options, appType: positional[0], file: path.resolve(positional[1]) };
}

// References occupy a complete JSON value; ordinary text is preserved.
function mapReferences(value, resolve) {
  if (Array.isArray(value)) { return value.map(item => mapReferences(item, resolve)); }
  if (!value || typeof value !== 'object') { return value; }
  if ('$form' in value) {
    if (typeof value.$form !== 'string' || Object.keys(value).some(key => !['$form', 'field'].includes(key)) ||
      ('field' in value && (typeof value.field !== 'string' || !value.field.trim()))) { invalid('reference'); }
    return resolve(value.$form, value.field);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapReferences(item, resolve)]));
}

function loadPlan(file) {
  const input = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(input.forms) || !input.forms.length) { invalid('forms'); }
  const forms = input.forms.map(form => {
    if (!form || !/^[a-zA-Z][\w-]*$/.test(form.key || '') || typeof form.title !== 'string' || !form.title.trim() ||
      (form.fields === undefined) === (form.fieldsFile === undefined) ||
      (form.dependsOn !== undefined && (!Array.isArray(form.dependsOn) || form.dependsOn.some(key => typeof key !== 'string')))) { invalid('form'); }
    if (Object.keys(form).some(key => !['key', 'title', 'fields', 'fieldsFile', 'dependsOn', 'formUuid', 'icon', 'locale'].includes(key))) { invalid(form.key); }
    if (form.formUuid !== undefined && (typeof form.formUuid !== 'string' || !form.formUuid.startsWith('FORM'))) { invalid(form.key); }
    for (const key of ['icon', 'locale']) { if (form[key] !== undefined && typeof form[key] !== 'string') { invalid(key); } }
    const fields = form.fieldsFile === undefined ? form.fields : JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), form.fieldsFile), 'utf8'));
    const dependencies = new Set(form.dependsOn || []);
    mapReferences(fields, key => { dependencies.add(key); return 'FORM-PRECHECK'; });
    return { ...form, fields, dependsOn: [...dependencies] };
  });
  const remaining = new Set(forms.map(form => form.key));
  if (remaining.size !== forms.length) { invalid('duplicate key'); }
  for (const form of forms) {
    if (form.dependsOn.some(key => !remaining.has(key))) { invalid(`unknown dependency: ${form.key}`); }
  }
  const groups = [];
  while (remaining.size) {
    const group = forms.filter(form => remaining.has(form.key) && form.dependsOn.every(key => !remaining.has(key))).map(form => form.key);
    if (!group.length) { invalid('cyclic dependency'); }
    groups.push(group);
    group.forEach(key => remaining.delete(key));
  }
  return { forms, groups };
}

function parseOutput(stdout) {
  const text = String(stdout || '').trim();
  try { return JSON.parse(text); } catch (_) { /* Some commands emit progress before JSON. */ }
  let output = null;
  for (const line of text.split('\n').reverse()) {
    try {
      const item = JSON.parse(line);
      if (!output) { output = item; }
      const formUuid = item.formUuid || item.details?.formUuid;
      if (output && typeof output === 'object' && formUuid && !output.formUuid) { output.formUuid = formUuid; }
    } catch (_) { /* Read the last result and preserve any earlier created ID. */ }
  }
  return output;
}

function execute(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.resolve(__dirname, '../../../bin/yida.js'), ...args, '--quiet'], {
      env: { ...process.env, YIDA_QUIET: '1' }, timeout: 180000, maxBuffer: 8 * 1024 * 1024,
    }, (error, stdout) => {
      const output = parseOutput(stdout);
      if (error || !output || typeof output !== 'object' || output.success === false) {
        reject(Object.assign(new Error(output?.errorMsg || output?.error || error?.message || 'Missing command result'), { output }));
      } else { resolve(output); }
    });
  });
}

async function schedule(forms, concurrency, results, worker, save) {
  const pending = new Set(forms.filter(form => !results[form.key] || results[form.key].status === 'blocked').map(form => form.key));
  const active = new Map();
  try {
    while (pending.size || active.size) {
      const pendingBefore = pending.size;
      for (const form of forms) {
        if (!pending.has(form.key)) { continue; }
        const deps = form.dependsOn.map(key => results[key]?.status);
        if (form.dependsOn.some(key => !pending.has(key) && !active.has(key) && ['failed', 'running', 'blocked'].includes(results[key]?.status))) {
          results[form.key] = { status: 'blocked' }; pending.delete(form.key); save(); continue;
        }
        if (active.size >= concurrency || deps.some(status => status !== 'success')) { continue; }
        pending.delete(form.key);
        results[form.key] = { status: 'running' };
        save(); // Record intent before the request; an interrupted create is never retried automatically.
        const task = Promise.resolve().then(() => worker(form)).then(output => {
          results[form.key] = { ...output, status: 'success' };
        }, error => {
          results[form.key] = { ...results[form.key], status: 'failed', error: error.message,
            ...((error.output?.formUuid || error.output?.details?.formUuid) ? { formUuid: error.output.formUuid || error.output.details.formUuid } : {}) };
        }).then(() => { save(); }).finally(() => active.delete(form.key));
        active.set(form.key, task);
      }
      if (active.size) {
        await Promise.race(active.values());
      } else if (pending.size === pendingBefore && pending.size) { invalid('unresolved dependency'); }
    }
  } catch (error) {
    await Promise.allSettled(active.values());
    throw error;
  }
  return results;
}

async function run(args, dependencies = {}) {
  const options = parseArgs(args);
  const { forms, groups } = loadPlan(options.file);
  const call = dependencies.execute || execute;
  // Preflight all definitions before the first remote mutation.
  await schedule(forms.map(form => ({ ...form, dependsOn: [] })), options.concurrency, {}, async form => {
    const fields = mapReferences(form.fields, (_, field) => field ? 'textField_precheck' : 'FORM-PRECHECK');
    return call(['create-form', 'validate-fields', JSON.stringify(fields), '--json']);
  }, () => {}).then(results => {
    if (Object.values(results).some(item => item.status !== 'success')) { invalid(results); }
  });
  if (options.check) {
    const output = { success: true, checked: true, groups, concurrency: options.concurrency };
    console.log(JSON.stringify(output)); return output;
  }
  const stateFile = `${options.file}.state.json`;
  const lock = `${stateFile}.lock`;
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ appType: options.appType, forms })).digest('hex');
  const fd = fs.openSync(lock, 'wx');
  const save = state => {
    fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify(state, null, 2));
    fs.renameSync(`${stateFile}.tmp`, stateFile);
  };
  try {
    const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { fingerprint, appType: options.appType, results: {} };
    if (state.fingerprint !== fingerprint) { invalid('state belongs to a different plan; reconcile existing resources before preparing a new batch'); }
    await call(['login', '--check-only', '--json']);
    // Read back completed resources before their IDs can be used by dependent forms.
    for (const form of forms.filter(item => state.results[item.key]?.status === 'success')) {
      const item = state.results[form.key];
      const schema = await call(['get-schema', options.appType, item.formUuid, '--field-map-json']);
      if (schema.formUuid !== item.formUuid || !Array.isArray(schema.fields)) { invalid(`schema: ${form.key}`); }
      item.fields = schema.fields;
    }
    const resolve = (key, field) => {
      const item = state.results[key];
      if (item?.status !== 'success') { invalid(`dependency: ${key}`); }
      if (!field) { return item.formUuid; }
      const matches = item.fields.filter(value => value.fieldId === field || value.label === field);
      if (matches.length !== 1) { invalid(`field: ${key}.${field}`); }
      return matches[0].fieldId;
    };
    await schedule(forms, options.concurrency, state.results, async form => {
      let formUuid = form.formUuid;
      if (!formUuid) {
        const argv = ['create-form', 'create', options.appType, form.title, JSON.stringify(mapReferences(form.fields, resolve)), '--no-open'];
        for (const key of ['icon', 'locale']) { if (form[key]) { argv.push(`--${key}`, form[key]); } }
        const created = await call(argv);
        if (typeof created.formUuid !== 'string' || !created.formUuid.startsWith('FORM')) { invalid(`create result: ${form.key}`); }
        formUuid = created.formUuid;
      }
      state.results[form.key].formUuid = formUuid;
      save(state);
      const schema = await call(['get-schema', options.appType, formUuid, '--field-map-json']);
      if (schema.formUuid !== formUuid || !Array.isArray(schema.fields)) { invalid(`schema: ${form.key}`); }
      return { formUuid, fields: schema.fields };
    }, () => save(state));
    const output = { success: Object.values(state.results).every(item => item.status === 'success'), groups, stateFile, results: state.results };
    console.log(JSON.stringify(output));
    if (!output.success) { process.exitCode = 1; }
    return output;
  } finally {
    fs.closeSync(fd); fs.unlinkSync(lock);
  }
}

module.exports = { run, parseArgs, loadPlan, mapReferences, schedule, parseOutput };
