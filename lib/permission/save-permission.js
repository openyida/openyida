/**
 * save-permission.js - 宜搭表单权限配置保存命令
 *
 * 用法（更新已有权限组）：
 *   openyida save-permission <appType> <formUuid> --data-permission <json>
 *   openyida save-permission <appType> <formUuid> --action-permission <json>
 *   openyida save-permission <appType> <formUuid> --field-permission <json>
 *   openyida save-permission <appType> <formUuid> --members <userIds> --data-permission <json>
 *   openyida save-permission <appType> <formUuid> --matrix <json> --data-permission <json>
 *
 * 用法（新增权限组）：
 *   openyida save-permission <appType> <formUuid> --create --name <权限组名称> [--members <userIds>] [--data-permission <json>] [--action-permission <json>] [--field-permission <json>]
 *
 * --members 参数：指定权限组成员，多个钉钉 userId 用逗号分隔
 *   示例：--members "54255850977641,12345678901234"
 *   不传则保持原有成员配置不变（更新模式）或仅包含管理员（新增模式）
 * --all-members 参数：新增/更新权限组时设置为「全员可见」（roleType=DEFAULT, roleValue=ALL）
 * --matrix 参数：使用权限矩阵作为权限成员，JSON 格式 {"matrixId":"MATRIX-XXX","columnId":"column_YYY"}
 *   与 --members / --all-members 互斥
 * --confirm-member-replace 参数：确认 --all-members / --matrix 会替换复合 roleData
 *
 * 注意：--field-permission 透传宜搭 fieldPermit 原始 JSON，使用前建议先通过 get-permission 查看现有结构。
 */
'use strict';

const { CliError } = require('../core/cli-error');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { step, success, warn } = require('../core/chalk');

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
  SUBORDINATE: 'SUBORDINATE',
  SUBORDINATE_DEPARTMENT: 'SUBORDINATE_DEPARTMENT',
  FREE_LOGIN: 'FREE_LOGIN',
  CUSTOM_DEPARTMENT: 'CUSTOM_DEPARTMENT',
  FORMULA: 'FORMULA',
  MATRIX: 'MATRIX',
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

const VALID_TARGET_ROLES = ['DEFAULT', 'MANAGER', 'MATRIX'];
const VALID_FIELD_STATUS_VALUES = [
  'FORM_FIELD_VIEW',
  'FORM_FILED_EDIT',
  'FORM_FIELD_HIDDEN',
  'FORM_FIELD_ENCRYPT',
];
const MEMBER_REPLACE_WARNING_ROLES = new Set(['DEPARTMENT', 'ROLE', 'PARAM', 'MANAGER']);

