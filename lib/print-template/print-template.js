'use strict';

const { isDeepStrictEqual } = require('util');
const { t } = require('../core/i18n');
const { CliError } = require('../core/cli-error');
const { createYidaClient } = require('../core/yida-client');
const { buildYidaTitleI18n } = require('../core/yida-i18n');
const m = require('./model');
const builder = require('./builder');
const codes = require('./codes');
const scenes = require('./scenes');
const detail = require('./detail');

const ACTIONS = ['list', 'inspect', 'fields', 'build', 'create', 'copy', 'save', 'restore', 'settings', 'status', 'order', 'render', 'files'];
const TARGETED = ['inspect', 'copy', 'save', 'restore', 'settings', 'status', 'render'];
const HASHED = ['copy', 'save', 'restore', 'settings', 'status'];
const OPTIONS = {
  list: ['--instance', '--detail-url'], inspect: ['--out'], fields: ['--out'], build: ['--config', '--scene', '--bindings', '--out'], create: ['--name', '--config', '--backup'],
  copy: ['--name', '--expected-hash', '--backup'], save: ['--config', '--expected-hash', '--backup'],
  restore: ['--config', '--expected-hash', '--backup'], settings: ['--config', '--expected-hash', '--backup', '--allow-permission-change'],
  status: ['--status', '--expected-hash', '--backup'], order: ['--config', '--expected-hash', '--backup'],
  render: ['--instance', '--detail-url', '--template-id'], files: ['--page', '--size'],
};

/** Parse exact command contracts before auth or remote access. */
function parseArgs(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (Object.hasOwn(flags, arg)) { m.fail('USAGE', arg); }
    if (['--json', '--help', '-h', '--allow-permission-change'].includes(arg)) { flags[arg] = true; continue; }
    if (Object.values(OPTIONS).flat().includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith('-')) { m.fail('USAGE', arg); }
      flags[arg] = args[++i]; continue;
    }
    if (arg.startsWith('-')) { m.fail('USAGE', arg); }
    positional.push(arg);
  }
  if (flags['--help'] || flags['-h']) { return { help: true }; }
  if (flags['--detail-url']) {
    if (!['list', 'render'].includes(positional[0]) || positional.length !== 1 || flags['--instance']) { m.fail('USAGE', '--detail-url: list/render only, without positional target'); }
    const resolved = detail.parse(flags['--detail-url']);
    positional.push(resolved.appType, resolved.formUuid);
    if (positional[0] === 'render') { positional.push(flags['--template-id']); }
    flags['--instance'] = resolved.instance;
  } else if (flags['--template-id']) { m.fail('USAGE', '--template-id requires --detail-url'); }
  const [action, appType, formUuid, templateId] = positional;
  if (!ACTIONS.includes(action) || positional.length !== (TARGETED.includes(action) ? 4 : 3)
    || !/^APP_[A-Za-z0-9_-]+$/.test(appType || '') || !/^[A-Za-z0-9_-]+$/.test(formUuid || '')
    || TARGETED.includes(action) && !/^(0|[1-9]\d*)$/.test(templateId || '')
    || Object.keys(flags).some(key => key !== '--json' && !OPTIONS[action].includes(key))) { m.fail('USAGE', t('print_template.usage')); }
  if (['save', 'restore', 'settings', 'order'].includes(action) && !flags['--config']
    || action === 'build' && (Boolean(flags['--config']) === Boolean(flags['--scene']) || flags['--bindings'] && !flags['--scene']
      || flags['--scene'] && !scenes.names.includes(flags['--scene']))
    || ['create', 'copy'].includes(action) && !flags['--name']?.trim()
    || (HASHED.includes(action) || action === 'order') && !/^[a-f0-9]{64}$/.test(flags['--expected-hash'] || '')
    || action === 'status' && !['START', 'STOP'].includes(flags['--status'])
    || (action === 'render' || flags['--instance']) && !/^[A-Za-z0-9_-]+$/.test(flags['--instance'] || '')) { m.fail('USAGE', t('print_template.usage')); }
  for (const [key, max] of [['--page', 100000], ['--size', 100]]) {
    if (flags[key] !== undefined && (!/^[1-9]\d*$/.test(flags[key]) || Number(flags[key]) > max)) { m.fail('USAGE', key); }
  }
  if (['create', 'copy'].includes(action)) {
    const name = flags['--name'].trim();
    if ([...name].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 127 ? 2 : 1), 0) > 40) { m.fail('INVALID_CONFIG', 'name: max 40 characters / 20 Chinese characters'); }
  }
  return { action, appType, formUuid, templateId, flags };
}

