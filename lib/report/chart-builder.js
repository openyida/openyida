'use strict';

const {
  CHART_COMPONENT_MAP,
  BASE_COMPONENTS,
  randomId,
  genNodeId,
  genFieldAlias,
  genFieldId,
} = require('./constants');

/**
 * 将 formUuid 格式的连字符转换为报表 cubeCode 格式的下划线
 * 例如：FORM-CB89B06090324A50972179EA1B0CB0F1VUSG → FORM_CB89B06090324A50972179EA1B0CB0F1VUSG
 * 宜搭报表引擎的 cubeCode 使用下划线分隔，而 formUuid 使用连字符分隔
 */
function normalizeCubeCode(code) {
  if (!code) return '';
  return code.replace(/-/g, '_');
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
 * 4. selectField/radioField 的 fieldCode 需要加 _value 后缀（由调用方传入）
 */
function buildFieldObj(cubeCode, fieldCode, aliasName, alias, dataType, aggregateType, orderType, _isDimension) {
  const aggType = aggregateType || 'NONE';
  const isDateField = (dataType === 'DATE') || (fieldCode && fieldCode.startsWith('dateField_'));

  // COUNT/SUM/AVG/MAX/MIN 等聚合函数的结果都是数值，强制使用 DOUBLE
  const numericAggTypes = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COUNT_DISTINCT'];
  const effectiveDataType = numericAggTypes.includes(aggType) ? 'DOUBLE' : (dataType || 'STRING');

  const obj = {
    title: { type: 'i18n', zh_CN: aliasName },
    classifiedCode: cubeCode,
    cubeCode: cubeCode,
    fieldCode: fieldCode,
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
    id: fieldCode,
    text: aliasName,
  };

  if (isDateField) {
    obj.timeGranularityType = 'DAY';
    obj.timeFormat = 'yyyy-MM-dd';
    obj.id = fieldCode + '5';
  } else {
    obj.measureType = 'MEASURE_ATTRIBUTE';
  }

  return obj;
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
  if (Array.isArray(chart.fields) && chart.fields.length > 0 && !chart.xField && !chart.yField) {
    chart.fields.forEach((f) => {
      const role = f.isDim ? 'x' : 'y';
      allFields.push({ ...f, role });
    });
  } else {
    // 格式1：结构化的 xField / yField / groupField
    if (chart.xField) {
      if (Array.isArray(chart.xField)) {
        chart.xField.forEach((f) => allFields.push({ ...f, role: 'x' }));
      } else {
        allFields.push({ ...chart.xField, role: 'x' });
      }
    }

    if (Array.isArray(chart.yField)) {
      chart.yField.forEach((f) => allFields.push({ ...f, role: 'y' }));
    } else if (chart.yField) {
      allFields.push({ ...chart.yField, role: 'y' });
    }

    if (chart.groupField) {
      if (Array.isArray(chart.groupField)) {
        chart.groupField.forEach((f) => allFields.push({ ...f, role: 'group' }));
      } else {
        allFields.push({ ...chart.groupField, role: 'group' });
      }
    }
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
      fieldCode: f.fieldCode,
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
    if (chart.xField) {
      if (Array.isArray(chart.xField)) {
        chart.xField.forEach((f) => allFields.push({ ...f, role: 'x' }));
      } else {
        allFields.push({ ...chart.xField, role: 'x' });
      }
    }
    if (Array.isArray(chart.leftYFields)) {
      chart.leftYFields.forEach((f) => allFields.push({ ...f, role: 'leftY' }));
    } else if (chart.leftYFields) {
      allFields.push({ ...chart.leftYFields, role: 'leftY' });
    }
    if (Array.isArray(chart.rightYFields)) {
      chart.rightYFields.forEach((f) => allFields.push({ ...f, role: 'rightY' }));
    } else if (chart.rightYFields) {
      allFields.push({ ...chart.rightYFields, role: 'rightY' });
    }

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
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
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
    const allFields = [];
    if (Array.isArray(chart.columnFields)) {
      chart.columnFields.forEach((f) => allFields.push({ ...f, role: 'col' }));
    } else if (Array.isArray(chart.columns)) {
      chart.columns.forEach((f) => allFields.push({ ...f, role: 'col' }));
    } else if (Array.isArray(chart.fields)) {
      chart.fields.forEach((f) => allFields.push({ ...f, role: 'col' }));
    }

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
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
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
    const allFields = [];
    if (Array.isArray(chart.kpi)) {
      chart.kpi.forEach((f) => allFields.push({ ...f, role: 'kpi' }));
    } else if (Array.isArray(chart.yField)) {
      chart.yField.forEach((f) => allFields.push({ ...f, role: 'kpi' }));
    } else if (Array.isArray(chart.fields)) {
      chart.fields.forEach((f) => allFields.push({ ...f, role: 'kpi' }));
    }
    if (Array.isArray(chart.helpKpi)) {
      chart.helpKpi.forEach((f) => allFields.push({ ...f, role: 'helpKpi' }));
    }

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || 'NONE';
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: 'i18n', zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
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
    const allFields = [];
    if (Array.isArray(chart.columnList)) {
      chart.columnList.forEach((f) => allFields.push({ ...f, role: 'col' }));
    } else if (Array.isArray(chart.columns)) {
      chart.columns.forEach((f) => allFields.push({ ...f, role: 'col' }));
    }

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
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
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
    if (chart.valueField) {allFields.push({ ...chart.valueField, role: 'value' });}
    if (chart.assitValueField) {allFields.push({ ...chart.assitValueField, role: 'assit' });}
    if (!chart.valueField && Array.isArray(chart.yField) && chart.yField.length > 0) {
      allFields.push({ ...chart.yField[0], role: 'value' });
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
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
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
      dataViewQueryModel: model,
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

// ── 图表 Settings ─────────────────────────────────────

function buildBarChartSettings() {
  return {
    container: { height: 248 },
    style: {
      mode: 'group', linkGroup: false, transpose: false, barStyle: 'ai',
      size: null, maxSize: null, minSize: null, barBackground: null,
      groupSpacing: 0, radiusLeftTop: 4, radiusRightTop: 4,
      radiusRightBottom: 0, radiusLeftBottom: 0,
      colorType: 'SCHEMA_COLOR', chartColorsMode: 'defaultColorsMode',
      customColor: '#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C',
    },
    countLabel: { showCountLabel: false, fontSize: 12, color: '#000' },
    axisType: 'hz',
    xAxis: {
      showXAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: true, tickLine: true, grid: false, label: true,
      labelStyle: {
        labelType: 'default', color: 'rgba(23,26,29,0.4)', fontSize: 12,
        limitLengthType: 'percent', percent: 30, value: 100,
        autoRotate: true, rotate: '0', autoHide: true,
      },
      values: { type: 'i18n', zh_CN: '', en_US: '' },
    },
    yAxis: {
      showYAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: false, tickLine: false, grid: true, label: true,
      labelStyle: {
        labelType: 'default', color: 'rgba(23,26,29,0.4)', fontSize: 12,
        limitLengthType: 'percent', percent: 30, value: 100,
        autoRotate: true, rotate: '0', autoHide: true,
      },
      min: null, max: null, tickCount: 5,
    },
    legend: { showLegend: true, legendPosition: 'top-left', flipPage: true },
    label: {
      showLabel: true, labelShowStyle: 'ai', fontSize: 12,
      autoColor: true, color: '#000', autoPosition: false,
      position: 'middle', autoAdjust: true, autoHide: true,
    },
    slider: { showSlider: false },
    tooltip: { showTooltip: true },
  };
}

function buildLineChartSettings() {
  return {
    container: { height: 248 },
    style: {
      mode: 'none', smooth: false, showPoint: true, pointSize: 4,
      pointShape: 'circle', showLine: true, lineWidth: 2, showArea: false,
      colorType: 'SCHEMA_COLOR', chartColorsMode: 'defaultColorsMode',
      customColor: '#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C',
    },
    axisType: 'hz',
    xAxis: {
      showXAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: true, tickLine: true, grid: false, label: true,
      labelStyle: {
        labelType: 'default', color: 'rgba(23,26,29,0.4)', fontSize: 12,
        limitLengthType: 'percent', percent: 30, value: 100,
        autoRotate: true, rotate: '0', autoHide: true,
      },
      values: { type: 'i18n', zh_CN: '', en_US: '' },
    },
    yAxis: {
      showYAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: false, tickLine: false, grid: true, label: true,
      labelStyle: {
        labelType: 'default', color: 'rgba(23,26,29,0.4)', fontSize: 12,
        limitLengthType: 'percent', percent: 30, value: 100,
        autoRotate: true, rotate: '0', autoHide: true,
      },
      min: null, max: null, tickCount: 5,
    },
    legend: { showLegend: true, legendPosition: 'top-left', flipPage: true },
    label: { showLabel: true, fontSize: 12, color: '#000', autoOverlap: true },
    slider: { showSlider: false },
    tooltip: { showTooltip: true },
  };
}

function buildPieChartSettings() {
  return {
    container: { height: 248 },
    style: {
      radius: 75, isRing: false, innerRadius: 0,
      colorType: 'SCHEMA_COLOR', chartColorsMode: 'defaultColorsMode',
      customColor: '#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C',
    },
    statistic: { showStatistic: false },
    label: {
      showLabel: true, showLine: true, labelAlign: 'outer',
      labelSize: 12, labelColor: '#404040', labelFormatType: 'NAME_PERCENT',
    },
    legend: {
      showLegend: true, legendPosition: 'right', flipPage: true,
      type: 'item', contentType: 'NAME', cardWidth: null,
      ratio: 65, layout: 'vertical', itemSpacing: 12,
    },
    tooltip: { showTooltip: true, contentType: null },
    percentDigits: 2,
  };
}

function buildScatterChartSettings() {
  return {
    container: { height: 248 },
    style: {
      pointSize: 4, pointShape: 'circle',
      colorType: 'SCHEMA_COLOR', chartColorsMode: 'defaultColorsMode',
      customColor: '#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C',
    },
    axisType: 'hz',
    xAxis: {
      showXAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: true, tickLine: true, grid: false, label: true,
    },
    yAxis: {
      showYAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: false, tickLine: false, grid: true, label: true,
      min: null, max: null, tickCount: 5,
    },
    legend: { showLegend: true, legendPosition: 'top-left', flipPage: true },
    tooltip: { showTooltip: true },
  };
}

function buildAreaChartSettings() {
  const s = buildLineChartSettings();
  s.style.showArea = true;
  return s;
}

function buildFunnelChartSettings() {
  return {
    container: { height: 248 },
    style: {
      colorType: 'SCHEMA_COLOR', chartColorsMode: 'defaultColorsMode',
      customColor: '#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C',
    },
    legend: { showLegend: true, legendPosition: 'top-left', flipPage: true },
    label: { showLabel: true, fontSize: 12, color: '#000' },
    tooltip: { showTooltip: true },
  };
}

function buildRadarChartSettings() {
  return {
    container: { height: 248 },
    style: {
      colorType: 'SCHEMA_COLOR', chartColorsMode: 'defaultColorsMode',
      customColor: '#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C',
      showArea: true, smooth: false, pointSize: 4, lineWidth: 2,
    },
    legend: { showLegend: true, legendPosition: 'top-left', flipPage: true },
    label: { showLabel: false, fontSize: 12, color: '#000' },
    tooltip: { showTooltip: true },
  };
}

function buildGaugeChartSettings() {
  return {
    container: { height: 248 },
    useSingleColor: false, singleColor: '#0089FF', color: [],
    tick: { showTick: true, min: null, max: null, tickInterval: null },
    assistValue: { openAssistValue: true, showCompare: false, position: 'bottom' },
    style: { rounded: true, pivot: true, rangeSize: 16, radius: 95, innerRadius: 90 },
  };
}

function buildTableSettings() {
  return {
    rglConfig: { w: 6, h: 21, isHeightAuto: true },
    size: 'medium', wordSize: 'medium:14', theme: 'split',
    mergeCell: false, fixedHeader: false, maxBodyHeight: '300',
    fixedColumnIndex: 1, isReverseTable: false, showReversedHeader: false,
    isUniqueRows: false,
    pagination: {
      isPagination: false, pageSize: 10, size: 'small',
      type: 'normal', pageShowCount: 5, showPageSelect: false,
    },
    isTree: false, idField: null, pidField: null, isLeaf: null,
    drilldownFilterList: null, defaultExpand: false, rankStyle: false,
    container: { height: 472 },
    titleTip: false, showCopyData: false, enableFieldSelect: false,
    defaultSelectedFields: '', hasFullscreen: false, copyAsImg: false,
    height: null, isHeightAuto: true,
  };
}

function buildComboChartSettings() {
  return {
    container: { height: 248 },
    style: {
      sync: false, chartType: 'bar-line',
      bar: {
        size: null, maxSize: null, minSize: null, mode: 'group',
        barBackground: null, radiusLeftTop: 4, radiusRightTop: 4,
        radiusRightBottom: 0, radiusLeftBottom: 0,
      },
      line: { size: 2, smooth: false, showPoint: true, pointSize: 4, pointShape: 'circle' },
      autoAdjust: true,
      colorType: 'SCHEMA_COLOR', chartColorsMode: 'defaultColorsMode',
      customColor: '#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C',
    },
    xAxis: {
      showXAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: true, tickLine: true, grid: false, label: true,
      labelStyle: {
        labelType: 'default', color: 'rgba(23,26,29,0.4)', fontSize: 12,
        limitLengthType: 'percent', percent: 30, value: 100,
        autoRotate: true, rotate: '0', autoHide: true,
      },
      values: { type: 'i18n', zh_CN: '', en_US: '' },
    },
    leftYAxis: {
      showLeftYAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: false, tickLine: false, grid: true, label: true,
      labelStyle: {
        labelType: 'default', color: 'rgba(23,26,29,0.4)', fontSize: 12,
        limitLengthType: 'percent', percent: 30, value: 100,
        autoRotate: true, rotate: '0', autoHide: true,
      },
      min: null, max: null, tickCount: 5,
    },
    rightYAxis: {
      showRightYAxis: true, showTitle: false,
      title: { type: 'i18n', zh_CN: '', en_US: '' },
      line: false, tickLine: false, label: true,
      labelStyle: {
        labelType: 'default', color: 'rgba(23,26,29,0.4)', fontSize: 12,
        limitLengthType: 'percent', percent: 30, value: 100,
        autoRotate: true, rotate: '0', autoHide: true,
      },
      min: null, max: null, tickCount: 5,
    },
    legend: { showLegend: true, legendPosition: 'top-left', flipPage: true },
    leftLabel: { showLabel: true, fontSize: 12, color: '#000' },
    rightLabel: { showLabel: true, fontSize: 12, color: '#000' },
    slider: { showSlider: false },
    tooltip: { showTooltip: true },
  };
}

function buildIndicatorSettings() {
  return {
    showSideStyle: 'NONE', followTheme: false, themeType: 'dark',
    showSideBorder: true, sideBarColor: '#0089FF',
    bgColorType: 'single', singleBgColor: '#F1F2F3',
    colorType: 'SCHEMA_COLOR', multipleBgColor: 'defaultColorsMode',
    customColor: '#0089FF,#FF9200,#11AB4F,#FFD100,#7263EE,#67C5EB,#6B748C,#FF755A,#007E99,#FFA8A8',
    size: 'normal', valueSize: '20px', titleMaxRow: 0,
    columnCount: 4, columnCountForH5: 2, popoverAlign: 'b',
    container: { height: 72 },
    titleTip: false, enableFieldSelect: false, hasFullscreen: false,
    copyAsImg: false, height: null, isHeightAuto: true,
  };
}

function buildPivotSettings() {
  return {
    rglConfig: { w: 6, h: 21, isHeightAuto: true },
    maxBodyHeight: 500, size: 'normal',
    rows: [], columns: [], measures: [], details: [],
    supportExport: false, exportType: 'XJZ',
    dialogWidth: 850, dialogPageSize: 10,
    baseInfo: {
      isShowSetter: true, isShowFilter: false, isShowReload: false,
      isHideTitle: false, isMeasureOrder: true, isZebra: true,
      rowMaxSize: 3000, columnsMaxSize: 500, columnWidth: 100,
      dialogWidth: 850, dialogPageSize: 10,
      detailExportData: { supportExport: false, exportType: 'BROWSER' },
    },
    mode: 'summary',
    summaryInfo: {
      isRowTotal: true, rowTotalWidth: 130, rowTotalPosition: 'end',
      isColumnTotal: true, isSubTotal: false,
      rowMaxSize: 3000, columnsMaxSize: 500,
    },
    paginationInfo: {
      size: 'small', type: 'normal', pageShowCount: 5,
      pageSize: 10, showPageSelect: false,
    },
    container: { height: 232 },
    titleTip: false, hasFullscreen: false, copyAsImg: false,
    height: null, isHeightAuto: true,
  };
}

function buildNumberChartSettings() {
  return {
    container: { height: 120 },
    style: { fontSize: 36, color: '#1a1a1a', unit: '', colorType: 'SCHEMA_COLOR' },
    tooltip: { showTooltip: false },
  };
}

/**
 * 根据图表类型获取 settings
 */
function getChartSettings(chartType) {
  switch (chartType) {
    case 'bar':       return buildBarChartSettings();
    case 'line':      return buildLineChartSettings();
    case 'pie':       return buildPieChartSettings();
    case 'scatter':   return buildScatterChartSettings();
    case 'area':      return buildAreaChartSettings();
    case 'funnel':    return buildFunnelChartSettings();
    case 'radar':     return buildRadarChartSettings();
    case 'gauge':     return buildGaugeChartSettings();
    case 'combo':     return buildComboChartSettings();
    case 'table':     return buildTableSettings();
    case 'indicator': return buildIndicatorSettings();
    case 'pivot':     return buildPivotSettings();
    case 'number':    return buildNumberChartSettings();
    default:          return buildBarChartSettings();
  }
}

// ── userConfig 构建 ───────────────────────────────────

function buildUserConfig(chartType) {
  if (chartType === 'pie') {
    return { chartType: 'pie', dataConfig: { xField: [], yField: [], ratio: [], totalValue: [], totalRatio: [] } };
  }
  if (chartType === 'funnel') {
    return { chartType: 'funnel', dataConfig: { xField: [], yField: [] } };
  }
  if (chartType === 'radar') {
    return { chartType: 'radar', dataConfig: { xField: [], yField: [], groupField: [] } };
  }
  if (chartType === 'gauge') {
    return { chartType: 'gauge', dataConfig: { valueField: [], assitValueField: [] } };
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
  if (chartType === 'number') {
    return { chartType: 'number', dataConfig: { valueField: [] } };
  }
  // 默认：bar/line/scatter/area
  return { chartType: chartType || 'bar', dataConfig: { xField: [], yField: [], groupField: [], annotationField: [] } };
}

/**
 * 构建带字段信息的 userConfig（数组格式，与宜搭报表设计器一致）
 *
 * 宜搭报表引擎期望 userConfig 为数组格式：
 * [{name: 'chartData', title: '配置数据', items: [{setterName: 'ColumnFieldSetter', ...}]}]
 * 指标卡已经是数组格式，其他图表类型需要转换。
 */
function buildUserConfigWithFields(chartType, dataSetModelMap) {
  // 指标卡已经是正确的数组格式
  if (chartType === 'indicator') {
    return buildUserConfig(chartType);
  }

  // 饼图
  if (chartType === 'pie') {
    const chartData = dataSetModelMap.chartData || {};
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
          tip: { content: '在开启【环形图】时显示，一般用于显示各分类值的总和' },
          setterProps: { single: true, showFormatTab: true, showEditTab: true } },
        { setterName: 'ColumnFieldSetter', name: 'totalRatio', title: '总趋势值字段',
          tip: { content: '在开启【环形图】时显示，一般用于提示各分类值总和的变化趋势' },
          setterProps: { showFormatTab: true, showEditTab: true } },
      ],
    }];
  }

  // 柱状图 / 折线图 / 面积图 / 散点图 / 雷达图 / 漏斗图
  if (['bar', 'line', 'area', 'scatter', 'radar', 'funnel'].includes(chartType)) {
    const chartData = dataSetModelMap.chartData || {};
    const items = [
      { setterName: 'ColumnFieldSetter', name: 'xField', title: '横轴',
        setterProps: { single: true, showFormatTab: true, showFormulaEditor: true, showFieldInfo: true, showAggregateTab: false, showDrillTab: true, showEditTab: true, showSortTab: true } },
      { setterName: 'ColumnFieldSetter', name: 'yField', title: '纵轴',
        setterProps: { showFormatTab: true, showFormulaEditor: true, showFieldInfo: true, showEditTab: true, showSortTab: true, showDataLink: true } },
    ];
    if (chartType !== 'funnel') {
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

  // 默认回退
  return buildUserConfig(chartType);
}

// ── mockData ──────────────────────────────────────────

function buildMockData(chartType) {
  if (chartType === 'bar') {
    return [{
      name: 'chartData',
      data: {
        data: [
          { month: 'Jan.', value: 18.9 }, { month: 'Feb.', value: 28.8 },
          { month: 'Mar.', value: 39.3 }, { month: 'Apr.', value: 81.4 },
          { month: 'May', value: 47 },
        ],
        meta: [
          { aliasName: '月份', alias: 'month', category: 'xField', dataType: 'STRING' },
          { aliasName: '数值', alias: 'value', category: 'yField', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 5,
      },
    }];
  }
  if (chartType === 'line' || chartType === 'area') {
    return [{
      name: 'chartData',
      data: {
        data: [
          { xField: '2020', yField: 3 }, { xField: '2021', yField: 4 },
          { xField: '2022', yField: 3.5 }, { xField: '2023', yField: 5 },
          { xField: '2024', yField: 4.9 },
        ],
        meta: [
          { aliasName: '横轴', alias: 'xField', category: 'xField', dataType: 'STRING' },
          { aliasName: '纵轴', alias: 'yField', category: 'yField', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 5,
      },
    }];
  }
  if (chartType === 'pie') {
    return [{
      name: 'chartData',
      data: {
        data: [
          { xField: '分类A', yField: 63, ratio: 0.8, totalValue: 202, totalRatio: 0.32 },
          { xField: '分类B', yField: 73, ratio: -0.3, totalValue: 202, totalRatio: 0.32 },
          { xField: '分类C', yField: 66, ratio: 0.25, totalValue: 202, totalRatio: 0.32 },
        ],
        meta: [
          { aliasName: '分类字段', alias: 'xField', category: 'xField', dataType: 'STRING' },
          { aliasName: '数值字段', alias: 'yField', category: 'yField', dataType: 'NUMBER' },
          { aliasName: '趋势值字段', alias: 'ratio', category: 'ratio', dataType: 'NUMBER' },
          { aliasName: '总值字段', alias: 'totalValue', category: 'totalValue', dataType: 'NUMBER' },
          { aliasName: '总趋势值字段', alias: 'totalRatio', category: 'totalRatio', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 3,
      },
    }];
  }
  if (chartType === 'funnel') {
    return [{
      name: 'chartData',
      data: {
        data: [
          { xField: '展示', yField: 100 }, { xField: '点击', yField: 80 },
          { xField: '访问', yField: 60 }, { xField: '咨询', yField: 40 },
          { xField: '订单', yField: 20 },
        ],
        meta: [
          { aliasName: '阶段', alias: 'xField', category: 'xField', dataType: 'STRING' },
          { aliasName: '数量', alias: 'yField', category: 'yField', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 5,
      },
    }];
  }
  if (chartType === 'radar') {
    return [{
      name: 'chartData',
      data: {
        data: [
          { xField: '销售', yField: 80 }, { xField: '管理', yField: 65 },
          { xField: '技术', yField: 90 }, { xField: '客服', yField: 70 },
          { xField: '研发', yField: 85 },
        ],
        meta: [
          { aliasName: '维度', alias: 'xField', category: 'xField', dataType: 'STRING' },
          { aliasName: '数值', alias: 'yField', category: 'yField', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 5,
      },
    }];
  }
  if (chartType === 'gauge') {
    return [{
      name: 'chartData',
      data: {
        data: [{ value: 75, assitValue: 100 }],
        meta: [
          { aliasName: '当前值', alias: 'value', category: 'valueField', dataType: 'NUMBER' },
          { aliasName: '目标值', alias: 'assitValue', category: 'assitValueField', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 1,
      },
    }];
  }
  if (chartType === 'combo') {
    return [{
      name: 'dataSetName',
      data: {
        data: [
          { xField: 'Jan.', leftY: 18.9, rightY: 5 }, { xField: 'Feb.', leftY: 28.8, rightY: 8 },
          { xField: 'Mar.', leftY: 39.3, rightY: 12 }, { xField: 'Apr.', leftY: 81.4, rightY: 20 },
          { xField: 'May', leftY: 47, rightY: 15 },
        ],
        meta: [
          { aliasName: '月份', alias: 'xField', category: 'xField', dataType: 'STRING' },
          { aliasName: '销售额', alias: 'leftY', category: 'leftYFields', dataType: 'NUMBER' },
          { aliasName: '增长率', alias: 'rightY', category: 'rightYFields', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 5,
      },
    }];
  }
  if (chartType === 'table') {
    return [{
      name: 'table',
      data: {
        data: [
          { col1: '数据1', col2: '数据2', col3: 100 },
          { col1: '数据3', col2: '数据4', col3: 200 },
          { col1: '数据5', col2: '数据6', col3: 300 },
        ],
        meta: [
          { aliasName: '列1', alias: 'col1', category: 'columnFields', dataType: 'STRING' },
          { aliasName: '列2', alias: 'col2', category: 'columnFields', dataType: 'STRING' },
          { aliasName: '列3', alias: 'col3', category: 'columnFields', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 3,
      },
    }];
  }
  if (chartType === 'indicator') {
    return [{
      name: 'youshuData',
      data: {
        data: [{ randomKey1: 23123, randomKey2: 7712 }],
        meta: [
          { title: '指标1', fieldKey: 'randomKey1', category: 'kpi', dataType: 'STRING' },
          { title: '指标2', fieldKey: 'randomKey2', category: 'kpi', dataType: 'STRING' },
        ],
        currentPage: 1, totalCount: 1,
      },
    }];
  }
  if (chartType === 'pivot') {
    return [{
      name: 'dataSetName',
      data: {
        data: [
          { col1: 74, col2: 9, col3: 79 },
          { col1: 15, col2: 69, col3: 78 },
          { col1: 74, col2: 74, col3: 81 },
        ],
        meta: [
          { aliasName: '指标1', alias: 'col1', category: 'columnList', dataType: 'NUMBER' },
          { aliasName: '指标2', alias: 'col2', category: 'columnList', dataType: 'NUMBER' },
          { aliasName: '指标3', alias: 'col3', category: 'columnList', dataType: 'NUMBER' },
        ],
        currentPage: 1, totalCount: 3,
      },
    }];
  }
  return [{ name: 'chartData', data: { data: [], meta: [], currentPage: 1, totalCount: 0 } }];
}

// ── 构建报表 Schema ───────────────────────────────────

/**
 * 构建完整的报表 Schema
 */
function buildReportSchema(reportTitle, charts, reportId, cubeTenantId) {
  const pageNodeId = genNodeId();
  const rootHeaderId = genNodeId();
  const pageHeaderId = genNodeId();
  const pageHeaderContentId = genNodeId();
  const rootContentId = genNodeId();
  const rootFooterId = genNodeId();

  // 统一将每个 chart 的 cubeCode 从 formUuid 格式（连字符）转换为报表 cubeCode 格式（下划线）
  charts.forEach((chart) => {
    if (chart.cubeCode) {
      chart.cubeCode = normalizeCubeCode(chart.cubeCode);
    }
  });

  const usedComponentNames = new Set(BASE_COMPONENTS);
  charts.forEach((chart) => {
    const componentName = CHART_COMPONENT_MAP[chart.type] || CHART_COMPONENT_MAP.bar;
    usedComponentNames.add(componentName);
  });

  const indicatorDefaultUserConfig = [
    {
      name: 'youshuData',
      title: '指标数据',
      items: [
        {
          name: 'kpi', title: '指标', required: true,
          setterName: 'ColumnFieldSetter',
          setterProps: {
            single: false, showFormatTab: true, showSortTab: false, showDataLink: true,
            supportDynamicAlias: true, customTabs: [{ tabName: '指标配置' }],
            showBatchSet: true,
            batchSetFields: ['text', 'title', 'titleTip', 'aggregateType', 'format_type', 'format_decimalDigit', 'unit'],
          },
        },
        {
          name: 'helpKpi', title: '辅助指标',
          setterName: 'ColumnFieldSetter',
          setterProps: { single: false, showFormatTab: true, showSortTab: false, showDataLink: true },
        },
      ],
    },
  ];

  const componentsMap = Array.from(usedComponentNames).map((name) => {
    const entry = { package: '@/components/vc-yida-report', version: '1.0.6', componentName: name };
    if (name === 'YoushuSimpleIndicatorCard') {
      entry.userConfig = indicatorDefaultUserConfig;
    }
    return entry;
  });

  const chartChildren = [];
  const layoutItems = [];
  let currentX = 0;
  let currentRowY = 0;
  let currentRowHeight = 0;

  charts.forEach((chart, index) => {
    const componentName = CHART_COMPONENT_MAP[chart.type] || CHART_COMPONENT_MAP.bar;
    const fieldId = genFieldId(componentName);
    const nodeId = genNodeId();
    const chartTitle = chart.title || (componentName + '_' + (index + 1));
    const w = chart.w || 6;
    const h = chart.h || 22;

    // 当前行放不下时换行
    if (currentX + w > 6) {
      currentRowY += currentRowHeight;
      currentRowHeight = 0;
      currentX = 0;
    }

    layoutItems.push({
      w, h,
      x: currentX,
      y: currentRowY,
      i: fieldId,
      moved: false,
      static: false,
    });

    // 记录当前行最大高度
    if (h > currentRowHeight) {currentRowHeight = h;}

    currentX += w;
    if (currentX >= 6) {
      currentRowY += currentRowHeight;
      currentRowHeight = 0;
      currentX = 0;
    }

    const dataSetModelMap = buildDataSetModelMap(chart, cubeTenantId);
    const userConfig = buildUserConfigWithFields(chart.type, dataSetModelMap);

    chartChildren.push({
      componentName: componentName,
      id: nodeId,
      props: {
        cid: nodeId,
        showComponentTitle: true,
        componentTitle: { type: 'i18n', zh_CN: chartTitle, en_US: '' },
        componentTitleTextAlign: 'LEFT',
        titleTipContent: { type: 'i18n', zh_CN: '', en_US: '' },
        titleTipIconName: 'help',
        headerSize: 'medium',
        link: buildLink(),
        exportData: buildExportData(),
        openRefresh: true,
        enabledCache: true,
        auth: [],
        fieldId: fieldId,
        afterFetch: buildAfterFetch(),
        __style__: {},
        mockData: buildMockData(chart.type),
        dataSetModelMap: dataSetModelMap,
        userConfig: userConfig,
        settings: getChartSettings(chart.type),
        titleTip: false,
        hasFullscreen: false,
        copyAsImg: false,
        height: null,
        isHeightAuto: ['table', 'indicator', 'pivot'].includes(chart.type),
        ...(['table', 'indicator'].includes(chart.type) ? { showFieldSelectIcon: true } : {}),
        datasetModel: { filterList: [] },
      },
    });
  });

  return {
    schemaType: 'superform',
    schemaVersion: '5.0',
    pages: [
      {
        utils: [],
        componentsMap: componentsMap,
        componentsTree: [
          {
            componentName: 'Page',
            id: pageNodeId,
            props: {
              templateVersion: '1.0.0',
              params: [],
              containerStyle: {},
              pageStyle: ':root {\n  background-color: #f2f3f5;\n}\n',
              userVariables: [
                { text: '工号', id: 'varWorkNo' },
                { text: '部门名称', id: 'varDeptName' },
                { text: '所属公司编号', id: 'varCorpNo' },
                { text: '部门编码', id: 'varDeptNo' },
              ],
              className: 'page_' + randomId(),
            },
            dataSource: {
              offline: [],
              globalConfig: {
                fit: {
                  compiled: "'use strict';\n\nvar __preParser__ = function fit(response) {\n  var content = response.content !== undefined ? response.content : response;\n  var error = {\n    message: response.errorMsg || response.errors && response.errors[0] && response.errors[0].msg || response.content || '远程数据源请求出错，success is false'\n  };\n  var success = true;\n  if (response.success !== undefined) {\n    success = response.success;\n  } else if (response.hasError !== undefined) {\n    success = !response.hasError;\n  }\n  return {\n    content: content,\n    success: success,\n    error: error\n  };\n};",
                  source: "function fit(response) {\r\n  const content = (response.content !== undefined) ? response.content : response;\r\n  const error = {\r\n    message: response.errorMsg ||\r\n      (response.errors && response.errors[0] && response.errors[0].msg) ||\r\n      response.content || '远程数据源请求出错，success is false',\r\n  };\r\n  let success = true;\r\n  if (response.success !== undefined) {\r\n    success = response.success;\r\n  } else if (response.hasError !== undefined) {\r\n    success = !response.hasError;\r\n  }\r\n  return {\r\n    content,\r\n    success,\r\n    error,\r\n  };\r\n}",
                  type: 'js',
                  error: {},
                },
              },
              online: [],
              list: [],
              sync: true,
            },
            methods: {
              __initMethods__: {
                type: 'js',
                source: 'function (exports, module) { /*set actions code here*/ }',
                compiled: 'function (exports, module) { /*set actions code here*/ }',
              },
            },
            lifeCycles: {
              componentDidMount: null,
              componentWillUnmount: null,
              constructor: {
                type: 'js',
                compiled: "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}",
                source: "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}",
              },
            },
            children: [
              {
                componentName: 'RootHeader',
                id: rootHeaderId,
                props: {},
                children: [
                  {
                    componentName: 'YoushuPageHeader',
                    id: pageHeaderId,
                    props: {
                      status: 'normal', showTitle: true,
                      titleContent: { type: 'i18n', zh_CN: reportTitle, en_US: reportTitle },
                      titleTip: { type: 'i18n', zh_CN: '', en_US: '' },
                      cid: pageHeaderId, tab: false,
                    },
                    children: [
                      { componentName: 'PageHeaderContent', id: pageHeaderContentId, props: {}, children: [] },
                      { componentName: 'PageHeaderTab', id: genNodeId(), props: {}, children: [] },
                    ],
                  },
                ],
              },
              {
                componentName: 'RootContent',
                id: rootContentId,
                props: { rglSwitch: true, contentBgColor: 'transparent', layout: layoutItems },
                children: chartChildren,
              },
              { componentName: 'RootFooter', id: rootFooterId, props: {} },
            ],
          },
        ],
        css: 'body {\n  background-color: #f2f3f5;\n}\n',
      },
    ],
    id: reportId || ('REPORT-' + randomId().toUpperCase() + randomId().toUpperCase()),
    actions: { module: { source: '', compiled: '' }, list: [] },
  };
}

// ── 筛选器组件构建 ───────────────────────────────────

/**
 * 构建下拉筛选器字段定义（用于 dataSetModelMap.selectFilter）
 */
function buildFilterFieldDef(cubeCode, alias, aliasNameZh, fieldCode, dataType, cubeTenantId) {
  return {
    cubeCode: cubeCode,
    isDim: false,
    alias: alias,
    aliasName: { type: 'i18n', zh_CN: aliasNameZh },
    classifiedCode: cubeCode,
    fieldCode: fieldCode,
    dataType: dataType || 'STRING',
    aggregateType: 'NONE',
    timeGranularityType: null,
    cubeTenantId: cubeTenantId || '',
  };
}

/**
 * 构建筛选器字段列表项（用于 fieldList/valueField/labelField）
 */
function buildFilterFieldListItem(cubeCode, alias, aliasNameZh, fieldCode, dataType) {
  return {
    title: { type: 'i18n', zh_CN: aliasNameZh },
    classifiedCode: cubeCode,
    cubeCode: cubeCode,
    fieldCode: fieldCode,
    isDimension: 'false',
    dataType: dataType || 'STRING',
    format: { type: 'NONE' },
    link: [{ type: 'NONE' }],
    drillList: [],
    aggregateType: 'NONE',
    orderBy: { type: 'NONE', reference: alias },
    fieldKey: alias,
    visible: true,
    beUsedTimes: 1,
    isVisible: 'y',
    id: fieldCode,
    text: aliasNameZh,
    measureType: 'MEASURE_ATTRIBUTE',
  };
}

/**
 * 构建下拉筛选器组件（YoushuSelectFilter）
 *
 * @param {object} filterDef 筛选器定义
 *   - cubeCode: 数据源表单 cubeCode
 *   - cubeTenantId: 租户 ID（corpId）
 *   - title: 筛选器标题（显示在筛选器上方）
 *   - placeholder: 占位文本
 *   - valueField: { fieldCode, aliasName, dataType } 查询字段（实际过滤用）
 *   - labelField: { fieldCode, aliasName, dataType } 显示字段（下拉展示用）
 *   - mockData: 可选，mock 数据数组
 * @param {string} filterNodeId 筛选器节点 ID
 * @param {string} filterFieldId 筛选器 fieldId
 */
function buildSelectFilter(filterDef, filterNodeId, filterFieldId) {
  const cubeCode = filterDef.cubeCode || '';
  const cubeTenantId = filterDef.cubeTenantId || '';
  const aliasValue = 'field_filter_value_' + randomId().slice(0, 4);
  const aliasLabel = 'field_filter_label_' + randomId().slice(0, 4);

  const valueFieldDef = filterDef.valueField || {};
  const labelFieldDef = filterDef.labelField || filterDef.valueField || {};

  const valueFieldItem = buildFilterFieldListItem(
    cubeCode, aliasValue,
    valueFieldDef.aliasName || '查询字段',
    valueFieldDef.fieldCode || '',
    valueFieldDef.dataType || 'STRING'
  );
  const labelFieldItem = buildFilterFieldListItem(
    cubeCode, aliasLabel,
    labelFieldDef.aliasName || '显示字段',
    labelFieldDef.fieldCode || valueFieldDef.fieldCode || '',
    labelFieldDef.dataType || 'STRING'
  );

  const dataSetModelMap = {
    selectFilter: {
      dataViewQueryModel: {
        cubeCode: cubeCode,
        fieldDefinitionList: [
          buildFilterFieldDef(cubeCode, aliasValue, valueFieldDef.aliasName || '查询字段', valueFieldDef.fieldCode || '', valueFieldDef.dataType || 'STRING', cubeTenantId),
          buildFilterFieldDef(cubeCode, aliasLabel, labelFieldDef.aliasName || '显示字段', labelFieldDef.fieldCode || valueFieldDef.fieldCode || '', labelFieldDef.dataType || 'STRING', cubeTenantId),
        ],
        fieldList: [aliasValue, aliasLabel],
        filterList: [],
        orderByList: [],
        cubeTenantId: cubeTenantId,
      },
      fieldList: [valueFieldItem, labelFieldItem],
      youshuDataType: 'real',
      cubeCodes: cubeCode ? [cubeCode] : [],
      valueField: [valueFieldItem],
      labelField: [labelFieldItem],
      defaultValue: { conditionType: 'EqualTo' },
      filterList: [],
      limit: '',
      mockData: [],
    },
  };

  const mockData = filterDef.mockData || [
    { field_filter_value: '选项A', field_filter_label: 'A' },
    { field_filter_value: '选项B', field_filter_label: 'B' },
  ];

  return {
    componentName: 'YoushuSelectFilter',
    id: filterNodeId,
    props: {
      cid: filterNodeId,
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
              { aliasName: valueFieldDef.aliasName || '查询字段', alias: aliasValue, category: 'valueField' },
              { aliasName: labelFieldDef.aliasName || '显示字段', alias: aliasLabel, category: 'labelField' },
            ],
            currentPage: 1,
            totalCount: mockData.length,
          },
        },
      ],
      dataSetModelMap: dataSetModelMap,
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
 * @param {object} dataSetModelMap 图表的 dataSetModelMap
 * @param {object} filterMeta buildSelectFilter 返回的 __filterMeta__
 * @param {string} filterFieldCode 被筛选的字段 fieldCode（在图表数据源中）
 * @param {string} cubeCode 数据源 cubeCode
 * @param {string} cubeTenantId 租户 ID
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
      fieldCode: filterFieldCode,
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
  buildAfterFetch,
  buildExportData,
  buildLink,
  buildFieldObj,
  buildDataViewQueryModel,
  buildDataSetModelMap,
  buildUserConfig,
  buildUserConfigWithFields,
  buildMockData,
  getChartSettings,
  buildReportSchema,
  buildSelectFilter,
  buildFilterContainer,
  buildFilterFieldListItem,
  injectFilterLinkage,
};
