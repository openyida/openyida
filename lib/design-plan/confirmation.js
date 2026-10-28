'use strict';

const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { detectRuntimeCapabilities } = require('../core/utils');

const confirmationPolicy = {
  tool: 'ask_human',
  requiredBeforeExecution: true,
  payloadField: 'confirmation',
  policy: 'Actually invoke permitted structured ask_human with the current snapshot/revision and wait. Managed Local uses agent ask-human. Files, links, prose and self-written flags are not approval.',
  approval: 'Require confirm_build from this interaction and revision; record real ID/answer. Reject stale/cancelled/empty/timed-out replies. queued/pending is not consent; continue_editing only edits the draft.',
  unavailable: 'Keep awaiting_confirmation and explain the unavailable tool. Do not fall back to prose approval, switch to Fast or create/update/publish resources.',
  reuse: 'Reuse verified same-plan approval after recovery or asset progress. Scope/visual changes require reconfirmation. Fast adds no Plan approval.',
};

function confirmationPayload(outputs, revision) {
  if (typeof outputs?.confirmationHtml !== 'string' || !outputs.confirmationHtml.trim()
    || typeof revision !== 'string' || !revision.trim()) {
    throw new CliError(t('design_plan.confirmation_required'), { code: 'DESIGN_PLAN_CONFIRMATION_REQUIRED' });
  }
  return {
    question: '请确认当前搭建方案',
    options: [{ label: '确认并开始搭建', value: 'confirm_build' }, { label: '继续调整', value: 'continue_editing' }],
    submitLabel: '提交选择',
    attachments: [{ name: '搭建方案.html', path: outputs.confirmationHtml }],
    revision,
  };
}

function confirmationHandoff(outputs, revision, runtimeOptions) {
  const result = { confirmation: confirmationPayload(outputs, revision), confirmationPolicy };
  if (detectRuntimeCapabilities(runtimeOptions).tool === 'qwenwork') {
    result.confirmationPolicy = { ...confirmationPolicy, policy: 'Use qwenworkPresentation when supported; otherwise invoke structured ask_human with confirmation and wait.' };
    result.qwenworkPresentation = {
      tool: 'qwenwork_file_present_files',
      input: { files: [{ file_path: path.resolve(outputs.confirmationHtml), presentation: 'compact' }] },
      revision,
      requires: 'Tool schema must allow files[].presentation=compact.',
      confirmation: 'Ask the permitted structured question with the returned snapshot link. Bind its real interaction ID to snapshot/revision; only explicit confirm_build for that unchanged pair is approval. Use declared fields only.',
    };
  }
  return result;
}

module.exports = { confirmationPayload, confirmationPolicy, confirmationHandoff };
