'use strict';

const fs = require('fs');
const { throwUsage } = require('../core/command-errors');

const {
  listAgentTasks,
  createAgentTask,
  updateAgentTask,
  cancelAgentTask,
  isLeaderShip,
  getLastDepartureAgent,
  getAgentRange,
} = require('./api');
const { searchUsers } = require('../corp-manager/api');

const USAGE = `openyida agent-center - 代理中心

Usage:
  openyida agent-center list [--status ALL|DIS|EFF|OUT|CANCEL] [--keyword TEXT] [--page N] [--size N]
  openyida agent-center search-user <keyword> [--dept <text>] [--size N]
  openyida agent-center create --source-user <userId> --target-user <userId> [--type normal|departure] [options]
  openyida agent-center update <agentUuid> --target-user <userId> [--type normal|departure] [options]
  openyida agent-center cancel <agentUuid> --type normal|departure
  openyida agent-center range <agentUuid>
  openyida agent-center is-leader
  openyida agent-center last-departure

Create/update options for normal agents:
  --start <time>                 开始时间，例如 "2026-05-20 09:00" 或毫秒时间戳
  --end <time>                   结束时间，例如 "2026-05-21 18:00" 或毫秒时间戳
  --category execute|start       execute=代处理流程，start=代提交流程，默认 execute
  --notify-source y|n            代理任务是否通知被代理人，默认 n
  --range all|part               代理范围，默认 all
  --range-form <appType:formUuid[,appType:formUuid]>
  --range-json <json>            代理范围 JSON 数组，元素含 appType/formUuid
  --range-file <file>            从 JSON 文件读取代理范围

Examples:
  openyida agent-center list --status EFF --size 20
  openyida agent-center search-user "余浩" --dept "宜搭,钉钉官方同学"
  openyida agent-center create --source-user 111 --target-user 222 --start "2026-05-20 09:00" --end "2026-05-21 18:00"
  openyida agent-center create --type departure --source-user 111 --target-user 222
  openyida agent-center cancel Agent_xxx --type departure
`;

function fail(message) {
  throwUsage(message, USAGE);
}

function parseCliOptions(tokens) {
  const positionals = [];
  const options = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-/g, '_');
      const next = tokens[i + 1];
      const value = next && !next.startsWith('--') ? next : true;
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        options[key] = Array.isArray(options[key]) ? options[key].concat(value) : [options[key], value];
      } else {
        options[key] = value;
      }
      if (value !== true) {
        i += 1;
      }
    } else {
      positionals.push(token);
    }
  }

  return { positionals, options };
}

function splitList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(splitList);
  }
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function toPositiveInt(value, defaultValue) {
  const parsed = Number.parseInt(value || `${defaultValue}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
}

function parseTimestamp(value, flagName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (/^\d+$/.test(String(value))) {
    return Number(value);
  }
  const normalized = String(value).trim().replace(/\//g, '-');
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flagName} 不是有效时间：${value}`);
  }
  return parsed;
}

function parseRangeToken(token) {
  const [appType, formUuid] = String(token).split(':').map(part => part && part.trim());
  if (!appType || !formUuid) {
    throw new Error(`代理范围格式必须是 appType:formUuid：${token}`);
  }
  return { appType, formUuid };
}

function parseRangeValue(options) {
  if (options.range_file) {
    return JSON.parse(fs.readFileSync(options.range_file, 'utf8'));
  }
  if (options.range_json) {
    return JSON.parse(options.range_json);
  }
  const tokens = splitList(options.range_form || options.range_forms);
  if (tokens.length > 0) {
    return tokens.map(parseRangeToken);
  }
  return undefined;
}

function firstOption(options, keys) {
  for (const key of keys) {
    if (options[key] !== undefined) {
      return options[key];
    }
  }
  return undefined;
}

function buildMutationOptions(positionals, options) {
  const typeFromPosition = ['normal', 'departure', 'depart', 'dismissed', 'NORMAL', 'DEPARTURE'].includes(positionals[0])
    ? positionals.shift()
    : undefined;
  const rangeValue = parseRangeValue(options);
  const rangeType = firstOption(options, ['range', 'agent_range_type', 'range_type']) || (rangeValue ? 'part' : undefined);
  return {
    type: firstOption(options, ['type', 'agent_type']) || typeFromPosition || 'normal',
    sourceUserId: firstOption(options, ['source_user', 'source_user_id', 'from_user', 'source']),
    targetUserId: firstOption(options, ['target_user', 'target_user_id', 'to_user', 'target']),
    start: parseTimestamp(firstOption(options, ['start', 'gmt_start_date']), '--start'),
    end: parseTimestamp(firstOption(options, ['end', 'gmt_end_date']), '--end'),
    category: firstOption(options, ['category', 'agent_category']),
    notifySource: firstOption(options, ['notify_source', 'origin_is_view']),
    rangeType,
    rangeValue,
  };
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

async function runList(options) {
  printJson(await listAgentTasks({
    status: options.status,
    keyword: options.keyword || options.keywords,
    page: toPositiveInt(options.page || options.page_index, 1),
    size: toPositiveInt(options.size || options.page_size, 10),
  }));
}

async function runSearchUser(positionals, options) {
  const keyword = positionals[0];
  if (!keyword) {
    fail('缺少搜索关键词');
  }
  printJson(await searchUsers({
    keyword,
    dept: options.dept || options.department,
    size: toPositiveInt(options.size, 50),
  }));
}

async function runCreate(positionals, options) {
  const mutation = buildMutationOptions(positionals, options);
  printJson(await createAgentTask(mutation));
}

async function runUpdate(positionals, options) {
  const agentUuid = positionals.shift();
  if (!agentUuid) {
    fail('缺少 agentUuid');
  }
  const mutation = buildMutationOptions(positionals, options);
  printJson(await updateAgentTask({
    ...mutation,
    agentUuid,
  }));
}

async function runCancel(positionals, options) {
  const agentUuid = positionals[0];
  if (!agentUuid) {
    fail('缺少 agentUuid');
  }
  printJson(await cancelAgentTask({
    agentUuid,
    type: options.type || options.agent_type || positionals[1] || 'normal',
  }));
}

async function runRange(positionals) {
  const agentUuid = positionals[0];
  if (!agentUuid) {
    fail('缺少 agentUuid');
  }
  printJson(await getAgentRange({ agentUuid }));
}

async function run(args) {
  const { positionals, options } = parseCliOptions(args);
  const action = positionals.shift();

  if (!action || action === '--help' || action === '-h') {
    console.log(USAGE);
    return;
  }

  if (action === 'list') {
    await runList(options);
  } else if (action === 'search-user') {
    await runSearchUser(positionals, options);
  } else if (action === 'create') {
    await runCreate(positionals, options);
  } else if (action === 'update') {
    await runUpdate(positionals, options);
  } else if (action === 'cancel' || action === 'revoke') {
    await runCancel(positionals, options);
  } else if (action === 'range') {
    await runRange(positionals);
  } else if (action === 'is-leader') {
    printJson(await isLeaderShip());
  } else if (action === 'last-departure') {
    printJson(await getLastDepartureAgent());
  } else {
    fail(`未知 agent-center 子命令：${action}`);
  }
}

module.exports = {
  USAGE,
  parseCliOptions,
  splitList,
  parseTimestamp,
  parseRangeToken,
  parseRangeValue,
  buildMutationOptions,
  run,
};
