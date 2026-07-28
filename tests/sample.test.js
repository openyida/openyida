'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const UglifyJS = require('uglify-js');
const { default: babelTransform } = require('../lib/core/babel-transform');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const { applyTemplateVariables, run } = require('../lib/core/sample');

describe('sample templates', () => {
  let tmpDir;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-sample-'));
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('applyTemplateVariables replaces {{KEY}} tokens', () => {
    const output = applyTemplateVariables('Hello {{BRAND_NAME}} / {{BRAND_NAME}}', {
      BRAND_NAME: 'OpenKuma',
    });

    expect(output).toBe('Hello OpenKuma / OpenKuma');
  });

  test('product-homepage sample supports variables and compiles', async () => {
    const outputPath = path.join(tmpDir, 'openkuma-homepage.jsx');

    await run([
      'yida-custom-page',
      'product-homepage',
      '--output',
      outputPath,
      '--var',
      'BRAND_NAME=OpenKuma',
      '--var',
      'BRAND_INITIALS=OK',
      '--var',
      'TAGLINE=开放项目首页工作台',
      '--var',
      'HERO_TEXT=把品牌展示、社区入口和运营反馈放进同一个宜搭页面',
    ]);

    const source = fs.readFileSync(outputPath, 'utf-8');
    expect(source).toContain("brandName: 'OpenKuma'");
    expect(source).toContain("brandInitials: 'OK'");
    expect(source).not.toContain("PAGE.brandName === 'OpenKuma'");
    expect(source).not.toContain('{{BRAND_NAME}}');

    const babelResult = babelTransform(source, {}, false, { RE_VERSION: '7.4.0' });
    expect(babelResult.error).toBeNull();

    const minifyResult = UglifyJS.minify(babelResult.compiled);
    expect(minifyResult.error).toBeUndefined();
    expect(minifyResult.code.length).toBeGreaterThan(1000);
  });

  test('todo-mvc sample supports variables and compiles', async () => {
    const outputPath = path.join(tmpDir, 'todo-mvc.oyd.jsx');

    await run([
      'yida-custom-page',
      'todo-mvc',
      '--output',
      outputPath,
      '--var',
      'TODO_TITLE=团队待办',
      '--var',
      'TODO_PLACEHOLDER=输入任务并按 Enter',
    ]);

    const source = fs.readFileSync(outputPath, 'utf-8');
    expect(source).toContain("title: '团队待办'");
    expect(source).toContain("placeholder: '输入任务并按 Enter'");
    expect(source).toContain('export function renderJsx()');
    expect(source).not.toContain('{{TODO_TITLE}}');

    const babelResult = babelTransform(source, {}, false, { RE_VERSION: '7.4.0' });
    expect(babelResult.error).toBeNull();

    const minifyResult = UglifyJS.minify(babelResult.compiled);
    expect(minifyResult.error).toBeUndefined();
    expect(minifyResult.code.length).toBeGreaterThan(1000);
  });

  test('Canvas-first chart and table-form samples are discoverable and compile', async () => {
    const chartOutput = path.join(tmpDir, 'trend-combo.canvas.jsx');
    const tableOutput = path.join(tmpDir, 'table-form-batch-submit.canvas.jsx');

    await run(['yida-rechart', 'trend-combo', '--output', chartOutput]);
    await run(['yida-canvas-table-form', 'table-form-batch-submit', '--output', tableOutput]);

    const chartSource = fs.readFileSync(chartOutput, 'utf8');
    const tableSource = fs.readFileSync(tableOutput, 'utf8');
    const chartResult = compileCanvasLocal(chartSource, { sourcePath: chartOutput });
    const tableResult = compileCanvasLocal(tableSource, { sourcePath: tableOutput });

    expect(JSON.parse(chartResult.importedModules)).toEqual(['antd', 'react', 'recharts']);
    expect(chartSource).toContain('sample/seed 聚合数据');
    expect(chartSource).not.toMatch(/\.(?:reduce|groupBy)\(/);

    expect(JSON.parse(tableResult.importedModules)).toEqual(['antd', 'dayjs', 'react']);
    expect(tableSource).toContain('writeBridge.verified');
    expect(tableSource).toContain('Promise.all');
    expect(tableSource).not.toContain('this.utils.yida');
  });

  test('light business samples avoid near-black theme borders and actions', () => {
    const samplePaths = [
      path.join(__dirname, '..', 'lib', 'samples', 'yida-canvas-custom-page', 'business-list.canvas.jsx'),
      path.join(__dirname, '..', 'lib', 'samples', 'yida-canvas-custom-page', 'data-management.canvas.jsx'),
      path.join(__dirname, '..', 'lib', 'samples', 'yida-table-form', 'table-form-batch-submit.js'),
    ];
    const nearBlackThemePattern = /#111827|#0f172a|#1f2937|#111(?![0-9a-fA-F])|rgba\(17,\s*24,\s*39|rgba\(23,\s*26,\s*29|rgba\(31,\s*41,\s*55/i;

    samplePaths.forEach((samplePath) => {
      const source = fs.readFileSync(samplePath, 'utf8');
      expect(source).not.toMatch(nearBlackThemePattern);
    });
  });

  test('light canvas samples avoid black visual blocks', () => {
    const sampleNames = [
      'business-list.canvas.jsx',
      'dashboard-overview.canvas.jsx',
      'data-management.canvas.jsx',
      'portal-native-components.canvas.jsx',
      'portal-shell-home.canvas.jsx',
      'product-homepage.canvas.jsx',
      'split-pane-detail.canvas.jsx',
      'todo-mvc.canvas.jsx',
      'workbench-home.canvas.jsx',
    ];
    const blackBlockPattern = /background:\s*#(?:111827|10131b|101418|101722|0f172a|1f2937)|rgba\(17,\s*24,\s*39|rgba\(23,\s*26,\s*29|rgba\(31,\s*41,\s*55/i;

    sampleNames.forEach((filename) => {
      const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-canvas-custom-page', filename), 'utf8');
      expect(source).not.toMatch(blackBlockPattern);
    });
  });

  test('sample pages own their themes instead of inheriting app brand variables', () => {
    const sampleRoots = [
      path.join(__dirname, '..', 'lib', 'samples', 'yida-canvas-custom-page'),
      path.join(__dirname, '..', 'lib', 'samples', 'yida-custom-page'),
      path.join(__dirname, '..', 'lib', 'samples', 'yida-density'),
      path.join(__dirname, '..', 'lib', 'samples', 'yida-table-form'),
      path.join(__dirname, '..', 'lib', 'samples', 'yida-chart'),
    ];
    const appThemePattern = /followRuntimeTheme:\s*true|var\(--color-brand/i;
    const nearBlackThemePattern = /#111827|#0f172a|#1f2937|rgba\(17,\s*24,\s*39|rgba\(23,?\s*26,?\s*29|rgba\(31,?\s*41,?\s*55/i;

    sampleRoots.forEach((root) => {
      fs.readdirSync(root).filter((filename) => /\.(js|jsx)$/.test(filename)).forEach((filename) => {
        const source = fs.readFileSync(path.join(root, filename), 'utf8');
        expect(source).not.toMatch(appThemePattern);
        expect(source).not.toMatch(nearBlackThemePattern);
      });
    });
  });

  test('chart samples bind the current Samples app native report', () => {
    const chartDir = path.join(__dirname, '..', 'lib', 'samples', 'yida-chart');
    const chartFiles = [
      'china-map.js',
      'dashboard-bindform.js',
      'line-trend.js',
      'multi-bar-compare.js',
      'radar-chart.js',
      'scatter-bindform.js',
      'stacked-area.js',
    ];
    const oldBindingPattern = /REPORT-0R8665A1ED54RG45IJWIX55W9Q8U2U6AH9XMM1|13085982|APP_KNILKT41DC5XXR5D4QEC|Youshu(?:Table|SimpleIndicatorCard)_mmx9ha/i;

    chartFiles.forEach((filename) => {
      const source = fs.readFileSync(path.join(chartDir, filename), 'utf8');
      expect(source).toContain('REPORT-6R866V91NDC7GXWJJB5L0AZPYDRL3UQ7PDORMA');
      expect(source).toContain('_resolveReportPrdId');
      expect(source).toContain("dataSetKey: 'table'");
      expect(source).not.toMatch(oldBindingPattern);
    });

    const dashboardSource = fs.readFileSync(path.join(chartDir, 'dashboard-bindform.js'), 'utf8');
    expect(dashboardSource).toContain("dataSetKey: 'youshuData'");
  });

  test('canvas visual samples use distinct default theme colors', () => {
    const sampleNames = [
      'business-list.canvas.jsx',
      'dashboard-overview.canvas.jsx',
      'data-screen.canvas.jsx',
      'data-management.canvas.jsx',
      'detail-profile.canvas.jsx',
      'official-homepage.canvas.jsx',
      'portal-shell-home.canvas.jsx',
      'product-homepage.canvas.jsx',
      'split-pane-detail.canvas.jsx',
      'todo-mvc.canvas.jsx',
      'workbench-home.canvas.jsx',
    ];
    const colors = sampleNames.map((filename) => {
      const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-canvas-custom-page', filename), 'utf8');
      expect(source).toContain('followRuntimeTheme: false');
      const match = source.match(/themeColor:\s*'([^']+)'/);
      expect(match).toBeTruthy();
      return match[1].toLowerCase();
    });

    expect(new Set(colors).size).toBe(colors.length);
  });

  test('native jsx samples provide productized scenes and real actions', () => {
    const customTemplate = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-custom-page', 'custom-page-template.js'), 'utf8');
    const productHomepage = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-custom-page', 'product-homepage.jsx'), 'utf8');
    const todoMvc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-custom-page', 'todo-mvc.oyd.jsx'), 'utf8');
    const densityPage = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-density', 'density-switch-page.js'), 'utf8');
    const tableForm = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-table-form', 'table-form-batch-submit.js'), 'utf8');

    expect(customTemplate).toContain('已加入业务数据预览');
    expect(customTemplate).toContain('请替换为真实 formUuid 后再打开详情');
    expect(customTemplate).not.toContain('OpenYida native sample');

    expect(productHomepage).toContain('dark-product-launch');
    expect(productHomepage).toContain('dark-violet');
    expect(productHomepage).toContain('NexaFlow');

    expect(todoMvc).toContain('addTodoFromButton');
    expect(todoMvc).toContain('openyida-todo-input');
    expect(todoMvc).not.toContain('高级交互样板');

    expect(densityPage).toContain('数据密度工作台');
    expect(densityPage).toContain('selectRecord');
    expect(densityPage).toContain('resetDemoData');

    expect(tableForm).toContain('importDemoRows');
    expect(tableForm).toContain('clearAllRows');
    expect(tableForm).toContain('最近操作');
  });
});
