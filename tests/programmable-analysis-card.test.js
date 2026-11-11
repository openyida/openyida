'use strict';
const fs = require('fs');
const path = require('path');
const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const { buildChartNode } = require('../lib/report/chart-builder');

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
