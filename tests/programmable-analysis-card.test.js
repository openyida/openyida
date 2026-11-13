'use strict';
const fs = require('fs');
const path = require('path');
const React = { createElement: (type, props, ...children) => ({ type, props, children }), useState: () => [true, () => {}] };
const find = (node, type) => Array.isArray(node) ? node.flatMap(child => find(child, type)) :
  !node || typeof node !== 'object' ? [] : [...(node.type === type ? [node] : []), ...find(node.children || [], type)];
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const { buildChartNode } = require('../lib/report/chart-builder');
const { validateChartConfigDetailed } = require('../lib/report/validation');

test('metric component distinguishes zero, unknown, failure and a real target', () => {
  const source = fs.readFileSync(path.join(__dirname, '../lib/samples/yida-custom-chart-comp/analysis-metric.canvas.jsx'), 'utf8');
  const { runtimeCode } = compileCanvasLocal(source);
  const Metric = new Function('window', runtimeCode + '; return YidaComp;')({ React });
  const value = tree => find(tree, 'div').find(node => node.props?.className === 'mc-value').children[0];
  expect(value(Metric({ value: 0 }))).toBe('0');
  expect(value(Metric({}))).toBe('—');
  expect(find(Metric({ value: 20, target: 0 }), 'progress')).toHaveLength(0);
  expect(find(Metric({ value: 120, target: 100 }), 'progress')[0].props.value).toBe(100);
  expect(find(Metric({ value: 20, error: 'denied' }), 'div')).toHaveLength(0);
});

test('chart component exposes original rows for range and selection without modifying source data', () => {
  const source = fs.readFileSync(path.join(__dirname, '../lib/samples/yida-custom-chart-comp/analysis-chart.canvas.jsx'), 'utf8');
  const { runtimeCode } = compileCanvasLocal(source);
  const Brush = () => null; const Bar = () => null;
  const react = { ...React, useEffect() {}, useMemo: fn => fn(), useState: initial => [initial, () => {}] };
  const Chart = new Function('window', runtimeCode + '; return YidaComp;')({ React: react, Recharts: { Brush, Bar } });
  const rows = Object.freeze([Object.freeze({ label: 'Jan', value: 10 }), Object.freeze({ label: 'Feb', value: 20 })]);
  const onRangeChange = jest.fn(); const onSelect = jest.fn();
  const tree = Chart({ rows, onRangeChange, range: { startIndex: 0, endIndex: 1 } });
  find(tree, Brush)[0].props.onChange({ startIndex: 1, endIndex: 99 });
  expect(onRangeChange).toHaveBeenCalledWith({ startIndex: 1, endIndex: 1 }, [rows[1]]);
  find(tree, 'button').find(node => node.children.includes('重置区间')).props.onClick();
  expect(onRangeChange).toHaveBeenLastCalledWith(null, rows);
  find(Chart({ rows, kind: 'ranking', onSelect }), Bar)[0].props.onClick({ payload: { raw: rows[0] } });
  expect(onSelect).toHaveBeenCalledWith(rows[0]);
});

test('explorer links selection, tabs, brush scope and safe CSV to the same raw rows', () => {
  const source = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/analysis-card-explorer.canvas.jsx'), 'utf8');
  const { runtimeCode } = compileCanvasLocal(source);
  const states = []; const memos = []; let memoCursor = 0; let cursor = 0; let downloaded;
  const react = { ...React, useMemo(fn, deps) {
    const i = memoCursor++; const previous = memos[i];
    if (!previous || deps.some((value, index) => value !== previous.deps[index])) {memos[i] = { deps, value: fn() };}
    return memos[i].value;
  }, useEffect() {}, useRef: () => ({ current: null }), useState(initial) {
    const i = cursor++; if (!(i in states)) {states[i] = initial;}
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
  } };
  const Brush = () => null; const AreaChart = () => null;
  const win = { React: react, Recharts: { Brush, AreaChart }, Blob: class { constructor(parts) { downloaded = parts.join(''); } }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout: fn => fn() };
  const doc = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  const Component = new Function('window', 'document', runtimeCode + '; return YidaComp;')(win, doc);
  const raw = [{ label: '=SUM(A1)', value: 10 }, { label: 'B', value: -20 }];
  const select = jest.fn();
  const analysis = { rows: raw, columns: [{ key: 'label' }, { key: 'value', numeric: true }], select };
  const render = () => { cursor = 0; memoCursor = 0; return Component({ analysis, temporal: true }); };
  const button = (tree, label) => {
    const native = find(tree, 'button').find(node => node.children.includes(label));
    if (native) return native;
    const findAction = node => {
      if (Array.isArray(node)) return node.map(findAction).find(Boolean);
      if (!node || typeof node !== 'object') return undefined;
      if (typeof node.type === 'function' && node.props?.label === label) return node.type(node.props);
      return findAction(node.children);
    };
    const action = findAction(tree);
    expect(action?.props?.['aria-label']).toBe(label);
    return action;
  };
  let tree = render();
  button(tree, '=SUM(A1)').props.onClick();
  tree = render(); button(tree, '下钻所选分组').props.onClick();
  expect(select).toHaveBeenCalledWith(raw[0]);
  button(tree, '数据表').props.onClick();
  tree = render(); expect(find(tree, 'tbody')[0].children[0]).toHaveLength(1);
  button(tree, '导出当前结果 CSV').props.onClick();
  expect(downloaded).toContain("'=SUM(A1)"); expect(downloaded).not.toContain('"B"');
  button(tree, '清除选择').props.onClick(); button(tree, '图表').props.onClick();
  tree = render(); const chartData = find(tree, AreaChart)[0].props.data; find(tree, Brush)[0].props.onChange({ startIndex: 1, endIndex: 1 });
  tree = render(); expect(find(tree, AreaChart)[0].props.data).toBe(chartData); button(tree, '导出当前结果 CSV').props.onClick();
  expect(downloaded).toContain('"B"'); expect(downloaded).not.toContain('SUM(A1)');
  expect(downloaded).toContain('"-20"');
});

