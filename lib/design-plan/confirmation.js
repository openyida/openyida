'use strict';

function confirmationPayload(outputs, revision) {
  return {
    question: '请确认当前搭建方案',
    options: [{ label: '确认并开始搭建', value: 'confirm_build' }, { label: '继续调整', value: 'continue_editing' }],
    submitLabel: '提交选择',
    attachments: [{ name: '搭建方案.html', path: outputs.html }],
    revision,
  };
}

module.exports = { confirmationPayload };
