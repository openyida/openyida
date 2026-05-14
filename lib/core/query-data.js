/**
 * query-data.js - 宜搭统一数据管理命令
 *
 * 用法：
 *   openyida data <action> <resource> [参数]
 *
 * 支持的操作：
 *   query form / get form / create form / update form / query subform
 *   query process / get process / create process / update process
 *   query operation-records / execute task / query tasks
 */

'use strict';

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('./utils');

const { warn } = require('./chalk');

const USAGE = `openyida data - Unified Yida data CLI

Usage:
  openyida data query form <appType> <formUuid> [--page N] [--size N] [--search-json JSON|--search-file .cache/openyida/search.json] [--inst-id ID]
  openyida data get form <appType> --inst-id <formInstId>
  openyida data create form <appType> <formUuid> (--data-json <JSON>|--data-file .cache/openyida/data.json) [--dept-id ID]
  openyida data update form <appType> --inst-id <formInstId> (--data-json <JSON>|--data-file .cache/openyida/data.json) [--use-latest-version y]
  openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <fieldId> [--page N] [--size N]

  openyida data query process <appType> <formUuid> [--page N] [--size N] [--search-json JSON|--search-file .cache/openyida/search.json] [--task-id ID] [--instance-status STATUS] [--approved-result RESULT]
  openyida data get process <appType> --process-inst-id <processInstanceId>
  openyida data create process <appType> <formUuid> --process-code <processCode> (--data-json <JSON>|--data-file .cache/openyida/data.json) [--dept-id ID]
  openyida data update process <appType> --process-inst-id <processInstanceId> (--data-json <JSON>|--data-file .cache/openyida/data.json)
  openyida data query operation-records <appType> --process-inst-id <processInstanceId>
  openyida data execute task <appType> --task-id <taskId> --process-inst-id <processInstanceId> --out-result <AGREE|DISAGREE> --remark <text> [--data-json JSON|--data-file .cache/openyida/data.json] [--no-execute-expressions y]

  openyida data query tasks <appType> --type <todo|done|submitted|cc> [--page N] [--size N] [--keyword TEXT] [--process-codes JSON] [--instance-status STATUS]
`;

function fail(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(1);
}

function parseError(message) {
  console.error(`参数校验失败：${message}`);
  console.error(USAGE);
  process.exit(1);
}

function ensureSession() {
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies || cookieData.cookies.length === 0 || !cookieData.csrf_token) {
    cookieData = triggerLogin();
  }

  if (!cookieData || !cookieData.cookies || !cookieData.csrf_token) {
    fail('无法获取有效登录态或 CSRF Token');
  }

  return {
    cookieData,
    cookies: cookieData.cookies,
    csrfToken: cookieData.csrf_token,
    baseUrl: resolveBaseUrl(cookieData),
  };
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
    _csrf_token: session.csrfToken,
    _stamp: `${Date.now()}`,
    ...params,
  };
}

async function sendGet(session, appType, requestPath, params) {
  return requestWithAutoLogin(
    (auth) => httpGet(auth.baseUrl, requestPath, buildRequestParams(auth, params), auth.cookies),
    session,
  );
}

