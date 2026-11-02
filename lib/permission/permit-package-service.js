// 权限组分页与成员规则还原。

'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { createYidaClient } = require('../core/yida-client');
const { START, normalizePackageType } = require('./package-type');

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 50;

const SIMPLE_ROLE_TYPES = new Set(['PERSONS', 'ROLE', 'MANAGER', 'DEFAULT', 'ALL', 'ORIGINATOR', 'DEPARTMENT', 'PARAM']);

function parse(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validEntry(entry) {
  return isObject(entry) && typeof entry.roleType === 'string' && entry.roleType.length > 0
    && (typeof entry.roleValue === 'string' || Array.isArray(entry.roleValue));
}

function validRules(rules) {
  return isObject(rules) && Array.isArray(rules.include) && rules.include.every(validEntry)
    && (rules.exclude === undefined || Array.isArray(rules.exclude) && rules.exclude.every(validEntry));
}

function convertMatrixValue(value) {
  if (!isObject(value)) { return null; }
  if (typeof value.matrixId === 'string' && value.matrixId
    && typeof value.columnId === 'string' && value.columnId) { return { ...value }; }
  const ext = parse(value.ext);
  // MatrixAuth: key + ext.columnId.
  if (typeof value.key === 'string' && value.key && isObject(ext)
    && typeof ext.columnId === 'string' && ext.columnId
    && Object.keys(ext).every(key => key === 'columnId')
    && Object.keys(value).every(key => ['key', 'label', 'ext'].includes(key))) {
    return { matrixId: value.key, columnId: ext.columnId };
  }
  return null;
}

function convertMember(member) {
  if (!validEntry(member)) { return null; }
  const entry = { ...member };
  delete entry.label;
  if (member.roleType === 'MATRIX') {
    if (!Array.isArray(member.roleValue) || !member.roleValue.length) { return null; }
    const roleValue = member.roleValue.map(convertMatrixValue);
    return roleValue.every(value => value !== null) ? { ...entry, roleValue } : null;
  }
  if (!SIMPLE_ROLE_TYPES.has(member.roleType)) { return null; }
  if (typeof member.roleValue === 'string') { return entry; }
  const keys = [];
  for (const value of member.roleValue) {
    // 未知值级规则不得丢弃。
    const ext = value && parse(value.ext);
    if (!isObject(value) || typeof value.key !== 'string' || !value.key || value.key.includes(',')
      || Object.keys(value).some(key => !['key', 'label', 'ext'].includes(key))
      || value.ext !== undefined && value.ext !== null && value.ext !== ''
        && (!isObject(ext) || Object.keys(ext).length > 0)) { return null; }
    keys.push(value.key);
  }
  return { ...entry, roleValue: keys.join(',') };
}

function normalizeRoleData(pkg) {
  if (pkg.roleData !== undefined && pkg.roleData !== null && pkg.roleData !== '') {
    // 原始规则无效时不得回退成员列表。
    return { roleData: pkg.roleData, roleDataComplete: pkg.roleDataComplete !== false && validRules(parse(pkg.roleData)) };
  }
  const members = parse(pkg.roleMembers);
  // 数组表示 include；对象保留 exclude 与扩展。
  const rules = Array.isArray(members) ? { include: members } : members;
  if (!validRules(rules)) { return { roleDataComplete: false }; }
  const roleData = { ...rules };
  for (const key of ['include', 'exclude']) {
    if (rules[key] === undefined) { continue; }
    roleData[key] = rules[key].map(convertMember);
    if (roleData[key].some(member => member === null)) { return { roleDataComplete: false }; }
  }
  return { roleData, roleDataComplete: pkg.roleDataComplete !== false };
}

// 旧 DTO 类型为空时使用查询类型。
function normalizeListedPackage(pkg, packageType) {
  if (!pkg || typeof pkg !== 'object') { return pkg; }
  const normalized = { ...pkg };
  if (pkg.packageType === '') { normalized.packageType = packageType; }
  return { ...normalized, ...normalizeRoleData(pkg) };
}

function fetchPermitPackagePage(appType, formUuid, authRef, pageIndex = 1, pageSize = DEFAULT_PAGE_SIZE, packageType) {
  return createYidaClient({ authRef }).get(
    `/${appType}/permission/manage/listPermitPackages.json`,
    {
      _api: 'Permission.getPermitGroupList',
      _mock: 'false',
      _locale_time_zone_offset: '28800000',
      formUuid,
      packageName: '',
      packageType: normalizePackageType(packageType),
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      appType,
      _stamp: String(Date.now()),
    }
  );
}

function unwrapPermitPackagePage(result) {
  if (!result || result.__needLogin || result.success === false) {
    throw new CliError(result && result.errorMsg || t('permission_list.query_failed'), {
      code: result && result.__needLogin ? 'NEED_LOGIN' : 'PERMISSION_LIST_FAILED',
      details: {
        errorCode: result && result.errorCode || null,
        needLogin: !!(result && result.__needLogin),
      },
    });
  }
  const packages = result.content && result.content.formPermit;
  if (packages === undefined || packages === null) {
    return [];
  }
  if (!Array.isArray(packages)) {
    throw new CliError(t('permission_list.invalid_structure'), {
      code: 'PERMISSION_LIST_INVALID',
      details: { contentType: typeof packages },
    });
  }
  return packages;
}

async function fetchAllPermitPackages(appType, formUuid, authRef, options = {}) {
  const packageType = normalizePackageType(options.packageType);
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages || DEFAULT_MAX_PAGES;
  const packages = [];
  const seenUuids = new Set();

  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    const page = unwrapPermitPackagePage(
      await fetchPermitPackagePage(appType, formUuid, authRef, pageIndex, pageSize, packageType)
    );
    for (const rawPackage of page) {
      const permitPackage = normalizeListedPackage(rawPackage, packageType);
      if ((packageType === START || permitPackage && permitPackage.packageType)
        && (!permitPackage || permitPackage.packageType !== packageType)) {
        throw new CliError(t('permission_common.package_type_invalid'), {
          code: 'PERMISSION_PACKAGE_TYPE_MISMATCH', details: { expected: packageType, actual: permitPackage && permitPackage.packageType },
        });
      }
      const packageUuid = permitPackage && permitPackage.packageUuid;
      if (packageUuid) {
        if (seenUuids.has(packageUuid)) {
          throw new CliError(t('permission_list.duplicate_uuid', packageUuid), {
            code: 'PERMISSION_LIST_DUPLICATE_UUID',
            details: { packageUuid, pageIndex },
          });
        }
        seenUuids.add(packageUuid);
      }
      packages.push(permitPackage);
    }
    if (page.length < pageSize) {
      return { packages, pageSize, pagesFetched: pageIndex, complete: true };
    }
  }

  throw new CliError(t('permission_list.pagination_limit', maxPages), {
    code: 'PERMISSION_LIST_INCOMPLETE',
    details: { pageSize, maxPages, returned: packages.length },
  });
}

module.exports = {
  DEFAULT_MAX_PAGES,
  DEFAULT_PAGE_SIZE,
  fetchPermitPackagePage,
  fetchAllPermitPackages,
  unwrapPermitPackagePage,
  normalizeListedPackage,
};
