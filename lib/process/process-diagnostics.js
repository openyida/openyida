'use strict';

const { t } = require('../core/i18n');

const DEFAULT_TEXT_LIMIT = 240;
const DEFAULT_KEY_LIMIT = 12;

function truncateText(value, limit = DEFAULT_TEXT_LIMIT) {
  const text = value === undefined || value === null ? '' : String(value);
  if (text.length <= limit) {
    return text;
  }
  return text.slice(0, Math.max(0, limit - 3)) + '...';
}

function isPrimitive(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function summarizeContent(content) {
  if (content === undefined) {
    return undefined;
  }
  if (content === null) {
    return null;
  }
  if (typeof content === 'string') {
    return { type: 'string', sample: truncateText(content) };
  }
  if (Array.isArray(content)) {
    return { type: 'array', length: content.length };
  }
  if (typeof content !== 'object') {
    return content;
  }

  const summary = { type: 'object' };
  ['processId', 'processCode', 'formUuid', 'version', 'id', 'status'].forEach((key) => {
    if (isPrimitive(content[key])) {
      summary[key] = content[key];
    }
  });
  if (Array.isArray(content.data)) {
    summary.dataLength = content.data.length;
  }
  const keys = Object.keys(content).slice(0, DEFAULT_KEY_LIMIT);
  if (keys.length > 0) {
    summary.keys = keys;
  }
  return summary;
}

function summarizeRemoteResult(result) {
  if (result === undefined) {
    return undefined;
  }
  if (result === null) {
    return null;
  }
  if (result instanceof Error) {
    const summary = {
      name: result.name,
      message: truncateText(result.message),
    };
    if (result.code) {
      summary.code = result.code;
    }
    if (result.details && typeof result.details === 'object') {
      ['stage', 'nextStep'].forEach((key) => {
        if (isPrimitive(result.details[key])) {
          summary[key] = result.details[key];
        }
      });
      if (Array.isArray(result.details.completedStages)) {
        summary.completedStages = result.details.completedStages.slice();
      }
    }
    return summary;
  }
  if (isPrimitive(result)) {
    return truncateText(result);
  }
  if (Array.isArray(result)) {
    return { type: 'array', length: result.length };
  }
  if (typeof result !== 'object') {
    return String(result);
  }

  const summary = {};
  [
    'success',
    'errorCode',
    'errorMsg',
    'message',
    'code',
    'status',
    'statusCode',
    'throwable',
    'requestId',
    '__needLogin',
    '__csrfExpired',
    'stage',
    'nextStep',
  ].forEach((key) => {
    if (isPrimitive(result[key])) {
      summary[key] = typeof result[key] === 'string'
        ? truncateText(result[key])
        : result[key];
    }
  });
  if (Array.isArray(result.completedStages)) {
    summary.completedStages = result.completedStages.slice();
  }
  if (result.content !== undefined) {
    summary.content = summarizeContent(result.content);
  }
  const included = new Set(Object.keys(summary).concat(['content']));
  const keys = Object.keys(result).filter(key => !included.has(key)).slice(0, DEFAULT_KEY_LIMIT);
  if (keys.length > 0) {
    summary.keys = keys;
  }
  return summary;
}

function createStageTracker() {
  const completedStages = [];
  return {
    complete(stage) {
      if (stage && !completedStages.includes(stage)) {
        completedStages.push(stage);
      }
    },
    getCompletedStages() {
      return completedStages.slice();
    },
    failure(stage, options = {}) {
      const details = {
        stage,
        completedStages: completedStages.slice(),
        nextStep: options.nextStep || defaultNextStep(stage),
      };
      if (options.context && typeof options.context === 'object') {
        details.context = options.context;
      }
      if (options.cause !== undefined) {
        details.cause = summarizeRemoteResult(options.cause);
      }
      return details;
    },
  };
}

function defaultNextStep(stage) {
  switch (stage) {
    case 'validate_inputs':
      return '检查命令参数和本地 JSON 文件路径后重试。';
    case 'load_auth':
      return '执行 openyida login 后重试。';
    case 'create_form':
      return '检查表单字段 JSON 后重试；如果已创建表单，可改用 --formUuid 复用。';
    case 'reuse_form':
      return '确认 formUuid 属于当前应用后重试。';
    case 'switch_form_type':
      return '确认当前账号有表单管理权限，或在宜搭控制台检查表单类型。';
    case 'resolve_process_code':
      return '确认表单已转为流程表单；必要时先运行 configure-process 并显式传入 processCode。';
    case 'preflight_form_mode':
      return t('process_diagnostics.preflight_form_mode');
    case 'authorize_replacement':
      return t('process_diagnostics.authorize_replacement');
    case 'configure_process':
      return '修正流程定义后使用 --formUuid 复用已创建表单重试。';
    case 'read_definition':
      return '检查流程定义 JSON 文件内容后重试。';
    case 'query_process_versions':
      return '确认 processCode 有效，并检查账号流程管理权限。';
    case 'create_draft':
      return '确认流程可编辑并检查账号流程管理权限后重试。';
    case 'build_definition':
      return '修正流程节点 DSL 后重试。';
    case 'save_definition':
      return '检查流程节点配置、字段引用和账号权限后重试。';
    case 'publish_process':
      return '确认流程草稿已保存成功，检查发布权限后重试。';
    case 'verify_published_view':
      return t('process_diagnostics.verify_published_view');
    default:
      return '按错误信息修正后重试。';
  }
}

module.exports = {
  createStageTracker,
  summarizeRemoteResult,
};
