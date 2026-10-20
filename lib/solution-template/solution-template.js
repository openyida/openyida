'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { findProjectRoot } = require('../core/utils');
const { buildCommonParams, createAuthRef, createYidaClient } = require('../core/yida-client');
const { buildApplicationEntryUrls } = require('../app/application-entry-urls');

const TEMPLATE_LIST_API = '/query/loginFreeFormData/listFormDataByType.json';
const TEMPLATE_DETAIL_API = '/query/appTpl/getAppTplComplexInfo.json';
const TEMPLATE_ENABLE_API = '/query/app/copyTemplateApp.json';
const APP_LIST_API = '/query/app/getAppList.json';
const VALID_TEMPLATE_ID = /^TPL_[A-Za-z0-9_-]+$/;
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;
const READ_ACTIONS = new Set(['search', 'detail', 'ai-build', 'status']);
const ACTIONS = new Set([...READ_ACTIONS, 'enable']);

function fail(code, message, details) {
  throw new CliError(t('solution_template.failed', message), {
    code: `SOLUTION_TEMPLATE_${code}`,
    details,
  });
}

function parsePositiveInteger(value, max) {
  if (!/^\d+$/.test(String(value || '')) || Number(value) < 1 || Number(value) > max) {
    fail('USAGE', t('solution_template.usage'));
  }
  return Number(value);
}

function parseArgs(args = []) {
  if (args.some(arg => ['--help', '-h'].includes(arg))) {
    return { help: true };
  }
  const action = args[0];
  if (!ACTIONS.has(action)) {
    fail('USAGE', t('solution_template.usage'));
  }
  const flags = {};
  const positional = [];
  const booleanFlags = new Set(['--json']);
  const valueFlags = new Set([
    '--query', '--scene', '--industry', '--page', '--size', '--name', '--with-data', '--request-id',
  ]);
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (booleanFlags.has(arg)) {
      if (Object.hasOwn(flags, arg)) { fail('USAGE', t('solution_template.usage')); }
      flags[arg] = true;
    } else if (valueFlags.has(arg)) {
      if (Object.hasOwn(flags, arg) || !args[index + 1] || args[index + 1].startsWith('-')) {
        fail('USAGE', t('solution_template.usage'));
      }
      flags[arg] = args[++index];
    } else if (arg.startsWith('-')) {
      fail('USAGE', t('solution_template.usage'));
    } else {
      positional.push(arg);
    }
  }

  const allowed = {
    search: ['--query', '--scene', '--industry', '--page', '--size', '--json'],
    detail: ['--json'],
    'ai-build': ['--json'],
    enable: ['--name', '--with-data', '--request-id', '--json'],
    status: ['--json'],
  };
  if (Object.keys(flags).some(flag => !allowed[action].includes(flag))) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (action === 'search' && positional.length !== 0) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (['detail', 'ai-build', 'enable'].includes(action)
    && (positional.length !== 1 || !VALID_TEMPLATE_ID.test(positional[0]))) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (action === 'status' && (positional.length !== 1 || !VALID_REQUEST_ID.test(positional[0]))) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (flags['--page']) { flags['--page'] = parsePositiveInteger(flags['--page'], 1000); }
  if (flags['--size']) { flags['--size'] = parsePositiveInteger(flags['--size'], 100); }
  if (flags['--with-data'] && !['y', 'n'].includes(flags['--with-data'])) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (flags['--request-id'] && !VALID_REQUEST_ID.test(flags['--request-id'])) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (action === 'enable' && !String(flags['--name'] || '').trim()) {
    fail('USAGE', t('solution_template.usage'));
  }
  return {
    action,
    templateId: positional[0] || '',
    requestId: action === 'status' ? positional[0] : flags['--request-id'],
    flags,
  };
}

function unwrap(response, endpoint) {
  if (!response || response.success !== true || response.__needLogin || response.__csrfExpired) {
    fail('API_ERROR', response?.errorMsg || response?.message || endpoint, {
      endpoint,
      platformErrorCode: response?.errorCode,
    });
  }
  return response.content;
}

function localized(value) {
  if (typeof value === 'string') { return value.trim(); }
  if (!value || typeof value !== 'object') { return ''; }
  return String(value.zh_CN || value.en_US || value.value || '').trim();
}

function templateUrl(baseUrl, templateId) {
  return `${String(baseUrl).replace(/\/$/, '')}/solutionCenter/detail?id=${encodeURIComponent(templateId)}&type=template`;
}

