/**
 * query-data.js - 宜搭统一数据管理命令
 *
 * 用法：
 *   openyida data <action> <resource> [参数]
 *
 * 支持的操作：
 *   query form / get form / create form / update form / delete form / query subform
 *   query process / get process / create process / update process
 *   query operation-records / execute task / query tasks
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('./cli-error');
const { t } = require('./i18n');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('./yida-client');

const { buildComponentAliasMaps } = require('../app/get-schema');
const { readFormMode } = require('../app/services/form-mode-service');

const USAGE = `openyida data - Unified Yida data CLI

Usage:
  openyida data query form <appType> <formUuid> [--page N] [--size N] [--all] [--max-pages N] [--search-json JSON|--search-file .cache/openyida/search.json] [--dynamic-order '{"fieldId":"+"}'] [--resolve-aliases] [--inst-id ID] [--no-hydrate-subforms]
  openyida data get form <appType> --inst-id <formInstId> [--form-uuid <formUuid>] [--no-hydrate-subforms]
  openyida data create form <appType> <formUuid> (--data-json <JSON>|--data-file .cache/openyida/data.json) [--dept-id ID] [--resolve-aliases]
    说明：若目标表单为流程表单，会自动使用 /v1/process/startInstance.json 发起流程。
  openyida data update form <appType> --inst-id <formInstId> (--data-json <JSON>|--data-file .cache/openyida/data.json) [--form-uuid <formUuid>] [--use-latest-version y] [--resolve-aliases]
  openyida data delete form <appType> <formUuid> --inst-id <formInstId> --confirm [--json]
  openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <fieldId|alias> [--page N] [--size N] [--resolve-aliases]

  openyida data query process <appType> <formUuid> [--page N] [--size N] [--search-json JSON|--search-file .cache/openyida/search.json] [--resolve-aliases] [--task-id ID] [--instance-status STATUS] [--approved-result RESULT]
  openyida data get process <appType> --process-inst-id <processInstanceId>
  openyida data create process <appType> <formUuid> --process-code <processCode> (--data-json <JSON>|--data-file .cache/openyida/data.json) [--dept-id ID] [--resolve-aliases]
  openyida data update process <appType> --process-inst-id <processInstanceId> (--data-json <JSON>|--data-file .cache/openyida/data.json) [--form-uuid <formUuid>] [--resolve-aliases]
  openyida data query operation-records <appType> --process-inst-id <processInstanceId>
  openyida data execute task <appType> --task-id <taskId> --process-inst-id <processInstanceId> --out-result <AGREE|DISAGREE> --remark <text> [--data-json JSON|--data-file .cache/openyida/data.json] [--form-uuid <formUuid>] [--resolve-aliases] [--no-execute-expressions y]

  openyida data query tasks <appType> --type <todo|done|submitted|cc> [--page N] [--size N] [--keyword TEXT] [--process-codes JSON] [--instance-status STATUS]

Add --resolve-aliases when JSON keys use Yida component aliases instead of field IDs.
Use --dynamic-order '{"fieldId":"+"}' for ascending order or '{"fieldId":"-"}' for descending order.
When --dynamic-order is omitted, the API does not guarantee a stable result order.
Process instance deletion is not supported. Do not guess a data delete process command or bypass the CLI with scripts/API calls.
`;

const SUPPORTED_DATA_COMMANDS = new Set([
  'query:form',
  'get:form',
  'create:form',
  'update:form',
  'delete:form',
  'query:subform',
  'query:process',
  'get:process',
  'create:process',
  'update:process',
  'query:operation-records',
  'execute:task',
  'query:tasks',
]);

function fail(message) {
  throw new CliError(message, {
    code: 'DATA_ERROR',
    usage: USAGE,
  });
}

function parseError(message) {
  throw new CliError(`参数校验失败：${message}`, {
    code: 'DATA_INVALID_ARGUMENTS',
    usage: USAGE,
  });
}

function dataError(code, message, details) {
  throw new CliError(message, {
    code,
    details,
    usage: USAGE,
  });
}

function buildDeleteTarget(appType, formUuid, formInstId) {
  return {
    type: 'formInstance',
    appType,
    formUuid,
    formInstId,
  };
}

function buildDeleteReadbackStep(target) {
  return `openyida data get form ${target.appType} --inst-id ${target.formInstId} --form-uuid ${target.formUuid} --json`;
}

function validateDataCommandBeforeAuth(action, resource, positionals, options) {
  if (action === 'delete' && resource === 'process') {
    dataError(
      'DATA_PROCESS_DELETE_UNSUPPORTED',
      t('query_data.delete_process_unsupported'),
      {
        retryable: false,
        retrySafe: false,
        sideEffectState: 'none',
        nextStep: 'stop_and_report_unsupported',
      }
    );
  }

  if (!SUPPORTED_DATA_COMMANDS.has(`${action}:${resource}`)) {
    dataError(
      'DATA_COMMAND_UNSUPPORTED',
      t('query_data.command_unsupported', action, resource),
      {
        retryable: false,
        retrySafe: false,
        sideEffectState: 'none',
        nextStep: 'openyida commands --json',
      }
    );
  }

  if (action !== 'delete' || resource !== 'form') {
    return;
  }

  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  requireOption(options, 'inst_id');
  const [appType, formUuid] = positionals;
  const target = buildDeleteTarget(appType, formUuid, options.inst_id);
  if (!options.confirm) {
    dataError(
      'DATA_DELETE_CONFIRMATION_REQUIRED',
      t('query_data.delete_confirmation_required'),
      {
        target,
        retryable: false,
        retrySafe: true,
        sideEffectState: 'none',
        nextStep: 'query_target_then_ask_user_confirmation',
      }
    );
  }
}

function ensureSession() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    fail('无法获取有效 token 登录态');
  }
  return authRef;
}

function parseCliOptions(tokens) {
  const positionals = [];
  const options = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-/g, '_');
      const next = tokens[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(token);
    }
  }

  return { positionals, options };
}

function clampPageSize(options, defaultSize = 20) {
  let size = Number.parseInt(options.size || `${defaultSize}`, 10);
  let page = Number.parseInt(options.page || '1', 10);

  if (!Number.isFinite(size) || size <= 0) {size = defaultSize;}
  if (size > 100) {
    console.warn(`⚠️  警告：pageSize 最大值为 100，已自动将 ${size} 截断为 100。宜搭 API 不支持超过 100 的 pageSize，超过会导致 HTTP 500 错误。`);
    size = 100;
  }
  if (!Number.isFinite(page) || page <= 0) {page = 1;}

  options.size = size;
  options.page = page;
}

function parsePositiveInt(value, defaultValue, label) {
  const parsed = Number.parseInt(value || `${defaultValue}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (label) {
      parseError(`${label} 必须是正整数`);
    }
    return defaultValue;
  }
  return parsed;
}

function requirePositionals(positionals, count, names) {
  if (positionals.length < count) {
    parseError(`缺少必填参数 ${names.join(' ')}`);
  }
}

function requireOption(options, key, flagName) {
  if (!options[key]) {
    parseError(`缺少必填参数 ${flagName || `--${key.replace(/_/g, '-')}`}`);
  }
}

function readJsonFileOption(filePath, label) {
  const resolvedPath = path.resolve(filePath);
  let content;
  try {
    content = fs.readFileSync(resolvedPath, 'utf-8');
  } catch (err) {
    parseError(`${label} 文件读取失败：${resolvedPath} (${err.message})`);
  }

  try {
    return JSON.stringify(JSON.parse(content));
  } catch (err) {
    parseError(`${label} 文件必须是合法 JSON：${resolvedPath} (${err.message})`);
  }
}

function readJsonOption(options, jsonKey, fileKey, label) {
  const jsonValue = options[jsonKey];
  const fileValue = options[fileKey];

  if (jsonValue && fileValue) {
    parseError(`${label} 不能同时使用 --${jsonKey.replace(/_/g, '-')} 和 --${fileKey.replace(/_/g, '-')}`);
  }

  if (fileValue) {
    return readJsonFileOption(fileValue, label);
  }

  if (!jsonValue) {
    return '';
  }

  try {
    JSON.parse(jsonValue);
  } catch {
    parseError(`--${jsonKey.replace(/_/g, '-')} 参数必须是合法的 JSON 字符串`);
  }

  return jsonValue;
}

function requireJsonOption(options, jsonKey, fileKey, label) {
  const value = readJsonOption(options, jsonKey, fileKey, label);
  if (!value) {
    parseError(`缺少必填参数 --${jsonKey.replace(/_/g, '-')} 或 --${fileKey.replace(/_/g, '-')}`);
  }
  return value;
}

function snakeToCamel(value) {
  const parts = value.split('_');
  return parts[0] + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function buildRequestParams(session, params) {
  return {
    _api: 'nattyFetch',
    _mock: 'false',
    _stamp: `${Date.now()}`,
    ...params,
  };
}

async function sendGet(session, appType, requestPath, params) {
  return createYidaClient({ authRef: session }).get(
    requestPath,
    auth => buildRequestParams(auth, params)
  );
}

async function sendPost(session, appType, requestPath, params) {
  return createYidaClient({ authRef: session }).postForm(
    requestPath,
    auth => buildRequestParams(auth, params)
  );
}

async function sendPostOnce(session, appType, requestPath, params) {
  return createYidaClient({ authRef: session }).postFormOnce(
    requestPath,
    auth => buildRequestParams(auth, params)
  );
}

function shouldResolveAliases(options) {
  return !!(options.resolve_aliases || options.resolve_alias || options.component_aliases);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function buildFieldInfoById(schemaResult) {
  const fieldInfoById = {};
  const pages = schemaResult && schemaResult.content && schemaResult.content.pages;
  if (!Array.isArray(pages)) {
    return fieldInfoById;
  }

  function traverse(node) {
    if (!node || typeof node !== 'object') {return;}
    const props = node.props || {};
    if (props.fieldId) {
      fieldInfoById[props.fieldId] = {
        fieldId: props.fieldId,
        componentName: node.componentName || '',
      };
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  pages.forEach((page) => {
    const trees = page && Array.isArray(page.componentsTree) ? page.componentsTree : [];
    trees.forEach(traverse);
  });
  return fieldInfoById;
}

async function fetchFormAliasContext(session, appType, formUuid) {
  const result = await createYidaClient({ authRef: session }).get(
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid, schemaVersion: 'V5' }
  );
  if (!result || result.success === false || result.__needLogin) {
    fail(`组件别名解析失败：${result ? result.errorMsg || '无法获取表单 Schema' : '无法获取表单 Schema'}`);
  }
  return {
    ...buildComponentAliasMaps(result),
    fieldInfoById: buildFieldInfoById(result),
  };
}

async function resolveAliasContextIfNeeded(session, appType, formUuid, options, jsonValue) {
  if (!shouldResolveAliases(options) || !jsonValue) {
    return null;
  }
  if (!formUuid) {
    parseError('--resolve-aliases 需要提供 formUuid；对 update/get/execute 类命令请额外传 --form-uuid <formUuid>');
  }
  return fetchFormAliasContext(session, appType, formUuid);
}

function resolveFieldRef(value, aliasContext) {
  if (!aliasContext || typeof value !== 'string') {
    return value;
  }
  return aliasContext.fieldIdByAlias[value] || value;
}

function translateSubformRows(value, aliasContext) {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.map((row) => {
    if (!isPlainObject(row)) {
      return row;
    }
    return translateFormDataObject(row, aliasContext);
  });
}

function translateFormDataObject(data, aliasContext) {
  if (!isPlainObject(data)) {
    return data;
  }
  const translated = {};
  Object.entries(data).forEach(([key, value]) => {
    const fieldId = resolveFieldRef(key, aliasContext);
    const fieldInfo = aliasContext && aliasContext.fieldInfoById[fieldId];
    translated[fieldId] = fieldInfo && fieldInfo.componentName === 'TableField'
      ? translateSubformRows(value, aliasContext)
      : value;
  });
  return translated;
}

function translateSearchValue(value, aliasContext) {
  if (Array.isArray(value)) {
    return value.map(item => translateSearchValue(item, aliasContext));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const translated = {};
  const fieldRefKeys = ['key', 'field', 'fieldId', 'fieldName', 'componentId', 'tableFieldId'];
  const hasFieldRefKey = Object.keys(value).some(key => fieldRefKeys.indexOf(key) !== -1);
  Object.entries(value).forEach(([key, childValue]) => {
    const shouldTranslateValue = fieldRefKeys.indexOf(key) !== -1;
    const translatedKey = hasFieldRefKey ? key : resolveFieldRef(key, aliasContext);
    translated[translatedKey] = shouldTranslateValue
      ? resolveFieldRef(childValue, aliasContext)
      : translateSearchValue(childValue, aliasContext);
  });
  return translated;
}

function translateJsonWithAliases(jsonValue, aliasContext, translator) {
  if (!aliasContext || !jsonValue) {
    return jsonValue;
  }
  try {
    return JSON.stringify(translator(JSON.parse(jsonValue), aliasContext));
  } catch (err) {
    parseError(`--resolve-aliases 只能处理合法 JSON：${err.message}`);
  }
  return jsonValue;
}

/**
 * 归一化 searchFormDatas / searchFormDataIds 的返回结构。
 * 宜搭 API 在不同场景下会返回两种结构：
 *   - 直接结构：{ success, data: [...], totalCount, currentPage }
 *   - 嵌套结构：{ success, content: { data: [...], totalCount, currentPage } }
 * 统一将嵌套结构展开为直接结构，方便调用方使用。
 */
