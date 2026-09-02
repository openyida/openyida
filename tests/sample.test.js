'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const createForm = require('../lib/app/create-form');
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
    expect(chartSource).not.toContain('data-theme-scope');
    expect(chartSource).toContain('min-height: 100vh');
    expect(chartSource).toContain('var(--pod-page-bg-color, ${THEME.canvas})');

    expect(JSON.parse(tableResult.importedModules)).toEqual(['antd', 'dayjs', 'react']);
    expect(tableSource).toContain('writeBridge.verified');
    expect(tableSource).toContain('Promise.all');
    expect(tableSource).toContain('readThemeColor');
    expect(tableSource).toContain('min-height: 100vh');
    expect(tableSource).toContain('background: var(--pod-page-bg-color, var(--color-white, #fff))');
    expect(tableSource).toContain('background: var(--pod-card-bg-color, var(--color-white, #fff))');
    expect(tableSource).not.toContain('linear-gradient(145deg, #F0F9F7');
    expect(tableSource).not.toContain('this.utils.yida');
    expect(tableSource).not.toContain('data-theme-scope');
  });

  test('OpenYida scaffold samples validate form fields and compile the drawer container', async () => {
    const formOutput = path.join(tmpDir, 'form-fields.json');
    const pageOutput = path.join(tmpDir, 'canvas-form-drawer.canvas.jsx');

    await run(['openyida-scaffold', 'form-fields', '--output', formOutput]);
    await run([
      'openyida-scaffold',
      'canvas-form-drawer',
      '--output',
      pageOutput,
      '--var',
      'APP_TYPE=APP_SAMPLE',
      '--var',
      'FORM_UUID=FORM_SAMPLE',
    ]);

    const fields = JSON.parse(fs.readFileSync(formOutput, 'utf8'));
    const pageSource = fs.readFileSync(pageOutput, 'utf8');
    const pageResult = compileCanvasLocal(pageSource, { sourcePath: pageOutput });

    expect(() => createForm._private.validateFormFieldDefinitions(fields)).not.toThrow();
    expect(JSON.parse(pageResult.importedModules)).toEqual(['antd', 'lucide-react', 'react']);
    expect(pageSource).toContain('function FormOpenContainer');
    expect(pageSource).toContain('readThemeColor');
    expect(pageSource).toContain('min-height: 100vh');
    expect(pageSource).toContain('background: var(--pod-page-bg-color, var(--color-white, #fff))');
    expect(pageSource).toContain('background: var(--pod-card-bg-color, var(--color-white, #fff))');
    expect(pageSource).toContain('border: var(--pod-card-border, none)');
    expect(pageSource).toContain('border-radius: var(--pod-card-border-radius, 20px)');
    expect(pageSource).not.toContain('linear-gradient(180deg, #F5FAF9');
    expect(pageSource).toContain("'navConfig.layout': 1180");
    expect(pageSource).toContain('row.formInstId || row.formInstanceId || row.instanceId || row.id');
    expect(pageSource).not.toContain('yida-global-theme');
    expect(pageSource).not.toContain('onLoad={syncThemeToIframe}');
    expect(pageSource).not.toContain('data-yida-theme-root');
    expect(pageSource).not.toContain('data-theme-scope');
    expect(pageSource).not.toContain('FORM_INST_SAMPLE');
    expect(pageSource).not.toContain('{{APP_TYPE}}');
    expect(pageSource).not.toContain('{{FORM_UUID}}');
  });

  test('remaining samples avoid near-black default business surfaces', () => {
    const sampleRoots = [
      path.join(__dirname, '..', 'lib', 'samples', 'yida-density'),
      path.join(__dirname, '..', 'lib', 'samples', 'yida-table-form'),
      path.join(__dirname, '..', 'lib', 'samples', 'yida-chart'),
      path.join(__dirname, '..', 'lib', 'samples', 'openyida-scaffold'),
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

  test('remaining native samples provide real actions', () => {
    const densityPage = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-density', 'density-switch-page.js'), 'utf8');
    const tableForm = fs.readFileSync(path.join(__dirname, '..', 'lib', 'samples', 'yida-table-form', 'table-form-batch-submit.js'), 'utf8');

    expect(densityPage).toContain('数据密度工作台');
    expect(densityPage).toContain('selectRecord');
    expect(densityPage).toContain('resetDemoData');

    expect(tableForm).toContain('importDemoRows');
    expect(tableForm).toContain('clearAllRows');
    expect(tableForm).toContain('最近操作');
  });
});
