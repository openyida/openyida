'use strict';

/**
 * corp-efficiency.js - 平台管理 / 企业效能
 *
 * 对应页面：https://www.aliwork.com/platformManage/corpEfficiency
 *
 * 用法：
 *   openyida corp-efficiency [overview] [--locale zh_CN|en_US] [--raw]
 *   openyida corp-efficiency details [--locale zh_CN|en_US]
 *   openyida corp-efficiency detail --title <指标名>|--key <key>|--index <序号> [--open|--no-open]
 *   openyida corp-efficiency groups [--query <关键词>] [--page 1] [--size 20] [--raw]
 *   openyida corp-efficiency notify --cid <群ID> --type <noticeStudy|noticeCertify|completeStudy> --yes
 */

const querystring = require('querystring');

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  extractInfoFromCookies,
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { c, success, listItem } = require('../core/chalk');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');

const API = {
  corpInfoManageCard: '/query/corpadmin/getCorpInfoManageCard.json',
  workbenchContent: '/query/workPlatform/getWorkbenchContent.json',
  commodityInfo: '/query/commodity/getCommodityInfo.json',
  dingGroupSearch: '/query/dinggroup/searchGroup.json',
  sendCardOfTutorial: '/query/card/sendCardOfTutorial.json',
};

const NOTIFY_TYPES = new Set(['noticeStudy', 'noticeCertify', 'completeStudy']);
const DETAIL_DOC_URL = 'https://docs.aliwork.com/docs/yida_support/ifpp7g/wow0da';
const DETAIL_CONSULT_URL = 'https://www.aliwork.com/hybrid_home';
const LOWCODE_CERTIFICATION_REPORT = {
  appType: 'APP_VTT6NHGPQHR6HW9UUF60',
  reportId: 'REPORT-QQ866JB164A81S0X764WJ97ATDKI33SCLP5EL3',
  topicId: '2558050',
};

function parseArgs(args = []) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('-')) {
      positional.push(arg);
      continue;
    }

    if (arg === '--yes' || arg === '--confirm' || arg === '--raw' || arg === '--json' || arg === '--help' || arg === '-h') {
      flags[arg.replace(/^-+/, '')] = true;
      continue;
    }

    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      flags[arg.slice(2)] = '';
      continue;
    }
    flags[arg.slice(2)] = next;
    i += 1;
  }

  const subCommand = positional[0] || 'overview';
  return { subCommand, flags };
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildCommonParams(auth, extra = {}) {
  return {
    _api: 'nattyFetch',
    _mock: 'false',
    _csrf_token: auth.csrfToken,
    _locale_time_zone_offset: String(-new Date().getTimezoneOffset() * 60 * 1000),
    _stamp: Date.now(),
    ...extra,
  };
}

async function createAuthRef() {
  let cookieData = await loadCookieData();
  if (!cookieData || !Array.isArray(cookieData.cookies) || cookieData.cookies.length === 0) {
    cookieData = await triggerLogin();
  }

  const { csrfToken, corpId, userId } = extractInfoFromCookies(cookieData.cookies || []);
  return {
    cookieData,
    baseUrl: resolveBaseUrl(cookieData),
    cookies: cookieData.cookies || [],
    csrfToken: cookieData.csrf_token || csrfToken,
    corpId: cookieData.corp_id || corpId,
    userId: cookieData.user_id || userId,
  };
}

function assertSuccess(result, action) {
  if (result && (result.__needLogin || result.__csrfExpired)) {
    throw new Error('登录态已失效，请重新登录');
  }
  if (!result || result.success === false) {
    throw new Error((result && (result.errorMsg || result.message)) || `${action}失败`);
  }
  return result.content;
}

function apiGet(authRef, requestPath, params = {}, action = '请求') {
  return requestWithAutoLogin(
    auth => httpGet(auth.baseUrl, requestPath, buildCommonParams(auth, params), auth.cookies),
    authRef
  ).then(result => assertSuccess(result, action));
}

function apiPost(authRef, requestPath, params = {}, action = '请求') {
  return requestWithAutoLogin(
    auth => httpPost(auth.baseUrl, requestPath, querystring.stringify(buildCommonParams(auth, params)), auth.cookies),
    authRef
  ).then(result => assertSuccess(result, action));
}

function parseWorkbenchContent(content, locale = 'zh_CN') {
  if (!content) {
    return {};
  }

  let parsed = content;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      return {};
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  return parsed[locale] || parsed.zh_CN || parsed.en_US || parsed;
}

