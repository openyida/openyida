#!/usr/bin/env node
/**
 * create-report.js - 宜搭报表创建工具（入口文件）
 *
 * 实际逻辑已拆分到 lib/report/ 目录：
 *   - lib/report/constants.js    — 常量和 ID 生成工具
 *   - lib/report/chart-builder.js — 图表 Schema 构建逻辑
 *   - lib/report/http.js          — HTTP 请求封装
 *   - lib/report/index.js         — 主流程入口
 *
 * 用法：
 *   openyida create-report <appType> "<报表名称>" <图表定义JSON或文件路径>
 */

"use strict";

module.exports = require("./report/index");

// 当直接执行时（node lib/create-report.js）自动运行
if (require.main === module) {
  require("./report/index").run().catch((err) => {
    console.error("执行异常:", err.message);
    process.exit(1);
  });
}

const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const https = require("https");
const http = require("http");

const {
  loadCookieData,
  triggerLogin,
  refreshCsrfToken,
  resolveBaseUrl,
  isLoginExpired,
  isCsrfTokenExpired,
  requestWithAutoLogin,
  httpPost,
} = require("./utils");

// ── 图表类型映射 ──────────────────────────────────────

const CHART_COMPONENT_MAP = {
  bar:       "YoushuGroupedBarChart",      // 柱状图（分组）
  line:      "YoushuLineChart",            // 折线图
  pie:       "YoushuPieChart",             // 饼图
  funnel:    "YoushuFunnelChart",          // 漏斗图
  gauge:     "YoushuGauge",               // 仪表盘
  combo:     "YoushuComboChart",           // 柱线混合图
  table:     "YoushuTable",               // 基础表格
  indicator: "YoushuSimpleIndicatorCard", // 指标卡
  pivot:     "YoushuCrossPivotTable",     // 交叉透视表
};

// 所有报表页面必须包含的基础组件
const BASE_COMPONENTS = [
  "YoushuSelectFilter",
  "YoushuTopFilterContainer",
  "PageHeaderContent",
  "Tab",
  "TabsLayout",
  "PageHeaderTab",
  "YoushuPageHeader",
  "RootHeader",
  "RootContent",
  "RootFooter",
  "Page",
];

// ── ID 生成工具 ───────────────────────────────────────

/**
 * 生成随机 8 位字母数字 ID（小写）
 */
function randomId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * 生成节点 ID，格式：node_oc + 随机12位
 */
function genNodeId() {
  return "node_oc" + randomId() + randomId().slice(0, 4);
}

/**
 * 生成字段别名 ID，格式：field_ + 随机8位
 */
function genFieldAlias() {
  return "field_" + randomId();
}

/**
 * 生成组件 fieldId，格式：ComponentName_ + 随机8位
 */
function genFieldId(componentName) {
  return componentName + "_" + randomId();
}

// ── 参数解析 ──────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(3);
  if (argv.length < 3) {
    console.error("用法: openyida create-report <appType> \"<报表名称>\" <图表定义JSON或文件路径>");
    console.error("示例: openyida create-report APP_XXX \"销售报表\" charts.json");
    process.exit(1);
  }

  const [appType, reportTitle, chartsJsonOrFile] = argv;
  return { appType, reportTitle, chartsJsonOrFile };
}

// ── 读取图表定义 ──────────────────────────────────────

function readChartsDefinition(chartsJsonOrFile) {
  let charts;

  // 尝试作为文件路径读取
  if (fs.existsSync(chartsJsonOrFile)) {
    try {
      const content = fs.readFileSync(chartsJsonOrFile, "utf-8");
      charts = JSON.parse(content);
    } catch (e) {
      console.error("读取图表定义文件失败:", e.message);
      process.exit(1);
    }
  } else {
    // 尝试作为 JSON 字符串解析
    try {
      charts = JSON.parse(chartsJsonOrFile);
    } catch (e) {
      console.error("图表定义解析失败（既不是有效文件路径，也不是有效 JSON）:", e.message);
      process.exit(1);
    }
  }

  if (!Array.isArray(charts)) {
    console.error("图表定义必须是数组格式");
    process.exit(1);
  }

  return charts;
}

// ── 构建图表组件 Props ────────────────────────────────

/**
 * 构建通用图表 afterFetch 函数对象（JSFunction 格式）
 */
function buildAfterFetch() {
  return {
    type: "JSFunction",
    value: "function afterFetch(data, extraInfo) {\n  return data;\n}",
  };
}

/**
 * 构建通用导出数据配置
 */
