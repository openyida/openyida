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

/**
 * 生成唯一组件 ID
 * @param {string} prefix - 组件名前缀
 */
function generateComponentId(prefix) {
  return prefix + '_' + Math.random().toString(36).substring(2, 10);
}

/**
 * 构建 dataViewQueryModel（数据查询模型）
 * @param {object} options
 * @param {string}   options.cubeCode              - 数据集 cubeCode（必填）
 * @param {Array}    options.fieldDefinitionList   - 字段定义列表
 * @param {Array}    options.fieldList             - 查询字段别名列表
 * @param {Array}    options.filterList            - 过滤条件列表
 * @param {Array}    options.orderByList           - 排序列表
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

/**
 * 构建单个字段定义（fieldDefinition）
 * @param {object} options
 * @param {string}  options.cubeCode             - 所属数据集 cubeCode
 * @param {boolean} options.isDim                - 是否为维度字段（true=维度，false=度量）
 * @param {string}  options.alias                - 字段别名（fieldKey）
 * @param {string}  options.aliasName            - 字段显示名称
 * @param {string}  options.classifiedCode       - 分类编码
 * @param {string}  options.fieldCode            - 字段编码
 * @param {string}  options.expression           - 字段表达式
 * @param {string}  options.dataType             - 数据类型：STRING | NUMBER | DATE | BOOLEAN | ARRAY
 * @param {string}  options.aggregateType        - 聚合类型：NONE | SUM | AVG | COUNT | MAX | MIN | COUNT_DISTINCT
 * @param {string}  options.timeGranularityType  - 时间粒度：YEAR | QUARTER | MONTH | WEEK | DAY | HOUR | MINUTE | null
 */