function resolveDetailUrl(baseUrl, detailReportUrl) {
  if (!detailReportUrl) {
    return '';
  }
  try {
    return new URL(detailReportUrl, baseUrl).toString();
  } catch {
    return detailReportUrl;
  }
}

function buildCertificationDetailReportUrl(completeAuthNumber) {
  const data = completeAuthNumber === null || completeAuthNumber === undefined
    ? ''
    : encodeURIComponent(String(completeAuthNumber));
  const { appType, reportId, topicId } = LOWCODE_CERTIFICATION_REPORT;
  return `/${appType}/preview/${reportId}?isPreview=true&topicId=${topicId}&formUuid=${reportId}&data=${data}&navConfig.type=none&navConfig.layout=auto`;
}

function parseDetailReportInfo(detailReportUrl, baseUrl) {
  if (!detailReportUrl) {
    return null;
  }

  try {
    const url = new URL(detailReportUrl, baseUrl || 'https://www.aliwork.com');
    const pathParts = url.pathname.split('/').filter(Boolean);
    const previewIndex = pathParts.indexOf('preview');
    const appType = previewIndex > 0 ? pathParts[previewIndex - 1] : '';
    const reportId = previewIndex >= 0 ? (pathParts[previewIndex + 1] || '') : '';
    const formUuid = url.searchParams.get('formUuid') || reportId;
    const topicId = url.searchParams.get('topicId') || '';

    return {
      appType,
      reportId,
      formUuid,
      pageId: url.searchParams.get('pageId') || formUuid || reportId,
      topicId,
      prdId: url.searchParams.get('prdId') || topicId,
      isPreview: url.searchParams.get('isPreview') || '',
      data: url.searchParams.get('data'),
      standardData: url.searchParams.get('standardData'),
      navConfig: {
        type: url.searchParams.get('navConfig.type') || '',
        layout: url.searchParams.get('navConfig.layout') || '',
      },
    };
  } catch {
    return null;
  }
}

function buildReportApiInfo(report = {}) {
  const appType = report.appType || '<appType>';
  const pageId = report.pageId || report.formUuid || report.reportId || '<reportId>';
  const formUuid = report.formUuid || report.reportId || pageId;
  const prdId = report.prdId || report.topicId || '<prdId>';

  return {
    type: 'yida-native-report',
    schema: {
      method: 'GET',
      path: `/alibaba/web/${appType}/query/formdesign/getLatestFormWithNavNew.json`,
      params: {
        formUuid,
        isPreview: report.isPreview || 'true',
      },
      purpose: '明细报表页面启动时获取动态 Schema 和导航配置',
    },
    data: {
      method: 'POST',
      path: `/alibaba/web/${appType}/visual/visualizationDataRpc/getDataAsync.json`,
      query: {
        _api: 'EDataService.getDataAsync',
        _mock: 'false',
      },
      bodyTemplate: {
        pageName: 'report',
        prdId,
        pageId,
        cid: '<component id from report schema/network>',
        cname: '<component title>',
        componentClassName: '<YoushuTable|YoushuLine|YoushuBar|...>',
        queryContext: '<JSON string: filters, paging, ordering>',
        dataSetKey: '<table|youshuData|...>',
        enabledCache: 'true',
      },
      purpose: '按报表组件获取实时明细/图表数据',
    },
    cacheData: {
      method: 'POST',
      path: `/alibaba/web/${appType}/visual/visualizationDataRpc/getCacheData.json`,
      query: {
        _api: 'EDataService.getCacheData',
        _mock: 'false',
      },
      bodyTemplate: '同 getDataAsync.json',
      purpose: '读取缓存版报表组件数据',
    },
    searchData: {
      method: 'POST',
      path: `/alibaba/web/${appType}/visual/visualizationDataRpc/searchDataAsync.json`,
      query: {
        _api: 'EDataService.searchDataAsync',
        _mock: 'false',
      },
      purpose: '报表筛选器/搜索类组件查询候选值',
    },
    notes: [
      'cid、cname、componentClassName、dataSetKey 必须来自真实报表 Schema 或浏览器 Network 请求。',
      'CLI 只输出入口和接口模板，不编造组件级参数。',
      '请求时需携带当前登录 Cookie 和 CSRF 参数。',
    ],
  };
}

function createDetailTarget({
  key,
  type,
  title,
  data,
  standardData,
  percent,
  isOverReference,
  detailReportUrl,
  baseUrl,
  performanceIndex,
}) {
  const detailReportFullUrl = resolveDetailUrl(baseUrl, detailReportUrl);
  const report = parseDetailReportInfo(detailReportFullUrl || detailReportUrl, baseUrl);
  const target = {
    key,
    type,
    title: title || '',
    data,
    detailReportUrl: detailReportUrl || '',
    detailReportFullUrl,
    report,
  };

  if (performanceIndex) {
    target.performanceIndex = performanceIndex;
  }
  if (standardData !== undefined) {
    target.standardData = standardData;
  }
  if (percent !== undefined) {
    target.percent = percent;
  }
  if (isOverReference !== undefined) {
    target.isOverReference = !!isOverReference;
  }

  return target;
}