function buildExportData() {
  return {
    supportExport: false,
    passType: "NO_PASS",
    exportType: "BROWSER",
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
    content: { type: "i18n", zh_CN: "更多", en_US: "More" },
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
function buildFieldObj(cubeCode, fieldCode, aliasName, alias, dataType, aggregateType, orderType, isDimension) {
  const aggType = aggregateType || "NONE";
  const isDateField = (dataType === "DATE") || (fieldCode && fieldCode.startsWith("dateField_"));

  // COUNT/SUM/AVG/MAX/MIN 等聚合函数的结果都是数值，强制使用 DOUBLE
  // 否则饼图/柱状图的 tooltip 会显示空值
  const numericAggTypes = ["COUNT", "SUM", "AVG", "MAX", "MIN", "COUNT_DISTINCT"];
  const effectiveDataType = numericAggTypes.includes(aggType) ? "DOUBLE" : (dataType || "STRING");

  const obj = {
    title: { type: "i18n", zh_CN: aliasName },
    classifiedCode: cubeCode,
    cubeCode: cubeCode,
    fieldCode: fieldCode,
    isDimension: "false",
    dataType: effectiveDataType,
    format: { type: "NONE" },
    link: [{ type: "NONE" }],
    drillList: [],
    aggregateType: aggType,
    orderBy: { type: orderType || "NONE", reference: alias },
    fieldKey: alias,
    visible: true,
    beUsedTimes: 1,
    isVisible: "y",
    id: fieldCode,
    text: aliasName,
  };

  // dateField 特殊处理
  if (isDateField) {
    obj.timeGranularityType = "DAY";
    obj.timeFormat = "yyyy-MM-dd";
    // dateField 的 id 需要加数字后缀（宜搭约定）
    obj.id = fieldCode + "5";
    // dateField 不需要 measureType
  } else {
    obj.measureType = "MEASURE_ATTRIBUTE";
  }

  return obj;
}

/**
 * 构建 dataViewQueryModel（图表数据查询模型）
 */
function buildDataViewQueryModel(chart, cubeTenantId) {
  const cubeCode = chart.cubeCode || "";
  const fieldDefinitionList = [];
  const fieldList = [];
  const orderByList = [];

  // 收集所有字段（xField + yField + groupField）
  const allFields = [];

  if (chart.xField) {
    if (Array.isArray(chart.xField)) {
      chart.xField.forEach((f) => allFields.push({ ...f, role: "x" }));
    } else {
      allFields.push({ ...chart.xField, role: "x" });
    }
  }

  if (Array.isArray(chart.yField)) {
    chart.yField.forEach((f) => allFields.push({ ...f, role: "y" }));
  } else if (chart.yField) {
    allFields.push({ ...chart.yField, role: "y" });
  }

  if (chart.groupField) {
    if (Array.isArray(chart.groupField)) {
      chart.groupField.forEach((f) => allFields.push({ ...f, role: "group" }));
    } else {
      allFields.push({ ...chart.groupField, role: "group" });
    }
  }

  allFields.forEach((f) => {
    const alias = genFieldAlias();
    f._alias = alias; // 临时存储别名供后续使用
    const aggType = f.aggregateType || "NONE";
    const isDateField = (f.dataType === "DATE") || (f.fieldCode && f.fieldCode.startsWith("dateField_"));
    // COUNT/SUM/AVG 等聚合函数结果是数值，强制使用 DOUBLE，否则图表 tooltip 显示空值
    const numericAggTypes = ["COUNT", "SUM", "AVG", "MAX", "MIN", "COUNT_DISTINCT"];
    const effectiveDataType = numericAggTypes.includes(aggType) ? "DOUBLE" : (f.dataType || "STRING");

    fieldDefinitionList.push({
      cubeCode: cubeCode,
      isDim: false,
      alias: alias,
      aliasName: { type: "i18n", zh_CN: f.aliasName || f.fieldCode },
      classifiedCode: cubeCode,
      fieldCode: f.fieldCode,
      dataType: effectiveDataType,
      aggregateType: aggType,
      timeGranularityType: isDateField ? "DAY" : null,
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
      cubeTenantId: cubeTenantId || "",
    },
    allFields: allFields,
  };
}

/**
 * 构建 dataSetModelMap（图表数据集映射）
 * 不同图表类型使用不同的数据集key和字段名：
 * - bar/line/pie/funnel/gauge/scatter/area: key=chartData, 字段: xField/yField/groupField
 * - pie/funnel: key=chartData, 字段: xField(分类)/yField(数值)
 * - gauge: key=chartData, 字段: valueField/assitValueField
 * - combo: key=dataSetName, 字段: xField/leftYFields/rightYFields
 * - table: key=table, 字段: columnFields
 * - indicator: key=youshuData, 字段: kpi/helpKpi
 * - pivot: key=dataSetName, 字段: columnList
 */
function buildDataSetModelMap(chart, cubeTenantId) {
  const cubeCode = chart.cubeCode || "";
  const chartType = chart.type || "bar";

  // ── 柱线混合图（combo）──
  if (chartType === "combo") {
    const allFields = [];
    if (chart.xField) {
      if (Array.isArray(chart.xField)) {
        chart.xField.forEach((f) => allFields.push({ ...f, role: "x" }));
      } else {
        allFields.push({ ...chart.xField, role: "x" });
      }
    }
    if (Array.isArray(chart.leftYFields)) {
      chart.leftYFields.forEach((f) => allFields.push({ ...f, role: "leftY" }));
    } else if (chart.leftYFields) {
      allFields.push({ ...chart.leftYFields, role: "leftY" });
    }
    if (Array.isArray(chart.rightYFields)) {
      chart.rightYFields.forEach((f) => allFields.push({ ...f, role: "rightY" }));
    } else if (chart.rightYFields) {
      allFields.push({ ...chart.rightYFields, role: "rightY" });
    }

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || "NONE";
      const isDateField = (f.dataType === "DATE") || (f.fieldCode && f.fieldCode.startsWith("dateField_"));
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: "i18n", zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
        dataType: f.dataType || "STRING", aggregateType: aggType,
        timeGranularityType: isDateField ? "DAY" : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const xFieldObjs = allFields.filter((f) => f.role === "x").map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const leftYObjs = allFields.filter((f) => f.role === "leftY").map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const rightYObjs = allFields.filter((f) => f.role === "rightY").map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );

    return {
      dataSetName: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || "",
        },
        fieldList: fieldListObjs,
        youshuDataType: "real",
        cubeCodes: cubeCode ? [cubeCode] : [],
        xField: xFieldObjs,
        leftYFields: leftYObjs,
        rightYFields: rightYObjs,
        annotationField: [],
        filterList: [],
        limit: "",
        mockData: [],
      },
    };
  }

  // ── 基础表格（table）──
  if (chartType === "table") {
    const allFields = [];
    if (Array.isArray(chart.columnFields)) {
      chart.columnFields.forEach((f) => allFields.push({ ...f, role: "col" }));
    } else if (Array.isArray(chart.columns)) {
      // 兼容旧字段名
      chart.columns.forEach((f) => allFields.push({ ...f, role: "col" }));
    }

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || "NONE";
      const isDateField = (f.dataType === "DATE") || (f.fieldCode && f.fieldCode.startsWith("dateField_"));
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: "i18n", zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
        dataType: f.dataType || "STRING", aggregateType: aggType,
        timeGranularityType: isDateField ? "DAY" : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const columnFieldObjs = [...fieldListObjs];

    return {
      table: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || "",
        },
        fieldList: fieldListObjs,
        youshuDataType: "real",
        cubeCodes: cubeCode ? [cubeCode] : [],
        columnFields: columnFieldObjs,
        filterList: [],
        limit: "",
        mockData: [],
      },
    };
  }

  // ── 指标卡（indicator）──
  if (chartType === "indicator") {
    const allFields = [];
    if (Array.isArray(chart.kpi)) {
      chart.kpi.forEach((f) => allFields.push({ ...f, role: "kpi" }));
    } else if (Array.isArray(chart.yField)) {
      chart.yField.forEach((f) => allFields.push({ ...f, role: "kpi" }));
    }
    if (Array.isArray(chart.helpKpi)) {
      chart.helpKpi.forEach((f) => allFields.push({ ...f, role: "helpKpi" }));
    }

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || "NONE";
      fieldDefinitionList.push({
        cubeCode, isDim: aggType === "NONE", alias,
        aliasName: { type: "i18n", zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
        dataType: f.dataType || "STRING", aggregateType: aggType,
        timeGranularityType: null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const kpiObjs = allFields.filter((f) => f.role === "kpi").map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const helpKpiObjs = allFields.filter((f) => f.role === "helpKpi").map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );

    return {
      youshuData: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || "",
        },
        fieldList: fieldListObjs,
        youshuDataType: "real",
        cubeCodes: cubeCode ? [cubeCode] : [],
        kpi: kpiObjs,
        helpKpi: helpKpiObjs,
        filterList: [],
        limit: "",
        mockData: [],
      },
    };
  }

  // ── 交叉透视表（pivot）──
  if (chartType === "pivot") {
    const allFields = [];
    if (Array.isArray(chart.columnList)) {
      chart.columnList.forEach((f) => allFields.push({ ...f, role: "col" }));
    } else if (Array.isArray(chart.columns)) {
      chart.columns.forEach((f) => allFields.push({ ...f, role: "col" }));
    }

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || "NONE";
      const isDateField = (f.dataType === "DATE") || (f.fieldCode && f.fieldCode.startsWith("dateField_"));
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: "i18n", zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
        dataType: f.dataType || "STRING", aggregateType: aggType,
        timeGranularityType: isDateField ? "DAY" : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
    );
    const columnListObjs = [...fieldListObjs];

    return {
      dataSetName: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || "",
          filterMode: "PROFESSIONAL",
        },
        fieldList: fieldListObjs,
        youshuDataType: "real",
        cubeCodes: cubeCode ? [cubeCode] : [],
        columnList: columnListObjs,
        filterList: [],
        limit: "",
        mockData: [],
      },
    };
  }

  // ── 仪表盘（gauge）──
  if (chartType === "gauge") {
    const allFields = [];
    if (chart.valueField) allFields.push({ ...chart.valueField, role: "value" });
    if (chart.assitValueField) allFields.push({ ...chart.assitValueField, role: "assit" });
    // 兼容：如果用 yField 配置
    if (!chart.valueField && Array.isArray(chart.yField) && chart.yField.length > 0) {
      allFields.push({ ...chart.yField[0], role: "value" });
    }

    const fieldDefinitionList = [];
    const fieldListKeys = [];
    allFields.forEach((f) => {
      const alias = genFieldAlias();
      f._alias = alias;
      const aggType = f.aggregateType || "AVG";
      const isDateField = (f.dataType === "DATE") || (f.fieldCode && f.fieldCode.startsWith("dateField_"));
      fieldDefinitionList.push({
        cubeCode, isDim: false, alias,
        aliasName: { type: "i18n", zh_CN: f.aliasName || f.fieldCode },
        classifiedCode: cubeCode, fieldCode: f.fieldCode,
        dataType: f.dataType || "DOUBLE", aggregateType: aggType,
        timeGranularityType: isDateField ? "DAY" : null,
      });
      fieldListKeys.push(alias);
    });

    const fieldListObjs = allFields.map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType || "DOUBLE", f.aggregateType || "AVG")
    );
    const valueFieldObjs = allFields.filter((f) => f.role === "value").map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType || "DOUBLE", f.aggregateType || "AVG")
    );
    const assitValueFieldObjs = allFields.filter((f) => f.role === "assit").map((f) =>
      buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType || "DOUBLE", f.aggregateType || "AVG")
    );

    return {
      chartData: {
        dataViewQueryModel: {
          cubeCode, fieldDefinitionList, fieldList: fieldListKeys,
          filterList: [], orderByList: [], cubeTenantId: cubeTenantId || "",
        },
        fieldList: fieldListObjs,
        youshuDataType: "real",
        cubeCodes: cubeCode ? [cubeCode] : [],
        valueField: valueFieldObjs,
        assitValueField: assitValueFieldObjs,
        filterList: [],
        limit: "",
        mockData: [],
      },
    };
  }

  // ── 通用图表（bar/line/pie/funnel/scatter/area）──
  // 饼图/漏斗图：xField=分类字段，yField=数值字段
  const { model, allFields } = buildDataViewQueryModel(chart, cubeTenantId);

  const fieldListObjs = allFields.map((f) =>
    buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType)
  );

  const xFieldObjs = allFields
    .filter((f) => f.role === "x")
    .map((f) => buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType));

  const yFieldObjs = allFields
    .filter((f) => f.role === "y")
    .map((f) => buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType));

  const groupFieldObjs = allFields
    .filter((f) => f.role === "group")
    .map((f) => buildFieldObj(cubeCode, f.fieldCode, f.aliasName || f.fieldCode, f._alias, f.dataType, f.aggregateType));

  // 饼图额外字段
  const extraFields = {};
  if (chartType === "pie") {
    extraFields.ratio = [];
    extraFields.totalValue = [];
    extraFields.totalRatio = [];
    extraFields.trailingIconField = [];
  }

  return {
    chartData: {
      dataViewQueryModel: model,
      fieldList: fieldListObjs,
      youshuDataType: "real",
      cubeCodes: cubeCode ? [cubeCode] : [],
      xField: xFieldObjs,
      yField: yFieldObjs,
      groupField: groupFieldObjs,
      annotationField: [],
      ...extraFields,
      filterList: [],
      limit: "",
      mockData: [],
    },
  };
}

