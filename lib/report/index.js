'use strict';

const fs = require('fs');
const { t } = require('../core/i18n');

const { CliError } = require('../core/cli-error');
const { createAuthRef, isAuthRefReady } = require('../core/yida-client');

const { getReportChartCapability } = require('./capability-registry');
const {
  buildReportSchema,
  buildSelectFilter,
  buildFilterContainer,
  injectFilterLinkage,
  validateChartConfig,
} = require('./chart-builder');
const { genFieldId } = require('./constants');
const { getFormSchema } = require('../integration/integration-api');
const { normalizeCubeCode, normalizeFieldCode } = require('./field-utils');
const {
  resolveFilterTargetIndexes,
  validateReportConfig,
} = require('./validation');

const { warn } = require('../core/chalk');
const { createBlankReport, getReportSchema, saveReportSchema } = require('./http');
const { requireSchemaServerRevision } = require('../core/server-revision');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const {
  assertReportSchemaReadback,
  normalizeReportSchemaContent,
  prepareReportSchemaForSave,
} = require('./contract');
const { probeReportSchema, repairMetadataFieldCodes } = require('./runtime-probe');
const { buildReportWorkbenchUrl } = require('./url');

// ── 参数解析 ──────────────────────────────────────────

function parseArgs(cliArgs) {
  const openOption = parseOpenOption(cliArgs || process.argv.slice(3));
  const argv = openOption.args;
  if (argv.length < 3) {
    warn(
      '用法: openyida create-report <appType> "<报表名称>" <图表定义JSON或文件路径>',
    );
    warn(
      '示例: openyida create-report APP_XXX "销售报表" charts.json',
    );
    throw new CliError('用法: openyida create-report <appType> "<报表名称>" <图表定义JSON或文件路径>', {
      code: 'CREATE_REPORT_INVALID_ARGUMENTS',
    });
  }
  const [appType, reportTitle, chartsJsonOrFile] = argv;
  return { appType, reportTitle, chartsJsonOrFile, browserOpenMode: openOption.mode };
}

// ── 筛选器简化配置兼容处理 ─────────────────────────────

/**
 * 将简化格式的筛选器配置转为 buildSelectFilter 期望的完整格式。
 *
 * 简化格式（只有顶层 fieldCode/label/dataType）：
 *   { "type": "select", "label": "行业", "cubeCode": "FORM_XXX", "fieldCode": "selectField_xxx", "dataType": "STRING" }
 *
 * 完整格式（带 valueField/labelField 对象）：
 *   { "title": "行业", "cubeCode": "FORM_XXX", "valueField": { "fieldCode": "selectField_xxx", "aliasName": "行业", "dataType": "STRING" }, ... }
 *
 * 如果已经是完整格式（有 valueField），则原样返回。
 */
function normalizeFilterDef(filterDef) {
  if (filterDef.valueField) {
    return filterDef;
  }
  if (!filterDef.fieldCode) {
    return filterDef;
  }
  const fieldCode = filterDef.fieldCode;
  const aliasName = filterDef.label || filterDef.title || '筛选器';
  const dataType = filterDef.dataType || 'STRING';
  const fieldObj = { fieldCode, aliasName, dataType };

  return {
    ...filterDef,
    title: filterDef.label || filterDef.title || '筛选器',
    valueField: fieldObj,
    labelField: fieldObj,
    filterFieldCode: fieldCode,
  };
}

/**
 * 从图表配置中自动提取 selectField 类型字段，生成筛选器配置。
 * 当用户未显式配置 filters 时自动调用，为所有 selectField 生成下拉筛选器。
 *
 * @param {Array} charts 图表配置数组
 * @returns {Array} 自动生成的筛选器配置数组（已经过 normalizeFilterDef 处理）
 */