/** Validate a metadata-only patch, preserving translations and permission scope by default. */
function settings(base, raw, allowPermissions) {
  const allowed = ['title', 'description', 'fileNameConfig', 'roleData'];
  if (!m.object(raw) || !Object.keys(raw).length || Object.keys(raw).some(key => !allowed.includes(key))) { m.fail('INVALID_CONFIG', allowed.join(', ')); }
  const result = {};
  for (const key of ['title', 'description']) {
    if (!Object.hasOwn(raw, key)) { continue; }
    const value = typeof raw[key] === 'string' ? { zh_CN: raw[key], en_US: raw[key] } : raw[key];
    if (!m.object(value) || Object.values(value).some(item => item !== null && typeof item !== 'string')
      || key === 'title' && !value.zh_CN?.trim()) { m.fail('INVALID_CONFIG', key); }
    result[key] = { ...(m.object(base[key]) ? base[key] : {}), ...value };
    if (key === 'title' && [...result[key].zh_CN].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 127 ? 2 : 1), 0) > 40) { m.fail('INVALID_CONFIG', 'title length'); }
  }
  if (Object.hasOwn(raw, 'description') && !Object.hasOwn(raw, 'title')) { result.title = base.title; }
  // The native rename endpoint also replaces description; preserve its sibling.
  if (Object.hasOwn(raw, 'title') && !Object.hasOwn(raw, 'description')) { result.description = base.description; }
  if (Object.hasOwn(raw, 'fileNameConfig')) {
    if (typeof raw.fileNameConfig !== 'string' || !raw.fileNameConfig.trim() || raw.fileNameConfig.length > 256
      || /#|\$[^!]|\$!(?!\{(?:originator|instanceTitle|createTime|serialNo)\})/.test(raw.fileNameConfig)) {
      m.fail('INVALID_CONFIG', 'fileNameConfig: use $!{originator}, $!{instanceTitle}, $!{createTime}, $!{serialNo}');
    }
    result.fileNameConfig = raw.fileNameConfig;
  }
  if (Object.hasOwn(raw, 'roleData')) {
    if (!allowPermissions) { m.fail('PERMISSION_FLAG_REQUIRED', '--allow-permission-change'); }
    if (!Array.isArray(raw.roleData) || !raw.roleData.length || raw.roleData.some(role => !m.object(role) || typeof role.roleType !== 'string' || typeof role.roleValue !== 'string'
      || Object.keys(role).some(key => !['roleUuid', 'roleType', 'roleValue', 'isExclude'].includes(key)))) {
      m.fail('INVALID_CONFIG', 'native roleData');
    }
    result.roleData = raw.roleData;
  }
  return result;
}

