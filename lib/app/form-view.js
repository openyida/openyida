'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { resolveProjectRoot } = require('../core/utils');
const { createAuthRef, createYidaClient } = require('../core/yida-client');
const { buildYidaTitleI18n } = require('../core/yida-i18n');
const { execute: executeCustomButton } = require('./custom-button');

const ACTIONS = ['list', 'inspect', 'save', 'create', 'order', 'rename', 'add-button'];
const VIEW_ACTIONS = ['inspect', 'save', 'rename', 'add-button'];
const SYSTEM_BUTTON_NAMES = {
  detail: { zh_CN: '详情', en_US: 'Detail', ja_JP: '詳細' },
  delete: { zh_CN: '删除', en_US: 'Delete', ja_JP: '削除' },
  log: { zh_CN: '运行日志', en_US: 'Run Log', ja_JP: '実行ログ' },
  var: { zh_CN: '变量', en_US: 'Variable', ja_JP: '変数' },
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function fail(code, key, detail, details) {
  throw new CliError(t(`form_view.${key}`, detail || ''), { code: `FORM_VIEW_${code}`, details });
}

function parseJson(value, label) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; }
  catch (_) { return fail('INVALID_CONFIG', 'invalid_config', label); }
}

function assertObject(value, label) {
  if (!object(value)) { fail('INVALID_CONFIG', 'invalid_config', label); }
  return value;
}

function assertSafeKeys(value) {
  if (!value || typeof value !== 'object') { return; }
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) {
      fail('INVALID_CONFIG', 'invalid_config', key);
    }
    assertSafeKeys(value[key]);
  }
}

function normalizeConfig(raw, viewUuid) {
  assertObject(raw, 'viewConfig');
  if (raw.viewUuid !== viewUuid) { fail('TARGET_MISMATCH', 'target_mismatch', viewUuid); }
  return {
    ...raw,
    viewUuid,
    staticConfig: assertObject(parseJson(raw.staticConfig || {}, 'staticConfig'), 'staticConfig'),
    defaultConfig: assertObject(parseJson(raw.defaultConfig || {}, 'defaultConfig'), 'defaultConfig'),
  };
}

function stable(value) {
  if (Array.isArray(value)) { return value.map(stable); }
  if (!object(value)) { return value; }
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function configHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable({
    staticConfig: value.staticConfig, defaultConfig: value.defaultConfig,
  }))).digest('hex');
}

function writableConfig(value) {
  // updateConfig generates this timestamp; it is not a user setting.
  const defaultConfig = { ...value.defaultConfig };
  delete defaultConfig.latestUpdateTime;
  return { staticConfig: value.staticConfig, defaultConfig };
}

// Native button names gain derived English text and nullable i18n metadata on serialization.
function comparableButtonConfig(config) {
  const result = writableConfig(config);
  const buttonList = result.staticConfig.buttonList;
  if (!Array.isArray(buttonList)) { return result; }
  return {
    ...result,
    staticConfig: {
      ...result.staticConfig,
      buttonList: buttonList.map(button => {
        if (!object(button?.name)) { return button; }
        const { pureEn_US, ...name } = Object.fromEntries(
          Object.entries(button.name).filter(([, value]) => value !== null && value !== undefined)
        );
        name.type ||= 'i18n';
        const englishName = name.en_US || name.zh_CN;
        if (englishName !== undefined) { name.en_US = englishName; }
        if (pureEn_US !== undefined && pureEn_US !== name.en_US) { name.pureEn_US = pureEn_US; }
        return { ...button, name };
      }),
    },
  };
}

// Objects merge recursively; arrays and complete condition expressions replace.
function merge(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = object(value) && !['filter', 'dataRange'].includes(key)
      ? merge(object(base[key]) ? base[key] : {}, value) : value;
  }
  return result;
}

