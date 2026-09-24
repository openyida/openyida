'use strict';

const { createAuthRef } = require('../core/yida-client');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { listLogicflowDetailLogs } = require('./integration-api');

const PAGE_SIZE = 100;

function parseArgs(args) {
  const options = { appType: '', procInstId: '', json: false, includeParams: false, help: false };
  const positional = [];
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') { options.help = true; }
    else if (arg === '--json') { options.json = true; }
    else if (arg === '--include-params') { options.includeParams = true; }
    else if (arg.startsWith('-')) {
      throw new CliError(t('integration_detail_log.unknown_option', arg), { code: 'CLI_INVALID_ARGUMENTS' });
    } else { positional.push(arg); }
  }
  if (options.help) { return options; }
  if (positional.length !== 2) {
    throw new CliError(t('integration_detail_log.usage'), { code: 'CLI_INVALID_ARGUMENTS' });
  }
  if (options.includeParams && !options.json) {
    throw new CliError(t('integration_detail_log.params_require_json'), { code: 'CLI_INVALID_ARGUMENTS' });
  }
  [options.appType, options.procInstId] = positional;
  return options;
}

async function fetchAll(authRef, appType, procInstId) {
  const nodes = [];
  let totalCount = null;
  for (let pageIndex = 1; totalCount === null || nodes.length < totalCount; pageIndex++) {
    const content = await listLogicflowDetailLogs(authRef, { appType, procInstId, pageIndex, pageSize: PAGE_SIZE });
    if (totalCount === null) { totalCount = content.totalCount; }
    if (content.totalCount !== totalCount || nodes.length + content.data.length > totalCount ||
        (nodes.length < totalCount && content.data.length === 0) || content.data.length > PAGE_SIZE ||
        (content.currentPage !== undefined && content.currentPage !== pageIndex)) {
      throw new CliError(t('integration_detail_log.pagination_failed'), { code: 'INTEGRATION_DETAIL_LOG_PAGINATION_FAILED' });
    }
    nodes.push(...content.data);
  }
  return { totalCount, nodes };
}

function summarizeNode(node, index, includeParams) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new CliError(t('integration_detail_log.invalid_response'), { code: 'INTEGRATION_DETAIL_LOG_INVALID_RESPONSE' });
  }
  const inputParams = node && node.inputParams && typeof node.inputParams === 'object' && !Array.isArray(node.inputParams)
    ? node.inputParams : {};
  const outputParams = node && node.outputParams && typeof node.outputParams === 'object' && !Array.isArray(node.outputParams)
    ? node.outputParams : {};
  const summary = {
    index: index + 1,
    name: node.name || '',
    activityKey: node.activityKey || '',
    elapsedTime: node.elapsedTime,
    inputKeys: Object.keys(inputParams),
    outputKeys: Object.keys(outputParams),
  };
  if (includeParams) {
    summary.inputParams = inputParams;
    summary.outputParams = outputParams;
  }
  return summary;
}

async function run(args) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(t('integration_detail_log.usage'));
    return;
  }
  const authRef = createAuthRef();
  const result = await fetchAll(authRef, options.appType, options.procInstId);
  const payload = {
    appType: options.appType,
    procInstId: options.procInstId,
    totalCount: result.totalCount,
    nodes: result.nodes.map((node, index) => summarizeNode(node, index, options.includeParams)),
  };
  if (options.json) {
    console.log(JSON.stringify(payload));
    return;
  }
  console.log(t('integration_detail_log.summary', payload.totalCount));
  for (const node of payload.nodes) {
    console.log([node.index, node.name, node.activityKey || '-', node.elapsedTime === undefined ? '-' : node.elapsedTime,
      node.inputKeys.join(','), node.outputKeys.join(',')].join('\t'));
  }
}

module.exports = { PAGE_SIZE, parseArgs, fetchAll, summarizeNode, run };
