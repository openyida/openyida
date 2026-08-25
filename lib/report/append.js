'use strict';

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

const fs = require('fs');

const { CliError } = require('../core/cli-error');
const { createAuthRef, isAuthRefReady } = require('../core/yida-client');
const { CHART_COMPONENT_MAP } = require('./constants');
const {
  buildDataSetModelMap,
  buildUserConfigWithFields,
  buildMockData,
  getChartSettings,
  buildAfterFetch,
  buildExportData,
  buildLink,
  validateChartConfig,
  getDefaultLayout,
} = require('./chart-builder');
const { genNodeId, genFieldId, randomId } = require('./constants');
const { warn } = require('../core/chalk');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { getReportSchema, saveReportSchema } = require('./http');
const { requireSchemaServerRevision } = require('../core/server-revision');
const {
  assertReportSchemaReadback,
  normalizeReportSchemaContent,
  prepareReportSchemaForSave,
} = require('./contract');

// ── HTTP：获取已有报表 Schema ─────────────────────────
// GET 用 /alibaba/web/ 路径

function ensureSession() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError('未获取到有效宜搭登录态，请先执行 openyida login', {
      code: 'NEED_LOGIN',
    });
  }
  return authRef;
}

// ── 参数解析 ──────────────────────────────────────────

function parseArgs(args) {
  const openOption = parseOpenOption(args || []);
  const filteredArgs = openOption.args;
  if (!filteredArgs || filteredArgs.length < 3) {
    warn('用法: openyida append-chart <appType> <reportId> <图表定义JSON或文件路径>');
    warn('示例: openyida append-chart APP_XXX REPORT-XXX charts.json');
    warn('');
    warn('图表定义格式（数组）：');
    warn('[{"type":"bar","title":"柱状图","cubeCode":"FORM_XXX","xField":{...},"yField":[...]}]');
    throw new CliError('用法: openyida append-chart <appType> <reportId> <图表定义JSON或文件路径>', {
      code: 'APPEND_CHART_INVALID_ARGUMENTS',
    });
  }
  const [appType, reportId, chartsJsonOrFile] = filteredArgs;
  return { appType, reportId, chartsJsonOrFile, browserOpenMode: openOption.mode };
}

// ── 读取图表定义 ──────────────────────────────────────

function readChartsDefinition(chartsJsonOrFile) {
  let charts;
  if (fs.existsSync(chartsJsonOrFile)) {
    try {
      charts = JSON.parse(fs.readFileSync(chartsJsonOrFile, 'utf-8'));
    } catch (e) {
      warn('读取图表定义文件失败:', e.message);
      throw new CliError(`读取图表定义文件失败: ${e.message}`, {
        code: 'APPEND_CHART_CONFIG_READ_FAILED',
        details: { file: chartsJsonOrFile },
      });
    }
  } else {
    try {
      charts = JSON.parse(chartsJsonOrFile);
    } catch (e) {
      warn('图表定义解析失败:', e.message);
      throw new CliError(`图表定义解析失败: ${e.message}`, {
        code: 'APPEND_CHART_CONFIG_PARSE_FAILED',
        details: { input: chartsJsonOrFile },
      });
    }
  }
  if (!Array.isArray(charts)) {
    warn('图表定义必须是数组格式');
    throw new CliError('图表定义必须是数组格式', {
      code: 'APPEND_CHART_CONFIG_INVALID',
    });
  }
  return charts;
}

// ── 构建单个图表节点 ──────────────────────────────────

function buildChartNode(chart, cubeTenantId) {
  const chartType = chart.type || 'bar';
  const componentName = CHART_COMPONENT_MAP[chartType] || CHART_COMPONENT_MAP.bar;
  const fieldId = genFieldId(componentName);
  const nodeId = genNodeId();
  const chartTitle = chart.title || (componentName + '_' + randomId().slice(0, 4));

  const dataSetModelMap = buildDataSetModelMap(chart, cubeTenantId);
  const userConfig = buildUserConfigWithFields(chartType, dataSetModelMap);

  return {
    fieldId,
    nodeId,
    componentName,
    w: chart.w || getDefaultLayout(chartType).w,
    h: chart.h || getDefaultLayout(chartType).h,
    node: {
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
        mockData: buildMockData(chartType),
        dataSetModelMap: dataSetModelMap,
        userConfig: userConfig,
        settings: getChartSettings(chartType),
        titleTip: false,
        hasFullscreen: false,
        copyAsImg: false,
        height: null,
        isHeightAuto: ['table', 'indicator', 'pivot'].includes(chartType),
        datasetModel: { filterList: [] },
      },
    },
  };
}

// ── 主流程 ────────────────────────────────────────────

