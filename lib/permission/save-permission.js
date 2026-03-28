/**
 * save-permission.js - 宜搭表单权限配置保存命令
 *
 * 用法（更新已有权限组）：
 *   openyida save-permission <appType> <formUuid> --data-permission <json>
 *   openyida save-permission <appType> <formUuid> --action-permission <json>
 *   openyida save-permission <appType> <formUuid> --members <userIds> --data-permission <json>
 *
 * 用法（新增权限组）：
 *   openyida save-permission <appType> <formUuid> --create --name <权限组名称> [--members <userIds>] [--data-permission <json>] [--action-permission <json>]
 *
 * --members 参数：指定权限组成员，多个钉钉 userId 用逗号分隔
 *   示例：--members "54255850977641,12345678901234"
 *   不传则保持原有成员配置不变（更新模式）或仅包含管理员（新增模式）
 *
 * 注意：字段权限（--field-permission）暂不支持，请通过宜搭管理后台手动操作。
 */
'use strict';

const querystring = require('querystring');

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  isLoginExpired,
  isCsrfTokenExpired,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');

const SEP = '='.repeat(50);

// 数据权限范围映射：用户友好别名 → 接口实际值
const DATA_RANGE_TO_PERMIT_TYPE = {
  ALL: 'ALL',
  SELF: 'ORIGINATOR',
  DEPARTMENT: 'ORIGINATOR_DEPARTMENT',
  CUSTOM: 'FORMULA',
  // 接口原始值直接透传
  ORIGINATOR: 'ORIGINATOR',
  ORIGINATOR_DEPARTMENT: 'ORIGINATOR_DEPARTMENT',
  SAME_LEVEL_DEPARTMENT: 'SAME_LEVEL_DEPARTMENT',
  SUBORDINATE_DEPARTMENT: 'SUBORDINATE_DEPARTMENT',
  FREE_LOGIN: 'FREE_LOGIN',
  CUSTOM_DEPARTMENT: 'CUSTOM_DEPARTMENT',
  FORMULA: 'FORMULA',
};

// 所有支持的操作权限 key
const VALID_OPERATE_KEYS = [
  'OPERATE_VIEW',
  'OPERATE_EDIT',
  'OPERATE_DELETE',
  'OPERATE_HISTORY',
  'OPERATE_COMMENT',
  'OPERATE_PRINT',
  'OPERATE_BATCH_IMPORT',
  'OPERATE_BATCH_EXPORT',
  'OPERATE_BATCH_EDIT',
  'OPERATE_BATCH_DELETE',
  'OPERATE_BATCH_PRINT',
  'OPERATE_BATCH_DOWNLOAD',
  'OPERATE_BATCH_DOWNLOAD_QRCODE',
  'OPERATE_CREATE',
];

function parseArgs(args) {
  if (args.length < 2) {
    console.error('用法: openyida save-permission <appType> <formUuid> [--create --name <名称>] [--data-permission <json>] [--action-permission <json>] [--members <userIds>]');
    console.error('示例（更新）: openyida save-permission APP_XXX FORM-XXX --data-permission \'{"role":"DEFAULT","dataRange":"SELF"}\'');
    console.error('示例（新增）: openyida save-permission APP_XXX FORM-XXX --create --name "只读权限组" --members "54255850977641"');
    process.exit(1);
  }

  const appType = args[0];
  const formUuid = args[1];
  let dataPermission = null;
  let actionPermission = null;
  let members = null;
  let createMode = false;
  let groupName = null;

  for (let index = 2; index < args.length; index++) {
    if (args[index] === '--create') {
      createMode = true;
    } else if (args[index] === '--name' && args[index + 1]) {
      groupName = args[index + 1];
      index++;
    } else if (args[index] === '--data-permission' && args[index + 1]) {
      try {
        dataPermission = JSON.parse(args[index + 1]);
      } catch {
        console.error(`❌ --data-permission 参数 JSON 解析失败: ${args[index + 1]}`);
        process.exit(1);
      }
      index++;
    } else if (args[index] === '--action-permission' && args[index + 1]) {
      try {
        actionPermission = JSON.parse(args[index + 1]);
      } catch {
        console.error(`❌ --action-permission 参数 JSON 解析失败: ${args[index + 1]}`);
        process.exit(1);
      }
      index++;
    } else if (args[index] === '--members' && args[index + 1]) {
      // 多个钉钉 userId 用逗号分隔，如 "54255850977641,12345678901234"
      members = args[index + 1].split(',').map((id) => id.trim()).filter(Boolean);
      index++;
    } else if (args[index] === '--field-permission') {
      console.error('⚠️  字段权限（--field-permission）暂不支持，请通过宜搭管理后台手动操作。');
      process.exit(1);
    }
  }

  if (createMode && !groupName) {
    console.error('❌ 新增模式（--create）必须同时提供 --name <权限组名称>');
    process.exit(1);
  }

  if (!createMode && !dataPermission && !actionPermission && !members) {
    console.error('❌ 请至少提供 --data-permission、--action-permission 或 --members 参数之一');
    process.exit(1);
  }

  return { appType, formUuid, dataPermission, actionPermission, members, createMode, groupName };
}

