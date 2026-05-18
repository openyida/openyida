'use strict';

const querystring = require('querystring');

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { searchUsers } = require('../corp-manager/api');

const ROLE_CONFIGS = {
  MAIN: {
    key: 'main',
    label: '应用主管理员',
    memberField: 'managers',
    idField: 'managerIdList',
    required: true,
  },
  DATA: {
    key: 'data',
    label: '数据管理员',
    memberField: 'dataManagers',
    idField: 'dataManagerUserIdList',
    required: false,
  },
  DEV: {
    key: 'dev',
    label: '开发成员',
    memberField: 'devManagers',
    idField: 'devManagerUserIdList',
    required: false,
  },
};

const ROLE_ALIASES = {
  main: 'MAIN',
  primary: 'MAIN',
  owner: 'MAIN',
  admin: 'MAIN',
  manager: 'MAIN',
  mainManagers: 'MAIN',
  MAIN: 'MAIN',

  data: 'DATA',
  dataAdmin: 'DATA',
  dataManager: 'DATA',
  dataManagers: 'DATA',
  DATA: 'DATA',

  dev: 'DEV',
  develop: 'DEV',
  developer: 'DEV',
  development: 'DEV',
  devManager: 'DEV',
  devManagers: 'DEV',
  DEV: 'DEV',
};

const USAGE = `openyida app-permission - 应用级管理员设置

Usage:
  openyida app-permission search-user <keyword> [--dept <text>] [--size N]
  openyida app-permission get <appType>
  openyida app-permission set <appType> <main|data|dev> --users <userId1,userId2>
  openyida app-permission set <appType> <data|dev> --clear
  openyida app-permission add <appType> <main|data|dev> --users <userId1,userId2>
  openyida app-permission remove <appType> <main|data|dev> --users <userId1,userId2>

Examples:
  openyida app-permission get APP_XXX
  openyida app-permission add APP_XXX data --users manager7350
  openyida app-permission set APP_XXX dev --users user001,user002
`;

function fail(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(1);
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function getAuthRef() {
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies || !cookieData.csrf_token) {
    cookieData = triggerLogin();
  }

  if (!cookieData || !cookieData.cookies || !cookieData.csrf_token) {
    throw new Error('无法获取有效登录态或 CSRF Token');
  }

  return {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
}

function assertSuccess(result, action) {
  if (result && result.success) {
    return result;
  }
  const message = result && (result.errorMsg || result.message || result.errorCode);
  throw new Error(`${action}失败${message ? `：${message}` : ''}`);
}

function normalizeRole(role) {
  const normalized = ROLE_ALIASES[String(role || '').trim()];
  if (!normalized) {
    throw new Error(`无效角色：${role}，可用值：main, data, dev`);
  }
  return normalized;
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return value.zh_CN || value.pureEn_US || value.en_US || value.value || value.text || value.label || '';
  }
  return String(value);
}

function validateAppType(appType) {
  if (!appType) {
    throw new Error('缺少 appType');
  }
  if (/[/?#]/.test(appType)) {
    throw new Error(`无效 appType：${appType}`);
  }
  return appType;
}

function splitList(value) {
  if (!value || value === true) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set((values || []).map(value => String(value).trim()).filter(Boolean))];
}

