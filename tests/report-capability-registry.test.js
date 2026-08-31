'use strict';

const fs = require('fs');
const path = require('path');

const {
  REPORT_CHART_CAPABILITIES,
  getReportChartCapability,
  listReportChartTypes,
} = require('../lib/report/capability-registry');
const chartBuilder = require('../lib/report/chart-builder');
const { validateChartConfig, buildReportSchema } = chartBuilder;
const { buildDataSetModelMap } = require('../lib/report/data-model');

const SUPPORTED_TYPES = [
  'bar',
  'calendarheatmap',
  'combo',
  'funnel',
  'gauge',
  'indicator',
  'line',
  'map',
  'pie',
  'pivot',
  'table',
];

describe('report capability registry', () => {
  test('only exposes chart types with an implemented component and dataset contract', () => {
    expect(listReportChartTypes()).toEqual(SUPPORTED_TYPES);
    for (const type of SUPPORTED_TYPES) {
      expect(getReportChartCapability(type)).toMatchObject({
        type,
        componentName: expect.stringMatching(/^Youshu/),
        dataSetKey: expect.any(String),
        layout: {
          w: expect.any(Number),
          h: expect.any(Number),
        },
      });
    }
    expect(Object.keys(REPORT_CHART_CAPABILITIES).sort()).toEqual(SUPPORTED_TYPES);
  });

  test.each(['scatter', 'area', 'radar', 'heatmap', 'wordcloud', 'number', 'unknown'])('%s fails closed', (type) => {
    expect(getReportChartCapability(type)).toBeNull();
    expect(validateChartConfig({
      type,
      cubeCode: 'FORM_1',
      xField: { fieldCode: 'textField_1' },
      yField: [{ fieldCode: 'numberField_1' }],
    }, 0)).toBe(false);
  });

  test('does not export builders for unsupported legacy chart types', () => {
    expect(chartBuilder).not.toHaveProperty('buildScatterChartSettings');
    expect(chartBuilder).not.toHaveProperty('buildAreaChartSettings');
    expect(chartBuilder).not.toHaveProperty('buildRadarChartSettings');
    expect(chartBuilder).not.toHaveProperty('buildNumberChartSettings');
  });

  test('map and calendar heatmap build platform-shaped datasets', () => {
    const mapData = buildDataSetModelMap({
      type: 'map', cubeCode: 'FORM_1',
      locationFields: [
        { fieldCode: 'addressField_1_province_value', aliasName: '省' },
        { fieldCode: 'addressField_1_city_value', aliasName: '市' },
      ],
      valueField: { fieldCode: 'pid', aliasName: '订单量', aggregateType: 'COUNT' },
    }, 'corp-1').chartData;
    expect(mapData.name).toHaveLength(2);
    expect(mapData.value).toHaveLength(1);
    expect(mapData.dataViewQueryModel.fieldDefinitionList).toHaveLength(3);

    const calendarData = buildDataSetModelMap({
      type: 'calendarHeatmap', cubeCode: 'FORM_1',
      xField: { fieldCode: 'dateField_1', dataType: 'DATE', timeGranularityType: 'DAY' },
      yField: { fieldCode: 'pid', aggregateType: 'COUNT' },
    }, 'corp-1').chartData;
    expect(calendarData.xField[0]).toMatchObject({ timeGranularityType: 'DAY' });
    expect(calendarData.yField[0]).toMatchObject({ aggregateType: 'COUNT' });

    const schema = buildReportSchema('复杂图表', [
      {
        type: 'map', cubeCode: 'FORM_1',
        locationFields: [{ fieldCode: 'addressField_1_province_value' }],
        valueField: { fieldCode: 'pid', aggregateType: 'COUNT' },
      },
      {
        type: 'calendarHeatmap', cubeCode: 'FORM_1',
        xField: { fieldCode: 'dateField_1', dataType: 'DATE' },
        yField: { fieldCode: 'pid', aggregateType: 'COUNT' },
      },
    ], 'REPORT_1', 'corp-1');
    const names = JSON.stringify(schema);
    expect(names).toContain('YoushuMap');
    expect(names).toContain('YoushuCalendarHeatmap');
  });

  test('missing chart type fails closed instead of becoming bar', () => {
    expect(validateChartConfig({
      cubeCode: 'FORM_1',
      xField: { fieldCode: 'textField_1' },
      yField: [{ fieldCode: 'numberField_1' }],
    }, 0)).toBe(false);
  });

  test('dataset and schema builders also reject unsupported types without fallback', () => {
    const chart = {
      type: 'radar',
      cubeCode: 'FORM_1',
      xField: { fieldCode: 'textField_1' },
      yField: [{ fieldCode: 'numberField_1' }],
    };
    expect(() => buildDataSetModelMap(chart, 'corp-1')).toThrow(expect.objectContaining({
      code: 'REPORT_CHART_TYPE_UNSUPPORTED',
    }));
    expect(() => buildReportSchema('Unsupported', [chart], 'REPORT_1', 'corp-1')).toThrow(expect.objectContaining({
      code: 'REPORT_CHART_TYPE_UNSUPPORTED',
    }));
  });

  test('combo roles require xField and at least one owned y-axis field', () => {
    expect(validateChartConfig({
      type: 'combo',
      cubeCode: 'FORM_1',
      leftYFields: [{ fieldCode: 'numberField_1' }],
    }, 0)).toBe(false);
    expect(validateChartConfig({
      type: 'combo',
      cubeCode: 'FORM_1',
      xField: { fieldCode: 'textField_1' },
    }, 0)).toBe(false);
    expect(validateChartConfig({
      type: 'combo',
      cubeCode: 'FORM_1',
      xField: { fieldCode: 'textField_1' },
      rightYFields: [{ fieldCode: 'numberField_1' }],
    }, 0)).toBe(true);
  });

  test('skill documentation names exactly the runtime-supported chart types', () => {
    const skill = fs.readFileSync(path.join(__dirname, '..', 'yida-skills', 'skills', 'yida-report', 'SKILL.md'), 'utf8');
    const match = skill.match(/<!-- runtime-supported-chart-types: ([^>]+) -->/);
    expect(match).not.toBeNull();
    expect(match[1].split(',').map(value => value.trim()).sort()).toEqual(SUPPORTED_TYPES);
  });
});