/**
 * 构建柱状图（YoushuGroupedBarChart）的 settings
 */
function buildBarChartSettings() {
  return {
    container: { height: 248 },
    style: {
      mode: "group",
      linkGroup: false,
      transpose: false,
      barStyle: "ai",
      size: null,
      maxSize: null,
      minSize: null,
      barBackground: null,
      groupSpacing: 0,
      radiusLeftTop: 4,
      radiusRightTop: 4,
      radiusRightBottom: 0,
      radiusLeftBottom: 0,
      colorType: "SCHEMA_COLOR",
      chartColorsMode: "defaultColorsMode",
      customColor: "#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C",
    },
    countLabel: { showCountLabel: false, fontSize: 12, color: "#000" },
    axisType: "hz",
    xAxis: {
      showXAxis: true,
      showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: true,
      tickLine: true,
      grid: false,
      label: true,
      labelStyle: {
        labelType: "default",
        color: "rgba(23,26,29,0.4)",
        fontSize: 12,
        limitLengthType: "percent",
        percent: 30,
        value: 100,
        autoRotate: true,
        rotate: "0",
        autoHide: true,
      },
      values: { type: "i18n", zh_CN: "", en_US: "" },
    },
    yAxis: {
      showYAxis: true,
      showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: false,
      tickLine: false,
      grid: true,
      label: true,
      labelStyle: {
        labelType: "default",
        color: "rgba(23,26,29,0.4)",
        fontSize: 12,
        limitLengthType: "percent",
        percent: 30,
        value: 100,
        autoRotate: true,
        rotate: "0",
        autoHide: true,
      },
      min: null,
      max: null,
      tickCount: 5,
    },
    legend: { showLegend: true, legendPosition: "top-left", flipPage: true },
    label: {
      showLabel: true,
      labelShowStyle: "ai",
      fontSize: 12,
      autoColor: true,
      color: "#000",
      autoPosition: false,
      position: "middle",
      autoAdjust: true,
      autoHide: true,
    },
    slider: { showSlider: false },
    tooltip: { showTooltip: true },
  };
}

/**
 * 构建折线图（YoushuLineChart）的 settings
 */
function buildLineChartSettings() {
  return {
    container: { height: 248 },
    style: {
      mode: "none",
      smooth: false,
      showPoint: true,
      pointSize: 4,
      pointShape: "circle",
      showLine: true,
      lineWidth: 2,
      showArea: false,
      colorType: "SCHEMA_COLOR",
      chartColorsMode: "defaultColorsMode",
      customColor: "#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C",
    },
    axisType: "hz",
    xAxis: {
      showXAxis: true,
      showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: true,
      tickLine: true,
      grid: false,
      label: true,
      labelStyle: {
        labelType: "default",
        color: "rgba(23,26,29,0.4)",
        fontSize: 12,
        limitLengthType: "percent",
        percent: 30,
        value: 100,
        autoRotate: true,
        rotate: "0",
        autoHide: true,
      },
      values: { type: "i18n", zh_CN: "", en_US: "" },
    },
    yAxis: {
      showYAxis: true,
      showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: false,
      tickLine: false,
      grid: true,
      label: true,
      labelStyle: {
        labelType: "default",
        color: "rgba(23,26,29,0.4)",
        fontSize: 12,
        limitLengthType: "percent",
        percent: 30,
        value: 100,
        autoRotate: true,
        rotate: "0",
        autoHide: true,
      },
      min: null,
      max: null,
      tickCount: 5,
    },
    legend: { showLegend: true, legendPosition: "top-left", flipPage: true },
    label: { showLabel: true, fontSize: 12, color: "#000", autoOverlap: true },
    slider: { showSlider: false },
    tooltip: { showTooltip: true },
  };
}

/**
 * 构建饼图（YoushuPieChart）的 settings
 */