function normalizeFormDatasResult(result) {
  if (!result || !result.success) {return result;}

  const hasTopLevelData = Array.isArray(result.data);
  const hasNestedContent = result.content && (Array.isArray(result.content.data) || Array.isArray(result.content.dataList));

  if (!hasTopLevelData && hasNestedContent) {
    const content = result.content;
    return {
      ...result,
      data: content.data || content.dataList || [],
      totalCount: content.totalCount !== undefined ? content.totalCount : result.totalCount,
      currentPage: content.currentPage !== undefined ? content.currentPage : result.currentPage,
      content: undefined,
    };
  }

  return result;
}

function getResultDataList(result) {
  if (!result) {return [];}
  if (Array.isArray(result.data)) {return result.data;}
  if (result.content && Array.isArray(result.content.data)) {return result.content.data;}
  if (result.content && Array.isArray(result.content.dataList)) {return result.content.dataList;}
  return [];
}

function getResultTotalCount(result) {
  if (!result) {return 0;}
  if (result.totalCount !== undefined) {return Number(result.totalCount) || 0;}
  if (result.content && result.content.totalCount !== undefined) {return Number(result.content.totalCount) || 0;}
  return 0;
}

function getFormDataContainer(result) {
  if (!result || !result.success) {return null;}
  const candidates = [
    result.content,
    result.data,
    result.content && result.content.data,
    result.content && result.content.formData,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {continue;}
    if (candidate.formData && typeof candidate.formData === 'object') {
      return candidate.formData;
    }
  }

  return null;
}