function parseArgs(args) {
  if (args.length < 2) {
    throw new CliError([
      '用法: openyida save-permission <appType> <formUuid> [--create --name <名称>] [--data-permission <json>] [--action-permission <json>] [--field-permission <json>] [--members <userIds>] [--all-members] [--matrix <json>]',
      t('save_permission.confirm_member_replace_usage'),
      '示例（更新）: openyida save-permission APP_XXX FORM-XXX --data-permission \'{"role":"DEFAULT","dataRange":"SELF"}\'',
      '示例（新增全员）: openyida save-permission APP_XXX FORM-XXX --create --name "全部人员看全部数据" --all-members --data-permission \'{"dataRange":"ALL"}\'',
      '示例（新增指定人员）: openyida save-permission APP_XXX FORM-XXX --create --name "只读权限组" --members "54255850977641"',
      '示例（新增矩阵）: openyida save-permission APP_XXX FORM-XXX --create --name "矩阵权限组" --matrix \'{"matrixId":"MATRIX-XXX","columnId":"column_YYY"}\' --data-permission \'{"rule":[{"type":"ORIGINATOR","value":"y"},{"type":"MATRIX","value":"y"}]}\'',
    ].join('\n'), {
      code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
    });
  }

  const appType = args[0];
  const formUuid = args[1];
  let dataPermission = null;
  let actionPermission = null;
  let fieldPermission = null;
  let members = null;
  let allMembers = false;
  let matrix = null;
  let createMode = false;
  let groupName = null;
  let confirmMemberReplace = false;

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
        throw new CliError(`--data-permission 参数 JSON 解析失败: ${args[index + 1]}`, {
          code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
        });
      }
      index++;
    } else if (args[index] === '--action-permission' && args[index + 1]) {
      try {
        actionPermission = JSON.parse(args[index + 1]);
      } catch {
        throw new CliError(`--action-permission 参数 JSON 解析失败: ${args[index + 1]}`, {
          code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
        });
      }
      index++;
    } else if (args[index] === '--field-permission' && args[index + 1]) {
      try {
        fieldPermission = JSON.parse(args[index + 1]);
      } catch {
        throw new CliError(`--field-permission 参数 JSON 解析失败: ${args[index + 1]}`, {
          code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
        });
      }
      index++;
    } else if (args[index] === '--members' && args[index + 1]) {
      // 多个钉钉 userId 用逗号分隔，如 "54255850977641,12345678901234"
      members = args[index + 1].split(',').map((id) => id.trim()).filter(Boolean);
      index++;
    } else if (args[index] === '--all-members') {
      allMembers = true;
    } else if (args[index] === '--matrix' && args[index + 1]) {
      try {
        matrix = JSON.parse(args[index + 1]);
      } catch {
        throw new CliError(`--matrix 参数 JSON 解析失败: ${args[index + 1]}，格式: {"matrixId":"MATRIX-XXX","columnId":"column_YYY"}`, {
          code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
        });
      }
      index++;
    } else if (args[index] === '--confirm-member-replace') {
      confirmMemberReplace = true;
    }
  }

  if (createMode && !groupName) {
    throw new CliError('新增模式（--create）必须同时提供 --name <权限组名称>', {
      code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
    });
  }

  if (!createMode && !dataPermission && !actionPermission && !fieldPermission && !members && !allMembers && !matrix) {
    throw new CliError('请至少提供 --data-permission、--action-permission、--field-permission、--members 或 --matrix 参数之一', {
      code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
    });
  }

  return {
    appType,
    formUuid,
    dataPermission,
    actionPermission,
    fieldPermission,
    members,
    allMembers,
    matrix,
    createMode,
    groupName,
    confirmMemberReplace,
  };
}

function buildDataPermit(dataPermission) {
  if (dataPermission && Array.isArray(dataPermission.rule)) {
    const normalized = { ...dataPermission };
    delete normalized.role;
    return JSON.stringify(normalized);
  }
  const dataRange = (dataPermission && dataPermission.dataRange) || 'ALL';
  const permitType = DATA_RANGE_TO_PERMIT_TYPE[dataRange] || dataRange;
  const dataPermit = { rule: [{ type: permitType, value: 'y' }] };
  if (permitType === 'CUSTOM_DEPARTMENT' && dataPermission.customDepartmentData) {
    dataPermit.customDepartmentData = dataPermission.customDepartmentData;
  }
  if (permitType === 'FORMULA' && dataPermission.formulaData) {
    dataPermit.formulaData = dataPermission.formulaData;
  }
  return JSON.stringify(dataPermit);
}

