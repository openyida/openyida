'use strict';

const fs = require('fs');
const path = require('path');
const { lintYidaSource } = require('../lib/app/page-linter');

describe('page linter', () => {
  test('accepts curated product homepage template', () => {
    const sourcePath = path.join(__dirname, '..', 'lib', 'samples', 'yida-custom-page', 'product-homepage.jsx');
    const source = fs.readFileSync(sourcePath, 'utf-8');
    const result = lintYidaSource(source, sourcePath);

    expect(result.errors).toHaveLength(0);
  });

  test('catches common plain React patterns that break in Yida custom pages', () => {
    const source = `
import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  return <input value={count} onClick={this.handleClick} />;
}
`;

    const result = lintYidaSource(source, '/tmp/plain-react.jsx');
    const errorRules = result.errors.map(issue => issue.rule);

    expect(errorRules).toContain('missing-render-jsx');
    expect(errorRules).toContain('import-require');
    expect(errorRules).toContain('react-hooks');
    expect(errorRules).toContain('export-default');
    expect(errorRules).toContain('event-direct-method');
    expect(errorRules).toContain('controlled-input');
  });

  test('flags Yida runtime traps in otherwise JSX-shaped pages', () => {
    const source = `
export function renderJsx() {
  var rows = [];
  return <div>{rows.map(function(row) { return <button onClick={function(e) { this.open(row); }}>{row.name}</button>; })}</div>;
}

export function loadRows() {
  this.utils.yida.searchFormDatas({ formUuid: 'FORM-XXX', pageSize: 200 });
}
`;

    const result = lintYidaSource(source, '/tmp/yida-page.jsx');
    const errorRules = result.errors.map(issue => issue.rule);
    const warningRules = result.warnings.map(issue => issue.rule);

    expect(errorRules).toContain('event-function');
    expect(errorRules).toContain('array-callback-function');
    expect(errorRules).toContain('page-size-limit');
    expect(warningRules).toContain('yida-api-catch');
  });

  test('blocks lifecycle typos and event handlers that render but do not bind', () => {
    const source = `
export function didmount() {}
export function componentDidMount() {}
export function renderJsx() {
  var self = this;
  return (
    <div>
      <button onclick={(e) => { self.save(e); }}>lowercase</button>
      <button onClick={self.save()}>called during render</button>
      <button onClick={(e) => self.save}>never called</button>
      <button style={{ color: 'red' }}>looks clickable but is static</button>
      <input
        value="bad"
        onChange={(e) => { self.save(e); }}
      />
    </div>
  );
}
export function save() {}
`;

    const result = lintYidaSource(source, '/tmp/events.jsx');
    const errorRules = result.errors.map(issue => issue.rule);

    expect(errorRules).toContain('lifecycle-case');
    expect(errorRules).toContain('react-lifecycle-method');
    expect(errorRules).toContain('event-lowercase');
    expect(errorRules).toContain('event-call-result');
    expect(errorRules).toContain('event-noop-arrow');
    expect(errorRules).toContain('button-missing-handler');
    expect(errorRules).toContain('controlled-input');
  });

  test('allows function callbacks that do not use this and supports line-level disables', () => {
    const source = `
export function renderJsx() {
  var rows = [{ name: 'A' }];
  var names = rows.map(function(row) { return row.name; });
  // openyida-lint-disable-next-line array-callback-function
  var buttons = rows.map(function(row) { return <button onClick={(e) => { this.open(row); }}>{row.name}</button>; });
  return <div>{names.join(',')}{buttons}</div>;
}
`;

    const result = lintYidaSource(source, '/tmp/function-callbacks.jsx');
    const errorRules = result.errors.map(issue => issue.rule);

    expect(errorRules).not.toContain('array-callback-function');
  });

  test('blocks legacy ECharts China map script loading', () => {
    const source = `
export function renderJsx() {
  return <div />;
}

export function didMount() {
  this.utils.loadScript('https://cdn.example.com/echarts/map/js/china.js');
}
`;

    const result = lintYidaSource(source, '/tmp/map.jsx');
    const errorRules = result.errors.map(issue => issue.rule);

    expect(errorRules).toContain('echarts-legacy-map-china');
  });

  test('warns about risky external resource loading', () => {
    const source = `
export function renderJsx() {
  return <div />;
}

var JSDELIVR_ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
var NORMALIZE_CSS_URL = 'https://g.alicdn.com/code/lib/normalize/8.0.1/normalize.css';
var ECHARTS_JS_URL = 'https://g.alicdn.com/code/lib/echarts/5.5.0/echarts.min.js';

export function didMount() {
  var self = this;
  self.utils.loadScript(JSDELIVR_ECHARTS_CDN);
  self.utils.loadScript(NORMALIZE_CSS_URL);
  self.utils.loadStyleSheet(ECHARTS_JS_URL);
  self.utils.loadScript(ECHARTS_JS_URL);
  self.utils.loadStyleSheet(NORMALIZE_CSS_URL);
}
`;

    const result = lintYidaSource(source, '/tmp/external-resources.jsx');
    const warningRules = result.warnings.map(issue => issue.rule);

    expect(warningRules).toContain('external-script-public-cdn');
    expect(warningRules).toContain('loadscript-css-file');
    expect(warningRules).toContain('loadstylesheet-js-file');
    expect(warningRules.filter(rule => rule === 'external-script-public-cdn')).toHaveLength(1);
    expect(warningRules.filter(rule => rule === 'loadscript-css-file')).toHaveLength(1);
    expect(warningRules.filter(rule => rule === 'loadstylesheet-js-file')).toHaveLength(1);
  });

  test('blocks ES6 computed property names that silently break Yida runtime', () => {
    const source = `
export function renderJsx() {
  return <div />;
}

export function setDraftField(key, value) {
  this.setCustomState({ [key]: value });
}

export function loadRows() {
  this.utils.yida.searchFormDatas({
    formUuid: 'FORM-XXX',
    searchFieldJson: JSON.stringify({ [FIELDS.department]: '研发部' }),
  }).catch(function() {});
}
`;

    const result = lintYidaSource(source, '/tmp/computed-property.jsx');
    const errorRules = result.errors.map(issue => issue.rule);
    const computedErrors = result.errors.filter(issue => issue.rule === 'computed-property');

    expect(errorRules).toContain('computed-property');
    expect(computedErrors).toHaveLength(2);
  });

  test('warns about native select controls in visible custom page UI', () => {
    const source = `
export function renderJsx() {
  return (
    <div>
      <select defaultValue="" onChange={(e) => { this.choose(e.target.value); }}>
        <option value="">全部状态</option>
      </select>
    </div>
  );
}
`;

    const result = lintYidaSource(source, '/tmp/native-select.jsx');
    const warningRules = result.warnings.map(issue => issue.rule);

    expect(warningRules).toContain('native-select-ui');
  });

  test('warns when Yida page links navigate inside the iframe', () => {
    const source = `
export function renderJsx() {
  return (
    <div>
      <a href="https://www.aliwork.com/APP_XXX/preview/PAGE_XXX">bad</a>
      <a href="https://www.aliwork.com/APP_XXX/preview/PAGE_YYY" target="_top">ok</a>
    </div>
  );
}
`;

    const result = lintYidaSource(source, '/tmp/iframe-nav.jsx');
    const warningRules = result.warnings.map(issue => issue.rule);

    expect(warningRules).toContain('iframe-self-navigation');
  });

  test('custom page template uses verified Tailwind preflight and custom dropdown reset', () => {
    const sourcePath = path.join(__dirname, '..', 'lib', 'samples', 'yida-custom-page', 'custom-page-template.js');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    expect(source).toContain('https://g.alicdn.com/code/lib/tailwindcss-browser/0.0.0-insiders.fed6c6a/index.global.min.js');
    expect(source).toContain('@import "tailwindcss/preflight";');
    expect(source).toContain('oyd-select-option');
    expect(source).toContain('appearance:none;-webkit-appearance:none;font-family:inherit');
    expect(source).not.toContain('<select');
  });

  test('warns about rich text label formatter functions in ECharts options', () => {
    const source = `
export function renderJsx() {
  return <div />;
}

export function renderChart() {
  var option = {
    series: [{
      label: {
        formatter: function(params) { return '{name|' + params.name + '}'; },
        rich: { name: { fontWeight: 700 } },
      },
    }],
  };
  this.chart.setOption(option);
}
`;

    const result = lintYidaSource(source, '/tmp/rich-label.jsx');
    const warningRules = result.warnings.map(issue => issue.rule);

    expect(warningRules).toContain('echarts-rich-label-formatter');
  });
});
