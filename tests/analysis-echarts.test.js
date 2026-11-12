'use strict';
const fs = require('fs');
const path = require('path');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const source = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/analysis-echarts.canvas.jsx'), 'utf8');
const { runtimeCode } = compileCanvasLocal(source);
const load = (window = {}, document = {}) => new Function('window', 'document', 'setTimeout', 'clearTimeout',
  runtimeCode + ';return {analysisChartOption,loadAnalysisCharts};')(Object.assign(window, { React: {} }), document, () => 1, () => {});
const option = load().analysisChartOption;

test('boxplot requires an ordered five-number summary, never infers quantiles', () => {
  const row = { name: 'A', values: [1, 3, 4, 6, 9] };
  expect(option('boxplot', [row]).series[0].data[0]).toEqual({ value: row.values, raw: row });
  expect(() => option('boxplot', [{ name: 'A', values: [1, 3, 2, 6, 9] }])).toThrow('五数摘要');
  expect(() => option('boxplot', [{ name: 'A', values: [1, 3, 4] }])).toThrow('五数摘要');
});
test('composition, radar, funnel and heatmap reject misleading inputs', () => {
  expect(() => option('pie', [{ name: 'A', value: -1 }])).toThrow('非负');
  expect(() => option('radar', { indicators: [{ name: 'A', max: 1 }], series: [] })).toThrow('三个');
  expect(() => option('funnel', [{ name: 'A', value: 2 }, { name: 'B', value: 3 }])).toThrow('转化');
  expect(() => option('heatmap', { x: ['A'], y: ['B'], cells: [[1, 0, 3]] })).toThrow('超出范围');
  expect(() => option('gauge', { value: 110 })).toThrow('0–100');
});
test('area retains missing values and raw-row selection; stacking is explicit', () => {
  const rows = Object.freeze([{ name: 'Jan', value: 0 }, { name: 'Feb', value: null }]);
  const result = option('area', rows);
  expect(result.series[0].data.map(r => r.value)).toEqual([0, null]);
  expect(result.series[0].data[0].raw).toBe(rows[0]);
  expect(result.series[0].stack).toBeUndefined();
  expect(option('stacked-area', rows).series[0].stack).toBe('total');
});
test('all chart families produce their intended series', () => {
  const points = [{ name: 'A', value: 5 }];
  for (const kind of ['pie', 'donut', 'rose']) {expect(option(kind, points).series[0].type).toBe('pie');}
  for (const kind of ['line', 'area', 'stacked-area']) {expect(option(kind, points).series[0].type).toBe('line');}
  for (const kind of ['bar', 'stacked-bar']) {expect(option(kind, points).series[0].type).toBe('bar');}
  for (const kind of ['scatter', 'bubble']) {expect(option(kind, [{ x: 1, y: 2, size: 3 }]).series[0].type).toBe('scatter');}
  for (const kind of ['treemap', 'sunburst', 'funnel']) {expect(option(kind, points).series[0].type).toBe(kind);}
  expect(option('wordcloud', points).series[0].type).toBe('wordCloud');
  expect(option('sankey', { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: 2 }] }).series[0].type).toBe('sankey');
});
test('concurrent cards share scripts and wordcloud loads after ECharts', async () => {
  const scripts = [], window = {};
  const document = { createElement: () => ({ remove() {} }), head: { appendChild: s => scripts.push(s) } };
  const api = load(window, document);
  const a = api.loadAnalysisCharts(true), b = api.loadAnalysisCharts(true);
  expect(scripts).toHaveLength(1);
  window.echarts = { version: '5.6.0' }; scripts[0].onload();
  await Promise.resolve(); await Promise.resolve();
  expect(scripts).toHaveLength(2);
  window['echarts-wordcloud'] = {}; scripts[1].onload();
  expect(await a).toBe(window.echarts); expect(await b).toBe(window.echarts);
});
test('failed library loads are retryable and existing incompatible versions are preserved', async () => {
  const scripts = [], window = {};
  const api = load(window, { createElement: () => ({ remove() {} }), head: { appendChild: s => scripts.push(s) } });
  const pending = api.loadAnalysisCharts(); scripts[0].onerror();
  await expect(pending).rejects.toThrow('加载失败');
  const retry = api.loadAnalysisCharts(); expect(scripts).toHaveLength(2);
  window.echarts = { version: '5.6.0' }; scripts[1].onload(); await retry;
  window.echarts = { version: '6.0.0' };
  await expect(api.loadAnalysisCharts()).rejects.toThrow('版本不一致');
  expect(window.echarts.version).toBe('6.0.0');
});

test('shared legend appearance preserves interaction, layout and multiple legend groups', () => {
  const withAppearance = new Function('window', runtimeCode + ';return withAnalysisAppearance;')({ React: {} });
  const appearance = { echartsLegend: { itemWidth:20, itemHeight:20, icon:'path://M0,0H20V20Z', textStyle:{fontSize:16} } };
  const original = { legend:[{ bottom:0, selected:{A:false}, textStyle:{color:'red'} }, {right:0}], series:[{name:'A'}] };
  const result = withAppearance(original, appearance);
  expect(result.legend[0].selected).toEqual({A:false});
  expect(result.legend[0].bottom).toBe(0);
  expect(result.legend[0].textStyle).toEqual({color:'red',fontSize:16});
  expect(result.legend[1].itemHeight).toBe(20);
  expect(original.legend[0].itemHeight).toBeUndefined();
  expect(withAppearance(original,undefined)).toBe(original);
  expect(withAppearance({series:[]},appearance).legend).toBeUndefined();
});