function buildPerformanceMetrics(efficacyData = {}, baseUrl) {
  if (!Array.isArray(efficacyData.efficiencyDataList)) {
    return [];
  }

  return efficacyData.efficiencyDataList.map((item, index) => createDetailTarget({
    key: `performance.${index + 1}`,
    type: 'performance',
    performanceIndex: index + 1,
    title: item.title || '',
    data: item.data,
    standardData: item.standardData,
    percent: item.percent,
    isOverReference: item.isOverReference,
    detailReportUrl: item.detailReportUrl || '',
    baseUrl,
  }));
}

function buildLearningDetailTargets(efficacyData = {}, workbenchData = {}, baseUrl) {
  return [
    createDetailTarget({
      key: 'lowcodeCertification',
      type: 'learning',
      title: workbenchData.lowcodeCertification || '低代码开发者认证人数',
      data: efficacyData.completeAuthNumber,
      detailReportUrl: buildCertificationDetailReportUrl(efficacyData.completeAuthNumber),
      baseUrl,
    }),
  ];
}

function flattenDetailTargets(details = {}) {
  return [
    ...(Array.isArray(details.learning) ? details.learning : []),
    ...(Array.isArray(details.performance) ? details.performance : []),
  ].filter(target => target && target.detailReportFullUrl).map((target, index) => ({
    targetIndex: index + 1,
    ...target,
  }));
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, '').toLowerCase();
}

function selectDetailTarget(targets, flags = {}) {
  const type = flags.type || flags.category || '';
  let candidates = targets;
  if (type) {
    candidates = candidates.filter(target => normalizeText(target.type) === normalizeText(type));
  }

  const key = flags.key || flags.id || '';
  if (key) {
    const needle = normalizeText(key);
    const match = candidates.find(target => normalizeText(target.key) === needle);
    if (match) {
      return match;
    }
    return candidates.find(target => normalizeText(target.title) === needle) || null;
  }

  const indexValue = flags.index || flags.idx || '';
  if (indexValue) {
    const index = parsePositiveInt(indexValue, 0);
    return candidates.find(target => target.targetIndex === index || target.performanceIndex === index) || null;
  }

  const title = flags.title || flags.metric || flags.name || '';
  if (title) {
    const needle = normalizeText(title);
    const exactMatches = candidates.filter(target => normalizeText(target.title) === needle);
    if (exactMatches.length === 1) {
      return exactMatches[0];
    }
    if (exactMatches.length > 1) {
      throw new Error(`明细标题「${title}」匹配到多个入口，请改用 --key 或 --index`);
    }

    const fuzzyMatches = candidates.filter(target => normalizeText(target.title).includes(needle));
    if (fuzzyMatches.length === 1) {
      return fuzzyMatches[0];
    }
    if (fuzzyMatches.length > 1) {
      const hints = fuzzyMatches.map(target => `${target.targetIndex}:${target.title}`).join('、');
      throw new Error(`明细标题「${title}」不够精确，匹配到 ${hints}`);
    }
  }

  return null;
}

function addReportApiToTarget(target) {
  return {
    ...target,
    reportApi: buildReportApiInfo(target.report || {}),
  };
}

function sanitizeCommodityInfo(commodityInfo = {}) {
  return {
    corpId: commodityInfo.corpId || '',
    corpName: commodityInfo.corpName || '',
    commodityType: commodityInfo.commodityType || '',
    commodityTag: commodityInfo.commodityTag || '',
    commodityName: commodityInfo.commodityName || '',
    expireDate: commodityInfo.expireDate || null,
    remainDays: commodityInfo.remainDays || null,
    instanceUsageAmount: commodityInfo.instanceUsageAmount || null,
    attachmentUsageAmount: commodityInfo.attachmentUsageAmount || null,
    attachmentOrderLimit: commodityInfo.attachmentOrderLimit || null,
    enableCorpStorage: commodityInfo.enableCorpStorage,
    isAuthOrg: commodityInfo.isAuthOrg,
  };
}

