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
const https = require('https');
const http = require('http');
const querystring = require('querystring');
const {
  findProjectRoot,
  isLoginExpired,
  isCsrfTokenExpired,
  httpPost,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef, isTokenAuthRef } = require('../core/yida-client');
const { requireSchemaServerRevision } = require('../schema/server-revision');
const { t } = require('../core/i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage, hint } = require('../core/chalk');
const { compileSource } = require('./page-compiler');
const { compileCanvas } = require('./canvas-compile');
const { runLintCheck } = require('./page-linter');
const { buildPageFile, shouldBuildPageSource } = require('./page-compat');
const { warnLargePageSource } = require('./page-size-guard');
const { fetchFormPageList } = require('./form-navigation');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const {
  assertLegacyDirectWriteAllowed,
  extractLegacyGuardArgs,
} = require('../core/legacy-schema-guard');
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

// ── 配置读取 ──────────────────────────────────────────
const CONFIG = fs.existsSync(path.resolve(findProjectRoot(), 'config.json')) ? JSON.parse(fs.readFileSync(path.resolve(findProjectRoot(), 'config.json'), 'utf-8')) : {};
const DEFAULT_BASE_URL = CONFIG.defaultBaseUrl || 'https://www.aliwork.com';
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
  const guardSplit = extractLegacyGuardArgs(openOption.args);
  const args = guardSplit.args;
  const skipLint = args.includes('--skip-lint');
  const healthCheck = args.includes('--health-check') || args.includes('--check');
  const compat = args.includes('--compat') || args.includes('--modern');
  const force = args.includes('--force');
  const canvas = args.includes('--canvas');
  const help = args.includes('--help') || args.includes('-h');
  const filteredArgs = args.filter(arg => arg !== '--skip-lint' && arg !== '--health-check' && arg !== '--check' && arg !== '--compat' && arg !== '--modern' && arg !== '--force' && arg !== '--canvas' && arg !== '--help' && arg !== '-h');

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
    browserOpenMode: openOption.mode,
    legacyGuardOptions: guardSplit.guardOptions,
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

// ── 2. 读取并构建 Schema ────────────────────────────

async function fetchExistingSchemaContent(appType, formUuid, authRef) {
  const result = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/${PREFIX}/query/formdesign/getFormSchema.json`,
      { formUuid, schemaVersion: SCHEMA_VERSION },
      auth.cookies
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
  return buildCanvasPageSchemaContent(sourceCode, runtimeCode, importedModules, formUuid);
}


// ── 4. 发送 saveFormSchema 请求 ──────────────────────

function sendSaveRequestOnce(csrfToken, cookies, schemaContent, baseUrl, appType, formUuid, serverRevision) {
  if (
    typeof csrfToken !== 'string' ||
    csrfToken.length === 0 ||
    !Array.isArray(cookies) ||
    typeof baseUrl !== 'string' ||
    baseUrl.length === 0
  ) {
    const authError = new Error('Publish Schema write authentication is not ready.');
    authError.code = 'PUBLISH_SCHEMA_WRITE_PRECHECK_FAILED';
    return Promise.reject(authError);
  }
  const gmtModified = requireSchemaServerRevision({ gmtModified: serverRevision });
  return new Promise((resolve, reject) => {
    const saveSchemaPath = `/alibaba/web/${appType}/${PREFIX}/query/formdesign/saveFormSchema.json?_stamp=${Date.now()}`;

    const postData = querystring.stringify({
      _csrf_token: csrfToken,
      prefix: PREFIX,
      content: schemaContent,
      formUuid: formUuid,
      gmtModified,
      schemaVersion: SCHEMA_VERSION,
      domainCode: DOMAIN_CODE,
      importSchema: true,
    });

    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: saveSchemaPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Origin: baseUrl,
        Referer: `${baseUrl}/`,
        Cookie: cookieHeader,
      },
    };

    const request = requestModule.request(requestOptions, (response) => {
      let responseData = '';
      response.on('data', (chunk) => { responseData += chunk; });
      response.on('end', () => {
        info(t('common.http_status', response.statusCode));
        let parsed;
        try {
          parsed = JSON.parse(responseData);
        } catch (parseError) {
          warn(t('common.response_body', responseData.substring(0, 500)));
          resolve({ success: false, errorMsg: 'HTTP ' + response.statusCode + ': ' + t('common.response_not_json') });
          return;
        }
        // 检测登录过期（errorCode: "307"）
        if (isLoginExpired(parsed)) {
          warn(t('common.login_expired', parsed.errorMsg));
          resolve({ __needLogin: true });
          return;
        }
        // 检测 csrf_token 过期（errorCode: "TIANSHU_000030"）
        if (isCsrfTokenExpired(parsed)) {
          warn(t('common.csrf_expired', parsed.errorMsg));
          resolve({ __csrfExpired: true });
          return;
        }
        resolve(parsed);
      });
    });

    request.on('error', (requestError) => { reject(requestError); });

    request.write(postData);
    request.end();
  });
}

function sendSaveRequestWithAuth(authRef, schemaContent, appType, formUuid, serverRevision) {
  if (!authRef || typeof authRef.baseUrl !== 'string' || authRef.baseUrl.length === 0) {
    const authError = new Error('Publish Schema write authentication is not ready.');
    authError.code = 'PUBLISH_SCHEMA_WRITE_PRECHECK_FAILED';
    return Promise.reject(authError);
  }
  if (!isTokenAuthRef(authRef)) {
    return sendSaveRequestOnce(
      authRef.csrfToken,
      authRef.cookies,
      schemaContent,
      authRef.baseUrl,
      appType,
      formUuid,
      serverRevision
    );
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
  return httpPost(authRef.baseUrl, saveSchemaPath, postData, authRef.cookies, { silentStatus: true });
}

// ── 5. 发送 updateFormConfig 请求 ────────────────────

function sendUpdateConfigRequest(csrfToken, cookies, baseUrl, appType, formUuid, version, value) {
  const updateConfigPath = `/dingtalk/web/${appType}/query/formdesign/updateFormConfig.json`;
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formUuid: formUuid,
    version: version,
    configType: 'MINI_RESOURCE',
    value: value,
  });
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return httpPost(baseUrl, updateConfigPath, postData);
  }

  return new Promise((resolve, reject) => {
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: updateConfigPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Origin: baseUrl,
        Referer: `${baseUrl}/`,
        Cookie: cookieHeader,
      },
    };

    const request = requestModule.request(requestOptions, (response) => {
      let responseData = '';
      response.on('data', (chunk) => { responseData += chunk; });
      response.on('end', () => {
        info(t('common.http_status', response.statusCode));
        let parsed;
        try {
          parsed = JSON.parse(responseData);
        } catch (parseError) {
          warn(t('common.response_body', responseData.substring(0, 500)));
          resolve({ success: false, errorMsg: 'HTTP ' + response.statusCode + ': ' + t('common.response_not_json') });
          return;
        }
        // 检测登录过期（errorCode: "307"）
        if (isLoginExpired(parsed)) {
          warn(t('common.login_expired', parsed.errorMsg));
          resolve({ __needLogin: true });
          return;
        }
        // 检测 csrf_token 过期（errorCode: "TIANSHU_000030"）
        if (isCsrfTokenExpired(parsed)) {
          warn(t('common.csrf_expired', parsed.errorMsg));
          resolve({ __csrfExpired: true });
          return;
        }
        resolve(parsed);
      });
    });

    request.on('error', (requestError) => { reject(requestError); });

    request.write(postData);
    request.end();
  });
}

async function sendUpdateConfigRequestWithAuth(authRef, appType, formUuid, version, value) {
  return requestWithAutoLogin(async (currentAuthRef) => {
    const requestAuthRef = currentAuthRef || {};
    const response = await sendUpdateConfigRequest(
      requestAuthRef.csrfToken,
      requestAuthRef.cookies,
      requestAuthRef.baseUrl || DEFAULT_BASE_URL,
      appType,
      formUuid,
      version,
      value
    );

    if (response && response.__csrfExpired && isTokenAuthRef(requestAuthRef)) {
      return {
        ...response,
        __needLogin: true,
        errorCode: response.errorCode || 'TOKEN_AUTH_REQUIRED',
        errorMsg: response.errorMsg || 'token_auth_required: token auth was rejected while updating page config. Run openyida auth refresh or openyida login.',
      };
    }

    return response;
  }, authRef);
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

function sendHealthCheckRequest(pageUrl, cookies) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(pageUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: cookieHeader,
      },
      timeout: 30000,
    };

    const request = requestModule.request(requestOptions, (response) => {
      let responseData = '';
      response.on('data', (chunk) => {
        if (responseData.length < 2000) {
          responseData += chunk;
        }
      });
      response.on('end', () => {
        const statusCode = response.statusCode || 0;
        resolve({
          ok: statusCode >= 200 && statusCode < 400,
          statusCode,
          snippet: responseData.substring(0, 300).replace(/\s+/g, ' ').trim(),
        });
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ ok: false, statusCode: 0, error: t('common.request_timeout') });
    });

    request.on('error', (requestError) => {
      resolve({ ok: false, statusCode: 0, error: requestError.message });
    });

    request.end();
  });
}

// ── 主流程 ────────────────────────────────────────────

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    return options;
  }
  const { appType, formUuid, sourceFile, skipLint, healthCheck, compat, force, canvas: canvasFlag, browserOpenMode, legacyGuardOptions } = options;
  assertLegacyDirectWriteAllowed({
    command: 'publish',
    resourceType: 'page',
    action: 'update',
    appType,
    formUuid,
  }, { guardOptions: legacyGuardOptions });

  let sourcePath = path.resolve(sourceFile);
  if (!fs.existsSync(sourcePath)) {
    error(t('publish.source_not_found', sourcePath));
    buildMissingSourceHints(sourceFile).forEach((candidate) => {
      hint(t('publish.source_path_hint', candidate));
    });
    process.exit(1);
  }

  // 路由：默认 native；.canvas.jsx / .canvas.tsx 源文件自动走 Code Canvas 链路，
  // --canvas 作为显式覆盖（用于扩展名不规范但确为 canvas 源码的场景）。
  const isCanvas = canvasFlag || /\.canvas\.(jsx|tsx)$/i.test(sourcePath);

  const initialSourceCode = fs.readFileSync(sourcePath, 'utf-8');
  warnLargePageSource(initialSourceCode, sourcePath);

  let sourceCode = initialSourceCode;
  let compiledCode = '';
  let canvasResult = null;

  if (isCanvas) {
    // Code Canvas 链路：跳过 native 编译/lint，改用本地 Babel 编译
    // （JSX/TS → runtimeCode + importedModules），无需登录态，可在开浏览器前失败快。
    step(1, t('publish.step_canvas_compile'));
    info(t('publish.canvas_compiling'));
    try {
      canvasResult = await compileCanvas(initialSourceCode);
    } catch (canvasCompileError) {
      fail(t('publish.canvas_compile_failed', canvasCompileError.message));
      process.exit(1);
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

    // Step 0: 宜搭编码规范预检（可通过 --skip-lint 跳过）
    if (!skipLint) {
      step(0, t('publish.step_lint'));
      const lintSource = fs.readFileSync(sourcePath, 'utf-8');
      const lintPassed = runLintCheck(lintSource, sourcePath, { successMessage: false });
      if (!lintPassed) {
        process.exit(1);
      }
      success(t('publish.lint_passed'));
    } else {
      info(t('publish.lint_skipped'));
    }

    step(1, t('publish.step_compile'));
    const compiled = compileSource(sourcePath);
    sourceCode = compiled.sourceCode;
    compiledCode = compiled.compiledCode;
  }

  const parsedSource = path.parse(sourcePath);
  const compiledPath = path.join(findProjectRoot(), 'pages', 'dist', `${parsedSource.name}.js`);

  step(2, t('common.step_login', 2));
  const authRef = createAuthRef();
  let cookies = authRef.cookies;
  let baseUrl = authRef.baseUrl;
  await ensurePublishTargetOrExit(appType, formUuid, authRef, { force });
  cookies = authRef.cookies;
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
    cookies = authRef.cookies;
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

  step(4, t('publish.step_config'));
  info(t('publish.sending_config'));
  const configResponse = await sendUpdateConfigRequestWithAuth(authRef, appType, savedFormUuid, version, 8);
  cookies = authRef.cookies;
  baseUrl = authRef.baseUrl || baseUrl;

  const pageUrl = `${baseUrl}/${appType}/workbench/${savedFormUuid}`;
  let healthCheckResult = null;
  if (healthCheck) {
    step(5, t('publish.step_health_check'));
    healthCheckResult = await sendHealthCheckRequest(pageUrl, cookies);
    if (healthCheckResult.ok) {
      success(t('publish.health_check_ok', healthCheckResult.statusCode));
    } else {
      warn(t('publish.health_check_failed', healthCheckResult.statusCode || '-', healthCheckResult.error || healthCheckResult.snippet || t('common.unknown_error')));
    }
  }

  if (configResponse && configResponse.success) {
    result(true, t('publish.success'), [
      ['Form UUID', savedFormUuid],
      ['Version', String(version)],
      ['URL', pageUrl],
    ]);
    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, appType, formUuid: savedFormUuid, version, url: pageUrl, healthCheck: healthCheckResult },
      pageUrl,
      { stage: 'publish_page_success', title: savedFormUuid },
      browserOpenMode
    )));
  } else {
    const configErrorMsg = configResponse ? configResponse.errorMsg || t('common.unknown_error') : t('common.request_failed');
    result(false, t('publish.config_failed', configErrorMsg), [
      ['Form UUID', savedFormUuid],
      ['Version', String(version)],
      ['URL', pageUrl],
    ]);
    hint(t('publish.schema_ok_config_failed'));
    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, appType, formUuid: savedFormUuid, version, url: pageUrl, configWarning: configErrorMsg, healthCheck: healthCheckResult },
      pageUrl,
      { stage: 'publish_page_success', title: savedFormUuid },
      browserOpenMode
    )));
  }
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
  module.exports.sendHealthCheckRequest = sendHealthCheckRequest;
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
  module.exports.sendSaveRequestOnce = sendSaveRequestOnce;
  module.exports.sendUpdateConfigRequestWithAuth = sendUpdateConfigRequestWithAuth;
}
