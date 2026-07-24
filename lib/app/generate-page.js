'use strict';

const fs = require('fs');
const path = require('path');
const { applyTemplateVariables } = require('../core/sample');
const { t } = require('../core/i18n');
const { safeParseJson } = require('../core/safe-json');
const { error, success, hint, result, warn } = require('../core/chalk');
const { runLintCheck } = require('./page-linter');
const { compileSource } = require('./page-compiler');
const { compileCanvasLocal } = require('./canvas-compile');
const { buildPageFile, isAuthoringPath } = require('./page-compat');
const { throwCommandError } = require('../core/command-errors');
const {
  buildTemplateVariablesFromIr,
  escapeJsStringValue,
  normalizePageSpec,
} = require('./page-ir');

const TEMPLATES = {
  'product-homepage': {
    name: 'product-homepage',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'product-homepage.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'product-homepage.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'home.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'home.canvas.jsx'),
  },
  'workbench-home': {
    name: 'workbench-home',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'workbench-home.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'workbench-home.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'workbench-home.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'workbench-home.canvas.jsx'),
  },
  'dashboard-overview': {
    name: 'dashboard-overview',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'dashboard-overview.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'dashboard-overview.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'dashboard-overview.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'dashboard-overview.canvas.jsx'),
  },
  'official-homepage': {
    name: 'official-homepage',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'official-homepage.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'official-homepage.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'official-home.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'official-home.canvas.jsx'),
  },
  'data-screen': {
    name: 'data-screen',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'data-screen.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'data-screen.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'data-screen.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'data-screen.canvas.jsx'),
  },
  'data-management': {
    name: 'data-management',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'data-management.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'data-management.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'data-management.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'data-management.canvas.jsx'),
  },
  'business-list': {
    name: 'business-list',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'business-list.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'business-list.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'business-list.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'business-list.canvas.jsx'),
  },
  'detail-profile': {
    name: 'detail-profile',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'detail-profile.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'detail-profile.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'detail-profile.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'detail-profile.canvas.jsx'),
  },
  'split-pane-detail': {
    name: 'split-pane-detail',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'split-pane-detail.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'split-pane-detail.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'split-pane-detail.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'split-pane-detail.canvas.jsx'),
  },
  'portal-shell-home': {
    name: 'portal-shell-home',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'portal-shell-home.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'portal-shell-home.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'portal-shell-home.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'portal-shell-home.canvas.jsx'),
  },
  'todo-mvc': {
    name: 'todo-mvc',
    nativeFile: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'todo-mvc.oyd.jsx'),
    canvasFile: path.join(__dirname, '..', 'samples', 'yida-canvas-custom-page', 'todo-mvc.canvas.jsx'),
    defaultNativeOutput: path.join('pages', 'src', 'todo-mvc.oyd.jsx'),
    defaultCanvasOutput: path.join('pages', 'src', 'todo-mvc.canvas.jsx'),
  },
};

function collectSpecText(spec) {
  if (!spec || typeof spec !== 'object') {
    return '';
  }
  return [
    spec.template,
    spec.pageType,
    spec.scene,
    spec.title,
    spec.name,
    spec.brandName,
    spec.tagline,
    spec.description,
    spec.desc,
    spec.requirement,
    spec.requirements,
    spec.prompt,
    spec.goal,
    spec.industry,
    spec.businessType,
    spec.archetype,
    spec.researchLevel,
  ]
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .filter((item) => item !== undefined && item !== null)
    .map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item))
    .join(' ');
}

function inferTemplateName(options, spec) {
  if (options.template) {
    return options.template;
  }
  if (spec.template) {
    return spec.template;
  }

  const text = collectSpecText(spec);
  if (/数据大屏|大屏|实时监控|预警系统|态势|指挥舱|监测预警|screen/i.test(text)) {
    return 'data-screen';
  }
  if (/官网|官方首页|官网首页|落地页|品牌首页|品牌官网|律所|律师事务所|茶叶官网|企业官网|门户官网|landing|official/i.test(text)) {
    return 'official-homepage';
  }
  if (/经营看板|数据看板|管理驾驶舱|驾驶舱|业务看板|经营分析|dashboard|overview/i.test(text)) {
    return 'dashboard-overview';
  }
  if (/主从|分栏|左右分栏|左列表右详情|列表右详情|详情分栏|处理台|split[-\s]?pane|master[-\s]?detail/i.test(text)) {
    return 'split-pane-detail';
  }
  if (/内部门户|部门门户|门户首页|门户壳|多入口门户|应用门户|统一入口门户|隐藏导航|portal[-\s]?shell/i.test(text)) {
    return 'portal-shell-home';
  }
  if (/工作台|运营台|任务中心|业务首页|系统首页|workbench/i.test(text)) {
    return 'workbench-home';
  }
  if (/多维表|数据管理|数据表|字段管理|表格视图|表格样式|记录管理|台账管理|base|airtable|grid/i.test(text)) {
    return 'data-management';
  }
  if (/列表|管理页|数据管理|订单管理|客户列表|工单池|商品管理|记录管理|筛选|批量处理|list/i.test(text)) {
    return 'business-list';
  }
  if (/详情|档案|画像|单据详情|订单详情|客户档案|项目详情|商品详情|详情页|detail|profile/i.test(text)) {
    return 'detail-profile';
  }
  return 'product-homepage';
}

