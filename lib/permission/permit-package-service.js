/**
 * FORM_PACKAGE_VIEW 权限组的安全分页读取。
 */

'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { createYidaClient } = require('../core/yida-client');

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 50;

function fetchPermitPackagePage(appType, formUuid, authRef, pageIndex = 1, pageSize = DEFAULT_PAGE_SIZE) {
  return createYidaClient({ authRef }).get(
    `/${appType}/permission/manage/listPermitPackages.json`,
    {
      _api: 'Permission.getPermitGroupList',
      _mock: 'false',
      _locale_time_zone_offset: '28800000',
      formUuid,
      packageName: '',
      packageType: 'FORM_PACKAGE_VIEW',
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
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages || DEFAULT_MAX_PAGES;
  const packages = [];
  const seenUuids = new Set();

  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    const page = unwrapPermitPackagePage(
      await fetchPermitPackagePage(appType, formUuid, authRef, pageIndex, pageSize)
    );
    for (const permitPackage of page) {
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
};
