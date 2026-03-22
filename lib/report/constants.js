'use strict';

// ── 图表类型映射 ──────────────────────────────────────

const CHART_COMPONENT_MAP = {
  bar:       'YoushuGroupedBarChart',      // 柱状图（分组）
  line:      'YoushuLineChart',            // 折线图
  pie:       'YoushuPieChart',             // 饼图
  funnel:    'YoushuFunnelChart',          // 漏斗图
  gauge:     'YoushuGauge',               // 仪表盘
  combo:     'YoushuComboChart',           // 柱线混合图
  table:     'YoushuTable',               // 基础表格
  indicator: 'YoushuSimpleIndicatorCard', // 指标卡
  pivot:     'YoushuCrossPivotTable',     // 交叉透视表
};

// ── ID 生成工具 ───────────────────────────────────────

/**
 * 生成随机 8 位字母数字 ID（小写）
 */
function randomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * 生成节点 ID，格式：node_oc + 随机12位
 */
function genNodeId() {
  return 'node_oc' + randomId() + randomId().slice(0, 4);
}

/**
 * 生成字段别名 ID，格式：field_ + 随机8位
 */
function genFieldAlias() {
  return 'field_' + randomId();
}

/**
 * 生成组件 fieldId，格式：ComponentName_ + 随机8位
 */
function genFieldId(componentName) {
  return componentName + '_' + randomId();
}

// ── 基础组件列表 ──────────────────────────────────────

const BASE_COMPONENTS = [
  'Page', 'RootHeader', 'RootContent', 'RootFooter',
  'YoushuPageHeader', 'PageHeaderContent', 'PageHeaderTab',
];

// ── 字段类型推断 ──────────────────────────────────────

/**
 * 根据字段类型推断正确的 dataType。
 *
 * @param {string} fieldType - 字段类型，如 SelectField、EmployeeField 等
 * @param {string} [explicitDataType] - 显式指定的 dataType，如果提供则优先使用
 * @returns {string} 推断出的 dataType
 */
function inferDataType(fieldType, explicitDataType) {
  if (explicitDataType) {
    return explicitDataType;
  }

  switch (fieldType) {
    case 'EmployeeField':
    case 'DepartmentSelectField':
    case 'MultiSelectField':
    case 'CheckboxField':
      return 'ARRAY';
    case 'DateField':
    case 'CascadeDateField':
      return 'DATE';
    case 'NumberField':
    case 'RateField':
      return 'DOUBLE';
    case 'TextField':
    case 'TextareaField':
    case 'SelectField':
    case 'RadioField':
    default:
      return 'STRING';
  }
}

// ── 筛选器字段后缀推导 ───────────────────────────────

/**
 * 推导筛选项实际使用的 fieldCode。
 *
 * 需要加 _value 后缀的字段类型（数组格式存储值的组件）：
 * - SelectField / MultiSelectField / RadioField / CheckboxField
 * - EmployeeField / DepartmentSelectField
 *
 * @param {string} fieldId - 字段 ID，如 selectField_xxx
 * @param {string} [fieldType] - 可选的字段类型
 * @returns {string} 实际使用的 fieldCode
 */
function deriveFilterFieldCode(fieldId, fieldType) {
  const valueFieldTypes = [
    'SelectField', 'MultiSelectField', 'RadioField', 'CheckboxField',
    'EmployeeField', 'DepartmentSelectField',
  ];

  if (fieldType) {
    if (valueFieldTypes.includes(fieldType)) {
      return fieldId + '_value';
    }
    return fieldId;
  }

  if (fieldId.startsWith('selectField_') || fieldId.startsWith('multiSelectField_') ||
      fieldId.startsWith('radioField_') || fieldId.startsWith('checkboxField_') ||
      fieldId.startsWith('employeeField_') || fieldId.startsWith('departmentSelectField_')) {
    return fieldId + '_value';
  }
  return fieldId;
}

module.exports = {
  CHART_COMPONENT_MAP,
  BASE_COMPONENTS,
  randomId,
  genNodeId,
  genFieldAlias,
  genFieldId,
  inferDataType,
  deriveFilterFieldCode,
};
