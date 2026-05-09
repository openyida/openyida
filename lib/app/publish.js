#!/usr/bin/env node
/**
 * publish.js - 宜搭自定义页面发布工具（Node.js 版）
 *
 * 用法：
 *   openyida publish <appType> <formUuid> <源文件路径>
 *
 * 示例：
 *   openyida publish APP_XXX FORM-XXX pages/xxx.js
 *
 * 流程：
 * 1. 读取源文件，通过内置 babel-transform 编译 + UglifyJS 压缩
 * 2. 用代码动态构建 Schema，将 source/compiled 填入 actions.module
 * 3. 读取本地 .cache/cookies.json 获取登录态；若未登录或接口返回 302，则调用 login.py 重新登录
 * 4. 通过 HTTP POST 调用 saveFormSchema 接口发布 Schema
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const querystring = require('querystring');
const { findProjectRoot, isLoginExpired, isCsrfTokenExpired, loadCookieData, triggerLogin, refreshCsrfToken } = require('../core/utils');
const { t } = require('../core/i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage, hint } = require('../core/chalk');
const { compileSource } = require('./page-compiler');
const { runLintCheck } = require('./page-linter');
const { buildPageFile, isAuthoringPath } = require('./page-compat');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');

// ── 配置读取 ──────────────────────────────────────────
const CONFIG = fs.existsSync(path.resolve(findProjectRoot(), 'config.json')) ? JSON.parse(fs.readFileSync(path.resolve(findProjectRoot(), 'config.json'), 'utf-8')) : {};
const DEFAULT_BASE_URL = CONFIG.defaultBaseUrl || 'https://www.aliwork.com';
const SCHEMA_VERSION = 'V5';
const DOMAIN_CODE = 'tEXDRG';
const PREFIX = '_view';

// ── 参数解析 ─────────────────────────────────────────

function parseArgs() {
  const openOption = parseOpenOption(process.argv.slice(2));
  const args = openOption.args;
  const skipLint = args.includes('--skip-lint');
  const healthCheck = args.includes('--health-check') || args.includes('--check');
  const compat = args.includes('--compat') || args.includes('--modern');
  const filteredArgs = args.filter(arg => arg !== '--skip-lint' && arg !== '--health-check' && arg !== '--check' && arg !== '--compat' && arg !== '--modern');

  if (filteredArgs.length < 3) {
    usage(t('publish.usage'), t('publish.example'));
    process.exit(1);
  }
  return {
    appType: filteredArgs[0],
    formUuid: filteredArgs[1],
    sourceFile: filteredArgs[2],
    skipLint,
    healthCheck,
    compat,
    browserOpenMode: openOption.mode,
  };
}

// ── 从登录态解析 baseUrl ─────────────────────────────

function resolveBaseUrl(loginResult) {
  return (loginResult.base_url || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// ── ID 生成工具 ──────────────────────────────────────

/**
 * 创建一个独立的 nodeId 生成器，每次调用 buildSchemaContent 时应创建新实例，
 * 避免模块级全局计数器在多次调用时累加导致 ID 不可预期。
 */
function createNodeIdGenerator() {
  let counter = 1;
  return function nextNodeId() {
    return 'node_oc' + Date.now().toString(36) + (counter++).toString(36);
  };
}

function generateSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ── 2. 构建 Schema ──────────────────────────────────

