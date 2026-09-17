'use strict';

const { t } = require('../../core/i18n');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    const wrapped = new TypeError(t('process_errors.platform_view_json_invalid', error.message));
    wrapped.code = 'PROCESS_PLATFORM_VIEW_JSON_INVALID';
    throw wrapped;
  }
}

function extractPlatformView(response) {
  if (!response || response.success !== true) {
    const error = new TypeError(t('process_errors.platform_view_request_failed'));
    error.code = 'PROCESS_PLATFORM_VIEW_REQUEST_FAILED';
    throw error;
  }
  let payload = parseJsonValue(response.content);
  if (isPlainObject(payload) && isPlainObject(payload.data)) {
    payload = payload.data;
  }
  if (!isPlainObject(payload)) {
    const error = new TypeError(t('process_errors.platform_view_content_invalid'));
    error.code = 'PROCESS_PLATFORM_VIEW_CONTENT_INVALID';
    throw error;
  }
  if (!isPlainObject(payload.schema) || payload.schema.componentName !== 'CanvasEngine') {
    const error = new TypeError(t('process_errors.platform_view_schema_missing'));
    error.code = 'PROCESS_PLATFORM_VIEW_SCHEMA_MISSING';
    throw error;
  }
  if (!Array.isArray(payload.schema.children)) {
    const error = new TypeError(t('process_errors.platform_view_nodes_missing'));
    error.code = 'PROCESS_PLATFORM_VIEW_NODES_MISSING';
    throw error;
  }
  return payload;
}

function localizedName(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  if (!isPlainObject(value)) {
    return '';
  }
  return String(value.zh_CN || value.en_US || value.ja_JP || value.name || '').trim();
}

function approvalMode(node) {
  const props = node && node.props || {};
  if (node && node.componentName === 'MultiApprovalNode') {
    const rules = props.multiApproverRules;
    return isPlainObject(rules) && typeof rules.approvalType_multi === 'string'
      ? rules.approvalType_multi
      : null;
  }
  if (['ApprovalNode', 'OperatorNode'].includes(node && node.componentName)) {
    const rules = props.approverRules;
    if (!isPlainObject(rules)) {
      return null;
    }
    return rules.multiApproverType
      || rules.approvalType_ext_target_approval
      || rules.approvalType_ext_target_approval_role
      || null;
  }
  return null;
}

function visibleNodeSequence(viewJson) {
  const output = [];
  function visit(nodes) {
    (nodes || []).forEach(function (node) {
      output.push({
        componentName: node && node.componentName || '',
        name: localizedName(node && node.props && (node.props.name || node.props.nodeName)),
        approvalMode: approvalMode(node),
      });
      if (Array.isArray(node && node.children)) {
        visit(node.children);
      }
    });
  }
  visit(viewJson && viewJson.schema && viewJson.schema.children);
  return output;
}

function verifyPlatformView(response, expectedViewJson, expectedFormUuid) {
  let actualView;
  try {
    actualView = extractPlatformView(response);
  } catch (error) {
    return {
      verificationLevel: 'PUBLISHED_UNVERIFIED',
      valid: false,
      errors: [{ code: error.code || 'PROCESS_PLATFORM_VIEW_INVALID', message: error.message }],
    };
  }

  const errors = [];
  if (actualView.bindingForm !== expectedFormUuid) {
    errors.push({
      code: 'PROCESS_PLATFORM_VIEW_BINDING_MISMATCH',
      expected: expectedFormUuid,
      actual: actualView.bindingForm || null,
    });
  }
  const expectedNodes = visibleNodeSequence(expectedViewJson);
  const actualNodes = visibleNodeSequence(actualView);
  if (JSON.stringify(actualNodes) !== JSON.stringify(expectedNodes)) {
    errors.push({
      code: 'PROCESS_PLATFORM_VIEW_NODE_SEQUENCE_MISMATCH',
      expected: expectedNodes,
      actual: actualNodes,
    });
  }
  verifyActionSettings(expectedViewJson.schema.children, actualView.schema.children, errors);
  return {
    verificationLevel: errors.length === 0 ? 'PLATFORM_VIEW_VERIFIED' : 'PUBLISHED_UNVERIFIED',
    valid: errors.length === 0,
    errors,
    visibleNodes: actualNodes,
  };
}

/** Compare permissions and append semantics, tolerating platform-added metadata. */
function verifyActionSettings(expectedNodes, actualNodes, errors, parentPath = '') {
  (expectedNodes || []).forEach((node, index) => {
    const actual = (actualNodes || [])[index];
    const path = parentPath + '/' + index;
    const expectedActions = node.props && node.props.actions;
    const actualActions = actual && actual.props && actual.props.actions;
    if (isPlainObject(expectedActions)) {
      ['normalActions', 'appendActions'].forEach(group => {
        if (!Array.isArray(expectedActions[group])) { return; }
        expectedActions[group].forEach(action => {
          const matches = actualActions && Array.isArray(actualActions[group])
            ? actualActions[group].filter(item => item && item.action === action.action) : [];
          const found = matches[0];
          const keys = ['hidden'];
          if (group === 'normalActions' && action.action === 'append' && !action.hidden) {
            keys.push('appendPosition', 'appendResult');
          }
          if (matches.length !== 1 || keys.some(key => JSON.stringify(action[key]) !== JSON.stringify(found[key]))) {
            errors.push({ code: 'PROCESS_PLATFORM_VIEW_ACTION_MISMATCH', path, group, action: action.action });
          }
        });
      });
    }
    if (Array.isArray(node.children)) {
      verifyActionSettings(node.children, actual && actual.children, errors, path);
    }
  });
}

module.exports = {
  extractPlatformView,
  verifyPlatformView,
  visibleNodeSequence,
};