function buildPieChartSettings() {
  return {
    container: { height: 248 },
    style: {
      radius: 75,
      isRing: false,
      innerRadius: 0,
      colorType: "SCHEMA_COLOR",
      chartColorsMode: "defaultColorsMode",
      customColor: "#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C",
    },
    statistic: { showStatistic: false },
    label: {
      showLabel: true,
      showLine: true,
      labelAlign: "outer",
      labelSize: 12,
      labelColor: "#404040",
      labelFormatType: "NAME_PERCENT",
    },
    legend: {
      showLegend: true,
      legendPosition: "right",
      flipPage: true,
      type: "item",
      contentType: "NAME",
      cardWidth: null,
      ratio: 65,
      layout: "vertical",
      itemSpacing: 12,
    },
    tooltip: { showTooltip: true, contentType: null },
    percentDigits: 2,
  };
}

/**
 * 构建散点图（YoushuScatterChart）的 settings
 */
function buildScatterChartSettings() {
  return {
    container: { height: 248 },
    style: {
      pointSize: 4,
      pointShape: "circle",
      colorType: "SCHEMA_COLOR",
      chartColorsMode: "defaultColorsMode",
      customColor: "#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C",
    },
    axisType: "hz",
    xAxis: {
      showXAxis: true,
      showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: true,
      tickLine: true,
      grid: false,
      label: true,
    },
    yAxis: {
      showYAxis: true,
      showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: false,
      tickLine: false,
      grid: true,
      label: true,
      min: null,
      max: null,
      tickCount: 5,
    },
    legend: { showLegend: true, legendPosition: "top-left", flipPage: true },
    tooltip: { showTooltip: true },
  };
}

/**
 * 构建面积图（YoushuAreaChart）的 settings
 */
function buildAreaChartSettings() {
  const lineSettings = buildLineChartSettings();
  lineSettings.style.showArea = true;
  return lineSettings;
}

/**
 * 构建漏斗图（YoushuFunnelChart）的 settings
 */
function buildFunnelChartSettings() {
  return {
    container: { height: 248 },
    style: {
      colorType: "SCHEMA_COLOR",
      chartColorsMode: "defaultColorsMode",
      customColor: "#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C",
    },
    legend: { showLegend: true, legendPosition: "top-left", flipPage: true },
    label: { showLabel: true, fontSize: 12, color: "#000" },
    tooltip: { showTooltip: true },
  };
}

/**
 * 构建仪表盘（YoushuGauge）的 settings
 */
function buildGaugeChartSettings() {
  return {
    container: { height: 248 },
    useSingleColor: false,
    singleColor: "#0089FF",
    color: [],
    tick: { showTick: true, min: null, max: null, tickInterval: null },
    assistValue: { openAssistValue: true, showCompare: false, position: "bottom" },
    style: { rounded: true, pivot: true, rangeSize: 16, radius: 95, innerRadius: 90 },
  };
}

/**
 * 构建基础表格（YoushuTable）的 settings
 */
function buildTableSettings() {
  return {
    rglConfig: { w: 6, h: 21, isHeightAuto: true },
    size: "medium",
    wordSize: "medium:14",
    theme: "split",
    mergeCell: false,
    fixedHeader: false,
    maxBodyHeight: "300",
    fixedColumnIndex: 1,
    isReverseTable: false,
    showReversedHeader: false,
    isUniqueRows: false,
    pagination: {
      isPagination: false,
      pageSize: 10,
      size: "small",
      type: "normal",
      pageShowCount: 5,
      showPageSelect: false,
    },
    isTree: false,
    idField: null,
    pidField: null,
    isLeaf: null,
    drilldownFilterList: null,
    defaultExpand: false,
    rankStyle: false,
    container: { height: 472 },
    titleTip: false,
    showCopyData: false,
    enableFieldSelect: false,
    defaultSelectedFields: "",
    hasFullscreen: false,
    copyAsImg: false,
    height: null,
    isHeightAuto: true,
  };
}

/**
 * 构建柱线混合图（YoushuComboChart）的 settings
 */
function buildComboChartSettings() {
  return {
    container: { height: 248 },
    style: {
      sync: false,
      chartType: "bar-line",
      bar: {
        size: null, maxSize: null, minSize: null, mode: "group",
        barBackground: null, radiusLeftTop: 4, radiusRightTop: 4,
        radiusRightBottom: 0, radiusLeftBottom: 0,
      },
      line: { size: 2, smooth: false, showPoint: true, pointSize: 4, pointShape: "circle" },
      autoAdjust: true,
      colorType: "SCHEMA_COLOR",
      chartColorsMode: "defaultColorsMode",
      customColor: "#5894FF,#394B76,#F7B900,#E55F24,#80D5F5,#9849B0,#3BC88A,#0E869D,#F4A49E,#80563C",
    },
    xAxis: {
      showXAxis: true, showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: true, tickLine: true, grid: false, label: true,
      labelStyle: {
        labelType: "default", color: "rgba(23,26,29,0.4)", fontSize: 12,
        limitLengthType: "percent", percent: 30, value: 100,
        autoRotate: true, rotate: "0", autoHide: true,
      },
      values: { type: "i18n", zh_CN: "", en_US: "" },
    },
    leftYAxis: {
      showLeftYAxis: true, showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: false, tickLine: false, grid: true, label: true,
      labelStyle: {
        labelType: "default", color: "rgba(23,26,29,0.4)", fontSize: 12,
        limitLengthType: "percent", percent: 30, value: 100,
        autoRotate: true, rotate: "0", autoHide: true,
      },
      min: null, max: null, tickCount: 5,
    },
    rightYAxis: {
      showRightYAxis: true, showTitle: false,
      title: { type: "i18n", zh_CN: "", en_US: "" },
      line: false, tickLine: false, label: true,
      labelStyle: {
        labelType: "default", color: "rgba(23,26,29,0.4)", fontSize: 12,
        limitLengthType: "percent", percent: 30, value: 100,
        autoRotate: true, rotate: "0", autoHide: true,
      },
      min: null, max: null, tickCount: 5,
    },
    legend: { showLegend: true, legendPosition: "top-left", flipPage: true },
    leftLabel: { showLabel: true, fontSize: 12, color: "#000" },
    rightLabel: { showLabel: true, fontSize: 12, color: "#000" },
    slider: { showSlider: false },
    tooltip: { showTooltip: true },
  };
}

/**
 * 构建指标卡（YoushuSimpleIndicatorCard）的 settings
 */
function buildIndicatorSettings() {
  return {
    showSideStyle: "NONE",
    followTheme: false,
    themeType: "dark",
    showSideBorder: true,
    sideBarColor: "#0089FF",
    bgColorType: "single",
    singleBgColor: "#F1F2F3",
    colorType: "SCHEMA_COLOR",
    multipleBgColor: "defaultColorsMode",
    customColor: "#0089FF,#FF9200,#11AB4F,#FFD100,#7263EE,#67C5EB,#6B748C,#FF755A,#007E99,#FFA8A8",
    size: "normal",
    valueSize: "20px",
    titleMaxRow: 0,
    columnCount: 4,
    columnCountForH5: 2,
    popoverAlign: "b",
    container: { height: 72 },
    titleTip: false,
    enableFieldSelect: false,
    hasFullscreen: false,
    copyAsImg: false,
    height: null,
    isHeightAuto: true,
  };
}

/**
 * 构建交叉透视表（YoushuCrossPivotTable）的 settings
 */
