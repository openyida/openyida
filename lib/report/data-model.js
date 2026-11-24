'use strict';

const { genFieldAlias } = require('./constants');
const { getReportChartCapability } = require('./capability-registry');
const {
  normalizeFieldCode,
  buildFieldObj,
  normalizeField,
  normalizeFieldArray,
  normalizeTimeGranularityType,
} = require('./field-utils');

function buildDisplayFieldObj(cubeCode, field, dataType, aggregateType) {
  const display = buildFieldObj(
    cubeCode,
    field.fieldCode,
    field.aliasName || field.fieldCode,
    field._alias,
    dataType || field.dataType,
    aggregateType || field.aggregateType,
    undefined,
    undefined,
    field.timeGranularityType
  );
  return field.expression ? { ...display, expression: field.expression } : display;
}

/**
 * 构建 dataViewQueryModel（图表数据查询模型）
 *
 * 支持两种输入格式：
 * 格式1（结构化）：chart.xField / chart.yField / chart.groupField
 * 格式2（简化）：chart.fields 数组，通过 isDim 自动分配角色
 *   - isDim=true → xField（维度）
 *   - isDim=false → yField（度量）
 */
function buildDataViewQueryModel(chart, cubeTenantId) {
  const cubeCode = chart.cubeCode || '';
  const fieldDefinitionList = [];
  const fieldList = [];

  const allFields = [];

  // 格式2：简化的 fields 数组，自动按 isDim 分配角色
  const hasXField = Array.isArray(chart.xField) ? chart.xField.length > 0 : !!chart.xField;
  const hasYField = Array.isArray(chart.yField) ? chart.yField.length > 0 : !!chart.yField;
  if (Array.isArray(chart.fields) && chart.fields.length > 0 && !hasXField && !hasYField) {
    chart.fields.forEach((f) => {
      const normalized = normalizeField(f, f.isDim ? 'NONE' : 'COUNT');
      allFields.push({ ...normalized, role: f.isDim ? 'x' : 'y' });
    });
  } else {
    // 格式1：结构化的 xField / yField / groupField
    normalizeFieldArray(chart.xField, 'NONE').forEach((f) => allFields.push({ ...f, role: 'x' }));
    normalizeFieldArray(chart.yField, 'COUNT').forEach((f) => allFields.push({ ...f, role: 'y' }));
    normalizeFieldArray(chart.groupField, 'NONE').forEach((f) => allFields.push({ ...f, role: 'group' }));
  }

  allFields.forEach((f) => {
    const alias = genFieldAlias();
    f._alias = alias;
    const aggType = f.aggregateType || 'NONE';
    const isDateField = (f.dataType === 'DATE') || (f.fieldCode && f.fieldCode.startsWith('dateField_'));

    fieldDefinitionList.push({
      cubeCode: cubeCode,
      isDim: false,
      alias: alias,
      aliasName: { type: 'i18n', zh_CN: f.aliasName || f.fieldCode },
      classifiedCode: cubeCode,
      fieldCode: normalizeFieldCode(f.fieldCode),
      ...(f.expression ? { expression: f.expression } : {}),
      dataType: f.dataType || 'STRING',
      aggregateType: aggType,
      timeGranularityType: isDateField ? normalizeTimeGranularityType(f.timeGranularityType) : null,
    });

    fieldList.push(alias);
  });

  return {
    model: {
      cubeCode: cubeCode,
      fieldDefinitionList: fieldDefinitionList,
      fieldList: fieldList,
      filterList: [],
      orderByList: [],
      cubeTenantId: cubeTenantId || '',
    },
    allFields: allFields,
  };
}

/**
 * 构建 dataSetModelMap（图表数据集映射）
 */