function validatePatch(patch) {
  assertObject(patch, 'config');
  assertSafeKeys(patch);
  if (!Object.keys(patch).length || Object.keys(patch).some(key => !['staticConfig', 'defaultConfig'].includes(key))) {
    fail('INVALID_CONFIG', 'invalid_config', 'staticConfig / defaultConfig');
  }
  for (const key of Object.keys(patch)) { assertObject(patch[key], key); }
  const def = patch.defaultConfig || {};
  const stat = patch.staticConfig || {};
  for (const [key, value] of [['showFields', def.showFields], ['lockFieldIds', def.lockFieldIds], ['columnFilter', stat.columnFilter]]) {
    if (value === undefined || (key === 'showFields' && value === 'all')) { continue; }
    if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id.trim()) || new Set(value).size !== value.length) {
      fail('INVALID_CONFIG', 'invalid_config', key);
    }
    if (key === 'showFields' && !value.length) { fail('INVALID_CONFIG', 'invalid_config', key); }
  }
  if (def.widths !== undefined && def.widths !== null) {
    assertObject(def.widths, 'widths');
    for (const width of Object.values(def.widths)) {
      if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) { fail('INVALID_CONFIG', 'invalid_config', 'widths'); }
    }
  }
  if (def.filter !== undefined) { assertObject(def.filter, 'filter'); }
  for (const key of ['values', 'operationValues']) {
    if (def.filter?.[key] !== undefined) { assertObject(def.filter[key], `filter.${key}`); }
  }
  if (def.filter?.conditionType !== undefined && !['AND', 'OR'].includes(def.filter.conditionType)) {
    fail('INVALID_CONFIG', 'invalid_config', 'filter.conditionType');
  }
  if (def.sort !== undefined && !Array.isArray(def.sort)) { fail('INVALID_CONFIG', 'invalid_config', 'sort'); }
  if (def.sort?.some(rule => !object(rule) || typeof rule.id !== 'string' || !['y', 'n'].includes(rule.isAsc))) {
    fail('INVALID_CONFIG', 'invalid_config', 'sort');
  }
  if (stat.dataRange !== undefined) { assertObject(stat.dataRange, 'dataRange'); }
  return patch;
}

function panelFields(panel) {
  if (!object(panel) || !Array.isArray(panel.componentValueVoList)) { fail('UNSUPPORTED', 'unsupported'); }
  const fields = [];
  const visit = (items, parentId) => items.forEach(item => {
    const id = item.componentId || item.id;
    if (id) { fields.push({ id, parentId, name: item.varName, componentName: item.componentName,
      supportVisible: item.supportVisible, showTerm: item.showTerm, showOrder: item.showOrder, operatorMap: item.operatorMap }); }
    if (Array.isArray(item.children)) { visit(item.children, id); }
  });
  visit(panel.componentValueVoList);
  return fields;
}

function validateFields(patch, fields) {
  const known = new Map(fields.map(field => [field.id, field]));
  const def = patch.defaultConfig || {};
  const stat = patch.staticConfig || {};
  const refs = [
    ...(Array.isArray(def.showFields) ? def.showFields : []), ...(def.lockFieldIds || []),
    ...Object.keys(def.widths || {}), ...(stat.columnFilter || []).filter(id => id !== 'all'),
    ...Object.keys(def.filter?.values || {}), ...Object.keys(def.filter?.operationValues || {}),
    ...(def.sort || []).map(rule => rule.id),
  ];
  for (const field of fields) {
    if (['CascadeDateField', 'CascadeTimeZoneDateField', 'AddressField'].includes(field.componentName)) {
      for (const suffix of ['_0', '_1']) { known.set(field.id + suffix, field); }
    }
  }
  for (const id of refs) {
    if (!known.has(id)) { fail('INVALID_CONFIG', 'invalid_config', `fieldId: ${id}`); }
  }
  for (const [id, op] of Object.entries(def.filter?.operationValues || {})) {
    const operators = known.get(id)?.operatorMap;
    if (Array.isArray(operators) && !operators.some(item => item.value === op)) {
      fail('INVALID_CONFIG', 'invalid_config', `filter.operationValues.${id}: ${op}`);
    }
  }
}

