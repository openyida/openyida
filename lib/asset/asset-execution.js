'use strict';

function getAssetExecutionContract() {
  return {
    capabilitySource: 'agent-capabilities.asset_capabilities + actual_host_tool_inventory',
    modes: ['background_agent', 'background_shell', 'synchronous'],
    selection: 'Use a verified nonblocking agent when available; otherwise a verified background shell for scriptable steps; otherwise business-first synchronous batches.',
    nonblockingProof: ['actual_tool_and_background_option', 'hostTaskId', 'dispatchReturnedAt_before_endedAt', 'result_and_exit_status_retrieval'],
    shell: {
      qwenworkHint: 'Inspect Bash.run_in_background in the current tool schema; do not infer Agent background support from Bash support or a host name.',
      allowedWork: ['scriptable_search_with_verified_cli', 'allowed_download_or_upload', 'asset_resolve'],
      foregroundWork: ['host_only_search_or_generation', 'visual_image_review'],
      handoff: 'Pass task.resolve.argv with actual paths and appType when uploading; use the supported background option, save the returned job ID and log/output paths, then resume business work. Poll only at the owning page image-binding join; read exit code and manifest, and stop timed-out jobs before handing over file ownership.',
      unsupported: 'A shell cannot call agent-only image tools. A command ending in & or a returned PID alone is not proof of durable background support.',
    },
    synchronousOrder: ['authorized_resource_creation_or_reuse', 'seed_if_in_scope', 'independent_page_layout_and_data_work', 'bounded_asset_batch', 'next_independent_work', 'own_page_image_binding'],
    forbid: ['blocking_whole_collection_subagent_before_business', 'immediate_wait_after_background_dispatch', 'all_page_asset_barrier', 'claim_parallel_without_overlapping_intervals'],
    audit: 'Copy actual taskState records and businessWork intervals into build-manifest.assetExecution for check-prd-completeness; missing evidence is not verified concurrency.',
  };
}

function selectAssetExecutionMode(backgroundAgent, backgroundShell) {
  if (backgroundAgent.available === true) { return 'background_agent'; }
  if (backgroundShell.available === true) { return 'background_shell'; }
  return backgroundAgent.available === null || backgroundShell.available === null ? 'host_inventory_required' : 'synchronous';
}

// Check recorded intervals only; this does not manufacture or verify host tool events.
function auditAssetExecution(record, expectedTasks = []) {
  const issues = [];
  const add = (code, task = {}) => issues.push({ code, taskKey: task.taskKey || '', pageId: task.pageId || '' });
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const time = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
  const interval = value => {
    const start = time(value?.startedAt), end = time(value?.endedAt);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? { start, end } : null;
  };
  if (record === undefined || record === null) {
    if (Array.isArray(expectedTasks) && expectedTasks.length) { add('execution_record_missing'); }
    return { status: issues.length ? 'needs_review' : 'not_checked', issues };
  }
  if (!Array.isArray(record.tasks) || !Array.isArray(record.businessWork)) {
    add('execution_record_invalid');
    return { status: 'needs_review', issues };
  }
  for (const task of Array.isArray(expectedTasks) ? expectedTasks : []) {
    if (!record.tasks.some(value => value?.taskKey && value.taskKey === task?.taskKey)) { add('task_record_missing', task || {}); }
  }
  const work = record.businessWork.map(interval);
  if (work.some(value => !value)) { add('business_interval_invalid'); }
  const independent = work.filter(Boolean);
  const noIndependentWork = record.independentWork === 'none' && text(record.noIndependentWorkReason) && !record.businessWork.length;
  const seen = new Set();
  for (const value of record.tasks) {
    const task = value || {};
    if (!text(task.taskKey) || seen.has(task.taskKey)) { add('task_identity_invalid', task); }
    seen.add(task.taskKey);
    if (task.executionMode === 'reused' && task.status === 'completed' && text(task.reuseEvidence)) { continue; }
    const run = interval(task);
    if (!run || !['completed', 'partial', 'failed'].includes(task.status)) { add('asset_interval_incomplete', task); continue; }
    if (!['background_agent', 'background_shell', 'synchronous'].includes(task.executionMode)) { add('execution_mode_unknown', task); continue; }
    const returned = time(task.dispatchReturnedAt);
    const overlapStart = task.executionMode !== 'synchronous' && Number.isFinite(returned) ? Math.max(run.start, returned) : run.start;
    const overlap = independent.some(item => Math.max(item.start, overlapStart) < Math.min(item.end, run.end));
    if (task.executionMode !== 'synchronous') {
      if (!text(task.hostTaskId) || !text(task.toolName) || !text(task.backgroundOption)
        || !Number.isFinite(returned) || returned < run.start || returned >= run.end) { add('background_dispatch_unproven', task); }
      if (!overlap && !noIndependentWork) { add('asset_business_overlap_missing', task); }
    } else {
      if (!text(task.fallbackReason)) { add('synchronous_reason_missing', task); }
      if (!noIndependentWork && !independent.some(item => item.start <= run.start)) { add('assets_before_business', task); }
    }
    if (task.claimedParallel === true && !overlap) { add('parallel_claim_unproven', task); }
  }
  if (issues.length) { return { status: 'needs_review', issues }; }
  return { status: record.tasks.length ? 'verified' : 'not_applicable', issues, evidence: 'recorded_intervals_only' };
}

module.exports = { getAssetExecutionContract, selectAssetExecutionMode, auditAssetExecution };