function buildDataSetModelMap(chart, cubeTenantId) {
  const chartCapability = getReportChartCapability(chart && chart.type);
  if (!chartCapability) {
    const error = new Error(`unsupported report chart type: ${String(chart && chart.type)}`);
    error.code = 'REPORT_CHART_TYPE_UNSUPPORTED';
    throw error;
  }
  const cubeCode = chart.cubeCode || '';
  const chartType = chartCapability.type;

  if (chartType === 'map') {
    const allFields = [];
    normalizeFieldArray(chart.locationFields || chart.xField, 'NONE')
      .forEach((field) => allFields.push({ ...field, role: 'name' }));
    normalizeFieldArray(chart.valueField || chart.yField, 'COUNT')
      .forEach((field) => allFields.push({ ...field, role: 'value' }));

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((field) => {
      const alias = genFieldAlias();
      field._alias = alias;
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: 'i18n', zh_CN: field.aliasName || field.fieldCode },
        classifiedCode: cubeCode, fieldCode: normalizeFieldCode(field.fieldCode),
        dataType: field.dataType || 'STRING', aggregateType: field.aggregateType || 'NONE',
        timeGranularityType: null,
      });
      fieldListKeys.push(alias);
    });
    const fieldList = allFields.map(field => buildDisplayFieldObj(cubeCode, field));
    return {
      chartData: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || '',
        },
        fieldList,
        name: allFields.filter(field => field.role === 'name')
          .map(field => buildDisplayFieldObj(cubeCode, field)),
        value: allFields.filter(field => field.role === 'value')
          .map(field => buildDisplayFieldObj(cubeCode, field)),
        youshuDataType: 'real',
        cubeCodes: cubeCode ? [cubeCode] : [],
        filterList: [], limit: '', mockData: [],
      },
    };
  }

  // ── 柱线混合图（combo）──
  if (chartType === 'combo') {
    const allFields = [];
    normalizeFieldArray(chart.xField, 'NONE').forEach((f) => allFields.push({ ...f, role: 'x' }));
    normalizeFieldArray(chart.leftYFields, 'SUM').forEach((f) => allFields.push({ ...f, role: 'leftY' }));
    normalizeFieldArray(chart.rightYFields, 'SUM').forEach((f) => allFields.push({ ...f, role: 'rightY' }));

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || 'NONE';
      const isDateField = (f.dataType === 'DATE') || (f.fieldCode && f.fieldCode.startsWith('dateField_'));
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: 'i18n', zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: normalizeFieldCode(f.fieldCode),
        dataType: f.dataType || 'STRING', aggregateType: aggType,
        timeGranularityType: isDateField ? normalizeTimeGranularityType(f.timeGranularityType) : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) => buildDisplayFieldObj(cubeCode, f));
    const xFieldObjs = allFields.filter((f) => f.role === 'x').map((f) => buildDisplayFieldObj(cubeCode, f));
    const leftYObjs = allFields.filter((f) => f.role === 'leftY').map((f) => buildDisplayFieldObj(cubeCode, f));
    const rightYObjs = allFields.filter((f) => f.role === 'rightY').map((f) => buildDisplayFieldObj(cubeCode, f));

    return {
      dataSetName: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || '',
        },
        fieldList: fieldListObjs,
        youshuDataType: 'real',
        cubeCodes: cubeCode ? [cubeCode] : [],
        xField: xFieldObjs,
        leftYFields: leftYObjs,
        rightYFields: rightYObjs,
        annotationField: [],
        filterList: [],
        limit: '',
        mockData: [],
      },
    };
  }

  // ── 基础表格（table）──
  if (chartType === 'table') {
    const rawColumns = chart.columnFields || chart.columns || chart.fields || [];
    const allFields = normalizeFieldArray(rawColumns, 'NONE').map((f) => ({ ...f, role: 'col' }));

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || 'NONE';
      const isDateField = (f.dataType === 'DATE') || (f.fieldCode && f.fieldCode.startsWith('dateField_'));
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: 'i18n', zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: normalizeFieldCode(f.fieldCode),
        dataType: f.dataType || 'STRING', aggregateType: aggType,
        timeGranularityType: isDateField ? normalizeTimeGranularityType(f.timeGranularityType) : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) => buildDisplayFieldObj(cubeCode, f));

    return {
      table: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || '',
        },
        fieldList: fieldListObjs,
        youshuDataType: 'real',
        cubeCodes: cubeCode ? [cubeCode] : [],
        columnFields: [...fieldListObjs],
        filterList: [],
        limit: '',
        mockData: [],
      },
    };
  }

  // ── 指标卡（indicator）──
  if (chartType === 'indicator') {
    const rawKpi = chart.kpi || chart.kpiField || chart.yField || chart.fields || [];
    const allFields = normalizeFieldArray(rawKpi, 'COUNT').map((f) => ({ ...f, role: 'kpi' }));
    normalizeFieldArray(chart.helpKpi, 'COUNT').forEach((f) => allFields.push({ ...f, role: 'helpKpi' }));

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || 'NONE';
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: 'i18n', zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: normalizeFieldCode(f.fieldCode),
        dataType: f.dataType || 'STRING', aggregateType: aggType,
        timeGranularityType: null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) => buildDisplayFieldObj(cubeCode, f));
    const kpiObjs = allFields.filter((f) => f.role === 'kpi').map((f) => buildDisplayFieldObj(cubeCode, f));
    const helpKpiObjs = allFields.filter((f) => f.role === 'helpKpi').map((f) => buildDisplayFieldObj(cubeCode, f));

    return {
      youshuData: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || '',
        },
        fieldList: fieldListObjs,
        youshuDataType: 'real',
        cubeCodes: cubeCode ? [cubeCode] : [],
        kpi: kpiObjs,
        helpKpi: helpKpiObjs,
        filterList: [],
        limit: '',
        mockData: [],
      },
    };
  }

  // ── 交叉透视表（pivot）──
  if (chartType === 'pivot') {
    const rawColumns = chart.columnList || chart.columns || [];
    const allFields = normalizeFieldArray(rawColumns, 'NONE').map((f) => ({ ...f, role: 'col' }));

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || 'NONE';
      const isDateField = (f.dataType === 'DATE') || (f.fieldCode && f.fieldCode.startsWith('dateField_'));
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: 'i18n', zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: normalizeFieldCode(f.fieldCode),
        dataType: f.dataType || 'STRING', aggregateType: aggType,
        timeGranularityType: isDateField ? normalizeTimeGranularityType(f.timeGranularityType) : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) => buildDisplayFieldObj(cubeCode, f));

    return {
      dataSetName: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || '',
          filterMode: 'PROFESSIONAL',
        },
        fieldList: fieldListObjs,
        youshuDataType: 'real',
        cubeCodes: cubeCode ? [cubeCode] : [],
        columnList: [...fieldListObjs],
        filterList: [],
        limit: '',
        mockData: [],
      },
    };
  }

  // ── 仪表盘（gauge）──
  if (chartType === 'gauge') {
    const allFields = [];
    if (chart.valueField) {
      allFields.push({ ...normalizeField(chart.valueField, 'AVG'), role: 'value' });
    }
    if (chart.assitValueField) {
      allFields.push({ ...normalizeField(chart.assitValueField, 'AVG'), role: 'assit' });
    }
    if (!chart.valueField && chart.yField) {
      const yFields = normalizeFieldArray(chart.yField, 'AVG');
      if (yFields.length > 0) { allFields.push({ ...yFields[0], role: 'value' }); }
    }

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || 'AVG';
      const isDateField = (f.dataType === 'DATE') || (f.fieldCode && f.fieldCode.startsWith('dateField_'));
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: 'i18n', zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: normalizeFieldCode(f.fieldCode),
        dataType: f.dataType || 'DOUBLE', aggregateType: aggType,
        timeGranularityType: isDateField ? normalizeTimeGranularityType(f.timeGranularityType) : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) => buildDisplayFieldObj(cubeCode, f, f.dataType || 'DOUBLE', f.aggregateType || 'AVG'));
    const valueFieldObjs = allFields.filter((f) => f.role === 'value')
      .map((f) => buildDisplayFieldObj(cubeCode, f, f.dataType || 'DOUBLE', f.aggregateType || 'AVG'));
    const assitValueFieldObjs = allFields.filter((f) => f.role === 'assit')
      .map((f) => buildDisplayFieldObj(cubeCode, f, f.dataType || 'DOUBLE', f.aggregateType || 'AVG'));

    return {
      chartData: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || '',
        },
        fieldList: fieldListObjs,
        youshuDataType: 'real',
        cubeCodes: cubeCode ? [cubeCode] : [],
        valueField: valueFieldObjs,
        assitValueField: assitValueFieldObjs,
        filterList: [],
        limit: '',
        mockData: [],
      },
    };
  }

  // ── 通用图表（bar/line/pie/funnel/calendarheatmap）──
  const { model, allFields } = buildDataViewQueryModel(chart, cubeTenantId);

  const fieldListObjs = allFields.map((f) => buildDisplayFieldObj(cubeCode, f));
  const xFieldObjs = allFields
    .filter((f) => f.role === 'x')
    .map((f) => buildDisplayFieldObj(cubeCode, f));
  const yFieldObjs = allFields
    .filter((f) => f.role === 'y')
    .map((f) => buildDisplayFieldObj(cubeCode, f));
  const groupFieldObjs = allFields
    .filter((f) => f.role === 'group')
    .map((f) => buildDisplayFieldObj(cubeCode, f));

  const extraFields = {};
  if (chartType === 'pie') {
    extraFields.ratio = [];
    extraFields.totalValue = [];
    extraFields.totalRatio = [];
    extraFields.trailingIconField = [];
  }

  return {
    chartData: {
      dataViewQueryModel: {
        ...model,
        cubeCode: cubeCode,
        cubeTenantId: cubeTenantId || '',
      },
      fieldList: fieldListObjs,
      youshuDataType: 'real',
      cubeCodes: cubeCode ? [cubeCode] : [],
      xField: xFieldObjs,
      yField: yFieldObjs,
      groupField: groupFieldObjs,
      annotationField: [],
      ...extraFields,
      filterList: [],
      limit: '',
      mockData: [],
    },
  };
}