function buildPivotSettings() {
  return {
    rglConfig: { w: 6, h: 21, isHeightAuto: true },
    maxBodyHeight: 500,
    size: "normal",
    rows: [],
    columns: [],
    measures: [],
    details: [],
    supportExport: false,
    exportType: "XJZ",
    dialogWidth: 850,
    dialogPageSize: 10,
    baseInfo: {
      isShowSetter: true,
      isShowFilter: false,
      isShowReload: false,
      isHideTitle: false,
      isMeasureOrder: true,
      isZebra: true,
      rowMaxSize: 3000,
      columnsMaxSize: 500,
      columnWidth: 100,
      dialogWidth: 850,
      dialogPageSize: 10,
      detailExportData: { supportExport: false, exportType: "BROWSER" },
    },
    mode: "summary",
    summaryInfo: {
      isRowTotal: true,
      rowTotalWidth: 130,
      rowTotalPosition: "end",
      isColumnTotal: true,
      isSubTotal: false,
      rowMaxSize: 3000,
      columnsMaxSize: 500,
    },
    paginationInfo: {
      size: "small",
      type: "normal",
      pageShowCount: 5,
      pageSize: 10,
      showPageSelect: false,
    },
    container: { height: 232 },
    titleTip: false,
    hasFullscreen: false,
    copyAsImg: false,
    height: null,
    isHeightAuto: true,
  };
}

/**
 * 构建数字图表（YoushuNumberChart）的 settings
 */
function buildNumberChartSettings() {
  return {
    container: { height: 120 },
    style: {
      fontSize: 36,
      color: "#1a1a1a",
      unit: "",
      colorType: "SCHEMA_COLOR",
    },
    tooltip: { showTooltip: false },
  };
}

/**
 * 根据图表类型获取 settings
 */
function getChartSettings(chartType) {
  switch (chartType) {
    case "bar":       return buildBarChartSettings();
    case "line":      return buildLineChartSettings();
    case "pie":       return buildPieChartSettings();
    case "scatter":   return buildScatterChartSettings();
    case "area":      return buildAreaChartSettings();
    case "funnel":    return buildFunnelChartSettings();
    case "gauge":     return buildGaugeChartSettings();
    case "combo":     return buildComboChartSettings();
    case "table":     return buildTableSettings();
    case "indicator": return buildIndicatorSettings();
    case "pivot":     return buildPivotSettings();
    case "number":    return buildNumberChartSettings();
    default:          return buildBarChartSettings();
  }
}

/**
 * 构建图表 userConfig（数据配置项）
 */
function buildUserConfig(chartType) {
  const baseXField = {
    name: "xField",
    title: "横轴",
    setterName: "ColumnFieldSetter",
    setterProps: {
      single: true,
      showFormatTab: true,
      showEditTab: true,
      showFormulaEditor: true,
      showFieldInfo: true,
      showDrillTab: true,
      showSortTab: true,
      showAggregateTab: false,
    },
  };

  const baseYField = {
    name: "yField",
    title: "纵轴（可多选）",
    setterName: "ColumnFieldSetter",
    setterProps: {
      showFormatTab: true,
      showEditTab: true,
      showFormulaEditor: true,
      showChartStyleTab: true,
      showDataLink: true,
      showTimeOffsetTab: true,
      showBatchSet: true,
      batchSetFields: ["text", "title", "aggregateType", "format_type", "format_decimalDigit"],
    },
  };

  const baseGroupField = {
    name: "groupField",
    title: "分组",
    setterName: "ColumnFieldSetter",
    setterProps: {
      single: true,
      showColorTab: true,
      showEditTab: true,
      showFormulaEditor: true,
      showAggregateTab: false,
    },
  };

  const baseAnnotationField = {
    name: "annotationField",
    title: "参考线",
    setterName: "ColumnFieldSetter",
    setterProps: {
      showEditTab: true,
      showFormulaEditor: true,
      showChartAnnotation: true,
      showSortTab: false,
      showFormatTab: true,
    },
  };

  // userConfig 格式为对象：{ chartType, dataConfig: { <dataKey>: [...fields] } }
  // 这是宜搭报表组件的正确格式，数组格式会导致渲染错误

  if (chartType === "pie") {
    return {
      chartType: "pie",
      dataConfig: {
        xField: [],
        yField: [],
        ratio: [],
        totalValue: [],
        totalRatio: [],
      },
    };
  }

  if (chartType === "funnel") {
    return {
      chartType: "funnel",
      dataConfig: {
        xField: [],
        yField: [],
      },
    };
  }

  if (chartType === "gauge") {
    return {
      chartType: "gauge",
      dataConfig: {
        valueField: [],
        assitValueField: [],
      },
    };
  }

  if (chartType === "combo") {
    return {
      chartType: "combo",
      dataConfig: {
        xField: [],
        leftYFields: [],
        rightYFields: [],
        annotationField: [],
      },
    };
  }

  if (chartType === "table") {
    return {
      chartType: "table",
      dataConfig: {
        columnFields: [],
      },
    };
  }

  if (chartType === "indicator") {
    // 指标卡组件的 userConfig 是嵌套数组格式：[{ name, title, items: [...] }]
    // 从手动保存的 Schema 中学习到的正确格式
    return [
      {
        name: "youshuData",
        title: "指标数据",
        items: [
          {
            name: "kpi",
            title: "指标",
            required: true,
            setterName: "ColumnFieldSetter",
            setterProps: {
              single: false,
              showFormatTab: true,
              showSortTab: false,
              showDataLink: true,
              supportDynamicAlias: true,
              customTabs: [{ tabName: "指标配置" }],
              showBatchSet: true,
              batchSetFields: ["text", "title", "titleTip", "aggregateType", "format_type", "format_decimalDigit", "unit"],
            },
          },
          {
            name: "helpKpi",
            title: "辅助指标",
            setterName: "ColumnFieldSetter",
            setterProps: {
              single: false,
              showFormatTab: true,
              showSortTab: false,
              showDataLink: true,
            },
          },
        ],
      },
    ];
  }

  if (chartType === "pivot") {
    return {
      chartType: "pivot",
      dataConfig: {
        columnList: [],
      },
    };
  }

  if (chartType === "number") {
    return {
      chartType: "number",
      dataConfig: {
        valueField: [],
      },
    };
  }

  // 默认：bar/line/scatter/area 等
  return {
    chartType: chartType || "bar",
    dataConfig: {
      xField: [],
      yField: [],
      groupField: [],
      annotationField: [],
    },
  };
}

/**
 * 构建带字段信息的 userConfig
 * 从 dataSetModelMap 中提取已构建的字段对象，填充到 userConfig.dataConfig 中
 * 解决 userConfig.dataConfig 中字段为空数组导致图表无法正确显示数据的问题
 */