function validateDataPermission(dataPermission) {
  if (!dataPermission || typeof dataPermission !== 'object' || Array.isArray(dataPermission)) {
    throw new Error(t('save_permission.data_object_required'));
  }
  if (dataPermission && Array.isArray(dataPermission.rule)) {
    if (dataPermission.rule.length === 0) {
      throw new Error(t('save_permission.data_rule_required'));
    }
    const validTypes = new Set(Object.values(DATA_RANGE_TO_PERMIT_TYPE));
    for (const item of dataPermission.rule) {
      if (!item || typeof item !== 'object' || !item.type) {
        throw new Error(t('save_permission.data_rule_type_required'));
      }
      if (!validTypes.has(item.type)) {
        throw new Error(
          `无效的 rule type: ${item.type}，有效值: ${Array.from(validTypes).join(', ')}`
        );
      }
      if (!['y', 'n', true, false].includes(item.value)) {
        throw new Error(t('save_permission.data_rule_value_invalid', item.type));
      }
    }
    const enabledTypes = new Set(dataPermission.rule
      .filter(item => item.value === 'y' || item.value === true)
      .map(item => item.type));
    if (enabledTypes.size === 0) {
      throw new Error(t('save_permission.data_enabled_required'));
    }
    if (enabledTypes.has('CUSTOM_DEPARTMENT')) {
      const ids = dataPermission.customDepartmentData && dataPermission.customDepartmentData.departmentIds;
      if (!Array.isArray(ids) || ids.filter(id => String(id || '').trim()).length === 0) {
        throw new Error(t('save_permission.custom_department_ids_required'));
      }
    }
    if (enabledTypes.has('FORMULA')) {
      const formulaData = dataPermission.formulaData;
      if (!formulaData || typeof formulaData !== 'object' || Array.isArray(formulaData) || Object.keys(formulaData).length === 0) {
        throw new Error(t('save_permission.formula_data_required'));
      }
    }
    return;
  }
  const validRanges = Object.keys(DATA_RANGE_TO_PERMIT_TYPE);
  if (!dataPermission.dataRange || typeof dataPermission.dataRange !== 'string') {
    throw new Error(t('save_permission.data_range_required'));
  }
  if (!validRanges.includes(dataPermission.dataRange)) {
    throw new Error(
      `无效的 dataRange: ${dataPermission.dataRange}，有效值: ${validRanges.join(', ')}`
    );
  }
  const permitType = DATA_RANGE_TO_PERMIT_TYPE[dataPermission.dataRange];
  if (permitType === 'CUSTOM_DEPARTMENT') {
    const ids = dataPermission.customDepartmentData && dataPermission.customDepartmentData.departmentIds;
    if (!Array.isArray(ids) || ids.filter(id => String(id || '').trim()).length === 0) {
      throw new Error(t('save_permission.custom_department_ids_required'));
    }
  }
  if (permitType === 'FORMULA') {
    const formulaData = dataPermission.formulaData;
    if (!formulaData || typeof formulaData !== 'object' || Array.isArray(formulaData) || Object.keys(formulaData).length === 0) {
      throw new Error(t('save_permission.formula_data_required'));
    }
  }
}

function validateMatrix(matrix) {
  if (!matrix || typeof matrix !== 'object') {
    throw new Error('--matrix 参数必须是 JSON 对象');
  }
  if (!matrix.matrixId || typeof matrix.matrixId !== 'string' || !matrix.matrixId.trim()) {
    throw new Error('--matrix 参数必须包含 matrixId 字符串');
  }
  if (!matrix.columnId || typeof matrix.columnId !== 'string' || !matrix.columnId.trim()) {
    throw new Error('--matrix 参数必须包含 columnId 字符串');
  }
}

function validateActionPermission(actionPermission) {
  if (!actionPermission.operations || typeof actionPermission.operations !== 'object' || Array.isArray(actionPermission.operations)) {
    throw new Error(
      '操作权限必须包含 operations 对象，格式为 {"OPERATE_VIEW": true, "OPERATE_EDIT": false, ...}'
    );
  }
  const operationEntries = Object.entries(actionPermission.operations);
  if (operationEntries.length === 0 || !operationEntries.some(([, enabled]) => enabled === true)) {
    throw new Error(t('save_permission.action_enabled_required'));
  }
  for (const [key, enabled] of operationEntries) {
    if (!VALID_OPERATE_KEYS.includes(key)) {
      throw new Error(
        `无效的操作权限 key: ${key}，有效值: ${VALID_OPERATE_KEYS.join(', ')}`
      );
    }
    if (typeof enabled !== 'boolean') {
      throw new Error(t('save_permission.action_value_boolean', key));
    }
  }
}

function normalizeFieldPermission(fieldPermission) {
  if (!fieldPermission || typeof fieldPermission !== 'object' || Array.isArray(fieldPermission)) {
    throw new Error('字段权限必须是对象格式的 fieldPermit JSON');
  }
  const normalized = fieldPermission.fieldPermit && typeof fieldPermission.fieldPermit === 'object' && !Array.isArray(fieldPermission.fieldPermit)
    ? { ...fieldPermission.fieldPermit }
    : { ...fieldPermission };
  delete normalized.role;
  if (!['FORM', 'CUSTOM'].includes(normalized.fieldRange)) {
    throw new Error(t('save_permission.field_range_invalid'));
  }
  if (normalized.fieldRange === 'CUSTOM') {
    if (!Array.isArray(normalized.fieldStatus) || normalized.fieldStatus.length === 0) {
      throw new Error(t('save_permission.field_status_required'));
    }
    for (const item of normalized.fieldStatus) {
      if (!item || typeof item !== 'object' || !item.label || !item.fieldName || !item.componentName) {
        throw new Error(t('save_permission.field_status_item_required'));
      }
      if (!VALID_FIELD_STATUS_VALUES.includes(item.value)) {
        throw new Error(t('save_permission.field_status_value_invalid', item.value, VALID_FIELD_STATUS_VALUES.join(', ')));
      }
    }
  }
  return normalized;
}