function buildFieldDefinition({
  cubeCode = '',
  isDim = true,
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

/**
 * 构建过滤条件（filterItem）
 * @param {object} options
 * @param {string}  options.filterKey      - 过滤字段 key（通常等于 alias）
 * @param {string}  options.alias          - 字段别名
 * @param {string}  options.conditionType  - 条件类型：EqualTo | Like | InAny | Between | GreaterThan | LessThan
 * @param {*}       options.value          - 过滤值
 */
function buildFilterItem({ filterKey = '', alias = '', conditionType = 'EqualTo', value = null } = {}) {
  return { filterKey: filterKey || alias, alias, conditionType, value };
}

/**
 * 构建排序项（orderByItem）
 * @param {string} alias     - 字段别名
 * @param {string} orderType - 排序方向：ASC | DESC
 */
function buildOrderByItem(alias, orderType = 'ASC') {
  return { alias, orderType };
}

/**
 * 构建 dataSetModelMap 中的单个数据集配置
 * @param {object} options
 * @param {string}   options.dataSetName         - 数据集名称（作为 key）
 * @param {string}   options.cubeCode            - 数据集 cubeCode（必填）
 * @param {Array}    options.fieldDefinitionList - 字段定义列表
 * @param {Array}    options.fieldList           - 查询字段列表
 * @param {Array}    options.filterList          - 过滤条件
 * @param {Array}    options.orderByList         - 排序列表
 * @param {number}   options.limit              - 数据条数限制
 * @param {Array}    options.cubeCodes          - cubeCode 数组（筛选器使用）
 * @param {Array}    options.valueField         - 值字段数组（筛选器使用）
 * @param {Array}    options.labelField         - 显示字段数组（筛选器使用）
 * @param {*}        options.defaultValue       - 默认值（筛选器使用）
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

  /**
   * 指标卡 - YoushuSimpleIndicatorCard
   *
   * @param {object} options
   * @param {string}   options.componentId       - 组件 ID（不填自动生成）
   * @param {object}   options.dataSetModelMap   - 数据集配置 map，key 为数据集名，value 由 buildDataSetEntry 生成
   * @param {object}   options.settings          - 组件配置
   * @param {number}   options.settings.columnCount       - PC 端每行指标数量（默认 4）
   * @param {number}   options.settings.columnCountForH5  - 移动端每行指标数量（默认 2）
   * @param {string}   options.settings.colorType         - 颜色类型（CUSTOM_COLOR 时使用 customColor）
   * @param {string}   options.settings.customColor       - 自定义颜色，逗号分隔
   *
   * @example
   * buildSchema.simpleIndicatorCard({
   *   dataSetModelMap: {
   *     kpi_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
   *         buildFieldDefinition({ alias: 'order_count', aliasName: '订单数', isDim: false, dataType: 'NUMBER', aggregateType: 'COUNT' }),
   *       ],
   *       fieldList: ['sales', 'order_count'],
   *     })
   *   },
   *   settings: { columnCount: 4 }
   * })
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

  /**
   * 折线图 - YoushuLineChart
   *
   * @param {object} options
   * @param {string}   options.componentId       - 组件 ID
   * @param {object}   options.dataSetModelMap   - 数据集配置
   * @param {object}   options.settings          - 组件配置
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {boolean}  options.settings.smooth             - 是否平滑曲线（默认 false）
   * @param {boolean}  options.settings.isStack            - 是否堆叠（默认 false）
   * @param {boolean}  options.settings.isPercent          - 是否百分比堆叠（默认 false）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻（默认 false）
   * @param {number}   options.settings.limit              - 数据条数限制（默认 1000）
   * @param {string}   options.settings.colorType          - 颜色类型
   * @param {string}   options.settings.customColor        - 自定义颜色，逗号分隔
   * @param {number}   options.settings.lineWidth          - 线条宽度（默认 2）
   * @param {object}   options.settings.labelConfig        - 标签配置 { showLabel: false }
   *
   * @example
   * buildSchema.lineChart({
   *   dataSetModelMap: {
   *     line_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'date', aliasName: '日期', isDim: true, dataType: 'DATE', timeGranularityType: 'DAY' }),
   *         buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
   *       ],
   *       fieldList: ['date', 'sales'],
   *       orderByList: [buildOrderByItem('date', 'ASC')],
   *     })
   *   },
   *   settings: { titleConfig: { label: '销售趋势' }, height: 400, smooth: true }
   * })
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

  /**
   * 饼图 - YoushuPieChart
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {number}   options.settings.innerRadius        - 内半径比例 0~1，>0 时为环形图（默认 0）
   * @param {number}   options.settings.startAngle         - 起始角度（弧度，默认 -Math.PI/2）
   * @param {number}   options.settings.endAngle           - 结束角度（弧度，默认 3*Math.PI/2）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻
   * @param {number}   options.settings.limit              - 数据条数限制
   * @param {object}   options.settings.labelConfig        - 标签配置 { showLabel: true }
   *
   * @example
   * buildSchema.pieChart({
   *   dataSetModelMap: {
   *     pie_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'category', aliasName: '类别', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'amount', aliasName: '金额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
   *       ],
   *       fieldList: ['category', 'amount'],
   *     })
   *   },
   *   settings: { titleConfig: { label: '销售占比' }, innerRadius: 0.6 }  // innerRadius>0 为环形图
   * })
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

  /**
   * 分组条形图 - YoushuGroupedBarChart
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {boolean}  options.settings.isStack            - 是否堆叠（默认 false）
   * @param {boolean}  options.settings.isPercent          - 是否百分比堆叠（默认 false）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻
   * @param {number}   options.settings.limit              - 数据条数限制
   * @param {object}   options.settings.labelConfig        - 标签配置 { showLabel: false }
   *
   * @example
   * buildSchema.groupedBarChart({
   *   dataSetModelMap: {
   *     bar_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'region', aliasName: '地区', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'product', aliasName: '产品', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
   *       ],
   *       fieldList: ['region', 'product', 'sales'],
   *     })
   *   },
   *   settings: { titleConfig: { label: '各地区产品销售对比' }, isStack: true }
   * })
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

  /**
   * 漏斗图 - YoushuFunnelChart
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻
   * @param {number}   options.settings.limit              - 数据条数限制
   * @param {object}   options.settings.labelConfig        - 标签配置 { showLabel: true }
   *
   * @example
   * buildSchema.funnelChart({
   *   dataSetModelMap: {
   *     funnel_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'stage', aliasName: '阶段', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'count', aliasName: '数量', isDim: false, dataType: 'NUMBER', aggregateType: 'COUNT' }),
   *       ],
   *       fieldList: ['stage', 'count'],
   *       orderByList: [buildOrderByItem('count', 'DESC')],
   *     })
   *   },
   *   settings: { titleConfig: { label: '销售漏斗' } }
   * })
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

  /**
   * 仪表盘 - YoushuGauge
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {number}   options.settings.min                - 最小值（默认 0）
   * @param {number}   options.settings.max                - 最大值（默认 100）
   * @param {Array}    options.settings.range              - 区间配置，如 [0.3, 0.6, 1]
   * @param {string}   options.settings.colorType          - 颜色类型
   *
   * @example
   * buildSchema.gauge({
   *   dataSetModelMap: {
   *     gauge_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'completion_rate', aliasName: '完成率', isDim: false, dataType: 'NUMBER', aggregateType: 'AVG' }),
   *       ],
   *       fieldList: ['completion_rate'],
   *     })
   *   },
   *   settings: { titleConfig: { label: 'KPI 完成率' }, min: 0, max: 100, range: [0.3, 0.6, 1] }
   * })
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

  /**
   * 雷达图 - YoushuRadarChart
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {number}   options.settings.max                - 各维度最大值（默认 100）
   * @param {number}   options.settings.opacity            - 填充透明度 0~1（默认 0.3）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻
   *
   * @example
   * buildSchema.radarChart({
   *   dataSetModelMap: {
   *     radar_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'dimension', aliasName: '维度', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'score', aliasName: '得分', isDim: false, dataType: 'NUMBER', aggregateType: 'AVG' }),
   *       ],
   *       fieldList: ['dimension', 'score'],
   *     })
   *   },
   *   settings: { titleConfig: { label: '能力雷达图' }, max: 100, opacity: 0.4 }
   * })
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

  /**
   * 热力图 - YoushuHeatmap
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻
   *
   * @example
   * buildSchema.heatmap({
   *   dataSetModelMap: {
   *     heatmap_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'x_dim', aliasName: 'X轴维度', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'y_dim', aliasName: 'Y轴维度', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'value', aliasName: '值', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
   *       ],
   *       fieldList: ['x_dim', 'y_dim', 'value'],
   *     })
   *   },
   *   settings: { titleConfig: { label: '用户行为热力图' } }
   * })
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

  /**
   * 日历热力图 - YoushuCalendarHeatmap
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 200）
   *
   * @example
   * buildSchema.calendarHeatmap({
   *   dataSetModelMap: {
   *     calendar_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'date', aliasName: '日期', isDim: true, dataType: 'DATE', timeGranularityType: 'DAY' }),
   *         buildFieldDefinition({ alias: 'count', aliasName: '数量', isDim: false, dataType: 'NUMBER', aggregateType: 'COUNT' }),
   *       ],
   *       fieldList: ['date', 'count'],
   *     })
   *   },
   *   settings: { titleConfig: { label: '提交日历' } }
   * })
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

  /**
   * 组合图 - YoushuComboChart（柱状图 + 折线图）
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻
   * @param {number}   options.settings.limit              - 数据条数限制
   *
   * @example
   * buildSchema.comboChart({
   *   dataSetModelMap: {
   *     combo_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'month', aliasName: '月份', isDim: true, dataType: 'DATE', timeGranularityType: 'MONTH' }),
   *         buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
   *         buildFieldDefinition({ alias: 'growth_rate', aliasName: '增长率', isDim: false, dataType: 'NUMBER', aggregateType: 'AVG' }),
   *       ],
   *       fieldList: ['month', 'sales', 'growth_rate'],
   *     })
   *   },
   *   settings: { titleConfig: { label: '销售额与增长率' } }
   * })
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

  /**
   * 词云图 - YoushuWordCloud
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 300）
   * @param {number}   options.settings.limit              - 显示词语数量（默认 100）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻
   *
   * @example
   * buildSchema.wordCloud({
   *   dataSetModelMap: {
   *     word_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'keyword', aliasName: '关键词', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'frequency', aliasName: '频次', isDim: false, dataType: 'NUMBER', aggregateType: 'COUNT' }),
   *       ],
   *       fieldList: ['keyword', 'frequency'],
   *       orderByList: [buildOrderByItem('frequency', 'DESC')],
   *     })
   *   },
   *   settings: { titleConfig: { label: '热门关键词' }, limit: 50 }
   * })
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

  /**
   * 地图 - YoushuMap
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 图表标题
   * @param {number}   options.settings.height             - 图表高度（默认 400）
   * @param {boolean}  options.settings.drillDown          - 是否开启省市下钻
   *
   * @example
   * buildSchema.map({
   *   dataSetModelMap: {
   *     map_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'province', aliasName: '省份', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
   *       ],
   *       fieldList: ['province', 'sales'],
   *     })
   *   },
   *   settings: { titleConfig: { label: '全国销售分布' }, drillDown: true }
   * })
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

  /**
   * 交叉透视表 - YoushuCrossPivotTable
   *
   * @param {object} options
   * @param {object}   options.settings
   * @param {string}   options.settings.titleConfig.label  - 表格标题
   * @param {number}   options.settings.height             - 表格高度（默认 400）
   * @param {boolean}  options.settings.drillDown          - 是否开启下钻
   *
   * @example
   * buildSchema.crossPivotTable({
   *   dataSetModelMap: {
   *     pivot_dataset: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'row_dim', aliasName: '行维度', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'col_dim', aliasName: '列维度', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'measure', aliasName: '度量', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
   *       ],
   *       fieldList: ['row_dim', 'col_dim', 'measure'],
   *     })
   *   },
   *   settings: { titleConfig: { label: '多维分析表' } }
   * })
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

  /**
   * 基础表格 - YoushuTable
   * schema 来源：bundle 内嵌 JSON.parse 定义
   *
   * @param {object} options
   * @param {object}   options.dataSetModelMap   - 数据集配置，key 固定为 "table"
   * @param {object}   options.settings          - 组件配置
   * @param {boolean}  options.settings.fixedHeader      - 是否固定表头（默认 false）
   * @param {string}   options.settings.theme            - 表格风格：noBorder | zebra | split | border（默认 split）
   * @param {number}   options.settings.maxBodyHeight    - 最大内容高度（默认 300）
   * @param {object}   options.settings.pagination       - 分页配置
   * @param {number}   options.settings.pagination.pageSize         - 每页条数（默认 10）
   * @param {boolean}  options.settings.pagination.showPageSelect   - 是否显示每页条数选择
   * @param {Array}    options.settings.pagination.pageSizeList     - 可选每页条数列表
   *
   * dataSetModelMap 中 table 数据集的 fieldsConfig：
   *   - columnFields（STRING，必填）：表格列配置，包含字段 key 列表
   *
   * @example
   * buildSchema.table({
   *   dataSetModelMap: {
   *     table: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'name', aliasName: '姓名', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'age', aliasName: '年龄', isDim: false, dataType: 'NUMBER', aggregateType: 'NONE' }),
   *         buildFieldDefinition({ alias: 'dept', aliasName: '部门', isDim: true, dataType: 'STRING' }),
   *       ],
   *       fieldList: ['name', 'age', 'dept'],
   *     })
   *   },
   *   settings: {
   *     fixedHeader: true,
   *     theme: 'border',
   *     maxBodyHeight: 500,
   *     pagination: { pageSize: 20, showPageSelect: true, pageSizeList: [10, 20, 50] }
   *   }
   * })
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

  /**
   * 页面标题栏 - YoushuPageHeader
   *
   * @param {object} options
   * @param {string}   options.componentId       - 组件 ID
   * @param {boolean}  options.tab               - 是否为 Tab 模式（默认 false）
   * @param {string}   options.display           - 显示模式：normal | hidden（默认 normal）
   * @param {boolean}  options.showTitle         - 是否显示标题（默认 true）
   * @param {string}   options.titleContent      - 标题文字（默认空）
   * @param {string}   options.titleTip          - 标题提示文字（默认空）
   * @param {boolean}  options.waiter            - 是否显示加载状态（默认 false）
   * @param {Array}    options.children          - 子组件 schema 列表
   *
   * @example
   * buildSchema.pageHeader({
   *   titleContent: '销售数据看板',
   *   titleTip: '数据每日 08:00 更新',
   *   showTitle: true,
   *   children: [
   *     buildSchema.lineChart({ ... })
   *   ]
   * })
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

  /**
   * 顶部筛选容器 - YoushuTopFilterContainer
   *
   * @param {object} options
   * @param {string}   options.componentId       - 组件 ID
   * @param {object}   options.style             - 容器样式
   * @param {boolean}  options.showTag           - 是否显示已选标签（默认 false）
   * @param {Array}    options.children          - 子筛选组件 schema 列表
   *
   * @example
   * buildSchema.topFilterContainer({
   *   showTag: true,
   *   children: [
   *     buildSchema.selectFilter({ ... }),
   *     buildSchema.timeFilter({ ... }),
   *   ]
   * })
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

  /**
   * 下拉筛选器 - YoushuSelectFilter
   * schema 来源：bundle 内嵌 JSON.parse 定义
   *
   * dataSetModelMap 中 selectFilter 数据集的 fieldsConfig：
   *   - valueField（STRING|DATE，必填）：值字段
   *   - labelField（STRING，可选）：显示字段
   *
   * @param {object} options
   * @param {string}   options.componentId       - 组件 ID
   * @param {object}   options.dataSetModelMap   - 数据集配置，key 固定为 "selectFilter"
   * @param {object}   options.settings          - 组件配置
   * @param {boolean}  options.settings.showLabel  - 是否显示标签（默认 false）
   * @param {number}   options.settings.height     - 下拉框高度（默认 300）
   * @param {string}   options.settings.labelConfig.label  - 筛选器标签名
   * @param {string}   options.settings.mode      - 选择模式：single | multiple（默认 single）
   * @param {object}   options.settings.dataConfig - 数据配置
   * @param {string}   options.settings.dataConfig.queryType  - 查询类型
   * @param {boolean}  options.settings.dataConfig.required   - 是否必选
   *
   * @example
   * buildSchema.selectFilter({
   *   dataSetModelMap: {
   *     selectFilter: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       cubeCodes: ['your_cube_code'],
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'dept_id', aliasName: '部门ID', isDim: true, dataType: 'STRING' }),
   *         buildFieldDefinition({ alias: 'dept_name', aliasName: '部门名称', isDim: true, dataType: 'STRING' }),
   *       ],
   *       fieldList: ['dept_id', 'dept_name'],
   *       valueField: ['dept_id'],
   *       labelField: ['dept_name'],
   *     })
   *   },
   *   settings: {
   *     labelConfig: { label: '部门' },
   *     mode: 'multiple',
   *     showLabel: true,
   *   }
   * })
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

  /**
   * 时间筛选器 - YoushuTimeFilter
   * schema 来源：bundle 内嵌 JSON.parse 定义
   *
   * dataSetModelMap 中 filterData 数据集的 fieldsConfig：
   *   - valueField（STRING，必填）：查询字段
   *
   * @param {object} options
   * @param {string}   options.componentId       - 组件 ID
   * @param {object}   options.dataSetModelMap   - 数据集配置，key 固定为 "filterData"
   * @param {object}   options.settings          - 组件配置
   * @param {string}   options.settings.labelConfig.label  - 筛选器标签名
   * @param {string}   options.settings.mode      - 时间模式：single（单日）| range（范围）
   * @param {string}   options.settings.dataConfig.queryType  - 查询类型：EqualTo | Between
   * @param {*}        options.settings.defaultValue  - 默认时间值
   *
   * @example
   * buildSchema.timeFilter({
   *   dataSetModelMap: {
   *     filterData: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       cubeCodes: ['your_cube_code'],
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'create_date', aliasName: '创建日期', isDim: true, dataType: 'DATE', timeGranularityType: 'DAY' }),
   *       ],
   *       fieldList: ['create_date'],
   *       valueField: ['create_date'],
   *     })
   *   },
   *   settings: {
   *     labelConfig: { label: '日期范围' },
   *     mode: 'range',
   *     dataConfig: { queryType: 'Between' },
   *   }
   * })
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

  /**
   * 区间筛选器 - YoushuInputFilter
   * schema 来源：bundle 内嵌 JSON.parse 定义
   *
   * dataSetModelMap 中 filterData 数据集的 fieldsConfig：
   *   - valueField（STRING，必填）：查询字段
   *
   * @param {object} options
   * @param {string}   options.componentId       - 组件 ID
   * @param {object}   options.dataSetModelMap   - 数据集配置，key 固定为 "filterData"
   * @param {object}   options.settings          - 组件配置
   * @param {string}   options.settings.labelConfig.label  - 筛选器标签名
   * @param {boolean}  options.settings.dataConfig.isRange  - 是否为区间输入（默认 false）
   * @param {string}   options.settings.contentConfig.placeholder  - 输入框占位文字
   *
   * @example
   * buildSchema.inputFilter({
   *   dataSetModelMap: {
   *     filterData: buildDataSetEntry({
   *       cubeCode: 'your_cube_code',
   *       cubeCodes: ['your_cube_code'],
   *       fieldDefinitionList: [
   *         buildFieldDefinition({ alias: 'amount', aliasName: '金额', isDim: false, dataType: 'NUMBER', aggregateType: 'NONE' }),
   *       ],
   *       fieldList: ['amount'],
   *       valueField: ['amount'],
   *     })
   *   },
   *   settings: {
   *     labelConfig: { label: '金额区间' },
   *     dataConfig: { isRange: true, queryType: 'Between' },
   *     contentConfig: { placeholder: '请输入金额' },
   *   }
   * })
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

// ─────────────────────────────────────────────
// 使用示例（直接运行此文件时输出示例）
// ─────────────────────────────────────────────

if (require.main === module) {
  const CUBE_CODE = 'your_cube_code_here';

  console.log('\n========== 示例 1：折线图 ==========');
  const lineChartSchema = buildSchema.lineChart({
    dataSetModelMap: {
      line_dataset: buildDataSetEntry({
        cubeCode: CUBE_CODE,
        fieldDefinitionList: [
          buildFieldDefinition({ alias: 'date', aliasName: '日期', isDim: true, dataType: 'DATE', timeGranularityType: 'DAY' }),
          buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
        ],
        fieldList: ['date', 'sales'],
        orderByList: [buildOrderByItem('date', 'ASC')],
      }),
    },
    settings: {
      titleConfig: { label: '销售趋势' },
      height: 400,
      smooth: true,
    },
  });
  console.log(JSON.stringify(lineChartSchema, null, 2));

  console.log('\n========== 示例 2：饼图（环形） ==========');
  const pieChartSchema = buildSchema.pieChart({
    dataSetModelMap: {
      pie_dataset: buildDataSetEntry({
        cubeCode: CUBE_CODE,
        fieldDefinitionList: [
          buildFieldDefinition({ alias: 'category', aliasName: '类别', isDim: true, dataType: 'STRING' }),
          buildFieldDefinition({ alias: 'amount', aliasName: '金额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
        ],
        fieldList: ['category', 'amount'],
      }),
    },
    settings: {
      titleConfig: { label: '销售占比' },
      innerRadius: 0.6,
    },
  });
  console.log(JSON.stringify(pieChartSchema, null, 2));

  console.log('\n========== 示例 3：基础表格 ==========');
  const tableSchema = buildSchema.table({
    dataSetModelMap: {
      table: buildDataSetEntry({
        cubeCode: CUBE_CODE,
        fieldDefinitionList: [
          buildFieldDefinition({ alias: 'name', aliasName: '姓名', isDim: true, dataType: 'STRING' }),
          buildFieldDefinition({ alias: 'dept', aliasName: '部门', isDim: true, dataType: 'STRING' }),
          buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
        ],
        fieldList: ['name', 'dept', 'sales'],
        orderByList: [buildOrderByItem('sales', 'DESC')],
      }),
    },
    settings: {
      fixedHeader: true,
      theme: 'border',
      maxBodyHeight: 500,
      pagination: { pageSize: 20 },
    },
  });
  console.log(JSON.stringify(tableSchema, null, 2));

  console.log('\n========== 示例 4：带筛选器的完整页面 ==========');
  const pageSchema = buildSchema.pageHeader({
    titleContent: '销售数据看板',
    titleTip: '数据每日 08:00 更新',
    children: [
      buildSchema.topFilterContainer({
        showTag: true,
        children: [
          buildSchema.timeFilter({
            dataSetModelMap: {
              filterData: buildDataSetEntry({
                cubeCode: CUBE_CODE,
                cubeCodes: [CUBE_CODE],
                fieldDefinitionList: [
                  buildFieldDefinition({ alias: 'create_date', aliasName: '创建日期', isDim: true, dataType: 'DATE', timeGranularityType: 'DAY' }),
                ],
                fieldList: ['create_date'],
                valueField: ['create_date'],
              }),
            },
            settings: { labelConfig: { label: '日期范围' }, mode: 'range' },
          }),
          buildSchema.selectFilter({
            dataSetModelMap: {
              selectFilter: buildDataSetEntry({
                cubeCode: CUBE_CODE,
                cubeCodes: [CUBE_CODE],
                fieldDefinitionList: [
                  buildFieldDefinition({ alias: 'dept_id', aliasName: '部门ID', isDim: true, dataType: 'STRING' }),
                  buildFieldDefinition({ alias: 'dept_name', aliasName: '部门名称', isDim: true, dataType: 'STRING' }),
                ],
                fieldList: ['dept_id', 'dept_name'],
                valueField: ['dept_id'],
                labelField: ['dept_name'],
              }),
            },
            settings: { labelConfig: { label: '部门' }, mode: 'multiple', showLabel: true },
          }),
        ],
      }),
      buildSchema.lineChart({
        dataSetModelMap: {
          line_dataset: buildDataSetEntry({
            cubeCode: CUBE_CODE,
            fieldDefinitionList: [
              buildFieldDefinition({ alias: 'date', aliasName: '日期', isDim: true, dataType: 'DATE', timeGranularityType: 'DAY' }),
              buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
            ],
            fieldList: ['date', 'sales'],
          }),
        },
        settings: { titleConfig: { label: '销售趋势' }, height: 350 },
      }),
      buildSchema.simpleIndicatorCard({
        dataSetModelMap: {
          kpi_dataset: buildDataSetEntry({
            cubeCode: CUBE_CODE,
            fieldDefinitionList: [
              buildFieldDefinition({ alias: 'total_sales', aliasName: '总销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
              buildFieldDefinition({ alias: 'order_count', aliasName: '订单数', isDim: false, dataType: 'NUMBER', aggregateType: 'COUNT' }),
            ],
            fieldList: ['total_sales', 'order_count'],
          }),
        },
        settings: { columnCount: 2 },
      }),
    ],
  });
  console.log(JSON.stringify(pageSchema, null, 2));
}