test('analysis schema retains native formula and date grain alongside editable display code', () => {
  const renderCard = 'function renderCard({ React, rows }) { return React.createElement("div", null, rows.length); }';
  const result = buildChartNode({ type: 'analysis', cubeCode: 'FORM_TEST', view: 'bar', renderCard,
    xField: { fieldCode: 'dateField_time', dataType: 'DATE', timeGranularityType: 'MONTH' },
    yField: [{ fieldCode: 'numberField_amount', dataType: 'DOUBLE', aggregateType: 'SUM', expression: 'SUM(amount)' }],
  });
  expect(result.node.componentName).toBe('YoushuAnalysisCard');
  expect(result.node.props.settings).toMatchObject({ renderCard });
  expect(result.node.props.settings.view).toBeUndefined();
  expect(buildChartNode({ type: 'analysis', cubeCode: 'FORM_TEST', view: 'bar', xField: { fieldCode: 'category' }, yField: [{ fieldCode: 'amount', aggregateType: 'SUM' }] }).node.props.settings.view).toBe('bar');
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
  const canvasWindow = { React, antd: {}, Recharts: {}, __VcDeepYidaUtils__: { YidaAnalysisCard: host } };
  const Component = new Function('window', runtimeCode + '; return YidaComp;')(canvasWindow);
  const query = { version: 1, cubeCode: 'FORM_TEST' };
  const element = Component({ nativeCardCode: 'CARD-test', query });
  expect(element.type).toBe(host); expect(element.props.cardCode).toBe('CARD-test'); expect(element.props.query).toBe(query);
  canvasWindow.__VcDeepYidaUtils__ = undefined;
  expect(Component({ query }).props.role).toBe('alert');
});


test('CLI generates a multi-chart source shared by standalone and native report templates', async () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-analysis-card-'));
  try {
    const output = path.join(dir, 'analysis-card.json');
    await require('../lib/core/sample').run(['openyida-page-template', 'analysis-card-config', '--output', output]);
    const [chart] = JSON.parse(fs.readFileSync(output, 'utf8')).charts;
    expect(chart).toMatchObject({ type: 'analysis', formUuid: 'FORM-REPLACE', view: 'bar' });
    expect(chart.yField[0].aggregateType).toBe('SUM');
    expect(validateChartConfigDetailed({ ...chart, cubeCode: 'FORM_TEST' })).toEqual([]);
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
    const PieChart = () => null;
    const dependencies = { react: React, antd: { Button }, recharts: { BarChart, PieChart } };
    const Action = new Function('require', 'module', 'exports', renderCard.runtimeCode + '\nreturn AnalysisAction;')(
      (name) => dependencies[name], reportModule, reportModule.exports
    );
    const Component = reportModule.exports.default;
    const refresh = () => {};
    const card = Component({ analysis: {
      rows: [{ label: '华东', value: 30000 }],
      columns: [{ key: 'label' }, { key: 'value', numeric: true }],
      refresh,
    } });
    const refreshAction = find(card, Action).find(button => button.props.kind === 'refresh');
    expect(Action(refreshAction.props).props).toMatchObject({
      'aria-label': '刷新数据', title: '刷新数据', onClick: refresh,
    });
    expect(find(card, BarChart)[0]).toMatchObject({
      type: BarChart,
      props: { data: [{ index: 0, label: '华东', value: 30000, row: { label: '华东', value: 30000 } }] },
    });
    expect(find(card, PieChart)).toHaveLength(1);
    expect(chart.renderCard.source).toBe(fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/analysis-card-content.canvas.jsx'), 'utf8'));
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
