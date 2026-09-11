'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { createAuthRef, isAuthRefReady } = require('../core/yida-client');
const { getReportSchema } = require('./http');
const {
  REPORT_DOMAIN_CODE,
  normalizeReportConfig,
  normalizeReportSchemaContent,
} = require('./contract');
const { requireSchemaServerRevision } = require('../core/server-revision');
const { collectFieldBindings, probeReportSchema } = require('./runtime-probe');
const { buildReportWorkbenchUrl } = require('./url');

function firstValue(...values) {
  return values.find(value => value !== null && value !== undefined && value !== '') ?? null;
}

function collectValuesByKey(value, targetKey, values = new Set()) {
  if (!value || typeof value !== 'object') {return values;}
  if (Array.isArray(value)) {
    value.forEach(item => collectValuesByKey(item, targetKey, values));
    return values;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === targetKey && typeof child === 'string' && child) {values.add(child);}
    collectValuesByKey(child, targetKey, values);
  }
  return values;
}

function visitNodes(node, callback) {
  if (!node || typeof node !== 'object') {return;}
  callback(node);
  if (Array.isArray(node.children)) {node.children.forEach(child => visitNodes(child, callback));}
}

function summarizeComponent(node) {
  const props = node.props && typeof node.props === 'object' ? node.props : {};
  const dataSetModelMap = props.dataSetModelMap && typeof props.dataSetModelMap === 'object'
    ? props.dataSetModelMap
    : {};
  return {
    componentName: node.componentName,
    cid: firstValue(props.cid, node.cid, node.id),
    fieldId: firstValue(props.fieldId, node.fieldId),
    dataSetKeys: Object.keys(dataSetModelMap).sort(),
    filterKeys: [...collectValuesByKey(dataSetModelMap, 'filterKey')].sort(),
    cubeCodes: [...collectValuesByKey(dataSetModelMap, 'cubeCode')].sort(),
    fields: collectFieldBindings(dataSetModelMap),
  };
}

function summarizeReportSchema(value, context = {}) {
  const schema = normalizeReportSchemaContent(value);
  const revision = requireSchemaServerRevision(schema);
  const config = normalizeReportConfig(schema.config);
  const pages = Array.isArray(schema.pages) ? schema.pages : [];
  const firstPage = pages[0] || {};
  const firstTree = Array.isArray(firstPage.componentsTree) ? firstPage.componentsTree[0] : null;
  const components = [];
  let layout = [];
  const reportId = context.reportId || schema.id || null;
  const workbenchUrl = buildReportWorkbenchUrl(context.baseUrl, context.appType, reportId);
  visitNodes(firstTree, (node) => {
    if (node.componentName === 'RootContent' && node.props && Array.isArray(node.props.layout)) {
      layout = node.props.layout.map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        moved: item.moved === true,
        static: item.static === true,
      }));
    }
    if (typeof node.componentName === 'string' && node.componentName.startsWith('Youshu')) {
      components.push(summarizeComponent(node));
    }
  });

  return {
    success: true,
    operation: 'report.inspect',
    appType: context.appType || null,
    reportId,
    url: workbenchUrl,
    workbenchUrl,
    schemaVersion: 'V5',
    domainCode: REPORT_DOMAIN_CODE,
    revision,
    prdId: firstValue(schema.prdId, config.prdId, firstPage.prdId, firstPage.props && firstPage.props.prdId),
    pageId: firstValue(schema.pageId, config.pageId, firstPage.pageId, firstPage.id),
    componentCount: components.length,
    components,
    layout,
  };
}

function ensureSession() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError(t('report_runtime.inspect_login_required'), { code: 'NEED_LOGIN' });
  }
  return authRef;
}

async function run(args = []) {
  const filteredArgs = args.filter(arg => arg !== '--json');
  if (filteredArgs.length < 2) {
    throw new CliError(t('report_runtime.inspect_usage'), {
      code: 'REPORT_INSPECT_INVALID_ARGUMENTS',
    });
  }
  const [appType, reportId] = filteredArgs;
  const authRef = ensureSession();
  const result = await getReportSchema(authRef, appType, reportId);
  if (!result || result.success === false) {
    throw new CliError(result && result.errorMsg ? result.errorMsg : t('report_runtime.inspect_read_failed'), {
      code: 'REPORT_INSPECT_READ_FAILED',
      details: result || { success: false, reportId },
    });
  }
  const summary = summarizeReportSchema(result, { appType, reportId, baseUrl: authRef.baseUrl });
  const runtime = await probeReportSchema(authRef, appType, reportId, result);
  if (!summary.prdId) {
    const resolvedPrdId = runtime.probes.find(probe => probe.prdId);
    summary.prdId = resolvedPrdId ? resolvedPrdId.prdId : null;
  }
  const probesByCid = new Map(runtime.probes.map(probe => [probe.cid, probe]));
  summary.components = summary.components.map(component => {
    const probe = probesByCid.get(component.cid);
    return {
      ...component,
      queryProbe: probe
        ? {
          status: probe.status,
          success: probe.success,
          errorCode: probe.errorCode,
          errorMsg: probe.errorMsg,
        }
        : { status: 'NOT_QUERYABLE', success: false, errorCode: 'REPORT_RUNTIME_BINDING_INCOMPLETE', errorMsg: null },
    };
  });
  summary.runtimeQueryVerified = runtime.runtimeQueryVerified;
  console.log(JSON.stringify(summary));
  return summary;
}

module.exports = Object.freeze({
  run,
  summarizeReportSchema,
});
