'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { resolveProjectRoot } = require('../core/utils');
const { createYidaClient } = require('../core/yida-client');

const ACTIONS = ['list', 'inspect', 'options', 'create', 'update', 'delete'];
const RECEIVER_TYPES = new Set(['employee', 'role', 'formField', 'variable']);
const FORM_TRIGGERS = new Set(['FORM_DATA_CREATE', 'FORM_DATA_EDIT', 'FORM_DATA_DELETE', 'FORM_COMMENT']);
const SYSTEM_VARIABLES = new Set(['originator']);
const MESSAGE_FIELD_COMPONENTS = new Set([
  'TextareaField', 'EmployeeField', 'SelectField', 'MultiSelectField', 'DateField', 'TextField',
  'RadioField', 'NumberField', 'CheckboxField', 'RateField', 'CascadeDateField', 'DepartmentSelectField',
]);
const RECIPIENT_FIELD_COMPONENTS = new Set(['EmployeeField']);
const ID = /^[A-Za-z0-9_-]+$/;
const TEMPLATES = Object.freeze({
  workNotice: { uuid: 'system_default_work_notice', type: 'workNotice', content: true, target: 'person' },
  detailImage: { uuid: '8fbf8a81-c775-4570-b367-86d4d719a85f', type: 'card', fields: true, target: 'person' },
  imageCard: { uuid: '39caf717-df43-46e1-98f9-564fdd1dc789', type: 'card', content: true, target: 'person' },
  detailText: { uuid: '97bd36d0-64d8-4c50-96e8-f02312655700', type: 'card', fields: true, target: 'person' },
  commentCard: { uuid: 'c298cd88-0de6-44c3-9023-c93e0d7db9ac', type: 'card', content: true, target: 'person' },
  pinnedImage: { uuid: 'cdcdf076-3625-4da7-9a61-571591594209', type: 'ceilingCard', content: true, target: 'group' },
  pinnedText: { uuid: '68240de5-8d9e-416a-b5b2-c71dca0ab703', type: 'ceilingCard', content: true, target: 'group' },
});
const TEMPLATE_BY_UUID = new Map(Object.entries(TEMPLATES).map(([key, item]) => [item.uuid, { key, ...item }]));

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));

/** Build a stable fingerprint for concurrency checks and destructive actions. */
function hash(value) {
  const stable = item => Array.isArray(item) ? item.map(stable) : object(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, stable(item[key])])) : item;
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function fail(code, key, detail = '', details) {
  throw new CliError(t(`form_message.${key}`, detail), { code: `FORM_MESSAGE_${code}`, details });
}

function safe(value) {
  if (!value || typeof value !== 'object') {return;}
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) {fail('INVALID_CONFIG', 'invalid_config', key);}
    safe(value[key]);
  }
}

function parseJson(value, label) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; }
  catch (_) { return fail('INVALID_CONFIG', 'invalid_config', label); }
}

function unwrap(response, endpoint) {
  if (!response || response.success !== true || response.__needLogin || response.__csrfExpired || response.content === false) {
    fail('API_ERROR', 'api_error', response?.errorMsg || response?.message || endpoint, {
      endpoint, platformErrorCode: response?.errorCode || null, needLogin: !!response?.__needLogin,
    });
  }
  return response.content;
}

