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
const READ_ACTIONS = new Set(['search', 'detail', 'prepare', 'ai-build', 'status']);
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
  const booleanFlags = new Set(['--json', '--retry']);
  const valueFlags = new Set([
    '--query', '--scene', '--industry', '--page', '--size', '--name', '--with-data', '--request-id', '--wait',
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
    prepare: ['--name', '--with-data', '--request-id', '--json'],
    'ai-build': ['--json'],
    enable: ['--name', '--with-data', '--request-id', '--retry', '--wait', '--json'],
    status: ['--wait', '--json'],
  };
  if (Object.keys(flags).some(flag => !allowed[action].includes(flag))) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (action === 'search' && positional.length !== 0) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (['detail', 'prepare', 'ai-build', 'enable'].includes(action)
    && (positional.length !== 1 || !VALID_TEMPLATE_ID.test(positional[0]))) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (action === 'status' && (positional.length !== 1 || !VALID_REQUEST_ID.test(positional[0]))) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (flags['--page']) { flags['--page'] = parsePositiveInteger(flags['--page'], 1000); }
  if (flags['--size']) { flags['--size'] = parsePositiveInteger(flags['--size'], 100); }
  if (flags['--wait'] !== undefined) {
    if (!/^\d+$/.test(flags['--wait']) || Number(flags['--wait']) > 60) {
      fail('USAGE', t('solution_template.usage'));
    }
    flags['--wait'] = Number(flags['--wait']);
  }
  if (flags['--with-data'] && !['y', 'n'].includes(flags['--with-data'])) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (flags['--request-id'] && !VALID_REQUEST_ID.test(flags['--request-id'])) {
    fail('USAGE', t('solution_template.usage'));
  }
  if (['prepare', 'enable'].includes(action) && !String(flags['--name'] || '').trim()) {
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
    enableEligibility: 'platform-decides-on-submit',
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

/** Describe the copy target without predicting platform permissions or entitlements. */
function enableSummary(auth, detail, spec, apps, requestId, existing) {
  return {
    requestId,
    target: { baseUrl: auth.baseUrl, corpId: auth.corpId || '', corpName: auth.corpName || '' },
    template: {
      templateId: spec.templateId,
      title: detail.title || '',
      sourceVersion: detail.sourceVersion || '',
      directEnableSupported: detail.directEnableSupported ?? !!detail.sourceAppType,
    },
    appName: spec.appName,
    withData: spec.withData,
    sameNameAppScope: 'created-by-current-user',
    sameNameApps: apps.filter(app => appName(app) === spec.appName)
      .map(app => formatCreatedApp(app, auth.baseUrl)),
    existingRequest: existing ? { requestId: existing.requestId, state: existing.state } : null,
    enableEligibility: 'platform-decides-on-submit',
    note: t('solution_template.platform_decides'),
  };
}

/** Preserve request identity across prepare, enable and an explicit rejected-attempt retry. */
function enableSpec(parsed) {
  return {
    templateId: parsed.templateId,
    appName: String(parsed.flags['--name']).trim(),
    withData: parsed.flags['--with-data'] || 'y',
  };
}

/** Read an existing receipt before consulting the catalog, which may since have changed. */
function existingReceipt(client, root, requestId, spec) {
  if (!fs.existsSync(receiptPath(root, requestId))) { return null; }
  const { receipt } = readReceipt(root, requestId);
  const auth = client.getAuthRef();
  assertReceiptTarget(auth, receipt);
  if (requestIdentity(auth, receipt) !== requestIdentity(auth, spec)) {
    fail('REQUEST_CONFLICT', requestId);
  }
  return receipt;
}

/** Read-only preparation; source availability is separate from authorization on submit. */
async function prepareEnable(client, root, parsed) {
  const auth = client.getAuthRef();
  const spec = enableSpec(parsed);
  const requestId = parsed.requestId || defaultRequestId(auth, spec);
  const existing = existingReceipt(client, root, requestId, spec);
  const detail = await fetchDetail(client, spec.templateId);
  const apps = await listCreatedApps(client);
  return {
    success: true,
    action: 'prepare',
    summary: enableSummary(auth, detail, spec, apps, requestId, existing),
    submissionAccepted: false,
    applicationVerified: false,
  };
}

/** Give the agent a recovery action; rejected requests require a new explicit write invocation. */
function recoveryAction(receipt) {
  if (receipt.state === 'failed-before-submit') {
    return {
      action: 'retry-only-on-explicit-user-request',
      args: ['enable', receipt.templateId, '--name', receipt.appName,
        '--with-data', receipt.withData, '--request-id', receipt.requestId, '--retry', '--json'],
    };
  }
  return {
    action: 'check-status',
    command: `openyida solution-template status ${receipt.requestId} --wait 10 --json`,
  };
}

function receiptResult(receipt, filename, client, overrides = {}) {
  const app = receipt.resultApp || null;
  const verified = receipt.state === 'completed' && receipt.lastReadback?.visibility === 'visible';
  const rejected = receipt.state === 'failed-before-submit';
  return {
    success: verified,
    action: 'status',
    requestId: receipt.requestId,
    state: receipt.state,
    templateId: receipt.templateId,
    appName: receipt.appName,
    withData: receipt.withData,
    resultApp: app,
    receiptFile: filename,
    summary: receipt.summary || null,
    error: verified ? null : (receipt.error || null),
    lastReadback: receipt.lastReadback || null,
    lastVerifiedAt: receipt.lastVerifiedAt || null,
    previouslyVerified: receipt.state === 'completed',
    platformProgressSupported: false,
    submissionAccepted: ['accepted', 'completed'].includes(receipt.state),
    applicationVerified: verified,
    resubmissionBlocked: !rejected,
    explicitRetryRequired: rejected,
    nextAction: verified ? { action: 'open-application' } : recoveryAction(receipt),
    ...(app ? { urls: buildApplicationEntryUrls({ appType: app.appType, systemLink: app.systemLink, baseUrl: client.getAuthRef().baseUrl }) } : {}),
    ...overrides,
  };
}

async function recoverReceipt(client, root, receipt) {
  // An explicit rejection is terminal for that attempt. Never claim an unrelated later app.
  if (receipt.state === 'failed-before-submit') {
    return receiptResult(receipt, receiptPath(root, receipt.requestId), client, {
      note: t('solution_template.rejected'),
    });
  }
  let apps;
  try {
    apps = await listCreatedApps(client);
  } catch (error) {
    receipt.lastReadback = {
      visibility: 'unknown', checkedAt: new Date().toISOString(),
      error: { code: error.code || 'READBACK_FAILED', message: error.message, details: error.details },
    };
    const filename = writeReceipt(root, receipt);
    return receiptResult(receipt, filename, client, { note: t('solution_template.readback_failed') });
  }
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
    receipt.lastVerifiedAt = receipt.updatedAt;
    receipt.lastReadback = { visibility: 'visible', checkedAt: receipt.updatedAt };
    const filename = writeReceipt(root, receipt);
    return receiptResult(receipt, filename, client, { recoveredByReadback: !receipt.targetAppType });
  }
  if (matches.length > 1) {
    receipt.state = 'ambiguous';
    receipt.updatedAt = new Date().toISOString();
    receipt.lastReadback = { visibility: 'ambiguous', checkedAt: receipt.updatedAt };
    const filename = writeReceipt(root, receipt);
    return receiptResult(receipt, filename, client, {
      success: false,
      ambiguousCandidates: matches.map(app => formatCreatedApp(app, client.getAuthRef().baseUrl)),
      inspectBeforeRetry: true,
    });
  }
  receipt.lastReadback = { visibility: 'not-visible', checkedAt: new Date().toISOString() };
  const filename = writeReceipt(root, receipt);
  return receiptResult(receipt, filename, client, {
    success: false,
    inspectBeforeRetry: true,
    note: t(receipt.state === 'completed' ? 'solution_template.no_longer_visible' : 'solution_template.pending'),
  });
}

/** Poll only readback, with a bounded backoff; no background work or copy replay. */
async function waitForReceipt(client, root, receipt, waitSeconds, options) {
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = options.now || Date.now;
  const deadline = now() + waitSeconds * 1000;
  let result = await recoverReceipt(client, root, receipt);
  let remaining = waitSeconds * 1000;
  let delay = 1000;
  let checks = 1;
  while (remaining > 0 && ['accepted', 'uncertain', 'submitting'].includes(result.state)
    && result.lastReadback?.visibility === 'not-visible') {
    remaining = Math.min(remaining, deadline - now());
    if (remaining <= 0) { break; }
    options.onProgress?.(t('solution_template.waiting'));
    const duration = Math.min(delay, remaining);
    await sleep(duration);
    remaining -= duration;
    result = await recoverReceipt(client, root, receipt);
    checks += 1;
    delay = Math.min(delay * 2, 4000);
  }
  return { ...result, wait: { budgetSeconds: waitSeconds, checks } };
}

async function enableTemplate(client, root, parsed, options) {
  const auth = client.getAuthRef();
  const spec = enableSpec(parsed);
  const requestId = parsed.requestId || defaultRequestId(auth, spec);
  const filename = receiptPath(root, requestId);
  const existing = existingReceipt(client, root, requestId, spec);
  const waitSeconds = parsed.flags['--wait'] ?? 10;
  if (existing && !(existing.state === 'failed-before-submit' && parsed.flags['--retry'])) {
    return waitForReceipt(client, root, existing, waitSeconds, options);
  }
  if (!existing && parsed.flags['--retry']) { fail('REQUEST_NOT_FOUND', requestId); }
  const detail = await fetchDetail(client, parsed.templateId);
  if (!detail.directEnableSupported || !detail.sourceAppType) {
    fail('ENABLE_UNSUPPORTED', parsed.templateId);
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
    attempt: (existing?.attempt || (existing ? 1 : 0)) + 1,
    summary: enableSummary(auth, detail, spec, baseline, requestId, existing),
  };
  options.onSummary?.(receipt.summary);
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
    const recovered = await waitForReceipt(client, root, receipt, waitSeconds, options);
    if (recovered.applicationVerified) { return recovered; }
    fail('ENABLE_UNCERTAIN', error.message, {
      ...recovered,
      requestId,
      receiptFile: uncertainFile,
      target: { baseUrl: auth.baseUrl, corpId: auth.corpId || '', templateId: spec.templateId },
      retrySafe: false,
      sideEffectState: 'unknown',
      inspectBeforeRetry: true,
      verificationCommand: `openyida solution-template status ${requestId} --json`,
    });
  }
  if (response && (response.success === false || response.__needLogin || response.__csrfExpired)) {
    receipt.state = 'failed-before-submit';
    receipt.error = {
      code: response?.errorCode || 'PLATFORM_REJECTED',
      message: response?.errorMsg || response?.message || 'platform rejected template enable',
    };
    receipt.updatedAt = new Date().toISOString();
    writeReceipt(root, receipt);
    fail('API_ERROR', receipt.error.message, {
      ...receiptResult(receipt, filename, client),
      endpoint: TEMPLATE_ENABLE_API,
      platformErrorCode: response.errorCode,
      note: t('solution_template.rejected'),
    });
  }
  const content = response?.content;
  if (response?.success !== true || !content || typeof content !== 'object'
    || !/^APP_[A-Za-z0-9_-]+$/.test(content.desAppType || '')) {
    receipt.state = 'uncertain';
    receipt.platformResponse = content ?? null;
    receipt.updatedAt = new Date().toISOString();
    const uncertainFile = writeReceipt(root, receipt);
    const recovered = await waitForReceipt(client, root, receipt, waitSeconds, options);
    if (recovered.applicationVerified) { return recovered; }
    fail('ENABLE_UNCERTAIN', 'missing desAppType', {
      ...recovered,
      requestId,
      receiptFile: uncertainFile,
      target: { baseUrl: auth.baseUrl, corpId: auth.corpId || '', templateId: spec.templateId },
      retrySafe: false,
      sideEffectState: 'unknown',
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
  options.onProgress?.(t('solution_template.accepted'));
  return waitForReceipt(client, root, receipt, waitSeconds, options);
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
  if (checked.action === 'prepare') { return prepareEnable(client, root, checked); }
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
    return waitForReceipt(client, root, receipt, checked.flags['--wait'] ?? 0, options);
  }
  return enableTemplate(client, root, checked, options);
}

async function run(args = []) {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.log(t('solution_template.usage'));
    return;
  }
  console.log(JSON.stringify(await execute(parsed, {
    onSummary: parsed.flags['--json'] ? undefined : summary => console.error(JSON.stringify({ summary }, null, 2)),
    onProgress: parsed.flags['--json'] ? undefined : message => console.error(message),
  }), null, 2));
}

module.exports = {
  parseArgs,
  execute,
  run,
  formatDetail,
  formatTemplate,
  defaultRequestId,
};