function formatOverview({ efficacyData = {}, workbenchData = {}, commodityInfo = {}, authRef, raw = false }) {
  const performanceMetrics = buildPerformanceMetrics(efficacyData, authRef.baseUrl);
  const learningDetails = buildLearningDetailTargets(efficacyData, workbenchData, authRef.baseUrl);

  const output = {
    sourcePage: `${authRef.baseUrl}/platformManage/corpEfficiency`,
    corpId: commodityInfo.corpId || authRef.corpId || '',
    corpName: commodityInfo.corpName || '',
    commodity: sanitizeCommodityInfo(commodityInfo),
    overview: {
      title: workbenchData.efficiencyTitle || '企业效能概览',
      description: workbenchData.efficiencyOverviewTip || '',
      isReachStandard: !!efficacyData.isReachStandard,
      saveAppDevMoney: efficacyData.saveAppDevMoney || 0,
      saveAppDevDays: efficacyData.saveAppDevDays || 0,
      saveMoneyTip: efficacyData.isReachStandard
        ? (workbenchData.saveMoneyStandardTip || '')
        : (workbenchData.saveMoneyDefaultTip || ''),
    },
    learning: {
      lowcodeStandard: workbenchData.lowcodeStandard || '低代码学习完成人数',
      lowcodeCertification: workbenchData.lowcodeCertification || '低代码开发者认证人数',
      completeLessonNumber: efficacyData.completeLessonNumber,
      completeAuthNumber: efficacyData.completeAuthNumber,
      completeStudy: !!efficacyData.completeStudy,
    },
    performance: {
      industryText: workbenchData.industryText || '',
      aboveValue: workbenchData.aboveValue || '',
      belowValue: workbenchData.belowValue || '',
      tips: Array.isArray(workbenchData.efficiencyCardTips) ? workbenchData.efficiencyCardTips : [],
      metrics: performanceMetrics,
    },
    details: {
      learning: learningDetails,
      performance: performanceMetrics,
    },
  };

  if (raw) {
    output.raw = {
      efficacyData,
      workbenchData,
      commodityInfo: sanitizeCommodityInfo(commodityInfo),
    };
  }

  return output;
}

async function fetchOverview(flags) {
  const authRef = await createAuthRef();
  const locale = flags.locale || 'zh_CN';

  const efficacyData = await apiGet(authRef, API.corpInfoManageCard, {}, '查询企业效能数据');
  const workbenchContent = await apiGet(authRef, API.workbenchContent, {}, '查询企业效能文案配置');
  const commodityInfo = await apiGet(authRef, API.commodityInfo, {}, '查询组织版本信息');
  const workbenchData = parseWorkbenchContent(workbenchContent, locale);

  return formatOverview({
    efficacyData,
    workbenchData,
    commodityInfo,
    authRef,
    raw: !!flags.raw,
  });
}

async function runOverview(flags) {
  const output = await fetchOverview(flags);

  console.log(JSON.stringify(output, null, 2));
  success(`企业效能：${c.cyan}${output.performance.metrics.length}${c.reset} 项指标，节省预算约 ${c.cyan}${output.overview.saveAppDevMoney}${c.reset} 元`);
  output.performance.metrics.forEach(metric => {
    const dataText = metric.data === null || metric.data === undefined ? '--' : metric.data;
    const standardText = metric.standardData === null || metric.standardData === undefined ? '--' : metric.standardData;
    listItem(`${metric.title}: ${dataText} / 参考值 ${standardText}`);
  });
}

async function runDetails(flags) {
  const overview = await fetchOverview(flags);
  const targets = flattenDetailTargets(overview.details).map(addReportApiToTarget);
  const output = {
    sourcePage: overview.sourcePage,
    corpId: overview.corpId,
    corpName: overview.corpName,
    totalCount: targets.length,
    details: targets,
  };

  console.log(JSON.stringify(output, null, 2));
  success(`企业效能明细入口：${c.cyan}${targets.length}${c.reset} 个`);
}

async function runDetail(flags, openMode) {
  const overview = await fetchOverview(flags);
  const targets = flattenDetailTargets(overview.details);
  const target = selectDetailTarget(targets, flags);
  if (!target) {
    const hints = targets.slice(0, 8).map(item => `${item.targetIndex}:${item.title}(${item.key})`).join('、');
    throw new Error(`请通过 --title、--key 或 --index 指定一个明细入口。可选：${hints}`);
  }

  const output = withBrowserHandoff({
    sourcePage: overview.sourcePage,
    corpId: overview.corpId,
    corpName: overview.corpName,
    detail: addReportApiToTarget(target),
    frontendBehavior: {
      buttonText: '查看明细',
      action: 'window.open(detailReportUrl)',
      permissionFallback: {
        title: '效能分析明细',
        condition: '页面判断非专属版或缺少 dataFactoryPermission 时展示咨询/升级引导',
        docUrl: DETAIL_DOC_URL,
        consultUrl: DETAIL_CONSULT_URL,
      },
    },
  }, target.detailReportFullUrl, {
    stage: 'corp_efficiency_detail',
    title: target.title,
  }, openMode);

  console.log(JSON.stringify(output, null, 2));
  success(`企业效能明细：${c.cyan}${target.title}${c.reset}`);
}