/** Normalize a native binding while retaining fields required for lossless backup and update. */
function normalize(raw) {
  if (!object(raw) || raw.id === undefined || raw.id === null || !String(raw.id).trim()) {
    fail('INVALID_RESPONSE', 'invalid_response', 'id');
  }
  const cardConfig = raw.cardConfig ? parseJson(raw.cardConfig, 'cardConfig') : {};
  if (!object(cardConfig)) {fail('INVALID_RESPONSE', 'invalid_response', 'cardConfig');}
  const recipients = [];
  const add = (source, type) => String(source || '').split(',').map(value => value.trim()).filter(Boolean)
    .forEach(value => recipients.push({ type, value }));
  add(raw.persons, 'employee'); add(raw.roleId, 'role'); add(raw.formField, 'formField'); add(raw.variable, 'variable');
  const nativeGroups = Array.isArray(cardConfig.groups) ? clone(cardConfig.groups) : [];
  const template = TEMPLATE_BY_UUID.get(cardConfig.templateUuid) || {};
  const buttons = Array.isArray(cardConfig.buttons) ? clone(cardConfig.buttons) : [];
  return {
    id: String(raw.id),
    formUuid: raw.formUuid || null,
    trigger: raw.phase || null,
    messageType: raw.messageType || 'NORMAL',
    recipients,
    groups: nativeGroups,
    template: {
      key: template.key || null,
      uuid: cardConfig.templateUuid || raw.messageUuid || null,
      type: cardConfig.templateType || template.type || null,
      title: cardConfig.cardTitle || '',
      content: cardConfig.mainContent || '',
      fields: Array.isArray(cardConfig.datas) ? clone(cardConfig.datas) : [],
      image: Array.isArray(cardConfig.messageImage) ? clone(cardConfig.messageImage) : [],
      contentType: cardConfig.messageContentType || (raw.messageUuid ? 'TEMPLATE' : 'CUSTOM'),
      platformTemplateUuid: raw.messageUuid && !String(raw.messageUuid).includes('#') ? raw.messageUuid : null,
      button: buttons[0] || null,
    },
    advanced: {
      openMore: !!cardConfig.openMore,
      activityIds: String(raw.activityId || '').split(',').filter(Boolean),
      condition: raw.conditionJson ? parseJson(raw.conditionJson, 'conditionJson') : null,
      processId: raw.processId || null,
      outcome: String(raw.outResult || '').split(',').filter(Boolean),
      currentGroup: raw.curDingGroup === 'y',
      sendWorkNotice: raw.isSendMessage === 'y',
    },
    native: clone(raw),
  };
}

function parseArgs(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (Object.hasOwn(flags, arg)) {fail('USAGE', 'usage');}
    if (['--json', '--yes', '--help', '-h'].includes(arg)) { flags[arg] = true; continue; }
    if (['--config', '--backup', '--expected-hash'].includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith('-')) {fail('USAGE', 'usage');}
      flags[arg] = args[++i]; continue;
    }
    if (arg.startsWith('-')) {fail('USAGE', 'usage');}
    positional.push(arg);
  }
  if (flags['--help'] || flags['-h']) {return { help: true };}
  const [action, appType, formUuid, messageId] = positional;
  const targeted = ['inspect', 'update', 'delete'].includes(action);
  if (!ACTIONS.includes(action) || positional.length !== (targeted ? 4 : 3)
    || !ID.test(appType || '') || !ID.test(formUuid || '') || (targeted && !ID.test(messageId || ''))
    || (['create', 'update'].includes(action) && !flags['--config'])
    || (action === 'delete' && (!flags['--yes'] || !flags['--expected-hash']))) {fail('USAGE', 'usage');}
  const allowed = { list: [], inspect: [], options: [], create: ['--config', '--backup'],
    update: ['--config', '--backup', '--expected-hash'], delete: ['--yes', '--backup', '--expected-hash'] };
  if (Object.keys(flags).some(key => key !== '--json' && !allowed[action].includes(key))) {fail('USAGE', 'usage');}
  return { action, appType, formUuid, messageId, flags };
}

function fieldId(field) { return field.fieldId || field.id || field.componentId; }
function fieldType(field) { return field.componentName || field.fieldType || field.type; }

