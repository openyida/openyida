'use strict';

const {
  CHART_COMPONENT_MAP,
  BASE_COMPONENTS,
  randomId,
  genNodeId,
  genFieldId,
} = require('./constants');

const {
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
} = require('./field-utils');

const {
  buildDataViewQueryModel,
  buildDataSetModelMap,
} = require('./data-model');

const {
  buildFilterFieldDef,
  buildFilterFieldListItem,
  buildSelectFilter,
  buildFilterContainer,
  injectFilterLinkage,
} = require('./filter-builder');

// ── 图表配置验证 ───────────────────────────────────

function validateChartConfig(chart, chartIndex) {
  const chartLabel = `图表${chartIndex + 1} [${chart.type || 'bar'}] "${chart.title || '未命名'}"`;
  let hasError = false;

  if (!chart.cubeCode) {
    console.error(`⚠️  ${chartLabel}: 缺少 cubeCode（数据源），报表将无法查询数据。请通过 openyida get-schema 获取表单的 formUuid，将连字符替换为下划线作为 cubeCode。`);
    hasError = true;
  }

  const chartType = chart.type || 'bar';

  if (['bar', 'line', 'pie', 'funnel', 'radar', 'heatmap', 'wordcloud', 'map'].includes(chartType)) {
    if (!chart.xField && !chart.yField) {
      console.error(`⚠️  ${chartLabel}: 缺少 xField 和 yField，图表将没有数据字段。`);
      hasError = true;
    }
  }

  if (chartType === 'table') {
    if (!chart.columnFields && !chart.columns && !chart.fields) {
      console.error(`⚠️  ${chartLabel}: 缺少 columnFields，表格将没有列。`);
      hasError = true;
    }
  }

  if (chartType === 'indicator') {
    if (!chart.kpi && !chart.kpiField && !chart.yField && !chart.fields) {
      console.error(`⚠️  ${chartLabel}: 缺少 kpi/kpiField 字段，指标卡将没有指标数据。`);
      hasError = true;
    }
  }

  if (chartType === 'combo') {
    if (!chart.xField) {
      console.error(`⚠️  ${chartLabel}: 缺少 xField，组合图需要横轴字段。`);
    }
    if (!chart.leftYFields && !chart.rightYFields) {
      console.error(`⚠️  ${chartLabel}: 缺少 leftYFields/rightYFields，组合图需要至少一个纵轴字段。`);
      hasError = true;
    }
  }

  if (chartType === 'pivot') {
    if (!chart.columnList && !chart.columns) {
      console.error(`⚠️  ${chartLabel}: 缺少 columnList，透视表将没有列。`);
      hasError = true;
    }
  }

  if (chartType === 'gauge') {
    if (!chart.valueField && !chart.yField) {
      console.error(`⚠️  ${chartLabel}: 缺少 valueField/yField，仪表盘将没有数值。`);
      hasError = true;
    }
  }

  return !hasError;
}

// ── 图表 Settings 构建 ───────────────────────────────

function buildBarChartSettings() {
  return {
    container: { height: 248 },
    style: {
      size: null, maxSize: null, minSize: null, mode: 'group',
      barBackground: null, radiusLeftTop: 4, radiusRightTop: 4,
      radiusRightBottom: 0, radiusLeftBottom: 0,
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

  // 柱状图 / 折线图 / 面积图 / 散点图 / 雷达图 / 漏斗图
  if (['bar', 'line', 'area', 'scatter', 'radar', 'funnel'].includes(chartType)) {
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

// ── 提取顶层字段属性 ─────────────────────────────────

/**
 * 从 dataSetModelMap 提取顶层字段属性
 *
 * 返回结果用于组件渲染：
 *   1. props.dataSetModelMap.{dataSetKey}.xField — 数据查询用
 *   2. props.xField — 组件渲染用
 *
 * 不同图表类型使用不同的数据集 key 和字段属性名：
 *   - bar/line/pie/funnel 等: chartData → xField, yField, groupField
 *   - indicator: youshuData → kpi, helpKpi
 *   - table: table → columnFields
 *   - combo: dataSetName → xField, leftYFields, rightYFields
 *   - pivot: dataSetName → columnList
 *   - gauge: chartData → valueField, assitValueField
 */
function extractTopLevelFieldProps(chartType, dataSetModelMap) {
  const result = {};

  if (chartType === 'indicator') {
    const ds = dataSetModelMap.youshuData;
    if (ds) {
      if (ds.kpi) { result.kpiField = ds.kpi; }
      if (ds.helpKpi) { result.helpKpiField = ds.helpKpi; }
    }
    return result;
  }

  if (chartType === 'table') {
    const ds = dataSetModelMap.table;
    if (ds) {
      if (ds.columnFields) { result.columnField = ds.columnFields; }
    }
    return result;
  }

  if (chartType === 'combo') {
    const ds = dataSetModelMap.dataSetName;
    if (ds) {
      if (ds.xField) { result.xField = ds.xField; }
      if (ds.leftYFields) { result.leftYFields = ds.leftYFields; }
      if (ds.rightYFields) { result.rightYFields = ds.rightYFields; }
    }
    return result;
  }

  if (chartType === 'pivot') {
    const ds = dataSetModelMap.dataSetName;
    if (ds) {
      if (ds.columnList) { result.columnList = ds.columnList; }
    }
    return result;
  }

  if (chartType === 'gauge') {
    const ds = dataSetModelMap.chartData;
    if (ds) {
      if (ds.valueField) { result.valueField = ds.valueField; }
      if (ds.assitValueField) { result.assitValueField = ds.assitValueField; }
    }
    return result;
  }

  // 通用图表（bar/line/pie/funnel 等）
  const ds = dataSetModelMap.chartData;
  if (ds) {
    if (ds.xField) { result.xField = ds.xField; }
    if (ds.yField) { result.yField = ds.yField; }
    if (ds.groupField) { result.groupField = ds.groupField; }
  }
  return result;
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
    const defaultLayout = getDefaultLayout(chart.type);
    const w = (chart.w != null) ? chart.w : defaultLayout.w;
    const h = (chart.h != null) ? chart.h : defaultLayout.h;

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

// ── 统一导出 ─────────────────────────────────────────

module.exports = {
  // 从子模块 re-export 的函数
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
  buildDataViewQueryModel,
  buildDataSetModelMap,
  buildFilterFieldDef,
  buildFilterFieldListItem,
  buildSelectFilter,
  buildFilterContainer,
  injectFilterLinkage,
  // 本模块定义的函数
  validateChartConfig,
  buildBarChartSettings,
  buildLineChartSettings,
  buildPieChartSettings,
  buildScatterChartSettings,
  buildAreaChartSettings,
  buildFunnelChartSettings,
  buildRadarChartSettings,
  buildGaugeChartSettings,
  buildTableSettings,
  buildComboChartSettings,
  buildIndicatorSettings,
  buildPivotSettings,
  buildNumberChartSettings,
  getChartSettings,
  buildUserConfig,
  buildUserConfigWithFields,
  buildMockData,
  extractTopLevelFieldProps,
  buildReportSchema,
};