function parseArgs(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--json', '--with-config', '--replace', '--help', '-h'].includes(arg)) { flags[arg] = true; continue; }
    if (['--config', '--name', '--button', '--expected-hash', '--backup'].includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) { fail('USAGE', 'invalid_config', arg); }
      flags[arg] = args[++i];
      continue;
    }
    if (arg.startsWith('-')) { fail('USAGE', 'invalid_config', arg); }
    positional.push(arg);
  }
  if (flags['--help'] || flags['-h']) { return { help: true }; }
  const [action, appType, formUuid, viewUuid] = positional;
  if (!ACTIONS.includes(action) || !appType || !formUuid || positional.length > (VIEW_ACTIONS.includes(action) ? 4 : 3)
    || (VIEW_ACTIONS.includes(action) && !viewUuid)
    || (['save', 'order'].includes(action) && !flags['--config'])
    || (['create', 'rename'].includes(action) && !flags['--name']?.trim())
    || (action === 'rename' && flags['--name'].trim().length > 20)
    || (action === 'add-button' && !flags['--button'])) {
    fail('USAGE', 'usage');
  }
  const allowed = {
    list: ['--with-config'],
    inspect: [],
    save: ['--config', '--expected-hash', '--backup', '--replace'],
    create: ['--name', '--backup'],
    order: ['--config', '--backup'],
    rename: ['--name', '--backup'],
    'add-button': ['--button', '--expected-hash', '--backup'],
  };
  if (Object.keys(flags).some(flag => flag !== '--json' && !allowed[action].includes(flag))) { fail('USAGE', 'usage'); }
  // IDs are path segments, never URLs or traversal components.
  for (const id of [appType, formUuid, viewUuid, flags['--button']].filter(Boolean)) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) { fail('USAGE', 'invalid_config', id); }
  }
  return { action, appType, formUuid, viewUuid, flags };
}

function unwrap(response, endpoint) {
  if (!response || response.success !== true || response.__needLogin || response.__csrfExpired) {
    fail('API_ERROR', 'api_error', response?.errorMsg || response?.message || endpoint, {
      endpoint, platformErrorCode: response?.errorCode,
    });
  }
  return response.content;
}

