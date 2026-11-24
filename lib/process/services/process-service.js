'use strict';

const { createYidaClient } = require('../../core/yida-client');
const { CliError } = require('../../core/cli-error');
const { t } = require('../../core/i18n');
const { extractPlatformView, verifySelfApproval } = require('./process-view-verifier');
const {
  getProcessCodeFromAppParam,
  switchFormType,
} = require('../../app/services/form-mode-service');

function queryProcessVersions(authRef, appType, processCode, status, options = {}) {
  const paging = options || {};
  const requestPath = '/alibaba/web/' + appType + '/query/process/pageProcessVersion.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'getOnce' : 'get';
  return client[method](requestPath, auth => ({
    _api: 'Process.getProcessVersionInfo',
    _mock: 'false',
    _csrf_token: auth.csrfToken,
    _locale_time_zone_offset: '28800000',
    processCode,
    appType,
    status: status || '',
    pageIndex: paging.pageIndex || 1,
    pageSize: paging.pageSize || 10,
    orderByModifyTime: 'desc',
    _stamp: Date.now(),
  }));
}

function getProcessCodeFromSchema(authRef, appType, formUuid) {
  const requestPath = '/dingtalk/web/' + appType + '/query/formdesign/getFormSchema.json';
  return createYidaClient({ authRef }).get(requestPath, {
    formUuid,
    schemaVersion: 'V5',
  }).then(function (result) {
    if (result && result.success && result.content) {
      const schemaStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      const matches = schemaStr.match(/TPROC[A-Za-z0-9_-]+/g);
      if (matches && matches.length > 0) {
        return Array.from(new Set(matches))[0];
      }
    }
    return null;
  });
}

function newDraftProcess(authRef, appType, processCode, formUuid, processId, processVersion, options = {}) {
  const requestPath = '/' + appType + '/query/simpleProcess/newDraftProcess.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'postFormOnce' : 'postForm';
  return client[method](requestPath, auth => {
    const postObj = {
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: '28800000',
      formUuid,
      processCode,
    };
    if (processId) {postObj.processId = String(processId);}
    if (processVersion !== undefined && processVersion !== null) {
      postObj.processVersion = String(processVersion);
    }
    return postObj;
  });
}

function saveProcessById(authRef, appType, formUuid, processCode, processId, processVersion, processJsonStr, viewJsonStr, options = {}) {
  const requestPath = '/alibaba/web/' + appType + '/query/simpleProcess/saveProcessById.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'postFormOnce' : 'postForm';
  return client[method](requestPath, auth => ({
    _csrf_token: auth.csrfToken,
    formUuid,
    isOnline: 'true',
    json: processJsonStr,
    needReportLine: 'y',
    processCode,
    processId: String(processId),
    processVersion: String(processVersion),
    viewJson: viewJsonStr,
  }));
}

function publishProcessById(authRef, appType, formUuid, processCode, processId, processVersion, options = {}) {
  const requestPath = '/alibaba/web/' + appType + '/query/simpleProcess/publishProcessById.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'postFormOnce' : 'postForm';
  return client[method](requestPath, auth => ({
    _csrf_token: auth.csrfToken,
    formUuid,
    processCode,
    processId: String(processId),
    processVersion: String(processVersion),
  }));
}

function getProcessById(authRef, input, options = {}) {
  const appType = input && input.appType;
  const requestPath = '/alibaba/web/' + appType + '/query/simpleProcess/getProcessById.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'getOnce' : 'get';
  return client[method](requestPath, auth => ({
    _api: 'SimpleProcess.getProcessById',
    _mock: 'false',
    _csrf_token: auth.csrfToken,
    _locale_time_zone_offset: '28800000',
    formUuid: input && input.formUuid,
    processCode: input && input.processCode,
    processId: input && input.processId,
    processVersion: input && input.processVersion,
    _stamp: Date.now(),
  }));
}


async function assertProcessSeedSafe(authRef, target) {
  const { appType, formUuid, processCode } = target;
  const unverified = reason => new CliError(t('data_seed.process_unverified'), {
    code: 'DATA_SEED_PROCESS_UNVERIFIED',
    details: { target, reason, nextStep: 'verify_published_process_before_seeding',
      retryable: false, retrySafe: true, sideEffectState: 'none' },
  });

  let version, view;
  try {
    const result = await queryProcessVersions(authRef, appType, processCode, 'PUBLISHED', { pageSize: 2 });
    const versions = result?.content?.data;
    if (result?.success !== true || !Array.isArray(versions)) {
      throw unverified('published_versions_unreadable');
    }
    if (versions.length !== 1) {
      throw unverified('published_version_not_unique');
    }
    const current = versions[0];
    const processId = String(current?.processId ?? current?.id ?? '');
    const processVersion = Number(current?.processVersion ?? current?.version);
    if (!/^[1-9]\d*$/.test(processId) || !Number.isSafeInteger(processVersion) || processVersion < 1
      || (current.status !== undefined && current.status !== 'PUBLISHED')) {
      throw unverified('invalid_published_version');
    }
    version = { processId, processVersion };
    view = extractPlatformView(await getProcessById(authRef, { ...target, ...version }));
  } catch (error) {
    if (error.code === 'DATA_SEED_PROCESS_UNVERIFIED') {throw error;}
    throw unverified('published_view_unreadable');
  }
  if (view.bindingForm !== formUuid) {throw unverified('published_view_binding_mismatch');}
  if (!verifySelfApproval(view)) {
    throw new CliError(t('data_seed.process_not_self_approval'), {
      code: 'DATA_SEED_PROCESS_NOT_SELF_APPROVAL',
      details: { target, ...version, nextStep: 'seed_only_on_temporary_self_approval_or_skip',
        retryable: false, retrySafe: true, sideEffectState: 'none' },
    });
  }
}

