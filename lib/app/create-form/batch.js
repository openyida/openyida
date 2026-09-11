'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { CliError } = require('../../core/cli-error');
const { t } = require('../../core/i18n');
const { usage, hint } = require('../../core/chalk');
const { assertNoEmojiInText, assertNoEmojiInValue } = require('../../core/no-emoji-guard');
const { normalizeYidaLocale } = require('../../core/yida-i18n');
const { FORM_NAV_ICONS, resolveFormNavIcon } = require('./nav-icon');

const BATCH_USAGE = 'openyida create-form batch <appType> <plan.json> [--concurrency 1..4] [--check] [--json]';
const BATCH_PLAN_EXAMPLE = '{"forms":[{"key":"customer","title":"客户","fieldsFile":"customer-fields.json"},{"key":"order","title":"订单","fieldsFile":"order-fields.json","dependsOn":["customer"]}]}';

function invalid(reason) {
  throw new CliError(t('create_form.batch_invalid'), { code: 'FORM_BATCH_INVALID', details: { reason } });
}

function validateStaticDefinition(form, fields) {
  try {
    assertNoEmojiInText(form.title, { artifact: `forms.${form.key}.title` });
    assertNoEmojiInValue(fields, { artifact: `forms.${form.key}.fields` });
  } catch (error) {
    invalid({
      formKey: form.key,
      errorCode: error?.code || 'OPENYIDA_ARTIFACT_EMOJI_FORBIDDEN',
      errorMsg: error?.message || String(error),
    });
  }
  if (form.icon !== undefined && !resolveFormNavIcon(form.icon, form.title, fields).icon) {
    invalid({
      formKey: form.key,
      errorCode: 'CREATE_FORM_NAV_ICON_INVALID',
      errorMsg: `Unsupported form navigation icon: ${form.icon}`,
      icon: form.icon,
      availableIconCount: FORM_NAV_ICONS.length,
    });
  }
  if (form.locale !== undefined && !normalizeYidaLocale(form.locale)) {
    invalid({
      formKey: form.key,
      errorCode: 'CREATE_FORM_INVALID_ARGUMENTS',
      errorMsg: `Unsupported locale: ${form.locale}`,
      locale: form.locale,
    });
  }
}

function parseArgs(args) {
  if (args.includes('--help') || args.includes('-h')) { return { help: true }; }
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
    invalid(BATCH_USAGE.replace(/^openyida /, ''));
  }
  return { ...options, appType: positional[0], file: path.resolve(positional[1]) };
}

function showHelp() {
  usage(BATCH_USAGE);
  hint('plan.json: ' + BATCH_PLAN_EXAMPLE);
  hint('fieldsFile is resolved relative to plan.json; use dependsOn and {"$form":"key","field":"label"} for dependencies.');
  hint('Run one authoritative batch. If it continues in background, do not stop it, delete its state, or fall back to create/update/resume.');
  return { success: true, help: true, usage: BATCH_USAGE };
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

function normalizeAssociationReferences(value, appType) {
  if (Array.isArray(value)) {
    return value.map(item => normalizeAssociationReferences(item, appType));
  }
  if (!value || typeof value !== 'object') { return value; }
  const normalized = Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    normalizeAssociationReferences(item, appType),
  ]));
  const association = value.associationForm;
  if (
    value.type === 'AssociationFormField' &&
    association &&
    typeof association === 'object' &&
    !Array.isArray(association) &&
    typeof association.$form === 'string'
  ) {
    const reference = { $form: association.$form };
    normalized.associationForm = {
      ...(appType ? { appType } : {}),
      formUuid: reference,
      ...(typeof association.field === 'string' && association.field.trim() ? {
        mainFieldId: { ...reference, field: association.field },
        mainFieldLabel: association.field,
        mainComponentName: 'TextField',
      } : {}),
    };
  }
  return normalized;
}