function buildUserConfigWithFields(chartType, dataSetModelMap) {
  const base = buildUserConfig(chartType);

  // 从 dataSetModelMap 中提取字段信息
  if (chartType === "pie") {
    const chartData = dataSetModelMap.chartData;
    if (chartData) {
      base.dataConfig.xField = chartData.xField || [];
      base.dataConfig.yField = chartData.yField || [];
    }
  } else if (chartType === "indicator") {
    // 指标卡的 userConfig 是嵌套数组格式：[{ name, title, items: [...] }]
    // 不需要额外填充字段，字段信息已在 dataSetModelMap.youshuData 中
    // userConfig 只是描述 UI 配置项的元数据，不包含实际字段数据
  } else if (chartType === "bar" || chartType === "line" || chartType === "area" || chartType === "scatter") {
    const chartData = dataSetModelMap.chartData;
    if (chartData) {
      base.dataConfig.xField = chartData.xField || [];
      base.dataConfig.yField = chartData.yField || [];
      if (base.dataConfig.groupField !== undefined) {
        base.dataConfig.groupField = chartData.groupField || [];
      }
    }
  } else if (chartType === "combo") {
    const dsData = dataSetModelMap.dataSetName;
    if (dsData) {
      base.dataConfig.xField = dsData.xField || [];
      base.dataConfig.leftYFields = dsData.leftYFields || [];
      base.dataConfig.rightYFields = dsData.rightYFields || [];
    }
  } else if (chartType === "table") {
    const tableData = dataSetModelMap.table;
    if (tableData) {
      base.dataConfig.columnFields = tableData.columnFields || [];
    }
  } else if (chartType === "pivot") {
    const dsData = dataSetModelMap.dataSetName;
    if (dsData) {
      base.dataConfig.columnList = dsData.columnList || [];
    }
  } else if (chartType === "gauge") {
    const chartData = dataSetModelMap.chartData;
    if (chartData) {
      base.dataConfig.valueField = chartData.valueField || [];
      if (base.dataConfig.assitValueField !== undefined) {
        base.dataConfig.assitValueField = chartData.assitValueField || [];
      }
    }
  } else if (chartType === "funnel") {
    const chartData = dataSetModelMap.chartData;
    if (chartData) {
      base.dataConfig.xField = chartData.xField || [];
      base.dataConfig.yField = chartData.yField || [];
    }
  }

  return base;
}

/**
 * 构建 mockData（图表示例数据）
 */
