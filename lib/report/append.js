"use strict";

/**
 * append.js - 向已有报表追加图表
 *
 * 用法：
 *   openyida append-chart <appType> <reportId> <图表定义JSON或文件路径>
 *
 * 关键规律（从 scripts/append-*.js 学习）：
 *   - GET Schema 用 /alibaba/web/ 路径
 *   - SAVE Schema 用 /dingtalk/web/ 路径
 *   - 计算新图表 Y 位置：遍历 layout 找 maxBottom
 *   - 需要检查并按需添加 componentsMap 条目
 */

const fs = require("fs");
const querystring = require("querystring");

const {
  loadCookieData,
  resolveBaseUrl,
  requestWithAutoLogin,
  httpGet,
  httpPost,
} = require("../core/utils");

const { CHART_COMPONENT_MAP } = require("./constants");
const {
  buildDataSetModelMap,
  buildUserConfigWithFields,
  buildMockData,
  getChartSettings,
  buildAfterFetch,
  buildExportData,
  buildLink,
} = require("./chart-builder");
const { genNodeId, genFieldId, randomId } = require("./constants");

// ── HTTP：获取已有报表 Schema ─────────────────────────
// GET 用 /alibaba/web/ 路径

async function getReportSchema(baseUrl, cookies, appType, reportId) {
  return httpGet(
    baseUrl,
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid: reportId, schemaVersion: "V5" },
    cookies
  );
}

// ── HTTP：保存报表 Schema ─────────────────────────────
// SAVE 用 /dingtalk/web/ 路径

async function saveSchema(baseUrl, csrfToken, cookies, appType, reportId, schema) {
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formUuid: reportId,
    content: JSON.stringify(schema),
    schemaVersion: "V5",
    importSchema: "true",
  });
  return httpPost(
    baseUrl,
    `/dingtalk/web/${appType}/_view/query/formdesign/saveFormSchema.json`,
    postData,
    cookies
  );
}

// ── 参数解析 ──────────────────────────────────────────

function parseArgs(args) {
  if (!args || args.length < 3) {
    console.error("用法: openyida append-chart <appType> <reportId> <图表定义JSON或文件路径>");
    console.error("示例: openyida append-chart APP_XXX REPORT-XXX charts.json");
    console.error("");
    console.error("图表定义格式（数组）：");
    console.error('[{"type":"bar","title":"柱状图","cubeCode":"FORM_XXX","xField":{...},"yField":[...]}]');
    process.exit(1);
  }
  const [appType, reportId, chartsJsonOrFile] = args;
  return { appType, reportId, chartsJsonOrFile };
}

// ── 读取图表定义 ──────────────────────────────────────

function readChartsDefinition(chartsJsonOrFile) {
  let charts;
  if (fs.existsSync(chartsJsonOrFile)) {
    try {
      charts = JSON.parse(fs.readFileSync(chartsJsonOrFile, "utf-8"));
    } catch (e) {
      console.error("读取图表定义文件失败:", e.message);
      process.exit(1);
    }
  } else {
    try {
      charts = JSON.parse(chartsJsonOrFile);
    } catch (e) {
      console.error("图表定义解析失败:", e.message);
      process.exit(1);
    }
  }
  if (!Array.isArray(charts)) {
    console.error("图表定义必须是数组格式");
    process.exit(1);
  }
  return charts;
}

// ── 构建单个图表节点 ──────────────────────────────────

function buildChartNode(chart, cubeTenantId) {
  const chartType = chart.type || "bar";
  const componentName = CHART_COMPONENT_MAP[chartType] || CHART_COMPONENT_MAP.bar;
  const fieldId = genFieldId(componentName);
  const nodeId = genNodeId();
  const chartTitle = chart.title || (componentName + "_" + randomId().slice(0, 4));

  const dataSetModelMap = buildDataSetModelMap(chart, cubeTenantId);
  const userConfig = buildUserConfigWithFields(chartType, dataSetModelMap);

  return {
    fieldId,
    nodeId,
    componentName,
    w: chart.w || 6,
    h: chart.h || 22,
    node: {
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
        mockData: buildMockData(chartType),
        dataSetModelMap: dataSetModelMap,
        userConfig: userConfig,
        settings: getChartSettings(chartType),
        titleTip: false,
        hasFullscreen: false,
        copyAsImg: false,
        height: null,
        isHeightAuto: ["table", "indicator", "pivot"].includes(chartType),
        datasetModel: { filterList: [] },
      },
    },
  };
}

// ── 主流程 ────────────────────────────────────────────