function normalizeSubformResult(result) {
  const normalized = normalizeFormDatasResult(result);
  return {
    ...normalized,
    data: getResultDataList(normalized),
    totalCount: getResultTotalCount(normalized),
  };
}

async function fetchAllPages(fetchPage, options, defaultSize = 100) {
  const pageSize = Math.min(parsePositiveInt(options.size, defaultSize), 100);
  const maxPages = parsePositiveInt(options.max_pages, 1000);
  const firstPage = parsePositiveInt(options.page, 1);
  const allData = [];
  let page = firstPage;
  let lastResult = null;
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    const result = normalizeFormDatasResult(await fetchPage(page, pageSize));
    lastResult = result;
    const data = getResultDataList(result);
    allData.push(...data);
    pagesFetched++;

    const totalCount = getResultTotalCount(result);
    if (totalCount && allData.length >= totalCount) {break;}
    if (!data.length || data.length < pageSize) {break;}
    page++;
  }

  return {
    ...(lastResult || { success: true }),
    data: allData,
    totalCount: getResultTotalCount(lastResult) || allData.length,
    currentPage: firstPage,
    pageSize,
    pagesFetched,
  };
}

async function fetchAllSubformRows(session, appType, formUuid, formInstId, tableFieldId, options = {}) {
  const result = await fetchAllPages((page, size) => sendGet(session, appType, `/dingtalk/web/${appType}/v1/form/listTableDataByFormInstIdAndTableId.json`, {
    formUuid,
    formInstanceId: formInstId,
    tableFieldId,
    currentPage: String(page),
    pageSize: String(size),
  }), {
    page: 1,
    size: options.size || 100,
    max_pages: options.max_pages || 1000,
  }, 100);
  return normalizeSubformResult(result);
}