function buildMockData(chartType) {
  if (chartType === "bar") {
    return [
      {
        name: "chartData",
        data: {
          data: [
            { month: "Jan.", value: 18.9 },
            { month: "Feb.", value: 28.8 },
            { month: "Mar.", value: 39.3 },
            { month: "Apr.", value: 81.4 },
            { month: "May", value: 47 },
          ],
          meta: [
            { aliasName: "月份", alias: "month", category: "xField", dataType: "STRING" },
            { aliasName: "数值", alias: "value", category: "yField", dataType: "NUMBER" },
          ],
          currentPage: 1,
          totalCount: 5,
        },
      },
    ];
  }

  if (chartType === "line" || chartType === "area") {
    return [
      {
        name: "chartData",
        data: {
          data: [
            { xField: "2020", yField: 3 },
            { xField: "2021", yField: 4 },
            { xField: "2022", yField: 3.5 },
            { xField: "2023", yField: 5 },
            { xField: "2024", yField: 4.9 },
          ],
          meta: [
            { aliasName: "横轴", alias: "xField", category: "xField", dataType: "STRING" },
            { aliasName: "纵轴", alias: "yField", category: "yField", dataType: "NUMBER" },
          ],
          currentPage: 1,
          totalCount: 5,
        },
      },
    ];
  }

  if (chartType === "pie") {
    return [
      {
        name: "chartData",
        data: {
          data: [
            { xField: "分类A", yField: 63, ratio: 0.8, totalValue: 202, totalRatio: 0.32 },
            { xField: "分类B", yField: 73, ratio: -0.3, totalValue: 202, totalRatio: 0.32 },
            { xField: "分类C", yField: 66, ratio: 0.25, totalValue: 202, totalRatio: 0.32 },
          ],
          meta: [
            { aliasName: "分类字段", alias: "xField", category: "xField", dataType: "STRING" },
            { aliasName: "数值字段", alias: "yField", category: "yField", dataType: "NUMBER" },
            { aliasName: "趋势值字段", alias: "ratio", category: "ratio", dataType: "NUMBER" },
            { aliasName: "总值字段", alias: "totalValue", category: "totalValue", dataType: "NUMBER" },
            { aliasName: "总趋势值字段", alias: "totalRatio", category: "totalRatio", dataType: "NUMBER" },
          ],
          currentPage: 1,
          totalCount: 3,
        },
      },
    ];
  }

  if (chartType === "funnel") {
    return [
      {
        name: "chartData",
        data: {
          data: [
            { xField: "分类A", yField: 100 },
            { xField: "分类B", yField: 80 },
            { xField: "分类C", yField: 60 },
            { xField: "分类D", yField: 40 },
          ],
          meta: [
            { aliasName: "分类字段", alias: "xField", category: "xField", dataType: "STRING" },
            { aliasName: "数值字段", alias: "yField", category: "yField", dataType: "NUMBER" },
          ],
          currentPage: 1,
          totalCount: 4,
        },
      },
    ];
  }

  if (chartType === "gauge") {
    return [
      {
        name: "chartData",
        data: {
          data: [{ valueField: 75, assitValueField: 50 }],
          meta: [
            { aliasName: "主指标（必填）", alias: "valueField", category: "valueField", dataType: "NUMBER" },
            { aliasName: "辅助指标（选填）", alias: "assitValueField", category: "assitValueField", dataType: "NUMBER" },
          ],
          currentPage: 1,
          totalCount: 1,
        },
      },
    ];
  }

  if (chartType === "combo") {
    return [
      {
        name: "dataSetName",
        data: {
          data: [
            { xField: "2019-03", leftYFields: 350, rightYFields: 0.8 },
            { xField: "2019-04", leftYFields: 900, rightYFields: 0.6 },
            { xField: "2019-05", leftYFields: 300, rightYFields: 0.4 },
            { xField: "2019-06", leftYFields: 450, rightYFields: 0.38 },
            { xField: "2019-07", leftYFields: 470, rightYFields: 0.22 },
          ],
          meta: [
            { aliasName: "时间", alias: "xField", category: "xField", dataType: "STRING" },
            { aliasName: "数值1", alias: "leftYFields", category: "leftYFields", dataType: "NUMBER" },
            { aliasName: "数值2", alias: "rightYFields", category: "rightYFields", dataType: "NUMBER" },
          ],
          currentPage: 1,
          totalCount: 5,
        },
      },
    ];
  }

  if (chartType === "table") {
    return [
      {
        name: "table",
        data: {
          data: [
            { col1: "数据1", col2: "数据2", col3: 100 },
            { col1: "数据3", col2: "数据4", col3: 200 },
            { col1: "数据5", col2: "数据6", col3: 300 },
          ],
          meta: [
            { aliasName: "列1", alias: "col1", category: "columnFields", dataType: "STRING" },
            { aliasName: "列2", alias: "col2", category: "columnFields", dataType: "STRING" },
            { aliasName: "列3", alias: "col3", category: "columnFields", dataType: "NUMBER" },
          ],
          currentPage: 1,
          totalCount: 3,
        },
      },
    ];
  }

  if (chartType === "indicator") {
    return [
      {
        name: "youshuData",
        data: {
          data: [{ randomKey1: 23123, randomKey2: 7712 }],
          meta: [
            { title: "指标1", fieldKey: "randomKey1", category: "kpi", dataType: "STRING" },
            { title: "指标2", fieldKey: "randomKey2", category: "kpi", dataType: "STRING" },
          ],
          currentPage: 1,
          totalCount: 1,
        },
      },
    ];
  }

  if (chartType === "pivot") {
    return [
      {
        name: "dataSetName",
        data: {
          data: [
            { col1: 74, col2: 9, col3: 79 },
            { col1: 15, col2: 69, col3: 78 },
            { col1: 74, col2: 74, col3: 81 },
          ],
          meta: [
            { aliasName: "指标1", alias: "col1", category: "columnList", dataType: "NUMBER" },
            { aliasName: "指标2", alias: "col2", category: "columnList", dataType: "NUMBER" },
            { aliasName: "指标3", alias: "col3", category: "columnList", dataType: "NUMBER" },
          ],
          currentPage: 1,
          totalCount: 3,
        },
      },
    ];
  }

  return [
    {
      name: "chartData",
      data: {
        data: [],
        meta: [],
        currentPage: 1,
        totalCount: 0,
      },
    },
  ];
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

  // 收集所有需要的组件名
  const usedComponentNames = new Set(BASE_COMPONENTS);
  charts.forEach((chart) => {
    const componentName = CHART_COMPONENT_MAP[chart.type] || CHART_COMPONENT_MAP.bar;
    usedComponentNames.add(componentName);
  });

  // 构建 componentsMap
  // 注意：YoushuSimpleIndicatorCard 需要在 componentsMap 中提供默认的嵌套数组格式 userConfig
  // 正确格式：[{ name, title, items: [...] }]，从手动保存的 Schema 中学习到
  const indicatorDefaultUserConfig = [
    {
      name: "youshuData",
      title: "指标数据",
      items: [
        {
          name: "kpi",
          title: "指标",
          required: true,
          setterName: "ColumnFieldSetter",
          setterProps: {
            single: false,
            showFormatTab: true,
            showSortTab: false,
            showDataLink: true,
            supportDynamicAlias: true,
            customTabs: [{ tabName: "指标配置" }],
            showBatchSet: true,
            batchSetFields: ["text", "title", "titleTip", "aggregateType", "format_type", "format_decimalDigit", "unit"],
          },
        },
        {
          name: "helpKpi",
          title: "辅助指标",
          setterName: "ColumnFieldSetter",
          setterProps: {
            single: false,
            showFormatTab: true,
            showSortTab: false,
            showDataLink: true,
          },
        },
      ],
    },
  ];

  const componentsMap = Array.from(usedComponentNames).map((name) => {
    const entry = {
      package: "@/components/vc-yida-report",
      version: "1.0.6",
      componentName: name,
    };
    // 指标卡需要在 componentsMap 中提供默认 userConfig（数组格式）
    if (name === "YoushuSimpleIndicatorCard") {
      entry.userConfig = indicatorDefaultUserConfig;
    }
    return entry;
  });

  // 构建图表子节点和布局
  const chartChildren = [];
  const layoutItems = [];
  let currentX = 0;

  charts.forEach((chart, index) => {
    const componentName = CHART_COMPONENT_MAP[chart.type] || CHART_COMPONENT_MAP.bar;
    const fieldId = genFieldId(componentName);
    const nodeId = genNodeId();
    const chartTitle = chart.title || (componentName + "_" + (index + 1));
    const w = chart.w || 6;
    const h = chart.h || 22;

    // 如果超出宽度，换行
    if (currentX + w > 6) {
      currentX = 0;
    }

    // 布局项
    layoutItems.push({
      w: w,
      h: h,
      x: currentX,
      y: Math.floor(index / Math.ceil(6 / w)) * h,
      i: fieldId,
      moved: false,
      static: false,
    });

    currentX += w;
    if (currentX >= 6) currentX = 0;

    // 构建数据集模型
    const dataSetModelMap = buildDataSetModelMap(chart, cubeTenantId);

    // 构建 userConfig，需要从 dataSetModelMap 中提取字段信息填充到 dataConfig
    const userConfig = buildUserConfigWithFields(chart.type, dataSetModelMap);

    // 图表节点
    chartChildren.push({
      componentName: componentName,
      id: nodeId,
      props: {
        cid: nodeId,
        showComponentTitle: true,
        componentTitle: { type: "i18n", zh_CN: chartTitle, en_US: "" },
        componentTitleTextAlign: "LEFT",
        titleTipContent: { type: "i18n", zh_CN: "", en_US: "" },
        titleTipIconName: "help",
        headerSize: "medium",
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
        isHeightAuto: ["table", "indicator", "pivot"].includes(chart.type),
        ...(["table", "indicator"].includes(chart.type) ? { showFieldSelectIcon: true } : {}),
        datasetModel: { filterList: [] },
      },
    });
  });

  // 构建完整 Schema
  const schema = {
    schemaType: "superform",
    schemaVersion: "5.0",
    pages: [
      {
        utils: [],
        componentsMap: componentsMap,
        componentsTree: [
          {
            componentName: "Page",
            id: pageNodeId,
            props: {
              templateVersion: "1.0.0",
              params: [],
              containerStyle: {},
              pageStyle: ":root {\n  background-color: #f2f3f5;\n}\n",
              userVariables: [
                { text: "工号", id: "varWorkNo" },
                { text: "部门名称", id: "varDeptName" },
                { text: "所属公司编号", id: "varCorpNo" },
                { text: "部门编码", id: "varDeptNo" },
              ],
              className: "page_" + randomId(),
            },
            dataSource: {
              offline: [],
              globalConfig: {
                fit: {
                  compiled: "'use strict';\n\nvar __preParser__ = function fit(response) {\n  var content = response.content !== undefined ? response.content : response;\n  var error = {\n    message: response.errorMsg || response.errors && response.errors[0] && response.errors[0].msg || response.content || '远程数据源请求出错，success is false'\n  };\n  var success = true;\n  if (response.success !== undefined) {\n    success = response.success;\n  } else if (response.hasError !== undefined) {\n    success = !response.hasError;\n  }\n  return {\n    content: content,\n    success: success,\n    error: error\n  };\n};",
                  source: "function fit(response) {\r\n  const content = (response.content !== undefined) ? response.content : response;\r\n  const error = {\r\n    message: response.errorMsg ||\r\n      (response.errors && response.errors[0] && response.errors[0].msg) ||\r\n      response.content || '远程数据源请求出错，success is false',\r\n  };\r\n  let success = true;\r\n  if (response.success !== undefined) {\r\n    success = response.success;\r\n  } else if (response.hasError !== undefined) {\r\n    success = !response.hasError;\r\n  }\r\n  return {\r\n    content,\r\n    success,\r\n    error,\r\n  };\r\n}",
                  type: "js",
                  error: {},
                },
              },
              online: [],
              list: [],
              sync: true,
            },
            methods: {
              __initMethods__: {
                type: "js",
                source: "function (exports, module) { /*set actions code here*/ }",
                compiled: "function (exports, module) { /*set actions code here*/ }",
              },
            },
            lifeCycles: {
              componentDidMount: null,
              componentWillUnmount: null,
              constructor: {
                type: "js",
                compiled: "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}",
                source: "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}",
              },
            },
            children: [
              {
                componentName: "RootHeader",
                id: rootHeaderId,
                props: {},
                children: [
                  {
                    componentName: "YoushuPageHeader",
                    id: pageHeaderId,
                    props: {
                      status: "normal",
                      showTitle: true,
                      titleContent: { type: "i18n", zh_CN: reportTitle, en_US: reportTitle },
                      titleTip: { type: "i18n", zh_CN: "", en_US: "" },
                      cid: pageHeaderId,
                      tab: false,
                    },
                    children: [
                      {
                        componentName: "PageHeaderContent",
                        id: pageHeaderContentId,
                        props: {},
                        children: [],
                      },
                      {
                        componentName: "PageHeaderTab",
                        id: genNodeId(),
                        props: {},
                        children: [],
                      },
                    ],
                  },
                ],
              },
              {
                componentName: "RootContent",
                id: rootContentId,
                props: {
                  rglSwitch: true,
                  contentBgColor: "transparent",
                  layout: layoutItems,
                },
                children: chartChildren,
              },
              {
                componentName: "RootFooter",
                id: rootFooterId,
                props: {},
              },
            ],
          },
        ],
        css: "body {\n  background-color: #f2f3f5;\n}\n",
      },
    ],
    id: reportId || ("REPORT-" + randomId().toUpperCase() + randomId().toUpperCase()),
    actions: {
      module: { source: "", compiled: "" },
      list: [],
    },
  };

  return schema;
}