async function main(args) {
  const { appType, reportId, chartsJsonOrFile, browserOpenMode } = parseArgs(args);

  const SEP = '='.repeat(50);
  warn(SEP);
  warn('🔧 宜搭报表追加图表工具');
  warn(SEP);
  warn('应用 ID:', appType);
  warn('报表 ID:', reportId);
  warn('图表定义:', chartsJsonOrFile);

  // Step 1: 读取登录态
  warn('\n[Step 1] 读取登录态...');
  const authRef = ensureSession();
  const corpId = authRef.corpId || (authRef.authData && authRef.authData.corp_id) || '';
  warn('登录态就绪，域名:', authRef.baseUrl);

  // Step 2: 读取图表定义
  warn('\n[Step 2] 读取图表定义...');
  const charts = readChartsDefinition(chartsJsonOrFile);
  warn('追加图表数量:', charts.length);
  let hasConfigError = false;
  charts.forEach((chart, i) => {
    const componentName = CHART_COMPONENT_MAP[chart.type] || CHART_COMPONENT_MAP.bar;
    warn(`  ${i + 1}. [${chart.type}] ${chart.title || componentName}`);
    if (!validateChartConfig(chart, i)) {
      hasConfigError = true;
    }
  });
  if (hasConfigError) {
    warn('\n❌ 图表配置存在错误，请修正后重试。');
    warn('提示：使用 openyida get-schema <appType> <formUuid> 获取表单字段信息。');
    throw new CliError('图表配置存在错误，请修正后重试。', {
      code: 'APPEND_CHART_CONFIG_INVALID',
    });
  }

  // Step 3: 获取已有报表 Schema
  warn('\n[Step 3] 获取已有报表 Schema...');
  const getResult = await getReportSchema(authRef, appType, reportId);

  if (!getResult || getResult.success === false) {
    const errorMsg = getResult ? getResult.errorMsg || '未知错误' : '请求失败';
    warn('获取报表 Schema 失败:', errorMsg);
    throw new CliError(errorMsg, {
      code: 'APPEND_CHART_GET_SCHEMA_FAILED',
      details: getResult || { success: false, errorMsg },
    });
  }

  const schema = typeof getResult.content === 'string'
    ? JSON.parse(getResult.content)
    : getResult.content;
  const serverRevision = requireSchemaServerRevision(getResult);

  const page = schema.pages[0];
  const rootContent = page.componentsTree[0].children.find(
    (c) => c.componentName === 'RootContent'
  );

  if (!rootContent) {
    warn('报表 Schema 结构异常：找不到 RootContent 节点');
    throw new CliError('报表 Schema 结构异常：找不到 RootContent 节点', {
      code: 'APPEND_CHART_SCHEMA_INVALID',
    });
  }

  warn('当前 layout 数量:', rootContent.props.layout.length);
  warn('当前 children 数量:', rootContent.children.length);

  // Step 4: 计算新图表 Y 起始位置
  let maxBottom = 0;
  rootContent.props.layout.forEach((l) => {
    const bottom = l.y + l.h;
    if (bottom > maxBottom) {maxBottom = bottom;}
  });
  warn('新图表起始 Y 位置:', maxBottom);

  // Step 5: 构建并追加图表节点
  warn('\n[Step 4] 构建并追加图表节点...');
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
        package: '@/components/vc-yida-report',
        version: '1.0.6',
        componentName: componentName,
      });
      warn(`  已将 ${componentName} 添加到 componentsMap`);
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

    warn(`  ${index + 1}. [${chart.type}] ${chart.title || componentName} → x=${currentX - w < 0 ? 0 : currentX - w}, y=${currentRowY}`);
  });

  warn('追加后 layout 数量:', rootContent.props.layout.length);

  // Step 6: 保存 Schema
  warn('\n[Step 5] 保存 Schema...');
  const expectedSchema = prepareReportSchemaForSave(schema, { serverRevision });
  const saveResult = await saveReportSchema(authRef, appType, reportId, expectedSchema, serverRevision);

  if (!saveResult || !saveResult.success) {
    const errorMsg = saveResult ? saveResult.errorMsg || '未知错误' : '请求失败';
    warn('保存 Schema 失败:', errorMsg);
    throw new CliError(errorMsg, {
      code: 'APPEND_CHART_SAVE_FAILED',
      details: saveResult || { success: false, reportId, errorMsg },
    });
  }

  const readbackResult = await getReportSchema(authRef, appType, reportId);
  if (!readbackResult || readbackResult.success === false) {
    const errorMsg = readbackResult ? readbackResult.errorMsg || '未知错误' : '请求失败';
    throw new CliError(errorMsg, {
      code: 'APPEND_CHART_READBACK_FAILED',
      details: readbackResult || { success: false, reportId, errorMsg },
    });
  }
  assertReportSchemaReadback(expectedSchema, normalizeReportSchemaContent(readbackResult));

  const reportUrl = `${authRef.baseUrl}/${appType}/workbench/${reportId}`;
  warn('\n' + SEP);
  warn('✅ 图表追加成功！');
  warn('报表 ID:', reportId);
  warn('追加图表数:', charts.length);
  warn('访问链接:', reportUrl);
  warn(SEP);

  const result = withBrowserHandoff(
    {
      success: true,
      reportId,
      appType,
      appendedChartCount: charts.length,
      readbackVerified: true,
      url: reportUrl,
    },
    reportUrl,
    { stage: 'append_chart_success', title: reportId },
    browserOpenMode
  );
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  main().catch((err) => {
    warn('执行异常:', err.message);
    process.exitCode = err && err.exitCode ? err.exitCode : 1;
  });
}

module.exports = {
  run: main,
  parseArgs,
  readChartsDefinition,
  getReportSchema,
  saveSchema: saveReportSchema,
};
