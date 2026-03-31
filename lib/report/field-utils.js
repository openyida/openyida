'use strict';

const {
  genFieldAlias,
} = require('./constants');

/**
 * 将 formUuid 格式的连字符转换为报表 cubeCode 格式的下划线
 * 例如：FORM-CB89B06090324A50972179EA1B0CB0F1VUSG → FORM_CB89B06090324A50972179EA1B0CB0F1VUSG
 * 宜搭报表引擎的 cubeCode 使用下划线分隔，而 formUuid 使用连字符分隔
 */
function normalizeCubeCode(code) {
  if (!code) {return '';}
  return code.replace(/-/g, '_');
}

/**
 * 自动为 selectField / radioField / checkboxField / multiSelectField 的 fieldCode 添加 _value 后缀
 * 宜搭报表引擎要求这些数组格式字段使用 _value 后缀来提取实际值
 * 如果调用方已经传入了带 _value 后缀的 fieldCode，则不重复添加
 */
const SELECT_LIKE_PREFIXES = ['selectField_', 'radioField_', 'checkboxField_', 'multiSelectField_', 'employeeField_'];

function normalizeFieldCode(fieldCode) {
  if (!fieldCode) {return fieldCode;}
  const needsValueSuffix = SELECT_LIKE_PREFIXES.some((prefix) => fieldCode.startsWith(prefix));
  if (needsValueSuffix && !fieldCode.endsWith('_value')) {
    return fieldCode + '_value';
  }
  return fieldCode;
}

// ── 通用构建工具 ──────────────────────────────────────

/**
 * 构建通用图表 afterFetch 函数对象（JSFunction 格式）
 */
function buildAfterFetch() {
  return {
    type: 'JSFunction',
    value: 'function afterFetch(data, extraInfo) {\n  return data;\n}',
  };
}

/**
 * 构建通用导出数据配置
 */
function buildExportData() {
  return {
    supportExport: false,
    passType: 'NO_PASS',
    exportType: 'BROWSER',
    filterList: null,
    exportPromptFilter: null,
    ignoreSwitch: true,
  };
}

/**
 * 构建通用链接配置
 */
function buildLink() {
  return {
    hasLink: false,
    content: { type: 'i18n', zh_CN: '更多', en_US: 'More' },
    onlyIcon: true,
  };
}

/**
 * 构建字段对象（用于 fieldList/xField/yField/groupField）
 *
 * 关键规则（从宜搭报表实际保存接口学习）：
 * 1. isDimension 统一为 "false"
 * 2. dateField 需要额外属性：timeGranularityType, timeFormat, id 加数字后缀
 * 3. dateField 不需要 measureType 属性
 * 4. selectField/radioField 的 fieldCode 需要加 _value 后缀（自动处理，无需调用方手动添加）
 */
function buildFieldObj(cubeCode, fieldCode, aliasName, alias, dataType, aggregateType, orderType, _isDimension) {
  const normalizedFieldCode = normalizeFieldCode(fieldCode);
  const aggType = aggregateType || 'NONE';
  const isDateField = (dataType === 'DATE') || (fieldCode && fieldCode.startsWith('dateField_'));

  // COUNT/SUM/AVG/MAX/MIN 等聚合函数的结果都是数值，强制使用 DOUBLE
  const numericAggTypes = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COUNT_DISTINCT'];
  const effectiveDataType = numericAggTypes.includes(aggType) ? 'DOUBLE' : (dataType || 'STRING');

  const obj = {
    title: { type: 'i18n', zh_CN: aliasName },
    classifiedCode: cubeCode,
    cubeCode: cubeCode,
    fieldCode: normalizedFieldCode,
    isDimension: 'false',
    dataType: effectiveDataType,
    format: { type: 'NONE' },
    link: [{ type: 'NONE' }],
    drillList: [],
    aggregateType: aggType,
    orderBy: { type: orderType || 'NONE', reference: alias },
    fieldKey: alias,
    visible: true,
    beUsedTimes: 1,
    isVisible: 'y',
    id: normalizedFieldCode,
    text: aliasName,
  };

  if (isDateField) {
    obj.timeGranularityType = 'DAY';
    obj.timeFormat = 'yyyy-MM-dd';
    obj.id = fieldCode + '5';
  }

  // 度量字段（有聚合类型）需要添加 measureType
  if (numericAggTypes.includes(aggType)) {
    obj.measureType = 'MEASURE_ATTRIBUTE';
  }

  return obj;
}