function autoGenerateFilters(charts) {
  const selectFieldMap = new Map();

  for (const [chartIndex, chart] of charts.entries()) {
    const cubeCode = chart.cubeCode || '';
    const fieldsToScan = [];

    if (chart.xField) {
      fieldsToScan.push(chart.xField);
    }
    if (Array.isArray(chart.yField)) {
      fieldsToScan.push(...chart.yField);
    } else if (chart.yField) {
      fieldsToScan.push(chart.yField);
    }
    if (Array.isArray(chart.columnFields)) {
      fieldsToScan.push(...chart.columnFields);
    }
    if (chart.kpiField) {
      fieldsToScan.push(chart.kpiField);
    }

    for (const field of fieldsToScan) {
      const fieldCode = typeof field === 'string' ? field : (field && field.fieldCode);
      if (!fieldCode) { continue; }

      const SELECT_PREFIXES = ['selectField_', 'radioField_', 'checkboxField_', 'multiSelectField_'];
      const isSelectLike = SELECT_PREFIXES.some((prefix) => fieldCode.startsWith(prefix));
      if (!isSelectLike) { continue; }

      const baseFieldCode = fieldCode.endsWith('_value') ? fieldCode.slice(0, -6) : fieldCode;
      const mapKey = `${cubeCode.replace(/-/g, '_')}\u0000${baseFieldCode}`;
      if (selectFieldMap.has(mapKey)) {
        const existing = selectFieldMap.get(mapKey);
        if (!existing.linkTo.includes(chartIndex)) {existing.linkTo.push(chartIndex);}
        continue;
      }

      const aliasName = (typeof field === 'object' && (field.aliasName || field.alias)) || baseFieldCode;
      selectFieldMap.set(mapKey, {
        type: 'select',
        label: aliasName,
        cubeCode: cubeCode,
        fieldCode: baseFieldCode,
        dataType: (typeof field === 'object' && field.dataType) || 'STRING',
        linkTo: [chartIndex],
      });
    }
  }

  return Array.from(selectFieldMap.values()).map(normalizeFilterDef);
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
      raw = JSON.parse(fs.readFileSync(chartsJsonOrFile, 'utf-8'));
    } catch (e) {
      warn('读取配置文件失败:', e.message);
      throw new CliError(`读取配置文件失败: ${e.message}`, {
        code: 'CREATE_REPORT_CONFIG_READ_FAILED',
        details: { file: chartsJsonOrFile },
      });
    }
  } else {
    try {
      raw = JSON.parse(chartsJsonOrFile);
    } catch (e) {
      warn(
        '配置解析失败（既不是有效文件路径，也不是有效 JSON）:',
        e.message,
      );
      throw new CliError(`配置解析失败（既不是有效文件路径，也不是有效 JSON）: ${e.message}`, {
        code: 'CREATE_REPORT_CONFIG_PARSE_FAILED',
        details: { input: chartsJsonOrFile },
      });
    }
  }

  // 格式1：纯数组
  if (Array.isArray(raw)) {
    return { charts: raw, filters: autoGenerateFilters(raw) };
  }

  // 格式2：对象，含 charts 和可选 filters
  if (raw && Array.isArray(raw.charts)) {
    const explicitFilters = Array.isArray(raw.filters) ? raw.filters.map(normalizeFilterDef) : [];
    const filters = explicitFilters.length > 0 ? explicitFilters : autoGenerateFilters(raw.charts);
    return {
      charts: raw.charts,
      filters,
    };
  }

  warn('配置格式错误：必须是图表数组或包含 charts 字段的对象');
  throw new CliError('配置格式错误：必须是图表数组或包含 charts 字段的对象', {
    code: 'CREATE_REPORT_CONFIG_INVALID',
  });
}

function ensureSession() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError('未获取到有效宜搭登录态，请先执行 openyida login', {
      code: 'NEED_LOGIN',
    });
  }
  return authRef;
}

function cubeCodeToFormUuid(cubeCode) {
  return String(cubeCode || '').replace(/^FORM_/, 'FORM-');
}

function collectConfiguredFieldCodes(charts, filters) {
  const result = new Map();
  function add(cubeCode, field) {
    const fieldCode = typeof field === 'string' ? field : field && field.fieldCode;
    if (!cubeCode || !fieldCode) { return; }
    if (fieldCode === 'pid'
      && field && typeof field === 'object'
      && String(field.aggregateType || '').toUpperCase() === 'COUNT') {
      return;
    }
    const key = normalizeCubeCode(cubeCode);
    if (!result.has(key)) { result.set(key, new Set()); }
    result.get(key).add(normalizeFieldCode(fieldCode));
  }
  for (const chart of charts) {
    const capability = getReportChartCapability(chart.type);
    for (const key of capability ? capability.fieldKeys : []) {
      const fields = Array.isArray(chart[key]) ? chart[key] : [chart[key]];
      fields.filter(Boolean).forEach((field) => add(chart.cubeCode, field));
    }
  }
  for (const filter of filters) {
    add(filter.cubeCode, filter.valueField);
    add(filter.cubeCode, filter.labelField);
  }
  return result;
}