async function main(args) {
  const { appType, reportId, chartsJsonOrFile } = parseArgs(args);

  const SEP = "=".repeat(50);
  console.error(SEP);
  console.error("🔧 宜搭报表追加图表工具");
  console.error(SEP);
  console.error("应用 ID:", appType);
  console.error("报表 ID:", reportId);
  console.error("图表定义:", chartsJsonOrFile);

  // Step 1: 读取登录态
  console.error("\n[Step 1] 读取登录态...");
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error("未找到登录缓存，请先执行 openyida login");
    process.exit(1);
  }
  const { csrf_token: csrfToken, cookies } = cookieData;
  const baseUrl = resolveBaseUrl(cookieData);
  const corpId = cookieData.corp_id || "";
  console.error("登录态就绪，域名:", baseUrl);

  const authRef = { csrfToken, cookies, baseUrl, cookieData };

  // Step 2: 读取图表定义
  console.error("\n[Step 2] 读取图表定义...");
  const charts = readChartsDefinition(chartsJsonOrFile);
  console.error("追加图表数量:", charts.length);
  charts.forEach((chart, i) => {
    const componentName = CHART_COMPONENT_MAP[chart.type] || CHART_COMPONENT_MAP.bar;
    console.error(`  ${i + 1}. [${chart.type}] ${chart.title || componentName}`);
  });

  // Step 3: 获取已有报表 Schema
  console.error("\n[Step 3] 获取已有报表 Schema...");
  const getResult = await requestWithAutoLogin(function (auth) {
    return getReportSchema(auth.baseUrl, auth.cookies, appType, reportId);
  }, authRef);

  if (!getResult || getResult.success === false) {
    const errorMsg = getResult ? getResult.errorMsg || "未知错误" : "请求失败";
    console.error("获取报表 Schema 失败:", errorMsg);
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }

  const schema = typeof getResult.content === "string"
    ? JSON.parse(getResult.content)
    : getResult.content;

  const page = schema.pages[0];
  const rootContent = page.componentsTree[0].children.find(
    (c) => c.componentName === "RootContent"
  );

  if (!rootContent) {
    console.error("报表 Schema 结构异常：找不到 RootContent 节点");
    process.exit(1);
  }

  console.error("当前 layout 数量:", rootContent.props.layout.length);
  console.error("当前 children 数量:", rootContent.children.length);

  // Step 4: 计算新图表 Y 起始位置
  let maxBottom = 0;
  rootContent.props.layout.forEach((l) => {
    const bottom = l.y + l.h;
    if (bottom > maxBottom) maxBottom = bottom;
  });
  console.error("新图表起始 Y 位置:", maxBottom);

  // Step 5: 构建并追加图表节点
  console.error("\n[Step 4] 构建并追加图表节点...");
  let currentX = 0;
  let currentRowY = maxBottom;

  charts.forEach((chart, index) => {
    const built = buildChartNode(chart, corpId);
    const { fieldId, componentName, w, h, node } = built;

    // 换行逻辑
    if (currentX + w > 6) {
      currentX = 0;
      currentRowY += h;
    }

    // 检查并按需添加 componentsMap 条目
    const alreadyInMap = page.componentsMap.some(
      (c) => c.componentName === componentName
    );
    if (!alreadyInMap) {
      page.componentsMap.push({
        package: "@/components/vc-yida-report",
        version: "1.0.6",
        componentName: componentName,
      });
      console.error(`  已将 ${componentName} 添加到 componentsMap`);
    }

    // 追加节点和布局
    rootContent.children.push(node);
    rootContent.props.layout.push({
      w,
      h,
      x: currentX,
      y: currentRowY,
      i: fieldId,
      moved: false,
      static: false,
    });

    currentX += w;
    if (currentX >= 6) {
      currentX = 0;
      currentRowY += h;
    }

    console.error(`  ${index + 1}. [${chart.type}] ${chart.title || componentName} → x=${currentX - w < 0 ? 0 : currentX - w}, y=${currentRowY}`);
  });

  console.error("追加后 layout 数量:", rootContent.props.layout.length);

  // Step 6: 保存 Schema
  console.error("\n[Step 5] 保存 Schema...");
  const saveResult = await requestWithAutoLogin(function (auth) {
    return saveSchema(auth.baseUrl, auth.csrfToken, auth.cookies, appType, reportId, schema);
  }, authRef);

  if (!saveResult || !saveResult.success) {
    const errorMsg = saveResult ? saveResult.errorMsg || "未知错误" : "请求失败";
    console.error("保存 Schema 失败:", errorMsg);
    console.log(JSON.stringify({ success: false, reportId, error: errorMsg }));
    process.exit(1);
  }

  const reportUrl = `${baseUrl}/${appType}/workbench/${reportId}`;
  console.error("\n" + SEP);
  console.error("✅ 图表追加成功！");
  console.error("报表 ID:", reportId);
  console.error("追加图表数:", charts.length);
  console.error("访问链接:", reportUrl);
  console.error(SEP);

  console.log(JSON.stringify({
    success: true,
    reportId,
    appType,
    appendedChartCount: charts.length,
    url: reportUrl,
  }));
}

if (require.main === module) {
  main().catch((err) => {
    console.error("执行异常:", err.message);
    process.exit(1);
  });
}

module.exports = { run: main };
