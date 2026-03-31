'use strict';

const {
  randomId,
  genNodeId,
} = require('./constants');

const {
  normalizeCubeCode,
  normalizeFieldCode,
  buildAfterFetch,
  buildExportData,
  buildLink,
} = require('./field-utils');

/**
 * 构建筛选器字段定义（用于 buildFilterFieldListItem）
 *
 * @param {string} cubeCode 数据源 cubeCode
 * @param {string} alias 字段别名
 * @param {object} aliasName 字段显示名称（i18n 格式）
 * @param {string} fieldCode 字段编码
 * @param {string} dataType 字段数据类型
 * @returns {object} 字段定义对象
 */
function buildFilterFieldDef(cubeCode, alias, aliasName, fieldCode, dataType) {
  return {
    cubeCode: normalizeCubeCode(cubeCode),
    isDim: false,
    alias: alias,
    aliasName: aliasName,
    classifiedCode: normalizeCubeCode(cubeCode),
    fieldCode: normalizeFieldCode(fieldCode),
    dataType: dataType,
    aggregateType: 'NONE',
    timeGranularityType: null,
  };
}

/**
 * 构建筛选器字段列表项（用于 dataSetModelMap.filterList）
 *
 * @param {string} cubeCode 数据源 cubeCode
 * @param {string} alias 字段别名
 * @param {string} aliasName 字段显示名称
 * @param {string} fieldCode 字段编码
 * @param {string} dataType 字段数据类型
 * @returns {object} 字段列表项对象
 */
function buildFilterFieldListItem(cubeCode, alias, aliasName, fieldCode, dataType) {
  return {
    cubeCode: normalizeCubeCode(cubeCode),
    isDim: false,
    alias: alias,
    aliasName: aliasName,
    classifiedCode: normalizeCubeCode(cubeCode),
    fieldCode: normalizeFieldCode(fieldCode),
    dataType: dataType,
    aggregateType: 'NONE',
    timeGranularityType: null,
  };
}

/**
 * 构建下拉筛选器组件（YoushuSelectFilter）
 *
 * @param {object} filterDef 筛选器定义 { title, placeholder, cubeCode, valueField, labelField, defaultValue, mockData }
 * @param {object} valueFieldDef 查询字段定义（用于筛选值）
 * @param {object} labelFieldDef 显示字段定义（用于显示标签）
 * @param {object} dataSetModelMap 数据集模型映射（用于筛选器自身的数据查询）
 * @param {string} cubeTenantId 租户 ID
 * @returns {object} 筛选器组件对象（含 __filterMeta__ 元信息）
 */
