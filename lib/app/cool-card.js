'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { createAuthRef, createYidaClient } = require('../core/yida-client');
const { inferEnvironmentNameFromUrl } = require('../core/env-manager');
const { buildApplicationSettingsUrls } = require('./application-entry-urls');

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validApp = value => /^APP_[A-Za-z0-9_-]+$/.test(value || '');
const validCard = value => /^form[A-Za-z0-9_-]+$/.test(value || '');
const validType = value => ['im', 'onebox'].includes(value);
const capabilities = Object.freeze({ create: true, read: true, templates: true, save: false, publish: false, send: false });

function fail(code, message, details) {
  throw new CliError(t('cool_card.failed', message), { code: `COOL_CARD_${code}`, details });
}
function parseArgs(args = []) {
  const positional = [], flags = {};
  const allowed = {
    list: ['--type', '--page', '--size', '--search'],
    templates: ['--type', '--page', '--size', '--search'],
    create: ['--type', '--name', '--out'], get: ['--out'],
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--help', '-h'].includes(arg)) { return { help: true }; }
    if (arg === '--json' || ['--type', '--name', '--out', '--page', '--size', '--search'].includes(arg)) {
      if (Object.hasOwn(flags, arg)) { fail('USAGE', t('cool_card.usage')); }
      if (arg === '--json') { flags[arg] = true; }
      else {
        if (!args[i + 1] || args[i + 1].startsWith('-')) { fail('USAGE', t('cool_card.usage')); }
        flags[arg] = args[++i];
      }
    } else if (arg.startsWith('-')) { fail('USAGE', t('cool_card.usage')); }
    else { positional.push(arg); }
  }
  const [action, appType, cardPageCode] = positional;
  if (!allowed[action] || !validApp(appType) || positional.length !== (action === 'get' ? 3 : 2)
    || (cardPageCode && !validCard(cardPageCode))
    || Object.keys(flags).some(key => key !== '--json' && !allowed[action].includes(key))
    || (flags['--type'] !== undefined && !validType(flags['--type']))
    || (['create', 'templates'].includes(action) && !validType(flags['--type']))
    || (action === 'create' && !flags['--name']?.trim())) { fail('USAGE', t('cool_card.usage')); }
  for (const [flag, max] of [['--page', 1000], ['--size', 100]]) {
    if (flags[flag] !== undefined && (!/^\d+$/.test(flags[flag]) || +flags[flag] < 1 || +flags[flag] > max)) {
      fail('USAGE', t('cool_card.usage'));
    }
  }
  return { action, appType, cardPageCode, flags };
}
function unwrap(response, endpoint) {
  if (response?.success !== true || response.__needLogin || response.__csrfExpired) {
    fail('API_ERROR', response?.errorMsg || response?.message || endpoint, { endpoint, platformErrorCode: response?.errorCode });
  }
  return response.content;
}
function parseObject(value, label) {
  let result = value;
  if (typeof value === 'string') {
    try { result = JSON.parse(value); } catch { fail('INVALID_RESPONSE', label); }
  }
  if (!object(result)) { fail('INVALID_RESPONSE', label); }
  return result;
}
function validateCard(card, appType, cardPageCode) {
  if (!object(card) || card.appId !== appType || !validCard(card.cardPageCode)
    || (cardPageCode && card.cardPageCode !== cardPageCode) || !validType(card.cardType)) {
    fail('TARGET_MISMATCH', cardPageCode || appType);
  }
  return card;
}
function decodeCard(card) {
  // New blank resources can have no template yet. Do not call that a completed configuration.
  const template = card.cardSchema ? parseObject(card.cardSchema, 'cardSchema') : null;
  const editorData = template?.editorData ? parseObject(template.editorData, 'editorData') : null;
  if (editorData?.schema?.componentsTree !== undefined && !Array.isArray(editorData.schema.componentsTree)) {
    fail('INVALID_RESPONSE', 'componentsTree');
  }
  const components = new Set();
  const visit = node => {
    if (!object(node)) { return; }
    if (typeof node.componentName === 'string') { components.add(node.componentName); }
    if (Array.isArray(node.children)) { node.children.forEach(visit); }
  };
  (editorData?.schema?.componentsTree || []).forEach(visit);
  return { template, editorData, components: [...components].sort(), variableList: editorData?.variableList || [],
    templateIdsMatch: template?.templateId ? template.templateId === card.cardTemplateId : null,
    publishStatus: template?.publishStatus || null };
}
function cardUrls(appType, card, baseUrl) {
  const settings = buildApplicationSettingsUrls({ appType, baseUrl });
  if (!settings.coolCardManageUrl) { fail('INVALID_TARGET', 'baseUrl'); }
  // Link to the official editor; this command does not establish its DingTalk session.
  const templateId = card.cardTemplateId;
  const editorUrl = /(^|\.)aliwork\.com$/.test(new URL(baseUrl).hostname) && /^[A-Za-z0-9-]+$/.test(templateId || '')
    ? `https://editor.dingtalk.com/editor?templateId=${encodeURIComponent(templateId)}&scene=yida_card&bizId=${encodeURIComponent(`${appType}.${card.cardPageCode}`)}#/` : null;
  return { coolCardManageUrl: settings.coolCardManageUrl, editorUrl };
}
function userHandoff(action, appType, card, urls) {
  // Existing cards enter through management so the platform can prepare the editable version.
  const directEditor = action === 'create' && urls.editorUrl;
  return { actor: 'user', action: action === 'create' ? 'configure-and-save' : 'review-or-edit',
    target: directEditor ? 'official-editor' : 'cool-card-management',
    url: directEditor || urls.coolCardManageUrl,
    verificationCommand: `openyida cool-card get ${appType} ${card.cardPageCode} --json` };
}
function exportFile(filename, snapshot) {
  const output = path.resolve(filename);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: 'wx' });
  return output;
}
async function execute(parsed, client) {
  // Revalidate programmatic callers before auth or any network operation.
  const flags = parsed.flags || {};
  const argv = [parsed.action, parsed.appType, ...(parsed.cardPageCode ? [parsed.cardPageCode] : [])];
  for (const [key, value] of Object.entries(flags)) { argv.push(key, ...(value === true ? [] : [value])); }
  const checked = parseArgs(argv);
  if (checked.help) { fail('USAGE', t('cool_card.usage')); }
  const { action, appType } = checked;
  let { cardPageCode } = checked;
  if (flags['--out'] && fs.existsSync(path.resolve(flags['--out']))) { fail('OUTPUT_EXISTS', flags['--out']); }
  client = client || createYidaClient({ authRef: createAuthRef() });
  // Use the authenticated target, not a global environment preference, before creating any resource.
  if (action === 'create' && inferEnvironmentNameFromUrl(client.getAuthRef().baseUrl) === 'alibaba') {
    fail('UNSUPPORTED_ENVIRONMENT', t('cool_card.unsupported_environment'), { environment: 'alibaba' });
  }
  const prefix = `/${appType}/query/cardDesign/`;
  const get = async (name, params) => unwrap(await client.get(prefix + name + '.json', params), name);
  const base = { success: true, action, appType, resourceType: 'native-cool-card', capabilities };
  if (['list', 'templates'].includes(action)) {
    const content = await get(action === 'list' ? 'listCards' : 'listTpls', {
      cardType: flags['--type'] || '', currentPage: +(flags['--page'] || 1), pageSize: +(flags['--size'] || 50),
      searchName: flags['--search'] || '', ...(action === 'list' ? { excludeOfficialCard: false } : {}),
    });
    if (!object(content) || !Array.isArray(content.data) || !Number.isFinite(+content.totalCount) || +content.totalCount < 0) {
      fail('INVALID_RESPONSE', action);
    }
    // Template catalog entries may be owned by a different application; listing does not grant mutation rights.
    const data = content.data.map(card => {
      if (action === 'list') { validateCard(card, appType); }
      return Object.fromEntries(Object.entries(card).filter(([key]) => !['cardSchema', 'variableConfig'].includes(key)));
    });
    return { ...content, ...base, data };
  }
  let created;
  let listedCard;
  if (action === 'create') {
    // Allowlist the complete write body. No entitlements, app tags, official-card switches or send options.
    created = unwrap(await client.postFormOnce(prefix + 'createCard.json', {
      cardName: flags['--name'], cardType: flags['--type'],
    }), 'createCard');
    try { validateCard(created, appType); }
    catch (error) {
      error.details = { ...error.details, mutationAccepted: true, inspectBeforeRetry: true, appType,
        ...(validCard(created?.cardPageCode) ? { cardPageCode: created.cardPageCode } : {}) };
      throw error;
    }
    cardPageCode = created.cardPageCode;
    try {
      const list = await get('listCards', { cardType: flags['--type'], currentPage: 1, pageSize: 100,
        searchName: flags['--name'], excludeOfficialCard: false });
      listedCard = Array.isArray(list?.data) ? list.data.find(item => item?.cardPageCode === cardPageCode) : null;
      validateCard(listedCard, appType, cardPageCode);
      if (listedCard.cardName !== flags['--name'] || listedCard.cardType !== flags['--type']) { fail('READBACK_MISMATCH', cardPageCode); }
    } catch (error) {
      error.details = { ...error.details, appType, cardPageCode, resourceCreated: true, inspectBeforeRetry: true };
      throw error;
    }
  }
  let card;
  try {
    card = validateCard(await get('getCardSchema', { cardAppId: appType, cardPageCode }), appType, cardPageCode);
  } catch (error) {
    if (!created) { throw error; }
    // A real newly-created resource may have a template ID before that template exists.
    // Verify its resource metadata independently; retain the failed schema read rather than inventing an empty schema.
    const urls = cardUrls(appType, listedCard, client.getAuthRef().baseUrl);
    const result = { ...base, cardPageCode, card: listedCard, completion: 'resource-only', readbackVerified: true,
      schemaReadbackVerified: false, configurationVerified: false, deliveryVerified: false,
      schemaReadbackError: { code: error.code || 'READ_FAILED', message: error.message, details: error.details },
      urls, nextAction: userHandoff(action, appType, listedCard, urls) };
    if (flags['--out']) { result.snapshotFile = exportFile(flags['--out'], { ...result }); }
    return result;
  }
  try {
    if (created && (card.cardType !== flags['--type'] || card.cardName !== flags['--name'])) { fail('READBACK_MISMATCH', cardPageCode); }
    const decoded = decodeCard(card);
    const snapshot = { resourceType: base.resourceType, appType, cardPageCode, card };
    const configHash = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const urls = cardUrls(appType, card, client.getAuthRef().baseUrl);
    const result = { ...base, cardPageCode, card, ...decoded, configHash,
      readbackVerified: true, schemaReadbackVerified: decoded.template !== null,
      ...(decoded.template ? {} : { completion: 'resource-only' }), configurationVerified: false, deliveryVerified: false,
      urls, nextAction: userHandoff(action, appType, card, urls) };
    if (flags['--out']) { result.snapshotFile = exportFile(flags['--out'], snapshot); }
    return result;
  } catch (error) {
    if (created) { error.details = { ...error.details, appType, cardPageCode, resourceCreated: true, inspectBeforeRetry: true }; }
    throw error;
  }
}
async function run(args = []) {
  const parsed = parseArgs(args);
  if (parsed.help) { console.log(t('cool_card.usage')); return; }
  console.log(JSON.stringify(await execute(parsed), null, 2));
}
module.exports = { parseArgs, execute, run, decodeCard, capabilities };