function formatTemplate(item, baseUrl) {
  return {
    templateId: item.appTplUuid,
    title: localized(item.templateTitle || item.title),
    description: localized(item.description),
    author: localized(item.author),
    industry: localized(item.industry),
    scene: localized(item.role),
    tags: Array.isArray(item.tags) ? item.tags : localized(item.tags),
    usageCount: Number(item.usageNum_value ?? item.usageNum ?? 0) || 0,
    collected: item.isCollect === 'y' || item.isCollect === true,
    saas: item.isSaaS === 'y' || item.isSaaS === true,
    detailUrl: templateUrl(baseUrl, item.appTplUuid),
  };
}

function formatDetail(content, baseUrl) {
  if (!content || !VALID_TEMPLATE_ID.test(content.appTplUuid || '')) {
    fail('INVALID_RESPONSE', 'template detail');
  }
  const online = content.latestOnlineAppTpl || {};
  const templateId = content.appTplUuid;
  return {
    templateId,
    title: localized(content.title || content.templateTitle),
    description: localized(content.description),
    provider: localized(content.provider || content.corpName),
    aiBuildSupported: content.aiBuildSupported === true,
    sourceAppType: online.appType || content.onlineAppType || '',
    sourceVersion: online.version || '',
    versionCount: Number(content.versionNum || 0) || 0,
    detailUrl: templateUrl(baseUrl, templateId),
    aiBuildUrl: `${String(baseUrl).replace(/\/$/, '')}/dashboard?templateId=${encodeURIComponent(templateId)}`,
    directEnableSupported: !!(online.appType || content.onlineAppType),
  };
}

async function fetchDetail(client, templateId) {
  const response = await client.get(TEMPLATE_DETAIL_API, ref => buildCommonParams(ref, { appTplUuid: templateId }));
  return formatDetail(unwrap(response, TEMPLATE_DETAIL_API), client.getAuthRef().baseUrl);
}

async function searchTemplates(client, flags) {
  const query = String(flags['--query'] || '').trim();
  const searchFieldJson = JSON.stringify({
    author: '', isShow: 'y', isSaaS: 'n', suggest: '',
    industry: String(flags['--industry'] || '').trim(),
    role: String(flags['--scene'] || '').trim(), tags: '', templateTitle: query,
  });
  const page = flags['--page'] || 1;
  const size = flags['--size'] || 20;
  const response = await client.get(TEMPLATE_LIST_API, ref => buildCommonParams(ref, {
    type: 'templateCenter', searchFieldJson, userLanguage: 'zh_CN',
    dynamicOrder: JSON.stringify({ orderNum: '+' }), currentPage: page, pageSize: size,
  }));
  const content = unwrap(response, TEMPLATE_LIST_API);
  if (!content || !Array.isArray(content.data)) { fail('INVALID_RESPONSE', 'template search'); }
  return {
    success: true,
    action: 'search',
    page: Number(content.currentPage || page),
    size,
    totalCount: Number(content.totalCount || 0),
    hasMore: !!content.hasMore,
    data: content.data.map(item => formatTemplate(item, client.getAuthRef().baseUrl)),
    readbackVerified: true,
  };
}

function receiptDirectory(root) {
  return path.join(root || findProjectRoot(), '.cache', 'openyida', 'solution-template');
}

function requestIdentity(auth, spec) {
  return [auth.baseUrl, auth.corpId, spec.templateId, spec.appName, spec.withData].join('\n');
}

function assertReceiptTarget(auth, receipt) {
  if (receipt.baseUrl !== auth.baseUrl || (receipt.corpId || '') !== (auth.corpId || '')) {
    fail('REQUEST_TARGET_MISMATCH', receipt.requestId, {
      receiptBaseUrl: receipt.baseUrl,
      currentBaseUrl: auth.baseUrl,
      receiptCorpId: receipt.corpId || '',
      currentCorpId: auth.corpId || '',
    });
  }
}

function defaultRequestId(auth, spec) {
  return `st-${crypto.createHash('sha256').update(requestIdentity(auth, spec)).digest('hex').slice(0, 24)}`;
}

function receiptPath(root, requestId) {
  return path.join(receiptDirectory(root), `${requestId}.json`);
}

function readReceipt(root, requestId) {
  const filename = receiptPath(root, requestId);
  if (!fs.existsSync(filename)) { fail('REQUEST_NOT_FOUND', requestId); }
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch { fail('INVALID_RECEIPT', requestId); }
  return { filename, receipt };
}