async function preflightReportSourceFields(authRef, appType, charts, filters) {
  const configured = collectConfiguredFieldCodes(charts, filters);
  for (const [cubeCode, fieldCodes] of configured.entries()) {
    const formUuid = cubeCodeToFormUuid(cubeCode);
    let schema;
    try {
      schema = await getFormSchema(authRef, { appType, formUuid });
    } catch (error) {
      throw new CliError(t('report_runtime.source_schema_unverified', formUuid, error.message), {
        code: 'CREATE_REPORT_SOURCE_SCHEMA_UNVERIFIED',
        details: { formUuid, remoteWrites: 0 },
      });
    }
    const available = new Set();
    for (const component of schema) {
      const fieldId = component && component.props && component.props.fieldId;
      if (!fieldId) { continue; }
      available.add(fieldId);
      available.add(normalizeFieldCode(fieldId));
    }
    const missing = Array.from(fieldCodes).filter((fieldCode) => !available.has(fieldCode));
    if (missing.length > 0) {
      throw new CliError(t('report_runtime.source_field_missing', formUuid, missing.join(', ')), {
        code: 'CREATE_REPORT_SOURCE_FIELD_NOT_FOUND',
        details: { formUuid, missingFields: missing, remoteWrites: 0 },
      });
    }
  }
}

// ── 主流程 ────────────────────────────────────────────

