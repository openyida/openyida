'use strict';

const { buildDataSetModelMap } = require('../lib/report/data-model');
const { validateChartConfig } = require('../lib/report/chart-builder');

const CUBE_CODE = 'FORM_REPORT_GRANULARITY';

function dateField(timeGranularityType) {
  return {
    fieldCode: 'dateField_hireDate',
    aliasName: '入职日期',
    dataType: 'DATE',
    aggregateType: 'NONE',
    ...(timeGranularityType ? { timeGranularityType } : {}),
  };
}

const chartCases = [
  {
    name: '通用图表',
    chart: (granularity) => ({
      type: 'bar',
      cubeCode: CUBE_CODE,
      xField: dateField(granularity),
      yField: [{ fieldCode: 'pid', aliasName: '人数', aggregateType: 'COUNT' }],
    }),
    dataSetKey: 'chartData',
    displayFieldKey: 'xField',
  },
  {
    name: '组合图',
    chart: (granularity) => ({
      type: 'combo',
      cubeCode: CUBE_CODE,
      xField: dateField(granularity),
      leftYFields: [{ fieldCode: 'numberField_total', aliasName: '人数', aggregateType: 'SUM' }],
    }),
    dataSetKey: 'dataSetName',
    displayFieldKey: 'xField',
  },
  {
    name: '基础表格',
    chart: (granularity) => ({
      type: 'table',
      cubeCode: CUBE_CODE,
      columnFields: [dateField(granularity)],
    }),
    dataSetKey: 'table',
    displayFieldKey: 'columnFields',
  },
  {
    name: '交叉透视表',
    chart: (granularity) => ({
      type: 'pivot',
      cubeCode: CUBE_CODE,
      columnList: [dateField(granularity)],
    }),
    dataSetKey: 'dataSetName',
    displayFieldKey: 'columnList',
  },
  {
    name: '仪表盘',
    chart: (granularity) => ({
      type: 'gauge',
      cubeCode: CUBE_CODE,
      valueField: dateField(granularity),
    }),
    dataSetKey: 'chartData',
    displayFieldKey: 'valueField',
  },
];

describe('report timeGranularityType', () => {
  test.each(chartCases)('$name 将 YEAR 同时写入查询模型和展示字段', ({ chart, dataSetKey, displayFieldKey }) => {
    const dataSet = buildDataSetModelMap(chart('YEAR'), 'corp-1')[dataSetKey];

    expect(dataSet.dataViewQueryModel.fieldDefinitionList[0].timeGranularityType).toBe('YEAR');
    expect(dataSet[displayFieldKey][0]).toMatchObject({
      timeGranularityType: 'YEAR',
      timeFormat: 'yyyy',
    });
  });

  test.each([
    ['YEAR', 'yyyy'],
    ['MONTH', 'yyyy-MM'],
    ['DAY', 'yyyy-MM-dd'],
    ['HOUR', 'yyyy-MM-dd HH'],
    ['MINUTE', 'yyyy-MM-dd HH:mm'],
    ['SECOND', 'yyyy-MM-dd HH:mm:ss'],
  ])('%s 使用匹配的展示格式', (granularity, timeFormat) => {
    const dataSet = buildDataSetModelMap(chartCases[0].chart(granularity), 'corp-1').chartData;

    expect(dataSet.dataViewQueryModel.fieldDefinitionList[0].timeGranularityType).toBe(granularity);
    expect(dataSet.xField[0]).toMatchObject({
      timeGranularityType: granularity,
      timeFormat,
    });
  });

  test('日期字段缺省粒度保持 DAY，非日期字段保持 null', () => {
    const dataSet = buildDataSetModelMap({
      type: 'bar',
      cubeCode: CUBE_CODE,
      xField: dateField(),
      yField: [{ fieldCode: 'pid', aliasName: '人数', aggregateType: 'COUNT' }],
    }, 'corp-1').chartData;

    expect(dataSet.dataViewQueryModel.fieldDefinitionList.map((field) => field.timeGranularityType)).toEqual([
      'DAY',
      null,
    ]);
    expect(dataSet.xField[0]).toMatchObject({
      timeGranularityType: 'DAY',
      timeFormat: 'yyyy-MM-dd',
    });
  });

  test.each(['QUARTER', 'WEEK', 'DECADE'])('%s 不能通过配置校验，也不能被构建器静默回落', (granularity) => {
    const chart = chartCases[0].chart(granularity);

    expect(validateChartConfig(chart, 0)).toBe(false);
    expect(() => buildDataSetModelMap(chart, 'corp-1')).toThrow(
      new RegExp(`timeGranularityType.*${granularity}`)
    );
  });
});
