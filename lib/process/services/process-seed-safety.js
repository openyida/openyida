'use strict';

const { CliError } = require('../../core/cli-error');
const { t } = require('../../core/i18n');
const { queryProcessVersions, getProcessById } = require('./process-service');
const { extractPlatformView } = require('./process-view-verifier');

function verifySelfApproval(view) {
  const nodes = view.schema.children;
  if (nodes.length !== 3 || nodes[0]?.componentName !== 'ApplyNode'
    || nodes[1]?.componentName !== 'ApprovalNode' || nodes[2]?.componentName !== 'EndNode'
    || nodes.some(node => !Array.isArray(node.children ?? []) || node.children?.length > 0)) {
    return false;
  }
  const { approverRules, routeRule } = nodes[1].props || {};
  const actors = approverRules?.approverList;
  return approverRules?.type === 'ext_target_approval_originator'
    && approverRules.mode === 'ApprovalNode_rules_only'
    && Array.isArray(actors) && actors.length === 1 && actors[0]?.type === 'ext_target_approval'
    && Object.keys(actors[0]).length === 1
    && (routeRule === undefined || routeRule === null || (Array.isArray(routeRule.rules) && routeRule.rules.length === 0));
}

async function assertProcessSeedSafe(authRef, target) {
  const { appType, formUuid, processCode } = target;
  const unverified = reason => new CliError(t('data_seed.process_unverified'), {
    code: 'DATA_SEED_PROCESS_UNVERIFIED',
    details: { target, reason, nextStep: 'verify_published_process_before_seeding',
      retryable: false, retrySafe: true, sideEffectState: 'none' },
  });

  let version, view;
  try {
    const result = await queryProcessVersions(authRef, appType, processCode, 'PUBLISHED', { pageSize: 2 });
    const versions = result?.content?.data;
    if (result?.success !== true || !Array.isArray(versions)) {
      throw unverified('published_versions_unreadable');
    }
    if (versions.length !== 1) {
      throw unverified('published_version_not_unique');
    }
    const current = versions[0];
    const processId = String(current?.processId ?? current?.id ?? '');
    const processVersion = Number(current?.processVersion ?? current?.version);
    if (!/^[1-9]\d*$/.test(processId) || !Number.isSafeInteger(processVersion) || processVersion < 1
      || (current.status !== undefined && current.status !== 'PUBLISHED')) {
      throw unverified('invalid_published_version');
    }
    version = { processId, processVersion };
    view = extractPlatformView(await getProcessById(authRef, { ...target, ...version }));
  } catch (error) {
    if (error.code === 'DATA_SEED_PROCESS_UNVERIFIED') {throw error;}
    throw unverified('published_view_unreadable');
  }
  if (view.bindingForm !== formUuid) {throw unverified('published_view_binding_mismatch');}
  if (!verifySelfApproval(view)) {
    throw new CliError(t('data_seed.process_not_self_approval'), {
      code: 'DATA_SEED_PROCESS_NOT_SELF_APPROVAL',
      details: { target, ...version, nextStep: 'seed_only_on_temporary_self_approval_or_skip',
        retryable: false, retrySafe: true, sideEffectState: 'none' },
    });
  }
}

module.exports = { assertProcessSeedSafe };
