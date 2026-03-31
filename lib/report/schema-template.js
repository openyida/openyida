/**
 * vc-yida-report 图表组件 Schema 构建脚本
 * 组件库：//g.alicdn.com/code/npm/@ali/vc-yida-report/1.0.101/pc.js
 *
 * 使用方式：
 *   const { buildSchema } = require('./build-yida-report-schema');
 *   const schema = buildSchema.lineChart({ cubeCode: 'xxx', fieldList: ['date', 'value'] });
 *   console.log(JSON.stringify(schema, null, 2));
 */

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成唯一组件 ID
 * @param {string} prefix - 组件名前缀
 */
function generateComponentId(prefix) {
  return prefix + '_' + Math.random().toString(36).substring(2, 10);
}

/** 构建 dataViewQueryModel（数据查询模型）
 * @param {object} options - { cubeCode, fieldDefinitionList, fieldList, filterList, orderByList }
 */
function buildDataViewQueryModel({
  cubeCode = '',
  fieldDefinitionList = [],
  fieldList = [],
  filterList = [],
  orderByList = [],
} = {}) {
  return {
    cubeCode,
    fieldDefinitionList,
    fieldList,
    filterList,
    orderByList,
  };
}

/** 构建单个字段定义（fieldDefinition）
 * @param {object} options - { cubeCode, isDim(false), alias, aliasName, classifiedCode, fieldCode, expression, dataType(STRING), aggregateType(NONE), timeGranularityType(null) }
 */
function buildFieldDefinition({
  cubeCode = '',
  isDim = false,
  alias = '',
  aliasName = '',
  classifiedCode = '',
  fieldCode = '',
  expression = '',
  dataType = 'STRING',
  aggregateType = 'NONE',
  timeGranularityType = null,
} = {}) {
  return {
    cubeCode,
    isDim,
    alias,
    aliasName: aliasName || alias,
    classifiedCode,
    fieldCode: fieldCode || alias,
    expression,
    dataType,
    aggregateType,
    timeGranularityType,
  };
}

/** 构建过滤条件（filterItem）
 * @param {object} options - { filterKey, alias, conditionType(EqualTo), value }
 */
function buildFilterItem({ filterKey = '', alias = '', conditionType = 'EqualTo', value = null } = {}) {
  return { filterKey: filterKey || alias, alias, conditionType, value };
}

/** 构建排序项（orderByItem）
 * @param {string} alias - 字段别名
 * @param {string} orderType - 排序方向：ASC | DESC
 */
function buildOrderByItem(alias, orderType = 'ASC') {
  return { alias, orderType };
}

/** 构建 dataSetModelMap 中的单个数据集配置
 * @param {object} options - { dataSetName, cubeCode, fieldDefinitionList, fieldList, filterList, orderByList, limit(1000), cubeCodes, valueField, labelField, defaultValue }
 */
function buildDataSetEntry({
  cubeCode = '',
  fieldDefinitionList = [],
  fieldList = [],
  filterList = [],
  orderByList = [],
  limit = 1000,
  cubeCodes,
  valueField,
  labelField,
  defaultValue,
} = {}) {
  const entry = {
    dataViewQueryModel: buildDataViewQueryModel({ cubeCode, fieldDefinitionList, fieldList, filterList, orderByList }),
    limit,
  };
  if (cubeCodes !== undefined) entry.cubeCodes = cubeCodes;
  if (valueField !== undefined) entry.valueField = valueField;
  if (labelField !== undefined) entry.labelField = labelField;
  if (defaultValue !== undefined) entry.defaultValue = defaultValue;
  return entry;
}

// ─────────────────────────────────────────────
// 各组件 Schema 构建函数
// ─────────────────────────────────────────────

