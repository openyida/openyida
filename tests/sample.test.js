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

  test.each(['side', 'top', 'mixed', 'dock', 'tabs'])('navigation %s copies only the selected layout and compiles with existing content', async (layout) => {
    const output = path.join(tmpDir, `nav-${layout}.jsx`);
    await run(['openyida-page-template', `canvas-nav-${layout}`, '--output', output]);
    const fragment = fs.readFileSync(output, 'utf8');
    const component = layout === 'tabs' ? 'CanvasTabs' : 'CanvasNav';
    const result = compileCanvasLocal(`${fragment}\nfunction YidaComp() { return <${component} items={[]} activeKey="home" onSelect={() => {}}><p>已有业务内容</p></${component}>; }`);
    expect(JSON.parse(result.importedModules)).toEqual(['side', 'top', 'mixed'].includes(layout) ? ['lucide-react', 'react'] : ['react']);
    expect(fragment).not.toMatch(/function YidaComp|export default|ConfigProvider|Drawer|iframe|fetch\(|hashchange|document\.body|:root|--pod-nav-[\w-]+\s*:/);
    for (const other of ['side', 'top', 'mixed', 'dock'].filter(name => name !== layout)) {
      expect(fragment).not.toContain(`oy-nav-${other} `);
    }
    expect(Buffer.byteLength(fragment)).toBeLessThan(['side', 'mixed'].includes(layout) ? 14000 : 7000);
    expect(fragment.includes('function CanvasSidebar')).toBe(['side', 'mixed'].includes(layout));
    if (layout !== 'tabs') {
      expect(fragment).toContain('--pod-nav-item-text-disabled-color');
      expect(fragment).toContain('--pod-nav-menu-bg-selected-color');
    }
  });

  test('sidebar keyboard resizing uses current DOM width and respects bounds', async () => {
    const output = path.join(tmpDir, 'nav-side.jsx');
    await run(['openyida-page-template', 'canvas-nav-side', '--output', output]);
    const fragment = fs.readFileSync(output, 'utf8');
    const { runtimeCode } = compileCanvasLocal(`${fragment}\nfunction YidaComp() { return CanvasSidebar({}); }`);
    const setters = [];
    const React = {
      createElement: (type, props, ...children) => ({ type, props, children }),
      useState: initial => {
        const setter = jest.fn();
        setters.push(setter);
        return [typeof initial === 'function' ? initial() : initial, setter];
      },
      useRef: current => ({ current }),
      useId: () => 'sidebar',
      useEffect: () => {},
      useLayoutEffect: () => {},
    };
    const sidebar = new Function('window', `${runtimeCode}; return YidaComp();`)({ React, LucideReact: {}, innerWidth: 1280 });
    let domWidth = 180;
    sidebar.props.ref.current = { getBoundingClientRect: () => ({ width: domWidth }) };
    const handle = sidebar.children.find(child => child?.props?.role === 'separator');
    const resize = key => {
      const preventDefault = jest.fn();
      handle.props.onKeyDown({ key, preventDefault });
      expect(preventDefault).toHaveBeenCalled();
      domWidth = setters[2].mock.calls.at(-1)[0];
      return domWidth;
    };
    // The observed width is still 216; rapid key presses must use the actual width.
    expect(resize('ArrowRight')).toBe(204);
    expect(resize('ArrowRight')).toBe(228);
    expect(resize('Home')).toBe(180);
    expect(resize('ArrowLeft')).toBe(180);
    expect(resize('End')).toBe(400);
    expect(resize('ArrowRight')).toBe(400);
  });

  test('navigation data filters PRD menus by viewer visibility without adopting server order or extra entries', async () => {
    const output = path.join(tmpDir, 'nav-data.jsx');
    await run(['openyida-page-template', 'canvas-nav-data', '--output', output]);
    const source = fs.readFileSync(output, 'utf8');
    expect(source).not.toMatch(/CANVAS_NAV_CSS|function CanvasNav|import /);
    const navs = [
      { navUuid: 'hidden', hidden: true, children: [{ navUuid: 'hidden-child' }] },
      { navUuid: 'group', children: [{ navUuid: 'allowed', url: '/target', targetNew: true }, { navUuid: 'blocked', slug: 'hidden-slug' }] },
      { navUuid: 'vm-hidden', children: [{ navUuid: 'vm-hidden-child' }] },
      { navUuid: 'last', children: [] },
      { navUuid: 'unplanned', children: [] },
    ];
    const items = [
      { key: 'workbench', label: '工作台', formUuid: 'last', children: [] },
      { key: 'tasks', label: '任务入口', children: [
        { key: 'submit', label: '活动报名', formUuid: 'allowed', targetType: 'submission' },
        { key: 'manage', label: '报名管理', navUuid: 'allowed', targetType: 'page' },
        { key: 'blocked', formUuid: 'blocked' },
        { key: 'hidden-child', formUuid: 'hidden-child' },
        { key: 'vm-hidden-child', formUuid: 'vm-hidden-child' },
      ] },
      { key: 'empty-group', children: [{ key: 'missing', formUuid: 'not-returned' }] },
      { key: 'unbound-view', label: '未绑定资源的视图' },
    ];
    const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, content: { navs } }) });
    const load = new Function('fetch', `${source}; return loadCanvasNavigation;`)(fetch);
    const input = { items, appType: 'APP_TEST', formUuid: 'FORM_CURRENT', csrfToken: 'runtime-token', hiddenNav: ['hidden-slug', 'vm-hidden'] };
    const result = await load(input);
    expect(result.map(item => item.key)).toEqual(['workbench', 'tasks']);
    expect(result[0]).toEqual(items[0]);
    expect(result[1]).toEqual({ ...items[1], children: items[1].children.slice(0, 2) });
    expect(items[1].children).toHaveLength(5);
    expect(navs[1].children).toHaveLength(2);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/APP_TEST/query/formdesign/getAccessableNavs.json?');
    expect(new URL(url, 'https://example.com').searchParams.get('formUuid')).toBe('FORM_CURRENT');
    expect(options).toMatchObject({ credentials: 'include', cache: 'no-store' });
    fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, content: { navs: [...navs].reverse() } }) });
    await expect(load(input)).resolves.toEqual(result);
    fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, content: { navs: navs.filter(nav => nav.navUuid !== 'last') } }) });
    await expect(load(input)).resolves.toEqual([result[1]]);
    fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, content: { navs: [] } }) });
    await expect(load(input)).resolves.toEqual([]);
    for (const payload of [{ success: false, content: { navs } }, { success: true, content: {} }]) {
      fetch.mockResolvedValue({ ok: true, json: async () => payload });
      await expect(load(input)).rejects.toThrow('导航加载失败');
    }
    fetch.mockResolvedValue({ ok: false });
    await expect(load(input)).rejects.toThrow('导航加载失败');
    await expect(load({ appType: 'APP_TEST' })).rejects.toThrow('缺少 PRD 导航配置');
  });

  test('navigation task selects submission or management for the same form', async () => {
    const output = path.join(tmpDir, 'nav-data.jsx');
    await run(['openyida-page-template', 'canvas-nav-data', '--output', output]);
    const source = fs.readFileSync(output, 'utf8');
    const build = new Function(`${source}; return buildCanvasNavigationUrl;`)();
    const item = { navUuid: 'FORM_TEST', params: { activity: '活动 A' } };
    const submission = new URL(build({ ...item, targetType: 'submission' }, 'APP_TEST', { embedded: true }), 'https://example.com');
    expect(submission.pathname).toBe('/APP_TEST/submission/FORM_TEST');
    expect(submission.searchParams.get('isRenderNav')).toBe('false');
    expect(submission.searchParams.get('activity')).toBe('活动 A');
    const management = new URL(build({ ...item, targetType: 'page' }, 'APP_TEST', { embedded: true }), 'https://example.com');
    expect(management.pathname).toBe('/APP_TEST/workbench/FORM_TEST');
    expect(management.searchParams.get('iframe')).toBe('true');
    expect(build({ navUuid: 'FORM_TEST', targetType: 'submission' }, 'APP_TEST')).toBe('/APP_TEST/submission/FORM_TEST');
    expect(() => build(item, 'APP_TEST')).toThrow('请明确导航入口用途');
  });

  test('navigation links preserve href and modified clicks while local selection stays controlled', async () => {
    const output = path.join(tmpDir, 'nav.jsx');
    await run(['openyida-page-template', 'canvas-nav-dock', '--output', output]);
    const fragment = fs.readFileSync(output, 'utf8');
    const { runtimeCode } = compileCanvasLocal(`${fragment}\nfunction YidaComp(props) { return CanvasNavItem(props); }`);
    const render = new Function('window', `${runtimeCode}; return YidaComp;`)({
      React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    });
    const item = { key: 'orders', label: '订单', href: '/custom/FORM?locale=zh_CN#/orders' };
    const onSelect = jest.fn();
    const preventDefault = jest.fn();
    const link = render({ item, activeKey: 'orders', onSelect });
    expect(link.type).toBe('a');
    expect(link.props.href).toBe(item.href);
    expect(link.props['aria-current']).toBe('page');
    link.props.onClick({ button: 0, metaKey: true, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    link.props.onClick({ button: 0, preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(item);
    const newWindow = render({ item: { ...item, targetNew: true }, onSelect });
    expect(newWindow.props.target).toBe('_blank');
    newWindow.props.onClick({ button: 0, preventDefault });
    expect(onSelect).toHaveBeenCalledTimes(1);
    const disabled = render({ item: { ...item, disabled: true }, onSelect });
    expect(disabled.type).toBe('button');
    expect(disabled.props.disabled).toBe(true);
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
    expect(tableSource).toContain('background: var(--oyd-page-background, var(--pod-page-bg-color, var(--color-white, #fff)))');
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

    // 校验生成并编译后的真实 iframe 属性，防止模板抽取或编译再次丢失高度兜底。
    const runtimeWindow = {
      React: {
        createElement: (type, props, ...children) => ({ type, props, children }),
        useMemo: (factory) => factory(),
      },
      antd: { Typography: {} },
      LucideReact: {},
    };
    // eslint-disable-next-line no-new-func
    const FormOpenContainer = new Function('window', pageResult.runtimeCode + '; return FormOpenContainer;')(runtimeWindow);
    const drawer = FormOpenContainer({ request: { type: 'submission', formUuid: 'FORM_SAMPLE' }, currentAppType: 'APP_SAMPLE' });
    const iframe = drawer.children.find((child) => child && child.type === 'iframe');
    expect(iframe.props.style).toMatchObject({ height: '100%', minHeight: 'calc(100vh - 56px)' });

    for (const type of ['submission', 'detail']) {
      const request = {
        type, formUuid: 'FORM_SAMPLE', formInstId: 'REAL_INSTANCE',
        params: { corpid: 'ding_test', source: '活动 A&B', isRenderNav: true, formInstId: 'WRONG_INSTANCE' },
      };
      const container = FormOpenContainer({ request, currentAppType: 'APP_SAMPLE' });
      const frame = container.children.find((child) => child && child.type === 'iframe');
      const url = new URL(frame.props.src, 'https://example.com');
      expect(url.searchParams.get('corpid')).toBe('ding_test');
      expect(url.searchParams.get('source')).toBe('活动 A&B');
      expect(url.searchParams.get('isRenderNav')).toBe('false');
      if (type === 'detail') {
        expect(url.searchParams.get('formInstId')).toBe('REAL_INSTANCE');
        expect(url.searchParams.get('navConfig.layout')).toBe('1180');
      }
    }


    expect(() => createForm._private.validateFormFieldDefinitions(fields)).not.toThrow();
    expect(JSON.parse(pageResult.importedModules)).toEqual(['antd', 'lucide-react', 'react']);
    expect(pageSource).toContain('function FormOpenContainer');
    expect(pageSource).toContain('readThemeColor');
    expect(pageSource).toContain('min-height: 100vh');
    expect(pageSource).toContain('background: var(--oyd-page-background, var(--pod-page-bg-color, var(--color-white, #fff)))');
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

  test('CLI applies only changed tokens and skips identical writes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-theme-delta-'));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const design = path.join(dir, 'design.md');
      const css = path.join(dir, 'app-theme.css');
      const snapshot = `${css}.tokens.md`;
      const apply = () => run(['yida-design', 'app-theme', '--design-file', design, '--output', css]);
      fs.writeFileSync(design, fastDesign);
      await apply();
      fs.writeFileSync(css, fs.readFileSync(css, 'utf8')
        .replace('--pod-card-border-radius: 16px;', '--pod-card-border-radius: 27px;')
        .replace(/--color-brand-1:[^;]+;/, '--color-brand-1: #123456;') + '\n.my-popup { padding: 23px; }\n');
      fs.writeFileSync(design, fastDesign.replace('#315BCC', '#8844AA'));
      await apply();
      const updated = fs.readFileSync(css, 'utf8');
      expect(updated).toContain('--color-brand1-6: #8844AA;');
      expect(updated).toContain('--pod-card-border-radius: 27px;');
      expect(updated).toContain('--color-brand-1: #123456;');
      expect(updated).toContain('.my-popup { padding: 23px; }');
      fs.writeFileSync(css, updated.replace(':root {', ':root\n{'));
      const modified = [css, snapshot].map(file => fs.statSync(file).mtimeMs);
      await apply();
      expect([css, snapshot].map(file => fs.statSync(file).mtimeMs)).toEqual(modified);
      fs.writeFileSync(design, fastDesign.replace('#315BCC', '#8844AA').replace('16px', '18px'));
      await apply();
      expect(fs.readFileSync(css, 'utf8')).toContain('--pod-card-border-radius: 18px;');
      // Explicit template reset clears the previous baseline so the next application is complete.
      await run(['yida-design', 'app-theme', '--output', css]);
      await apply();
      expect(fs.readFileSync(css, 'utf8')).toContain('--color-brand1-6: #8844AA;');
    } finally {
      log.mockRestore(); fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('failed baseline installation rolls back CSS and its previous token snapshot', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-theme-rollback-'));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    let rename;
    try {
      const design = path.join(dir, 'design.md');
      const css = path.join(dir, 'app-theme.css');
      const snapshot = `${css}.tokens.md`;
      fs.writeFileSync(design, fastDesign);
      const apply = () => run(['yida-design', 'app-theme', '--design-file', design, '--output', css]);
      await apply();
      const before = [css, snapshot].map(file => fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(design, fastDesign.replace('16px', '18px'));
      const original = fs.renameSync;
      rename = jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
        if (to === snapshot && from.endsWith('next')) { throw new Error('snapshot write failed'); }
        return original(from, to);
      });
      await expect(apply()).rejects.toThrow('snapshot write failed');
      expect([css, snapshot].map(file => fs.readFileSync(file, 'utf8'))).toEqual(before);
    } finally {
      rename?.mockRestore(); log.mockRestore(); fs.rmSync(dir, { recursive: true, force: true });
    }
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
      fs.appendFileSync(cssPath, '\n.custom-popup { padding: 23px; }\n');
      await run(['yida-design', 'app-theme', '--design-file', designPath, '--output', cssPath]);
      const before = fs.readFileSync(cssPath, 'utf8');
      expect(before).toContain('.custom-popup { padding: 23px; }');
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