/** Execute native print operations with exclusive backups, stale-edit checks and no write replay. */
async function execute(parsed, client = createYidaClient(), preparedContent) {
  const { action, appType, formUuid, templateId, flags } = parsed;
  const detailTarget = flags['--detail-url'] ? detail.parse(flags['--detail-url']) : null;
  if (detailTarget) { detail.verifyOrigin(detailTarget, client); }
  const prefix = `/dingtalk/web/${appType}/query/printTemplate/`;
  const target = { appType, formUuid, ...(templateId ? { templateId } : {}) };
  const read = async (endpoint, params = {}) => m.unwrap(await client.get(prefix + endpoint + '.json', { formUuid, ...params }), endpoint);
  const mutate = async (endpoint, params) => m.unwrap(await client.postFormOnce(prefix + endpoint + '.json', { formUuid, ...params }), endpoint);
  const list = async (instance) => {
    const raw = await read(instance ? 'listTemplateWithAuth' : 'listTemplate', instance ? { formInstId: instance } : {});
    if (!Array.isArray(raw) || raw.some(item => !m.object(item) || !/^(0|[1-9]\d*)$/.test(String(item.templateId)) || item.formUuid !== formUuid)
      || new Set(raw.map(item => String(item.templateId))).size !== raw.length) { m.fail('INVALID_RESPONSE', 'template list'); }
    return raw.map(item => ({ ...item, templateId: String(item.templateId), title: m.json(item.title, 'title') || {}, description: m.json(item.description, 'description') || {} }));
  };
  const snapshot = async id => {
    const template = (await list()).find(item => item.templateId === id);
    if (!template) { m.fail('NOT_FOUND', id); }
    if (!['', 'DEFAULT', 'CUSTOM', null, undefined].includes(template.templateType)) { m.fail('UNSUPPORTED', `templateType: ${template.templateType}`); }
    const body = id === '0' ? {} : await read('queryTemplateById', { templateId: id });
    const result = { appType, formUuid, templateId: id, template, content: m.content(body) };
    return { ...result, configHash: m.hash(result) };
  };
  const getFields = async () => {
    const [dictionary, codeCapability] = await Promise.all([
      read('listDictionarys', { ccMode: 'tile' }), codes.capabilities(client),
    ]);
    return builder.fields(dictionary, codeCapability);
  };
  const output = { action, ...target };
  if (action === 'list') {
    const templates = await list(flags['--instance']);
    return { ...output, templates, ...(flags['--instance'] ? { instance: flags['--instance'], authorizationScoped: true }
      : { orderHash: m.hash({ template: templates, content: null }) }) };
  }
  if (action === 'fields') {
    const result = { ...output, fields: await getFields() };
    if (flags['--out']) { result.outputPath = m.write(result, flags['--out'], 'fields'); }
    return result;
  }
  if (action === 'build') {
    const source = flags['--scene'] ? scenes.document(flags['--scene'], flags['--bindings'] ? m.read(flags['--bindings']) : {}) : m.read(flags['--config']);
    const config = builder.compile(source, await getFields());
    const result = { ...output, config, saved: false, ...(flags['--scene'] ? { scene: flags['--scene'], document: source.document } : {}) };
    if (flags['--out']) { result.outputPath = m.write(config, flags['--out'], 'built'); }
    return result;
  }
  if (action === 'files') {
    const result = m.unwrap(await client.get(`/dingtalk/web/${appType}/query/attach/list.json`, {
      formUuid, currentPage: flags['--page'] || '1', pageSize: flags['--size'] || '50', source: 'PRINT',
    }), 'attach/list');
    if (!m.object(result) || !Array.isArray(result.data) || !Number.isFinite(result.totalCount)) { m.fail('INVALID_RESPONSE', 'print file list'); }
    return { ...output, files: result };
  }
  // Validate content before creating anything. A later save failure must retain the created ID.
  const initialContent = action === 'create' && flags['--config'] ? builder.compile(m.read(flags['--config']), await getFields()) : null;
  let before;
  if (action === 'render') {
    const available = await list(flags['--instance']);
    const template = available.find(item => item.templateId === templateId && item.status !== 'STOP');
    if (!template) { m.fail('NOT_FOUND', 'template unavailable for this record'); }
    if (!['', 'DEFAULT', 'CUSTOM', null, undefined].includes(template.templateType)) { m.fail('UNSUPPORTED', `templateType: ${template.templateType}`); }
    before = { ...target, instance: flags['--instance'], template, authorizationScoped: true };
  } else {
    before = action === 'create' || action === 'order' ? { appType, formUuid, templates: await list() } : await snapshot(templateId);
  }
  if (action === 'inspect') {
    if (flags['--out']) { before = { ...before, outputPath: m.write(before, flags['--out'], 'export') }; }
    return { ...output, ...before };
  }
  const expectedHash = action === 'order' ? m.hash({ template: before.templates, content: null }) : before.configHash;
  if ((HASHED.includes(action) || action === 'order') && flags['--expected-hash'] !== expectedHash) { m.fail('STALE_CONFIG', 'inspect again'); }
  if (['save', 'restore'].includes(action) && (templateId === '0' || before.template.templateType === 'DEFAULT')) { m.fail('UNSUPPORTED', 'built-in default body'); }
  let endpoint;
  let params;
  let expected;
  if (action === 'save' || action === 'restore') {
    let input = preparedContent || m.read(flags['--config']);
    if (action === 'restore') {
      if (input.appType !== appType || input.formUuid !== formUuid || String(input.templateId) !== templateId || !m.object(input.content)) { m.fail('TARGET_MISMATCH', 'backup target'); }
      input = Object.fromEntries(['termContents', 'termJsonAttr', 'dictionaryList'].map(key => [key, input.content[key]]));
    }
    expected = builder.compile(input, await getFields());
    endpoint = 'saveTemplate';
    params = { templateId, termContents: expected.termContents, termJsonAttr: JSON.stringify(expected.termJsonAttr), dictionaryList: JSON.stringify(expected.dictionaryList) };
    const modified = before.content.gmtModified;
    if (modified !== null && modified !== undefined) {
      const stamp = typeof modified === 'number' || /^\d+$/.test(String(modified)) ? Number(modified) : Date.parse(modified);
      if (!Number.isFinite(stamp)) { m.fail('INVALID_RESPONSE', 'gmtModified'); }
      params.gmtModified = String(stamp);
    }
  } else if (action === 'settings') {
    expected = settings(before.template, m.read(flags['--config']), flags['--allow-permission-change']);
    if (templateId === '0' && Object.keys(expected).some(key => key !== 'roleData')) { m.fail('UNSUPPORTED', 'default template settings: roleData only'); }
    endpoint = 'updatePrintBaseInfo';
    params = { templateId, ...Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])) };
  } else if (action === 'status') {
    expected = flags['--status']; endpoint = 'savePrintTemplateStatus'; params = { templateId, status: expected };
  } else if (action === 'order') {
    expected = m.read(flags['--config']);
    if (!Array.isArray(expected)) { m.fail('INVALID_CONFIG', 'template ID array'); }
    expected = expected.map(String);
    if (expected.length !== before.templates.length || new Set(expected).size !== expected.length || expected.some(id => !before.templates.some(item => item.templateId === id))) { m.fail('INVALID_CONFIG', 'include every template exactly once'); }
    endpoint = 'savePrintTemplateOrder'; params = { templateIdList: JSON.stringify(expected.map(Number)) };
  } else if (action === 'create' || action === 'copy') {
    endpoint = action === 'create' ? 'createTemplate' : 'copyTemplateIndependently';
    expected = flags['--name'].trim();
    params = { title: JSON.stringify(buildYidaTitleI18n(expected)), description: JSON.stringify(buildYidaTitleI18n('')),
      ...(action === 'copy' ? { originTemplateId: templateId } : {}) };
  } else if (action === 'render') {
    endpoint = 'print'; params = { ...(templateId === '0' ? {} : { templateId }), formInstId: flags['--instance'],
      templateType: templateId === '0' ? 'DEFAULT' : 'CUSTOM', ...(detailTarget?.activityId ? { activityId: detailTarget.activityId } : {}) };
  }
  const backupPath = m.write({ ...before, action }, flags['--backup']);
  const details = { target, backupPath, retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true };
  let accepted;
  try { accepted = await mutate(endpoint, params); }
  catch (error) { throw new CliError(error.message, { code: error.code || 'PRINT_TEMPLATE_WRITE_FAILED', details: { ...error.details, ...details } }); }
  try {
    if (action === 'render') {
      if (!/^[1-9]\d*$/.test(String(accepted))) { m.fail('INVALID_RESPONSE', 'print file ID'); }
      return { ...output, instance: flags['--instance'], authorizationScoped: true, backupPath, fileId: String(accepted), generationRequested: true, fileReadyVerified: false };
    }
    if (action === 'order') {
      const after = await list();
      if (!isDeepStrictEqual(after.map(item => item.templateId), expected)) { m.fail('READBACK_MISMATCH', action); }
      return { ...output, backupPath, templates: after, readbackVerified: true };
    }
    let id = templateId;
    if (action === 'create' || action === 'copy') {
      id = String(accepted);
      if (!/^[1-9]\d*$/.test(id)) { m.fail('INVALID_RESPONSE', 'new template ID'); }
      details.createdTemplateId = id;
    }
    let after = await snapshot(id);
    if (action === 'copy' && before.content.dictionaryList.length && !after.content.dictionaryList.length
      && before.content.termContents === after.content.termContents
      && isDeepStrictEqual(m.stable(before.content.termJsonAttr), m.stable(after.content.termJsonAttr))) {
      // Native copy can omit the dictionary. Complete this specific known partial
      // result once, preserving the new target's concurrency token and backup.
      const copyBackupPath = m.write(after);
      details.copyBackupPath = copyBackupPath;
      details.createdTemplateId = id;
      const native = builder.validateNative(before.content, await getFields());
      const stamp = after.content.gmtModified;
      await mutate('saveTemplate', { templateId: id, termContents: native.termContents,
        termJsonAttr: JSON.stringify(native.termJsonAttr), dictionaryList: JSON.stringify(native.dictionaryList),
        ...(stamp !== null && stamp !== undefined ? { gmtModified: String(stamp) } : {}) });
      after = await snapshot(id);
    }
    if (['save', 'restore'].includes(action) && !m.matches(expected, after.content)) { m.fail('READBACK_MISMATCH', action); }
    if (action === 'status' && after.template.status !== expected) { m.fail('READBACK_MISMATCH', action); }
    if (['create', 'copy'].includes(action) && m.label(after.template.title) !== expected) { m.fail('READBACK_MISMATCH', 'title'); }
    if (action === 'create' && initialContent) {
      try {
        const saved = await execute({ action: 'save', appType, formUuid, templateId: id,
          flags: { '--config': flags['--config'], '--expected-hash': after.configHash } }, client, initialContent);
        return { ...saved, action, created: true, contentSaved: true, createBackupPath: backupPath };
      } catch (error) {
        details.contentSaveDetails = error.details;
        throw error;
      }
    }
    if (action === 'copy' && !isDeepStrictEqual(m.stable(Object.fromEntries(['termContents', 'termJsonAttr', 'dictionaryList'].map(key => [key, before.content[key]]))),
      m.stable(Object.fromEntries(['termContents', 'termJsonAttr', 'dictionaryList'].map(key => [key, after.content[key]]))))) { m.fail('READBACK_MISMATCH', 'copied content'); }
    if (action === 'settings') {
      for (const [key, value] of Object.entries(expected)) {
        const saved = after.template[key];
        if (key === 'roleData') {
          const members = after.template.roleMembers;
          if (!Array.isArray(members) || value.some(role => {
            const member = members.find(item => item.roleType === role.roleType);
            return !member || member.roleValue.map(item => item.key).sort().join(',') !== role.roleValue.split(',').sort().join(',')
              || role.isExclude !== undefined && String(role.isExclude) !== String(member.isExclude ?? '');
          }) || members.some(member => !value.some(role => role.roleType === member.roleType) && member.roleValue?.some(item => item.key && item.key !== 'n'))) { m.fail('READBACK_MISMATCH', key); }
          continue;
        }
        if (['title', 'description'].includes(key)) {
          if (Object.keys(value).some(locale => locale !== 'pureEn_US' && String(value[locale] ?? '') !== String(saved?.[locale] ?? ''))) { m.fail('READBACK_MISMATCH', key); }
        } else if (!isDeepStrictEqual(m.stable(value), m.stable(saved))) { m.fail('READBACK_MISMATCH', key); }
      }
    }
    return { ...output, ...after, backupPath, ...(details.copyBackupPath ? { copyBackupPath: details.copyBackupPath } : {}), readbackVerified: true };
  } catch (error) {
    throw new CliError(error.message, { code: error.code || 'PRINT_TEMPLATE_READBACK_FAILED',
      details: { ...error.details, ...details, mutationAccepted: true, acceptedResult: accepted, sideEffectState: 'accepted_unverified' } });
  }
}

/** CLI entry: JSON receipts share the same execution path as programmatic calls. */
async function run(args, options = {}) {
  const parsed = parseArgs(args);
  if (parsed.help) { process.stdout.write(t('print_template.usage') + '\n'); return; }
  const result = await execute(parsed, options.client);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

module.exports = { run, execute, parseArgs, settings };