function toPositiveInt(value, defaultValue) {
  const parsed = Number.parseInt(value || `${defaultValue}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
}

function parseCliOptions(tokens) {
  const positionals = [];
  const options = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-/g, '_');
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
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

function buildCommonParams(authRef, params = {}) {
  return {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: '28800000',
    _stamp: String(Date.now()),
    ...params,
  };
}

async function appGet(appType, path, params, authRef = getAuthRef()) {
  const safeAppType = validateAppType(appType);
  return requestWithAutoLogin(
    auth => httpGet(
      auth.baseUrl,
      `/${safeAppType}/${path.replace(/^\/+/, '')}`,
      buildCommonParams(auth, params),
      auth.cookies,
    ),
    authRef,
  );
}

async function appPost(appType, path, params, authRef = getAuthRef()) {
  const safeAppType = validateAppType(appType);
  return requestWithAutoLogin(
    auth => httpPost(
      auth.baseUrl,
      `/${safeAppType}/${path.replace(/^\/+/, '')}`,
      querystring.stringify(buildCommonParams(auth, params)),
      auth.cookies,
    ),
    authRef,
  );
}

function normalizeMember(record) {
  const userId = record.userId || record.emplId || record.id || record.key || record.workNo || '';
  const userName = normalizeText(
    record.displayName ||
    record.defaultName ||
    record.name ||
    record.nickName ||
    record.label ||
    record.userName,
  );

  return {
    userId,
    userName,
    dingtalkId: record.dingtalkId || '',
    avatar: record.personalPhoto || record.personalPhotoUrl || record.avatar || '',
    companyNo: record.companyNo || '',
    workStatus: record.workStatus || '',
  };
}

function memberIds(members) {
  return unique((members || []).map(member => member.userId || member.emplId || member.id || member.key));
}

function idsFromContent(content, config) {
  const idValue = content[config.idField];
  const idsFromField = typeof idValue === 'string' ? splitList(idValue) : [];
  if (idsFromField.length > 0) {
    return unique(idsFromField);
  }
  return memberIds(content[config.memberField] || []);
}

function normalizeRolePayload(content, roleType) {
  const config = ROLE_CONFIGS[roleType];
  const members = (content[config.memberField] || []).map(normalizeMember);
  const ids = idsFromContent(content, config);

  return {
    role: config.key,
    roleType,
    roleLabel: config.label,
    required: config.required,
    userIds: ids,
    members,
  };
}

function normalizeAppPermission(content = {}) {
  return {
    success: true,
    appType: content.appType || '',
    appName: normalizeText(content.appName),
    sentryMode: content.sentryMode || '',
    isAccessControl: content.isAccessControl || '',
    allowExternalAddressBook: content.allowExternalAddressBook || '',
    newAllowExternalAddressBook: content.newAllowExternalAddressBook || '',
    currentUserAdminType: content.adminType || '',
    roles: {
      main: normalizeRolePayload(content, 'MAIN'),
      data: normalizeRolePayload(content, 'DATA'),
      dev: normalizeRolePayload(content, 'DEV'),
    },
  };
}

async function getAppPermission(appType, authRef = getAuthRef()) {
  const result = await appGet(
    appType,
    '/query/app/getAppIncludingAecpInfo.json',
    { appKey: appType },
    authRef,
  );
  assertSuccess(result, '查询应用管理员设置');
  return normalizeAppPermission(result.content || {});
}

async function saveRoleManagers(options = {}, authRef = getAuthRef()) {
  const appType = validateAppType(options.appType);
  const roleType = normalizeRole(options.role || options.roleType);
  const userIds = unique(options.userIds || options.users || []);

  if (ROLE_CONFIGS[roleType].required && userIds.length === 0) {
    throw new Error(`${ROLE_CONFIGS[roleType].label}不能为空`);
  }

  const result = await appPost(
    appType,
    '/query/app/updateAppAdmin.json',
    {
      adminType: roleType,
      managers: userIds.join(','),
    },
    authRef,
  );
  assertSuccess(result, '保存应用管理员设置');

  return {
    success: true,
    appType,
    role: ROLE_CONFIGS[roleType].key,
    roleType,
    roleLabel: ROLE_CONFIGS[roleType].label,
    userIds,
    content: result.content,
  };
}

async function updateRoleManagers(options = {}, authRef = getAuthRef()) {
  const appType = validateAppType(options.appType);
  const roleType = normalizeRole(options.role || options.roleType);
  const action = options.action || 'set';
  const inputUserIds = unique(options.userIds || options.users || []);

  if (action === 'set') {
    return saveRoleManagers({ appType, roleType, userIds: inputUserIds }, authRef);
  }

  if (inputUserIds.length === 0) {
    throw new Error(`${action} 操作必须提供 --users`);
  }

  const current = await getAppPermission(appType, authRef);
  const roleKey = ROLE_CONFIGS[roleType].key;
  const previousUserIds = current.roles[roleKey].userIds;
  let nextUserIds;

  if (action === 'add') {
    nextUserIds = unique(previousUserIds.concat(inputUserIds));
  } else if (action === 'remove') {
    const removeSet = new Set(inputUserIds);
    nextUserIds = previousUserIds.filter(userId => !removeSet.has(userId));
  } else {
    throw new Error(`未知操作：${action}`);
  }

  const saved = await saveRoleManagers({ appType, roleType, userIds: nextUserIds }, authRef);
  return {
    ...saved,
    action,
    previousUserIds,
  };
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

async function runGet(positionals) {
  const appType = positionals[0];
  if (!appType) {
    fail('缺少 appType');
  }
  printJson(await getAppPermission(appType));
}

async function runUpdate(action, positionals, options) {
  const appType = positionals[0];
  const role = positionals[1];
  if (!appType) {
    fail('缺少 appType');
  }
  if (!role) {
    fail('缺少角色：main、data 或 dev');
  }

  const userIds = options.clear ? [] : splitList(options.users || options.user || options.user_ids);
  if (!options.clear && userIds.length === 0) {
    fail(`${action} 操作必须提供 --users <userId1,userId2>；清空 data/dev 请使用 --clear`);
  }
  if (options.clear && action !== 'set') {
    fail('--clear 只支持 set 操作');
  }

  const saved = await updateRoleManagers({
    action,
    appType,
    role,
    userIds,
  });
  const current = await getAppPermission(appType);
  const roleKey = ROLE_CONFIGS[saved.roleType].key;

  printJson({
    ...saved,
    currentRole: current.roles[roleKey],
  });
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
  } else if (action === 'get' || action === 'list') {
    await runGet(positionals);
  } else if (['set', 'add', 'remove'].includes(action)) {
    await runUpdate(action, positionals, options);
  } else {
    fail(`未知 app-permission 子命令：${action}`);
  }
}

module.exports = {
  ROLE_CONFIGS,
  ROLE_ALIASES,
  USAGE,
  parseCliOptions,
  splitList,
  normalizeRole,
  normalizeText,
  normalizeMember,
  normalizeAppPermission,
  getAppPermission,
  saveRoleManagers,
  updateRoleManagers,
  run,
};
