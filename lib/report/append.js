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
const { getReportChartCapability } = require('./capability-registry');
const {
  buildChartNode,
  buildReportComponentMapEntry,
  validateChartConfig,
} = require('./chart-builder');
const { warn } = require('../core/chalk');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { getReportSchema, saveReportSchema } = require('./http');
const {
  isSaveFormSchemaRevisionConflict,
  requireSchemaServerRevision,
} = require('../core/server-revision');
const { packReportLayout } = require('./layout');
const { validateReportConfig } = require('./validation');
const {
  assertReportSchemaReadback,
  normalizeReportSchemaContent,
  prepareReportSchemaForSave,
} = require('./contract');
const { buildReportWorkbenchUrl } = require('./url');

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
      warn(`读取图表定义文件失败: ${e.message}`);
      throw new CliError(`读取图表定义文件失败: ${e.message}`, {
        code: 'APPEND_CHART_CONFIG_READ_FAILED',
        details: { file: chartsJsonOrFile },
      });
    }
  } else {
    try {
      charts = JSON.parse(chartsJsonOrFile);
    } catch (e) {
      warn(`图表定义解析失败: ${e.message}`);
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

function findRootContent(schema) {
  const page = schema && Array.isArray(schema.pages) ? schema.pages[0] : null;
  const tree = page && Array.isArray(page.componentsTree) ? page.componentsTree[0] : null;
  const rootContent = tree && Array.isArray(tree.children)
    ? tree.children.find(child => child.componentName === 'RootContent')
    : null;
  if (!page || !rootContent || !rootContent.props || !Array.isArray(rootContent.props.layout) || !Array.isArray(rootContent.children)) {
    throw new CliError('报表 Schema 结构异常：找不到可变更的 RootContent 节点', {
      code: 'APPEND_CHART_SCHEMA_INVALID',
    });
  }
  if (!Array.isArray(page.componentsMap)) {page.componentsMap = [];}
  return { page, rootContent };
}

function createOwnedAppendMutation(charts, cubeTenantId) {
  const builtCharts = charts.map(chart => buildChartNode(chart, cubeTenantId));
  return {
    owned: true,
    nodes: builtCharts.map(built => built.node),
    layouts: builtCharts.map(built => ({ i: built.fieldId, w: built.w, h: built.h })),
    components: [...new Set(builtCharts.map(built => built.componentName))],
  };
}

function summarizeOwnedMutation(mutation) {
  return {
    owned: true,
    fieldIds: mutation.layouts.map(layout => layout.i),
    nodeIds: mutation.nodes.map(node => node.id),
    componentNames: [...mutation.components],
  };
}

function applyOwnedAppendMutation(schema, mutation) {
  const { page, rootContent } = findRootContent(schema);
  const existingNodeIds = new Set(rootContent.children.map(node => node && node.id).filter(Boolean));
  const existingLayoutIds = new Set(rootContent.props.layout.map(layout => layout && layout.i).filter(Boolean));
  if (mutation.nodes.some(node => existingNodeIds.has(node.id))
    || mutation.layouts.some(layout => existingLayoutIds.has(layout.i))) {
    throw new CliError('owned append mutation is already present in the latest report revision', {
      code: 'APPEND_CHART_OWNERSHIP_COLLISION',
      details: { ownedMutation: summarizeOwnedMutation(mutation) },
    });
  }
  const packed = packReportLayout(mutation.layouts, { existingLayout: rootContent.props.layout });
  for (const componentName of mutation.components) {
    if (!page.componentsMap.some(entry => entry.componentName === componentName)) {
      page.componentsMap.push(buildReportComponentMapEntry(componentName));
    }
  }
  rootContent.children.push(...mutation.nodes);
  rootContent.props.layout.push(...packed);
  return schema;
}

// ── 主流程 ────────────────────────────────────────────

async function main(args) {
  const { appType, reportId, chartsJsonOrFile, browserOpenMode } = parseArgs(args);

  const SEP = '='.repeat(50);
  warn(SEP);
  warn('🔧 宜搭报表追加图表工具');
  warn(SEP);
  warn(`应用 ID: ${appType}`);
  warn(`报表 ID: ${reportId}`);
  warn(`图表定义: ${chartsJsonOrFile}`);

  // Step 1: 读取登录态
  warn('\n[Step 1] 读取登录态...');
  const authRef = ensureSession();
  const corpId = authRef.corpId || (authRef.authData && authRef.authData.corp_id) || '';
  warn(`登录态就绪，域名: ${authRef.baseUrl}`);

  // Step 2: 读取图表定义
  warn('\n[Step 2] 读取图表定义...');
  const charts = readChartsDefinition(chartsJsonOrFile);
  warn(`追加图表数量: ${charts.length}`);
  const validation = validateReportConfig(charts, []);
  charts.forEach((chart, i) => {
    const capability = getReportChartCapability(chart.type);
    const componentName = capability ? capability.componentName : '不支持';
    warn(`  ${i + 1}. [${chart.type}] ${chart.title || componentName}`);
    validateChartConfig(chart, i);
  });
  if (!validation.ok) {
    warn('\n❌ 图表配置存在错误，请修正后重试。');
    warn('提示：使用 openyida get-schema <appType> <formUuid> 获取表单字段信息。');
    throw new CliError('图表配置存在错误，请修正后重试。', {
      code: 'APPEND_CHART_CONFIG_INVALID',
      details: { issues: validation.issues },
    });
  }

  // Step 3: 获取已有报表 Schema
  warn('\n[Step 3] 获取已有报表 Schema...');
  const getResult = await getReportSchema(authRef, appType, reportId);

  if (!getResult || getResult.success === false) {
    const errorMsg = getResult ? getResult.errorMsg || '未知错误' : '请求失败';
    warn(`获取报表 Schema 失败: ${errorMsg}`);
    throw new CliError(errorMsg, {
      code: 'APPEND_CHART_GET_SCHEMA_FAILED',
      details: getResult || { success: false, errorMsg },
    });
  }

  let serverRevision = requireSchemaServerRevision(getResult);
  const mutation = createOwnedAppendMutation(charts, corpId);
  const ownedMutation = summarizeOwnedMutation(mutation);
  let schema = normalizeReportSchemaContent(getResult);
  applyOwnedAppendMutation(schema, mutation);

  warn('\n[Step 4] 构建并追加 owned mutation...');
  let expectedSchema = prepareReportSchemaForSave(schema, { serverRevision });
  let saveResult = await saveReportSchema(authRef, appType, reportId, expectedSchema, serverRevision);
  let recovery = {
    attempted: false,
    reason: 'not_needed',
    ownedMutationReapplied: false,
    latestRevision: serverRevision,
  };

  if (isSaveFormSchemaRevisionConflict(saveResult)) {
    const latestResult = await getReportSchema(authRef, appType, reportId);
    if (!latestResult || latestResult.success === false) {
      throw new CliError(latestResult && latestResult.errorMsg ? latestResult.errorMsg : '读取最新报表 revision 失败', {
        code: 'APPEND_CHART_RECOVERY_READ_FAILED',
        details: { ownedMutation, recovery: { attempted: true, reason: 'revision_conflict', ownedMutationReapplied: false } },
      });
    }
    serverRevision = requireSchemaServerRevision(latestResult);
    schema = normalizeReportSchemaContent(latestResult);
    applyOwnedAppendMutation(schema, mutation);
    expectedSchema = prepareReportSchemaForSave(schema, { serverRevision });
    saveResult = await saveReportSchema(authRef, appType, reportId, expectedSchema, serverRevision);
    recovery = {
      attempted: true,
      reason: 'revision_conflict',
      ownedMutationReapplied: true,
      latestRevision: serverRevision,
    };
  }

  if (!saveResult || !saveResult.success) {
    const errorMsg = saveResult ? saveResult.errorMsg || '未知错误' : '请求失败';
    warn(`保存 Schema 失败: ${errorMsg}`);
    throw new CliError(errorMsg, {
      code: 'APPEND_CHART_SAVE_FAILED',
      details: {
        ...(saveResult && typeof saveResult === 'object' ? saveResult : { success: false, reportId, errorMsg }),
        ownedMutation,
        recovery: recovery.attempted
          ? recovery
          : { attempted: false, reason: 'save_state_not_proven_safe_to_replay', ownedMutationReapplied: false, latestRevision: serverRevision },
      },
    });
  }

  const readbackResult = await getReportSchema(authRef, appType, reportId);
  if (!readbackResult || readbackResult.success === false) {
    const errorMsg = readbackResult ? readbackResult.errorMsg || '未知错误' : '请求失败';
    throw new CliError(errorMsg, {
      code: 'APPEND_CHART_READBACK_FAILED',
      details: {
        ...(readbackResult && typeof readbackResult === 'object' ? readbackResult : { success: false, reportId, errorMsg }),
        ownedMutation,
        recovery: {
          ...recovery,
          readbackState: 'unknown',
          replayAttempted: false,
        },
      },
    });
  }
  let verification;
  try {
    verification = assertReportSchemaReadback(expectedSchema, normalizeReportSchemaContent(readbackResult));
  } catch (error) {
    throw new CliError(error.message, {
      code: error.code || 'REPORT_SCHEMA_READBACK_MISMATCH',
      details: {
        ...(error.details || {}),
        ownedMutation,
        recovery,
        retryable: false,
        retrySafe: false,
        sideEffectState: 'partial',
        readbackAllowed: true,
        recommendedRecovery: 'inspect_then_stop',
        nextAction: {
          type: 'report.inspect',
          commandId: 'report.inspect',
          args: { appType, reportId },
        },
      },
    });
  }
  const verifiedRevision = requireSchemaServerRevision(readbackResult);

  const reportUrl = buildReportWorkbenchUrl(authRef.baseUrl, appType, reportId);
  warn('\n' + SEP);
  warn('✅ 图表追加成功！');
  warn(`报表 ID: ${reportId}`);
  warn(`追加图表数: ${charts.length}`);
  warn(`访问链接: ${reportUrl}`);
  warn(SEP);

  const result = withBrowserHandoff(
    {
      success: true,
      reportId,
      appType,
      appendedChartCount: charts.length,
      readbackVerified: true,
      verificationLevel: verification.verificationLevel,
      omitted: verification.omitted,
      revision: verifiedRevision,
      recovery,
      url: reportUrl,
      workbenchUrl: reportUrl,
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
    warn(`执行异常: ${err.message}`);
    process.exitCode = err && err.exitCode ? err.exitCode : 1;
  });
}

module.exports = {
  run: main,
  parseArgs,
  readChartsDefinition,
  createOwnedAppendMutation,
  applyOwnedAppendMutation,
  getReportSchema,
  saveSchema: saveReportSchema,
};