function writeReceipt(root, receipt) {
  const directory = receiptDirectory(root);
  fs.mkdirSync(directory, { recursive: true });
  const filename = receiptPath(root, receipt.requestId);
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(receipt, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, filename);
  return filename;
}

async function listCreatedApps(client, maxPages = 20) {
  const apps = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await client.get(APP_LIST_API, ref => buildCommonParams(ref, {
      pageIndex: page, pageSize: 100, creator: ref.userId, isAdmin: false,
    }));
    const content = unwrap(response, APP_LIST_API);
    if (!content || !Array.isArray(content.data)) { fail('INVALID_RESPONSE', 'app list'); }
    apps.push(...content.data);
    if (apps.length >= Number(content.totalCount || apps.length) || content.data.length < 100) { break; }
  }
  return apps;
}

function appName(app) {
  return localized(app.appName || app.title);
}

function formatCreatedApp(app, baseUrl) {
  return {
    appType: app.appType,
    appName: appName(app),
    ...buildApplicationEntryUrls({ appType: app.appType, systemLink: app.systemLink, baseUrl }),
  };
}

function receiptResult(receipt, filename, client, overrides = {}) {
  const app = receipt.resultApp || null;
  return {
    success: receipt.state === 'completed',
    action: 'status',
    requestId: receipt.requestId,
    state: receipt.state,
    templateId: receipt.templateId,
    appName: receipt.appName,
    withData: receipt.withData,
    resultApp: app,
    receiptFile: filename,
    platformProgressSupported: false,
    submissionAccepted: ['accepted', 'completed'].includes(receipt.state),
    applicationVerified: receipt.state === 'completed',
    resubmissionBlocked: true,
    ...(app ? { urls: buildApplicationEntryUrls({ appType: app.appType, systemLink: app.systemLink, baseUrl: client.getAuthRef().baseUrl }) } : {}),
    ...overrides,
  };
}

async function recoverReceipt(client, root, receipt) {
  const apps = await listCreatedApps(client);
  let matches = [];
  if (receipt.targetAppType) {
    matches = apps.filter(app => app.appType === receipt.targetAppType);
  } else {
    const before = new Set(receipt.baselineAppTypes || []);
    matches = apps.filter(app => !before.has(app.appType) && appName(app) === receipt.appName);
  }
  if (matches.length === 1) {
    receipt.state = 'completed';
    receipt.resultApp = formatCreatedApp(matches[0], client.getAuthRef().baseUrl);
    receipt.updatedAt = new Date().toISOString();
    const filename = writeReceipt(root, receipt);
    return receiptResult(receipt, filename, client, { recoveredByReadback: !receipt.targetAppType });
  }
  if (matches.length > 1) {
    receipt.state = 'ambiguous';
    receipt.updatedAt = new Date().toISOString();
    const filename = writeReceipt(root, receipt);
    return receiptResult(receipt, filename, client, {
      success: false,
      ambiguousCandidates: matches.map(app => formatCreatedApp(app, client.getAuthRef().baseUrl)),
      inspectBeforeRetry: true,
    });
  }
  const filename = writeReceipt(root, receipt);
  return receiptResult(receipt, filename, client, {
    success: false,
    inspectBeforeRetry: true,
    note: t('solution_template.no_progress_api'),
  });
}

