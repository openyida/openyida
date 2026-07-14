/**
 * get-permission.js - 宜搭表单权限配置查询命令
 *
 * 用法：openyida get-permission <appType> <formUuid>
 */

'use strict';

const { CliError } = require('../core/cli-error');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { step, success, warn } = require('../core/chalk');

const SEP = '='.repeat(50);

/**
 * 查询权限组列表
 * 接口：GET /{appType}/permission/manage/listPermitPackages.json
 */
function fetchPermitPackages(appType, formUuid, authRef) {
  return createYidaClient({ authRef }).get(
    `/${appType}/permission/manage/listPermitPackages.json`,
    auth => ({
      _api: 'Permission.getPermitGroupList',
      _mock: 'false',
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: '28800000',
      formUuid,
      packageName: '',
      packageType: 'FORM_PACKAGE_VIEW',
      pageIndex: '1',
      pageSize: '20',
      appType,
      _stamp: String(Date.now()),
    })
  );
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
      dataPermit,
      operatePermit,
      fieldPermit,
    };
  });
}

async function run(args) {
  if (args.length < 2) {
    throw new CliError('用法: openyida get-permission <appType> <formUuid>\n示例: openyida get-permission APP_XXX FORM-XXX', {
      code: 'GET_PERMISSION_INVALID_ARGUMENTS',
    });
  }

  const [appType, formUuid] = args;

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

  const result = await fetchPermitPackages(appType, formUuid, authRef);

  warn('\n' + SEP);
  if (result && result.success) {
    const packages = (result.content && result.content.formPermit) || [];
    warn(`  ✅ 权限配置查询成功！共 ${packages.length} 个权限组`);
    warn(SEP);
    console.log(JSON.stringify({
      success: true,
      totalPackages: packages.length,
      permissions: formatPermissions(packages),
      message: '权限配置查询成功',
    }, null, 2));
  } else {
    const errorMsg = result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed');
    warn(`  ❌ 查询失败: ${errorMsg}`);
    warn(SEP);
    throw new CliError(errorMsg, {
      code: result && result.__needLogin ? 'NEED_LOGIN' : 'GET_PERMISSION_FAILED',
      details: result || { success: false, errorMsg },
    });
  }
}

module.exports = {
  run,
  fetchPermitPackages,
  formatPermissions,
};
