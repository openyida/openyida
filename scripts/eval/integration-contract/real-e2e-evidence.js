'use strict';

const { isDeepStrictEqual } = require('util');

const PASSED_PREFIX = 'passed';
const UNRESOLVED_TOP_LEVEL_KEYS = ['blocker', 'failure', 'failedAt'];
const EXPECTED_RESOURCE_COUNTS = {
  app: 1,
  form: 2,
  'logic-flow': 1,
  'form-instance': 2,
};

function invariant(condition, message) {
  if (!condition) {
    throw new Error(`Invalid integration real-E2E evidence: ${message}`);
  }
}

function isPassedStatus(value) {
  return typeof value === 'string' && value.startsWith(PASSED_PREFIX);
}

function assertNoCurrentFailure(evidence, label) {
  if (!isPassedStatus(evidence.status)) {
    return;
  }
  for (const key of UNRESOLVED_TOP_LEVEL_KEYS) {
    invariant(!Object.prototype.hasOwnProperty.call(evidence, key), `${label} passed status retains top-level ${key}`);
  }
  invariant(Boolean(evidence.finishedAt), `${label} passed status requires finishedAt`);
}

function assertResolvedHistory(history, label) {
  invariant(Array.isArray(history) && history.length > 0, `${label} must retain resolved blocker history`);
  for (const entry of history) {
    invariant(entry.previousStatus === 'blocked-profile-selection', `${label} must retain the profile-selection red`);
    invariant(entry.status === 'resolved', `${label} blocker history must be resolved`);
    invariant(Boolean(entry.resolvedAt) && Boolean(entry.resolution), `${label} resolved blocker requires resolution metadata`);
  }
}

function assertRecoveryHistory(history, label) {
  invariant(Array.isArray(history) && history.length >= 2, `${label} must retain both real red-to-green recoveries`);
  for (const entry of history) {
    invariant(entry.red && entry.green, `${label} recovery entries require red and green evidence`);
    invariant(entry.green.status === 'passed', `${label} recovery green must be passed`);
    invariant(Boolean(entry.green.resolvedAt) && Boolean(entry.resolution), `${label} recovery requires resolution metadata`);
  }
  invariant(history.some((entry) => (
    entry.red.failure === 'platform-rejected-logic-flow-name-over-30-characters'
      && entry.green.published === true
      && entry.green.readbackGate === 'passed'
  )), `${label} is missing the logic-flow-name red-to-green recovery`);
  invariant(history.some((entry) => (
    entry.red.failure === 'RESPONSE_ID_MISSING'
      && entry.red.successfulCreateCommands === 1
      && entry.green.step === 'query-source-instance-recovery'
      && entry.green.matchedCount === 1
      && entry.green.nameAdoption === false
  )), `${label} is missing the response-ID unique-readback recovery`);
}

function countResources(resources) {
  return (resources || []).reduce((counts, resource) => {
    counts[resource.type] = (counts[resource.type] || 0) + 1;
    return counts;
  }, {});
}

function validateRealE2EEvidence({ manifest, registry, residual }) {
  invariant(manifest && registry && residual, 'manifest, registry, and residual are required');
  invariant(manifest.runId && manifest.runId === registry.runId && registry.runId === residual.runId,
    'runId must match across all evidence files');
  invariant(isPassedStatus(manifest.status) && isPassedStatus(registry.status),
    'manifest and registry current status must be passed');

  assertNoCurrentFailure(manifest, 'manifest');
  assertNoCurrentFailure(registry, 'registry');
  assertResolvedHistory(manifest.blockerHistory, 'manifest');
  assertResolvedHistory(registry.blockerHistory, 'registry');
  assertRecoveryHistory(manifest.recoveryHistory, 'manifest');
  assertRecoveryHistory(registry.recoveryHistory, 'registry');

  invariant(manifest.stageResults?.deterministic?.status === 'passed', 'deterministic stage must be passed');
  invariant(manifest.stageResults?.publishReadback?.status === 'passed', 'publish/readback stage must be passed');
  invariant(manifest.stageResults?.runtime?.status === 'passed', 'runtime stage must be passed');
  invariant(manifest.stageResults?.cleanup?.status === 'completed-owned-residuals-reported',
    'cleanup stage must report retained owned residuals');

  invariant(isDeepStrictEqual(registry.resources, residual.ownedResiduals),
    'registry resources and residual ownedResiduals must be deeply equal');
  const resourceCounts = countResources(registry.resources);
  invariant(isDeepStrictEqual(resourceCounts, EXPECTED_RESOURCE_COUNTS),
    'owned resources must be exactly 1 app, 2 forms, 1 logic-flow, and 2 form-instances');

  const sourceInstance = registry.resources.find((resource) => resource.role === 'runtime-trigger');
  const targetInstance = registry.resources.find((resource) => resource.role === 'automation-created-target');
  invariant(sourceInstance?.ownershipEvidence
    === 'exclusive-owned-source-form + single-create-command + exact-runId-record',
  'source instance ownership must use single-create exact unique owned-form readback evidence');
  invariant(targetInstance?.ownershipEvidence
    === 'owned-target-form + owned-published-flow + exact-unique-runId-field-match + single-post-trigger-readback',
  'automation target ownership must use post-trigger readback evidence');

  invariant(registry.cleanup?.deleteCalls === 0, 'cleanup deleteCalls must be zero');
  invariant(registry.cleanup?.ownedResidualCount === 6, 'cleanup ownedResidualCount must be six');
  invariant(registry.cleanup?.processWaivedResidualsTouched === 0,
    'cleanup must not touch process-waived residuals');
  invariant(manifest.stageResults.cleanup.deleteCalls === 0
    && manifest.stageResults.cleanup.ownedResidualCount === 6
    && manifest.stageResults.cleanup.processWaivedResidualsTouched === 0,
  'manifest cleanup counts must match the registry');

  return {
    runId: manifest.runId,
    status: manifest.status,
    resourceCounts,
    ownedResidualCount: registry.cleanup.ownedResidualCount,
  };
}

module.exports = {
  EXPECTED_RESOURCE_COUNTS,
  validateRealE2EEvidence,
};