async function enableTemplate(client, root, parsed) {
  const detail = await fetchDetail(client, parsed.templateId);
  if (!detail.directEnableSupported || !detail.sourceAppType) {
    fail('ENABLE_UNSUPPORTED', parsed.templateId);
  }
  const spec = {
    templateId: parsed.templateId,
    appName: String(parsed.flags['--name']).trim(),
    withData: parsed.flags['--with-data'] || 'y',
  };
  const auth = client.getAuthRef();
  const requestId = parsed.requestId || defaultRequestId(auth, spec);
  const filename = receiptPath(root, requestId);
  if (fs.existsSync(filename)) {
    const existing = readReceipt(root, requestId).receipt;
    assertReceiptTarget(auth, existing);
    if (requestIdentity(auth, existing) !== requestIdentity(auth, spec)) {
      fail('REQUEST_CONFLICT', requestId);
    }
    return recoverReceipt(client, root, existing);
  }

  const baseline = await listCreatedApps(client);
  const now = new Date().toISOString();
  const receipt = {
    version: 1,
    requestId,
    state: 'submitting',
    templateId: spec.templateId,
    sourceAppType: detail.sourceAppType,
    sourceVersion: detail.sourceVersion,
    appName: spec.appName,
    withData: spec.withData,
    baseUrl: auth.baseUrl,
    corpId: auth.corpId || '',
    baselineAppTypes: baseline.map(app => app.appType).filter(Boolean),
    createdAt: now,
    updatedAt: now,
  };
  writeReceipt(root, receipt);

  let response;
  try {
    response = await client.postFormOnce(TEMPLATE_ENABLE_API, ref => buildCommonParams(ref, {
      appTplUuid: spec.templateId,
      sourceAppType: detail.sourceAppType,
      appName: JSON.stringify({ zh_CN: spec.appName, en_US: spec.appName, type: 'i18n' }),
      withTplData: spec.withData,
      fromTemplate: 'y',
    }));
  } catch (error) {
    receipt.state = 'uncertain';
    receipt.error = { code: error.code || 'REQUEST_FAILED', message: error.message };
    receipt.updatedAt = new Date().toISOString();
    const uncertainFile = writeReceipt(root, receipt);
    fail('ENABLE_UNCERTAIN', error.message, {
      requestId,
      receiptFile: uncertainFile,
      inspectBeforeRetry: true,
      verificationCommand: `openyida solution-template status ${requestId} --json`,
    });
  }
  if (!response || response.success !== true || response.__needLogin || response.__csrfExpired) {
    receipt.state = 'failed-before-submit';
    receipt.error = {
      code: response?.errorCode || 'PLATFORM_REJECTED',
      message: response?.errorMsg || response?.message || 'platform rejected template enable',
    };
    receipt.updatedAt = new Date().toISOString();
    writeReceipt(root, receipt);
    unwrap(response, TEMPLATE_ENABLE_API);
  }
  const content = unwrap(response, TEMPLATE_ENABLE_API);
  if (!content || typeof content !== 'object' || !/^APP_[A-Za-z0-9_-]+$/.test(content.desAppType || '')) {
    receipt.state = 'uncertain';
    receipt.platformResponse = content ?? null;
    receipt.updatedAt = new Date().toISOString();
    const uncertainFile = writeReceipt(root, receipt);
    fail('ENABLE_UNCERTAIN', 'missing desAppType', {
      requestId,
      receiptFile: uncertainFile,
      mutationAccepted: response?.success === true,
      inspectBeforeRetry: true,
      verificationCommand: `openyida solution-template status ${requestId} --json`,
    });
  }
  receipt.state = 'accepted';
  receipt.targetAppType = content.desAppType;
  receipt.isSyncCopy = content.isSyncCopy || '';
  receipt.updatedAt = new Date().toISOString();
  writeReceipt(root, receipt);
  return recoverReceipt(client, root, receipt);
}

async function execute(parsed, options = {}) {
  const checked = parseArgs([
    parsed.action,
    ...(parsed.templateId || parsed.requestId ? [parsed.templateId || parsed.requestId] : []),
    ...Object.entries(parsed.flags || {}).flatMap(([key, value]) => [key, ...(value === true ? [] : [String(value)])]),
  ]);
  const client = options.client || createYidaClient({ authRef: createAuthRef() });
  const root = options.root || findProjectRoot();
  if (checked.action === 'search') { return searchTemplates(client, checked.flags); }
  if (checked.action === 'detail') {
    return { success: true, action: 'detail', ...(await fetchDetail(client, checked.templateId)), readbackVerified: true };
  }
  if (checked.action === 'ai-build') {
    const detail = await fetchDetail(client, checked.templateId);
    if (!detail.aiBuildSupported) { fail('AI_BUILD_UNSUPPORTED', checked.templateId); }
    return {
      success: true,
      action: 'ai-build',
      ...detail,
      submissionAccepted: false,
      applicationVerified: false,
      nextAction: {
        actor: 'user-or-agent',
        action: 'customize-and-submit-in-native-builder',
        url: detail.aiBuildUrl,
        note: t('solution_template.ai_build_handoff'),
      },
    };
  }
  if (checked.action === 'status') {
    const { receipt } = readReceipt(root, checked.requestId);
    assertReceiptTarget(client.getAuthRef(), receipt);
    return recoverReceipt(client, root, receipt);
  }
  return enableTemplate(client, root, checked);
}

async function run(args = []) {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.log(t('solution_template.usage'));
    return;
  }
  console.log(JSON.stringify(await execute(parsed), null, 2));
}

module.exports = {
  parseArgs,
  execute,
  run,
  formatDetail,
  formatTemplate,
  defaultRequestId,
};
