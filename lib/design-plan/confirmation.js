'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

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

function confirmationHandoff(outputs, revision) {
  return { confirmation: confirmationPayload(outputs, revision), confirmationPolicy };
}

module.exports = { confirmationPayload, confirmationPolicy, confirmationHandoff };