async function hydrateTruncatedSubforms(result, context) {
  if (!context || !context.formUuid || !context.formInstId || context.disabled) {
    return result;
  }

  const formData = getFormDataContainer(result);
  if (!formData) {return result;}

  const hydrated = [];
  const entries = Object.entries(formData);
  for (const [fieldId, value] of entries) {
    if (!/^tableField_/.test(fieldId)) {continue;}
    if (!Array.isArray(value) || value.length < 50) {continue;}
    if (value.length > 0 && !value.every(item => item && typeof item === 'object')) {continue;}

    const subformResult = await fetchAllSubformRows(
      context.session,
      context.appType,
      context.formUuid,
      context.formInstId,
      fieldId,
      context.options || {}
    );
    const rows = subformResult.data || [];
    if (rows.length > value.length) {
      formData[fieldId] = rows;
      hydrated.push({
        fieldId,
        originalCount: value.length,
        hydratedCount: rows.length,
      });
    }
  }

  if (hydrated.length > 0) {
    const target = result.content && typeof result.content === 'object' ? result.content : result;
    target._openyidaHydratedSubforms = hydrated;
  }

  return result;
}

function hasDataErrorCode(result) {
  const errorCode = result && result.errorCode;
  return errorCode !== undefined && errorCode !== null && errorCode !== '' && errorCode !== 0 && errorCode !== '0';
}

function isSuccessfulDataResponse(result) {
  return !!(result && result.success === true && !hasDataErrorCode(result));
}

