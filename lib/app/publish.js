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
const { default: babelTransform } = require('../core/babel-transform');
const UglifyJS = require('uglify-js');
const { findProjectRoot, isLoginExpired, isCsrfTokenExpired, loadCookieData, triggerLogin, refreshCsrfToken } = require('../core/utils');
const { t } = require('../core/i18n');

// ── 配置读取 ──────────────────────────────────────────
const CONFIG = fs.existsSync(path.resolve(findProjectRoot(), 'config.json')) ? JSON.parse(fs.readFileSync(path.resolve(findProjectRoot(), 'config.json'), 'utf-8')) : {};
const DEFAULT_BASE_URL = CONFIG.defaultBaseUrl || 'https://www.aliwork.com';
const SCHEMA_VERSION = 'V5';
const DOMAIN_CODE = 'tEXDRG';
const PREFIX = '_view';

// ── 参数解析 ─────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const skipLint = args.includes('--skip-lint');
  const filteredArgs = args.filter(arg => arg !== '--skip-lint');

  if (filteredArgs.length < 3) {
    console.error(t('publish.usage'));
    console.error(t('publish.example'));
    process.exit(1);
  }
  return {
    appType: filteredArgs[0],
    formUuid: filteredArgs[1],
    sourceFile: filteredArgs[2],
    skipLint,
  };
}

// ── 宜搭编码规范预检 ─────────────────────────────────

/**
 * 检查宜搭源码是否符合编码规范
 * @param {string} sourceCode - 源码内容
 * @param {string} filePath - 文件路径（用于错误输出）
 * @returns {{ errors: Array, warnings: Array }} 检查结果
 */