// ── HTTP 请求：创建报表 ───────────────────────────────

/**
 * 调用 saveFormSchemaInfo 创建空白报表
 */
async function createBlankReport(baseUrl, csrfToken, cookies, appType, reportTitle) {
  const querystring = require("querystring");
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formType: "report",
    title: JSON.stringify({ zh_CN: reportTitle, en_US: reportTitle, type: "i18n" }),
  });

  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const parsedUrl = new URL(baseUrl);
  const isHttps = parsedUrl.protocol === "https:";
  const requestModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: `/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        Origin: baseUrl,
        Referer: baseUrl + "/",
        Cookie: cookieHeader,
      },
      timeout: 30000,
    };

    const req = requestModule.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        console.error("[HTTP] 状态码:", res.statusCode);
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) { resolve({ __needLogin: true }); return; }
          if (isCsrfTokenExpired(parsed)) { resolve({ __csrfExpired: true }); return; }
          resolve(parsed);
        } catch {
          resolve({ success: false, errorMsg: "HTTP " + res.statusCode + ": 响应非 JSON" });
        }
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("请求超时")); });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 调用 saveFormSchema 保存报表 Schema
 */
async function saveReportSchema(baseUrl, csrfToken, cookies, appType, reportId, schema) {
  const querystring = require("querystring");
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formUuid: reportId,
    content: JSON.stringify(schema),
    schemaVersion: "V5",
    importSchema: "true",
  });

  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const parsedUrl = new URL(baseUrl);
  const isHttps = parsedUrl.protocol === "https:";
  const requestModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: `/dingtalk/web/${appType}/_view/query/formdesign/saveFormSchema.json`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        Origin: baseUrl,
        Referer: baseUrl + "/",
        Cookie: cookieHeader,
      },
      timeout: 60000,
    };

    const req = requestModule.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        console.error("[HTTP] 状态码:", res.statusCode);
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) { resolve({ __needLogin: true }); return; }
          if (isCsrfTokenExpired(parsed)) { resolve({ __csrfExpired: true }); return; }
          resolve(parsed);
        } catch {
          resolve({ success: false, errorMsg: "HTTP " + res.statusCode + ": 响应非 JSON" });
        }
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("请求超时")); });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// ── 主流程 ────────────────────────────────────────────

async function main() {
  const { appType, reportTitle, chartsJsonOrFile } = parseArgs();

  const SEP = "=".repeat(50);
  console.error(SEP);
  console.error("🚀 宜搭报表创建工具");
  console.error(SEP);
  console.error("应用 ID:", appType);
  console.error("报表名称:", reportTitle);
  console.error("图表定义:", chartsJsonOrFile);

  // Step 1: 读取登录态
  console.error("\n[Step 1] 读取登录态...");
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error("未找到登录缓存，触发登录...");
    cookieData = triggerLogin();
  }

  let { csrf_token: csrfToken, cookies } = cookieData;
  let baseUrl = resolveBaseUrl(cookieData);
  console.error("登录态就绪，域名:", baseUrl);

  // 提取 corpId 作为 cubeTenantId
  const corpId = cookieData.corp_id || "";
  console.error("组织 ID (cubeTenantId):", corpId || "（未获取到，图表数据源需手动配置）");

  const authRef = { csrfToken, cookies, baseUrl, cookieData };

  // Step 2: 读取图表定义
  console.error("\n[Step 2] 读取图表定义...");
  const charts = readChartsDefinition(chartsJsonOrFile);
  console.error("图表数量:", charts.length);
  charts.forEach((chart, i) => {
    const componentName = CHART_COMPONENT_MAP[chart.type] || CHART_COMPONENT_MAP.bar;
    console.error(`  ${i + 1}. [${chart.type}] ${chart.title || componentName} (cubeCode: ${chart.cubeCode || "未配置"})`);
  });

  // Step 3: 创建空白报表
  console.error("\n[Step 3] 创建空白报表...");
  const createResult = await requestWithAutoLogin(function (auth) {
    return createBlankReport(auth.baseUrl, auth.csrfToken, auth.cookies, appType, reportTitle);
  }, authRef);

  if (!createResult || !createResult.success || !createResult.content) {
    const errorMsg = createResult ? createResult.errorMsg || "未知错误" : "请求失败";
    console.error("创建报表失败:", errorMsg);
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }

  const reportId = createResult.content.formUuid || createResult.content;
  console.error("报表创建成功，ID:", reportId);

  // Step 4: 构建报表 Schema
  console.error("\n[Step 4] 构建报表 Schema...");
  const schema = buildReportSchema(reportTitle, charts, reportId, corpId);
  // 更新 schema 中的 id 为实际 reportId
  schema.id = reportId;
  // DEBUG: 输出 Schema 到文件
  try {
    const debugPath = require('path').resolve(process.cwd(), '.cache/debug-full-schema.json');
    require('fs').writeFileSync(debugPath, JSON.stringify(schema, null, 2));
    console.error("[DEBUG] Schema 已写入:", debugPath);
  } catch(e) { console.error("[DEBUG] 写入失败:", e.message); }
  console.error("Schema 构建完成，图表数:", charts.length);

  // Step 5: 保存报表 Schema
  console.error("\n[Step 5] 保存报表 Schema...");
  const saveResult = await requestWithAutoLogin(function (auth) {
    return saveReportSchema(auth.baseUrl, auth.csrfToken, auth.cookies, appType, reportId, schema);
  }, authRef);

  if (!saveResult || !saveResult.success) {
    const errorMsg = saveResult ? saveResult.errorMsg || "未知错误" : "请求失败";
    console.error("保存 Schema 失败:", errorMsg);
    console.error("报表已创建（ID:", reportId, "），但 Schema 保存失败，请手动配置图表");
    console.log(JSON.stringify({ success: false, reportId, error: errorMsg }));
    process.exit(1);
  }

  console.error("Schema 保存成功！");

  // 输出结果
  const reportUrl = authRef.baseUrl + "/" + appType + "/workbench/" + reportId;
  console.error("\n" + SEP);
  console.error("✅ 报表创建成功！");
  console.error("报表 ID:", reportId);
  console.error("报表名称:", reportTitle);
  console.error("图表数量:", charts.length);
  console.error("访问链接:", reportUrl);
  console.error(SEP);

  console.log(JSON.stringify({
    success: true,
    reportId: reportId,
    reportTitle: reportTitle,
    appType: appType,
    chartCount: charts.length,
    url: reportUrl,
  }));
}

// 当直接执行时（node create-report.js）自动运行
if (require.main === module) {
  main().catch((err) => {
    console.error("执行异常:", err.message);
    process.exit(1);
  });
}

module.exports = { run: main };
