/**
 * task-center.js - 宜搭全局任务中心命令
 *
 * 用法：
 *   openyida task-center <type> [参数]
 *
 * 支持的任务类型：
 *   todo       - 待办任务
 *   created    - 我创建的
 *   done       - 我已处理
 *   cc         - 抄送我的
 *   proxy      - 我代提交的
 */

'use strict';

const { CliError } = require('./cli-error');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('./yida-client');
const { t } = require('./i18n');

// ── 常量 ──────────────────────────────────────────────

const TASK_TYPE_MAP = {
  todo: 'getTodoTasksInCorp',
  created: 'getMyCreateInCorp',
  done: 'getDoneTasksInCorp',
  cc: 'getNotifyMeInCorp',
  proxy: 'getSubmitAgentInCorp',
};

const USAGE = `openyida task-center - 宜搭全局任务中心

Usage:
  openyida task-center todo [--page N] [--size N] [--keyword TEXT]
  openyida task-center created [--page N] [--size N] [--keyword TEXT] [--no-detail]
  openyida task-center done [--page N] [--size N] [--keyword TEXT]
  openyida task-center cc [--page N] [--size N] [--keyword TEXT]
  openyida task-center proxy [--page N] [--size N] [--keyword TEXT]

任务类型：
  todo       - 待办任务（需要我处理的）
  created    - 我创建的（普通表单和流程实例）
  done       - 我已处理（我已经处理过的）
  cc         - 抄送我的
  proxy      - 我代提交的（代理提交的流程）

可选参数：
  --page N       页码，默认 1
  --size N       每页条数，默认 20，最大 100
  --keyword TEXT 搜索关键词
  --no-detail    不返回详情（仅 created 类型支持）

  openyida task-center link [appType] --scope app|corp --type todo|created|done|cc [--base-url URL] [--mode dingtalk|auto|browser] --json
  openyida task-center count --scope corp --type todo|created|done|cc [--filters-json JSON] --json
  openyida task-center capabilities --json
  openyida task-center scaffold --spec <file.json> --output <file.canvas.jsx>
  openyida task-center options <appType> --type <originators|processes|forms> [--keyword TEXT] [--size N] --json
  openyida task-center inspect <appType> --process-inst-id <id> [--form-uuid <id>] [--history] [--task-id <id>] --json
  openyida task-center count <appType> [--scope app] --type <todo|created|done|cc> [--transport app-v1|app-query] [--filters-json <json>] --json
`;

// ── 工具函数 ──────────────────────────────────────────

function fail(message) {
  throw new CliError(message, {
    code: 'TASK_CENTER_ERROR',
    usage: USAGE,
  });
}

async function ensureSession() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    fail('无法获取有效 token 登录态');
  }
  return authRef;
}

/**
 * 解析 CLI 参数数组，返回位置参数和命名选项。
 */
function parseCliOptions(args) {
  const positionals = [];
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-/g, '_');
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(token);
    }
  }

  return { positionals, options };
}

/**
 * 规范化 page/size 参数，确保在合法范围内。
 */
function clampPageSize(options, defaultSize = 20) {
  let size = parseInt(String(options.size), 10);
  let page = parseInt(String(options.page), 10);

  if (isNaN(size) || size <= 0) {
    size = defaultSize;
  }
  if (size > 100) {
    size = 100;
  }
  if (isNaN(page) || page <= 0) {
    page = 1;
  }

  options.size = size;
  options.page = page;
}

/**
 * 打印 API 响应结果。
 */