function loadPlan(file, options = {}) {
  const input = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(input.forms) || !input.forms.length) { invalid('forms'); }
  const forms = input.forms.map(form => {
    if (!form || !/^[a-zA-Z][\w-]*$/.test(form.key || '') || typeof form.title !== 'string' || !form.title.trim() ||
      (form.fields === undefined) === (form.fieldsFile === undefined) ||
      (form.dependsOn !== undefined && (!Array.isArray(form.dependsOn) || form.dependsOn.some(key => typeof key !== 'string')))) { invalid('form'); }
    if (Object.keys(form).some(key => !['key', 'title', 'fields', 'fieldsFile', 'dependsOn', 'formUuid', 'icon', 'locale'].includes(key))) { invalid(form.key); }
    if (form.formUuid !== undefined && (typeof form.formUuid !== 'string' || !form.formUuid.startsWith('FORM'))) { invalid(form.key); }
    for (const key of ['icon', 'locale']) { if (form[key] !== undefined && typeof form[key] !== 'string') { invalid(key); } }
    const rawFields = form.fieldsFile === undefined ? form.fields : JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), form.fieldsFile), 'utf8'));
    const fields = normalizeAssociationReferences(rawFields, options.appType);
    validateStaticDefinition(form, fields);
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

function mergeCommandOutput(stdout, stderr, failed) {
  const stdoutOutput = parseOutput(stdout);
  const stderrOutput = parseOutput(stderr);
  if (!failed) { return stdoutOutput || stderrOutput; }
  if (!stdoutOutput) { return stderrOutput; }
  if (!stderrOutput) { return stdoutOutput; }
  return { ...stdoutOutput, ...stderrOutput };
}

function boundedDiagnostic(value) {
  const text = String(value || '').trim();
  return text.length > 4000 ? text.slice(-4000) : text;
}

function expectedReadbackFields(fields) {
  const expected = [];
  for (const field of Array.isArray(fields) ? fields : []) {
    if (Array.isArray(field)) {
      expected.push(...expectedReadbackFields(field));
      continue;
    }
    if (!field || typeof field !== 'object') { continue; }
    if (field.type === 'ColumnContainer') {
      expected.push(...expectedReadbackFields(field.children));
      continue;
    }
    if (['Divider', 'RichText', 'PageSection', 'GroupContainer'].includes(field.type)) { continue; }
    if (typeof field.label === 'string' && field.label.trim()) {
      expected.push({ label: field.label.trim(), componentName: field.type });
    }
  }
  return expected;
}

function readbackMatchesExpectedFields(schema, fields) {
  if (!schema || typeof schema.formUuid !== 'string' || !Array.isArray(schema.fields)) { return false; }
  const actual = schema.fields.filter(field => field && typeof field === 'object');
  return expectedReadbackFields(fields).every(expected => actual.some(field =>
    field.label === expected.label && (!expected.componentName || field.componentName === expected.componentName)
  ));
}

function readbackMismatch(formUuid, form, schema) {
  const expected = expectedReadbackFields(form.fields);
  const actual = Array.isArray(schema?.fields) ? schema.fields.map(field => ({
    label: field?.label,
    componentName: field?.componentName,
  })) : [];
  return Object.assign(new Error(`Form batch readback mismatch: ${form.key}`), {
    output: {
      success: false,
      errorCode: 'FORM_BATCH_READBACK_MISMATCH',
      errorMsg: `Created form ${form.key} did not contain all expected fields`,
      formUuid,
      details: { formKey: form.key, formUuid, expected, actual },
    },
  });
}

function execute(args, { execFile: execFileImpl = execFile } = {}) {
  return new Promise((resolve, reject) => {
    execFileImpl(process.execPath, [path.resolve(__dirname, '../../../bin/yida.js'), ...args, '--quiet'], {
      env: { ...process.env, YIDA_QUIET: '1' }, timeout: 180000, maxBuffer: 8 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      const output = mergeCommandOutput(stdout, stderr, Boolean(error));
      if (error || !output || typeof output !== 'object' || output.success === false) {
        reject(Object.assign(new Error(
          output?.errorMsg || output?.error || output?.message || boundedDiagnostic(stderr) || error?.message || 'Missing command result'
        ), { output }));
      } else { resolve(output); }
    });
  });
}

