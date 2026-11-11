'use strict';
const fs = require('fs');
const path = require('path');
const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const { buildChartNode } = require('../lib/report/chart-builder');
const { validateChartConfigDetailed } = require('../lib/report/validation');

test('analysis schema retains native formula and date grain alongside editable display code', () => {
  const renderCard = 'function renderCard({ React, rows }) { return React.createElement("div", null, rows.length); }';
  const result = buildChartNode({ type: 'analysis', cubeCode: 'FORM_TEST', view: 'bar', renderCard,
    xField: { fieldCode: 'dateField_time', dataType: 'DATE', timeGranularityType: 'MONTH' },
    yField: [{ fieldCode: 'numberField_amount', dataType: 'DOUBLE', aggregateType: 'SUM', expression: 'SUM(amount)' }],
  });
  expect(result.node.componentName).toBe('YoushuAnalysisCard');
  expect(result.node.props.settings).toMatchObject({ view: 'bar', renderCard });
  const definitions = result.node.props.dataSetModelMap.chartData.dataViewQueryModel.fieldDefinitionList;
  expect(definitions[0]).toMatchObject({ timeGranularityType: 'MONTH' });
  expect(definitions[1]).toMatchObject({ expression: 'SUM(amount)' });
  expect(result.node.props.dataSetModelMap.chartData.yField[0].expression).toBe('SUM(amount)');
  expect(result.node.props.userConfig[0].items[0].setterProps.showDrillTab).toBe(true);
});

test('live Canvas template delegates queries and native card references to the integrated host', () => {
  const source = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-analysis-card.canvas.jsx'), 'utf8');
  const { runtimeCode } = compileCanvasLocal(source);
  const host = props => React.createElement('div', null, props.cardCode);
  const canvasWindow = { React, __VcDeepYidaUtils__: { YidaAnalysisCard: host } };
  const Component = new Function('window', runtimeCode + '; return YidaComp;')(canvasWindow);
  const query = { version: 1, cubeCode: 'FORM_TEST' };
  const element = Component({ nativeCardCode: 'CARD-test', query });
  expect(element.type).toBe(host); expect(element.props.cardCode).toBe('CARD-test'); expect(element.props.query).toBe(query);
  canvasWindow.__VcDeepYidaUtils__ = undefined;
  expect(Component({ query }).props.role).toBe('alert');
});


test('CLI generates the editable native analysis config without a packaged template file', async () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-analysis-card-'));
  try {
    const output = path.join(dir, 'analysis-card.json');
    await require('../lib/core/sample').run(['openyida-page-template', 'analysis-card-config', '--output', output]);
    const [chart] = JSON.parse(fs.readFileSync(output, 'utf8')).charts;
    expect(chart).toMatchObject({ type: 'analysis', formUuid: 'FORM-REPLACE', view: 'bar' });
    expect(chart.yField[0].aggregate).toBe('SUM');
    const { renderCard } = buildChartNode({
      ...chart,
      cubeCode: 'FORM_TEST',
      xField: { fieldCode: 'selectField_region' },
      yField: [{ fieldCode: 'numberField_sales', aggregateType: 'SUM' }],
    }).node.props.settings;
    expect(renderCard.importedModules).toEqual(['antd', 'react', 'recharts']);
    const Button = () => null;
    const BarChart = () => null;
    const reportModule = { exports: {} };
    const dependencies = { react: React, antd: { Button }, recharts: { BarChart } };
    new Function('require', 'module', 'exports', renderCard.runtimeCode)(
      (name) => dependencies[name], reportModule, reportModule.exports
    );
    const Component = reportModule.exports.default;
    const refresh = () => {};
    const card = Component({ analysis: {
      rows: [{ label: '华东', value: 30000 }],
      columns: [{ key: 'label' }, { key: 'value', numeric: true }],
      refresh,
    } });
    expect(card.children[0]).toMatchObject({ type: Button, props: { onClick: refresh } });
    expect(card.children[1].children[0]).toMatchObject({
      type: BarChart,
      props: { data: [{ label: '华东', value: 30000, row: { label: '华东', value: 30000 } }] },
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('report validation rejects a Canvas dependency unavailable in the report host', () => {
  const result = validateChartConfigDetailed({
    type: 'analysis',
    view: 'donut',
    cubeCode: 'FORM_TEST',
    xField: 'selectField_region',
    yField: ['numberField_sales'],
    renderCard: { source: "import { useRequest } from 'ahooks'; export default () => useRequest;" },
  });
  expect(result).toContainEqual(expect.objectContaining({
    code: 'REPORT_ANALYSIS_CONFIG_INVALID',
    message: expect.stringContaining('ahooks'),
  }));
});