async function sendPost(session, appType, requestPath, params) {
  return requestWithAutoLogin(
    (auth) => httpPost(auth.baseUrl, requestPath, querystring.stringify(buildRequestParams(auth, params)), auth.cookies),
    session,
  );
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

function printResult(result) {
  const errorCode = result && result.errorCode;
  const hasErrorCode = errorCode !== undefined && errorCode !== null && errorCode !== '' && errorCode !== 0 && errorCode !== '0';

  if (result && result.success && !hasErrorCode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  warn(JSON.stringify(result || { success: false, errorMsg: '未知错误' }, null, 2));
  process.exit(1);
}

function printFormDatasResult(result) {
  printResult(normalizeFormDatasResult(result));
}

async function queryForm(positionals, options, session) {
  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  const [appType, formUuid] = positionals;
  clampPageSize(options);

  let result;
  if (options.inst_id) {
    result = await sendGet(session, appType, `/dingtalk/web/${appType}/v1/form/getFormDataById.json`, {
      formInstId: options.inst_id,
    });
  } else {
    const params = {
      formUuid,
      appType,
      currentPage: String(options.page),
      pageSize: String(options.size),
    };
    const searchJson = readJsonOption(options, 'search_json', 'search_file', '查询条件');
    if (searchJson) {
      params.searchFieldJson = searchJson;
    }
    for (const key of ['originator_id', 'create_from', 'create_to', 'modified_from', 'modified_to', 'dynamic_order']) {
      if (options[key]) {params[snakeToCamel(key)] = options[key];}
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
  printResult(await sendGet(session, appType, `/dingtalk/web/${appType}/v1/form/getFormDataById.json`, {
    formInstId: options.inst_id,
  }));
}

async function createForm(positionals, options, session) {
  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  const dataJson = requireJsonOption(options, 'data_json', 'data_file', '数据');
  const [appType, formUuid] = positionals;
  const params = {
    appType,
    formUuid,
    formDataJson: dataJson,
  };
  if (options.dept_id) {params.deptId = options.dept_id;}
  printResult(await sendPost(session, appType, `/dingtalk/web/${appType}/v1/form/saveFormData.json`, params));
}

async function updateForm(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  requireOption(options, 'inst_id');
  const dataJson = requireJsonOption(options, 'data_json', 'data_file', '数据');
  const [appType] = positionals;
  const params = {
    formInstId: options.inst_id,
    updateFormDataJson: dataJson,
  };
  if (options.use_latest_version) {params.useLatestVersion = options.use_latest_version;}
  printResult(await sendPost(session, appType, `/dingtalk/web/${appType}/v1/form/updateFormData.json`, params));
}

async function querySubform(positionals, options, session) {
  requirePositionals(positionals, 2, ['appType', 'formUuid']);
  requireOption(options, 'inst_id');
  requireOption(options, 'table_field_id');
  clampPageSize(options, 10);
  const [appType, formUuid] = positionals;
  const params = {
    formUuid,
    formInstanceId: options.inst_id,
    tableFieldId: options.table_field_id,
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
  const searchJson = readJsonOption(options, 'search_json', 'search_file', '查询条件');
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
  const params = {
    processCode: options.process_code,
    formUuid,
    formDataJson: dataJson,
  };
  if (options.dept_id) {params.deptId = options.dept_id;}
  printResult(await sendPost(session, appType, `/dingtalk/web/${appType}/v1/process/startInstance.json`, params));
}

async function updateProcess(positionals, options, session) {
  requirePositionals(positionals, 1, ['appType']);
  requireOption(options, 'process_inst_id');
  const dataJson = requireJsonOption(options, 'data_json', 'data_file', '数据');
  const [appType] = positionals;
  printResult(await sendPost(session, appType, `/dingtalk/web/${appType}/v1/process/updateInstance.json`, {
    processInstanceId: options.process_inst_id,
    updateFormDataJson: dataJson,
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
  if (dataJson) {params.formDataJson = dataJson;}
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
  const session = ensureSession();

  if (action === 'query' && resource === 'form') {return queryForm(positionals, options, session);}
  if (action === 'get' && resource === 'form') {return getForm(positionals, options, session);}
  if (action === 'create' && resource === 'form') {return createForm(positionals, options, session);}
  if (action === 'update' && resource === 'form') {return updateForm(positionals, options, session);}
  if (action === 'query' && resource === 'subform') {return querySubform(positionals, options, session);}
  if (action === 'query' && resource === 'process') {return queryProcess(positionals, options, session);}
  if (action === 'get' && resource === 'process') {return getProcess(positionals, options, session);}
  if (action === 'create' && resource === 'process') {return createProcess(positionals, options, session);}
  if (action === 'update' && resource === 'process') {return updateProcess(positionals, options, session);}
  if (action === 'query' && resource === 'operation-records') {return queryOperationRecords(positionals, options, session);}
  if (action === 'execute' && resource === 'task') {return executeTask(positionals, options, session);}
  if (action === 'query' && resource === 'tasks') {return queryTasks(positionals, options, session);}

  fail(`暂未实现的命令：${action} ${resource}`);
}

module.exports = { run };
