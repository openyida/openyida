/**
 * integration-list.js - 集成自动化（逻辑流）的列表与开关命令
 *
 * 提供三个 CLI 子命令的实现，统一暴露给 bin/yida.js：
 *   - openyida integration list <appType> [--form-uuid <uuid>] [--status y|n] [--key <kw>] [--page <n>] [--size <n>] [--json]
 *   - openyida integration enable  <appType> <formUuid> <processCode>
 *   - openyida integration disable <appType> <formUuid> <processCode>
 *
 * 设计要点：
 * - 复用 lib/integration/integration-api.js 的 listLogicflows / switchLogicflow，
 *   不重复发起 HTTP；
 * - authRef 构造方式与 integration-create.js 中保持一致，避免重复胶水；
 * - list 默认走人类可读的紧凑表格（stderr）+ JSON 摘要（stdout 1 行）；
 *   传入 --json 时只输出扁平 JSON 数组到 stdout；
 * - enable/disable 成功 exit 0，失败 exit 1，并把失败原因写 stderr。
 *
 * 这些命令的存在让 AI 可以单行替代之前必须靠 `node -e` 调内部 API 才能完成
 * 的「列出某 app 下逻辑流 / 启停某条逻辑流」操作。
 */

'use strict';

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
} = require('../core/utils');
const { t } = require('../core/i18n');
const {
  listLogicflows,
  switchLogicflow,
} = require('./integration-api');

/**
 * 构造 authRef，与 integration-create.js 内的实现保持一致。
 * 缺少缓存时触发交互式登录。
 */
async function createAuthRef() {
  let cookieData = loadCookieData();
  if (!cookieData) {
    cookieData = await triggerLogin();
  }
  return {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
}

/**
 * 解析 list 命令的参数。
 * 用法：openyida integration list <appType> [选项]
 */
function parseListArgs(args) {
  const parsed = {
    appType: '',
    formUuid: '',
    status: '',
    key: '',
    pageIndex: 1,
    pageSize: 50,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--form-uuid' && args[i + 1]) {
      parsed.formUuid = args[++i];
    } else if (arg === '--status' && args[i + 1]) {
      parsed.status = args[++i];
    } else if (arg === '--key' && args[i + 1]) {
      parsed.key = args[++i];
    } else if (arg === '--page' && args[i + 1]) {
      const n = Number.parseInt(args[++i], 10);
      if (Number.isFinite(n) && n > 0) {parsed.pageIndex = n;}
    } else if (arg === '--size' && args[i + 1]) {
      const n = Number.parseInt(args[++i], 10);
      if (Number.isFinite(n) && n > 0) {parsed.pageSize = Math.min(n, 100);}
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (!arg.startsWith('--') && !parsed.appType) {
      parsed.appType = arg;
    }
  }
  return parsed;
}

/**
 * 把 listLogicflows 返回的「按表单分组」结构打平成单条 flow 数组：
 *   [{formUuid, formName, processCode, name, status, gmtModified, modifier}]
 * status: 'y' = 启用，'n' = 停用。
 */
function flattenFlowList(content) {
  const groups = (content && content.data) || [];
  const flows = [];
  for (const group of groups) {
    const formUuid = group.formUuid || '';
    const formName = group.formName || group.title || '';
    const flowList = Array.isArray(group.flowList) ? group.flowList : [];
    for (const flow of flowList) {
      flows.push({
        formUuid,
        formName,
        processCode: flow.processCode || '',
        name: flow.name || flow.title || '',
        status: flow.status || '',
        gmtModified: flow.gmtModified || flow.gmtCreate || '',
        modifier: flow.modifier || flow.creator || '',
      });
    }
  }
  return flows;
}

/**
 * 渲染人类可读的表格到 stderr（quiet 模式下 chalk 函数会自动 no-op）。
 */
function printFlowTable(flows) {
  const { c, sep } = require('../core/chalk');
  if (process.env.YIDA_QUIET === '1') {return;}
  if (flows.length === 0) {
    process.stderr.write(`  ${c.dim}（无匹配的逻辑流）${c.reset}\n`);
    return;
  }
  process.stderr.write(`\n  ${c.bold}${c.cyan}逻辑流列表${c.reset}\n`);
  process.stderr.write(`  ${sep(96)}\n`);
  process.stderr.write(
    `  ${c.bold}${'状态'.padEnd(6)}${'processCode'.padEnd(28)}${'name'.padEnd(28)}formUuid${c.reset}\n`
  );
  process.stderr.write(`  ${c.dim}${'─'.repeat(96)}${c.reset}\n`);
  for (const flow of flows) {
    const statusTag = flow.status === 'y'
      ? `${c.green}启用${c.reset}  `
      : `${c.dim}停用${c.reset}  `;
    process.stderr.write(
      `  ${statusTag}${flow.processCode.padEnd(28)}${(flow.name || '-').padEnd(28)}${flow.formUuid}\n`
    );
  }
  process.stderr.write(`  ${c.dim}${'─'.repeat(96)}${c.reset}\n\n`);
}

async function runList(args) {
  const parsed = parseListArgs(args);
  if (!parsed.appType) {
    const { error } = require('../core/chalk');
    error(t('cli.integration_list_usage'), { hint: t('cli.integration_list_example') });
    return;
  }
  if (parsed.status && parsed.status !== 'y' && parsed.status !== 'n') {
    const { error } = require('../core/chalk');
    error(`--status 仅支持 y / n，当前值：${parsed.status}`);
    return;
  }

  const authRef = await createAuthRef();
  const result = await listLogicflows(authRef, {
    appType: parsed.appType,
    formUuid: parsed.formUuid,
    status: parsed.status,
    key: parsed.key,
    pageIndex: parsed.pageIndex,
    pageSize: parsed.pageSize,
  });
  const flows = flattenFlowList(result);

  if (parsed.json) {
    // --json：纯扁平数组到 stdout，方便 `| jq`
    console.log(JSON.stringify(flows));
    return;
  }

  printFlowTable(flows);
  // 默认仍然给一行 JSON 摘要，方便脚本消费
  console.log(JSON.stringify({
    appType: parsed.appType,
    total: flows.length,
    totalCount: result.totalCount,
    hasMore: result.hasMore,
    flows,
  }));
}

function parseSwitchArgs(args) {
  return {
    appType: args[0] || '',
    formUuid: args[1] || '',
    processCode: args[2] || '',
  };
}

async function runSwitch(args, enable) {
  const { appType, formUuid, processCode } = parseSwitchArgs(args);
  if (!appType || !formUuid || !processCode) {
    const { error } = require('../core/chalk');
    const usageKey = enable ? 'cli.integration_enable_usage' : 'cli.integration_disable_usage';
    const exampleKey = enable ? 'cli.integration_enable_example' : 'cli.integration_disable_example';
    error(t(usageKey), { hint: t(exampleKey) });
    return;
  }

  const authRef = await createAuthRef();
  try {
    await switchLogicflow(authRef, { appType, formUuid, processCode, enable });
  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      action: enable ? 'enable' : 'disable',
      appType, formUuid, processCode,
      error: err.message,
    }));
    process.exit(1);
  }

  console.log(JSON.stringify({
    success: true,
    action: enable ? 'enable' : 'disable',
    appType, formUuid, processCode,
    status: enable ? 'y' : 'n',
  }));
}

async function runEnable(args) {
  return runSwitch(args, true);
}

async function runDisable(args) {
  return runSwitch(args, false);
}

module.exports = {
  parseListArgs,
  parseSwitchArgs,
  flattenFlowList,
  runList,
  runEnable,
  runDisable,
};