function buildSelectFilter(filterDef, valueFieldDef, labelFieldDef, _unusedDataSetModelMap, cubeTenantId) {
  const filterFieldId = genNodeId('filter');
  const filterNodeId = genNodeId('node_filter');
  const aliasValue = 'field_filter_value_' + randomId().slice(0, 4);
  const aliasLabel = 'field_filter_label_' + randomId().slice(0, 4);
  const mockData = filterDef.mockData || [];

  const cubeCode = filterDef.cubeCode || '';
  const valueFieldCode = (valueFieldDef && valueFieldDef.fieldCode) || '';
  const labelFieldCode = (labelFieldDef && labelFieldDef.fieldCode) || valueFieldCode;
  const valueAliasName = (valueFieldDef && valueFieldDef.aliasName) || '查询字段';
  const labelAliasName = (labelFieldDef && labelFieldDef.aliasName) || valueAliasName;
  const valueDataType = (valueFieldDef && valueFieldDef.dataType) || 'STRING';
  const labelDataType = (labelFieldDef && labelFieldDef.dataType) || valueDataType;

  // 构建筛选器专用的 dataSetModelMap（严格按照宜搭真实 Schema 格式）
  const valueFieldItem = {
    visible: true,
    isDimension: 'false',
    fieldKey: aliasValue,
    fieldCode: normalizeFieldCode(valueFieldCode),
    classifiedCode: normalizeCubeCode(cubeCode),
    dataType: valueDataType,
    format: { type: 'NONE' },
    link: [{ type: 'NONE' }],
    drillList: [],
    orderBy: { reference: aliasValue, type: 'NONE' },
    isVisible: 'y',
    title: { type: 'i18n', zh_CN: valueAliasName },
    aggregateType: 'NONE',
    cubeCode: normalizeCubeCode(cubeCode),
    beUsedTimes: 1,
    id: normalizeFieldCode(valueFieldCode),
    text: valueAliasName,
    measureType: 'MEASURE_ATTRIBUTE',
  };
  const labelFieldItem = {
    visible: true,
    isDimension: 'false',
    fieldKey: aliasLabel,
    fieldCode: normalizeFieldCode(labelFieldCode),
    classifiedCode: normalizeCubeCode(cubeCode),
    dataType: labelDataType,
    format: { type: 'NONE' },
    link: [{ type: 'NONE' }],
    drillList: [],
    orderBy: { reference: aliasLabel, type: 'NONE' },
    isVisible: 'y',
    title: { type: 'i18n', zh_CN: labelAliasName },
    aggregateType: 'NONE',
    cubeCode: normalizeCubeCode(cubeCode),
    beUsedTimes: 1,
    id: normalizeFieldCode(labelFieldCode),
    text: labelAliasName,
    measureType: 'MEASURE_ATTRIBUTE',
  };
  const builtDataSetModelMap = {
    selectFilter: {
      cubeCodes: cubeCode ? [normalizeCubeCode(cubeCode)] : [],
      dataViewQueryModel: {
        orderByList: [],
        fieldDefinitionList: [
          {
            aliasName: { type: 'i18n', zh_CN: valueAliasName },
            isDim: false,
            cubeCode: normalizeCubeCode(cubeCode),
            fieldCode: normalizeFieldCode(valueFieldCode),
            classifiedCode: normalizeCubeCode(cubeCode),
            dataType: valueDataType,
            alias: aliasValue,
            aggregateType: 'NONE',
          },
          {
            aliasName: { type: 'i18n', zh_CN: labelAliasName },
            isDim: false,
            cubeCode: normalizeCubeCode(cubeCode),
            fieldCode: normalizeFieldCode(labelFieldCode),
            classifiedCode: normalizeCubeCode(cubeCode),
            dataType: labelDataType,
            alias: aliasLabel,
            aggregateType: 'NONE',
          },
        ],
        cubeCode: normalizeCubeCode(cubeCode),
        cubeTenantId: cubeTenantId || '',
        filterList: [],
        fieldList: [aliasValue, aliasLabel],
      },
      limit: 1000,
      valueField: [valueFieldItem],
      filterList: '',
      fieldList: [valueFieldItem, labelFieldItem],
      youshuDataType: 'real',
      labelField: [labelFieldItem],
    },
  };

  return {
    componentName: 'YoushuSelectFilter',
    id: filterNodeId,
    props: {
      cid: filterNodeId,
      showComponentTitle: true,
      componentTitle: { type: 'i18n', zh_CN: filterDef.title || '筛选器', en_US: filterDef.title || 'Filter' },
      link: buildLink(),
      exportData: buildExportData(),
      openRefresh: true,
      enabledCache: true,
      fieldId: filterFieldId,
      afterFetch: '/**\n* 对返回的数据做一些自定义处理\n*/\nfunction afterFetch(data, extraInfo) {\n  return data;\n}',
      __style__: {},
      mockData: [
        {
          name: 'selectFilter',
          data: {
            data: mockData,
            meta: [
              { aliasName: valueAliasName, alias: aliasValue, category: 'valueField' },
              { aliasName: labelAliasName, alias: aliasLabel, category: 'labelField' },
            ],
            currentPage: 1,
            totalCount: mockData.length,
          },
        },
      ],
      dataSetModelMap: builtDataSetModelMap,
      userConfig: [
        {
          name: 'selectFilter',
          title: '筛选器数据集',
          items: [
            {
              name: 'valueField',
              title: '查询字段',
              setterName: 'ColumnFieldSetter',
              setterProps: { single: true, showFormatTab: true, showEditTab: true, showFormulaEditor: true, showFieldInfo: true, showSortTab: true, showAggregateTab: true },
            },
            {
              name: 'labelField',
              title: '显示字段',
              setterName: 'ColumnFieldSetter',
              setterProps: { single: true, showFormatTab: true, showEditTab: true, showFormulaEditor: true, showFieldInfo: true, showSortTab: true, showAggregateTab: true },
            },
            {
              name: 'defaultValue',
              title: '默认值',
              setterName: 'DefaultValueSetter',
              setterProps: { timeAsString: true },
            },
          ],
        },
      ],
      settings: {
        mode: 'single',
        hasSelectAll: false,
        isMultiLine: true,
        dataConfig: { required: false, tagMode: false, showTitle: true },
        labelConfig: {
          showLabel: true,
          label: { type: 'i18n', zh_CN: filterDef.title || '筛选器', en_US: filterDef.title || 'Filter' },
          labelTips: { type: 'i18n', zh_CN: '', en_US: '' },
          labelTipIcon: 'prompt-filling',
          labelAlign: 'top',
          labelColSpan: 4,
        },
        contentConfig: {
          placeholder: { type: 'i18n', zh_CN: filterDef.placeholder || '请选择', en_US: 'Please select' },
          notFoundContent: { type: 'i18n', zh_CN: '暂无数据', en_US: 'No data' },
        },
        overallStyle: { behavior: 'NORMAL', size: 'medium', hasClear: true, autoWidth: true },
        container: { height: -88 },
      },
      autoLink: true,
      hasFullscreen: false,
      copyAsImg: false,
      isHeightAuto: false,
      datasetModel: { filterList: [] },
    },
    // 暴露给 buildReportSchema 使用的元信息
    __filterMeta__: {
      filterNodeId,
      filterFieldId,
      aliasValue,
      aliasLabel,
      valueFieldCode: valueFieldDef.fieldCode || '',
      valueFieldAliasName: valueFieldDef.aliasName || '查询字段',
    },
  };
}