function buildSchemaContent(sourceCode, compiledCode, formUuid) {
  info(t('publish.building_schema'));
  const nextNodeId = createNodeIdGenerator();

  // 构造函数代码（固定模板）
  const constructorCode = "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}";

  // 全局数据源 fit 函数（固定模板）
  const fitCompiled = "'use strict';\n\nvar __preParser__ = function fit(response) {\n  var content = response.content !== undefined ? response.content : response;\n  var error = {\n    message: response.errorMsg || response.errors && response.errors[0] && response.errors[0].msg || response.content || '远程数据源请求出错，success is false'\n  };\n  var success = true;\n  if (response.success !== undefined) {\n    success = response.success;\n  } else if (response.hasError !== undefined) {\n    success = !response.hasError;\n  }\n  return {\n    content: content,\n    success: success,\n    error: error\n  };\n};";
  const fitSource = "function fit(response) {\r\n  const content = (response.content !== undefined) ? response.content : response;\r\n  const error = {\r\n    message: response.errorMsg ||\r\n      (response.errors && response.errors[0] && response.errors[0].msg) ||\r\n      response.content || '远程数据源请求出错，success is false',\r\n  };\r\n  let success = true;\r\n  if (response.success !== undefined) {\r\n    success = response.success;\r\n  } else if (response.hasError !== undefined) {\r\n    success = !response.hasError;\r\n  }\r\n  return {\r\n    content,\r\n    success,\r\n    error,\r\n  };\r\n}";

  const schema = {
    schemaType: 'superform',
    schemaVersion: '5.0',
    pages: [
      {
        utils: [
          {
            name: 'legaoBuiltin',
            type: 'npm',
            content: {
              package: '@ali/vu-legao-builtin',
              version: '3.0.0',
              exportName: 'legaoBuiltin',
            },
          },
          {
            name: 'yidaPlugin',
            type: 'npm',
            content: {
              package: '@ali/vu-yida-plugin',
              version: '1.1.0',
              exportName: 'yidaPlugin',
            },
          },
        ],
        componentsMap: [
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootHeader' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'Jsx' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootContent' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootFooter' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'Page' },
        ],
        componentsTree: [
          {
            componentName: 'Page',
            id: nextNodeId(),
            props: {
              contentBgColor: 'white',
              pageStyle: { backgroundColor: '#f2f3f5' },
              contentMargin: '0',
              contentPadding: '0',
              showTitle: false,
              contentPaddingMobile: '0',
              templateVersion: '1.0.0',
              contentMarginMobile: '0',
              className: 'page_' + generateSuffix(),
              contentBgColorMobile: 'white',
            },
            condition: true,
            css: 'body{background-color:#f2f3f5}.vc-page-yida-page{--yida-form-content-padding:0;--yida-form-content-margin:0;--yida-layout-padding:0}.vc-deep-container-entry.vc-rootcontent{padding:0!important;margin-top:0!important;margin-right:0!important;margin-bottom:0!important;margin-left:0!important}',
            methods: {
              __initMethods__: {
                type: 'js',
                source: 'function (exports, module) { /*set actions code here*/ }',
                compiled: 'function (exports, module) { /*set actions code here*/ }',
              },
            },
            dataSource: {
              offline: [],
              globalConfig: {
                fit: {
                  compiled: fitCompiled,
                  source: fitSource,
                  type: 'js',
                  error: {},
                },
              },
              online: [
                {
                  id: 'VCB660714833IBHEOXK376TA7XJH2AXUWR8MMW',
                  name: 'urlParams',
                  description: '当前页面地址的参数：如 aliwork.com/APP_XXX/workbench?id=1&name=宜搭，可通过 this.state.urlParams.name 获取到宜搭',
                  formUuid: formUuid,
                  protocal: 'URI',
                  isReadonly: true,
                },
                {
                  id: '',
                  name: 'timestamp',
                  description: '',
                  formUuid: formUuid,
                  protocal: 'VALUE',
                  initialData: '',
                },
              ],
              list: [
                {
                  id: 'VCB660714833IBHEOXK376TA7XJH2AXUWR8MMW',
                  name: 'urlParams',
                  description: '当前页面地址的参数：如 aliwork.com/APP_XXX/workbench?id=1&name=宜搭，可通过 this.state.urlParams.name 获取到宜搭',
                  formUuid: formUuid,
                  protocal: 'URI',
                  isReadonly: true,
                },
                {
                  id: '',
                  name: 'timestamp',
                  description: '',
                  formUuid: formUuid,
                  protocal: 'VALUE',
                  initialData: '',
                },
              ],
              sync: true,
            },
            lifeCycles: {
              constructor: {
                type: 'js',
                compiled: constructorCode,
                source: constructorCode,
              },
              componentWillUnmount: {
                name: 'didUnmount',
                id: 'didUnmount',
                type: 'actionRef',
                params: {},
              },
              componentDidMount: {
                name: 'didMount',
                id: 'didMount',
                params: {},
                type: 'actionRef',
              },
            },
            hidden: false,
            title: '',
            isLocked: false,
            conditionGroup: '',
            children: [
              {
                componentName: 'RootHeader',
                id: nextNodeId(),
                props: {},
                condition: true,
                hidden: false,
                title: '',
                isLocked: false,
                conditionGroup: '',
              },
              {
                componentName: 'RootContent',
                id: nextNodeId(),
                props: {},
                condition: true,
                hidden: false,
                title: '',
                isLocked: false,
                conditionGroup: '',
                children: [
                  {
                    componentName: 'Jsx',
                    id: nextNodeId(),
                    props: {
                      render: {
                        type: 'js',
                        compiled: 'function main(){\n    \n    "use strict";\n\nvar __compiledFunc__ = function render() {\n  return this.renderJsx();\n};\n    return __compiledFunc__.apply(this, arguments);\n  }',
                        source: 'function render() {\n  return this.renderJsx();\n}',
                        error: {},
                      },
                      __style__: {},
                      fieldId: 'jsx_' + generateSuffix(),
                    },
                    condition: true,
                    hidden: false,
                    title: '',
                    isLocked: false,
                    conditionGroup: '',
                  },
                ],
              },
              {
                componentName: 'RootFooter',
                id: nextNodeId(),
                props: {},
                condition: true,
                hidden: false,
                title: '',
                isLocked: false,
                conditionGroup: '',
              },
            ],
          },
        ],
        id: formUuid,
        connectComponent: [],
      },
    ],
    // ★ 核心：source 和 compiled 由编译结果动态填入
    actions: {
      module: {
        compiled: compiledCode,
        source: sourceCode,
      },
      type: 'FUNCTION',
      list: [
        { id: 'getCustomState', title: 'getCustomState' },
        { id: 'setCustomState', title: 'setCustomState' },
        { id: 'forceUpdate', title: 'forceUpdate' },
        { id: 'didMount', title: 'didMount' },
        { id: 'didUnmount', title: 'didUnmount' },
        { id: 'renderJsx', title: 'renderJsx' },
      ],
    },
    config: {
      connectComponent: [],
    },
  };

  return JSON.stringify(schema);
}