function buildUserConfig(chartType) {
  if (chartType === 'analysis') {
    return { chartType, dataConfig: { xField: [], yField: [] } };
  }
  if (chartType === 'pie') {
    return { chartType: 'pie', dataConfig: { xField: [], yField: [], ratio: [], totalValue: [], totalRatio: [] } };
  }
  if (chartType === 'funnel') {
    return { chartType: 'funnel', dataConfig: { xField: [], yField: [] } };
  }
  if (chartType === 'gauge') {
    return { chartType: 'gauge', dataConfig: { valueField: [], assitValueField: [] } };
  }
  if (chartType === 'map') {
    return { chartType: 'map', dataConfig: { name: [], value: [] } };
  }
  if (chartType === 'combo') {
    return { chartType: 'combo', dataConfig: { xField: [], leftYFields: [], rightYFields: [], annotationField: [] } };
  }
  if (chartType === 'table') {
    return { chartType: 'table', dataConfig: { columnFields: [] } };
  }
  if (chartType === 'indicator') {
    return [
      {
        name: 'youshuData',
        title: '指标数据',
        items: [
          {
            name: 'kpi',
            title: '指标',
            required: true,
            setterName: 'ColumnFieldSetter',
            setterProps: {
              single: false, showFormatTab: true, showSortTab: false, showDataLink: true,
              supportDynamicAlias: true, customTabs: [{ tabName: '指标配置' }],
              showBatchSet: true,
              batchSetFields: ['text', 'title', 'titleTip', 'aggregateType', 'format_type', 'format_decimalDigit', 'unit'],
            },
          },
          {
            name: 'helpKpi',
            title: '辅助指标',
            setterName: 'ColumnFieldSetter',
            setterProps: { single: false, showFormatTab: true, showSortTab: false, showDataLink: true },
          },
        ],
      },
    ];
  }
  if (chartType === 'pivot') {
    return { chartType: 'pivot', dataConfig: { columnList: [] } };
  }
  // 默认：bar/line/calendarheatmap
  return { chartType: chartType || 'bar', dataConfig: { xField: [], yField: [], groupField: [], annotationField: [] } };
}

