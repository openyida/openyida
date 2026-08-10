'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const { applyTemplateVariables, run } = require('../lib/core/sample');
const formSchemaBuilder = require('../lib/app/scaffolds/form/form-schema-builder');
const { buildCanvasRuntimeSource } = require('../lib/app/runtime/canvas-runtime');
const { CANVAS_YIDA_API_METHODS } = require('../lib/app/runtime/canvas-yida-api-methods');
const { validateFormDefinition } = require('../lib/app/scaffolds/form/form-definition-validator');

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

    expect(JSON.parse(tableResult.importedModules)).toEqual(['antd', 'dayjs', 'react']);
    expect(tableSource).toContain('writeBridge.verified');
    expect(tableSource).toContain('Promise.all');
    expect(tableSource).not.toContain('this.utils.yida');
  });

  test('generic Code Canvas scaffold is the complete custom-page scaffold', async () => {
    const outputPath = path.join(tmpDir, 'canvas.canvas.jsx');

    await run(['yida-canvas-custom-page', 'canvas', '--output', outputPath]);

    const source = fs.readFileSync(outputPath, 'utf8');
    const result = compileCanvasLocal(source, { sourcePath: outputPath });
    const runtimeSource = buildCanvasRuntimeSource();

    expect(JSON.parse(result.importedModules)).toEqual(['antd', 'react']);
    expect(CANVAS_YIDA_API_METHODS).toHaveLength(13);
    CANVAS_YIDA_API_METHODS.forEach((methodName) => {
      expect(runtimeSource).toContain(methodName);
    });
    expect(source).toContain('window.__OPENYIDA_RUNTIME__');
    expect(source).toContain("readWindow('top')");
    expect(source).toContain('ConfigProvider');
    expect(source).toContain('FormOpenContainer');
    expect(source).toContain('buildSubmissionUrl');
    expect(source).toContain('buildFormDetailUrl');
    expect(source).toContain('(request && request.formUuid) || binding.formUuid');
    expect(source).toContain('assertFormInstanceId');
    expect(source).toContain('installThemeIntoFrame');
    expect(source).toContain('width="min(720px, 100vw)"');
    expect(source).toContain('?iframe=true&isRenderNav=false');
    expect(source).toContain("iframe: 'true'");
    expect(source).not.toContain('window.location.assign(url)');
    expect(source).toContain('error.repairType');
    expect(source).toContain('APP_TYPE');
    expect(source).toContain('FORM_UUIDS');
    expect(source).toContain('FIELDS');
    expect(source).toContain('fields: FIELDS.primary');
    expect(source).toContain("return String(row.formInstId || '')");
    expect(source).not.toContain('row.formInstanceId || row.instanceId || row.id');
    expect(source).toContain('THEME_TOKENS');
    ['refresh', 'install', 'installIntoFrame', 'getTokens'].forEach((methodName) => {
      expect(runtimeSource).toContain(methodName);
    });
    expect(source).toContain('This is the only generic Canvas scaffold');
  });

  test('native form scaffold stays as form json and compiles through form schema builder', async () => {
    const outputPath = path.join(tmpDir, 'form.form.json');

    await run(['yida-create-form-page', 'form', '--output', outputPath]);

    const source = fs.readFileSync(outputPath, 'utf8');
    const definition = JSON.parse(source);
    expect(validateFormDefinition(definition)).toMatchObject({ version: 1 });
    const compiled = formSchemaBuilder.compileFormDefinition(definition, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      corpId: 'CORP_TEST',
    });

    expect(outputPath.endsWith('.form.json')).toBe(true);
    expect(source).not.toMatch(/renderJsx|YidaComp|\\.jsx|this\\.utils\\.yida/);
    expect(definition.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'Divider', title: '基本信息' }),
      expect.objectContaining({ type: 'TextField', label: '事项名称' }),
      expect.objectContaining({ type: 'SelectField', dataSource: ['待处理', '进行中', '已完成'] }),
    ]));
    expect(definition.fields[0]).toMatchObject({ type: 'Divider', title: '基本信息' });
    expect(definition.fields).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ options: expect.anything() }),
    ]));
    expect(definition).toMatchObject({
      version: 1,
      theme: 'comfortable',
      formDetailPreset: 'clean-card',
      themeTokens: expect.any(Object),
      validations: expect.any(Array),
      rules: expect.any(Array),
      dataSources: expect.any(Array),
    });
    expect(compiled.schema.pages[0].componentsTree[0].lifeCycles.componentDidMount.name).toBe('openyidaThemeDidMount');
    expect(compiled.schema.actions.module.source).toContain('openyida:theme:start');
    expect(compiled.schema.actions.module.source).toContain('yida-global-theme');
    expect(compiled.schema.actions.module.source).toContain('OPENYIDA_YIDA_API_METHODS');
    expect(compiled.schema.actions.module.source).toContain('yida-form-detail-style');
    CANVAS_YIDA_API_METHODS.forEach((methodName) => {
      expect(compiled.schema.actions.module.source).toContain(methodName);
    });
  });

  test('remaining samples avoid near-black default business surfaces', () => {
    const sampleRoots = [
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
