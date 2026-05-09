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

const ROLE_ALIASES = {
  app: 'applicationCreateRole',
  application: 'applicationCreateRole',
  applicationCreateRole: 'applicationCreateRole',
  platform: 'corpAdminRole',
  main: 'corpAdminRole',
  corp: 'corpAdminRole',
  corpAdminRole: 'corpAdminRole',
  sub: 'subCorpAdminRole',
  subPlatform: 'subCorpAdminRole',
  subCorpAdminRole: 'subCorpAdminRole',
};

const ROLE_LABELS = {
  applicationCreateRole: '应用管理员',
  corpAdminRole: '平台管理员',
  subCorpAdminRole: '平台子管理员',
};

const SCENE_LABELS = {
  appManage: '应用管理',
  bulletinBoard: '公告栏定制',
};

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

function normalizeRole(role) {
  const normalized = ROLE_ALIASES[role];
  if (!normalized) {
    throw new Error(`无效角色：${role}，可用值：app, platform, sub`);
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

function buildCommonParams(authRef, params = {}) {
  return {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: '28800000',
    _stamp: String(Date.now()),
    ...params,
  };
}

async function corpGet(path, params, authRef = getAuthRef()) {
  return requestWithAutoLogin(
    (auth) => httpGet(auth.baseUrl, path, buildCommonParams(auth, params), auth.cookies),
    authRef,
  );
}

async function corpPost(path, params, authRef = getAuthRef()) {
  return requestWithAutoLogin(
    (auth) => httpPost(auth.baseUrl, path, querystring.stringify(buildCommonParams(auth, params)), auth.cookies),
    authRef,
  );
}

function assertSuccess(result, action) {
  if (result && result.success) {
    return result;
  }
  const message = result && (result.errorMsg || result.message || result.errorCode);
  throw new Error(`${action}失败${message ? `：${message}` : ''}`);
}

function normalizeAdmin(record) {
  return {
    userId: record.userId || record.adminWorkNo || '',
    userName: normalizeText(record.userName),
    businessWorkNo: record.businessWorkNo || '',
    departmentId: record.departmentId || '',
    departmentNamePath: normalizeText(record.departmentNamePath),
    roleType: record.roleType || '',
    roleLabel: ROLE_LABELS[record.roleType] || record.roleType || '',
    mainAdmin: !!record.mainAdmin,
    orgAdmin: !!record.orgAdmin,
    manageDeptIds: record.manageDeptIds || [],
    manageDeptNames: record.manageDeptNames || [],
    manageScene: record.manageScene || [],
    manageSceneLabels: (record.manageScene || []).map(scene => SCENE_LABELS[scene] || scene),
  };
}

function normalizeUser(record) {
  const depts = Array.isArray(record.depts) ? record.depts : [];
  return {
    userId: record.id || record.emplId || record.userId || record.workNo || '',
    userName: normalizeText(record.name || record.text || record.userName || record.displayName),
    departmentNamePath: normalizeText(record.deptDesc || record.deptFullPath || record.departmentNamePath),
    departmentIds: depts.map(dept => String(dept.id || '')).filter(Boolean),
    departments: depts.map(dept => ({
      id: String(dept.id || ''),
      name: normalizeText(dept.deptName || dept.deptPathName || dept.name || dept.text),
      path: normalizeText(dept.deptPathName || dept.deptName || dept.name || dept.text),
    })),
    avatar: record.personalPhoto || record.avatar || '',
    sourceIdentifier: record.sourceIdentifier || '',
  };
}

function parseAdminList(result) {
  const content = (result && result.content) || {};
  return {
    success: true,
    currentPage: Number(content.currentPage || 1),
    pageSize: Number(content.limit || content.pageSize || 0),
    totalCount: Number(content.totalCount || 0),
    admins: (content.values || []).map(normalizeAdmin),
  };
}

async function listAdmins(options = {}, authRef = getAuthRef()) {
  const roleType = normalizeRole(options.role || options.roleType || 'app');
  const params = {
    currentPage: String(options.page || 1),
    pageIndex: String(options.page || 1),
    pageSize: String(options.size || 20),
    roleType,
  };

  if (options.userId) {
    params.adminWorkNos = options.userId;
  }

  const result = await corpPost('/query/corpadmin/listCorpAppOrSubAdmins.json', params, authRef);
  assertSuccess(result, '查询管理员列表');
  return parseAdminList(result);
}

async function searchUsers(options = {}, authRef = getAuthRef()) {
  const keyword = options.keyword || options.key || '';
  if (!keyword) {
    throw new Error('缺少搜索关键词');
  }

  const result = await corpGet('/query/userservice/searchUsersOrDepts.json', {
    key: keyword,
    start: '0',
    size: String(options.size || 50),
    option: 'employee',
  }, authRef);
  assertSuccess(result, '搜索人员');

  const content = result.content || {};
  const values = content.values || content.data || [];
  const users = values
    .filter(item => !item.dept)
    .map(normalizeUser);

  const deptFilter = options.dept || options.department;
  const filteredUsers = deptFilter
    ? users.filter(user => user.departmentNamePath.includes(deptFilter))
    : users;

  return {
    success: true,
    totalCount: filteredUsers.length,
    users: filteredUsers,
  };
}

function buildSubAdminConfig(options = {}) {
  const deptIds = options.deptIds || options.departmentIds || [];
  if (!Array.isArray(deptIds) || deptIds.length === 0) {
    throw new Error('添加或更新平台子管理员时必须提供 --dept-ids');
  }

  const scenes = options.scenes || ['appManage', 'bulletinBoard'];
  return JSON.stringify({
    deptList: deptIds.map(id => String(id)),
    scene: scenes.map(scene => String(scene)).filter(Boolean),
  });
}

async function saveAdmin(options = {}, authRef = getAuthRef()) {
  const roleType = normalizeRole(options.role || options.roleType || 'app');
  const userId = options.userId || options.user || options.adminWorkNos;
  if (!userId) {
    throw new Error('缺少成员 userId');
  }

  const params = {
    adminWorkNos: userId,
    roleType,
  };

  if (roleType === 'subCorpAdminRole') {
    params.config = buildSubAdminConfig(options);
  }

  const result = await corpPost('/query/corpadmin/saveAppOrSubAdmins.json', params, authRef);
  assertSuccess(result, '保存管理员');
  return {
    success: true,
    roleType,
    roleLabel: ROLE_LABELS[roleType],
    userId,
    content: result.content || {},
  };
}

async function removeAdmin(options = {}, authRef = getAuthRef()) {
  const roleType = normalizeRole(options.role || options.roleType || 'app');
  const userId = options.userId || options.user || options.adminWorkNos;
  if (!userId) {
    throw new Error('缺少成员 userId');
  }

  const result = await corpPost('/query/corpadmin/batchDeleteAdmins.json', {
    adminWorkNos: userId,
    roleType,
  }, authRef);
  assertSuccess(result, '移除管理员');
  return {
    success: true,
    roleType,
    roleLabel: ROLE_LABELS[roleType],
    userId,
    content: result.content || {},
  };
}

async function getAddressBookVisible(authRef = getAuthRef()) {
  const result = await corpGet('/query/corpadmin/getAddressBookVisible.json', {}, authRef);
  assertSuccess(result, '查询通讯录权限');
  const content = result.content || {};
  return {
    success: true,
    isAllVisible: content.isAllVisible || 'n',
    isAdminVisible: content.isAdminVisible || 'n',
  };
}

async function saveAddressBookVisible(options = {}, authRef = getAuthRef()) {
  const current = await getAddressBookVisible(authRef);
  const isAllVisible = options.isAllVisible || options.allVisible || current.isAllVisible;
  const isAdminVisible = options.isAdminVisible || options.adminVisible || current.isAdminVisible;

  const result = await corpPost('/query/corpadmin/saveAddressBoolVisible.json', {
    isAllVisible,
    isAdminVisible,
  }, authRef);
  assertSuccess(result, '保存通讯录权限');

  return {
    success: true,
    isAllVisible,
    isAdminVisible,
    content: result.content || {},
  };
}

module.exports = {
  ROLE_ALIASES,
  ROLE_LABELS,
  SCENE_LABELS,
  getAuthRef,
  normalizeRole,
  normalizeText,
  normalizeAdmin,
  normalizeUser,
  buildSubAdminConfig,
  listAdmins,
  searchUsers,
  saveAdmin,
  removeAdmin,
  getAddressBookVisible,
  saveAddressBookVisible,
};
