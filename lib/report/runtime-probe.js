'use strict';

const { createYidaClient } = require('../core/yida-client');
const { listReportChartTypes, getReportChartCapability } = require('./capability-registry');
const { normalizeReportSchemaContent } = require('./contract');
const { createReportQueryProtocol } = require('./query-protocol');
const protocol = createReportQueryProtocol(require('./query-errors').en);

const COMPONENT_DATASET_KEYS = new Map(listReportChartTypes().map((type) => {
  const capability = getReportChartCapability(type);
  return [capability.componentName, capability.dataSetKey];
}));

function visitNodes(node, callback) {
  if (!node || typeof node !== 'object') {return;}
  callback(node);
  if (Array.isArray(node.children)) {node.children.forEach(child => visitNodes(child, callback));}
}

function collectFieldBindings(value, path = '$', output = []) {
  if (!value || typeof value !== 'object') {return output;}
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFieldBindings(item, `${path}[${index}]`, output));
    return output;
  }
  if (typeof value.fieldCode === 'string' && value.fieldCode) {
    output.push({
      fieldCode: value.fieldCode,
      cubeCode: typeof value.cubeCode === 'string' ? value.cubeCode : null,
      aggregateType: typeof value.aggregateType === 'string' ? value.aggregateType : null,
      role: path.split('.').pop(),
      path,
    });
  }
  Object.entries(value).forEach(([key, child]) => collectFieldBindings(child, `${path}.${key}`, output));
  const seen = new Set();
  return output.filter((item) => {
    const key = `${item.path}\u0000${item.fieldCode}`;
    if (seen.has(key)) {return false;}
    seen.add(key);
    return true;
  });
}

function buildReportProbeTargets(schemaValue, context = {}) {
  const definition = normalizeReportSchemaContent(schemaValue);
  return protocol.bindings(definition, context.reportId || definition.id)
    .filter(target => COMPONENT_DATASET_KEYS.has(target.className))
    .map(({ model, ...target }) => ({ ...target, fields: collectFieldBindings(model) }));
}

async function resolveReportPrdId(authRef, appType, reportId, schemaValue) {
  const schemaTargets = buildReportProbeTargets(schemaValue, { reportId });
  const schemaPrdId = schemaTargets.find(target => target.prdId);
  if (schemaPrdId) {return schemaPrdId.prdId;}
  const response = await createYidaClient({ authRef }).get(
    `/dingtalk/web/${appType}/query/formnav/getFormNavigationListByOrder.json`,
    { _api: 'Nav.queryList', _mock: false }
  );
  return protocol.findNavigation(response, appType, reportId);
}

function classifyProbeFailure(response, error) {
  const content = response && response.content && typeof response.content === 'object'
    ? response.content
    : {};
  const message = String(
    error && error.message
    || response && (response.errorMsg || response.message)
    || content.errorMsg
    || content.message
    || 'report query failed'
  );
  const metadataMissing = /元数据没有找到|metadata\s+(?:was\s+)?not\s+found|metadata\s+missing/i.test(message);
  return {
    errorCode: metadataMissing
      ? 'REPORT_METADATA_FIELD_NOT_FOUND'
      : String(response && response.errorCode || error && error.code || 'REPORT_RUNTIME_QUERY_FAILED'),
    errorMsg: message.slice(0, 300),
  };
}

function replaceExactStrings(value, replacements) {
  let changed = 0;
  if (!value || typeof value !== 'object') {return changed;}
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === 'string' && replacements.has(item)) {
        value[index] = replacements.get(item);
        changed++;
      } else {
        changed += replaceExactStrings(item, replacements);
      }
    });
    return changed;
  }
  Object.keys(value).forEach((key) => {
    const child = value[key];
    if (typeof child === 'string' && replacements.has(child)) {
      value[key] = replacements.get(child);
      changed++;
    } else {
      changed += replaceExactStrings(child, replacements);
    }
  });
  return changed;
}