function printResult(result) {
  if (result && result.__needLogin) {
    const payload = {
      success: false,
      errorMsg: '登录态已失效，请重新登录',
    };
    throw new CliError(payload.errorMsg, {
      code: 'NEED_LOGIN',
      details: payload,
    });
  }

  const errorCode = result && result.errorCode;
  const hasErrorCode = errorCode !== undefined && errorCode !== null && errorCode !== '' && errorCode !== '0';

  if (result && result.success !== false && !hasErrorCode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const payload = result || { success: false, errorMsg: '未知错误' };
  throw new CliError(payload.errorMsg || '任务中心请求失败', {
    code: 'TASK_CENTER_API_ERROR',
    details: payload,
  });
}

// ── 请求发送 ──────────────────────────────────────────

/**
 * 发送全局任务中心请求。
 * 注意：全局任务中心接口使用不同的路径格式，不需要 appType。
 */
async function sendTaskCenterRequest(session, endpoint, options, taskType) {
  const queryParam = {
    page: options.page,
    limit: options.size,
  };

  // "我创建的"接口支持 ignoreDetail 参数
  if (taskType === 'created' && options.no_detail) {
    queryParam.ignoreDetail = 'y';
  }

  if (options.keyword) {
    queryParam.keyword = options.keyword;
  }

  // 使用全局任务中心接口路径
  const requestPath = `/query/task/${endpoint}.json`;

  return createYidaClient({ authRef: session }).get(requestPath, _auth => ({
    _api: 'nattyFetch',
    _mock: 'false',
    query: JSON.stringify(queryParam),
    _stamp: `${Date.now()}`,
  }));
}

// ── 主逻辑 ────────────────────────────────────────────

async function queryTasks(type, options, session) {
  const endpoint = TASK_TYPE_MAP[type];
  if (!endpoint) {
    fail(`不支持的任务类型: ${type}\n支持的类型: todo, created, done, cc, proxy`);
  }

  clampPageSize(options);
  const result = await sendTaskCenterRequest(session, endpoint, options, type);
  printResult(result);
}

async function run(args) {
  // 先解析所有参数，再取位置参数，避免 flag 放在第一位时解析错误
  const { positionals, options } = parseCliOptions(args);
  const type = positionals[0];
  if (!type) {
    fail('缺少必填参数 type');
  }

  if (type === 'capabilities' || type === 'scaffold') {
    const allowed = type === 'capabilities' ? ['json'] : ['spec', 'output', 'json'];
    const invalid = Object.keys(options).find(key => !allowed.includes(key));
    if (invalid || positionals.length !== 1) { fail(t('task_center.invalid_spec', invalid || 'arguments')); }
    const taskScaffold = require('../task-center/scaffold');
    if (type === 'scaffold' && (typeof options.spec !== 'string' || typeof options.output !== 'string')) {
      fail(t('task_center.invalid_spec', '--spec / --output'));
    }
    const result = type === 'capabilities' ? taskScaffold.capabilities() : taskScaffold.scaffold(options.spec, options.output);
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  if (type === 'link') {
    const allowed = ['scope', 'type', 'base_url', 'mode', 'json'];
    const invalid = Object.keys(options).find(key => !allowed.includes(key));
    if (invalid || positionals.length > 2 || options.json !== undefined && options.json !== true) {
      fail(t('task_center.invalid_spec', invalid || 'arguments'));
    }
    if (!['app', 'corp'].includes(options.scope)) { fail(t('task_center.invalid_spec', 'scope')); }
    const baseUrl = options.base_url === undefined ? (await ensureSession()).baseUrl : options.base_url;
    const target = require('../task-center/navigation').target({
      scope: options.scope, kind: options.type, baseUrl, mode: options.mode,
      ...(positionals[1] !== undefined ? { appType: positionals[1] } : {}),
    });
    const nativeTarget = require('../task-center/navigation').target({ scope: options.scope, kind: options.type, baseUrl, mode: 'dingtalk',
      ...(positionals[1] !== undefined ? { appType: positionals[1] } : {}) });
    const dingtalkUrl = require('../dingtalk/dingtalk-link').buildDingTalkPageLink({ url: nativeTarget.pageUrl });
    const result = { ...target, dingtalkUrl, opened: false };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  if (type === 'options') {
    const invalid = Object.keys(options).find(key => !['type', 'keyword', 'size', 'json'].includes(key));
    if (invalid || positionals.length !== 2) { fail(t('task_center.invalid_spec', invalid || 'arguments')); }
    const lookups = require('../task-center/lookups').createTaskCenterLookups();
    const request = lookups.request(options.type, { appType: positionals[1], keyword: options.keyword, pageSize: options.size });
    const authRef = await ensureSession();
    const client = createYidaClient({ authRef });
    const params = auth => ({ _api: 'nattyFetch', _mock: 'false', _csrf_token: auth.csrfToken, ...request.params });
    const payload = request.method === 'POST' ? await client.postForm(request.path, params) : await client.get(request.path, params);
    const result = lookups.normalize(options.type, payload, {
      appType: positionals[1], keyword: request.params.key, pageSize: request.params.pageSize,
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  if (type === 'inspect' || type === 'count') {
    const allowed = type === 'inspect' ? ['process_inst_id', 'form_uuid', 'task_id', 'history', 'json'] : ['type', 'transport', 'filters_json', 'scope', 'json'];
    const invalid = Object.keys(options).find(key => !allowed.includes(key));
    if (invalid || (positionals.length !== 2 && !(type === 'count' && options.scope === 'corp' && positionals.length === 1)) || options.json !== undefined && options.json !== true || options.history !== undefined && options.history !== true) {
      fail(t('task_center.invalid_spec', invalid || 'arguments'));
    }
    const tasks = require('../task-center/contract');
    const workflow = require('../task-center/workflow').createWorkflowContract(tasks);
    let input;
    if (type === 'inspect') {
      input = workflow.options({ appType: positionals[1], processInstanceId: options.process_inst_id,
        ...(options.form_uuid !== undefined ? { formUuid: options.form_uuid } : {}),
        ...(options.task_id !== undefined ? { taskId: options.task_id } : {}), history: options.history === true });
    } else {
      let filters = {};
      if (options.filters_json !== undefined) {
        try { filters = JSON.parse(options.filters_json); } catch { fail(t('task_center.invalid_spec', 'filters-json')); }
      }
      if (options.scope !== undefined && !['app', 'corp'].includes(options.scope)) { fail(t('task_center.invalid_spec', 'scope')); }
      if (options.scope === 'corp' && positionals[1] !== undefined) { fail(t('task_center.invalid_spec', 'appType')); }
      const transport = options.transport || (options.scope !== undefined ? 'app-query' : undefined);
      input = { ...tasks.normalizeFilters(options.type, filters, transport),
        ...(options.scope === 'corp' ? { scope: 'corp' } : { appType: tasks.appOf(positionals[1]) }),
        transport: tasks.transportOf(transport) };
      if (input.scope === 'corp' && input.transport !== 'app-query') { fail(t('task_center.invalid_spec', 'transport')); }
    }
    const client = createYidaClient({ authRef: await ensureSession() });
    const request = descriptor => client.get(descriptor.path, { _api: 'nattyFetch', _mock: 'false', ...descriptor.params });
    const result = type === 'inspect'
      ? await require('../task-center/workflow-loader').createWorkflowLoader(workflow, request)(input)
      : await require('../task-center/loader').createTaskCenterLoader(tasks, null, request).count(options.type, input);
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const session = await ensureSession();

  await queryTasks(type, options, session);
}

module.exports = { run };
