'use strict';

function capability(type, componentName, dataSetKey, layout, roles, options = {}) {
  return Object.freeze({
    type,
    componentName,
    dataSetKey,
    layout: Object.freeze({ ...layout }),
    roles: Object.freeze(roles.map(role => Object.freeze({
      ...role,
      anyOf: Object.freeze([...role.anyOf]),
    }))),
    fieldKeys: Object.freeze([...(options.fieldKeys || roles.flatMap(role => role.anyOf))]),
    isHeightAuto: options.isHeightAuto === true,
    showFieldSelectIcon: options.showFieldSelectIcon === true,
  });
}

const REPORT_CHART_CAPABILITIES = Object.freeze({
  bar: capability('bar', 'YoushuGroupedBarChart', 'chartData', { w: 3, h: 22 }, [
    { code: 'xField', anyOf: ['xField', 'fields'], min: 1 },
    { code: 'yField', anyOf: ['yField', 'fields'], min: 1 },
  ], { fieldKeys: ['xField', 'yField', 'groupField', 'fields'] }),
  combo: capability('combo', 'YoushuComboChart', 'dataSetName', { w: 6, h: 22 }, [
    { code: 'xField', anyOf: ['xField'], min: 1 },
    { code: 'yAxisField', anyOf: ['leftYFields', 'rightYFields'], min: 1 },
  ]),
  funnel: capability('funnel', 'YoushuFunnelChart', 'chartData', { w: 3, h: 22 }, [
    { code: 'xField', anyOf: ['xField', 'fields'], min: 1 },
    { code: 'yField', anyOf: ['yField', 'fields'], min: 1 },
  ], { fieldKeys: ['xField', 'yField', 'fields'] }),
  gauge: capability('gauge', 'YoushuGauge', 'chartData', { w: 2, h: 18 }, [
    { code: 'valueField', anyOf: ['valueField', 'yField'], min: 1 },
  ], { fieldKeys: ['valueField', 'yField', 'assitValueField'] }),
  indicator: capability('indicator', 'YoushuSimpleIndicatorCard', 'youshuData', { w: 6, h: 6 }, [
    { code: 'kpi', anyOf: ['kpi', 'kpiField', 'yField', 'fields'], min: 1 },
  ], {
    fieldKeys: ['kpi', 'kpiField', 'yField', 'fields', 'helpKpi'],
    isHeightAuto: true,
    showFieldSelectIcon: true,
  }),
  line: capability('line', 'YoushuLineChart', 'chartData', { w: 3, h: 22 }, [
    { code: 'xField', anyOf: ['xField', 'fields'], min: 1 },
    { code: 'yField', anyOf: ['yField', 'fields'], min: 1 },
  ], { fieldKeys: ['xField', 'yField', 'groupField', 'fields'] }),
  calendarheatmap: capability('calendarheatmap', 'YoushuCalendarHeatmap', 'chartData', { w: 3, h: 22 }, [
    { code: 'dateField', anyOf: ['xField'], min: 1 },
    { code: 'valueField', anyOf: ['yField'], min: 1 },
  ]),
  map: capability('map', 'YoushuMap', 'chartData', { w: 3, h: 24 }, [
    { code: 'locationField', anyOf: ['locationFields', 'xField'], min: 1 },
    { code: 'valueField', anyOf: ['valueField', 'yField'], min: 1 },
  ], { fieldKeys: ['locationFields', 'xField', 'valueField', 'yField'] }),
  pie: capability('pie', 'YoushuPieChart', 'chartData', { w: 3, h: 22 }, [
    { code: 'xField', anyOf: ['xField', 'fields'], min: 1 },
    { code: 'yField', anyOf: ['yField', 'fields'], min: 1 },
  ], { fieldKeys: ['xField', 'yField', 'fields'] }),
  pivot: capability('pivot', 'YoushuCrossPivotTable', 'dataSetName', { w: 6, h: 30 }, [
    { code: 'columnList', anyOf: ['columnList', 'columns'], min: 1 },
  ], { isHeightAuto: true }),
  table: capability('table', 'YoushuTable', 'table', { w: 6, h: 38 }, [
    { code: 'columnFields', anyOf: ['columnFields', 'columns', 'fields'], min: 1 },
  ], { isHeightAuto: true, showFieldSelectIcon: true }),
});

const REPORT_BASE_COMPONENTS = Object.freeze(['YoushuPageHeader']);

function normalizeReportChartType(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : '';
}

function getReportChartCapability(type) {
  const normalized = normalizeReportChartType(type);
  return normalized && Object.prototype.hasOwnProperty.call(REPORT_CHART_CAPABILITIES, normalized)
    ? REPORT_CHART_CAPABILITIES[normalized]
    : null;
}

function listReportChartTypes() {
  return Object.keys(REPORT_CHART_CAPABILITIES).sort();
}

module.exports = Object.freeze({
  REPORT_BASE_COMPONENTS,
  REPORT_CHART_CAPABILITIES,
  getReportChartCapability,
  listReportChartTypes,
  normalizeReportChartType,
});
