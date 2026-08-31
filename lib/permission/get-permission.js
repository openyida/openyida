/**
 * get-permission.js - 宜搭表单权限配置查询命令
 *
 * 用法：openyida get-permission <appType> <formUuid> [--package-uuid <packageUuid>]
 */

'use strict';

const { CliError } = require('../core/cli-error');
const { createAuthRef, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { step, success, warn } = require('../core/chalk');
const {
  DEFAULT_PAGE_SIZE,
  fetchPermitPackagePage,
  fetchAllPermitPackages,
} = require('./permit-package-service');

const SEP = '='.repeat(50);

/**
 * 查询权限组列表
 * 接口：GET /{appType}/permission/manage/listPermitPackages.json
 */
function fetchPermitPackages(appType, formUuid, authRef, pageIndex = 1, pageSize = DEFAULT_PAGE_SIZE) {
  return fetchPermitPackagePage(appType, formUuid, authRef, pageIndex, pageSize);
}

function parseArgs(args) {
  if (args.length < 2) {
    throw new CliError(`${t('cli.get_permission_usage')}\n${t('cli.get_permission_example')}`, {
      code: 'GET_PERMISSION_INVALID_ARGUMENTS',
    });
  }
  const parsed = { appType: args[0], formUuid: args[1], packageUuid: null };
  for (let index = 2; index < args.length; index++) {
    if (args[index] === '--json') {
      continue;
    } else if (args[index] === '--package-uuid' && args[index + 1]) {
      parsed.packageUuid = args[index + 1];
      index++;
    } else {
      throw new CliError(t('permission_common.unsupported_argument', args[index]), {
        code: 'GET_PERMISSION_INVALID_ARGUMENTS',
      });
    }
  }
  return parsed;
}

/**
 * 将权限组列表格式化为可读的权限配置摘要
 */
function formatPermissions(packages) {
  return packages.map((pkg) => {
    const packageName = pkg.packageName
      ? (pkg.packageName.zh_CN || pkg.packageName.en_US || JSON.stringify(pkg.packageName))
      : '未命名';
    const description = pkg.description
      ? (pkg.description.zh_CN || pkg.description.en_US || '')
      : '';

    const roleMembers = (pkg.roleMembers || []).map((rm) => ({
      roleType: rm.roleType,
      label: rm.label,
      roleValue: rm.roleValue,
    }));

    let roleData = { include: [] };
    if (pkg.roleData) {
      try {
        roleData = typeof pkg.roleData === 'string' ? JSON.parse(pkg.roleData) : pkg.roleData;
      } catch { roleData = { include: [] }; }
    }

    let dataPermit = {};
    if (pkg.dataPermit) {
      try {
        dataPermit = typeof pkg.dataPermit === 'string' ? JSON.parse(pkg.dataPermit) : pkg.dataPermit;
      } catch { dataPermit = {}; }
    }

    let operatePermit = {};
    if (pkg.operatePermit) {
      try {
        operatePermit = typeof pkg.operatePermit === 'string' ? JSON.parse(pkg.operatePermit) : pkg.operatePermit;
      } catch { operatePermit = {}; }
    }

    let fieldPermit = {};
    if (pkg.fieldPermit) {
      try {
        fieldPermit = typeof pkg.fieldPermit === 'string' ? JSON.parse(pkg.fieldPermit) : pkg.fieldPermit;
      } catch { fieldPermit = {}; }
    }

    return {
      packageUuid: pkg.packageUuid,
      packageName,
      description,
      packageType: pkg.packageType,
      roleMembers,
      roleData,
      dataPermit,
      operatePermit,
      fieldPermit,
    };
  });
}

async function run(args) {
  const { appType, formUuid, packageUuid } = parseArgs(args);

  warn(SEP);
  warn('  get-permission - 宜搭表单权限配置查询');
  warn(SEP);
  warn(`\n  应用 ID:   ${appType}`);
  warn(`  表单 UUID: ${formUuid}`);

  // Step 1: 读取登录态
  step(1, t('common.step_login', 1));
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError(t('common.login_no_cache'), {
      code: 'NEED_LOGIN',
    });
  }
  success(t('common.login_ready', authRef.baseUrl));

  // Step 2: 查询权限组列表
  warn('\n📋 Step 2: 查询权限组列表');
  warn('  发送 listPermitPackages 请求...');

  let queryResult;
  try {
    queryResult = await fetchAllPermitPackages(appType, formUuid, authRef);
  } catch (error) {
    throw new CliError(error.message, {
      code: error && error.code === 'NEED_LOGIN' ? 'NEED_LOGIN' : 'GET_PERMISSION_FAILED',
      details: { causeCode: error && error.code || null },
    });
  }
  const packages = packageUuid
    ? queryResult.packages.filter(pkg => pkg && pkg.packageUuid === packageUuid)
    : queryResult.packages;

  warn('\n' + SEP);
  warn(t('permission_list.query_success', packages.length));
  warn(SEP);
  const output = {
    success: true,
    totalPackages: packages.length,
    query: {
      packageType: 'FORM_PACKAGE_VIEW',
      packageUuid,
      pageIndex: 1,
      pageSize: queryResult.pageSize,
      pagesFetched: queryResult.pagesFetched,
      returned: packages.length,
      totalFetched: queryResult.packages.length,
      mayHaveMore: false,
      complete: true,
    },
    permissions: formatPermissions(packages),
    message: t('permission_list.query_success_message'),
  };
  console.log(JSON.stringify(output, null, 2));
  return output;
}

module.exports = {
  run,
  parseArgs,
  fetchPermitPackages,
  fetchAllPermitPackages,
  formatPermissions,
};
