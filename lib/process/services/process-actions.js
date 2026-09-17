'use strict';

const { buildYidaI18n } = require('../../core/yida-i18n');
const { t } = require('../../core/i18n');

function buildActions() {
  const actionDefs = [
    { action: 'agree', zh: '同意', en: 'Agree', ja: '同意', hidden: false },
    { action: 'disagree', zh: '拒绝', en: 'Disagree', ja: '拒否', hidden: false },
    { action: 'save', zh: '保存', en: 'Save', ja: '保存', hidden: true },
    { action: 'forward', zh: '转交', en: 'Forward', ja: '転送', hidden: true },
    { action: 'append', zh: '加签', en: 'Append', ja: '承認者を追加', hidden: true },
    { action: 'return', zh: '退回', en: 'Return', ja: '差し戻し', hidden: true },
  ];

  return actionDefs.map(function (def) {
    return {
      hidden: def.hidden,
      name: buildYidaI18n(def.zh, { en_US: def.en, ja_JP: def.ja }),
      action: def.action,
      text: buildYidaI18n(def.zh, { en_US: def.en, ja_JP: def.ja }),
      alias: buildYidaI18n(def.zh, { en_US: def.en, ja_JP: def.ja }),
    };
  });
}

function invalid(nodeName, field) {
  const error = new TypeError(t('process_errors.action_config_invalid', nodeName, field));
  error.code = 'PROCESS_COMPILE_ACTION_CONFIG_INVALID';
  error.details = { nodeName, field };
  throw error;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Merge partial button settings without changing unspecified permissions. */
function normalizeActions(value, field, nodeName, complete = false) {
  const defaults = buildActions();
  if (value === undefined) { return defaults; }
  if (!Array.isArray(value)) { invalid(nodeName, field); }
  const seen = new Set();
  const overrides = value.map(action => {
    if (!isObject(action) || typeof action.action !== 'string' || !action.action.trim()
      || (!complete && !['agree', 'disagree', 'save', 'forward', 'append', 'return', 'recall'].includes(action.action))
      || seen.has(action.action) || (action.hidden !== undefined && typeof action.hidden !== 'boolean')) {
      invalid(nodeName, field);
    }
    seen.add(action.action);
    return clone(action);
  });
  const merge = (base, override) => {
    const result = { ...base, ...override };
    if (override && override.name !== undefined && override.alias === undefined) { result.alias = clone(override.name); }
    if (override && override.alias !== undefined && override.name === undefined) { result.name = clone(override.alias); }
    return result;
  };
  // Raw processProps arrays are complete lists, not partial overrides. Do not add
  // agree/disagree permissions to a legacy list that intentionally omitted them.
  if (complete) {
    // NewProcessAdapter treats an omitted hidden field in a raw action as visible.
    return overrides.map(item => merge({ ...defaults.find(action => action.action === item.action), hidden: false }, item));
  }
  const result = defaults.map(action => merge(action, overrides.find(item => item.action === action.action)));
  // Native versions may include the additional recall button.
  overrides.filter(item => item.action === 'recall').forEach(item => result.push({ hidden: true, ...item }));
  return result;
}

/**
 * Compile one shared action contract into designer and engine representations.
 * Native node.actions takes precedence; legacy processProps lists remain accepted.
 * Missing append settings use the same defaults as ActionSetter; invalid explicit
 * settings fail before publishing. No config retains historical hidden defaults.
 * @param {object|undefined} config native normalActions / appendActions overrides
 * @param {object} rawProps legacy approver process properties
 * @param {string} nodeName diagnostic node name
 * @returns {{viewActions: object, processProps: object}} independent JSON values
 */
function buildNodeActions(config, rawProps = {}, nodeName = '') {
  if (config !== undefined && (!isObject(config)
    || Object.keys(config).some(key => !['normalActions', 'appendActions'].includes(key)))) {
    invalid(nodeName, 'actions');
  }
  const input = config || {};
  const normalActions = normalizeActions(input.normalActions === undefined ? rawProps.actions : input.normalActions,
    'actions.normalActions', nodeName, input.normalActions === undefined);
  const appendActions = normalizeActions(input.appendActions === undefined ? rawProps.appendActions : input.appendActions,
    'actions.appendActions', nodeName, input.appendActions === undefined);
  const append = normalActions.find(item => item.action === 'append') || { hidden: true };
  const appendedAppend = appendActions.find(item => item.action === 'append') || { hidden: true };
  const processProps = {};

  // These engine fields are node-wide: the designer derives them from normalActions.
  if (!appendedAppend.hidden && append.hidden) {
    invalid(nodeName, 'actions.normalActions.append.hidden');
  }
  if (!append.hidden) {
    if (append.appendPosition === undefined) {
      append.appendPosition = rawProps.moldList === undefined ? ['BEFORE_APPEND'] : clone(rawProps.moldList);
    }
    if (append.appendResult === undefined) {
      if (rawProps.isConsiderAppendedAction !== undefined && typeof rawProps.isConsiderAppendedAction !== 'boolean') {
        invalid(nodeName, 'processProps.isConsiderAppendedAction');
      }
      append.appendResult = rawProps.isConsiderAppendedAction === undefined
        ? 'valid' : (rawProps.isConsiderAppendedAction === true ? 'valid' : 'invalid');
    }
    if (!Array.isArray(append.appendPosition) || append.appendPosition.length === 0
      || append.appendPosition.some(position => !['BEFORE_APPEND', 'AFTER_APPEND'].includes(position))
      || new Set(append.appendPosition).size !== append.appendPosition.length) {
      invalid(nodeName, 'actions.normalActions.append.appendPosition');
    }
    if (!['valid', 'invalid'].includes(append.appendResult)) {
      invalid(nodeName, 'actions.normalActions.append.appendResult');
    }
    Object.assign(processProps, {
      allowTaskAppend: true,
      moldList: clone(append.appendPosition),
      isConsiderAppendedAction: append.appendResult === 'valid',
      isNeedEndTaskGroupChain: append.appendResult === 'valid',
    });
  } else if (['allowTaskAppend', 'moldList', 'isConsiderAppendedAction', 'isNeedEndTaskGroupChain']
    .some(key => rawProps[key] !== undefined)) {
    // Clear stale engine flags when the action is explicitly disabled.
    Object.assign(processProps, {
      allowTaskAppend: false, moldList: [], isConsiderAppendedAction: false, isNeedEndTaskGroupChain: false,
    });
  }
  const viewActions = { normalActions, appendActions };
  // Retain existing return settings in both representations.
  ['realBackOriginator', 'triggerRule', 'backScope'].forEach(key => {
    if (rawProps[key] !== undefined) { viewActions[key] = clone(rawProps[key]); }
  });
  processProps.actions = clone(normalActions);
  processProps.appendActions = clone(appendActions);
  return { viewActions, processProps };
}

module.exports = { buildNodeActions };
