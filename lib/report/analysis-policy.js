'use strict';

const { createReportQueryProtocol } = require('./query-protocol');
const protocol = createReportQueryProtocol();
const ANALYSIS_THRESHOLD = 2000;

function assessAnalysisDataVolume(response, context = {}) {
  const candidates = [response, response && response.content];
  const totalCount = candidates.map(value => protocol.total(value && value.totalCount)).find(value => value !== null) ?? null;
  return {
    appType: context.appType,
    formUuid: context.formUuid,
    searchFieldJson: context.searchFieldJson || '',
    totalCount,
    threshold: ANALYSIS_THRESHOLD,
    countStatus: totalCount === null ? 'unknown' : 'known',
    requiresUserDecision: totalCount !== null && totalCount > ANALYSIS_THRESHOLD,
    decisionScope: 'canvas-data-binding',
    recommendedMode: 'report',
    nextAction: totalCount === null ? 'verify_count_or_ask_expected_volume'
      : totalCount > ANALYSIS_THRESHOLD ? 'ask_user_before_configuring_aggregation' : 'follow_analysis_requirements',
  };
}

module.exports = { ANALYSIS_THRESHOLD, assessAnalysisDataVolume };