function parseStructuredOption(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return safeParseJson(raw);
    } catch (err) {
      return value;
    }
  }
  return value;
}

function parseArgs(args) {
  const options = {
    template: args[0] && !args[0].startsWith('--') ? args[0] : null,
    output: null,
    spec: null,
    scene: null,
    visualProfile: null,
    themeProfile: null,
    themeScope: null,
    researchLevel: null,
    archetype: null,
    appBlueprint: null,
    interactionProfile: null,
    insights: null,
    dataBinding: null,
    canvas: false,
    native: false,
    compile: false,
    resolveAssets: false,
    uploadAssets: false,
    offlineAssets: false,
    variables: {},
  };

  for (let i = options.template ? 1 : 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
      continue;
    }

    if (arg === '--spec' && args[i + 1]) {
      options.spec = args[++i];
      continue;
    }

    if (arg === '--scene' && args[i + 1]) {
      options.scene = args[++i];
      continue;
    }

    if ((arg === '--visual-profile' || arg === '--visual') && args[i + 1]) {
      const value = args[++i];
      try {
        options.visualProfile = value.trim().startsWith('{') ? safeParseJson(value) : value;
      } catch (err) {
        options.visualProfile = value;
      }
      continue;
    }

    if (arg === '--theme-profile' && args[i + 1]) {
      const value = args[++i];
      try {
        options.themeProfile = value.trim().startsWith('{') ? safeParseJson(value) : value;
      } catch (err) {
        options.themeProfile = value;
      }
      if (!options.visualProfile) {
        options.visualProfile = options.themeProfile;
      }
      continue;
    }

    if (arg === '--theme-scope' && args[i + 1]) {
      options.themeScope = args[++i];
      continue;
    }

    if (arg === '--research-level' && args[i + 1]) {
      options.researchLevel = args[++i];
      continue;
    }

    if (arg === '--archetype' && args[i + 1]) {
      options.archetype = args[++i];
      continue;
    }

    if (arg === '--app-blueprint' && args[i + 1]) {
      options.appBlueprint = parseStructuredOption(args[++i]);
      continue;
    }

    if (arg === '--interaction-profile' && args[i + 1]) {
      options.interactionProfile = parseStructuredOption(args[++i]);
      continue;
    }

    if (arg === '--insights' && args[i + 1]) {
      options.insights = parseStructuredOption(args[++i]);
      continue;
    }

    if (arg === '--insight' && args[i + 1]) {
      const insight = parseStructuredOption(args[++i]);
      options.insights = Array.isArray(options.insights) ? options.insights : options.insights ? [options.insights] : [];
      options.insights.push(insight);
      continue;
    }

    if ((arg === '--data-binding' || arg === '--data-source') && args[i + 1]) {
      options.dataBinding = parseStructuredOption(args[++i]);
      continue;
    }

    if (arg === '--compile') {
      options.compile = true;
      continue;
    }

    if (arg === '--resolve-assets') {
      options.resolveAssets = true;
      continue;
    }

    if (arg === '--upload-assets') {
      // 上传本地素材到 CDN 需要先解析回填
      options.uploadAssets = true;
      options.resolveAssets = true;
      continue;
    }

    if (arg === '--offline-assets') {
      options.offlineAssets = true;
      continue;
    }

    if (arg === '--canvas') {
      options.canvas = true;
      continue;
    }

    if (arg === '--native') {
      options.native = true;
      continue;
    }

    if (arg === '--var' && args[i + 1]) {
      const pair = args[++i];
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        options.variables[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
      }
      continue;
    }

    if (arg.startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
      options.variables[arg.slice(2)] = args[++i];
    }
  }

  return options;
}

function isCanvasPath(filePath) {
  return /\.canvas\.(jsx|tsx)$/i.test(String(filePath || ''));
}