function printResult(result) {
  if (isSuccessfulDataResponse(result)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const payload = result || { success: false, errorMsg: '未知错误' };
  throw new CliError(payload.errorMsg || '数据请求失败', {
    code: 'DATA_API_ERROR',
    details: payload,
  });
}

function printFormDatasResult(result) {
  printResult(normalizeFormDatasResult(result));
}

function normalizeResourceId(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim();
}

function normalizeCreateResult(result, resourceType, idKey) {
  if (!result || result.success !== true) {
    return result;
  }

  const rootId = normalizeResourceId(result[idKey]);
  const contentId = normalizeResourceId(
    result.content && typeof result.content === 'object'
      ? result.content[idKey]
      : result.content
  );
  const idsConflict = rootId && contentId && rootId !== contentId;
  const id = idsConflict ? null : (rootId || contentId);

  if (!id) {
    return {
      ...result,
      resource: null,
      idVerified: false,
    };
  }

  return {
    ...result,
    [idKey]: id,
    resource: { type: resourceType, id },
    idVerified: true,
  };
}

function printCreateResult(result, resourceType, idKey) {
  printResult(normalizeCreateResult(result, resourceType, idKey));
}

async function queryForm(positionals, options, session) {
  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  const [appType, formUuid] = positionals;
  clampPageSize(options, options.all ? 100 : 20);
  const rawSearchJson = readJsonOption(options, 'search_json', 'search_file', '查询条件');
  const aliasContext = await resolveAliasContextIfNeeded(session, appType, formUuid, options, rawSearchJson || options.dynamic_order);
  const searchJson = translateJsonWithAliases(rawSearchJson, aliasContext, translateSearchValue);

  let result;
  if (options.inst_id) {
    result = await sendGet(session, appType, `/dingtalk/web/${appType}/v1/form/getFormDataById.json`, {
      formInstId: options.inst_id,
    });
    result = await hydrateTruncatedSubforms(result, {
      session,
      appType,
      formUuid,
      formInstId: options.inst_id,
      disabled: !!options.no_hydrate_subforms,
      options,
    });
  } else if (options.all) {
    result = await fetchAllPages((page, size) => {
      const params = {
        formUuid,
        appType,
        currentPage: String(page),
        pageSize: String(size),
      };
      if (searchJson) {
        params.searchFieldJson = searchJson;
      }
      for (const key of ['originator_id', 'create_from', 'create_to', 'modified_from', 'modified_to', 'dynamic_order']) {
        if (options[key]) {
          params[snakeToCamel(key)] = key === 'dynamic_order' && aliasContext
            ? translateJsonWithAliases(options[key], aliasContext, translateSearchValue)
            : options[key];
        }
      }
      const requestPath = options.ids_only
        ? `/dingtalk/web/${appType}/v1/form/searchFormDataIds.json`
        : `/dingtalk/web/${appType}/v1/form/searchFormDatas.json`;
      return sendGet(session, appType, requestPath, params);
    }, options, 100);
  } else {
    const params = {
      formUuid,
      appType,
      currentPage: String(options.page),
      pageSize: String(options.size),
    };
    if (searchJson) {
      params.searchFieldJson = searchJson;
    }
    for (const key of ['originator_id', 'create_from', 'create_to', 'modified_from', 'modified_to', 'dynamic_order']) {
      if (options[key]) {
        params[snakeToCamel(key)] = key === 'dynamic_order' && aliasContext
          ? translateJsonWithAliases(options[key], aliasContext, translateSearchValue)
          : options[key];
      }
    }
    const requestPath = options.ids_only
      ? `/dingtalk/web/${appType}/v1/form/searchFormDataIds.json`
      : `/dingtalk/web/${appType}/v1/form/searchFormDatas.json`;
    result = await sendGet(session, appType, requestPath, params);
  }

  printFormDatasResult(result);
}

async function getForm(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  requireOption(options, 'inst_id');
  const [appType] = positionals;
  const result = await sendGet(session, appType, `/dingtalk/web/${appType}/v1/form/getFormDataById.json`, {
    formInstId: options.inst_id,
  });
  printResult(await hydrateTruncatedSubforms(result, {
    session,
    appType,
    formUuid: options.form_uuid,
    formInstId: options.inst_id,
    disabled: !!options.no_hydrate_subforms,
    options,
  }));
}

async function requireVerifiedFormMode(session, appType, formUuid) {
  let mode;
  try {
    mode = await readFormMode(session, { appType, formUuid });
  } catch (error) {
    dataError(
      'DATA_FORM_MODE_UNVERIFIED',
      t('query_data.form_mode_unverified', formUuid),
      { causeCode: error && error.code || 'FORM_MODE_READ_FAILED' }
    );
  }

  const isReceipt = mode && mode.mode === 'receipt' &&
    !Object.prototype.hasOwnProperty.call(mode, 'processCode');
  const isProcess = mode && mode.mode === 'process' &&
    typeof mode.processCode === 'string' && mode.processCode.trim() !== '';

  if (!isReceipt && !isProcess) {
    dataError(
      'DATA_FORM_MODE_UNVERIFIED',
      t('query_data.form_mode_unverified', formUuid),
      { causeCode: 'FORM_MODE_RESULT_INVALID' }
    );
  }

  return isProcess
    ? { mode: 'process', processCode: mode.processCode.trim() }
    : { mode: 'receipt' };
}

async function createForm(positionals, options, session) {
  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  const dataJson = requireJsonOption(options, 'data_json', 'data_file', '数据');
  const [appType, formUuid] = positionals;
  const aliasContext = await resolveAliasContextIfNeeded(session, appType, formUuid, options, dataJson);
  const params = {
    appType,
    formUuid,
    formDataJson: translateJsonWithAliases(dataJson, aliasContext, translateFormDataObject),
  };
  if (options.dept_id) {params.deptId = options.dept_id;}

  const formMode = await requireVerifiedFormMode(session, appType, formUuid);
  if (formMode.mode === 'process') {
    printCreateResult(await sendPostOnce(session, appType, `/dingtalk/web/${appType}/v1/process/startInstance.json`, {
      ...params,
      processCode: formMode.processCode,
    }), 'processInstance', 'processInstanceId');
    return;
  }

  printCreateResult(
    await sendPostOnce(session, appType, `/dingtalk/web/${appType}/v1/form/saveFormData.json`, params),
    'formInstance',
    'formInstId'
  );
}

async function updateForm(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  requireOption(options, 'inst_id');
  const dataJson = requireJsonOption(options, 'data_json', 'data_file', '数据');
  const [appType] = positionals;
  const aliasContext = await resolveAliasContextIfNeeded(session, appType, options.form_uuid, options, dataJson);
  const params = {
    formInstId: options.inst_id,
    updateFormDataJson: translateJsonWithAliases(dataJson, aliasContext, translateFormDataObject),
  };
  if (options.use_latest_version) {params.useLatestVersion = options.use_latest_version;}
  printResult(await sendPost(session, appType, `/dingtalk/web/${appType}/v1/form/updateFormData.json`, params));
}

function getFormRecordFromResult(result) {
  if (!isSuccessfulDataResponse(result)) {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'content')) {
    return result.content;
  }
  return result;
}

