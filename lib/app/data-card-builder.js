'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { buildChartNode, buildReportComponentMapEntry } = require('../report/chart-builder');
const { getReportChartCapability } = require('../report/capability-registry');
const { validateChartConfigDetailed } = require('../report/validation');
const { buildSelectFilter, buildFilterContainer, injectFilterLinkage } = require('../report/filter-builder');
const { genNodeId, genFieldId } = require('../report/constants');

const TYPES = Object.freeze(['analysis', 'indicator', 'bar', 'line', 'pie', 'table', 'combo', 'gauge', 'funnel', 'calendarheatmap']);
const CHART_NAMES = new Set([...TYPES.map(type => getReportChartCapability(type).componentName),
  'YoushuMap', 'YoushuCrossPivotTable', 'YoushuRadarChart', 'YoushuWordCloud', 'YoushuHeatmap']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
function fail(code, message, details) {
  throw new CliError(t('data_card.failed', message), { code: `DATA_CARD_${code}`, details });
}
function nodes(schema, visit) {
  const walk = node => { visit(node); (node.children || []).forEach(walk); };
  (schema.pages || []).forEach(page => (page.componentsTree || []).forEach(walk));
}
function assertCapacity(schema, extra = 0) {
  let count = extra;
  nodes(schema, node => { if (CHART_NAMES.has(node.componentName)) { count++; } });
  if (count > 5) { fail('COMPONENT_LIMIT', 'A native data card supports at most five chart components', { count, maximum: 5 }); }
}
function normalizeConfig(config) {
  if (keys(config, ['indicators']) && Array.isArray(config.indicators) && config.indicators.length) {
    return { charts: config.indicators.map(item => {
      if (!keys(item, ['title', 'formUuid', 'fieldId', 'aggregate', 'label'])) { fail('INVALID_CONFIG', 'Unsupported indicator key'); }
      return { type: 'indicator', title: item.title, formUuid: item.formUuid,
        kpi: [{ fieldId: item.fieldId, aggregate: item.aggregate, label: item.label }] };
    }), filters: [] };
  }
  if (!keys(config, ['charts', 'filters']) || !Array.isArray(config.charts) || !config.charts.length
    || (config.filters !== undefined && !Array.isArray(config.filters))) { fail('INVALID_CONFIG', 'Expected charts with optional filters, or indicators'); }
  return { charts: config.charts, filters: config.filters || [] };
}
function validForm(value) { return /^FORM-[A-Za-z0-9]+$/.test(value || ''); }
const FIELD_TYPES = { NumberField: 'DOUBLE', TextField: 'STRING', TextareaField: 'STRING', SerialNumberField: 'STRING',
  SelectField: 'STRING', RadioField: 'STRING', DateField: 'DATE' };

async function buildCardConfig(schema, input, client, appType) {
  const config = normalizeConfig(input);
  assertCapacity(schema, config.charts.length);
  const corpId = client.getAuthRef().corpId;
  if (!corpId) { fail('INVALID_TARGET', 'Authenticated corpId is required'); }
  for (const chart of config.charts) {
    const capability = getReportChartCapability(chart?.type);
    if (!TYPES.includes(chart?.type) || !capability
      || !keys(chart, ['type', 'title', 'formUuid', 'w', 'h', 'columns', 'range', ...(chart.type === 'analysis' ? ['view', 'renderCard'] : []), ...capability.fieldKeys])
      || !validForm(chart.formUuid) || typeof chart.title !== 'string' || !chart.title.trim()
      || (chart.w !== undefined && (!Number.isInteger(chart.w) || chart.w < 1 || chart.w > 6))
      || (chart.h !== undefined && (!Number.isInteger(chart.h) || chart.h < 1 || chart.h > 100))
      || (chart.columns !== undefined && (chart.type !== 'indicator' || !Number.isInteger(chart.columns) || chart.columns < 1 || chart.columns > 4))) {
      fail('INVALID_CONFIG', 'Unsupported chart type, key or layout; use a registered native card chart', { supportedTypes: TYPES });
    }
    if (chart.range !== undefined && (chart.type !== 'gauge' || !keys(chart.range, ['min', 'max'])
      || !Number.isFinite(chart.range.min) || !Number.isFinite(chart.range.max) || chart.range.min >= chart.range.max)) {
      fail('INVALID_CONFIG', 'Gauge range requires finite min < max');
    }
  }
  const sources = new Map();
  async function source(formUuid) {
    if (sources.has(formUuid)) { return sources.get(formUuid); }
    const response = await client.get(`/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`, { formUuid, schemaVersion: 'V5' });
    if (response?.success !== true || response.__needLogin || response.__csrfExpired) {
      fail('API_ERROR', response?.errorMsg || 'getFormSchema', { endpoint: 'getFormSchema', platformErrorCode: response?.errorCode });
    }
    let body;
    try { body = typeof response.content === 'string' ? JSON.parse(response.content) : response.content; }
    catch (_) { fail('INVALID_RESPONSE', 'getFormSchema JSON'); }
    if (!Array.isArray(body?.pages)) { fail('INVALID_RESPONSE', 'getFormSchema'); }
    const fields = [];
    const walk = list => (list || []).forEach(node => {
      if (node.props?.fieldId) { fields.push(node); }
      if (!/TableField|Subform/i.test(node.componentName || '')) { walk(node.children); }
    });
    body.pages.forEach(page => walk(page.componentsTree));
    sources.set(formUuid, fields);
    return fields;
  }
  async function field(formUuid, value, role) {
    if (!keys(value, ['fieldId', 'aggregate', 'label', 'timeGranularity']) || !/^[A-Za-z0-9_]+$/.test(value.fieldId || '')
      || (value.label !== undefined && (typeof value.label !== 'string' || !value.label.trim()))) {
      fail('INVALID_CONFIG', 'Expected a verified fieldId with aggregate and optional label/timeGranularity');
    }
    const matches = (await source(formUuid)).filter(node => node.props.fieldId === value.fieldId);
    if (matches.length !== 1) { fail('SOURCE_FIELD_NOT_FOUND', value.fieldId); }
    const node = matches[0], dataType = FIELD_TYPES[node.componentName];
    const aggregate = value.aggregate || (role === 'measure' ? 'COUNT' : 'NONE');
    if (!dataType || !['NONE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(aggregate)
      || (aggregate !== 'NONE' && aggregate !== 'COUNT' && dataType !== 'DOUBLE')
      || (role === 'measure' && aggregate === 'NONE') || (role === 'dimension' && aggregate !== 'NONE')
      || (value.timeGranularity !== undefined && (dataType !== 'DATE' || !['YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'].includes(value.timeGranularity)))) {
      fail('INVALID_CONFIG', 'Unsupported field type, aggregate, dimension role or date granularity', { fieldId: value.fieldId, componentName: node.componentName, role });
    }
    const label = node.props.label;
    return { fieldCode: value.fieldId, aliasName: value.label || (typeof label === 'string' ? label : label?.zh_CN) || value.fieldId,
      aggregateType: aggregate, dataType, ...(dataType === 'DATE' ? { timeGranularityType: value.timeGranularity || 'DAY' } : {}) };
  }
  const charts = [];
  for (const chart of config.charts) {
    await source(chart.formUuid);
    const normalized = { type: chart.type, title: chart.title, cubeCode: chart.formUuid.replace(/^FORM-/, 'FORM_'),
      ...(chart.type === 'analysis' ? { view: chart.view, renderCard: chart.renderCard } : {}) };
    for (const key of getReportChartCapability(chart.type).fieldKeys) {
      if (chart[key] === undefined) { continue; }
      const values = Array.isArray(chart[key]) ? chart[key] : [chart[key]];
      const role = ['xField', 'groupField', 'locationFields'].includes(key) ? 'dimension' : ['columnFields', 'columns'].includes(key) ? 'column' : 'measure';
      const resolved = await Promise.all(values.map(value => field(chart.formUuid, value, role)));
      if (['valueField', 'assitValueField'].includes(key)) {
        if (resolved.length !== 1) { fail('INVALID_CONFIG', 'Gauge valueField requires exactly one field'); }
        normalized[key] = resolved[0];
      } else { normalized[key] = resolved; }
    }
    const issues = validateChartConfigDetailed(normalized, charts.length);
    if (issues.length) { fail('INVALID_CONFIG', 'Missing chart fields or invalid bindings', { issues }); }
    if (chart.type === 'calendarheatmap' && (normalized.xField?.length !== 1 || normalized.xField[0].dataType !== 'DATE')) {
      fail('INVALID_CONFIG', 'Calendar heatmaps require exactly one native date dimension');
    }
    charts.push(normalized);
  }
  const filters = [];
  for (const filter of config.filters) {
    if (!keys(filter, ['type', 'title', 'formUuid', 'fieldId', 'linkTo']) || filter.type !== 'select'
      || !validForm(filter.formUuid) || typeof filter.title !== 'string' || !filter.title.trim()) {
      fail('INVALID_CONFIG', 'Only native select filters with verified formUuid/fieldId are supported');
    }
    const targets = filter.linkTo === undefined ? config.charts.map((chart, i) => chart.formUuid === filter.formUuid ? i : -1).filter(i => i >= 0) : filter.linkTo;
    if (!Array.isArray(targets) || !targets.length || targets.some(i => !Number.isInteger(i) || config.charts[i]?.formUuid !== filter.formUuid)) {
      fail('INVALID_CONFIG', 'Filter linkTo must reference new charts using the same form; cross-data-source linkage is unsupported');
    }
    const definition = await field(filter.formUuid, { fieldId: filter.fieldId, aggregate: 'NONE', label: filter.title }, 'dimension');
    if (definition.dataType !== 'STRING') { fail('INVALID_CONFIG', 'Select filters require a text or single-select field'); }
    filters.push({ ...filter, targets: [...new Set(targets)], definition });
  }
  const result = JSON.parse(JSON.stringify(schema)), page = result.pages[0], root = page.componentsTree[0];
  const contents = root.children?.filter(node => node.componentName === 'RootContent') || [];
  if (root.componentName !== 'Page' || page.componentsTree.length !== 1 || contents.length !== 1) { fail('INVALID_CONFIG', 'Expected one Page with one RootContent'); }
  const content = contents[0];
  const layout = content.props?.layout || [];
  if (!Array.isArray(layout) || (content.children !== undefined && !Array.isArray(content.children))) { fail('INVALID_CONFIG', 'Invalid existing layout'); }
  let y = layout.reduce((end, item) => {
    if (!Number.isFinite(item.y) || !Number.isFinite(item.h)) { fail('INVALID_CONFIG', 'Existing layout requires finite y/h'); }
    return Math.max(end, item.y + item.h);
  }, 0);
  if ((content.children || []).some(node => !layout.some(item => item.i === node.props?.fieldId))) {
    fail('INVALID_CONFIG', 'Existing components need matching layout entries before appending');
  }
  const built = charts.map((chart, i) => {
    const value = buildChartNode(chart, corpId);
    value.node.props.afterFetch = 'function afterFetch(data, extraInfo) { return data; }';
    if (chart.type === 'indicator') { value.node.props.settings.themeType = 'light'; value.node.props.settings.showSideStyle = 'BGTC'; value.node.props.settings.columnCount = config.charts[i].columns || 2; }
    if (chart.type === 'gauge' && config.charts[i].range) { Object.assign(value.node.props.settings.tick, config.charts[i].range); }
    const h = config.charts[i].h || (chart.type === 'indicator' ? 11 : chart.type === 'table' ? 30 : 22);
    layout.push({ i: value.fieldId, x: 0, y, w: config.charts[i].w || (chart.type === 'table' ? 6 : 3), h, minH: h, maxH: h, static: false, resizeHandles: ['w', 'e'] });
    y += h;
    return value.node;
  });
  content.children = [...(content.children || []), ...built];
  content.props = { ...content.props, layout };
  if (filters.length) {
    const headers = root.children.filter(node => node.componentName === 'RootHeader');
    if (headers.length !== 1 || headers[0].children?.length) { fail('INVALID_CONFIG', 'Appending filters requires an empty RootHeader; export the full schema to extend existing filters safely'); }
    const filterNodes = filters.map(filter => {
      const value = buildSelectFilter({ title: filter.title, cubeCode: filter.formUuid.replace(/^FORM-/, 'FORM_') }, filter.definition, filter.definition, null, corpId);
      for (const i of filter.targets) { injectFilterLinkage(built[i].props.dataSetModelMap, value.__filterMeta__, filter.fieldId, charts[i].cubeCode, corpId); }
      delete value.__filterMeta__;
      return value;
    });
    const container = buildFilterContainer(filterNodes, genFieldId('filter'));
    container.props.cid = container.id;
    container.props.fixed = false;
    headers[0].children = [{ componentName: 'YoushuPageHeader', id: genNodeId(), props: { status: 'normal', showTitle: false, tab: false }, children: [
      { componentName: 'PageHeaderContent', id: genNodeId(), props: {}, children: [container] },
      { componentName: 'PageHeaderTab', id: genNodeId(), props: {}, children: [] },
    ] }];
  }
  page.componentsMap = page.componentsMap || [];
  nodes(result, node => {
    node.id = node.id || genNodeId();
    if (!page.componentsMap.some(entry => entry.componentName === node.componentName)) { page.componentsMap.push(buildReportComponentMapEntry(node.componentName)); }
  });
  return result;
}

module.exports = { TYPES, assertCapacity, buildCardConfig };