function backup(value, filename) {
  const output = filename ? path.resolve(filename) : path.join(resolveProjectRoot().projectRoot,
    '.cache', 'openyida', 'form-view', `${Date.now()}-${crypto.randomUUID()}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
  return output;
}

async function execute(parsed, client = createYidaClient({ authRef: createAuthRef() })) {
  const { action, appType, formUuid, viewUuid, flags } = parsed;
  const prefix = `/dingtalk/web/${appType}/query/`;
  const buttonUuid = flags['--button'];
  const target = { appType, formUuid, ...(viewUuid ? { viewUuid } : {}), ...(buttonUuid ? { buttonUuid } : {}) };
  const read = async (endpoint, params) => unwrap(await client.postForm(prefix + endpoint, params), endpoint);
  const getNativeView = async () => {
    const endpoint = 'dataview/listDataViewInForm.json';
    const items = unwrap(await client.get(prefix + endpoint, { appType, formUuid }), endpoint);
    if (!Array.isArray(items)) { fail('UNSUPPORTED', 'unsupported'); }
    const matches = items.filter(item => item?.viewUuid === viewUuid && item.formUuid === formUuid);
    if (matches.length !== 1) { fail('TARGET_MISMATCH', 'target_mismatch', viewUuid); }
    const view = matches[0];
    return { ...view, name: parseJson(view.name, 'name'), status: parseJson(view.status, 'status') };
  };
  const list = async () => {
    const form = await read('formdesign/getFormSchemaInfo.json', { formUuid });
    if (!object(form) || !Array.isArray(form.multiViewInfos)) { fail('UNSUPPORTED', 'unsupported'); }
    if (form.multiViewInfos.some(view => !object(view) || typeof view.viewUuid !== 'string' || !/^[A-Za-z0-9_-]+$/.test(view.viewUuid))
      || new Set(form.multiViewInfos.map(view => view.viewUuid)).size !== form.multiViewInfos.length) { fail('UNSUPPORTED', 'unsupported'); }
    return form.multiViewInfos.map(view => ({
      ...view, name: parseJson(view.name, 'name'), status: parseJson(view.status, 'status'),
    }));
  };
  const get = async (id) => normalizeConfig(await read('dataview/getViewConfig.json', { formUuid, viewUuid: id }), id);
  const fields = async (id) => panelFields(unwrap(await client.get(prefix + 'dataview/getDataViewPanel.json', {
    formUuid, viewUuid: id, pageType: 'manage', ccMode: 'tile',
  }), 'dataview/getDataViewPanel.json'));
  const nativeView = ['rename', 'add-button'].includes(action) ? await getNativeView() : null;
  const views = nativeView ? [nativeView] : await list();
  if (viewUuid && !views.some(view => view.viewUuid === viewUuid)) { fail('TARGET_MISMATCH', 'target_mismatch', viewUuid); }
  const output = { success: true, action, ...target };
  if (action === 'list') {
    const configs = [];
    for (const view of views) {
      configs.push(flags['--with-config'] ? { ...view, config: await get(view.viewUuid) } : view);
    }
    return { ...output, views: configs, totalCount: views.length };
  }
  if (action === 'inspect') {
    const config = await get(viewUuid);
    const view = views.find(item => item.viewUuid === viewUuid);
    return { ...output, view, config, configHash: configHash(config), ...(view.viewType === 'table' ? { fields: await fields(viewUuid) } : {}) };
  }
  let params;
  let endpoint;
  let before;
  let expected;
  if (action === 'rename') {
    before = nativeView;
    if (!object(before.status)) { fail('UNSUPPORTED', 'unsupported'); }
    const { zh_CN, en_US, ja_JP } = buildYidaTitleI18n(flags['--name'].trim());
    expected = { type: 'i18n', zh_CN, en_US, ja_JP };
    const matchesName = ['zh_CN', 'en_US', 'ja_JP'].every(key => before.name?.[key] === expected[key]);
    if (matchesName && !before.name?.key) {
      return { ...output, changed: false, readbackVerified: true, view: before };
    }
    if (!isDeepStrictEqual(await getNativeView(), before)) { fail('CONFLICT', 'conflict'); }
    params = { formUuid, viewUuid, name: JSON.stringify(expected), status: JSON.stringify(before.status) };
    if (before.description !== null && before.description !== undefined) {
      params.description = typeof before.description === 'string' ? before.description : JSON.stringify(before.description);
    }
    endpoint = 'dataview/updateBaseInfo.json';
  } else if (action === 'add-button') {
    if (nativeView.viewType !== 'table') { fail('UNSUPPORTED', 'unsupported'); }
    before = await get(viewUuid);
    if (flags['--expected-hash'] && flags['--expected-hash'] !== configHash(before)) { fail('CONFLICT', 'conflict'); }
    let buttonList = before.staticConfig.buttonList ?? [];
    if (!Array.isArray(buttonList) || buttonList.some(item => !object(item))) { fail('UNSUPPORTED', 'unsupported'); }
    const dataFormUuid = nativeView.dataFormUuid || formUuid;
    const { button } = await executeCustomButton({ action: 'inspect', appType, formUuid: dataFormUuid, buttonUuid, flags: {} }, client);
    if (!object(button.name)) { fail('UNSUPPORTED', 'unsupported'); }
    if (buttonList.some(item => item.category === 'custom' && item.code === buttonUuid)) {
      return { ...output, changed: false, readbackVerified: true, config: before, configHash: configHash(before) };
    }
    if (!buttonList.length) {
      // The platform settings panel shows these system buttons when the list is empty.
      const form = await read('formdesign/getFormSchemaInfo.json', { formUuid: dataFormUuid });
      const formType = form?.formType || form?.pageType;
      if (!['receipt', 'process'].includes(formType)) { fail('UNSUPPORTED', 'unsupported'); }
      const codes = formType === 'process' ? ['detail', 'delete', 'log', 'var'] : ['detail', 'delete'];
      buttonList = codes.map(code => ({ code, category: 'system', name: { type: 'i18n', ...SYSTEM_BUTTON_NAMES[code] } }));
    }
    const name = Object.fromEntries(['type', 'key', 'value', 'zh_CN', 'en_US', 'ja_JP']
      .filter(key => button.name[key] !== null && button.name[key] !== undefined)
      .map(key => [key, button.name[key]]));
    expected = {
      staticConfig: { ...before.staticConfig, buttonList: [...buttonList, { code: buttonUuid, category: 'custom', name }] },
      defaultConfig: before.defaultConfig,
    };
    if (configHash(await get(viewUuid)) !== configHash(before)) { fail('CONFLICT', 'conflict'); }
    params = { formUuid, viewUuid, staticConfig: JSON.stringify(expected.staticConfig) };
    endpoint = 'dataview/updateConfig.json';
  } else if (action === 'save') {
    if (views.find(view => view.viewUuid === viewUuid).viewType !== 'table') { fail('UNSUPPORTED', 'unsupported'); }
    const patch = validatePatch(parseJson(fs.readFileSync(flags['--config'], 'utf8'), 'config'));
    if (flags['--replace'] && (!patch.staticConfig || !patch.defaultConfig || !flags['--expected-hash'])) {
      fail('INVALID_CONFIG', 'invalid_config', '--replace requires staticConfig, defaultConfig, --expected-hash');
    }
    validateFields(patch, await fields(viewUuid));
    before = await get(viewUuid);
    if (flags['--expected-hash'] && flags['--expected-hash'] !== configHash(before)) { fail('CONFLICT', 'conflict'); }
    expected = {
      staticConfig: flags['--replace'] ? patch.staticConfig : merge(before.staticConfig, patch.staticConfig || {}),
      defaultConfig: flags['--replace'] ? { ...patch.defaultConfig } : merge(before.defaultConfig, patch.defaultConfig || {}),
    };
    delete expected.defaultConfig.latestUpdateTime;
    // Validate the patch, while preserving platform-owned or legacy settings as read.
    if (Array.isArray(expected.defaultConfig.showFields) && expected.defaultConfig.lockFieldIds?.some(id => !expected.defaultConfig.showFields.includes(id))) {
      fail('INVALID_CONFIG', 'invalid_config', 'lockFieldIds / showFields');
    }
    if (Array.isArray(expected.staticConfig.columnFilter) && !expected.staticConfig.columnFilter.includes('all')
      && Array.isArray(expected.defaultConfig.showFields)
      && expected.defaultConfig.showFields.some(id => !expected.staticConfig.columnFilter.includes(id))) {
      fail('INVALID_CONFIG', 'invalid_config', 'columnFilter / showFields');
    }
    if (isDeepStrictEqual(writableConfig(expected), writableConfig(before))) {
      return { ...output, changed: false, readbackVerified: true, config: before, configHash: configHash(before) };
    }
    // Re-read immediately before writing; the platform has no compare-and-swap API.
    if (configHash(await get(viewUuid)) !== configHash(before)) { fail('CONFLICT', 'conflict'); }
    params = { formUuid, viewUuid, staticConfig: JSON.stringify(expected.staticConfig), defaultConfig: JSON.stringify(expected.defaultConfig) };
    endpoint = 'dataview/updateConfig.json';
  } else if (action === 'order') {
    expected = parseJson(fs.readFileSync(flags['--config'], 'utf8'), 'order');
    const ids = views.map(view => view.viewUuid);
    if (!Array.isArray(expected) || expected.length !== ids.length || new Set(expected).size !== ids.length || expected.some(id => !ids.includes(id))) {
      fail('INVALID_CONFIG', 'invalid_config', 'order');
    }
    before = ids;
    if (isDeepStrictEqual(before, expected)) { return { ...output, changed: false, views, readbackVerified: true }; }
    if (!isDeepStrictEqual((await list()).map(view => view.viewUuid), before)) { fail('CONFLICT', 'conflict'); }
    params = { formUuid, viewConfig: JSON.stringify(expected) };
    endpoint = 'dataview/updateViewPageConfig.json';
  } else {
    expected = flags['--name'].trim();
    before = views;
    params = { formUuid, dataFormUuid: formUuid, viewType: 'table', name: JSON.stringify(buildYidaTitleI18n(expected)),
      status: JSON.stringify({ PC: 'ACTIVATED', MOBILE: 'ACTIVATED' }) };
    endpoint = 'dataview/createView.json';
  }
  const backupPath = backup({ ...target, action, config: before }, flags['--backup']);
  const mutationDetails = { target, backupPath, retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true };
  try {
    // Never replay a mutation automatically after transport failure or auth refresh.
    unwrap(await client.postFormOnce(prefix + endpoint, params), endpoint);
  } catch (error) {
    throw new CliError(error.message, { code: error.code || 'FORM_VIEW_WRITE_FAILED', details: mutationDetails });
  }
  try {
    if (action === 'rename') {
      const view = await getNativeView();
      if (!['zh_CN', 'en_US', 'ja_JP'].every(key => view.name?.[key] === expected[key])
        || !isDeepStrictEqual(view.status, before.status)
        || !isDeepStrictEqual(view.description ?? null, before.description ?? null)) {
        fail('READBACK_MISMATCH', 'readback_mismatch');
      }
      return { ...output, changed: true, backupPath, readbackVerified: true, view };
    }
    if (action === 'save' || action === 'add-button') {
      const config = await get(viewUuid);
      const comparable = action === 'add-button' ? comparableButtonConfig : writableConfig;
      if (!isDeepStrictEqual(stable(comparable(expected)), stable(comparable(config)))) {
        fail('READBACK_MISMATCH', 'readback_mismatch');
      }
      return { ...output, changed: true, backupPath, readbackVerified: true, config, configHash: configHash(config) };
    }
    const after = await list();
    if (action === 'order' && !isDeepStrictEqual(after.map(view => view.viewUuid), expected)) { fail('READBACK_MISMATCH', 'readback_mismatch'); }
    if (action === 'create') {
      const added = after.filter(view => !before.some(old => old.viewUuid === view.viewUuid));
      if (added.length !== 1 || !Object.values(added[0].name || {}).includes(expected)) { fail('READBACK_MISMATCH', 'readback_mismatch'); }
      return { ...output, viewUuid: added[0].viewUuid, view: added[0], backupPath, readbackVerified: true };
    }
    return { ...output, views: after, backupPath, readbackVerified: true };
  } catch (error) {
    throw new CliError(error.message, { code: error.code || 'FORM_VIEW_READBACK_FAILED',
      details: { ...mutationDetails, mutationAccepted: true, sideEffectState: 'accepted_unverified' } });
  }
}

async function run(args, options = {}) {
  const parsed = parseArgs(args);
  if (parsed.help) { process.stdout.write(t('form_view.usage') + '\n'); return; }
  let result;
  try { result = await execute(parsed, options.client); }
  catch (error) {
    if (error.isCliError) { throw error; }
    throw new CliError(error.message, { code: 'FORM_VIEW_FAILED' });
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

module.exports = { run, execute, parseArgs, normalizeConfig, configHash, merge, validatePatch };