function buildDeleteSummary(record) {
  return {
    title: typeof record.title === 'string' ? record.title.slice(0, 120) : '',
    gmtModified: record.gmtModified || null,
  };
}

function throwDeleteResultUnknown(target, options = {}) {
  dataError(
    'DATA_DELETE_RESULT_UNKNOWN',
    t('query_data.delete_result_unknown', target.formInstId),
    {
      target,
      deleted: false,
      mutationAccepted: options.mutationAccepted,
      readbackVerified: false,
      status: 'RESULT_UNKNOWN',
      retryable: false,
      retrySafe: false,
      sideEffectState: 'unknown',
      readbackAllowed: true,
      nextStep: buildDeleteReadbackStep(target),
      causeCode: options.causeCode || 'DELETE_RESULT_UNKNOWN',
    }
  );
}

async function deleteForm(positionals, options, session) {
  const [appType, formUuid] = positionals;
  const formInstId = options.inst_id;
  const target = buildDeleteTarget(appType, formUuid, formInstId);
  const requestPath = `/dingtalk/web/${appType}/v1/form/getFormDataById.json`;
  const readTarget = () => sendGet(session, appType, requestPath, { formInstId });

  const preflight = await readTarget();
  if (!isSuccessfulDataResponse(preflight)) {
    dataError(
      'DATA_DELETE_PREFLIGHT_FAILED',
      t('query_data.delete_preflight_failed', formInstId),
      {
        target,
        retryable: false,
        retrySafe: true,
        sideEffectState: 'none',
        nextStep: buildDeleteReadbackStep(target),
        causeCode: preflight && preflight.errorCode || 'READ_FAILED',
      }
    );
  }

  const record = getFormRecordFromResult(preflight);
  if (record === null) {
    printResult({
      success: true,
      deleted: true,
      alreadyAbsent: true,
      mutationPerformed: false,
      readbackVerified: true,
      retryable: false,
      sideEffectState: 'none',
      status: 'ALREADY_ABSENT',
      target,
      appType,
      formUuid,
      formInstId,
    });
    return;
  }

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    dataError(
      'DATA_DELETE_TARGET_UNVERIFIED',
      t('query_data.delete_target_unverified', formInstId),
      {
        target,
        retryable: false,
        retrySafe: true,
        sideEffectState: 'none',
        nextStep: buildDeleteReadbackStep(target),
      }
    );
  }

  const observedInstId = normalizeResourceId(record.formInstId);
  const observedFormUuid = normalizeResourceId(record.formUuid || record.modelUuid);
  if (observedInstId !== formInstId || observedFormUuid !== formUuid) {
    dataError(
      'DATA_DELETE_TARGET_MISMATCH',
      t('query_data.delete_target_mismatch', formInstId, formUuid),
      {
        target,
        observed: {
          formInstId: observedInstId,
          formUuid: observedFormUuid,
        },
        retryable: false,
        retrySafe: true,
        sideEffectState: 'none',
        nextStep: 'stop_and_confirm_target_identity',
      }
    );
  }

  let deletion;
  try {
    deletion = await sendPostOnce(
      session,
      appType,
      `/dingtalk/web/${appType}/query/formdata/deleteFormData.json`,
      { formInstId }
    );
  } catch (error) {
    throwDeleteResultUnknown(target, {
      causeCode: error && error.code || 'DELETE_TRANSPORT_FAILED',
    });
  }

  if (!isSuccessfulDataResponse(deletion)) {
    throwDeleteResultUnknown(target, {
      mutationAccepted: false,
      causeCode: deletion && deletion.errorCode || 'DELETE_REJECTED_OR_UNKNOWN',
    });
  }

  let readback;
  try {
    readback = await readTarget();
  } catch (error) {
    throwDeleteResultUnknown(target, {
      mutationAccepted: true,
      causeCode: error && error.code || 'DELETE_READBACK_FAILED',
    });
  }
  if (!isSuccessfulDataResponse(readback)) {
    throwDeleteResultUnknown(target, {
      mutationAccepted: true,
      causeCode: readback && readback.errorCode || 'DELETE_READBACK_FAILED',
    });
  }

  if (getFormRecordFromResult(readback) !== null) {
    dataError(
      'DATA_DELETE_READBACK_MISMATCH',
      t('query_data.delete_readback_mismatch', formInstId),
      {
        target,
        deleted: false,
        mutationAccepted: true,
        readbackVerified: false,
        status: 'SEMANTIC_FAILURE',
        retryable: false,
        retrySafe: false,
        sideEffectState: 'unknown',
        readbackAllowed: true,
        nextStep: buildDeleteReadbackStep(target),
      }
    );
  }

  printResult({
    success: true,
    deleted: true,
    alreadyAbsent: false,
    mutationPerformed: true,
    mutationAccepted: true,
    readbackVerified: true,
    retryable: false,
    sideEffectState: 'committed',
    status: 'DELETED',
    target,
    summary: buildDeleteSummary(record),
    appType,
    formUuid,
    formInstId,
  });
}

