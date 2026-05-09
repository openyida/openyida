'use strict';

/**
 * corp-efficiency.js - 平台管理 / 企业效能
 *
 * 对应页面：https://www.aliwork.com/platformManage/corpEfficiency
 *
 * 用法：
 *   openyida corp-efficiency [overview] [--locale zh_CN|en_US] [--raw]
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

const API = {
  corpInfoManageCard: '/query/corpadmin/getCorpInfoManageCard.json',
  workbenchContent: '/query/workPlatform/getWorkbenchContent.json',
  commodityInfo: '/query/commodity/getCommodityInfo.json',
  dingGroupSearch: '/query/dinggroup/searchGroup.json',
  sendCardOfTutorial: '/query/card/sendCardOfTutorial.json',
};

const NOTIFY_TYPES = new Set(['noticeStudy', 'noticeCertify', 'completeStudy']);

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
  const efficiencyDataList = Array.isArray(efficacyData.efficiencyDataList)
    ? efficacyData.efficiencyDataList.map(item => ({
      title: item.title || '',
      data: item.data,
      standardData: item.standardData,
      percent: item.percent,
      isOverReference: !!item.isOverReference,
      detailReportUrl: item.detailReportUrl || '',
      detailReportFullUrl: resolveDetailUrl(authRef.baseUrl, item.detailReportUrl),
    }))
    : [];

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
      metrics: efficiencyDataList,
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

async function runOverview(flags) {
  const authRef = await createAuthRef();
  const locale = flags.locale || 'zh_CN';

  const efficacyData = await apiGet(authRef, API.corpInfoManageCard, {}, '查询企业效能数据');
  const workbenchContent = await apiGet(authRef, API.workbenchContent, {}, '查询企业效能文案配置');
  const commodityInfo = await apiGet(authRef, API.commodityInfo, {}, '查询组织版本信息');
  const workbenchData = parseWorkbenchContent(workbenchContent, locale);

  const output = formatOverview({
    efficacyData,
    workbenchData,
    commodityInfo,
    authRef,
    raw: !!flags.raw,
  });

  console.log(JSON.stringify(output, null, 2));
  success(`企业效能：${c.cyan}${output.performance.metrics.length}${c.reset} 项指标，节省预算约 ${c.cyan}${output.overview.saveAppDevMoney}${c.reset} 元`);
  output.performance.metrics.forEach(metric => {
    const dataText = metric.data === null || metric.data === undefined ? '--' : metric.data;
    const standardText = metric.standardData === null || metric.standardData === undefined ? '--' : metric.standardData;
    listItem(`${metric.title}: ${dataText} / 参考值 ${standardText}`);
  });
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
  openyida corp-efficiency groups [--query <关键词>] [--page 1] [--size 20]
  openyida corp-efficiency notify --cid <群ID> --type <noticeStudy|noticeCertify|completeStudy> --yes

说明:
  overview  查询企业效能概览、学习成果、效能指标和明细报表链接
  groups    搜索可接收通知的钉钉群
  notify    向钉钉群发送学习/认证通知，必须显式添加 --yes
`);
}

async function run(args = []) {
  const { subCommand, flags } = parseArgs(args);

  if (flags.help || flags.h || subCommand === 'help' || subCommand === '--help' || subCommand === '-h') {
    printHelp();
    return;
  }

  try {
    if (subCommand === 'overview') {
      await runOverview(flags);
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
};