/**
 * 构建带字段信息的 userConfig（数组格式，与宜搭报表设计器一致）
 *
 * 宜搭报表引擎期望 userConfig 为数组格式：
 * [{name: 'chartData', title: '配置数据', items: [{setterName: 'ColumnFieldSetter', ...}]}]
 * 指标卡已经是数组格式，其他图表类型需要转换。
 */
function buildUserConfigWithFields(chartType) {
  // 指标卡已经是正确的数组格式
  if (chartType === 'indicator') {
    return buildUserConfig(chartType);
  }

  // 饼图
  if (chartType === 'pie') {
    return [{
      name: 'chartData', title: '配置数据',
      items: [
        { setterName: 'ColumnFieldSetter', name: 'xField', title: '分类字段',
          setterProps: { single: true, showFormatTab: true, showAggregateTab: false, showDrillTab: true, showColorTab: true, showEditTab: true } },
        { setterName: 'ColumnFieldSetter', name: 'yField', title: '数值字段',
          setterProps: { single: true, showFormatTab: true, showEditTab: true, showDataLink: true } },
        { setterName: 'ColumnFieldSetter', name: 'ratio', title: '趋势值字段',
          tip: { content: '当饼图图例类型为【指标卡】时显示，一般用于提示各分类的变化趋势' },
          setterProps: { showFormatTab: true, showEditTab: true } },
        { setterName: 'ColumnFieldSetter', name: 'totalValue', title: '总值字段',
          tip: { content: '在开启【环形图】时显示，一般用于提示各分类值总和' },
          setterProps: { showFormatTab: true, showEditTab: true } },
        { setterName: 'ColumnFieldSetter', name: 'totalRatio', title: '总趋势值字段',
          tip: { content: '在开启【环形图】时显示，一般用于提示各分类值总和的变化趋势' },
          setterProps: { showFormatTab: true, showEditTab: true } },
      ],
    }];
  }

  // 柱状图 / 折线图 / 日历热力图 / 漏斗图
  if (['analysis', 'bar', 'line', 'calendarheatmap', 'funnel'].includes(chartType)) {
    const items = [
      { setterName: 'ColumnFieldSetter', name: 'xField', title: '横轴',
        setterProps: { single: true, showFormatTab: true, showFormulaEditor: true, showFieldInfo: true, showAggregateTab: false, showDrillTab: true, showEditTab: true, showSortTab: true } },
      { setterName: 'ColumnFieldSetter', name: 'yField', title: '纵轴',
        setterProps: { showFormatTab: true, showFormulaEditor: true, showFieldInfo: true, showEditTab: true, showSortTab: true, showDataLink: true } },
    ];
    if (!['analysis', 'funnel'].includes(chartType)) {
      items.push(
        { setterName: 'ColumnFieldSetter', name: 'groupField', title: '分组',
          setterProps: { single: true, showFormatTab: true, showEditTab: true } },
        { setterName: 'ColumnFieldSetter', name: 'annotationField', title: '参考线',
          setterProps: { showFormatTab: true, showEditTab: true } }
      );
    }
    return [{ name: 'chartData', title: '配置数据', items }];
  }

  // 柱线混合图
  if (chartType === 'combo') {
    return [{
      name: 'dataSetName', title: '配置数据',
      items: [
        { setterName: 'ColumnFieldSetter', name: 'xField', title: '横轴',
          setterProps: { single: true, showFormatTab: true, showEditTab: true, showSortTab: true } },
        { setterName: 'ColumnFieldSetter', name: 'leftYFields', title: '左纵轴',
          setterProps: { showFormatTab: true, showEditTab: true, showDataLink: true } },
        { setterName: 'ColumnFieldSetter', name: 'rightYFields', title: '右纵轴',
          setterProps: { showFormatTab: true, showEditTab: true, showDataLink: true } },
        { setterName: 'ColumnFieldSetter', name: 'annotationField', title: '参考线',
          setterProps: { showFormatTab: true, showEditTab: true } },
      ],
    }];
  }

  // 基础表格
  if (chartType === 'table') {
    return [{
      name: 'table', title: '配置数据',
      items: [
        { setterName: 'ColumnFieldSetter', name: 'columnFields', title: '列',
          setterProps: { showFormatTab: true, showFormulaEditor: true, showFieldInfo: true, showEditTab: true, showSortTab: true, showDataLink: true,
            supportDynamicAlias: true, showBatchSet: true,
            batchSetFields: ['text', 'title', 'aggregateType', 'format_type', 'format_decimalDigit'] } },
      ],
    }];
  }

  // 交叉透视表
  if (chartType === 'pivot') {
    return [{
      name: 'dataSetName', title: '配置数据',
      items: [
        { setterName: 'ColumnFieldSetter', name: 'columnList', title: '列',
          setterProps: { showFormatTab: true, showEditTab: true } },
      ],
    }];
  }

  // 仪表盘
  if (chartType === 'gauge') {
    return [{
      name: 'chartData', title: '配置数据',
      items: [
        { setterName: 'ColumnFieldSetter', name: 'valueField', title: '指标值',
          setterProps: { single: true, showFormatTab: true, showEditTab: true } },
        { setterName: 'ColumnFieldSetter', name: 'assitValueField', title: '辅助值',
          setterProps: { single: true, showFormatTab: true, showEditTab: true } },
      ],
    }];
  }

  if (chartType === 'map') {
    return [{
      name: 'chartData', title: '配置数据',
      items: [
        { setterName: 'ColumnFieldSetter', name: 'name', title: '地域字段',
          setterProps: { showFormatTab: true, showEditTab: true, showDrillTab: true } },
        { setterName: 'ColumnFieldSetter', name: 'value', title: '数值字段',
          setterProps: { single: true, showFormatTab: true, showEditTab: true } },
      ],
    }];
  }

  const error = new Error(`unsupported report chart type: ${String(chartType)}`);
  error.code = 'REPORT_CHART_TYPE_UNSUPPORTED';
  throw error;
}

module.exports = {
  buildUserConfig,
  buildUserConfigWithFields,
  buildDataViewQueryModel,
  buildDataSetModelMap,
};
