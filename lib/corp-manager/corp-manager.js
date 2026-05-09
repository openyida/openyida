'use strict';

const {
  buildSubAdminConfig,
  listAdmins,
  searchUsers,
  saveAdmin,
  removeAdmin,
  getAddressBookVisible,
  saveAddressBookVisible,
} = require('./api');

const USAGE = `openyida corp-manager - 平台权限管理

Usage:
  openyida corp-manager search-user <keyword> [--dept <text>] [--size N]
  openyida corp-manager list <app|platform|sub> [--user <userId>] [--page N] [--size N]
  openyida corp-manager add <app|platform|sub> --user <userId> [--dept-ids <id1,id2>] [--scenes appManage,bulletinBoard]
  openyida corp-manager remove <app|platform|sub> --user <userId>
  openyida corp-manager address-book get
  openyida corp-manager address-book set [--all-visible y|n] [--admin-visible y|n]

Examples:
  openyida corp-manager search-user "余浩" --dept "宜搭,钉钉官方同学"
  openyida corp-manager add sub --user 014734242419657712 --dept-ids 848712658 --scenes appManage,bulletinBoard
  openyida corp-manager remove sub --user 014734242419657712
`;

function fail(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(1);
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

function splitList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
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

function normalizeVisible(value, flagName) {
  if (value === undefined || value === true) {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['y', 'yes', 'true', '1', 'on'].includes(normalized)) {
    return 'y';
  }
  if (['n', 'no', 'false', '0', 'off'].includes(normalized)) {
    return 'n';
  }
  throw new Error(`${flagName} 只支持 y/n`);
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

async function runSearchUser(positionals, options) {
  const keyword = positionals[0];
  if (!keyword) {
    fail('缺少搜索关键词');
  }

  const result = await searchUsers({
    keyword,
    dept: options.dept || options.department,
    size: toPositiveInt(options.size, 50),
  });
  printJson(result);
}

async function runList(positionals, options) {
  const role = positionals[0];
  if (!role) {
    fail('缺少角色：app、platform 或 sub');
  }

  const result = await listAdmins({
    role,
    userId: options.user || options.user_id,
    page: toPositiveInt(options.page, 1),
    size: toPositiveInt(options.size, 20),
  });
  printJson(result);
}

async function runAdd(positionals, options) {
  const role = positionals[0];
  const userId = options.user || options.user_id;
  if (!role) {
    fail('缺少角色：app、platform 或 sub');
  }
  if (!userId) {
    fail('缺少 --user <userId>');
  }

  const result = await saveAdmin({
    role,
    userId,
    deptIds: splitList(options.dept_ids || options.department_ids),
    scenes: splitList(options.scenes || 'appManage,bulletinBoard'),
  });
  printJson(result);
}

async function runRemove(positionals, options) {
  const role = positionals[0];
  const userId = options.user || options.user_id;
  if (!role) {
    fail('缺少角色：app、platform 或 sub');
  }
  if (!userId) {
    fail('缺少 --user <userId>');
  }

  const result = await removeAdmin({ role, userId });
  printJson(result);
}

async function runAddressBook(positionals, options) {
  const action = positionals[0];
  if (action === 'get') {
    printJson(await getAddressBookVisible());
    return;
  }

  if (action === 'set') {
    const allVisible = normalizeVisible(options.all_visible, '--all-visible');
    const adminVisible = normalizeVisible(options.admin_visible, '--admin-visible');
    if (allVisible === undefined && adminVisible === undefined) {
      fail('address-book set 至少需要 --all-visible 或 --admin-visible');
    }
    printJson(await saveAddressBookVisible({
      allVisible,
      adminVisible,
    }));
    return;
  }

  fail('address-book 子命令只支持 get 或 set');
}

async function run(args) {
  const { positionals, options } = parseCliOptions(args);
  const action = positionals.shift();

  if (!action || action === '--help' || action === '-h') {
    console.log(USAGE);
    return;
  }

  if (action === 'search-user') {
    await runSearchUser(positionals, options);
  } else if (action === 'list') {
    await runList(positionals, options);
  } else if (action === 'add') {
    await runAdd(positionals, options);
  } else if (action === 'remove') {
    await runRemove(positionals, options);
  } else if (action === 'address-book') {
    await runAddressBook(positionals, options);
  } else {
    fail(`未知 corp-manager 子命令：${action}`);
  }
}

module.exports = {
  USAGE,
  parseCliOptions,
  splitList,
  normalizeVisible,
  buildSubAdminConfig,
  run,
};