async function querySubform(positionals, options, session) {
  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  requireOption(options, 'inst_id');
  requireOption(options, 'table_field_id');
  clampPageSize(options, 10);
  const [appType, formUuid] = positionals;
  const aliasContext = await resolveAliasContextIfNeeded(session, appType, formUuid, options, options.table_field_id);
  const params = {
    formUuid,
    formInstanceId: options.inst_id,
    tableFieldId: resolveFieldRef(options.table_field_id, aliasContext),
    currentPage: String(options.page),
    pageSize: String(options.size),
  };
  printResult(await sendGet(session, appType, `/dingtalk/web/${appType}/v1/form/listTableDataByFormInstIdAndTableId.json`, params));
}

async function queryProcess(positionals, options, session) {
  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  clampPageSize(options, 10);
  const [appType, formUuid] = positionals;
  const params = {
    formUuid,
    currentPage: String(options.page),
    pageSize: String(options.size),
  };
  const rawSearchJson = readJsonOption(options, 'search_json', 'search_file', '查询条件');
  const aliasContext = await resolveAliasContextIfNeeded(session, appType, formUuid, options, rawSearchJson);
  const searchJson = translateJsonWithAliases(rawSearchJson, aliasContext, translateSearchValue);
  if (searchJson) {
    params.searchFieldJson = searchJson;
  }
  for (const key of ['task_id', 'instance_status', 'approved_result', 'originator_id', 'create_from', 'create_to', 'modified_from', 'modified_to']) {
    if (options[key]) {params[snakeToCamel(key)] = options[key];}
  }
  const requestPath = options.ids_only
    ? `/dingtalk/web/${appType}/v1/process/getInstanceIds.json`
    : `/dingtalk/web/${appType}/v1/process/getInstances.json`;
  printResult(await sendGet(session, appType, requestPath, params));
}

async function getProcess(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  requireOption(options, 'process_inst_id');
  const [appType] = positionals;
  printResult(await sendGet(session, appType, `/dingtalk/web/${appType}/v1/process/getInstanceById.json`, {
    processInstanceId: options.process_inst_id,
  }));
}

async function createProcess(positionals, options, session) {
  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  requireOption(options, 'process_code');
  const dataJson = requireJsonOption(options, 'data_json', 'data_file', '数据');
  const [appType, formUuid] = positionals;
  const aliasContext = await resolveAliasContextIfNeeded(session, appType, formUuid, options, dataJson);
  const params = {
    processCode: options.process_code,
    formUuid,
    formDataJson: translateJsonWithAliases(dataJson, aliasContext, translateFormDataObject),
  };
  if (options.dept_id) {params.deptId = options.dept_id;}
  printResult(await sendPost(session, appType, `/dingtalk/web/${appType}/v1/process/startInstance.json`, params));
}

