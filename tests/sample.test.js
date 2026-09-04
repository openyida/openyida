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

  test('OpenYida page templates are copied, substituted, and compile the drawer container', async () => {
    const formOutput = path.join(tmpDir, 'form-fields.json');
    const pageOutput = path.join(tmpDir, 'canvas-form-drawer.canvas.jsx');

    await run(['openyida-page-template', 'form-fields', '--output', formOutput]);
    await run([
      'openyida-page-template',
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
    expect(pageSource).not.toContain('脚手架预览');
    expect(pageSource).not.toContain('当前仍是脚手架占位资源');
  });

  test('standalone drawer sample integrates into an existing Canvas page without page scaffolding', async () => {
    const output = path.join(tmpDir, 'form-open-container.jsx');
    await run(['openyida-page-template', 'form-open-container', '--output', output]);
    const fragment = fs.readFileSync(output, 'utf8');
    const source = `${fragment}\nfunction YidaComp() {
      const { openForm, formOpenContainer } = useYidaFormOpen('APP_EXISTING', () => {});
      return <><button onClick={() => openForm({ type: 'submission', formUuid: 'FORM_EXISTING' })}>新增</button>{formOpenContainer}</>;
    }\nexport default YidaComp;`;
    const result = compileCanvasLocal(source, { sourcePath: output });
    expect(JSON.parse(result.importedModules)).toEqual(['antd', 'lucide-react', 'react']);
    expect(fragment).not.toMatch(/SAMPLE_ROWS|RAW_APP_TYPE|ConfigProvider|function YidaComp|export default|\{\{APP_TYPE\}\}/);

    const generic = compileCanvasLocal(`${fragment}\nfunction YidaComp() { return <CanvasDrawer open title="客户资料" onClose={() => {}}><p>客户信息</p></CanvasDrawer>; }`, { sourcePath: output });
    const element = new Function('window', `${generic.runtimeCode}; return YidaComp();`)({
      React: { createElement: (type, props, ...children) => ({ type, props, children }) },
      antd: {}, LucideReact: {},
    });
    expect(element.type.name).toBe('CanvasDrawer');
    expect(element.children[0].children).toEqual(['客户信息']);
  });

  test('dialog sample compiles with controlled actions and custom footer props', async () => {
    const output = path.join(tmpDir, 'canvas-dialog.jsx');
    await run(['openyida-page-template', 'canvas-dialog', '--output', output]);
    const fragment = fs.readFileSync(output, 'utf8');
    const result = compileCanvasLocal(`${fragment}\nfunction YidaComp() {
      return <CanvasDialog open title="归档" footer={null} confirmLoading onOk={() => 'ok'} onCancel={() => 'cancel'} rootClassName="customer-dialog"><p>记录</p></CanvasDialog>;
    }`, { sourcePath: output });
    expect(JSON.parse(result.importedModules)).toEqual(['antd', 'react']);
    const element = new Function('window', `${result.runtimeCode}; return YidaComp();`)({
      React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children }, children }) },
      antd: { Modal: 'Modal' },
    });
    const modal = element.type(element.props).children[1];
    expect(modal.type).toBe('Modal');
    expect(modal.props).toMatchObject({ open: true, footer: null, confirmLoading: true, rootClassName: 'openyida-dialog customer-dialog' });
    expect(modal.props.onOk()).toBe('ok');
    expect(modal.props.onCancel()).toBe('cancel');
  });

  test('application theme template is copied byte-for-byte through the CLI', async () => {
    const themeOutput = path.join(tmpDir, 'app-theme.css');
    const themeSource = path.join(
      __dirname,
      '..',
      'yida-skills',
      'skills',
      'yida-design',
      'references',
      'theme',
      'app-custom-theme-template.css'
    );

    await run(['yida-design', 'app-theme', '--output', themeOutput]);

    expect(fs.readFileSync(themeOutput)).toEqual(fs.readFileSync(themeSource));
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
        // Canvas templates consume the application theme; legacy samples keep their own defaults.
        if (!filename.endsWith('.canvas.jsx')) {expect(source).not.toMatch(appThemePattern);}
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

describe('application theme from design.md', () => {
  const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
  const { renderDesign } = require('../lib/design-plan/materialize');
  const template = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
  const fixture = require('./fixtures/design-plan.json');
  const themeIndex = require('../yida-skills/skills/yida-design/sub_skill/yida-design-plan/templates/design-themes/index.json');
  const tokens = {
    '--color-brand1-1': '#7197EE', '--color-brand1-2': '#EFF3FE', '--color-brand1-3': '#DAE3FD',
    '--color-brand1-5': '#2245AA', '--color-brand1-6': '#315BCC', '--color-brand1-9': '#1F3D99',
    '--color-brand1-10': '#B5C4EE', '--pod-card-border-radius': '16px',
  };
  const fastDesign = `---\ntokens:\n${Object.entries(tokens).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n---\n`;
  const structure = css => css.replace(/(--[\w-]+)\s*:[^;]+;/g, '$1: TOKEN;');

  test('Fast changes token values while preserving selectors and semantic colors', () => {
    const css = applyDesignTokens(template, fastDesign);
    expect(css).toContain('--color-brand1-6: #315BCC;');
    expect(css).toContain('--pod-card-border-radius: 16px;');
    expect(css).not.toContain('rgba(155, 136, 121, 1)');
    expect(structure(css)).toBe(structure(template));
    expect(css.match(/--color-error[^;]+;/g)).toEqual(template.match(/--color-error[^;]+;/g));
  });

  test.each(themeIndex.themes.map(theme => [theme.id || theme.themeId]))('Plan theme %s uses the public CSS pipeline', themeId => {
    const plan = JSON.parse(JSON.stringify(fixture));
    delete plan.visualStyle.forUser.themeProfile;
    plan.visualStyle.forUser.selectedTheme = themeIndex.themes.find(theme => theme.themeId === themeId);
    plan.visualStyle.tokens = { '--pod-card-border-radius': '16px' };
    const design = renderDesign(plan);
    const css = applyDesignTokens(template, design);
    expect(readDesignTokens(design)['--pod-card-border-radius']).toBe('16px');
    expect(css).toContain('--pod-card-border-radius: 16px;');
    expect(css).toContain('--color-brand1-6: #6F4E37;');
    // Ignore added custom-page tokens when comparing the template's selectors and scope.
    const originalNames = new Set([...template.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
    const withoutExtra = css.replace(/^[ \t]*(--[\w-]+)\s*:[^;]+;\n/gm, (line, name) => originalNames.has(name) ? line : '');
    expect(structure(withoutExtra)).toBe(structure(template));
  });

  test('CLI generates CSS and leaves an existing output intact when design tokens are invalid', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-theme-cli-'));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const designPath = path.join(dir, 'design.md');
      const cssPath = path.join(dir, 'app-theme.css');
      fs.writeFileSync(designPath, fastDesign);
      await run(['yida-design', 'app-theme', '--design-file', designPath, '--output', cssPath]);
      const before = fs.readFileSync(cssPath, 'utf8');
      expect(before).toContain('--color-brand1-6: #315BCC;');
      fs.writeFileSync(designPath, fastDesign.replace('#315BCC', '<待生成>'));
      await expect(run(['yida-design', 'app-theme', '--design-file', designPath, '--output', cssPath])).rejects.toThrow(/单行 CSS/);
      expect(fs.readFileSync(cssPath, 'utf8')).toBe(before);
      await expect(run(['yida-design', 'app-theme', '--design-file', designPath, '--output', designPath])).rejects.toThrow(/不能覆盖/);
      expect(() => readDesignTokens(fastDesign.replace('---\n', '---\ntokensOther:\n  --color-brand1-6: #000000\n'))).toThrow(/冲突/);
    } finally {
      log.mockRestore(); err.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