async function main(args) {
  const { appType, reportTitle, chartsJsonOrFile, browserOpenMode } = parseArgs(args);
  let partialResidual = null;

  try {

    const SEP = '='.repeat(50);
    warn(SEP);
    warn('🚀 宜搭报表创建工具');
    warn(SEP);
    warn(`应用 ID: ${appType}`);
    warn(`报表名称: ${reportTitle}`);
    warn(t(
      'report_runtime.config_source',
      fs.existsSync(chartsJsonOrFile)
        ? t('report_runtime.config_source_file')
        : t('report_runtime.config_source_inline_redacted'),
    ));

    // Step 1: 读取登录态
    warn('\n[Step 1] 读取登录态...');
    const authRef = ensureSession();
    warn(`登录态就绪，域名: ${authRef.baseUrl}`);

    const corpId = authRef.corpId || (authRef.authData && authRef.authData.corp_id) || '';
    warn(`组织上下文: ${corpId ? '已确认（敏感标识已隐藏）' : '未获取到，图表数据源需手动配置'}`);

    // Step 2: 读取图表定义和筛选器配置
    warn('\n[Step 2] 读取图表定义...');
    const { charts, filters } = readReportConfig(chartsJsonOrFile);
    warn(`图表数量: ${charts.length}`);
    warn(`筛选器数量: ${filters.length}`);

    // 预校验所有图表配置
    const validation = validateReportConfig(charts, filters);
    charts.forEach((chart, i) => {
      const capability = getReportChartCapability(chart.type);
      const componentName = capability ? capability.componentName : '不支持';
      warn(
        `  ${i + 1}. [${chart.type}] ${chart.title || componentName} (cubeCode: ${chart.cubeCode || '未配置'})`,
      );
      validateChartConfig(chart, i);
    });
    if (!validation.ok) {
      warn('\n❌ 图表配置存在错误，请修正后重试。');
      warn('提示：使用 openyida get-schema <appType> <formUuid> 获取表单字段信息。');
      throw new CliError('图表配置存在错误，请修正后重试。', {
        code: 'CREATE_REPORT_CHART_CONFIG_INVALID',
        details: { issues: validation.issues },
      });
    }
    if (filters.length > 0) {
      filters.forEach((f, i) => {
        warn(
          `  筛选器${i + 1}. ${f.title || '筛选器'} (fieldCode: ${(f.valueField && f.valueField.fieldCode) || '未配置'})`,
        );
      });
    }

    warn(t('report_runtime.source_preflight_start'));
    await preflightReportSourceFields(authRef, appType, charts, filters);
    warn(t('report_runtime.source_preflight_ok'));

    // Step 3: 创建空白报表
    warn('\n[Step 3] 创建空白报表...');
    const createResult = await createBlankReport(authRef, appType, reportTitle);

    if (!createResult || !createResult.success || !createResult.content) {
      const errorMsg = createResult
        ? createResult.errorMsg || '未知错误'
        : '请求失败';
      warn(`创建报表失败: ${errorMsg}`);
      throw new CliError(errorMsg, {
        code: 'CREATE_REPORT_CREATE_FAILED',
        details: createResult || { success: false, errorMsg },
      });
    }

    const reportId = createResult.content.formUuid || createResult.content;
    if ((typeof reportId !== 'string' && typeof reportId !== 'number') || String(reportId).length === 0) {
      partialResidual = {
        type: 'report',
        appType,
        reportId: null,
        owned: 'unknown',
        ownershipStatus: 'identity_unknown',
        provenance: {
          operation: 'create-report',
          source: 'create_response',
          identityConfirmed: false,
        },
        state: 'identity_unknown',
        deleteAttempted: false,
      };
      throw new CliError('报表创建响应缺少可回读的资源标识', {
        code: 'CREATE_REPORT_IDENTITY_MISSING',
      });
    }
    const reportUrl = buildReportWorkbenchUrl(authRef.baseUrl, appType, reportId);
    partialResidual = {
      type: 'report',
      appType,
      reportId: String(reportId),
      url: reportUrl,
      workbenchUrl: reportUrl,
      owned: true,
      ownershipStatus: 'owned_created_by_current_invocation',
      provenance: {
        operation: 'create-report',
        source: 'create_response',
        identityConfirmed: true,
      },
      state: 'created_partial',
      deleteAttempted: false,
    };
    warn(`报表创建成功，ID: ${reportId}`);

    const shellResult = await getReportSchema(authRef, appType, reportId);
    if (!shellResult || shellResult.success === false) {
      const errorMsg = shellResult ? shellResult.errorMsg || '未知错误' : '请求失败';
      throw new CliError(errorMsg, { code: 'CREATE_REPORT_GET_SCHEMA_FAILED' });
    }
    const serverRevision = requireSchemaServerRevision(shellResult);

    // Step 4: 构建报表 Schema
    warn('\n[Step 4] 构建报表 Schema...');
    const schema = buildReportSchema(reportTitle, charts, reportId, corpId);
    schema.id = reportId;

    // Step 4.1: 注入筛选器（如果有）
    if (filters.length > 0) {
      warn('[Step 4.1] 注入筛选器...');

      const page = schema.pages[0];
      const componentsTree = page.componentsTree[0];

      // 找到 PageHeaderContent 节点（筛选器容器放在这里）
      const rootHeader = componentsTree.children.find(
        (c) => c.componentName === 'RootHeader',
      );
      const pageHeader = rootHeader
        && rootHeader.children
        && rootHeader.children.find((c) => c.componentName === 'YoushuPageHeader');
      const pageHeaderContent = pageHeader
        && pageHeader.children
        && pageHeader.children.find((c) => c.componentName === 'PageHeaderContent');

      if (pageHeaderContent) {
        // 确保 componentsMap 中有筛选器相关组件
        const filterComponents = [
          'YoushuSelectFilter',
          'YoushuTopFilterContainer',
        ];
        filterComponents.forEach((compName) => {
          if (!page.componentsMap.some((c) => c.componentName === compName)) {
            page.componentsMap.push({
              package: '@/components/vc-yida-report',
              version: '1.0.6',
              componentName: compName,
            });
          }
        });

        // 构建筛选器组件列表
        const builtFilters = filters.map((filterDef) => {
          const valueFieldDef = filterDef.valueField || {
            fieldCode: filterDef.filterFieldCode || filterDef.fieldCode || '',
            aliasName: filterDef.title || filterDef.label || '筛选器',
            dataType: filterDef.dataType || 'STRING',
          };
          const labelFieldDef = filterDef.labelField || valueFieldDef;

          // buildSelectFilter 内部自己构建 dataSetModelMap，无需从外部传入
          // 优先用 valueFieldDef.aliasName 作为筛选器标题（比 filterDef.title 更准确）
          const filterTitle = valueFieldDef.aliasName || filterDef.title || filterDef.label || '筛选器';
          return buildSelectFilter(
            { ...filterDef, cubeTenantId: filterDef.cubeTenantId || corpId, title: filterTitle },
            valueFieldDef,
            labelFieldDef,
            null,
            filterDef.cubeTenantId || corpId,
          );
        });

        // 构建筛选器容器并注入到 PageHeaderContent
        const containerFieldId = genFieldId('filter');
        const filterContainer = buildFilterContainer(
          builtFilters,
          containerFieldId,
        );
        if (!pageHeaderContent.children) {pageHeaderContent.children = [];}
        pageHeaderContent.children.push(filterContainer);

        // 对每个筛选器，根据 linkTo 配置注入联动到对应图表
        const rootContent = componentsTree.children.find(
          (c) => c.componentName === 'RootContent',
        );
        builtFilters.forEach((builtFilter, fi) => {
          const filterDef = filters[fi];
          const filterMeta = builtFilter.__filterMeta__;
          const targetIndexes = resolveFilterTargetIndexes(filterDef, charts);

          targetIndexes.forEach((chartIndex) => {
            const chart = charts[chartIndex];
            const chartNode = rootContent
              && rootContent.children
              && rootContent.children[chartIndex];
            if (
              !chartNode ||
              !chartNode.props ||
              !chartNode.props.dataSetModelMap
            ) {return;}

            const filterFieldCode = filterDef.filterFieldCode
              || (filterDef.valueField && filterDef.valueField.fieldCode)
              || '';
            const cubeCode = chart.cubeCode || filterDef.cubeCode || '';

            chartNode.props.dataSetModelMap = injectFilterLinkage(
              chartNode.props.dataSetModelMap,
              filterMeta,
              filterFieldCode,
              cubeCode,
              corpId,
            );
            warn(
              `  筛选器${fi + 1} 已联动到图表${chartIndex + 1}: ${chart.title || chart.type}`,
            );
          });
        });

        warn(`筛选器注入完成，数量: ${builtFilters.length}`);
      } else {
        throw new CliError('报表 Schema 结构异常：找不到 PageHeaderContent 节点', {
          code: 'CREATE_REPORT_SCHEMA_INVALID',
        });
      }
    }

    warn(`Schema 构建完成，图表数: ${charts.length}`);

    // Step 5: 保存报表 Schema
    warn('\n[Step 5] 保存报表 Schema...');
    let expectedSchema = prepareReportSchemaForSave(schema, { serverRevision });
    const saveResult = await saveReportSchema(authRef, appType, reportId, expectedSchema, serverRevision);

    if (!saveResult || !saveResult.success) {
      const errorMsg = saveResult
        ? saveResult.errorMsg || '未知错误'
        : '请求失败';
      warn(`保存 Schema 失败: ${errorMsg}`);
      warn(`报表已创建（ID: ${reportId}），但 Schema 保存失败，请检查该残留资源，不要再次创建`);
      throw new CliError(errorMsg, {
        code: 'CREATE_REPORT_SAVE_FAILED',
        details: saveResult || { success: false, reportId, errorMsg },
      });
    }

    const readbackResult = await getReportSchema(authRef, appType, reportId);
    if (!readbackResult || readbackResult.success === false) {
      const errorMsg = readbackResult ? readbackResult.errorMsg || '未知错误' : '请求失败';
      throw new CliError(errorMsg, {
        code: 'CREATE_REPORT_READBACK_FAILED',
        details: readbackResult || { success: false, reportId, errorMsg },
      });
    }
    let verifiedSchema = normalizeReportSchemaContent(readbackResult);
    let verification = assertReportSchemaReadback(expectedSchema, verifiedSchema);
    let verifiedRevision = requireSchemaServerRevision(readbackResult);
    let runtimeProbe = await probeReportSchema(authRef, appType, reportId, verifiedSchema);
    let runtimeRepair = { attempted: false, changed: 0, replacements: [] };

    if (!runtimeProbe.runtimeQueryVerified) {
      const repair = repairMetadataFieldCodes(verifiedSchema, runtimeProbe.probes);
      if (repair.changed > 0) {
        runtimeRepair = {
          attempted: true,
          changed: repair.changed,
          replacements: repair.replacements,
        };
        warn(`运行时字段元数据不匹配，正在原报表内修复 ${repair.changed} 处绑定...`);
        expectedSchema = prepareReportSchemaForSave(repair.schema, { serverRevision: verifiedRevision });
        const repairSaveResult = await saveReportSchema(
          authRef,
          appType,
          reportId,
          expectedSchema,
          verifiedRevision
        );
        if (!repairSaveResult || repairSaveResult.success === false) {
          throw new CliError(
            repairSaveResult && repairSaveResult.errorMsg
              ? repairSaveResult.errorMsg
              : '报表运行时字段修复保存失败',
            {
              code: 'REPORT_RUNTIME_REPAIR_SAVE_FAILED',
              details: { runtimeRepair, repairSaveResult },
            }
          );
        }
        const repairReadback = await getReportSchema(authRef, appType, reportId);
        if (!repairReadback || repairReadback.success === false) {
          throw new CliError(
            repairReadback && repairReadback.errorMsg
              ? repairReadback.errorMsg
              : '报表运行时字段修复回读失败',
            {
              code: 'REPORT_RUNTIME_REPAIR_READBACK_FAILED',
              details: { runtimeRepair, repairReadback },
            }
          );
        }
        verifiedSchema = normalizeReportSchemaContent(repairReadback);
        verification = assertReportSchemaReadback(expectedSchema, verifiedSchema);
        verifiedRevision = requireSchemaServerRevision(repairReadback);
        runtimeProbe = await probeReportSchema(authRef, appType, reportId, verifiedSchema);
      }
    }

    if (!runtimeProbe.runtimeQueryVerified) {
      throw new CliError('报表 Schema 已保存，但至少一个图表无法查询真实数据', {
        code: 'REPORT_RUNTIME_QUERY_FAILED',
        details: {
          runtimeQueryVerified: false,
          failedCharts: runtimeProbe.probes
            .filter(probe => !probe.success)
            .map(probe => ({
              cid: probe.cid,
              className: probe.className,
              dataSetKey: probe.dataSetKey,
              fields: probe.fields,
              errorCode: probe.errorCode,
              errorMsg: probe.errorMsg,
            })),
          runtimeRepair,
        },
      });
    }

    warn('Schema 保存及图表运行时查询验证成功！');

    warn('\n' + SEP);
    warn('✅ 报表创建成功！');
    warn(`报表 ID: ${reportId}`);
    warn(`报表名称: ${reportTitle}`);
    warn(`图表数量: ${charts.length}`);
    warn(`访问链接: ${reportUrl}`);
    warn(SEP);

    const result = withBrowserHandoff(
      {
        success: true,
        reportId: reportId,
        reportTitle: reportTitle,
        appType: appType,
        chartCount: charts.length,
        readbackVerified: true,
        runtimeQueryVerified: true,
        queryProbes: runtimeProbe.probes.map(probe => ({
          cid: probe.cid,
          className: probe.className,
          dataSetKey: probe.dataSetKey,
          fields: probe.fields,
          status: probe.status,
          success: probe.success,
        })),
        runtimeRepair,
        verificationLevel: verification.verificationLevel,
        omitted: verification.omitted,
        revision: verifiedRevision,
        url: reportUrl,
        workbenchUrl: reportUrl,
      },
      reportUrl,
      { stage: 'create_report_success', title: reportTitle },
      browserOpenMode
    );
    console.log(JSON.stringify(result));
    return result;
  } catch (error) {
    if (!partialResidual) {throw error;}
    const details = error && error.details && typeof error.details === 'object' && !Array.isArray(error.details)
      ? { ...error.details }
      : {};
    details.partial = true;
    details.residual = partialResidual;
    if (partialResidual.url) {
      details.url = partialResidual.url;
      details.workbenchUrl = partialResidual.workbenchUrl;
    }
    details.completedStages = ['create_report_shell'];
    details.retryable = false;
    details.retrySafe = false;
    details.sideEffectState = 'partial';
    details.readbackAllowed = true;
    details.recommendedRecovery = 'inspect_then_stop';
    details.nextAction = partialResidual.reportId
      ? {
        type: 'report.inspect',
        commandId: 'report.inspect',
        args: { appType, reportId: partialResidual.reportId },
      }
      : {
        type: 'stop_and_confirm_residual',
        commandId: 'report.inspect',
        args: { appType },
      };
    details.nextStep = partialResidual.reportId
      ? `node bin/yida.js report inspect ${appType} ${partialResidual.reportId} --json`
      : '保留创建响应并通过应用导航只读确认是否存在未识别的报表残留';
    if (error && error.isCliError) {
      error.details = details;
      throw error;
    }
    throw new CliError(error && error.message ? error.message : '报表创建后处理失败', {
      code: error && error.code ? error.code : 'CREATE_REPORT_PARTIAL_FAILED',
      details,
    });
  }
}

// 当直接执行时（node lib/report/index.js）自动运行
if (require.main === module) {
  main().catch((err) => {
    warn(`执行异常: ${err.message}`);
    process.exitCode = err && err.exitCode ? err.exitCode : 1;
  });
}

module.exports = {
  run: main,
  parseArgs,
  readReportConfig,
  normalizeFilterDef,
  autoGenerateFilters,
  collectConfiguredFieldCodes,
  preflightReportSourceFields,
};