function repairMetadataFieldCodes(schemaValue, probes = []) {
  const schema = JSON.parse(JSON.stringify(normalizeReportSchemaContent(schemaValue)));
  const failedByCid = new Map(
    probes
      .filter(probe => probe && probe.cid && probe.errorCode === 'REPORT_METADATA_FIELD_NOT_FOUND')
      .map(probe => [probe.cid, probe])
  );
  const replacements = [];
  let changed = 0;
  const pages = Array.isArray(schema.pages) ? schema.pages : [];
  pages.forEach((page) => {
    const roots = Array.isArray(page.componentsTree) ? page.componentsTree : [];
    roots.forEach(root => visitNodes(root, (node) => {
      const props = node.props && typeof node.props === 'object' ? node.props : {};
      const cid = props.cid || node.cid || node.id;
      const probe = failedByCid.get(cid);
      if (!probe || !props.dataSetModelMap) {return;}
      const map = new Map();
      (Array.isArray(probe.fields) ? probe.fields : []).forEach((field) => {
        const fieldCode = String(field && field.fieldCode || '');
        if (/^(?:selectField|radioField|checkboxField|multiSelectField|employeeField)_.+_value$/.test(fieldCode)) {
          map.set(fieldCode, fieldCode.slice(0, -6));
        }
      });
      if (map.size === 0) {return;}
      changed += replaceExactStrings(props.dataSetModelMap, map);
      map.forEach((to, from) => replacements.push({ cid, from, to }));
    }));
  });
  return { schema, changed, replacements };
}

async function queryReportComponentData(authRef, appType, target, options = {}) {
  const client = createYidaClient({ authRef });
  const output = await protocol.query((method, params) => client.postForm(
    `/alibaba/web/${appType}/visual/visualizationDataRpc/${method}.json?_api=EDataService.${method}&_mock=false`, params
  ), { ...protocol.parameters(target, { limit: 1 }), enabledCache: 'false' }, options);
  return { success: true, content: { data: output.rows, meta: output.meta, totalCount: output.totalCount } };
}

async function probeReportSchema(authRef, appType, reportId, schemaValue) {
  const targets = buildReportProbeTargets(schemaValue, { reportId });
  if (targets.some(target => !target.prdId)) {
    try {
      const prdId = await resolveReportPrdId(authRef, appType, reportId, schemaValue);
      if (prdId) {targets.forEach(target => { target.prdId = prdId; });}
    } catch {
      // The per-component result below reports a stable, read-only binding failure.
    }
  }
  const probes = [];
  for (const target of targets) {
    if (!target.prdId || !target.cid || !target.dataSetKey) {
      probes.push({
        ...target,
        success: false,
        status: 'NOT_QUERYABLE',
        errorCode: 'REPORT_RUNTIME_BINDING_INCOMPLETE',
        errorMsg: 'report runtime binding is missing prdId, cid, or dataSetKey',
      });
      continue;
    }
    try {
      const response = await queryReportComponentData(authRef, appType, target);
      if (!response || response.success === false || response.__needLogin || response.__csrfExpired) {
        const failure = classifyProbeFailure(response);
        probes.push({ ...target, success: false, status: 'QUERY_FAILED', ...failure });
        continue;
      }
      probes.push({ ...target, success: true, status: 'QUERY_OK', errorCode: null, errorMsg: null });
    } catch (error) {
      probes.push({ ...target, success: false, status: 'QUERY_FAILED', ...classifyProbeFailure(null, error) });
    }
  }
  return {
    success: probes.length > 0 && probes.every(probe => probe.success),
    runtimeQueryVerified: probes.length > 0 && probes.every(probe => probe.success),
    probes,
  };
}

module.exports = Object.freeze({
  buildReportProbeTargets,
  classifyProbeFailure,
  collectFieldBindings,
  probeReportSchema,
  queryReportComponentData,
  repairMetadataFieldCodes,
  resolveReportPrdId,
});