async function schedule(forms, concurrency, results, worker, save) {
  const pending = new Set(forms.filter(form => {
    const result = results[form.key];
    return !result || result.status === 'blocked' || (result.status === 'failed' && result.formUuid);
  }).map(form => form.key));
  const active = new Map();
  const recoveryAttempted = new Set(forms.filter(form =>
    form.formUuid || (results[form.key]?.status === 'failed' && results[form.key]?.formUuid)
  ).map(form => form.key));
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
        const hadKnownFormUuid = Boolean(form.formUuid || results[form.key]?.formUuid);
        if (hadKnownFormUuid) { recoveryAttempted.add(form.key); }
        results[form.key] = { ...results[form.key], status: 'running' };
        save(); // Record intent before the request; an interrupted create is never retried automatically.
        const task = Promise.resolve().then(() => worker(form)).then(output => {
          results[form.key] = { ...output, status: 'success' };
        }, error => {
          results[form.key] = { ...results[form.key], status: 'failed', error: error.message,
            ...((error.output?.formUuid || error.output?.details?.formUuid) ? { formUuid: error.output.formUuid || error.output.details.formUuid } : {}) };
          // A create may persist the form before a later schema/readback stage fails.
          // Retry that known UUID once inside the same authoritative batch so its
          // dependents remain pending and can run after conservative resume.
          if (!hadKnownFormUuid && results[form.key].formUuid && !recoveryAttempted.has(form.key)) {
            recoveryAttempted.add(form.key);
            pending.add(form.key);
          }
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
  if (options.help) { return showHelp(); }
  const { forms, groups } = loadPlan(options.file, { appType: options.appType });
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
      let formUuid = form.formUuid || state.results[form.key]?.formUuid;
      let shouldResume = Boolean(!form.formUuid && formUuid);
      const resolvedFields = mapReferences(form.fields, resolve);
      if (!formUuid) {
        const argv = ['create-form', 'create', options.appType, form.title, JSON.stringify(resolvedFields), '--no-open'];
        for (const key of ['icon', 'locale']) { if (form[key]) { argv.push(`--${key}`, form[key]); } }
        try {
          const created = await call(argv);
          if (typeof created.formUuid !== 'string' || !created.formUuid.startsWith('FORM')) { invalid(`create result: ${form.key}`); }
          formUuid = created.formUuid;
        } catch (error) {
          const createdFormUuid = error.output?.formUuid || error.output?.details?.formUuid;
          if (typeof createdFormUuid !== 'string' || !createdFormUuid.startsWith('FORM')) {
            throw error;
          }
          formUuid = createdFormUuid;
          shouldResume = true;
        }
      }
      state.results[form.key].formUuid = formUuid;
      save(state);
      let resumed = false;
      if (shouldResume) {
        await call(['create-form', 'resume', options.appType, formUuid, JSON.stringify(resolvedFields), '--json']);
        resumed = true;
      }
      let schema = await call(['get-schema', options.appType, formUuid, '--field-map-json']);
      if (!readbackMatchesExpectedFields(schema, resolvedFields) && !resumed && !form.formUuid) {
        await call(['create-form', 'resume', options.appType, formUuid, JSON.stringify(resolvedFields), '--json']);
        resumed = true;
        schema = await call(['get-schema', options.appType, formUuid, '--field-map-json']);
      }
      if (schema.formUuid !== formUuid || !readbackMatchesExpectedFields(schema, resolvedFields)) {
        throw readbackMismatch(formUuid, { ...form, fields: resolvedFields }, schema);
      }
      return { formUuid, fields: schema.fields };
    }, () => save(state));
    const success = Object.values(state.results).every(item => item.status === 'success');
    const output = { success, groups, stateFile, results: state.results };
    if (!success) {
      output.errorCode = 'FORM_BATCH_PARTIAL_FAILURE';
      output.nextAction = 'Inspect the saved state and child error, then fix the batch input or recover known formUuid values. Do not fall back to create-form create.';
    }
    console.log(JSON.stringify(output));
    if (!output.success) { process.exitCode = 1; }
    return output;
  } finally {
    fs.closeSync(fd); fs.unlinkSync(lock);
  }
}

module.exports = {
  run,
  parseArgs,
  loadPlan,
  mapReferences,
  normalizeAssociationReferences,
  schedule,
  parseOutput,
  mergeCommandOutput,
  execute,
  expectedReadbackFields,
  readbackMatchesExpectedFields,
  validateStaticDefinition,
};