async function updateProcess(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  requireOption(options, 'process_inst_id');
  const dataJson = requireJsonOption(options, 'data_json', 'data_file', '数据');
  const [appType] = positionals;
  const aliasContext = await resolveAliasContextIfNeeded(session, appType, options.form_uuid, options, dataJson);
  printResult(await sendPost(session, appType, `/dingtalk/web/${appType}/v1/process/updateInstance.json`, {
    processInstanceId: options.process_inst_id,
    updateFormDataJson: translateJsonWithAliases(dataJson, aliasContext, translateFormDataObject),
  }));
}

async function queryOperationRecords(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  requireOption(options, 'process_inst_id');
  const [appType] = positionals;
  printResult(await sendGet(session, appType, `/dingtalk/web/${appType}/v1/process/getOperationRecords.json`, {
    processInstanceId: options.process_inst_id,
  }));
}

async function executeTask(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  for (const key of ['task_id', 'process_inst_id', 'out_result', 'remark']) {
    requireOption(options, key);
  }
  const [appType] = positionals;
  const params = {
    taskId: options.task_id,
    procInstId: options.process_inst_id,
    outResult: options.out_result,
    remark: options.remark,
  };
  const dataJson = readJsonOption(options, 'data_json', 'data_file', '数据');
  const aliasContext = await resolveAliasContextIfNeeded(session, appType, options.form_uuid, options, dataJson);
  if (dataJson) {params.formDataJson = translateJsonWithAliases(dataJson, aliasContext, translateFormDataObject);}
  if (options.no_execute_expressions) {params.noExecuteExpressions = options.no_execute_expressions;}
  printResult(await sendPost(session, appType, `/dingtalk/web/${appType}/v1/task/executeTask.json`, params));
}

async function queryTasks(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  requireOption(options, 'type');
  clampPageSize(options, 10);
  const [appType] = positionals;
  const typeMap = {
    todo: 'task/getTodoTasksInApp',
    done: 'task/getDoneTasksInApp',
    submitted: 'process/getMySubmitInApp',
    cc: 'task/getNotifyMeTasksInApp',
  };
  const endpoint = typeMap[options.type];
  if (!endpoint) {
    parseError('--type 仅支持 todo|done|submitted|cc');
  }

  const params = {
    currentPage: String(options.page),
    pageSize: String(options.size),
  };
  if (options.keyword) {params.keyword = options.keyword;}
  if (options.process_codes) {params.processCodes = options.process_codes;}
  if (options.instance_status) {params.instanceStatus = options.instance_status;}
  printResult(await sendGet(session, appType, `/dingtalk/web/${appType}/v1/${endpoint}.json`, params));
}

async function run(args) {
  if (args.length < 2) {
    parseError('缺少必填参数 action 或 resource');
  }

  const action = args[0];
  const resource = args[1];
  const { positionals, options } = parseCliOptions(args.slice(2));

  if (
    action === 'query' &&
    /^APP_[A-Za-z0-9_-]+$/.test(resource) &&
    /^FORM(?:_|-)[A-Za-z0-9_-]+$/.test(positionals[0] || '')
  ) {
    const suggestion = `openyida data query form ${resource} ${positionals[0]}`;
    dataError(
      'DATA_RESOURCE_REQUIRED',
      t('query_data.resource_required', suggestion),
      { suggestion }
    );
  }

  validateDataCommandBeforeAuth(action, resource, positionals, options);

  const session = ensureSession();

  if (action === 'query' && resource === 'form') {return queryForm(positionals, options, session);}
  if (action === 'get' && resource === 'form') {return getForm(positionals, options, session);}
  if (action === 'create' && resource === 'form') {return createForm(positionals, options, session);}
  if (action === 'update' && resource === 'form') {return updateForm(positionals, options, session);}
  if (action === 'delete' && resource === 'form') {return deleteForm(positionals, options, session);}
  if (action === 'query' && resource === 'subform') {return querySubform(positionals, options, session);}
  if (action === 'query' && resource === 'process') {return queryProcess(positionals, options, session);}
  if (action === 'get' && resource === 'process') {return getProcess(positionals, options, session);}
  if (action === 'create' && resource === 'process') {return createProcess(positionals, options, session);}
  if (action === 'update' && resource === 'process') {return updateProcess(positionals, options, session);}
  if (action === 'query' && resource === 'operation-records') {return queryOperationRecords(positionals, options, session);}
  if (action === 'execute' && resource === 'task') {return executeTask(positionals, options, session);}
  if (action === 'query' && resource === 'tasks') {return queryTasks(positionals, options, session);}

  dataError('DATA_COMMAND_UNSUPPORTED', t('query_data.command_unsupported', action, resource));
}

module.exports = { run };