const buildSchema = {

  /** 指标卡 - YoushuSimpleIndicatorCard
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: columnCount(4), columnCountForH5(2), colorType, customColor
   */
  simpleIndicatorCard({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuSimpleIndicatorCard',
      componentId: componentId || generateComponentId('simpleIndicatorCard'),
      props: {
        dataSetModelMap,
        settings: {
          columnCount: 4,
          columnCountForH5: 2,
          colorType: 'default',
          customColor: '',
          ...settings,
        },
      },
    };
  },

  /** 折线图 - YoushuLineChart
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), smooth(false), isStack(false), isPercent(false), drillDown(false), limit(1000), lineWidth(2), labelConfig
   */
  lineChart({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuLineChart',
      componentId: componentId || generateComponentId('lineChart'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          smooth: false,
          isStack: false,
          isPercent: false,
          drillDown: false,
          limit: 1000,
          colorType: 'default',
          customColor: '',
          lineWidth: 2,
          labelConfig: { showLabel: false },
          ...settings,
        },
      },
    };
  },

  /** 饼图 - YoushuPieChart
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), innerRadius(0), startAngle(-Math.PI/2), endAngle(3*Math.PI/2), drillDown(false), limit(1000), labelConfig
   */
  pieChart({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuPieChart',
      componentId: componentId || generateComponentId('pieChart'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          innerRadius: 0,
          startAngle: -Math.PI / 2,
          endAngle: (3 * Math.PI) / 2,
          drillDown: false,
          limit: 1000,
          colorType: 'default',
          customColor: '',
          labelConfig: { showLabel: true },
          ...settings,
        },
      },
    };
  },

  /** 分组条形图 - YoushuGroupedBarChart
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), isStack(false), isPercent(false), drillDown(false), limit(1000), labelConfig
   */
  groupedBarChart({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuGroupedBarChart',
      componentId: componentId || generateComponentId('groupedBarChart'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          isStack: false,
          isPercent: false,
          drillDown: false,
          limit: 1000,
          colorType: 'default',
          customColor: '',
          labelConfig: { showLabel: false },
          ...settings,
        },
      },
    };
  },

  /** 漏斗图 - YoushuFunnelChart
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), drillDown(false), limit(1000), labelConfig
   */
  funnelChart({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuFunnelChart',
      componentId: componentId || generateComponentId('funnelChart'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          drillDown: false,
          limit: 1000,
          colorType: 'default',
          customColor: '',
          labelConfig: { showLabel: true },
          ...settings,
        },
      },
    };
  },

  /** 仪表盘 - YoushuGauge
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), min(0), max(100), range([0.3,0.6,1]), colorType
   */
  gauge({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuGauge',
      componentId: componentId || generateComponentId('gauge'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          min: 0,
          max: 100,
          range: [0.3, 0.6, 1],
          colorType: 'default',
          customColor: '',
          ...settings,
        },
      },
    };
  },

  /** 雷达图 - YoushuRadarChart
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), max(100), opacity(0.3), drillDown(false)
   */
  radarChart({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuRadarChart',
      componentId: componentId || generateComponentId('radarChart'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          max: 100,
          opacity: 0.3,
          drillDown: false,
          colorType: 'default',
          customColor: '',
          ...settings,
        },
      },
    };
  },

  /** 热力图 - YoushuHeatmap
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), drillDown(false)
   */
  heatmap({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuHeatmap',
      componentId: componentId || generateComponentId('heatmap'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          drillDown: false,
          colorType: 'default',
          customColor: '',
          ...settings,
        },
      },
    };
  },

  /** 日历热力图 - YoushuCalendarHeatmap
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(200)
   */
  calendarHeatmap({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuCalendarHeatmap',
      componentId: componentId || generateComponentId('calendarHeatmap'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 200,
          colorType: 'default',
          customColor: '',
          ...settings,
        },
      },
    };
  },

  /** 组合图 - YoushuComboChart（柱状图 + 折线图）
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), drillDown(false), limit(1000)
   */
  comboChart({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuComboChart',
      componentId: componentId || generateComponentId('comboChart'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          drillDown: false,
          limit: 1000,
          colorType: 'default',
          customColor: '',
          ...settings,
        },
      },
    };
  },

  /** 词云图 - YoushuWordCloud
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(300), limit(100), drillDown(false)
   */
  wordCloud({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuWordCloud',
      componentId: componentId || generateComponentId('wordCloud'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 300,
          limit: 100,
          drillDown: false,
          colorType: 'default',
          customColor: '',
          ...settings,
        },
      },
    };
  },

  /** 地图 - YoushuMap
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(400), drillDown(false)
   */
  map({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuMap',
      componentId: componentId || generateComponentId('map'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 400,
          drillDown: false,
          colorType: 'default',
          customColor: '',
          ...settings,
        },
      },
    };
  },

  /** 交叉透视表 - YoushuCrossPivotTable
   * @param {object} options - { componentId, dataSetModelMap, settings }
   * settings: titleConfig.label, height(400), drillDown(false)
   */
  crossPivotTable({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuCrossPivotTable',
      componentId: componentId || generateComponentId('crossPivotTable'),
      props: {
        dataSetModelMap,
        settings: {
          titleConfig: { label: '' },
          height: 400,
          drillDown: false,
          ...settings,
        },
      },
    };
  },

  /** 基础表格 - YoushuTable
   * @param {object} options - { componentId, dataSetModelMap(key:"table"), settings }
   * settings: fixedHeader(false), theme(split), maxBodyHeight(300), pagination.pageSize(10), showPageSelect(false), pageSizeList
   */
  table({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuTable',
      componentId: componentId || generateComponentId('table'),
      props: {
        dataSetModelMap,
        settings: {
          fixedHeader: false,
          theme: 'split',
          maxBodyHeight: 300,
          pagination: {
            pageSize: 10,
            showPageSelect: false,
            pageSizeList: [10, 20, 50, 100],
            shape: 'arrow-only',
          },
          ...settings,
        },
      },
    };
  },

  /** 页面标题栏 - YoushuPageHeader
   * @param {object} options - { componentId, tab(false), display(normal), showTitle(true), titleContent, titleTip, waiter(false), children }
   */
  pageHeader({
    componentId,
    tab = false,
    display = 'normal',
    showTitle = true,
    titleContent = '',
    titleTip = '',
    waiter = false,
    children = [],
  } = {}) {
    return {
      componentName: 'YoushuPageHeader',
      componentId: componentId || generateComponentId('pageHeader'),
      props: {
        tab,
        display,
        showTitle,
        titleContent,
        titleTip,
        waiter,
      },
      children,
    };
  },

  /** 顶部筛选容器 - YoushuTopFilterContainer
   * @param {object} options - { componentId, style, showTag(false), children }
   */
  topFilterContainer({
    componentId,
    style = null,
    showTag = false,
    children = [],
  } = {}) {
    return {
      componentName: 'YoushuTopFilterContainer',
      componentId: componentId || generateComponentId('topFilterContainer'),
      props: {
        style,
        showTag,
        config: [],
      },
      children,
    };
  },

  /** 下拉筛选器 - YoushuSelectFilter
   * @param {object} options - { componentId, dataSetModelMap(key:"selectFilter"), settings }
   * settings: showLabel(false), height(300), labelConfig.label, mode(single), dataConfig.queryType(EqualTo), required(false)
   */
  selectFilter({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuSelectFilter',
      componentId: componentId || generateComponentId('selectFilter'),
      props: {
        dataSetModelMap,
        settings: {
          showLabel: false,
          height: 300,
          mode: 'single',
          labelConfig: { label: '' },
          dataConfig: { queryType: 'EqualTo', required: false },
          ...settings,
        },
      },
    };
  },

  /** 时间筛选器 - YoushuTimeFilter
   * @param {object} options - { componentId, dataSetModelMap(key:"filterData"), settings }
   * settings: labelConfig.label, mode(single), dataConfig.queryType(EqualTo), defaultValue
   */
  timeFilter({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuTimeFilter',
      componentId: componentId || generateComponentId('timeFilter'),
      props: {
        dataSetModelMap,
        settings: {
          labelConfig: { label: '' },
          mode: 'single',
          dataConfig: { queryType: 'EqualTo', isRange: false, required: false },
          ...settings,
        },
      },
    };
  },

  /** 区间筛选器 - YoushuInputFilter
   * @param {object} options - { componentId, dataSetModelMap(key:"filterData"), settings }
   * settings: labelConfig.label, dataConfig.isRange(false), contentConfig.placeholder
   */
  inputFilter({
    componentId,
    dataSetModelMap = {},
    settings = {},
  } = {}) {
    return {
      componentName: 'YoushuInputFilter',
      componentId: componentId || generateComponentId('inputFilter'),
      props: {
        dataSetModelMap,
        settings: {
          labelConfig: { label: '' },
          dataConfig: { isRange: false, queryType: 'Like', required: false },
          contentConfig: { placeholder: '请输入' },
          ...settings,
        },
      },
    };
  },
};

// ─────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────

module.exports = {
  buildSchema,
  buildDataSetEntry,
  buildFieldDefinition,
  buildFilterItem,
  buildOrderByItem,
  buildDataViewQueryModel,
  generateComponentId,
};