function isNativePath(filePath) {
  const value = String(filePath || '');
  return /\.jsx$/i.test(value) && !isCanvasPath(value);
}

function inferMode(options, spec) {
  if (options.canvas || spec.canvas === true || spec.mode === 'canvas') {
    return 'canvas';
  }
  if (options.native || spec.native === true || spec.mode === 'native') {
    return 'native';
  }

  const requestedOutput = options.output || spec.output || '';
  if (requestedOutput) {
    if (isCanvasPath(requestedOutput)) {
      return 'canvas';
    }
    if (isNativePath(requestedOutput)) {
      return 'native';
    }
  }

  return 'canvas';
}

function loadSpec(specPath) {
  if (!specPath) {
    return {};
  }

  const resolvedPath = path.resolve(specPath);
  if (!fs.existsSync(resolvedPath)) {
    error(t('generate_page.spec_not_found', resolvedPath));
  }

  try {
    return safeParseJson(fs.readFileSync(resolvedPath, 'utf-8'));
  } catch (err) {
    error(t('generate_page.spec_invalid', err.message));
  }
}

function buildTemplateVariables(templateConfig, cliVariables, spec) {
  const ir = normalizePageSpec(spec || {}, {
    template: templateConfig.name,
    variables: cliVariables || {},
  });
  return buildTemplateVariablesFromIr(ir);
}

/**
 * 素材预检：在生成官网/落地页前，诚实评估素材完成度，回填 ir.assets.materialStatus。
 *
 * - --resolve-assets：真正联网校验外链 / （有 CDN 时）上传本地图并回填稳定 URL；
 * - 默认（无 flag）：不联网，仅做轻量判断——landing 页无 Hero 图即标为 none/draft，
 *   避免在无素材情况下静默交付「最终版」。
 *
 * @param {object} ir normalizePageSpec 产出的 IR（会被就地修改 assets）
 * @param {object} options generate-page 选项
 * @returns {Promise<{materialStatus:string, materialGaps:string[], resolvedFromNetwork:boolean}>|null}
 */
async function applyMaterialPrecheck(ir, options) {
  if (!ir || !ir.assets) {
    return null;
  }
  const assets = ir.assets;
  const requireHero = ir.template === 'official-homepage' || ir.scene === 'landing';

  const productUrls = (assets.productImages || [])
    .map((p) => (typeof p === 'string' ? p : p && p.url))
    .filter(Boolean);

  if (options.resolveAssets) {
    const { resolveAssets } = require('../asset/asset-resolve');
    const res = await resolveAssets(
      {
        heroImage: assets.heroImage,
        heroImageAlt: assets.heroImageAlt,
        productImages: productUrls,
      },
      { requireHero, online: !options.offlineAssets, mirrorExternal: !!options.uploadAssets }
    );
    assets.heroImage = res.assets.heroImage;
    assets.productImages = res.assets.productImages.map((url) => ({ url, alt: '' }));
    assets.materialStrategy = res.strategy;
    assets.materialStatus = res.materialStatus;
    assets.materialGaps = res.materialGaps;
    return { ...res, resolvedFromNetwork: true };
  }

  // 未联网：轻量诚实判断
  const gaps = [];
  if (requireHero) {
    if (!assets.heroImage) {
      gaps.push('缺少 Hero 图：官网/落地页应提供品牌主视觉大图。先运行 `openyida asset generate` 获取免费素材库，再用 `--resolve-assets` 校验回填。');
      assets.materialStatus = 'none';
    } else {
      gaps.push('Hero 图未经校验：加 `--resolve-assets` 校验可达后才可交付最终版，否则视为草稿。');
      assets.materialStatus = 'draft';
    }
  } else if (assets.materialStatus === 'unknown') {
    assets.materialStatus = 'final';
  }
  assets.materialGaps = gaps;
  return { materialStatus: assets.materialStatus, materialGaps: gaps, resolvedFromNetwork: false };
}

/**
 * 打印素材状态提示：非 final 时明确告知这是「草稿」而非最终版。
 */
function reportMaterialStatus(precheck) {
  if (!precheck) {return;}
  if (precheck.materialStatus === 'final') {
    return;
  }
  warn(`素材状态：${precheck.materialStatus}（非最终版）——此页面为草稿，请勿对外声称已交付最终版。`);
  (precheck.materialGaps || []).forEach((g) => hint('  · ' + g));
}