function parseObject(value, label) {
  if (!value) {
    return {};
  }
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(t('save_permission.json_object_required', label));
    }
    return parsed;
  } catch (error) {
    throw new Error(t('save_permission.parse_failed', label, error.message));
  }
}

function resolveTargetRole({ dataPermission, actionPermission, fieldPermission, matrix, allMembers }) {
  const requestedRoles = [dataPermission, actionPermission, fieldPermission]
    .map(permission => permission && permission.role)
    .filter(Boolean);
  const uniqueRoles = [...new Set(requestedRoles)];
  if (uniqueRoles.length > 1) {
    throw new Error(t('save_permission.role_conflict', uniqueRoles.join(', ')));
  }
  let targetRole = uniqueRoles[0] || 'DEFAULT';
  if (matrix) {
    if (uniqueRoles.length > 0 && targetRole !== 'MATRIX') {
      throw new Error(t('save_permission.matrix_role_only'));
    }
    targetRole = 'MATRIX';
  } else if (allMembers) {
    if (uniqueRoles.length > 0 && targetRole !== 'DEFAULT') {
      throw new Error(t('save_permission.all_members_role_only'));
    }
    targetRole = 'DEFAULT';
  }
  if (!VALID_TARGET_ROLES.includes(targetRole)) {
    throw new Error(t('save_permission.target_role_invalid', targetRole, VALID_TARGET_ROLES.join(', ')));
  }
  return targetRole;
}

function getRoleEntries(permitPackage) {
  const roleData = parseObject(permitPackage.roleData || { include: [] }, 'roleData');
  return Array.isArray(roleData.include) ? roleData.include : [];
}

function getPackageRoleTypes(permitPackage) {
  const roleMemberTypes = (permitPackage.roleMembers || []).map(item => item && item.roleType).filter(Boolean);
  const roleDataTypes = getRoleEntries(permitPackage).map(item => item && item.roleType).filter(Boolean);
  return new Set([...roleMemberTypes, ...roleDataTypes]);
}

function packageLabel(permitPackage) {
  const name = permitPackage.packageName;
  const readableName = typeof name === 'string'
    ? name
    : name && (name.zh_CN || name.en_US) || t('save_permission.unnamed_package');
  return `${readableName} (${permitPackage.packageUuid || t('save_permission.missing_package_uuid')})`;
}

function assertUniqueTarget(packages, targetRole) {
  const matches = packages.filter(pkg => getPackageRoleTypes(pkg).has(targetRole));
  if (matches.length === 1) {
    return matches[0];
  }
  const candidates = (matches.length > 0 ? matches : packages).map(packageLabel);
  throw new CliError(
    t(
      matches.length === 0 ? 'save_permission.target_no_match' : 'save_permission.target_ambiguous',
      targetRole,
      matches.length,
      candidates.map(item => `- ${item}`).join('\n')
    ),
    {
      code: matches.length === 0 ? 'SAVE_PERMISSION_NO_MATCHING_PACKAGE' : 'SAVE_PERMISSION_AMBIGUOUS_PACKAGE',
      details: { targetRole, candidates },
    }
  );
}

function assertNoUnknownOperateKeys(permitPackage) {
  const current = parseObject(permitPackage.operatePermit, 'operatePermit');
  const unknownKeys = Object.keys(current).filter(key => !VALID_OPERATE_KEYS.includes(key));
  if (unknownKeys.length > 0) {
    throw new CliError(
      t('save_permission.unknown_operate_keys', unknownKeys.join(', ')),
      {
        code: 'SAVE_PERMISSION_UNKNOWN_OPERATE_KEYS',
        details: { packageUuid: permitPackage.packageUuid, unknownKeys },
      }
    );
  }
}

