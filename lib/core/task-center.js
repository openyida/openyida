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
  created    - 我创建的（我发起的流程）
  done       - 我已处理（我已经处理过的）
  cc         - 抄送我的
  proxy      - 我代提交的（代理提交的流程）

可选参数：
  --page N       页码，默认 1
  --size N       每页条数，默认 20，最大 100
  --keyword TEXT 搜索关键词
  --no-detail    不返回详情（仅 created 类型支持）
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
    fail('无法获取有效登录态或 CSRF Token');
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
  if (result && (result.__needLogin || result.__csrfExpired)) {
    const payload = {
      success: false,
      errorMsg: result.__needLogin ? '登录态已失效，请重新登录' : 'CSRF Token 已过期，请重新登录',
    };
    throw new CliError(payload.errorMsg, {
      code: result.__needLogin ? 'NEED_LOGIN' : 'CSRF_EXPIRED',
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
  // 不同接口可能使用不同的分页参数名，保留常用字段以保证兼容性
  const queryParam = {
    pageIndex: String(options.page),
    pageSize: String(options.size),
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

  return createYidaClient({ authRef: session }).get(requestPath, auth => ({
    _api: 'nattyFetch',
    _mock: 'false',
    query: JSON.stringify(queryParam),
    _csrf_token: auth.csrfToken,
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

  const session = await ensureSession();

  await queryTasks(type, options, session);
}

module.exports = { run };