async function runGroups(flags) {
  const authRef = await createAuthRef();
  const pageIndex = parsePositiveInt(flags.page || flags.pageIndex, 1);
  const pageSize = parsePositiveInt(flags.size || flags.pageSize, 20);
  const content = await apiGet(authRef, API.dingGroupSearch, {
    query: flags.query || '',
    pageIndex,
    pageSize,
  }, '查询钉钉群');

  const values = Array.isArray(content && content.values) ? content.values : [];
  const output = {
    query: flags.query || '',
    pageIndex: content.currentPage || pageIndex,
    pageSize: content.limit || pageSize,
    totalCount: content.totalCount || 0,
    groups: values.map(group => ({
      cid: group.cid || group.value || '',
      title: group.title || group.label || '',
      memberCount: group.memberCount,
      raw: flags.raw ? group : undefined,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
  success(`共找到 ${c.cyan}${output.totalCount}${c.reset} 个钉钉群`);
}

async function runNotify(flags) {
  const cidValue = flags.cid || flags.cids || '';
  const cidList = cidValue.split(',').map(item => item.trim()).filter(Boolean);
  const type = flags.type || '';

  if (cidList.length === 0) {
    throw new Error('请通过 --cid <群ID> 指定通知群；多个群可用逗号分隔');
  }
  if (!NOTIFY_TYPES.has(type)) {
    throw new Error('请通过 --type 指定 noticeStudy、noticeCertify 或 completeStudy');
  }
  if (!flags.yes && !flags.confirm) {
    throw new Error('发送通知会触达钉钉群，请确认后添加 --yes');
  }

  const authRef = await createAuthRef();
  const content = await apiPost(authRef, API.sendCardOfTutorial, {
    sendCardMessageParam: JSON.stringify({ cidList, type }),
  }, '发送企业效能通知');

  const output = {
    ok: true,
    type,
    cidList,
    result: content === null || content === undefined ? null : content,
  };
  console.log(JSON.stringify(output, null, 2));
  success(`已发送企业效能通知：${c.cyan}${type}${c.reset}`);
}

function printHelp() {
  console.log(`
用法:
  openyida corp-efficiency [overview] [--locale zh_CN|en_US] [--raw]
  openyida corp-efficiency details [--locale zh_CN|en_US]
  openyida corp-efficiency detail --title <指标名>|--key <key>|--index <序号> [--open|--no-open]
  openyida corp-efficiency groups [--query <关键词>] [--page 1] [--size 20]
  openyida corp-efficiency notify --cid <群ID> --type <noticeStudy|noticeCertify|completeStudy> --yes

说明:
  overview  查询企业效能概览、学习成果、效能指标和明细报表链接
  details   列出页面所有“查看明细”入口，并输出对应原生报表接口模板
  detail    选择一个“查看明细”入口，输出报表链接、报表参数和可打开的浏览器交接信息
  groups    搜索可接收通知的钉钉群
  notify    向钉钉群发送学习/认证通知，必须显式添加 --yes
`);
}

async function run(args = []) {
  const openOption = parseOpenOption(args);
  const { subCommand, flags } = parseArgs(openOption.args);

  if (flags.help || flags.h || subCommand === 'help' || subCommand === '--help' || subCommand === '-h') {
    printHelp();
    return;
  }

  try {
    if (subCommand === 'overview') {
      await runOverview(flags);
    } else if (subCommand === 'details' || subCommand === 'detail-list') {
      await runDetails(flags);
    } else if (subCommand === 'detail' || subCommand === 'open-detail') {
      await runDetail(flags, openOption.mode);
    } else if (subCommand === 'groups' || subCommand === 'ding-groups') {
      await runGroups(flags);
    } else if (subCommand === 'notify') {
      await runNotify(flags);
    } else {
      throw new Error(`未知的 corp-efficiency 子命令: ${subCommand}`);
    }
  } catch (err) {
    console.error(`企业效能命令失败：${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  run,
  parseArgs,
  parseWorkbenchContent,
  formatOverview,
  sanitizeCommodityInfo,
  buildCertificationDetailReportUrl,
  parseDetailReportInfo,
  buildReportApiInfo,
  flattenDetailTargets,
  selectDetailTarget,
};