function normalizeTemplate(value) {
  if (!object(value)) {fail('INVALID_CONFIG', 'invalid_config', 'template');}
  const registry = value.key ? TEMPLATES[value.key] : TEMPLATE_BY_UUID.get(value.uuid);
  if (!registry || (value.uuid && value.uuid !== registry.uuid) || (value.type && value.type !== registry.type)) {
    fail('INVALID_CONFIG', 'invalid_config', 'template.key / template.uuid / template.type');
  }
  const result = { ...value, key: value.key || TEMPLATE_BY_UUID.get(registry.uuid).key,
    uuid: registry.uuid, type: registry.type };
  result.title = String(result.title || '').trim();
  result.content = String(result.content || '').trim();
  result.fields = result.fields || [];
  result.image = result.image || [];
  result.contentType = 'CUSTOM';
  result.platformTemplateUuid = null;
  result.button = result.button || null;
  if (!result.title || result.title.replace(/\$!\{\w+\}/g, '').length > 50) {fail('INVALID_CONFIG', 'invalid_config', 'template.title');}
  if (registry.content && !result.content) {fail('INVALID_CONFIG', 'invalid_config', 'template.content');}
  if (registry.fields && (!Array.isArray(result.fields) || !result.fields.length)) {fail('INVALID_CONFIG', 'invalid_config', 'template.fields');}
  if (!Array.isArray(result.fields) || !Array.isArray(result.image)) {fail('INVALID_CONFIG', 'invalid_config', 'template.fields / template.image');}
  if (result.button !== undefined && result.button !== null) {
    if (!object(result.button) || typeof result.button.name !== 'string'
      || !['formInstDetail', 'comment', 'custom'].includes(result.button.type)) {fail('INVALID_CONFIG', 'invalid_config', 'template.button');}
    if (result.button.type === 'custom') {
      let url; try { url = new URL(result.button.value); } catch (_) { fail('INVALID_CONFIG', 'invalid_config', 'template.button.value'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {fail('INVALID_CONFIG', 'invalid_config', 'template.button.value');}
    }
  }
  return { result, registry };
}

/** Validate references against the target form metadata before a mutation. */
function validateConfig(value, metadata) {
  if (!object(value) || !FORM_TRIGGERS.has(value.trigger)) {
    fail('UNSUPPORTED_TRIGGER', 'unsupported_trigger', value?.trigger || '');
  }
  const formType = metadata.form.formType;
  if (formType === 'process') {fail('UNSUPPORTED_FORM', 'unsupported_form', formType);}
  const { result: template, registry } = normalizeTemplate(value.template);
  const recipients = value.recipients || [];
  const groups = value.groups || [];
  if (!Array.isArray(recipients) || !Array.isArray(groups)) {fail('INVALID_CONFIG', 'invalid_config', 'recipients / groups');}
  if (registry.target === 'person' && !recipients.length) {fail('INVALID_CONFIG', 'invalid_config', 'recipients');}
  if (registry.target === 'group' && !groups.length) {fail('INVALID_CONFIG', 'invalid_config', 'groups');}
  if (recipients.length > 100) {fail('INVALID_CONFIG', 'invalid_config', 'recipients (max 100)');}
  const seen = new Set();
  for (const receiver of recipients) {
    if (!object(receiver) || !RECEIVER_TYPES.has(receiver.type) || !ID.test(String(receiver.value || ''))
      || seen.has(`${receiver.type}:${receiver.value}`)) {fail('INVALID_CONFIG', 'invalid_config', 'recipients');}
    seen.add(`${receiver.type}:${receiver.value}`);
    if (receiver.type === 'variable' && !SYSTEM_VARIABLES.has(receiver.value)) {fail('INVALID_CONFIG', 'invalid_config', `recipient variable: ${receiver.value}`);}
    if (receiver.type === 'formField' && !metadata.recipientFields.some(field => fieldId(field) === receiver.value)) {
      fail('INVALID_CONFIG', 'invalid_config', `recipient field: ${receiver.value}`);
    }
  }
  for (const group of groups) {
    if (!object(group) || !ID.test(String(group.cid || group.id || ''))) {fail('INVALID_CONFIG', 'invalid_config', 'groups');}
  }
  for (const item of template.fields) {
    if (!object(item) || !['variable', 'formField'].includes(item.type) || typeof item.title !== 'string' || !item.title.trim()
      || !ID.test(String(item.value || ''))) {fail('INVALID_CONFIG', 'invalid_config', 'template.fields');}
    if (item.type === 'variable' && !metadata.systemFields.some(field => field.value === item.value)) {
      fail('INVALID_CONFIG', 'invalid_config', `template variable: ${item.value}`);
    }
    if (item.type === 'formField' && !metadata.messageFields.some(field => fieldId(field) === item.value)) {
      fail('INVALID_CONFIG', 'invalid_config', `template field: ${item.value}`);
    }
  }
  return { trigger: value.trigger, recipients: clone(recipients), groups: clone(groups), template };
}

function patchConfig(base, patch) {
  if (!object(patch) || !Object.keys(patch).length || Object.keys(patch).some(key => !['trigger', 'recipients', 'groups', 'template'].includes(key))) {
    fail('INVALID_CONFIG', 'invalid_config', 'trigger, recipients, groups, template');
  }
  safe(patch);
  const next = { ...base, ...patch };
  if (patch.template) {next.template = { ...base.template, ...patch.template };}
  return next;
}

function editable(message) {
  return { trigger: message.trigger, recipients: clone(message.recipients), groups: clone(message.groups), template: clone(message.template) };
}

function serialize(config, formUuid, messageId, native = {}) {
  const byType = type => config.recipients.filter(item => item.type === type).map(item => item.value).join(',');
  const registered = config.template.key ? TEMPLATES[config.template.key] : TEMPLATE_BY_UUID.get(config.template.uuid);
  const nativeCardConfig = native.cardConfig ? parseJson(native.cardConfig, 'cardConfig') : {};
  const cardConfig = {
    ...nativeCardConfig,
    openMore: false,
    groups: config.groups,
    messageImage: config.template.image,
    cardTitle: config.template.title,
    mainContent: config.template.content,
    datas: config.template.fields,
    templateUuid: config.template.uuid || registered.uuid,
    templateType: config.template.type || registered.type,
    messageContentType: 'CUSTOM',
    buttons: config.template.button ? [config.template.button] : [],
  };
  return {
    ...clone(native),
    service: native.service || '', formUuid, phase: config.trigger, outResult: native.outResult || '',
    formField: byType('formField'), studentField: native.studentField || '', roleId: byType('role'),
    persons: byType('employee'), varField: native.varField || '', messageUuid: '', id: messageId || '',
    variable: byType('variable'), email: native.email || '', formFieldEmail: native.formFieldEmail || '',
    activityId: native.activityId || '', messageType: native.messageType || 'NORMAL',
    curDingGroup: native.curDingGroup || 'n', isSendMessage: native.isSendMessage || 'n',
    processId: native.processId || '', conditionJson: native.conditionJson || '', cardConfig: JSON.stringify(cardConfig),
  };
}

async function execute(parsed, client = createYidaClient()) {
  const { action, appType, formUuid, messageId, flags } = parsed;
  const prefix = `/${appType}/query/`;
  const read = async (endpoint, params = {}) => unwrap(await client.get(prefix + endpoint, { formUuid, ...params }), endpoint);
  const list = async () => {
    const rows = await read('formMsgTpl/listFormMessageBind.json');
    if (!Array.isArray(rows)) {fail('INVALID_RESPONSE', 'invalid_response', 'messages');}
    const messages = rows.map(normalize);
    if (messages.some(item => item.formUuid && item.formUuid !== formUuid)
      || new Set(messages.map(item => item.id)).size !== messages.length) {fail('INVALID_RESPONSE', 'invalid_response', 'messages');}
    return messages;
  };
  const metadata = async () => {
    const info = await read('formdesign/getFormAndAppInfo.json', { appType });
    const form = info?.formDatas?.values?.find(item => item.formUuid === formUuid);
    if (!form || !Array.isArray(form.fields)) {fail('INVALID_RESPONSE', 'invalid_response', 'form metadata');}
    const fields = form.fields;
    return {
      form: { formUuid, formType: form.formType, title: form.title, processCode: form.processCode || null },
      triggers: [...FORM_TRIGGERS],
      readOnlyTriggers: ['RECUR_JOB_FIELD', 'INST_START', 'INST_COMPLETE', 'INST_NODE', 'TASK_GENERATE', 'TASK_COMPLETED'],
      templates: Object.entries(TEMPLATES).map(([key, item]) => ({ key, ...item })),
      systemFields: [
        { value: 'formInstId', componentName: 'TextField' }, { value: 'originatorName', componentName: 'TextField' },
        { value: 'originator', componentName: 'TextField' }, { value: 'createTime', componentName: 'DateField' },
        { value: 'modifiedTime', componentName: 'DateField' }, { value: 'serialNo', componentName: 'TextField' },
        { value: 'formTitle', componentName: 'TextField' }, { value: 'title', componentName: 'TextField' },
      ],
      messageFields: fields.filter(field => MESSAGE_FIELD_COMPONENTS.has(fieldType(field))),
      recipientFields: fields.filter(field => RECIPIENT_FIELD_COMPONENTS.has(fieldType(field))),
      recipientVariables: [...SYSTEM_VARIABLES],
      supportsToggle: false,
    };
  };
  // Link to the form's native notification settings in the authenticated environment.
  const configUrl = new URL(`/${appType}/admin/${formUuid}/settings/messageSetting`, client.getAuthRef().baseUrl).href;
  const output = { success: true, action, appType, formUuid, configUrl };
  if (action === 'options') {return { ...output, options: await metadata() };}
  const beforeList = await list();
  const before = messageId ? beforeList.find(item => item.id === messageId) : null;
  if (messageId && !before) {fail('NOT_FOUND', 'not_found', messageId);}
  if (action === 'list') {return { ...output, messages: beforeList, totalCount: beforeList.length, supportsToggle: false };}
  if (action === 'inspect') {return { ...output, messageId, message: before, configHash: hash(editable(before)), supportsToggle: false };}
  if (flags['--expected-hash'] && flags['--expected-hash'] !== hash(editable(before))) {fail('CONFLICT', 'conflict');}

  let expected;
  if (action !== 'delete') {
    let patch;
    try { patch = parseJson(fs.readFileSync(path.resolve(flags['--config']), 'utf8'), 'config'); }
    catch (error) { if (error instanceof CliError) {throw error;} fail('INVALID_CONFIG', 'invalid_config', 'config file'); }
    const defaults = { trigger: 'FORM_DATA_CREATE', recipients: [{ type: 'variable', value: 'originator' }], groups: [],
      template: { key: 'workNotice', title: '', content: '', fields: [], image: [], button: null } };
    expected = validateConfig(patchConfig(before ? editable(before) : defaults, patch), await metadata());
    if (before && isDeepStrictEqual(editable(before), expected)) {
      return { ...output, messageId, changed: false, message: before, configHash: hash(expected), readbackVerified: true };
    }
  }
  const snapshot = beforeList.map(item => [item.id, hash(item.native)]);
  if (!isDeepStrictEqual(snapshot, (await list()).map(item => [item.id, hash(item.native)]))) {fail('CONFLICT', 'conflict');}
  const backupPath = flags['--backup'] ? path.resolve(flags['--backup']) : path.join(resolveProjectRoot().projectRoot,
    '.cache', 'openyida', 'form-message', `${Date.now()}-${crypto.randomUUID()}.json`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify({ appType, formUuid, action, messages: beforeList }, null, 2), { flag: 'wx', mode: 0o600 });
  const details = { target: { appType, formUuid, ...(messageId ? { messageId } : {}) }, backupPath,
    retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true };
  const endpoint = action === 'delete' ? 'formMsgTpl/removeMessageBind.json' : 'formMsgTpl/saveOrUpdateMessageBind.json';
  const params = action === 'delete' ? { id: messageId } : serialize(expected, formUuid, messageId, before?.native);
  try { unwrap(await client.postFormOnce(prefix + endpoint, params), endpoint); }
  catch (error) { throw new CliError(error.message, { code: error.code || 'FORM_MESSAGE_WRITE_FAILED', details: { ...error.details, ...details } }); }
  try {
    const after = await list();
    if (action === 'delete') {
      if (after.some(item => item.id === messageId)) {fail('READBACK_MISMATCH', 'readback_mismatch');}
      return { ...output, messageId, changed: true, backupPath, readbackVerified: true };
    }
    const added = after.filter(item => !beforeList.some(old => old.id === item.id));
    const saved = action === 'create' ? (added.length === 1 ? added[0] : null) : after.find(item => item.id === messageId);
    if (!saved || !isDeepStrictEqual(editable(saved), expected)) {fail('READBACK_MISMATCH', 'readback_mismatch');}
    return { ...output, messageId: saved.id, changed: true, backupPath, readbackVerified: true,
      message: saved, configHash: hash(expected) };
  } catch (error) {
    throw new CliError(error.message, { code: error.code || 'FORM_MESSAGE_READBACK_FAILED',
      details: { ...details, mutationAccepted: true, sideEffectState: 'accepted_unverified' } });
  }
}

async function run(args, options = {}) {
  const parsed = parseArgs(args);
  if (parsed.help) { process.stdout.write(t('form_message.usage') + '\n'); return; }
  const result = await execute(parsed, options.client);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

module.exports = { ACTIONS, TEMPLATES, run, execute, parseArgs, normalize, validateConfig, patchConfig, serialize, hash, editable };