function buildRequestedRoleData(permitPackage, { members, allMembers, matrix }) {
  const beforeEntries = getRoleEntries(permitPackage);
  let afterEntries = beforeEntries;
  if (members) {
    afterEntries = beforeEntries.filter(entry => entry.roleType !== 'PERSONS');
    if (members.length > 0) {
      afterEntries = afterEntries.concat({ roleType: 'PERSONS', roleValue: members.join(',') });
    }
  } else if (allMembers) {
    afterEntries = [{ roleType: 'DEFAULT', roleValue: 'ALL' }];
  } else if (matrix) {
    afterEntries = [{
      roleType: 'MATRIX',
      roleValue: [{ matrixId: matrix.matrixId, columnId: matrix.columnId }],
    }];
  }
  const afterSerialized = afterEntries.map(entry => JSON.stringify(entry));
  const removedEntries = beforeEntries.filter(entry => !afterSerialized.includes(JSON.stringify(entry)));
  return {
    before: { include: beforeEntries },
    after: { include: afterEntries },
    removedEntries,
  };
}

function validateMatrixConsistency(permitPackage) {
  const roleEntries = getRoleEntries(permitPackage);
  const matrixRoles = roleEntries.filter(entry => entry.roleType === 'MATRIX');
  for (const entry of matrixRoles) {
    if (!Array.isArray(entry.roleValue) || entry.roleValue.length === 0) {
      throw new Error(t('save_permission.matrix_role_value_required'));
    }
    for (const selection of entry.roleValue) {
      validateMatrix(selection);
    }
  }
  const dataPermit = parseObject(permitPackage.dataPermit, 'dataPermit');
  const enabledTypes = new Set((Array.isArray(dataPermit.rule) ? dataPermit.rule : [])
    .filter(item => item && (item.value === 'y' || item.value === true))
    .map(item => item.type));
  if (matrixRoles.length > 0 && !enabledTypes.has('MATRIX')) {
    throw new Error(t('save_permission.matrix_data_required'));
  }
  if (enabledTypes.has('MATRIX') && matrixRoles.length === 0) {
    throw new Error(t('save_permission.data_matrix_member_required'));
  }
}

/**
 * 查询权限组列表
 * 接口：GET /{appType}/permission/manage/listPermitPackages.json
 */
