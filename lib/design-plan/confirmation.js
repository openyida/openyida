'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const confirmationPolicy = {
  tool: 'ask_human',
  requiredBeforeExecution: true,
  payloadField: 'confirmation',
  policy: 'ask_human is a logical action: invoke an available permitted structured host tool and wait. QwenWork desktop may use AskUserQuestion after presenting the immutable snapshot; the agent binds the real interaction to snapshot/revision outside the tool input. Pass only supported schema fields. Managed Local uses agent ask-human only in a verified managed run. Files, links, prose and self-written flags alone are not approval.',
  approval: 'Require confirm_build from this interaction and revision; map the host answer using the recorded options, and record real ID/answer. Before continuing CLI building, verify that the current revision and snapshot content still match the presented context. Reject stale/cancelled/empty/timed-out replies. queued/pending is not consent; continue_editing only edits the draft.',
  unavailable: 'Use AskUserQuestion or another permitted host question tool before declaring confirmation unavailable; lack of attachments/revision parameters is not a blocker when the agent records the snapshot binding. If no structured tool is available or it fails, keep awaiting_confirmation. Do not fall back to prose approval, switch to Fast, create/update/publish resources, open a browser to find approval, or create another web build task.',
  reuse: 'Reuse verified same-plan approval after recovery or asset progress. Scope/visual changes require reconfirmation. Fast adds no Plan approval.',
  hostAdapter: { tool: 'AskUserQuestion', payloadField: 'confirmationAdapters.AskUserQuestion.input',
    bindingField: 'confirmationAdapters.AskUserQuestion.context', recordPath: 'meta.planState.confirmationContext' },
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
  const confirmation = confirmationPayload(outputs, revision);
  return {
    confirmation,
    confirmationPolicy,
    confirmationAdapters: {
      AskUserQuestion: {
        input: {
          questions: [{
            question: confirmation.question,
            header: t('design_plan.confirmation_header'),
            options: [
              { label: confirmation.options[0].label, description: t('design_plan.confirmation_build_description') },
              { label: confirmation.options[1].label, description: t('design_plan.confirmation_edit_description') },
            ],
            multiSelect: false,
          }],
        },
        context: {
          revision,
          snapshotPath: outputs.confirmationHtml,
          question: confirmation.question,
          answerMap: Object.fromEntries(confirmation.options.map(option => [option.label, option.value])),
        },
      },
    },
  };
}

module.exports = { confirmationPayload, confirmationPolicy, confirmationHandoff };