function lintYidaSource(sourceCode, _filePath) {
  const errors = [];
  const warnings = [];
  const lines = sourceCode.split('\n');

  // 错误级别：事件绑定使用 function 而非箭头函数
  const eventFunctionRegex = /on[A-Z]\w+=\{function\b/;

  // 警告级别：使用 const 或 let 声明变量
  const constLetRegex = /\b(const|let)\s+/;

  // 用于排除注释和字符串内的简单检测
  function isInCommentOrString(line, matchIndex) {
    const beforeMatch = line.substring(0, matchIndex);
    // 检查是否在单行注释之后
    if (beforeMatch.includes('//')) {
      return true;
    }
    // 简单检测是否可能在字符串内（不完美但足够用于预检）
    const quotes = (beforeMatch.match(/['"]/g) || []).length;
    return quotes % 2 !== 0;
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 检查事件绑定是否使用 function
    const eventMatch = line.match(eventFunctionRegex);
    if (eventMatch && !isInCommentOrString(line, eventMatch.index)) {
      errors.push({
        line: lineNumber,
        type: 'error',
        message: t('publish.lint_event_function'),
      });
    }

    // 检查 const/let 声明（排除注释）
    const constLetMatch = line.match(constLetRegex);
    if (constLetMatch && !isInCommentOrString(line, constLetMatch.index)) {
      // 额外排除多行注释开头
      const trimmed = line.trim();
      if (!trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
        warnings.push({
          line: lineNumber,
          type: 'warning',
          message: t('publish.lint_const_let'),
        });
      }
    }
  });

  return { errors, warnings };
}

/**
 * 执行预检并输出结果
 * @param {string} sourceCode - 源码内容
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否通过预检（无错误级别问题）
 */
function runLintCheck(sourceCode, filePath) {
  const { errors, warnings } = lintYidaSource(sourceCode, filePath);
  const hasIssues = errors.length > 0 || warnings.length > 0;

  if (!hasIssues) {
    return true;
  }

  console.error(t('publish.lint_title'));

  // 先输出错误
  errors.forEach(({ line, message }) => {
    console.error(t('publish.lint_error_line', line, message));
  });

  // 再输出警告
  warnings.forEach(({ line, message }) => {
    console.error(t('publish.lint_warning_line', line, message));
  });

  console.error('');

  // 有错误级别问题时阻断发布
  if (errors.length > 0) {
    console.error(t('publish.lint_fix_errors'));
    console.error(t('publish.lint_skip_hint'));
    return false;
  }

  return true;
}

// ── 从登录态解析 baseUrl ─────────────────────────────

function resolveBaseUrl(loginResult) {
  return (loginResult.base_url || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// ── 1. 编译源码 ──────────────────────────────────────

function compileSource(sourcePath) {
  const sourceFileName = path.basename(sourcePath);
  const parsedPath = path.parse(sourcePath);
  const compiledFileName = `${parsedPath.name}.js`;
  const compiledPath = path.join(findProjectRoot(), 'pages', 'dist', compiledFileName);

  console.error(t('publish.reading_source', sourceFileName));
  const sourceCode = fs.readFileSync(sourcePath, 'utf-8');

  console.error(t('publish.compiling', sourceFileName));
  const babelResult = babelTransform(sourceCode, {}, false, { RE_VERSION: '7.4.0' });
  if (babelResult.error instanceof Error) {
    const err = babelResult.error;
    let errorMsg = t('publish.compile_failed', err.message);
    if (err.loc) {
      errorMsg += t('publish.compile_location', err.loc.line, err.loc.column);
    }
    if (err.code) {
      errorMsg += t('publish.compile_error_code', err.code);
    }
    console.error(errorMsg);
    process.exit(1);
  }

  console.error(t('publish.minifying', compiledFileName));
  const uglifyResult = UglifyJS.minify(babelResult.compiled);
  if (uglifyResult.error) {
    console.error(t('publish.minify_failed', uglifyResult.error.message || String(uglifyResult.error)));
    process.exit(1);
  }

  // 确保输出目录存在
  const outputDir = path.dirname(compiledPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(compiledPath, uglifyResult.code, 'utf-8');
  console.error(t('publish.compile_done', compiledPath));

  return { sourceCode, compiledCode: uglifyResult.code };
}

// ── ID 生成工具 ──────────────────────────────────────

let nodeIdCounter = 1;

function nextNodeId() {
  return 'node_oc' + Date.now().toString(36) + (nodeIdCounter++).toString(36);
}

function generateSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ── 2. 构建 Schema ──────────────────────────────────

function buildSchemaContent(sourceCode, compiledCode, formUuid) {
  console.error(t('publish.building_schema'));

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
        console.error(t('common.http_status', response.statusCode));
        let parsed;
        try {
          parsed = JSON.parse(responseData);
        } catch (parseError) {
          console.error(t('common.response_body', responseData.substring(0, 500)));
          resolve({ success: false, errorMsg: 'HTTP ' + response.statusCode + ': ' + t('common.response_not_json') });
          return;
        }
        // 检测登录过期（errorCode: "307"）
        if (isLoginExpired(parsed)) {
          console.error(t('common.login_expired', parsed.errorMsg));
          resolve({ __needLogin: true });
          return;
        }
        // 检测 csrf_token 过期（errorCode: "TIANSHU_000030"）
        if (isCsrfTokenExpired(parsed)) {
          console.error(t('common.csrf_expired', parsed.errorMsg));
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
        console.error(t('common.http_status', response.statusCode));
        let parsed;
        try {
          parsed = JSON.parse(responseData);
        } catch (parseError) {
          console.error(t('common.response_body', responseData.substring(0, 500)));
          resolve({ success: false, errorMsg: 'HTTP ' + response.statusCode + ': ' + t('common.response_not_json') });
          return;
        }
        // 检测登录过期（errorCode: "307"）
        if (isLoginExpired(parsed)) {
          console.error(t('common.login_expired', parsed.errorMsg));
          resolve({ __needLogin: true });
          return;
        }
        // 检测 csrf_token 过期（errorCode: "TIANSHU_000030"）
        if (isCsrfTokenExpired(parsed)) {
          console.error(t('common.csrf_expired', parsed.errorMsg));
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

// ── 主流程 ────────────────────────────────────────────

async function main() {
  const { appType, formUuid, sourceFile, skipLint } = parseArgs();

  const sourcePath = path.resolve(sourceFile);
  if (!fs.existsSync(sourcePath)) {
    console.error(t('publish.source_not_found', sourcePath));
    process.exit(1);
  }

  const parsedSource = path.parse(sourcePath);
  const compiledPath = path.join(findProjectRoot(), 'pages', 'dist', `${parsedSource.name}.js`);

  // Step 0: 宜搭编码规范预检（可通过 --skip-lint 跳过）
  if (!skipLint) {
    console.error(t('publish.step_lint'));
    const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
    const lintPassed = runLintCheck(sourceCode, sourcePath);
    if (!lintPassed) {
      process.exit(1);
    }
    console.error(t('publish.lint_passed'));
  } else {
    console.error(t('publish.lint_skipped'));
  }

  // Step 1: 编译源码 + 构建 Schema
  console.error(t('publish.step_compile'));
  const { sourceCode, compiledCode } = compileSource(sourcePath);
  const schemaContent = buildSchemaContent(sourceCode, compiledCode, formUuid);
  console.error(t('publish.schema_built'));

  // Step 2: 读取登录态（优先从本地缓存 Cookie 中提取 csrf_token）
  console.error(t('common.step_login', 2));
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.csrf_token) {
    console.error(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }
  let { csrf_token: csrfToken, cookies } = cookieData;
  let baseUrl = resolveBaseUrl(cookieData);

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('publish.title'));
  console.error(SEP);
  console.error(t('publish.base_url', baseUrl));
  console.error(t('publish.app_type', appType));
  console.error(t('publish.form_uuid', formUuid));
  console.error(t('publish.source_file', sourcePath));
  console.error(t('publish.compiled_file', compiledPath));
  // Step 3: 发布 Schema（307 时刷新 csrf_token，302 时自动重登录，均自动重试）
  console.error(t('publish.step_publish'));
  let response = await sendSaveRequest(csrfToken, cookies, schemaContent, baseUrl, appType, formUuid);

  if (response && response.__csrfExpired) {
    cookieData = refreshCsrfToken();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    console.error(t('publish.resend_save_csrf'));
    response = await sendSaveRequest(csrfToken, cookies, schemaContent, baseUrl, appType, formUuid);
  }

  if (response && response.__needLogin) {
    cookieData = triggerLogin();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    console.error(t('publish.resend_save'));
    response = await sendSaveRequest(csrfToken, cookies, schemaContent, baseUrl, appType, formUuid);
  }

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || t('common.unknown_error') : t('common.request_failed');
    console.error(t('publish.publish_failed', errorMsg));
    if (response && !response.__needLogin && !response.__csrfExpired) {
      console.error(t('common.response_detail', JSON.stringify(response, null, 2)));
    }
    process.exit(1);
  }

  const content = response.content || {};
  const savedFormUuid = content.formUuid || formUuid;
  const version = content.version || 0;
  console.error(t('publish.schema_published'));
  console.error(t('publish.form_uuid_label', savedFormUuid));
  console.error(t('publish.version_label', version));

  // Step 4: 更新表单配置（307 时刷新 csrf_token，302 时自动重登录，均自动重试）
  console.error(t('publish.step_config'));
  console.error(t('publish.sending_config'));
  let configResponse = await sendUpdateConfigRequest(csrfToken, cookies, baseUrl, appType, savedFormUuid, version, 8);

  if (configResponse && configResponse.__csrfExpired) {
    cookieData = refreshCsrfToken();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    console.error(t('publish.resend_config_csrf'));
    configResponse = await sendUpdateConfigRequest(csrfToken, cookies, baseUrl, appType, savedFormUuid, version, 8);
  }

  if (configResponse && configResponse.__needLogin) {
    cookieData = triggerLogin();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    console.error(t('publish.resend_config'));
    configResponse = await sendUpdateConfigRequest(csrfToken, cookies, baseUrl, appType, savedFormUuid, version, 8);
  }

  // 输出结果
  const SEP2 = '='.repeat(50);
  console.error('\n' + SEP2);
  if (configResponse && configResponse.success) {
    console.error(t('publish.success'));
    console.error(t('publish.form_uuid_label', savedFormUuid));
    console.error(t('publish.version_label', version));
    console.error(t('publish.config_updated'));
  } else {
    const errorMsg = configResponse ? configResponse.errorMsg || t('common.unknown_error') : t('common.request_failed');
    console.error(t('publish.config_failed', errorMsg));
    console.error(t('publish.schema_ok_config_failed'));
    if (configResponse && !configResponse.__needLogin && !configResponse.__csrfExpired) {
      console.error(t('common.response_detail', JSON.stringify(configResponse, null, 2)));
    }
  }
  console.error(SEP2);
}

main().catch((error) => {
  console.error(t('publish.exception', error.message));
  process.exit(1);
});
