'use strict';

const { genFieldAlias } = require('./constants');
const { normalizeFieldCode, buildFieldObj, normalizeField, normalizeFieldArray } = require('./field-utils');

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
      dataType: f.dataType || 'STRING',
      aggregateType: aggType,
      timeGranularityType: isDateField ? 'DAY' : null,
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
  const cubeCode = chart.cubeCode || '';
  const chartType = chart.type || 'bar';

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
        timeGranularityType: isDateField ? 'DAY' : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const xFieldObjs = allFields.filter((f) => f.role === 'x').map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const leftYObjs = allFields.filter((f) => f.role === 'leftY').map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const rightYObjs = allFields.filter((f) => f.role === 'rightY').map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );

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
        timeGranularityType: isDateField ? 'DAY' : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );

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

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const kpiObjs = allFields.filter((f) => f.role === 'kpi').map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const helpKpiObjs = allFields.filter((f) => f.role === 'helpKpi').map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );

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
        timeGranularityType: isDateField ? 'DAY' : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );

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
        timeGranularityType: isDateField ? 'DAY' : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType || 'DOUBLE', f.aggregateType || 'AVG')
    );
    const valueFieldObjs = allFields.filter((f) => f.role === 'value').map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType || 'DOUBLE', f.aggregateType || 'AVG')
    );
    const assitValueFieldObjs = allFields.filter((f) => f.role === 'assit').map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType || 'DOUBLE', f.aggregateType || 'AVG')
    );

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

  // ── 通用图表（bar/line/pie/funnel/scatter/area）──
  const { model, allFields } = buildDataViewQueryModel(chart, cubeTenantId);

  const fieldListObjs = allFields.map((f) =>
    buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
  );
  const xFieldObjs = allFields
    .filter((f) => f.role === 'x')
    .map((f) => buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType));
  const yFieldObjs = allFields
    .filter((f) => f.role === 'y')
    .map((f) => buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType));
  const groupFieldObjs = allFields
    .filter((f) => f.role === 'group')
    .map((f) => buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType));

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

module.exports = {
  buildDataViewQueryModel,
  buildDataSetModelMap,
};