function validateDataPermission(dataPermission) {
  const validRanges = Object.keys(DATA_RANGE_TO_PERMIT_TYPE);
  if (dataPermission.dataRange && !validRanges.includes(dataPermission.dataRange)) {
    throw new Error(
      `无效的 dataRange: ${dataPermission.dataRange}，有效值: ${validRanges.join(', ')}`
    );
  }
}

function validateActionPermission(actionPermission) {
  if (!actionPermission.operations || typeof actionPermission.operations !== 'object') {
    throw new Error(
      '操作权限必须包含 operations 对象，格式为 {"OPERATE_VIEW": true, "OPERATE_EDIT": false, ...}'
    );
  }
  for (const key of Object.keys(actionPermission.operations)) {
    if (!VALID_OPERATE_KEYS.includes(key)) {
      throw new Error(
        `无效的操作权限 key: ${key}，有效值: ${VALID_OPERATE_KEYS.join(', ')}`
      );
    }
  }
}

/**
 * 查询权限组列表
 * 接口：GET /{appType}/permission/manage/listPermitPackages.json
 */
function fetchPermitPackages(appType, formUuid, authRef) {
  const https = require('https');
  const http = require('http');

  return new Promise((resolve, reject) => {
    const { cookies, csrfToken, baseUrl } = authRef;
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const queryParams = new URLSearchParams({
      _api: 'Permission.getPermitGroupList',
      _mock: 'false',
      _csrf_token: csrfToken,
      _locale_time_zone_offset: '28800000',
      formUuid,
      packageName: '',
      packageType: 'FORM_PACKAGE_VIEW',
      pageIndex: '1',
      pageSize: '20',
      appType,
      _stamp: String(Date.now()),
    });

    const requestPath = `/${appType}/permission/manage/listPermitPackages.json?${queryParams.toString()}`;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: requestPath,
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
        Accept: 'application/json, text/json',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${baseUrl}/${appType}/admin/${formUuid}/settings/permission`,
      },
      timeout: 30000,
    };

    const req = requestModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.error(t('common.http_status', res.statusCode));
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) { resolve({ __needLogin: true }); return; }
          if (isCsrfTokenExpired(parsed)) { resolve({ __csrfExpired: true }); return; }
          resolve(parsed);
        } catch {
          resolve({ success: false, errorMsg: t('common.response_not_json') });
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
    req.end();
  });
}

/**
 * 构建 roleData（成员角色数据）
 * 从 git 历史 93f7b79 恢复：该函数在 ESLint 批量修复时被误删
 *
 * @param {object} permitPackage - 权限组数据
 * @param {string[]|null} overrideMembers - 覆盖成员列表
 * @returns {object} roleData 对象
 */
function buildRoleData(permitPackage, overrideMembers) {
  let existingRoleData = { include: [] };
  if (permitPackage.roleData) {
    try {
      const parsed = typeof permitPackage.roleData === 'string'
        ? JSON.parse(permitPackage.roleData)
        : permitPackage.roleData;
      existingRoleData = parsed;
    } catch (_parseError) {
      existingRoleData = { include: [] };
    }
  }
  if (!overrideMembers) {
    return existingRoleData;
  }
  const nonPersonsEntries = (existingRoleData.include || []).filter((entry) => entry.roleType !== 'PERSONS');
  const newInclude = [...nonPersonsEntries];
  if (overrideMembers.length > 0) {
    newInclude.push({ roleType: 'PERSONS', roleValue: overrideMembers.join(',') });
  }
  return { include: newInclude };
}

/**
 * 保存单个权限组（新增或更新）
 * 接口：POST /{appType}/permission/manage/saveOrUpdatePermit.json
 *
 * @param {string} appType
 * @param {string} formUuid
 * @param {object} permitPackage - 权限组数据。新增时不含 packageUuid；更新时含 packageUuid
 * @param {string[]|null} overrideMembers - 覆盖成员列表（钉钉 userId），null 表示不修改
 * @param {object} authRef
 */
function savePermitPackage(appType, formUuid, permitPackage, overrideMembers, authRef) {
  const https = require('https');
  const http = require('http');

  return new Promise((resolve, reject) => {
    const { cookies, csrfToken, baseUrl } = authRef;
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const requestPath = `/${appType}/permission/manage/saveOrUpdatePermit.json?_api=Permission.saveOrUpdatePermitGroup&_mock=false&_stamp=${Date.now()}`;

    // 新增模式：permitPackage.roleData 已经是构建好的字符串，直接使用
    // 更新模式：通过 buildRoleData 处理 overrideMembers
    const roleDataStr = permitPackage.roleData && !overrideMembers
      ? (typeof permitPackage.roleData === 'string' ? permitPackage.roleData : JSON.stringify(permitPackage.roleData))
      : JSON.stringify(buildRoleData(permitPackage, overrideMembers));

    const postParams = {
      _csrf_token: csrfToken,
      _locale_time_zone_offset: '28800000',
      formUuid,
      packageType: permitPackage.packageType || 'FORM_PACKAGE_VIEW',
      packageName: typeof permitPackage.packageName === 'string'
        ? permitPackage.packageName
        : JSON.stringify(permitPackage.packageName),
      description: typeof permitPackage.description === 'string'
        ? permitPackage.description
        : JSON.stringify(permitPackage.description),
      roleData: roleDataStr,
      dataPermit: typeof permitPackage.dataPermit === 'string'
        ? permitPackage.dataPermit
        : JSON.stringify(permitPackage.dataPermit),
      operatePermit: typeof permitPackage.operatePermit === 'string'
        ? permitPackage.operatePermit
        : JSON.stringify(permitPackage.operatePermit),
      customButtonPermit: permitPackage.customButtonPermit || '[]',
      fieldPermit: typeof permitPackage.fieldPermit === 'string'
        ? permitPackage.fieldPermit
        : JSON.stringify(permitPackage.fieldPermit),
      viewData: typeof permitPackage.viewData === 'string'
        ? permitPackage.viewData
        : JSON.stringify(permitPackage.viewData || { all: 'y', viewUuids: [] }),
    };

    // 只有更新模式才传 packageUuid（新增时不传）
    if (permitPackage.packageUuid) {
      postParams.packageUuid = permitPackage.packageUuid;
    }

    const postData = querystring.stringify(postParams);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Cookie: cookieHeader,
        Accept: 'application/json, text/json',
        Origin: baseUrl,
        Referer: `${baseUrl}/${appType}/admin/${formUuid}/settings/permission`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 30000,
    };

    const req = requestModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.error(t('common.http_status', res.statusCode));
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) { resolve({ __needLogin: true }); return; }
          if (isCsrfTokenExpired(parsed)) { resolve({ __csrfExpired: true }); return; }
          resolve(parsed);
        } catch {
          resolve({ success: false, errorMsg: t('common.response_not_json') });
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run(args) {
  const { appType, formUuid, dataPermission, actionPermission, members, createMode, groupName } = parseArgs(args);

  console.error(SEP);
  console.error('  save-permission - 宜搭表单权限配置保存');
  console.error(SEP);
  console.error(`\n  应用 ID:   ${appType}`);
  console.error(`  表单 UUID: ${formUuid}`);
  if (createMode) {
    console.error(`  模式:      新增权限组（${groupName}）`);
  }

  // Step 0: 参数校验
  console.error('\n📋 Step 0: 验证参数');
  try {
    if (dataPermission) {
      validateDataPermission(dataPermission);
      console.error(`  ✅ 数据权限验证通过（dataRange: ${dataPermission.dataRange || 'ALL'}）`);
    }
    if (actionPermission) {
      validateActionPermission(actionPermission);
      console.error('  ✅ 操作权限验证通过');
    }
    if (members) {
      console.error(`  ✅ 成员列表验证通过（${members.length} 人: ${members.join(', ')}）`);
    }
  } catch (err) {
    console.error(`  ❌ 参数验证失败: ${err.message}`);
    process.exit(1);
  }

  // Step 1: 读取登录态
  console.error(t('common.step_login', 1));
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(t('common.login_ready', authRef.baseUrl));

  // ── 新增权限组模式 ──────────────────────────────────────────────────────────
  if (createMode) {
    console.error('\n➕ Step 2: 新增权限组');

    // 构建新权限组数据
    const dataRange = (dataPermission && dataPermission.dataRange) || 'ALL';
    const permitType = DATA_RANGE_TO_PERMIT_TYPE[dataRange] || dataRange;

    const newOperatePermit = {};
    if (actionPermission) {
      for (const [key, enabled] of Object.entries(actionPermission.operations)) {
        if (enabled) {newOperatePermit[key] = 'y';}
      }
    } else {
      // 默认只给查看权限
      newOperatePermit['OPERATE_VIEW'] = 'y';
    }

    // 构建 roleData：默认包含管理员，如果指定了 members 则追加 PERSONS 条目
    const roleInclude = [{ roleType: 'MANAGER', roleValue: 'appMainAdminRole,corpAdminRole' }];
    if (members && members.length > 0) {
      roleInclude.push({ roleType: 'PERSONS', roleValue: members.join(',') });
    }

    const newPkg = {
      packageType: 'FORM_PACKAGE_VIEW',
      packageName: { zh_CN: groupName, en_US: groupName, type: 'i18n' },
      description: { zh_CN: groupName, en_US: groupName, type: 'i18n' },
      roleData: JSON.stringify({ include: roleInclude }),
      dataPermit: JSON.stringify({ rule: [{ type: permitType, value: 'y' }] }),
      operatePermit: JSON.stringify(newOperatePermit),
      customButtonPermit: '[]',
      fieldPermit: JSON.stringify({ fieldRange: 'FORM' }),
      viewData: JSON.stringify({ all: 'y', viewUuids: [] }),
      // 不传 packageUuid → 服务端创建新权限组
    };

    console.error(`  → 权限组名称: ${groupName}`);
    console.error(`  → 数据范围: ${dataRange} → ${permitType}`);
    console.error(`  → 操作权限: ${Object.keys(newOperatePermit).join(', ') || '（无）'}`);
    if (members) {console.error(`  → 成员: ${members.join(', ')}`);}

    const createResult = await requestWithAutoLogin(
      (auth) => savePermitPackage(appType, formUuid, newPkg, null, auth),
      authRef
    );

    console.error('\n' + SEP);
    if (createResult && createResult.success) {
      const newPackageUuid = createResult.content || '';
      console.error('  ✅ 权限组新增成功！');
      console.error(SEP);
      console.log(JSON.stringify({
        success: true,
        packageUuid: newPackageUuid,
        summary: {
          name: groupName,
          dataPermission: `数据范围: ${dataRange}`,
          actionPermission: `操作权限: ${Object.keys(newOperatePermit).join(', ') || '（无）'}`,
          members: members ? `成员: ${members.join(', ')}` : '仅管理员',
        },
        message: '权限组已新增',
      }, null, 2));
    } else {
      console.error(`  ❌ 新增失败: ${createResult && createResult.errorMsg || t('common.unknown_error')}`);
      console.error(SEP);
      process.exit(1);
    }
    return;
  }

  // ── 更新已有权限组模式 ──────────────────────────────────────────────────────
  console.error('\n📋 Step 2: 获取当前权限组列表');

  const listResult = await requestWithAutoLogin(
    (auth) => fetchPermitPackages(appType, formUuid, auth),
    authRef
  );

  if (!listResult || !listResult.success) {
    console.error(`  ❌ 获取权限组失败: ${listResult && listResult.errorMsg || t('common.unknown_error')}`);
    process.exit(1);
  }

  const packages = (listResult.content && listResult.content.formPermit) || [];
  if (packages.length === 0) {
    console.error('  ⚠️  未找到任何权限组');
    process.exit(1);
  }
  console.error(`  ✅ 获取到 ${packages.length} 个权限组`);

  // 根据 role 筛选要更新的权限组
  const targetRole = (dataPermission || actionPermission || {}).role || 'DEFAULT';
  const packagesToUpdate = packages.filter((pkg) => {
    if (targetRole === 'DEFAULT') {
      return pkg.roleMembers && pkg.roleMembers.some((rm) => rm.roleType === 'DEFAULT');
    }
    if (targetRole === 'MANAGER') {
      return pkg.roleMembers && pkg.roleMembers.some((rm) => rm.roleType === 'MANAGER');
    }
    return true;
  });

  if (packagesToUpdate.length === 0) {
    console.error(`  ⚠️  未找到匹配角色 "${targetRole}" 的权限组`);
    process.exit(1);
  }
  console.error(`  将更新 ${packagesToUpdate.length} 个权限组`);

  // Step 3: 逐个更新权限组
  let permitType = null;
  const stepParts = [];
  if (dataPermission) {
    permitType = DATA_RANGE_TO_PERMIT_TYPE[dataPermission.dataRange] || dataPermission.dataRange;
    stepParts.push(`数据权限: ${dataPermission.dataRange} → ${permitType}`);
  }
  if (actionPermission) {
    stepParts.push('操作权限: 同步更新');
  }
  if (members) {
    stepParts.push(`成员: ${members.join(', ')}`);
  }
  console.error(`\n💾 Step 3: 更新权限组（${stepParts.join('，')}）`);

  let allSuccess = true;
  for (const pkg of packagesToUpdate) {
    const pkgName = pkg.packageName && (pkg.packageName.zh_CN || pkg.packageName.en_US || '未命名');
    console.error(`  → 更新权限组: ${pkgName} (${pkg.packageUuid})`);

    const updatedPkg = { ...pkg };

    if (dataPermission) {
      updatedPkg.dataPermit = JSON.stringify({ rule: [{ type: permitType, value: 'y' }] });
    }

    if (actionPermission) {
      // 完全替换操作权限：先清空，只保留 operations 中值为 true 的项
      const newOperatePermit = {};
      for (const [key, enabled] of Object.entries(actionPermission.operations)) {
        if (enabled) {
          newOperatePermit[key] = 'y';
        }
      }
      updatedPkg.operatePermit = JSON.stringify(newOperatePermit);
    }

    // members 参数传给 savePermitPackage，null 表示不修改成员
    const overrideMembers = members || null;

    const saveResult = await requestWithAutoLogin(
      (auth) => savePermitPackage(appType, formUuid, updatedPkg, overrideMembers, auth),
      authRef
    );

    if (saveResult && saveResult.success) {
      console.error('    ✅ 更新成功');
    } else {
      console.error(`    ❌ 更新失败: ${saveResult && saveResult.errorMsg || t('common.unknown_error')}`);
      allSuccess = false;
    }
  }

  console.error('\n' + SEP);
  if (allSuccess) {
    console.error('  ✅ 权限配置保存成功！');
    console.error(SEP);
    const summary = {};
    if (dataPermission) {summary.dataPermission = `数据范围: ${dataPermission.dataRange}`;}
    if (actionPermission) {summary.actionPermission = `操作权限: ${Object.keys(actionPermission.operations).join(', ')}`;}
    if (members) {summary.members = `成员: ${members.join(', ')}`;}
    console.log(JSON.stringify({ success: true, summary, message: '权限配置已保存' }, null, 2));
  } else {
    console.error('  ❌ 部分权限组更新失败');
    console.error(SEP);
    process.exit(1);
  }
}

module.exports = { run };
