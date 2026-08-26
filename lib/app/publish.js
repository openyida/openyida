#!/usr/bin/env node
/**
 * publish.js - 宜搭自定义页面发布工具（Node.js 版）
 *
 * 用法：
 *   openyida publish <源文件路径> <appType> <formUuid>
 *
 * 示例：
 *   openyida publish pages/xxx.js APP_XXX FORM-XXX
 *
 * 流程：
 * 1. 读取源文件，通过内置 babel-transform 编译 + UglifyJS 压缩
 * 2. 用代码动态构建 Schema，将 source/compiled 填入 actions.module
 * 3. 读取 token session，在写前确认登录态
 * 4. 通过 HTTP POST 调用 saveFormSchema，token 失效时尝试 token refresh
 */

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const {
  findProjectRoot,
  httpPost,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef, isTokenAuthRef } = require('../core/yida-client');
const { requireSchemaServerRevision } = require('../core/server-revision');
const { t } = require('../core/i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage, hint } = require('../core/chalk');
const { CliError } = require('../core/cli-error');
const { compileSource } = require('./page-compiler');
const { compileCanvas } = require('./canvas-compile');
const { runLintCheck } = require('./page-linter');
const { buildPageFile, shouldBuildPageSource } = require('./page-compat');
const { warnLargePageSource } = require('./page-size-guard');
const { fetchFormPageList } = require('./form-navigation');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { assertNoEmojiInValue } = require('../core/no-emoji-guard');
const { loadPageSource } = require('./services/page-source-loader');
const {
  buildDefaultPageDataSource,
  buildNativePageSchemaContent,
  countCustomPageDataSources,
  extractPageDataSource,
  extractSchemaContent,
  mergePageDataSource,
} = require('./services/native-page-schema-builder');
const {
  buildCanvasPageSchemaContent,
} = require('./services/canvas-page-schema-builder');
const {
  verifyPublishedContentMatch,
} = require('./display-page-readback');

// ── 配置读取 ──────────────────────────────────────────
const SCHEMA_VERSION = 'V5';
const DOMAIN_CODE = 'tEXDRG';
const PREFIX = '_view';

// ── 参数解析 ─────────────────────────────────────────

function looksLikeAppType(value) {
  return /^APP_[A-Z0-9]+$/i.test(value || '');
}

function looksLikeFormUuid(value) {
  return /^FORM-[A-Z0-9]+$/i.test(value || '');
}

function normalizePublishArgs(positionals) {
  const [first, second, third] = positionals;

  if (looksLikeAppType(first) && looksLikeFormUuid(second)) {
    return {
      appType: first,
      formUuid: second,
      sourceFile: third,
    };
  }

  return {
    sourceFile: first,
    appType: second,
    formUuid: third,
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const openOption = parseOpenOption(argv);
  const args = openOption.args;
  const skipLint = args.includes('--skip-lint');
  const healthCheck = args.includes('--health-check') || args.includes('--check');
  const compat = args.includes('--compat') || args.includes('--modern');
  const force = args.includes('--force');
  const canvas = args.includes('--canvas');
  const autoNavOrder = args.includes('--auto-nav-order');
  const help = args.includes('--help') || args.includes('-h');
  const filteredArgs = args.filter(arg => arg !== '--skip-lint' && arg !== '--health-check' && arg !== '--check' && arg !== '--compat' && arg !== '--modern' && arg !== '--force' && arg !== '--canvas' && arg !== '--auto-nav-order' && arg !== '--json' && arg !== '--help' && arg !== '-h');

  if (help) {
    usage(t('publish.usage'), t('publish.example'));
    return { help: true };
  }

  if (filteredArgs.length < 3) {
    usage(t('publish.usage'), t('publish.example'));
    process.exit(1);
  }
  const { appType, formUuid, sourceFile } = normalizePublishArgs(filteredArgs);
  return {
    appType,
    formUuid,
    sourceFile,
    skipLint,
    healthCheck,
    compat,
    force,
    canvas,
    autoNavOrder,
    browserOpenMode: openOption.mode,
  };
}

function buildCanvasCompileCliError(errorObject, sourcePath) {
  const code = errorObject && errorObject.code
    ? errorObject.code
    : 'OPENYIDA_CANVAS_COMPILE_FAILED';
  const detail = errorObject && errorObject.message ? errorObject.message : String(errorObject);
  const baseDetails = errorObject && errorObject.details && typeof errorObject.details === 'object'
    ? { ...errorObject.details }
    : {};

  return new CliError(`${t('publish.canvas_compile_failed', detail)}\nError Code: ${code}`, {
    code,
    details: {
      ...baseDetails,
      stage: 'canvas_compile',
      sourcePath,
    },
  });
}

function enableQuietForJson(argv = []) {
  if (!Array.isArray(argv) || !argv.includes('--json')) {
    return () => {};
  }
  const previousQuiet = process.env.YIDA_QUIET;
  process.env.YIDA_QUIET = '1';
  return () => {
    if (previousQuiet === undefined) {
      delete process.env.YIDA_QUIET;
    } else {
      process.env.YIDA_QUIET = previousQuiet;
    }
  };
}

function normalizeSourcePathForHint(sourceFile) {
  return String(sourceFile || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function buildMissingSourceHints(sourceFile, cwd = process.cwd()) {
  const normalized = normalizeSourcePathForHint(sourceFile);
  const candidates = [];

  if (normalized.startsWith('project/pages/src/')) {
    candidates.push(normalized.slice('project/'.length));
  }

  if (normalized.startsWith('pages/src/')) {
    candidates.push(`project/${normalized}`);
  }

  return Array.from(new Set(candidates))
    .filter(candidate => fs.existsSync(path.resolve(cwd, candidate)));
}

function isPathInside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function loadPublishSource(sourcePath, options = {}) {
  const absolutePath = path.resolve(sourcePath);
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());

  if (isPathInside(workspaceRoot, absolutePath)) {
    const relativePath = path.relative(workspaceRoot, absolutePath) || path.basename(absolutePath);
    const loaded = loadPageSource(relativePath, { workspaceRoot });
    return Object.assign({}, loaded, { absolutePath });
  }

  return {
    absolutePath,
    byteLength: fs.statSync(absolutePath).size,
    profile: 'absolute/raw-file',
    relativePath: absolutePath,
    source: fs.readFileSync(absolutePath, 'utf-8'),
    sourceHash: null,
  };
}

// ── 2. 读取并构建 Schema ────────────────────────────

async function fetchExistingSchemaContent(appType, formUuid, authRef) {
  const result = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/${PREFIX}/query/formdesign/getFormSchema.json`,
      { formUuid, schemaVersion: SCHEMA_VERSION }
    );
  }, authRef);

  if (!result || result.success === false || result.__needLogin || result.__csrfExpired) {
    const errorMsg = result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed');
    throw new Error(errorMsg);
  }

  const schema = extractSchemaContent(result);
  if (!schema) {
    throw new Error(t('create_form.schema_parse_failed'));
  }

  return {
    schema,
    serverRevision: requireSchemaServerRevision(result),
  };
}

async function readExistingPageDataSource(appType, formUuid, authRef) {
  info(t('publish.data_source_fetching'));
  const existing = await fetchExistingSchemaContent(appType, formUuid, authRef);
  const dataSource = extractPageDataSource(existing.schema);
  const customCount = countCustomPageDataSources(dataSource);

  if (customCount > 0) {
    success(t('publish.data_source_preserved', String(customCount)));
  } else {
    info(t('publish.data_source_none'));
  }

  return { dataSource, serverRevision: existing.serverRevision };
}

function buildSchemaContent(sourceCode, compiledCode, formUuid, options = {}) {
  const logInfo = options.silent === true ? () => {} : info;
  assertNoEmojiInValue({
    sourceCode,
    compiledCode,
    existingDataSource: options.existingDataSource,
  }, {
    artifact: 'native page schema ' + formUuid,
    code: 'OPENYIDA_PAGE_SCHEMA_EMOJI_FORBIDDEN',
  });
  return buildNativePageSchemaContent(sourceCode, compiledCode, formUuid, {
    ...options,
    onBuildingSchema: () => logInfo(t('publish.building_schema')),
    onFormulaPrefixFixed: fixedRefs => {
      logInfo(t('publish.formula_prefix_fixed', fixedRefs));
    },
  });
}

// ── 2b. 构建 Code Canvas Schema ─────────────────────
// 与 native 的差异仅在 content JSON：Page.children 直接挂一个 YidaCodeCanvas
// 节点，无 RootHeader/RootContent/Jsx/RootFooter；actions.module 为默认 didMount
// 样板；Page.dataSource 精简（canvas 无原生数据桥）。
// wire 层（path/query/body/headers）复用单次 save transport。

function buildCanvasSchemaContent(sourceCode, runtimeCode, importedModules, formUuid) {
  info(t('publish.building_schema'));
  assertNoEmojiInValue({
    sourceCode,
    runtimeCode,
    importedModules,
  }, {
    artifact: 'canvas page schema ' + formUuid,
    code: 'OPENYIDA_PAGE_SCHEMA_EMOJI_FORBIDDEN',
  });
  return buildCanvasPageSchemaContent(sourceCode, runtimeCode, importedModules, formUuid);
}


// ── 4. 发送 saveFormSchema 请求 ──────────────────────

function sendSaveRequestWithAuth(authRef, schemaContent, appType, formUuid, serverRevision) {
  if (
    !authRef ||
    typeof authRef.baseUrl !== 'string' ||
    authRef.baseUrl.length === 0 ||
    !isTokenAuthRef(authRef)
  ) {
    const authError = new Error('Publish Schema write authentication is not ready.');
    authError.code = 'PUBLISH_SCHEMA_WRITE_PRECHECK_FAILED';
    return Promise.reject(authError);
  }
  const gmtModified = requireSchemaServerRevision({ gmtModified: serverRevision });
  const saveSchemaPath = `/alibaba/web/${appType}/${PREFIX}/query/formdesign/saveFormSchema.json?_stamp=${Date.now()}`;
  const postData = querystring.stringify({
    _csrf_token: authRef.csrfToken,
    prefix: PREFIX,
    content: schemaContent,
    formUuid,
    gmtModified,
    schemaVersion: SCHEMA_VERSION,
    domainCode: DOMAIN_CODE,
    importSchema: true,
  });
  return httpPost(authRef.baseUrl, saveSchemaPath, postData, { silentStatus: true });
}

function walkFiles(dir, results, limit) {
  if (!fs.existsSync(dir) || results.length >= limit) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= limit) {
      return;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, results, limit);
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
}

function collectFilesByBasename(rootDir, basename, limit = 200) {
  const files = [];
  walkFiles(rootDir, files, limit);
  return files.filter(file => path.basename(file) === basename);
}

function getWorkspaceRoot(projectRoot) {
  return path.basename(projectRoot) === 'project' ? path.dirname(projectRoot) : projectRoot;
}

function findDuplicateSourceMismatches(sourcePath, projectRoot = findProjectRoot()) {
  const resolvedSource = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSource)) {
    return [];
  }

  const sourceBasename = path.basename(resolvedSource);
  const workspaceRoot = getWorkspaceRoot(projectRoot);
  const candidates = new Set();
  const projectPagesSrc = path.join(projectRoot, 'pages', 'src');
  const artifactsRoot = path.join(workspaceRoot, 'projects');

  collectFilesByBasename(projectPagesSrc, sourceBasename).forEach(file => candidates.add(path.resolve(file)));

  if (fs.existsSync(artifactsRoot)) {
    fs.readdirSync(artifactsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .forEach(entry => {
        const artifactDir = path.join(artifactsRoot, entry.name, 'artifacts');
        collectFilesByBasename(artifactDir, sourceBasename).forEach(file => candidates.add(path.resolve(file)));
      });
  }

  candidates.delete(resolvedSource);
  const sourceContent = fs.readFileSync(resolvedSource, 'utf-8');
  return Array.from(candidates)
    .filter(candidate => fs.existsSync(candidate))
    .filter(candidate => fs.readFileSync(candidate, 'utf-8') !== sourceContent)
    .map(candidate => ({ sourcePath: resolvedSource, duplicatePath: candidate }));
}

function warnDuplicateSourceMismatches(sourcePath) {
  const mismatches = findDuplicateSourceMismatches(sourcePath);
  mismatches.forEach(({ sourcePath: currentPath, duplicatePath }) => {
    warn(t('publish.duplicate_source_mismatch', currentPath, duplicatePath));
  });
  return mismatches;
}

function normalizeFormType(formType) {
  return String(formType || '').trim().toLowerCase();
}

function findPublishTarget(forms, formUuid) {
  return (Array.isArray(forms) ? forms : []).find((form) => form && form.formUuid === formUuid) || null;
}

function isCustomPageTarget(form) {
  return normalizeFormType(form && form.formType) === 'display';
}

async function verifyPublishTarget(appType, formUuid, authRef, options = {}) {
  if (options.force) {
    return { ok: true, skipped: true };
  }

  try {
    const forms = await fetchFormPageList(appType, authRef);
    const target = findPublishTarget(forms, formUuid);

    if (!target) {
      return { ok: false, reason: 'not_found' };
    }

    if (!isCustomPageTarget(target)) {
      return { ok: false, reason: 'wrong_type', target };
    }

    return { ok: true, target };
  } catch (targetError) {
    return { ok: false, reason: 'fetch_failed', error: targetError };
  }
}

async function ensurePublishTargetOrExit(appType, formUuid, authRef, options = {}) {
  if (options.force) {
    warn(t('publish.target_check_forced'));
    return null;
  }

  info(t('publish.target_checking'));
  const check = await verifyPublishTarget(appType, formUuid, authRef, options);

  if (check.ok) {
    const targetName = check.target.formName || formUuid;
    const targetType = check.target.formType || 'display';
    success(t('publish.target_check_ok', targetName, targetType));
    return check.target;
  }

  if (check.reason === 'wrong_type') {
    const target = check.target || {};
    const targetName = target.formName || formUuid;
    const targetType = target.formType || '-';
    fail(t('publish.target_type_invalid', formUuid, targetType));
    hint(t('publish.target_type_hint', targetName, targetType));
  } else if (check.reason === 'not_found') {
    fail(t('publish.target_not_found', formUuid));
  } else {
    const message = check.error && check.error.message ? check.error.message : t('common.unknown_error');
    fail(t('publish.target_check_failed', message));
  }

  hint(t('publish.target_list_hint', appType));
  hint(t('publish.target_force_hint'));
  process.exit(1);
  return null;
}

async function runPublishReadbackHealthCheck(appType, formUuid, authRef, schemaContent, publishMode) {
  const baseResult = {
    ok: false,
    mode: 'publish_readback',
    authMode: 'token',
    targetReadable: false,
    schemaParsed: false,
    displayComponentPresent: false,
    publishedContentMatched: false,
  };

  let readback;
  try {
    readback = await fetchExistingSchemaContent(appType, formUuid, authRef);
  } catch (readbackError) {
    return {
      ...baseResult,
      reason: 'schema_readback_failed',
      error: readbackError && readbackError.message ? readbackError.message : t('common.unknown_error'),
    };
  }

  const match = verifyPublishedContentMatch(readback.schema, schemaContent, publishMode);
  const resultPayload = {
    ...baseResult,
    targetReadable: true,
    schemaParsed: true,
    displayComponentPresent: match.displayComponentPresent,
    publishedContentMatched: match.publishedContentMatched,
  };

  if (!match.displayComponentPresent) {
    return {
      ...resultPayload,
      reason: 'display_component_missing',
    };
  }

  if (!match.publishedContentMatched) {
    return {
      ...resultPayload,
      reason: 'published_content_mismatch',
    };
  }

  return {
    ...resultPayload,
    ok: true,
  };
}

// ── 主流程 ────────────────────────────────────────────

async function main(argv) {
  const rawArgv = argv || process.argv.slice(2);
  const restoreQuiet = enableQuietForJson(rawArgv);
  try {
    return await runMain(rawArgv);
  } finally {
    restoreQuiet();
  }
}

async function runMain(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    return options;
  }
  const { appType, formUuid, sourceFile, skipLint, healthCheck, compat, force, canvas: canvasFlag, autoNavOrder, browserOpenMode } = options;

  let sourcePath = path.resolve(sourceFile);
  if (!fs.existsSync(sourcePath)) {
    error(t('publish.source_not_found', sourcePath));
    buildMissingSourceHints(sourceFile).forEach((candidate) => {
      hint(t('publish.source_path_hint', candidate));
    });
    process.exit(1);
  }

  // 路由：默认平台 JSX 组件；.canvas.jsx / .canvas.tsx 源文件自动走 YidaCodeCanvas 发布分支，
  // --canvas 作为显式覆盖（用于扩展名不规范但确为 canvas 源码的场景）。
  const isCanvas = canvasFlag || /\.canvas\.(jsx|tsx)$/i.test(sourcePath);

  const initialSource = loadPublishSource(sourcePath);
  sourcePath = initialSource.absolutePath;
  const initialSourceCode = initialSource.source;
  warnLargePageSource(initialSourceCode, sourcePath);

  let sourceCode = initialSourceCode;
  let compiledCode = '';
  let canvasResult = null;

  if (isCanvas) {
    // YidaCodeCanvas 发布分支：跳过平台 JSX 组件编译/lint，改用本地 Babel 编译
    // （JSX/TS → runtimeCode + importedModules），无需登录态，可在开浏览器前失败快。
    step(1, t('publish.step_canvas_compile'));
    info(t('publish.canvas_compiling'));
    try {
      canvasResult = await compileCanvas(initialSourceCode, { sourcePath });
    } catch (canvasCompileError) {
      throw buildCanvasCompileCliError(canvasCompileError, sourcePath);
    }
    success(t('publish.canvas_compile_done'));
  } else {
    if (shouldBuildPageSource(initialSourceCode, sourcePath, { modern: compat })) {
      step(0, t('build_page.step'));
      const buildResult = buildPageFile(sourcePath, { modern: compat, skipSizeWarning: true });
      if (!buildResult.ok) {
        buildResult.errors.forEach((issue) => warn(`${issue.code}: ${issue.message}`));
        const lintErrors = buildResult.lint && buildResult.lint.errors ? buildResult.lint.errors : [];
        lintErrors.forEach((issue) => warn(`${issue.rule}: ${issue.message}`));
        process.exit(1);
      }
      sourcePath = buildResult.outputPath;
      success(t('build_page.output', sourcePath));
    }
    warnDuplicateSourceMismatches(sourcePath);
    const currentSource = loadPublishSource(sourcePath);
    sourcePath = currentSource.absolutePath;

    // Step 0: 宜搭编码规范预检（可通过 --skip-lint 跳过）
    if (!skipLint) {
      step(0, t('publish.step_lint'));
      const lintPassed = runLintCheck(currentSource.source, sourcePath, { successMessage: false });
      if (!lintPassed) {
        process.exit(1);
      }
      success(t('publish.lint_passed'));
    } else {
      info(t('publish.lint_skipped'));
    }

    step(1, t('publish.step_compile'));
    const compiled = compileSource(sourcePath, { sourceCode: currentSource.source });
    sourceCode = compiled.sourceCode;
    compiledCode = compiled.compiledCode;
  }

  const parsedSource = path.parse(sourcePath);
  const compiledPath = path.join(findProjectRoot(), 'pages', 'dist', `${parsedSource.name}.js`);

  step(2, t('common.step_login', 2));
  const authRef = createAuthRef();
  let baseUrl = authRef.baseUrl;
  await ensurePublishTargetOrExit(appType, formUuid, authRef, { force });
  baseUrl = authRef.baseUrl;

  let schemaContent;
  let serverRevision;
  if (isCanvas) {
    try {
      serverRevision = (await fetchExistingSchemaContent(appType, formUuid, authRef)).serverRevision;
    } catch (schemaReadError) {
      fail(t('publish.data_source_fetch_failed', schemaReadError.message));
      process.exit(1);
    }
    // canvasResult 已在登录前本地编译完成，这里只需据其装配 Schema content。
    schemaContent = buildCanvasSchemaContent(sourceCode, canvasResult.runtimeCode, canvasResult.importedModules, formUuid);
  } else {
    let existingDataSource = null;
    try {
      const existing = await readExistingPageDataSource(appType, formUuid, authRef);
      existingDataSource = existing.dataSource;
      serverRevision = existing.serverRevision;
    } catch (dataSourceError) {
      fail(t('publish.data_source_fetch_failed', dataSourceError.message));
      process.exit(1);
    }
    baseUrl = authRef.baseUrl;
    schemaContent = buildSchemaContent(sourceCode, compiledCode, formUuid, { existingDataSource });
  }
  success(t('publish.schema_built'));

  banner(t('publish.title'));
  label('Base URL:', baseUrl);
  label('App Type:', appType);
  label('Form UUID:', formUuid);
  label('Source:', sourcePath);
  label('Compiled:', compiledPath);
  step(3, t('publish.step_publish'));
  const response = await sendSaveRequestWithAuth(authRef, schemaContent, appType, formUuid, serverRevision);

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('publish.publish_failed', errorMsg));
    if (response && !response.__needLogin && !response.__csrfExpired) {
      hint(t('common.response_detail', JSON.stringify(response, null, 2)));
    }
    process.exit(1);
  }

  const content = response.content || {};
  const savedFormUuid = content.formUuid || formUuid;
  const version = content.version || 0;
  success(t('publish.schema_published'));
  label('Form UUID:', savedFormUuid);
  label('Version:', String(version));

  baseUrl = authRef.baseUrl || baseUrl;

  const pageUrl = `${baseUrl}/${appType}/workbench/${savedFormUuid}`;
  let healthCheckResult = null;
  let navOrderResult = null;
  let navOrderWarning = null;
  if (healthCheck) {
    step(4, t('publish.step_health_check'));
    try {
      healthCheckResult = await runPublishReadbackHealthCheck(
        appType,
        savedFormUuid,
        authRef,
        schemaContent,
        isCanvas ? 'canvas' : 'native'
      );
    } catch (healthCheckError) {
      healthCheckResult = {
        ok: false,
        mode: 'publish_readback',
        authMode: 'token',
        targetReadable: false,
        schemaParsed: false,
        displayComponentPresent: false,
        publishedContentMatched: false,
        reason: 'schema_readback_failed',
        error: healthCheckError && healthCheckError.message ? healthCheckError.message : t('common.unknown_error'),
      };
    }
    if (healthCheckResult.ok) {
      success(t('publish.health_check_ok', healthCheckResult.mode));
    } else {
      warn(t('publish.health_check_failed', healthCheckResult.reason || '-', healthCheckResult.error || t('common.unknown_error')));
    }
  }

  if (autoNavOrder) {
    step(healthCheck ? 5 : 4, t('publish.step_nav_order'));
    try {
      const { autoOrderNavigation } = require('./nav-group');
      navOrderResult = await autoOrderNavigation(appType, authRef);
      const orderedNames = (navOrderResult.orderedNodes || [])
        .slice(0, 6)
        .map((node) => node.name || node.formUuid || node.navUuid)
        .filter(Boolean)
        .join(' > ');
      success(t('publish.nav_order_ok', orderedNames || '-'));
    } catch (navOrderError) {
      navOrderWarning = navOrderError && navOrderError.message ? navOrderError.message : t('common.unknown_error');
      warn(t('publish.nav_order_failed', navOrderWarning));
    }
  }

  result(true, t('publish.success'), [
    ['Form UUID', savedFormUuid],
    ['Version', String(version)],
    ['URL', pageUrl],
  ]);
  console.log(JSON.stringify(withBrowserHandoff(
    { success: true, appType, formUuid: savedFormUuid, version, url: pageUrl, healthCheck: healthCheckResult, navOrder: navOrderResult, navOrderWarning },
    pageUrl,
    { stage: 'publish_page_success', title: savedFormUuid },
    browserOpenMode
  )));
}

// ── 导出主函数供 CLI 调用 ──────────────────────────

// 如果直接运行此文件（node lib/app/publish.js），则执行 main()
if (require.main === module) {
  main().catch((err) => {
    error(t('publish.exception', err.message));
  });
} else {
  // 如果作为模块被 require，导出 main 函数
  module.exports = main;
  module.exports.parseArgs = parseArgs;
  module.exports.normalizePublishArgs = normalizePublishArgs;
  module.exports.buildMissingSourceHints = buildMissingSourceHints;
  module.exports.findDuplicateSourceMismatches = findDuplicateSourceMismatches;
  module.exports.loadPublishSource = loadPublishSource;
  module.exports.runPublishReadbackHealthCheck = runPublishReadbackHealthCheck;
  module.exports.normalizeFormType = normalizeFormType;
  module.exports.findPublishTarget = findPublishTarget;
  module.exports.isCustomPageTarget = isCustomPageTarget;
  module.exports.verifyPublishTarget = verifyPublishTarget;
  module.exports.buildDefaultPageDataSource = buildDefaultPageDataSource;
  module.exports.mergePageDataSource = mergePageDataSource;
  module.exports.extractSchemaContent = extractSchemaContent;
  module.exports.extractPageDataSource = extractPageDataSource;
  module.exports.countCustomPageDataSources = countCustomPageDataSources;
  module.exports.buildSchemaContent = buildSchemaContent;
  module.exports.buildCanvasSchemaContent = buildCanvasSchemaContent;
  module.exports.sendSaveRequestWithAuth = sendSaveRequestWithAuth;
}