// ── 4. 发送 saveFormSchema 请求 ──────────────────────

function sendSaveRequest(csrfToken, cookies, schemaContent, baseUrl, appType, formUuid) {
  return new Promise((resolve, reject) => {
    const saveSchemaPath = `/alibaba/web/${appType}/${PREFIX}/query/formdesign/saveFormSchema.json?_stamp=${Date.now()}`;

    const postData = querystring.stringify({
      _csrf_token: csrfToken,
      prefix: PREFIX,
      content: schemaContent,
      formUuid: formUuid,
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

// ── 5. 发送 updateFormConfig 请求 ────────────────────

function sendUpdateConfigRequest(csrfToken, cookies, baseUrl, appType, formUuid, version, value) {
  return new Promise((resolve, reject) => {
    const updateConfigPath = `/dingtalk/web/${appType}/query/formdesign/updateFormConfig.json`;

    const postData = querystring.stringify({
      _csrf_token: csrfToken,
      formUuid: formUuid,
      version: version,
      configType: 'MINI_RESOURCE',
      value: value,
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

async function main() {
  const { appType, formUuid, sourceFile, skipLint, healthCheck, compat, browserOpenMode } = parseArgs();

  let sourcePath = path.resolve(sourceFile);
  if (!fs.existsSync(sourcePath)) {
    error(t('publish.source_not_found', sourcePath));
  }

  if (compat || isAuthoringPath(sourcePath)) {
    step(0, t('build_page.step'));
    const buildResult = buildPageFile(sourcePath, { modern: compat });
    if (!buildResult.ok) {
      buildResult.errors.forEach((issue) => warn(`${issue.code}: ${issue.message}`));
      const lintErrors = buildResult.lint && buildResult.lint.errors ? buildResult.lint.errors : [];
      lintErrors.forEach((issue) => warn(`${issue.rule}: ${issue.message}`));
      process.exit(1);
    }
    sourcePath = buildResult.outputPath;
    success(t('build_page.output', sourcePath));
  }

  const parsedSource = path.parse(sourcePath);
  const compiledPath = path.join(findProjectRoot(), 'pages', 'dist', `${parsedSource.name}.js`);
  warnDuplicateSourceMismatches(sourcePath);

  // Step 0: 宜搭编码规范预检（可通过 --skip-lint 跳过）
  if (!skipLint) {
    step(0, t('publish.step_lint'));
    const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
    const lintPassed = runLintCheck(sourceCode, sourcePath, { successMessage: false });
    if (!lintPassed) {
      process.exit(1);
    }
    success(t('publish.lint_passed'));
  } else {
    info(t('publish.lint_skipped'));
  }

  step(1, t('publish.step_compile'));
  const { sourceCode, compiledCode } = compileSource(sourcePath);
  const schemaContent = buildSchemaContent(sourceCode, compiledCode, formUuid);
  success(t('publish.schema_built'));

  step(2, t('common.step_login', 2));
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.csrf_token) {
    warn(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }
  let { csrf_token: csrfToken, cookies } = cookieData;
  let baseUrl = resolveBaseUrl(cookieData);

  banner(t('publish.title'));
  label('Base URL:', baseUrl);
  label('App Type:', appType);
  label('Form UUID:', formUuid);
  label('Source:', sourcePath);
  label('Compiled:', compiledPath);
  step(3, t('publish.step_publish'));
  let response = await sendSaveRequest(csrfToken, cookies, schemaContent, baseUrl, appType, formUuid);

  if (response && response.__csrfExpired) {
    cookieData = refreshCsrfToken();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    info(t('publish.resend_save_csrf'));
    response = await sendSaveRequest(csrfToken, cookies, schemaContent, baseUrl, appType, formUuid);
  }

  if (response && response.__needLogin) {
    cookieData = triggerLogin();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    info(t('publish.resend_save'));
    response = await sendSaveRequest(csrfToken, cookies, schemaContent, baseUrl, appType, formUuid);
  }

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
  let configResponse = await sendUpdateConfigRequest(csrfToken, cookies, baseUrl, appType, savedFormUuid, version, 8);

  if (configResponse && configResponse.__csrfExpired) {
    cookieData = refreshCsrfToken();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    info(t('publish.resend_config_csrf'));
    configResponse = await sendUpdateConfigRequest(csrfToken, cookies, baseUrl, appType, savedFormUuid, version, 8);
  }

  if (configResponse && configResponse.__needLogin) {
    cookieData = triggerLogin();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    info(t('publish.resend_config'));
    configResponse = await sendUpdateConfigRequest(csrfToken, cookies, baseUrl, appType, savedFormUuid, version, 8);
  }

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
  module.exports.findDuplicateSourceMismatches = findDuplicateSourceMismatches;
  module.exports.sendHealthCheckRequest = sendHealthCheckRequest;
}
