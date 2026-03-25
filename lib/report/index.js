"use strict";

const fs = require("fs");
const path = require("path");

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  requestWithAutoLogin,
} = require("../core/utils");

const { CHART_COMPONENT_MAP } = require("./constants");
const {
  buildReportSchema,
  buildSelectFilter,
  buildFilterContainer,
  injectFilterLinkage,
} = require("./chart-builder");
const { genNodeId, genFieldId, randomId } = require("./constants");
const { createBlankReport, saveReportSchema } = require("./http");

// ── 参数解析 ──────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(3);
  if (argv.length < 3) {
    console.error('用法: openyida create-report <appType> "<报表名称>" <图表定义JSON或文件路径>');
    console.error("示例: openyida create-report APP_XXX \"销售报表\" charts.json");
    process.exit(1);
  }
  const [appType, reportTitle, chartsJsonOrFile] = argv;
  return { appType, reportTitle, chartsJsonOrFile };
}

// ── 读取图表定义 ──────────────────────────────────────

function readChartsDefinition(chartsJsonOrFile) {
  let charts;

  if (fs.existsSync(chartsJsonOrFile)) {
    try {
      const content = fs.readFileSync(chartsJsonOrFile, "utf-8");
      charts = JSON.parse(content);
    } catch (e) {
      console.error("读取图表定义文件失败:", e.message);
      process.exit(1);
    }
  } else {
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

// ── 读取报表配置（支持 filters 顶层配置） ─────────────

/**
 * 读取报表配置文件（支持两种格式）：
 *
 * 格式1（纯图表数组，向后兼容）：
 *   [ { type: "bar", title: "...", ... }, ... ]
 *
 * 格式2（带筛选器的完整配置）：
 *   {
 *     "filters": [
 *       {
 *         "title": "竞赛项目",
 *         "placeholder": "请选择竞赛项目",
 *         "cubeCode": "FORM_XXX",
 *         "valueField": { "fieldCode": "selectField_xxx_value", "aliasName": "竞赛项目_值", "dataType": "STRING" },
 *         "labelField": { "fieldCode": "selectField_xxx_code", "aliasName": "竞赛项目_ID", "dataType": "STRING" },
 *         "linkTo": ["chart0", "chart1"]   // 联动到哪些图表（按 index 或 title 匹配）
 *       }
 *     ],
 *     "charts": [ { type: "bar", ... }, ... ]
 *   }
 */
function readReportConfig(chartsJsonOrFile) {
  let raw;

  if (fs.existsSync(chartsJsonOrFile)) {
    try {
      raw = JSON.parse(fs.readFileSync(chartsJsonOrFile, "utf-8"));
    } catch (e) {
      console.error("读取配置文件失败:", e.message);
      process.exit(1);
    }
  } else {
    try {
      raw = JSON.parse(chartsJsonOrFile);
    } catch (e) {
      console.error("配置解析失败（既不是有效文件路径，也不是有效 JSON）:", e.message);
      process.exit(1);
    }
  }

  // 格式1：纯数组
  if (Array.isArray(raw)) {
    return { charts: raw, filters: [] };
  }

  // 格式2：对象，含 charts 和可选 filters
  if (raw && Array.isArray(raw.charts)) {
    return {
      charts: raw.charts,
      filters: Array.isArray(raw.filters) ? raw.filters : [],
    };
  }

  console.error("配置格式错误：必须是图表数组或包含 charts 字段的对象");
  process.exit(1);
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

  const corpId = cookieData.corp_id || "";
  console.error("组织 ID (cubeTenantId):", corpId || "（未获取到，图表数据源需手动配置）");

  const authRef = { csrfToken, cookies, baseUrl, cookieData };

  // Step 2: 读取图表定义和筛选器配置
  console.error("\n[Step 2] 读取图表定义...");
  const { charts, filters } = readReportConfig(chartsJsonOrFile);
  console.error("图表数量:", charts.length);
  console.error("筛选器数量:", filters.length);
  charts.forEach((chart, i) => {
    const componentName = CHART_COMPONENT_MAP[chart.type] || CHART_COMPONENT_MAP.bar;
    console.error(`  ${i + 1}. [${chart.type}] ${chart.title || componentName} (cubeCode: ${chart.cubeCode || "未配置"})`);
  });
  if (filters.length > 0) {
    filters.forEach((f, i) => {
      console.error(`  筛选器${i + 1}. ${f.title || "筛选器"} (fieldCode: ${(f.valueField && f.valueField.fieldCode) || "未配置"})`);
    });
  }

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
  schema.id = reportId;

  // Step 4.1: 注入筛选器（如果有）
  if (filters.length > 0) {
    console.error("[Step 4.1] 注入筛选器...");

    const page = schema.pages[0];
    const componentsTree = page.componentsTree[0];

    // 找到 PageHeaderContent 节点（筛选器容器放在这里）
    const rootHeader = componentsTree.children.find((c) => c.componentName === "RootHeader");
    const pageHeader = rootHeader && rootHeader.children && rootHeader.children.find((c) => c.componentName === "YoushuPageHeader");
    const pageHeaderContent = pageHeader && pageHeader.children && pageHeader.children.find((c) => c.componentName === "PageHeaderContent");

    if (pageHeaderContent) {
      // 确保 componentsMap 中有筛选器相关组件
      const filterComponents = ["YoushuSelectFilter", "YoushuTopFilterContainer"];
      filterComponents.forEach((compName) => {
        if (!page.componentsMap.some((c) => c.componentName === compName)) {
          page.componentsMap.push({ package: "@/components/vc-yida-report", version: "1.0.6", componentName: compName });
        }
      });

      // 构建筛选器组件列表
      const builtFilters = filters.map((filterDef) => {
        const filterNodeId = genNodeId();
        const filterFieldId = genFieldId("YoushuSelectFilter");
        return buildSelectFilter(
          { ...filterDef, cubeTenantId: filterDef.cubeTenantId || corpId },
          filterNodeId,
          filterFieldId
        );
      });

      // 构建筛选器容器并注入到 PageHeaderContent
      const containerFieldId = genFieldId("filter");
      const filterContainer = buildFilterContainer(builtFilters, containerFieldId);
      if (!pageHeaderContent.children) pageHeaderContent.children = [];
      pageHeaderContent.children.push(filterContainer);

      // 对每个筛选器，根据 linkTo 配置注入联动到对应图表
      const rootContent = componentsTree.children.find((c) => c.componentName === "RootContent");
      builtFilters.forEach((builtFilter, fi) => {
        const filterDef = filters[fi];
        const filterMeta = builtFilter.__filterMeta__;
        const linkTo = filterDef.linkTo || [];
        // 如果没有指定 linkTo，默认联动所有图表
        const targetCharts = linkTo.length > 0 ? linkTo : charts.map((_, idx) => idx);

        targetCharts.forEach((target) => {
          // target 可以是 index（数字）或 title（字符串）
          let chartIndex = typeof target === "number" ? target : charts.findIndex((c) => c.title === target);
          if (chartIndex < 0 || chartIndex >= charts.length) return;

          const chart = charts[chartIndex];
          const chartNode = rootContent && rootContent.children && rootContent.children[chartIndex];
          if (!chartNode || !chartNode.props || !chartNode.props.dataSetModelMap) return;

          const filterFieldCode = filterDef.filterFieldCode || (filterDef.valueField && filterDef.valueField.fieldCode) || "";
          const cubeCode = chart.cubeCode || filterDef.cubeCode || "";

          chartNode.props.dataSetModelMap = injectFilterLinkage(
            chartNode.props.dataSetModelMap,
            filterMeta,
            filterFieldCode,
            cubeCode,
            corpId
          );
          console.error(`  筛选器${fi + 1} 已联动到图表${chartIndex + 1}: ${chart.title || chart.type}`);
        });
      });

      console.error("筛选器注入完成，数量:", builtFilters.length);
    } else {
      console.error("[警告] 未找到 PageHeaderContent 节点，筛选器注入跳过");
    }
  }

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

// 当直接执行时（node lib/report/index.js）自动运行
if (require.main === module) {
  main().catch((err) => {
    console.error("执行异常:", err.message);
    process.exit(1);
  });
}

module.exports = { run: main };
