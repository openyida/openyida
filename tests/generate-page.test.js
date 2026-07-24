'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { escapeJsStringValue } = require('../lib/app/page-ir');
const { getCanvasDistPath, inferTemplateName } = require('../lib/app/generate-page');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');

describe('generate-page command', () => {
  let tmpDir;
  let tmpHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-generate-page-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-generate-home-'));
    fs.writeFileSync(path.join(tmpDir, 'config.json'), '{}', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function cliEnv() {
    const env = {
      ...process.env,
      HOME: tmpHome,
      USERPROFILE: tmpHome,
      OPENYIDA_LANG: 'zh',
      CI: '1',
    };

    for (const key of Object.keys(env)) {
      if (key.startsWith('CODEX') || key === 'AGENT_WORK_ROOT') {
        delete env[key];
      }
    }

    return env;
  }

  test('escapes values inserted into JSX string literals', () => {
    const input = "Kuma's Lab\\AI\nNext";
    expect(escapeJsStringValue(input)).toBe("Kuma\\'s Lab\\\\AI\\nNext");
  });

  test('infers scene-specific templates from natural language specs', () => {
    expect(inferTemplateName({ template: null }, {
      requirement: '帮我创建一个律所官网首页，展示专业领域和预约咨询入口。',
    })).toBe('official-homepage');

    expect(inferTemplateName({ template: null }, {
      requirement: '做一个水质情况实时监控预警系统数据大屏。',
    })).toBe('data-screen');

    expect(inferTemplateName({ template: null }, {
      requirement: '给经销商做一个经营数据看板，展示 GMV、排行和异常洞察。',
    })).toBe('dashboard-overview');

    expect(inferTemplateName({ template: null }, {
      requirement: '做一个运营工作台，能看待办、常用入口和本周动态。',
    })).toBe('workbench-home');

    expect(inferTemplateName({ template: null }, {
      requirement: '做订单管理页，能筛选处理订单并打开详情抽屉。',
    })).toBe('business-list');

    expect(inferTemplateName({ template: null }, {
      requirement: '做客户档案详情页，展示客户画像、关键摘要和跟进时间线。',
    })).toBe('detail-profile');

    expect(inferTemplateName({ template: null }, {
      requirement: '做一个工单处理台，左列表右详情，保留筛选上下文。',
    })).toBe('split-pane-detail');

    expect(inferTemplateName({ template: null }, {
      requirement: '做一个多入口门户首页，隐藏导航后自带页面内门户壳。',
    })).toBe('portal-shell-home');

    expect(inferTemplateName({ template: null }, {
      requirement: '补一个数据管理多维表页面，包含字段管理、分组、筛选和表格视图。',
    })).toBe('data-management');
  });

  test('writes canvas dist next to arbitrary output folders outside pages/src', () => {
    const distPath = getCanvasDistPath('/private/tmp/demo.canvas.jsx');
    expect(distPath).toBe('/private/tmp/dist/demo.canvas.js');
  });

  test('strips redundant project prefix when cwd is already the OpenYida project directory', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'config.json'), '{}', 'utf8');

    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      'dashboard-overview',
      '--brand-name',
      '访客看板',
      '--output',
      'project/pages/src/visitor-dashboard.canvas.jsx',
      '--compile',
    ], {
      cwd: projectDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(fs.existsSync(path.join(projectDir, 'pages', 'src', 'visitor-dashboard.canvas.jsx'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'pages', 'dist', 'visitor-dashboard.canvas.js'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'project', 'pages', 'src', 'visitor-dashboard.canvas.jsx'))).toBe(false);
  });

  test('rejects specs that would render emoji into generated page source before writing files', () => {
    const specPath = path.join(tmpDir, 'emoji-page.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'product-homepage',
      output: 'pages/src/emoji-home.canvas.jsx',
      brandName: '客户工作台 ✅',
      heroText: '查看客户进度',
      compile: true,
    }), 'utf8');

    expect(() => execFileSync(process.execPath, [
      BIN,
      'generate-page',
      '--spec',
      specPath,
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    })).toThrow(/contains emoji/);

    expect(fs.existsSync(path.join(tmpDir, 'pages', 'src', 'emoji-home.canvas.jsx'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'pages', 'dist', 'emoji-home.canvas.js'))).toBe(false);
  });

  test('rejects emoji in generated output filenames before writing files', () => {
    expect(() => execFileSync(process.execPath, [
      BIN,
      'generate-page',
      'product-homepage',
      '--brand-name',
      '客户工作台',
      '--output',
      'pages/src/home-✅.canvas.jsx',
      '--compile',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    })).toThrow(/contains emoji/);

    expect(fs.existsSync(path.join(tmpDir, 'pages', 'src', 'home-✅.canvas.jsx'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'pages', 'dist', 'home-✅.canvas.js'))).toBe(false);
  });

  test('accepts --theme-profile as a visual profile alias', () => {
    execFileSync(process.execPath, [BIN, 'generate-page', 'product-homepage', '--theme-profile', 'custom-theme', '--compile'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const manifestPath = path.join(tmpDir, 'pages', 'src', 'home.canvas.openyida-page.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.visualProfile.name).toBe('custom-theme');
    expect(manifest.themeProfile.name).toBe('custom-theme');
    expect(manifest.themeProfile.themeColor).toBe('#6B7CAB');
    expect(manifest.themeScope).toBe('page');
    expect(manifest.visualProfile.density).toBe('business-compact');
  });

  test('injects app scoped shell theme bridge when requested', () => {
    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      'product-homepage',
      '--theme-profile',
      '{"name":"green-shell","themeColor":"#0D5A35","themeColorDeep":"#07301D","themeColorSoft":"#EEF7EC"}',
      '--theme-scope',
      'app',
      '--compile',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'home.canvas.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'home.canvas.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'home.canvas.openyida-page.json');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const compiled = fs.readFileSync(compiledPath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(source).toContain('@openyida-theme-profile green-shell');
    expect(source).toContain('@openyida-theme-scope app');
    expect(source).toContain("const THEME_SCOPE = withFallback('app', 'page')");
    expect(source).toContain('updateShellConfig');
    expect(source).toContain('themeColor: getThemeColor');
    expect(compiled).toContain('updateShellConfig');
    expect(manifest.themeScope).toBe('app');
    expect(manifest.themeProfile).toMatchObject({
      name: 'green-shell',
      themeColor: '#0D5A35',
      themeColorDeep: '#07301D',
      themeColorSoft: '#EEF7EC',
    });
  });

  test('defaults to Code Canvas output when no native path is requested', () => {
    execFileSync(process.execPath, [BIN, 'generate-page', 'product-homepage', '--brand-name', 'Canvas默认页', '--compile'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'home.canvas.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'home.canvas.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'home.canvas.openyida-page.json');

    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const source = fs.readFileSync(sourcePath, 'utf8');
    const compiled = fs.readFileSync(compiledPath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(source).toContain('export default YidaComp');
    expect(source).toContain('@openyida-template product-homepage');
    expect(source).toContain('@openyida-visual-profile yida-app-theme');
    expect(source).toContain('@openyida-theme-profile yida-app-theme');
    expect(source).toContain('@openyida-theme-scope page');
    expect(source).toContain('oy-hero-grid');
    expect(source).toContain('buildScopedThemeVars');
    expect(source).toContain('parseColorGroup');
    expect(source).toContain('oy-nav-action');
    expect(source).toContain('Canvas默认页');
    expect(compiled).toContain('window.antd');
    expect(compiled).toContain('window.ahooks');
    expect(manifest.template).toBe('product-homepage');
    expect(manifest.scene).toBe('workbench');
    expect(manifest.visualProfile.name).toBe('yida-app-theme');
    expect(manifest.visualProfile.density).toBe('business-compact');
    expect(manifest.themeProfile.name).toBe('yida-app-theme');
    expect(manifest.themeProfile.followRuntimeTheme).toBe(true);
    expect(manifest.themeProfile.themeColorSource).toBe('runtime-css-vars');
    expect(manifest.themeScope).toBe('page');
  });

  test('generates a richer official homepage for brand and law-firm style sites', () => {
    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      'official-homepage',
      '--brand-name',
      '恒信律师事务所',
      '--hero-text',
      '专注企业合规、争议解决与长期法律顾问服务',
      '--output',
      'pages/src/law-home.canvas.jsx',
      '--compile',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'law-home.canvas.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'law-home.canvas.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'law-home.canvas.openyida-page.json');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(source).toContain('@openyida-template official-homepage');
    expect(source).toContain('@openyida-scene landing');
    expect(source).toContain('oy-hero-title');
    expect(source).toContain('oy-visual');
    expect(source).toContain('恒信律师事务所');
    expect(manifest.template).toBe('official-homepage');
    expect(manifest.scene).toBe('landing');
    expect(manifest.visualProfile.tone).toBe('editorial-trust');
  });

  test('official homepage without hero material is gated as non-final draft', () => {
    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      'official-homepage',
      '--brand-name',
      '无素材品牌',
      '--output',
      'pages/src/no-hero.canvas.jsx',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'no-hero.canvas.jsx');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'no-hero.canvas.openyida-page.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const source = fs.readFileSync(sourcePath, 'utf8');

    // Landing pages with no hero material must NOT be labeled final.
    expect(manifest.assets.materialStatus).toBe('none');
    expect(Array.isArray(manifest.assets.materialGaps)).toBe(true);
    expect(manifest.assets.materialGaps.join('\n')).toMatch(/Hero/);
    // Canvas carries the status so the runtime draft ribbon can render.
    expect(source).toMatch(/materialStatus/);
  });

  test('official homepage with an unverified hero URL is a draft until resolved', () => {
    const specPath = path.join(tmpDir, 'brand-hero.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'official-homepage',
      output: 'pages/src/brand-hero.canvas.jsx',
      brandName: '示例品牌',
      assets: { heroImage: 'https://images.example.com/hero.png' },
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [BIN, 'generate-page', '--spec', specPath], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const manifestPath = path.join(tmpDir, 'pages', 'src', 'brand-hero.canvas.openyida-page.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Hero present but unverified (no --resolve-assets) → draft, not final.
    expect(manifest.assets.materialStatus).toBe('draft');
    expect(manifest.assets.materialGaps.join('\n')).toMatch(/未经校验/);
  });

  test('generates an immersive data screen with a stable Yida map component', () => {
    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      'data-screen',
      '--brand-name',
      '水质情况实时监测预警系统',
      '--output',
      'pages/src/water-screen.canvas.jsx',
      '--compile',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'water-screen.canvas.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'water-screen.canvas.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'water-screen.canvas.openyida-page.json');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const compiled = fs.readFileSync(compiledPath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(source).toContain('@openyida-template data-screen');
    expect(source).toContain('@openyida-scene screen');
    expect(source).toContain("from 'recharts'");
    expect(source).toContain('oy-map');
    expect(source).toContain('YidaMapComponent');
    expect(source).toContain('YoushuMap');
    expect(source).toContain('BuiltInChinaRegionMap');
    expect(source).toContain('oy-region-map-svg');
    expect(source).not.toContain('地图组件暂不可用');
    expect(source).not.toContain('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json');
    expect(source).toContain('oy-point-card');
    expect(compiled).toContain('window.Recharts');
    expect(manifest.template).toBe('data-screen');
    expect(manifest.scene).toBe('screen');
    expect(manifest.visualProfile.tone).toBe('immersive-command');
  });

  test('generates dedicated workbench, dashboard, list and detail canvas templates', () => {
    const cases = [
      {
        template: 'workbench-home',
        output: 'pages/src/workbench.canvas.jsx',
        marker: 'oy-workbench-home',
        primitive: 'oy-entry-grid',
        scene: 'workbench',
      },
      {
        template: 'dashboard-overview',
        output: 'pages/src/dashboard.canvas.jsx',
        marker: 'oy-dashboard-overview',
        primitive: 'oy-kpi-primitive',
        scene: 'dashboard',
      },
      {
        template: 'business-list',
        output: 'pages/src/orders.canvas.jsx',
        marker: 'oy-business-list',
        primitive: 'oy-filter-bar',
        scene: 'list',
      },
      {
        template: 'data-management',
        output: 'pages/src/data-management.canvas.jsx',
        marker: 'oy-data-management',
        primitive: 'oy-data-toolbar',
        scene: 'list',
      },
      {
        template: 'detail-profile',
        output: 'pages/src/customer-detail.canvas.jsx',
        marker: 'oy-detail-profile',
        primitive: 'oy-object-hero',
        scene: 'detail',
      },
      {
        template: 'split-pane-detail',
        output: 'pages/src/split-pane.canvas.jsx',
        marker: 'oy-split-pane-detail',
        primitive: 'oy-split-queue',
        scene: 'list',
      },
      {
        template: 'portal-shell-home',
        output: 'pages/src/portal.canvas.jsx',
        marker: 'oy-portal-shell-home',
        primitive: 'oy-portal-nav',
        scene: 'workbench',
      },
    ];

    cases.forEach((item) => {
      execFileSync(process.execPath, [
        BIN,
        'generate-page',
        item.template,
        '--brand-name',
        item.template,
        '--output',
        item.output,
        '--compile',
      ], {
        cwd: tmpDir,
        env: cliEnv(),
        encoding: 'utf8',
        timeout: 10000,
      });

      const parsed = path.parse(item.output);
      const sourcePath = path.join(tmpDir, item.output);
      const compiledPath = path.join(tmpDir, parsed.dir.replace(/src$/, 'dist'), `${parsed.name}.js`);
      const manifestPath = path.join(tmpDir, parsed.dir, `${parsed.name}.openyida-page.json`);
      const source = fs.readFileSync(sourcePath, 'utf8');
      const compiled = fs.readFileSync(compiledPath, 'utf8');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      expect(fs.existsSync(compiledPath)).toBe(true);
      expect(source).toContain(`@openyida-template ${item.template}`);
      expect(source).toContain(`@openyida-scene ${item.scene}`);
      expect(source).toContain(item.marker);
      expect(source).toContain(item.primitive);
      expect(source).toContain('--oy-control-focus-ring');
      expect(source).toContain('getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}');
      expect(source).toContain('.ant-select-dropdown');
      expect(source).not.toContain('{{OPENYIDA_CANVAS_CONTROL_CSS}}');
      expect(source).not.toContain("JSON.parse('{{");
      expect(compiled).not.toContain("JSON.parse('{{");
      if (item.template === 'split-pane-detail') {
        expect(source).toContain('@openyida-theme-profile yida-app-theme');
        expect(source).toContain("const THEME_SCOPE = withFallback('page', 'page')");
        expect(source).toContain('function parseTemplateJson');
        expect(source).toContain('const DATA_BINDING = parseTemplateJson');
        expect(source).not.toContain('{{THEME_PROFILE_JSON}}');
        expect(source).not.toContain('{{DATA_BINDING_JSON}}');
        expect(source).not.toContain('{{INSIGHTS_JSON}}');
      }
      expect(manifest.template).toBe(item.template);
      expect(manifest.scene).toBe(item.scene);
    });
  });

  test('business-list delivery output without dataBinding uses empty state instead of seed list fallback', () => {
    const specPath = path.join(tmpDir, 'orders-no-binding.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'business-list',
      output: 'pages/src/orders-no-binding.canvas.jsx',
      requirement: '做订单管理页，支持筛选订单、查看详情和登记新订单。',
      brandName: '订单管理页',
      tagline: '订单筛选、处理和详情预览',
      heroText: '面向运营人员处理订单状态、负责人和下一步动作。',
      interactionProfile: {
        primaryAction: '登记订单',
        detailMode: 'side-pane',
        bulkActions: ['导出订单', '批量分派'],
      },
      visualProfile: {
        name: 'order-ops-list',
        density: 'business-compact',
      },
      features: [
        { title: '订单登记', text: '登记客户、金额、状态和负责人。' },
        { title: '订单筛选', text: '按状态、周期和关键词定位记录。' },
        { title: '详情处理', text: '在右侧查看摘要并推进下一步。' },
      ],
      roadmap: [
        { stage: '登记', title: '创建订单', text: '从订单表单写入真实记录。' },
        { stage: '处理', title: '筛选负责人', text: '按状态和负责人分派处理。' },
        { stage: '复盘', title: '查看结果', text: '从真实表单读取最新记录。' },
      ],
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      '--spec',
      specPath,
      '--compile',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'orders-no-binding.canvas.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'orders-no-binding.canvas.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'orders-no-binding.canvas.openyida-page.json');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const compiled = fs.readFileSync(compiledPath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(source).toContain('未接入真实表单数据');
    expect(source).toContain('usesSeedRows ? seedRows : []');
    expect(source).not.toContain('dataState.rows.length ? dataState.rows : seedRows');
    expect(compiled).toContain('完整应用交付页不会用前端 seedRows 冒充业务记录。');
    expect(manifest.dataBinding).toMatchObject({
      mode: 'seed',
      enabled: false,
    });
  });

  test('workbench canvas sample fills the app surface and avoids demo labels', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib', 'samples', 'yida-canvas-custom-page', 'workbench-home.canvas.jsx'), 'utf8');

    expect(source).toContain('max-width: none');
    expect(source).toContain('min-height: 100vh');
    expect(source).toContain('行动队列');
    expect(source).toContain('今日优先级');
    expect(source).toContain('常用入口');
    expect(source).not.toContain('max-width: 1280px');
    expect(source).not.toContain('margin: 0 auto');
    expect(source).not.toContain('dribbble research');
    expect(source).not.toContain('sample research');
    expect(source).not.toContain('workbench + operation');
    expect(source).not.toContain('Command queue');
  });

  test('all generated canvas templates keep the shared control focus reset', () => {
    const templates = [
      'product-homepage.canvas.jsx',
      'workbench-home.canvas.jsx',
      'dashboard-overview.canvas.jsx',
      'official-homepage.canvas.jsx',
      'data-screen.canvas.jsx',
      'data-management.canvas.jsx',
      'business-list.canvas.jsx',
      'detail-profile.canvas.jsx',
      'split-pane-detail.canvas.jsx',
      'portal-shell-home.canvas.jsx',
      'todo-mvc.canvas.jsx',
    ];

    templates.forEach((filename) => {
      const source = fs.readFileSync(path.join(ROOT, 'lib', 'samples', 'yida-canvas-custom-page', filename), 'utf8');
      expect(source).toContain('{{OPENYIDA_CANVAS_CONTROL_CSS}}');
      expect(source).toContain('getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}');
    });

    [
      'native-components-smoke.canvas.jsx',
      'portal-native-components.canvas.jsx',
    ].forEach((filename) => {
      const source = fs.readFileSync(path.join(ROOT, 'lib', 'samples', 'yida-canvas-custom-page', filename), 'utf8');
      expect(source).toContain('CANVAS_CONTROL_RESET_CSS');
      expect(source).toContain('--oy-control-focus-ring');
      expect(source).toContain('.ant-select-dropdown');
    });
  });

  test('portal native component sample passes required runtime props and local boundary', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib', 'samples', 'yida-canvas-custom-page', 'portal-native-components.canvas.jsx'), 'utf8');
    expect(source).toContain('class NativeComponentBoundary extends React.Component');
    expect(source).toContain('function PortalRail');
    expect(source).toContain('function VioletPortalHero');
    expect(source).toContain('oy-insight-band');
    expect(source).toContain('--oy-brand-mid: #5B21B6');
    expect(source).toContain('theme="row-white"');
    expect(source).toContain('containerPrefix="oy-native-portal"');
    expect(source).toContain('enableCancelAccess');
    expect(source).not.toContain('rgba(17, 24, 39');
    expect(source).not.toContain('#172033');
  });

  test('native smoke sample renders as a component lab instead of a plain diagnostics table', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib', 'samples', 'yida-canvas-custom-page', 'native-components-smoke.canvas.jsx'), 'utf8');
    expect(source).toContain('Native Component Lab');
    expect(source).toContain('LAB_NAV');
    expect(source).toContain('oy-smoke-rail');
    expect(source).toContain('groupLabel');
    expect(source).toContain('Payload Inspector');
    expect(source).toContain('#1677FF');
    expect(source).toContain('#0B3A8F');
    expect(source).toContain('#BBD7FF');
    expect(source).not.toContain('#0F9F8E');
    expect(source).not.toContain('#075E54');
    expect(source).not.toContain('#7C6AF6');
    expect(source).not.toContain('rgba(17, 24, 39');
    expect(source).not.toContain('#172033');
  });

  test('writes P1 page spec fields into generated manifest', () => {
    const specPath = path.join(tmpDir, 'dealer-dashboard.json');
    fs.writeFileSync(specPath, JSON.stringify({
      output: 'pages/src/dealer-dashboard.canvas.jsx',
      requirement: '为奶茶品牌经销商创建经营数据看板',
      brandName: '经销商经营看板',
      researchLevel: 'light',
      appBlueprint: {
        appName: '奶茶渠道增长应用',
        shell: 'side_nav',
        roles: ['消费者', '经销商'],
        navigation: ['品牌展示', '经销商经营'],
        pages: [
          { name: '品牌官网首页', scene: 'landing', template: 'official-homepage' },
          { name: '经销商经营看板', scene: 'dashboard', template: 'dashboard-overview' },
        ],
      },
      interactionProfile: {
        primaryAction: '查看本周经营',
        detailMode: 'drawer',
        bulkActions: ['导出巡店建议'],
      },
      dataBinding: {
        mode: 'form',
        appType: 'APP_DEALER',
        formUuid: 'FORM-DEALER',
        sourceName: '经销商经营数据',
        fields: {
          code: 'textField_storeName',
          amount: 'numberField_gmv',
          status: 'selectField_status',
        },
      },
      insights: [
        { conclusion: '华东区贡献 43%', evidence: '环比 +5.2pp', suggestion: '优先补货高增长门店' },
      ],
      compile: true,
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      '--spec',
      specPath,
      '--archetype',
      'analysis',
      '--research-level',
      'enhanced',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'dealer-dashboard.canvas.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'dealer-dashboard.canvas.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'dealer-dashboard.canvas.openyida-page.json');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(source).toContain('@openyida-template dashboard-overview');
    expect(source).toContain('oy-kpi-primitive');
    expect(source).toContain('oy-chart-panel');
    expect(source).toContain('oy-rank-list');
    expect(source).toContain('oy-insight-callout');
    expect(source).toContain('oy-freshness-badge');
    expect(source).toContain('const DATA_BINDING');
    expect(source).toContain('useYidaData');
    expect(source).toContain('DataBridge');
    expect(source).toContain('APP_DEALER');
    expect(source).toContain('FORM-DEALER');
    expect(source).toContain('查看本周经营');
    expect(source).toContain('华东区贡献 43%');
    expect(manifest.template).toBe('dashboard-overview');
    expect(manifest.scene).toBe('dashboard');
    expect(manifest.researchLevel).toBe('enhanced');
    expect(manifest.archetype).toBe('analysis');
    expect(manifest.visualProfile.archetype).toBe('analysis');
    expect(manifest.appBlueprint).toMatchObject({
      appName: '奶茶渠道增长应用',
      shell: 'side_nav',
      roles: ['消费者', '经销商'],
    });
    expect(manifest.interactionProfile).toMatchObject({
      primaryAction: '查看本周经营',
      detailMode: 'drawer',
      bulkActions: ['导出巡店建议'],
    });
    expect(manifest.dataBinding).toMatchObject({
      mode: 'form',
      enabled: true,
      appType: 'APP_DEALER',
      formUuid: 'FORM-DEALER',
      sourceName: '经销商经营数据',
    });
    expect(manifest.dataBinding.fields.amount).toBe('numberField_gmv');
    expect(manifest.insights[0].conclusion).toBe('华东区贡献 43%');
  });

  test('marks thin business specs as draft when sample defaults remain', () => {
    const specPath = path.join(tmpDir, 'thin-dashboard.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'dashboard-overview',
      output: 'pages/src/thin-dashboard.canvas.jsx',
      requirement: '帮我做一个奶茶门店经营看板',
      brandName: '奶茶门店经营看板',
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      '--spec',
      specPath,
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const manifestPath = path.join(tmpDir, 'pages', 'src', 'thin-dashboard.canvas.openyida-page.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.domainFidelity.status).toBe('draft-needs-domain-spec');
    expect(manifest.domainFidelity.sampleFallbacks).toEqual(expect.arrayContaining([
      'features',
      'metrics',
      'roadmap',
    ]));
    expect(manifest.domainFidelity.missing.join('\n')).toMatch(/指标口径/);
  });

  test('marks rich business specs as domain-ready instead of sample output', () => {
    const specPath = path.join(tmpDir, 'rich-dashboard.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'dashboard-overview',
      output: 'pages/src/rich-dashboard.canvas.jsx',
      requirement: '帮我做一个奶茶门店经营看板',
      brandName: '奶茶门店经营看板',
      tagline: '门店销售、库存和巡检风险一屏判断',
      heroText: '为区域督导和门店店长提供本周销售、爆品库存、巡检异常和补货动作，让每天早会能直接围绕数据做决策。',
      visualProfile: {
        name: 'milk-tea-store-ops',
        tone: 'fresh-operational',
        motif: ['kpi-first', 'store-rank', 'inventory-risk'],
      },
      interactionProfile: {
        primaryAction: '查看需补货门店',
        detailMode: 'drawer',
        bulkActions: ['导出巡店清单'],
      },
      features: [
        { title: '门店销售', text: '按区域、门店和饮品系列拆解本周收入。' },
        { title: '爆品库存', text: '识别珍珠、茶底和杯材的低库存门店。' },
        { title: '巡检风险', text: '聚合卫生、陈列和服务评分异常。' },
      ],
      metrics: [
        { value: '32.6万', label: '本周销售额' },
        { value: '18', label: '需补货门店' },
        { value: '7', label: '巡检异常' },
      ],
      roadmap: [
        { stage: '早会', title: '先看低库存门店', text: '按缺货风险排序安排补货。' },
        { stage: '午间', title: '复盘爆品销售', text: '追踪新品和套餐转化变化。' },
        { stage: '闭店', title: '沉淀巡检动作', text: '把异常项分派给店长跟进。' },
      ],
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      '--spec',
      specPath,
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const manifestPath = path.join(tmpDir, 'pages', 'src', 'rich-dashboard.canvas.openyida-page.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.domainFidelity.status).toBe('domain-ready');
    expect(manifest.domainFidelity.sampleFallbacks).toEqual([]);
    expect(manifest.blocks[1].items[0].title).toBe('门店销售');
    expect(manifest.blocks[2].items[1].label).toBe('需补货门店');
  });

  test('marks generated pages with page-level app navigation to hide Yida app nav by default', () => {
    const specPath = path.join(tmpDir, 'app-home.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'workbench-home',
      output: 'pages/src/app-home.canvas.jsx',
      scene: 'workbench',
      appBlueprint: {
        appName: '采购协同应用',
        shell: 'side_nav',
        navigation: ['采购首页', '采购申请', '供应商管理'],
      },
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [
      BIN,
      'generate-page',
      '--spec',
      specPath,
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'app-home.canvas.jsx');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'app-home.canvas.openyida-page.json');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(source).toContain('oy-sidebar');
    expect(source).toContain('oy-nav-item');
    expect(manifest.appBlueprint).toMatchObject({
      hasPageNavigation: true,
      hideAppNav: true,
      renderNav: false,
      navConfig: {
        isRenderNav: false,
      },
    });
  });

  test('generates and compiles a curated product homepage from a spec file', () => {
    const specPath = path.join(tmpDir, 'openkuma-page.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'product-homepage',
      output: 'pages/src/openkuma-home.jsx',
      scene: 'dashboard',
      visualProfile: {
        name: 'ops-dashboard',
        neutral: 'cool-gray',
        corner: 'micro',
        accent: 'status-aware',
        motif: ['kpi-first', 'status-band'],
      },
      themeProfile: {
        name: 'ops-shell',
        themeColor: '#445566',
      },
      themeScope: 'app',
      brandName: 'OpenKuma',
      brandInitials: 'OK',
      tagline: '开放项目首页工作台',
      heroText: '把品牌展示、社区入口和运营反馈放进同一个宜搭页面',
      primaryCta: '开始体验',
      secondaryCta: '查看能力',
      blocks: [
        {
          type: 'feature-grid',
          title: '核心模块',
          items: [
            { title: '服务目录', text: '把项目能力变成清晰入口。' },
            { title: '社区反馈', text: '把需求、建议和问题沉淀到表单。' },
            { title: '运营看板', text: '把访问、线索和处理进度放在首页。' },
          ],
        },
        {
          type: 'metric-strip',
          items: [
            { value: '12', label: '模板' },
            { value: '3', label: '流程' },
            { value: '1', label: '首页' },
          ],
        },
        {
          type: 'roadmap',
          title: '交付节奏',
          items: [
            { stage: '01', title: '首页上线', text: '先让用户能看懂项目。' },
            { stage: '02', title: '反馈闭环', text: '接入表单和自动化通知。' },
            { stage: '03', title: '数据沉淀', text: '形成运营报表。' },
          ],
        },
        {
          type: 'cta',
          title: '从模板开始',
          text: '先把首页跑通，再接入真实数据。',
        },
      ],
      compile: true,
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [BIN, 'generate-page', '--spec', specPath], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'openkuma-home.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'openkuma-home.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'openkuma-home.openyida-page.json');

    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).toContain("brandName: 'OpenKuma'");
    expect(source).toContain('@openyida-template product-homepage');
    expect(source).toContain('@openyida-scene dashboard');
    expect(source).toContain('@openyida-visual-profile ops-dashboard');
    expect(source).toContain('@openyida-theme-profile ops-shell');
    expect(source).toContain('@openyida-theme-scope app');
    expect(source).toContain('@openyida-blocks hero,feature-grid,metric-strip,roadmap,cta');
    expect(source).toContain('name":"ops-dashboard');
    expect(source).toContain("featuresTitle: '核心模块'");
    expect(source).toContain('服务目录');
    expect(source).toContain('交付节奏');
    expect(source).not.toContain('{{BRAND_NAME}}');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.irVersion).toBe('1.0');
    expect(manifest.scene).toBe('dashboard');
    expect(manifest.visualProfile).toMatchObject({
      name: 'ops-dashboard',
      neutral: 'cool-gray',
      corner: 'micro',
    });
    expect(manifest.themeProfile).toMatchObject({
      name: 'ops-shell',
      themeColor: '#445566',
    });
    expect(manifest.themeScope).toBe('app');
    expect(manifest.blocks.map((block) => block.type)).toEqual([
      'hero',
      'feature-grid',
      'metric-strip',
      'roadmap',
      'cta',
    ]);
    expect(manifest.blocks[1].items[0].title).toBe('服务目录');
    expect(fs.statSync(compiledPath).size).toBeGreaterThan(1000);
  });

  test('generates a polished Code Canvas todo workspace template', () => {
    const specPath = path.join(tmpDir, 'todo-canvas-page.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'todo-mvc',
      output: 'pages/src/team-todos.canvas.jsx',
      title: '团队待办',
      subtitle: '按周目标、分类任务和日程节奏组织待办',
      placeholder: '输入任务并按 Enter',
      todos: [
        { content: '确认字段模型', done: false },
        { content: '发布到宜搭测试应用', done: true },
        { content: '补齐页面截图', done: false },
        { content: '整理验收清单', done: false },
        { content: '复盘交互细节', done: false },
      ],
      compile: true,
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [BIN, 'generate-page', '--spec', specPath], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'team-todos.canvas.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'team-todos.canvas.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'team-todos.canvas.openyida-page.json');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const compiled = fs.readFileSync(compiledPath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(source).toContain('@openyida-template todo-mvc');
    expect(source).toContain("title: '团队待办'");
    expect(source).toContain('oy-todo-os');
    expect(source).toContain('oy-category-card');
    expect(source).toContain('oy-calendar-grid');
    expect(source).toContain('window.localStorage.setItem');
    expect(source).toContain('确认字段模型');
    expect(source).not.toContain('{{TODO_TITLE}}');
    expect(compiled).toContain('window.antd');
    expect(manifest.template).toBe('todo-mvc');
    expect(manifest.scene).toBe('list');
  });

  test('generates and compiles a TodoMVC interaction page from a spec file', () => {
    const specPath = path.join(tmpDir, 'todo-page.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'todo-mvc',
      output: 'pages/src/team-todos.oyd.jsx',
      title: '团队待办',
      subtitle: '验证事件、状态、循环渲染和本地持久化',
      placeholder: '输入任务并按 Enter',
      storageKey: 'openyida.team.todos',
      todos: [
        { content: '确认字段模型', done: false },
        { content: '发布到宜搭测试应用', done: true },
      ],
      compile: true,
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [BIN, 'generate-page', '--spec', specPath], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'team-todos.oyd.jsx');
    const buildPath = path.join(tmpDir, 'pages', 'build', 'team-todos.yida.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'team-todos.yida.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'team-todos.oyd.openyida-page.json');

    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(fs.existsSync(buildPath)).toBe(true);
    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).toContain('@openyida-template todo-mvc');
    expect(source).toContain('@openyida-scene list');
    expect(source).toContain('@openyida-visual-profile yida-app-theme');
    expect(source).toContain('@openyida-theme-profile yida-app-theme');
    expect(source).toContain('@openyida-theme-scope page');
    expect(source).toContain('NATIVE_CONTROL_RESET_CSS');
    expect(source).toContain('--oyd-control-focus-ring');
    expect(source).toContain('className="oyd-page"');
    expect(source).toContain("title: '团队待办'");
    expect(source).toContain('确认字段模型');
    expect(source).toContain('window.localStorage.setItem');
    expect(source).not.toContain('{{TODO_TITLE}}');

    const built = fs.readFileSync(buildPath, 'utf8');
    expect(built).toContain('export function renderJsx()');
    expect(built).toContain('this.state && this.state.timestamp');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.scene).toBe('list');
    expect(manifest.visualProfile.name).toBe('yida-app-theme');
    expect(manifest.visualProfile.density).toBe('business-compact');
    expect(manifest.themeProfile.name).toBe('yida-app-theme');
    expect(manifest.themeScope).toBe('page');
    expect(manifest.blocks.map((block) => block.type)).toEqual([
      'todo-shell',
      'todo-list',
      'todo-actions',
      'persistence',
    ]);
    expect(manifest.blocks[1].items).toHaveLength(2);
    expect(manifest.blocks[3].storageKey).toBe('openyida.team.todos');
    expect(fs.statSync(compiledPath).size).toBeGreaterThan(1000);
  });
});