function fetchPermitPackages(appType, formUuid, authRef) {
  return createYidaClient({ authRef }).get(
    `/${appType}/permission/manage/listPermitPackages.json`,
    {
      _api: 'Permission.getPermitGroupList',
      _mock: 'false',
      _locale_time_zone_offset: '28800000',
      formUuid,
      packageName: '',
      packageType: 'FORM_PACKAGE_VIEW',
      pageIndex: '1',
      pageSize: '20',
      appType,
      _stamp: String(Date.now()),
    }
  );
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
  return createYidaClient({ authRef }).postForm(
    `/${appType}/permission/manage/saveOrUpdatePermit.json?_api=Permission.saveOrUpdatePermitGroup&_mock=false&_stamp=${Date.now()}`,
    () => {
      // 新增模式：permitPackage.roleData 已经是构建好的字符串，直接使用
      // 更新模式：通过 buildRoleData 处理 overrideMembers
      const roleDataStr = permitPackage.roleData && !overrideMembers
        ? (typeof permitPackage.roleData === 'string' ? permitPackage.roleData : JSON.stringify(permitPackage.roleData))
        : JSON.stringify(buildRoleData(permitPackage, overrideMembers));

      const postParams = {
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

      return postParams;
    }
  );
}

async function run(args) {
  const {
    appType,
    formUuid,
    dataPermission,
    actionPermission,
    fieldPermission,
    members,
    allMembers,
    matrix,
    createMode,
    groupName,
    confirmMemberReplace,
  } = parseArgs(args);

  warn(SEP);
  warn('  save-permission - 宜搭表单权限配置保存');
  warn(SEP);
  warn(`\n  应用 ID:   ${appType}`);
  warn(`  表单 UUID: ${formUuid}`);
  if (createMode) {
    warn(`  模式:      新增权限组（${groupName}）`);
  }

  let normalizedFieldPermission = null;
  let targetRole = null;

  // Step 0: 参数校验
  warn('\n📋 Step 0: 验证参数');
  try {
    if (matrix && (members || allMembers)) {
      throw new Error('--matrix 与 --members / --all-members 互斥，请勿同时指定');
    }
    if (members && allMembers) {
      throw new Error(t('save_permission.members_all_conflict'));
    }
    targetRole = resolveTargetRole({ dataPermission, actionPermission, fieldPermission, matrix, allMembers });
    if (dataPermission) {
      validateDataPermission(dataPermission);
      warn(`  ✅ 数据权限验证通过（dataRange: ${dataPermission.dataRange || 'ALL'}）`);
    }
    if (matrix) {
      validateMatrix(matrix);
      warn(`  ✅ 权限矩阵验证通过（matrixId: ${matrix.matrixId}, columnId: ${matrix.columnId}）`);
    }
    if (actionPermission) {
      validateActionPermission(actionPermission);
      warn('  ✅ 操作权限验证通过');
    }
    if (fieldPermission) {
      normalizedFieldPermission = normalizeFieldPermission(fieldPermission);
      warn('  ✅ 字段权限验证通过');
    }
    if (members) {
      warn(`  ✅ 成员列表验证通过（${members.length} 人: ${members.join(', ')}）`);
    }
  } catch (err) {
    warn(`  ❌ 参数验证失败: ${err.message}`);
    throw new CliError(`参数验证失败: ${err.message}`, {
      code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
    });
  }

  // Step 1: 读取登录态
  step(1, t('common.step_login', 1));
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError(t('common.login_no_cache'), {
      code: 'NEED_LOGIN',
    });
  }
  success(t('common.login_ready', authRef.baseUrl));

  // ── 新增权限组模式 ──────────────────────────────────────────────────────────
  if (createMode) {
    warn('\n➕ Step 2: 新增权限组');

    // 构建新权限组数据
    const dataRange = (dataPermission && dataPermission.dataRange) || 'ALL';
    const permitType = DATA_RANGE_TO_PERMIT_TYPE[dataRange] || dataRange;
    const dataPermitStr = buildDataPermit(dataPermission);

    const newOperatePermit = {};
    if (actionPermission) {
      for (const [key, enabled] of Object.entries(actionPermission.operations)) {
        if (enabled) {newOperatePermit[key] = 'y';}
      }
    } else {
      // 默认只给查看权限
      newOperatePermit['OPERATE_VIEW'] = 'y';
    }

    // 构建 roleData：--matrix / --all-members / --members / 默认管理员 四选一
    let roleInclude;
    if (matrix) {
      roleInclude = [{ roleType: 'MATRIX', roleValue: [{ matrixId: matrix.matrixId, columnId: matrix.columnId }] }];
    } else if (allMembers) {
      roleInclude = [{ roleType: 'DEFAULT', roleValue: 'ALL' }];
    } else if (members && members.length > 0) {
      roleInclude = [
        { roleType: 'MANAGER', roleValue: 'appMainAdminRole,corpAdminRole' },
        { roleType: 'PERSONS', roleValue: members.join(',') },
      ];
    } else {
      roleInclude = [{ roleType: 'MANAGER', roleValue: 'appMainAdminRole,corpAdminRole' }];
    }

    const newPkg = {
      packageType: 'FORM_PACKAGE_VIEW',
      packageName: { zh_CN: groupName, en_US: groupName, type: 'i18n' },
      description: { zh_CN: groupName, en_US: groupName, type: 'i18n' },
      roleData: JSON.stringify({ include: roleInclude }),
      dataPermit: dataPermitStr,
      operatePermit: JSON.stringify(newOperatePermit),
      customButtonPermit: '[]',
      fieldPermit: JSON.stringify(normalizedFieldPermission || { fieldRange: 'FORM' }),
      viewData: JSON.stringify({ all: 'y', viewUuids: [] }),
      // 不传 packageUuid → 服务端创建新权限组
    };

    try {
      validateMatrixConsistency(newPkg);
    } catch (error) {
      throw new CliError(t('save_permission.invalid_arguments', error.message), {
        code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
      });
    }

    warn(`  → 权限组名称: ${groupName}`);
    if (dataPermission && Array.isArray(dataPermission.rule)) {
      warn(`  → 数据范围: 自定义规则（${dataPermission.rule.length} 条）`);
    } else {
      warn(`  → 数据范围: ${dataRange} → ${permitType}`);
    }
    warn(`  → 操作权限: ${Object.keys(newOperatePermit).join(', ') || '（无）'}`);
    if (normalizedFieldPermission) {warn('  → 字段权限: 自定义 fieldPermit');}
    if (matrix) {
      warn(`  → 权限矩阵: ${matrix.matrixId} / ${matrix.columnId}`);
    } else if (members) {
      warn(`  → 成员: ${members.join(', ')}`);
    }

    const createResult = await savePermitPackage(appType, formUuid, newPkg, null, authRef);

    warn('\n' + SEP);
    if (createResult && createResult.success) {
      const newPackageUuid = createResult.content || '';
      warn('  ✅ 权限组新增成功！');
      warn(SEP);
      const dataPermissionSummary = (dataPermission && Array.isArray(dataPermission.rule))
        ? `数据范围: 自定义规则（${dataPermission.rule.length} 条）`
        : `数据范围: ${dataRange}`;
      let membersSummary;
      if (matrix) {
        membersSummary = `权限矩阵: ${matrix.matrixId} / ${matrix.columnId}`;
      } else if (allMembers) {
        membersSummary = '成员: 全员';
      } else if (members) {
        membersSummary = `成员: ${members.join(', ')}`;
      } else {
        membersSummary = '仅管理员';
      }
      console.log(JSON.stringify({
        success: true,
        packageUuid: newPackageUuid,
        summary: {
          name: groupName,
          dataPermission: dataPermissionSummary,
          actionPermission: `操作权限: ${Object.keys(newOperatePermit).join(', ') || '（无）'}`,
          fieldPermission: normalizedFieldPermission ? '自定义 fieldPermit' : '全部字段',
          members: membersSummary,
        },
        message: '权限组已新增',
      }, null, 2));
    } else {
      warn(`  ❌ 新增失败: ${createResult && createResult.errorMsg || t('common.unknown_error')}`);
      warn(SEP);
      throw new CliError(createResult && createResult.errorMsg || t('common.unknown_error'), {
        code: createResult && createResult.__needLogin ? 'NEED_LOGIN' : 'SAVE_PERMISSION_CREATE_FAILED',
        details: createResult || { success: false },
      });
    }
    return;
  }

  // ── 更新已有权限组模式 ──────────────────────────────────────────────────────
  warn('\n📋 Step 2: 获取当前权限组列表');

  const listResult = await fetchPermitPackages(appType, formUuid, authRef);

  if (!listResult || !listResult.success) {
    warn(`  ❌ 获取权限组失败: ${listResult && listResult.errorMsg || t('common.unknown_error')}`);
    throw new CliError(listResult && listResult.errorMsg || t('common.unknown_error'), {
      code: listResult && listResult.__needLogin ? 'NEED_LOGIN' : 'SAVE_PERMISSION_LIST_FAILED',
      details: listResult || { success: false },
    });
  }

  const packages = (listResult.content && listResult.content.formPermit) || [];
  if (packages.length === 0) {
    warn('  ⚠️  未找到任何权限组');
    throw new CliError('未找到任何权限组', {
      code: 'SAVE_PERMISSION_NO_PACKAGES',
    });
  }
  warn(`  ✅ 获取到 ${packages.length} 个权限组`);

  if (packages.length >= 20) {
    const candidates = packages.map(packageLabel);
    throw new CliError(
      t('save_permission.query_limit', candidates.map(item => `- ${item}`).join('\n')),
      {
        code: 'SAVE_PERMISSION_QUERY_LIMIT_REACHED',
        details: { pageSize: 20, candidates },
      }
    );
  }

  const targetPackage = assertUniqueTarget(packages, targetRole);
  warn(t('save_permission.unique_target', packageLabel(targetPackage)));

  if (actionPermission) {
    assertNoUnknownOperateKeys(targetPackage);
  }

  const roleChange = buildRequestedRoleData(targetPackage, { members, allMembers, matrix });
  const memberDimensionChanged = !!(members || allMembers || matrix);
  if (memberDimensionChanged) {
    warn(t('save_permission.member_before', JSON.stringify(roleChange.before)));
    warn(t('save_permission.member_after', JSON.stringify(roleChange.after)));
    if (roleChange.removedEntries.length > 0) {
      warn(t('save_permission.member_removed', JSON.stringify(roleChange.removedEntries)));
    }
    const removesWarningRole = roleChange.removedEntries.some(entry => MEMBER_REPLACE_WARNING_ROLES.has(entry.roleType));
    const replacesCompositeRoleData = (allMembers || matrix) && roleChange.before.include.length > 1;
    if ((removesWarningRole || replacesCompositeRoleData) && !confirmMemberReplace) {
      throw new CliError(
        t('save_permission.member_replace_confirm', JSON.stringify(roleChange.removedEntries)),
        {
          code: 'SAVE_PERMISSION_MEMBER_REPLACE_CONFIRM_REQUIRED',
          details: roleChange,
        }
      );
    }
  }

  // Step 3: 逐个更新权限组
  let permitType = null;
  const stepParts = [];
  if (dataPermission) {
    if (Array.isArray(dataPermission.rule)) {
      stepParts.push(`数据权限: 自定义规则（${dataPermission.rule.length} 条）`);
    } else {
      permitType = DATA_RANGE_TO_PERMIT_TYPE[dataPermission.dataRange] || dataPermission.dataRange;
      stepParts.push(`数据权限: ${dataPermission.dataRange} → ${permitType}`);
    }
  }
  if (actionPermission) {
    stepParts.push('操作权限: 同步更新');
  }
  if (normalizedFieldPermission) {
    stepParts.push('字段权限: 同步更新');
  }
  if (matrix) {
    stepParts.push(`权限矩阵: ${matrix.matrixId} / ${matrix.columnId}`);
  }
  if (members) {
    stepParts.push(`成员: ${members.join(', ')}`);
  }
  warn(`\n💾 Step 3: 更新权限组（${stepParts.join('，')}）`);

  const pkg = targetPackage;
  const pkgName = pkg.packageName && (pkg.packageName.zh_CN || pkg.packageName.en_US || '未命名');
  warn(`  → 更新权限组: ${pkgName} (${pkg.packageUuid})`);

  const updatedPkg = { ...pkg };

  if (dataPermission) {
    updatedPkg.dataPermit = buildDataPermit(dataPermission);
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

  if (normalizedFieldPermission) {
    updatedPkg.fieldPermit = JSON.stringify(normalizedFieldPermission);
  }

  if (memberDimensionChanged) {
    updatedPkg.roleData = JSON.stringify(roleChange.after);
  }

  try {
    validateMatrixConsistency(updatedPkg);
  } catch (error) {
    throw new CliError(t('save_permission.invalid_arguments', error.message), {
      code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
    });
  }

  const saveResult = await savePermitPackage(appType, formUuid, updatedPkg, null, authRef);

  const allSuccess = !!(saveResult && saveResult.success);
  if (allSuccess) {
    warn('    ✅ 更新成功');
  } else {
    warn(`    ❌ 更新失败: ${saveResult && saveResult.errorMsg || t('common.unknown_error')}`);
  }

  warn('\n' + SEP);
  if (allSuccess) {
    warn('  ✅ 权限配置保存成功！');
    warn(SEP);
    const summary = {};
    if (dataPermission) {summary.dataPermission = `数据范围: ${dataPermission.dataRange}`;}
    if (actionPermission) {summary.actionPermission = `操作权限: ${Object.keys(actionPermission.operations).join(', ')}`;}
    if (normalizedFieldPermission) {summary.fieldPermission = '字段权限已更新';}
    if (members) {summary.members = `成员: ${members.join(', ')}`;}
    console.log(JSON.stringify({ success: true, summary, message: '权限配置已保存' }, null, 2));
  } else {
    warn('  ❌ 部分权限组更新失败');
    warn(SEP);
    throw new CliError('部分权限组更新失败', {
      code: 'SAVE_PERMISSION_UPDATE_FAILED',
    });
  }
}

module.exports = {
  VALID_OPERATE_KEYS,
  run,
  parseArgs,
  validateDataPermission,
  validateActionPermission,
  validateMatrix,
  normalizeFieldPermission,
  resolveTargetRole,
  assertUniqueTarget,
  assertNoUnknownOperateKeys,
  buildRequestedRoleData,
  validateMatrixConsistency,
  buildDataPermit,
  fetchPermitPackages,
  buildRoleData,
  savePermitPackage,
};