function reportDomainFidelity(ir) {
  const fidelity = ir && ir.domainFidelity;
  if (!fidelity || fidelity.status === 'domain-ready') {
    return;
  }
  warn(`业务定制度：${fidelity.status}（score ${fidelity.score}）——当前页面仍带有 sample fallback，只能作为草稿或参考骨架。`);
  if (fidelity.sampleFallbacks && fidelity.sampleFallbacks.length) {
    hint('  · 仍使用 sample 默认内容：' + fidelity.sampleFallbacks.join(', '));
  }
  (fidelity.missing || []).forEach((item) => hint('  · 缺少：' + item));
  if (fidelity.guidance) {
    hint('  · ' + fidelity.guidance);
  }
}

function reportNavigationConfig(ir) {
  const blueprint = ir && ir.appBlueprint;
  if (!blueprint || blueprint.renderNav !== false) {
    return;
  }
  hint('检测到页面内应用导航或沉浸式页面，发布后应设置 isRenderNav=false：openyida update-form-config <appType> <formUuid> false "<页面标题>"');
}

function ensureOutputDir(outputPath) {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function getManifestPath(outputPath) {
  const parsed = path.parse(outputPath);
  return path.join(parsed.dir, `${parsed.name}.openyida-page.json`);
}

function getCanvasDistPath(outputPath) {
  const normalizedPath = String(outputPath).replace(/\\/g, '/');
  const parsed = path.parse(normalizedPath);
  const rawDir = parsed.dir || '';
  const isAbsoluteDir = rawDir.startsWith('/');
  const dirSegments = isAbsoluteDir ? rawDir.slice(1).split('/') : rawDir.split('/');
  const filteredDirSegments = dirSegments.filter((segment) => segment);
  const sourceFileName = parsed.base || '';
  const srcIndex = filteredDirSegments.lastIndexOf('src');
  const distSegments = srcIndex >= 0
    ? [...filteredDirSegments.slice(0, srcIndex), 'dist', ...filteredDirSegments.slice(srcIndex + 1)]
    : [...filteredDirSegments, 'dist'];
  const distDir = isAbsoluteDir ? `/${distSegments.join('/')}` : distSegments.join('/');
  const distName = /\.canvas\.jsx$/i.test(sourceFileName)
    ? sourceFileName.replace(/\.canvas\.jsx$/i, '.canvas.js')
    : `${parsed.name}.js`;
  return path.posix.join(distDir, distName);
}

function isOpenYidaProjectCwd(cwd) {
  const currentDir = cwd || process.cwd();
  return path.basename(currentDir) === 'project' && (
    fs.existsSync(path.join(currentDir, 'config.json')) ||
    fs.existsSync(path.join(currentDir, 'pages'))
  );
}

function normalizeOutputPathForProjectCwd(output, options = {}) {
  const cwd = options.cwd || process.cwd();
  const rawOutput = String(output || '');
  if (!rawOutput || path.isAbsolute(rawOutput)) {
    return {
      outputPath: path.resolve(cwd, rawOutput),
      strippedProjectPrefix: false,
      requestedOutput: rawOutput,
      normalizedOutput: rawOutput,
    };
  }

  const slashOutput = rawOutput.replace(/\\/g, '/').replace(/^\.\//, '');
  const shouldStrip = isOpenYidaProjectCwd(cwd) && (
    slashOutput.startsWith('project/pages/') ||
    slashOutput.startsWith('project/.cache/')
  );
  const normalizedOutput = shouldStrip ? slashOutput.slice('project/'.length) : rawOutput;
  return {
    outputPath: path.resolve(cwd, normalizedOutput),
    strippedProjectPrefix: shouldStrip,
    requestedOutput: rawOutput,
    normalizedOutput,
  };
}

async function run(args) {
  const options = parseArgs(args || []);
  const spec = loadSpec(options.spec);
  const templateName = inferTemplateName(options, spec);
  const templateConfig = TEMPLATES[templateName];

  if (!templateConfig) {
    error(t('generate_page.unknown_template', templateName), {
      hint: t('generate_page.available_templates', Object.keys(TEMPLATES).join(', ')),
    });
  }

  const mode = inferMode(options, spec);
  const templateFile = mode === 'canvas' ? templateConfig.canvasFile : templateConfig.nativeFile;

  if (!fs.existsSync(templateFile)) {
    error(t('generate_page.template_not_found', templateFile));
  }

  const outputResolution = normalizeOutputPathForProjectCwd(
    options.output || spec.output || (mode === 'canvas' ? templateConfig.defaultCanvasOutput : templateConfig.defaultNativeOutput)
  );
  const outputPath = outputResolution.outputPath;
  const manifestPath = getManifestPath(outputPath);
  const templateSource = fs.readFileSync(templateFile, 'utf-8');
  const ir = normalizePageSpec(spec, {
    template: templateName,
    variables: options.variables,
    scene: options.scene,
    visualProfile: options.visualProfile,
    themeProfile: options.themeProfile,
    themeScope: options.themeScope,
    researchLevel: options.researchLevel,
    archetype: options.archetype,
    appBlueprint: options.appBlueprint,
    interactionProfile: options.interactionProfile,
    insights: options.insights,
    dataBinding: options.dataBinding,
  });

  // 素材预检：诚实评估素材完成度并回填（必要时联网校验 / 转存 CDN）
  const materialPrecheck = await applyMaterialPrecheck(ir, options);

  const variables = buildTemplateVariablesFromIr(ir);
  const outputSource = applyTemplateVariables(templateSource, variables);

  ensureOutputDir(outputPath);
  fs.writeFileSync(outputPath, outputSource, 'utf-8');
  fs.writeFileSync(manifestPath, `${JSON.stringify(ir, null, 2)}\n`, 'utf-8');

  if (outputResolution.strippedProjectPrefix) {
    warn(t('generate_page.output_project_prefix_stripped', outputResolution.requestedOutput, outputResolution.normalizedOutput));
  }
  success(t('generate_page.done', outputPath));
  hint(t('generate_page.hint'));
  reportMaterialStatus(materialPrecheck);
  reportDomainFidelity(ir);
  reportNavigationConfig(ir);

  if (mode === 'canvas') {
    const canvasResult = compileCanvasLocal(outputSource);
    const importedModules = JSON.parse(canvasResult.importedModules);
    if (options.compile || spec.compile === true) {
      const distPath = getCanvasDistPath(outputPath);
      ensureOutputDir(distPath);
      fs.writeFileSync(distPath, canvasResult.runtimeCode, 'utf-8');
    }
    result(true, t('generate_page.success'), [
      ['Template', templateName],
      ['Mode', 'canvas'],
      ['Scene', ir.scene],
      ['Material status', ir.assets && ir.assets.materialStatus],
      ['Domain fidelity', ir.domainFidelity ? ir.domainFidelity.status : 'n/a'],
      ['Research level', ir.researchLevel],
      ['Archetype', ir.archetype],
      ['Visual profile', ir.visualProfile && ir.visualProfile.name],
      ['Theme profile', ir.themeProfile && ir.themeProfile.name],
      ['Theme scope', ir.themeScope],
      ['Yida nav', ir.appBlueprint && ir.appBlueprint.renderNav === false ? 'hide (isRenderNav=false)' : 'render'],
      ['Imported modules', importedModules.join(', ')],
      ['Blocks', ir.blocks.map((block) => block.type).join(', ')],
      ['Output', outputPath],
      ['Manifest', manifestPath],
    ]);
    return;
  }

  let checkPath = outputPath;
  let checkSource = outputSource;

  if (isAuthoringPath(outputPath)) {
    const buildResult = buildPageFile(outputPath);
    if (!buildResult.ok) {
      buildResult.errors.forEach((issue) => error(`${issue.code}: ${issue.message}`));
    }
    checkPath = buildResult.outputPath;
    checkSource = fs.readFileSync(checkPath, 'utf-8');
  }

  const lintPassed = runLintCheck(checkSource, checkPath);
  if (!lintPassed) {
    throwCommandError(t('check_page.failed'));
  }

  if (options.compile || spec.compile === true) {
    compileSource(checkPath);
  } else {
    result(true, t('generate_page.success'), [
      ['Template', templateName],
      ['Mode', 'native'],
      ['Scene', ir.scene],
      ['Material status', ir.assets && ir.assets.materialStatus],
      ['Domain fidelity', ir.domainFidelity ? ir.domainFidelity.status : 'n/a'],
      ['Research level', ir.researchLevel],
      ['Archetype', ir.archetype],
      ['Visual profile', ir.visualProfile && ir.visualProfile.name],
      ['Theme profile', ir.themeProfile && ir.themeProfile.name],
      ['Theme scope', ir.themeScope],
      ['Yida nav', ir.appBlueprint && ir.appBlueprint.renderNav === false ? 'hide (isRenderNav=false)' : 'render'],
      ['Blocks', ir.blocks.map((block) => block.type).join(', ')],
      ['Output', outputPath],
      ['Manifest', manifestPath],
    ]);
  }
}

module.exports = {
  run,
  parseArgs,
  buildTemplateVariables,
  escapeJsStringValue,
  getManifestPath,
  getCanvasDistPath,
  normalizeOutputPathForProjectCwd,
  inferMode,
  inferTemplateName,
};