/**
 * 构建筛选器容器（YoushuTopFilterContainer），放在 PageHeaderContent 下
 *
 * @param {Array} filterComponents buildSelectFilter 返回的筛选器组件数组
 * @param {string} containerFieldId 容器 fieldId
 */
function buildFilterContainer(filterComponents, containerFieldId) {
  const layout = filterComponents.map((fc, i) => ({
    w: 1, h: 1,
    x: i % 3,
    y: Math.floor(i / 3),
    i: fc.props.fieldId,
    moved: false,
    static: false,
  }));

  return {
    componentName: 'YoushuTopFilterContainer',
    id: 'node_filter_container_' + randomId(),
    props: {
      rglSwitch: true,
      createForm: true,
      status: 'normal',
      fixed: true,
      rowColumn: 3,
      searchBtn: true,
      resetBtn: true,
      __style__: {},
      fieldId: containerFieldId,
      cid: 'node_filter_container_' + randomId(),
      layout: layout,
    },
    children: filterComponents,
  };
}

/**
 * 为图表的 dataSetModelMap 注入筛选器联动配置
 *
 * 注意：此函数会原地修改传入的 dataSetModelMap 对象（追加 filterList 和 fieldDefinitionList）。
 *
 * @param {object} dataSetModelMap 图表的 dataSetModelMap（会被原地修改）
 * @param {object} filterMeta buildSelectFilter 返回的 __filterMeta__
 * @param {string} filterFieldCode 被筛选的字段 fieldCode（在图表数据源中）
 * @param {string} cubeCode 数据源 cubeCode
 * @param {string} cubeTenantId 租户 ID
 * @returns {object} 修改后的 dataSetModelMap（同一引用）
 */
function injectFilterLinkage(dataSetModelMap, filterMeta, filterFieldCode, cubeCode, cubeTenantId) {
  const { filterNodeId, valueFieldAliasName } = filterMeta;
  // filterKey 格式：'filter-' + 4段randomId（与 create-report-with-filter.js 保持一致）
  const filterKey = 'filter-' + randomId() + '-' + randomId() + '-' + randomId() + '-' + randomId();
  // paramId 格式："{筛选器nodeId}-selectFilter"
  const paramId = filterNodeId + '-selectFilter';
  // 筛选引用字段的 alias（额外添加到 fieldDefinitionList）
  const aliasFilterRef = 'field_filter_ref_' + randomId().slice(0, 4);

  // 找到 dataSetModelMap 中的数据集 key（chartData / table / dataSetName 等）
  const dsKey = Object.keys(dataSetModelMap)[0];
  if (!dsKey) {return dataSetModelMap;}

  const ds = dataSetModelMap[dsKey];

  // 在 fieldDefinitionList 中追加筛选引用字段
  if (ds.dataViewQueryModel && ds.dataViewQueryModel.fieldDefinitionList) {
    ds.dataViewQueryModel.fieldDefinitionList.push({
      cubeCode: cubeCode,
      isDim: false,
      alias: aliasFilterRef,
      aliasName: { type: 'i18n', zh_CN: valueFieldAliasName },
      classifiedCode: cubeCode,
      fieldCode: normalizeFieldCode(filterFieldCode),
      dataType: 'STRING',
      aggregateType: 'NONE',
      timeGranularityType: null,
      cubeTenantId: cubeTenantId || '',
    });
  }

  // 在 dataViewQueryModel.filterList 中追加联动配置
  if (ds.dataViewQueryModel) {
    if (!ds.dataViewQueryModel.filterList) {ds.dataViewQueryModel.filterList = [];}
    ds.dataViewQueryModel.filterList.push({
      filterKey: filterKey,
      paramId: paramId,
      filterType: 'relate',
      value: null,
      conditionType: 'EqualTo',
      alias: aliasFilterRef,
    });
  }

  // 在 dataSetModelMap[dsKey].filterList 中追加联动配置（含 fieldInfo）
  if (!ds.filterList) {ds.filterList = [];}
  ds.filterList.push({
    filterKey: filterKey,
    paramId: paramId,
    fieldInfo: buildFilterFieldListItem(cubeCode, aliasFilterRef, valueFieldAliasName, filterFieldCode, 'STRING'),
    filterType: 'relate',
    value: null,
    conditionType: 'EqualTo',
  });

  return dataSetModelMap;
}

module.exports = {
  buildFilterFieldDef,
  buildFilterFieldListItem,
  buildSelectFilter,
  buildFilterContainer,
  injectFilterLinkage,
};