const PRICING_URL = 'https://www.aliwork.com/pricing';
// Require known node contracts in addition to the target application's designer allowlist.
const CYCLE_NODE_TYPES = new Map([
  ['CycleContainer', 'foreach'],
  ['ConditionContainer', 'route'],
  ['ConditionNode', 'condition'],
  ['ParallelNode', 'condition'],
  ['SendMessageNode', 'sendMessage'],
  ['SendEmailNode', 'sendEmail'],
  ['InitiateApprovalNode', 'initiateApproval'],
]);

function failCycle(reason, nodeType) {
  const upgradeUrl = reason === 'entitlement_required' ? PRICING_URL : undefined;
  throw new CliError(t('workflow_cycle.' + reason, nodeType || upgradeUrl), {
    code: 'WORKFLOW_CYCLE_' + reason.toUpperCase(),
    details: { ...(nodeType && { nodeType }), ...(upgradeUrl && { upgradeUrl }), remoteWrites: 0 },
  });
}

function findCycles(nodes = [], typeKey, childKey, cycleType) {
  return nodes.flatMap(node => [
    ...(node[typeKey] === cycleType ? [node] : []),
    ...findCycles(node[childKey], typeKey, childKey, cycleType),
  ]);
}

/** Validate the canvas and, when writing a definition, its corresponding runtime loop. */
function inspectCycle(viewJson, processJson) {
  const view = findCycles(viewJson?.schema?.children, 'componentName', 'children', 'CycleContainer');
  const runtime = processJson && findCycles(processJson.nodes, 'type', 'childNodes', 'foreach');
  if (view.length > 1 || runtime && (runtime.length !== view.length || runtime[0]?.nodeId !== view[0]?.id)) {
    failCycle('invalid');
  }
  return { view: view[0], runtime: runtime?.[0] };
}

function inspectNodes(nodes, nodeTypes, count, runtimeNodes) {
  if (!Array.isArray(nodes) || runtimeNodes && (!Array.isArray(runtimeNodes) || runtimeNodes.length !== nodes.length)) {
    failCycle('invalid');
  }
  for (const [index, node] of nodes.entries()) {
    const component = node.componentName;
    if (!CYCLE_NODE_TYPES.has(component) || component === 'CycleContainer') { failCycle('node_unavailable', component); }
    if (runtimeNodes && (runtimeNodes[index]?.nodeId !== node.id
      || runtimeNodes[index]?.type !== CYCLE_NODE_TYPES.get(component))) { failCycle('invalid'); }
    if (component !== 'ConditionContainer') { nodeTypes.add(component); }
    if (component !== 'ConditionNode' && component !== 'ParallelNode') { count += 1; }
    if (node.children?.length || runtimeNodes?.[index]?.childNodes?.length) {
      count = inspectNodes(node.children || [], nodeTypes, count, runtimeNodes && (runtimeNodes[index].childNodes || []));
    }
  }
  return count;
}

async function readContent(client, path, query) {
  try {
    const response = await client.getOnce(path, query, { silentStatus: true });
    if (response?.success !== true) { return undefined; }
    return typeof response.content === 'string' ? JSON.parse(response.content) : response.content;
  } catch {
    failCycle('unverified');
  }
}

/** Check the target organization's current platform settings before an automation write. */
async function assertAutomationCycle(authRef, { appType, processCode, viewJson, processJson }) {
  const { view, runtime } = inspectCycle(viewJson, processJson);
  if (!view) { return; }
  const nodeTypes = new Set();
  const count = inspectNodes(view.children, nodeTypes, 0, runtime && (runtime.childNodes || []));
  if (count < 1 || count > 5 || !view.props?.cycleContainerRules?.sourceId) { failCycle('invalid'); }

  const client = createYidaClient({ authRef });
  const [assets, auth, rollout] = await Promise.all([
    readContent(client, `/alibaba/web/${appType}/query/simpleProcess/getConfig.json`, {
      isLogic: 'true', ...(processCode && { processCode }),
    }),
    readContent(client, '/query/auth/list.json', { type: 'WORKFLOW' }),
    readContent(client, '/query/compromiseDing/orgInGray.json', { grayKey: 'V20221215_foreach_service' }),
  ]);
  if (!Array.isArray(assets?.componentsList) || !Array.isArray(auth?.feature) || typeof rollout !== 'boolean') {
    failCycle('unverified');
  }
  const available = new Map(assets.componentsList.map(item => [item?.componentName, item]));
  const cycle = available.get('CycleContainer');
  if (!cycle) { failCycle('unavailable'); }
  if (!Array.isArray(assets.cycleValidComponents)) { failCycle('unverified'); }
  for (const component of nodeTypes) {
    if (!available.has(component) || !assets.cycleValidComponents.includes(component)) {
      failCycle('node_unavailable', component);
    }
  }
  const requiresAdvanced = cycle.isAdvance === true
    || [...nodeTypes].some(component => available.get(component).isAdvance === true);
  if (!auth.feature.includes('LOOP_NODE') || (requiresAdvanced && !auth.feature.includes('ADVANCE_PROC'))) {
    failCycle('entitlement_required');
  }
  if (!rollout) { failCycle('unavailable'); }
}

/** Approval form authoring has no loop container in the supported designer scenario. */
function assertApprovalCycleSupported(viewJson, processJson) {
  if (inspectCycle(viewJson, processJson).view) { failCycle('unavailable'); }
}

module.exports = {
  assertProcessSeedSafe,
  assertApprovalCycleSupported,
  assertAutomationCycle,
  getProcessById,
  getProcessCodeFromAppParam,
  getProcessCodeFromSchema,
  newDraftProcess,
  publishProcessById,
  queryProcessVersions,
  saveProcessById,
  switchFormType,
};