// ── 输入校验与字段标准化 ─────────────────────────────

/**
 * 根据 fieldCode 前缀自动推断 dataType
 */
function inferDataType(fieldCode) {
  if (!fieldCode) { return 'STRING'; }
  if (fieldCode.startsWith('numberField_')) { return 'NUMBER'; }
  if (fieldCode.startsWith('dateField_')) { return 'DATE'; }
  return 'STRING';
}

/**
 * 将字段定义标准化为完整对象格式。
 * 支持以下输入格式：
 *   - 字符串: "textField_xxx" → { fieldCode: "textField_xxx", aliasName: "textField_xxx", dataType: "STRING" }
 *   - 对象（缺少属性自动补全）: { fieldCode: "xxx" } → { fieldCode: "xxx", aliasName: "xxx", dataType: "STRING", aggregateType: "NONE" }
 *
 * @param {string|object} field 字段定义（字符串或对象）
 * @param {string} defaultAggregateType 默认聚合类型（维度字段用 NONE，度量字段用 COUNT）
 * @returns {object} 标准化后的字段对象
 */
function normalizeField(field, defaultAggregateType) {
  if (typeof field === 'string') {
    return {
      fieldCode: field,
      aliasName: field,
      dataType: inferDataType(field),
      aggregateType: defaultAggregateType || 'NONE',
    };
  }
  if (!field || typeof field !== 'object') {
    return { fieldCode: '', aliasName: '', dataType: 'STRING', aggregateType: defaultAggregateType || 'NONE' };
  }
  return {
    ...field,
    fieldCode: field.fieldCode || '',
    aliasName: field.aliasName || field.alias || field.label || field.title || field.fieldCode || '',
    dataType: field.dataType || inferDataType(field.fieldCode),
    aggregateType: field.aggregateType || defaultAggregateType || 'NONE',
  };
}

/**
 * 标准化字段数组：支持单对象、数组、字符串等多种输入格式
 * @param {*} input 字段输入（可以是数组、单对象、字符串、undefined）
 * @param {string} defaultAggregateType 默认聚合类型
 * @returns {Array} 标准化后的字段对象数组
 */
function normalizeFieldArray(input, defaultAggregateType) {
  if (!input) { return []; }
  if (Array.isArray(input)) {
    return input.map((f) => normalizeField(f, defaultAggregateType));
  }
  return [normalizeField(input, defaultAggregateType)];
}

/**
 * 根据图表类型返回推荐的默认布局尺寸（6列栅格系统）。
 * 用户可通过 chart.w / chart.h 覆盖默认值。
 */
function getDefaultLayout(chartType) {
  const layoutMap = {
    indicator: { w: 6, h: 6 },
    pie:       { w: 3, h: 22 },
    bar:       { w: 3, h: 22 },
    line:      { w: 3, h: 22 },
    combo:     { w: 6, h: 22 },
    table:     { w: 6, h: 38 },
    pivot:     { w: 6, h: 30 },
    gauge:     { w: 2, h: 18 },
  };
  return layoutMap[chartType] || { w: 3, h: 22 };
}

module.exports = {
  normalizeCubeCode,
  normalizeFieldCode,
  buildAfterFetch,
  buildExportData,
  buildLink,
  buildFieldObj,
  inferDataType,
  normalizeField,
  normalizeFieldArray,
  getDefaultLayout,
};