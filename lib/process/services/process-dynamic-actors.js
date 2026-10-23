'use strict';

const { CliError } = require('../../core/cli-error');
const { t } = require('../../core/i18n');

const FORM_MEMBER = 'ext_target_approval_variable';
const SELF_SELECT = 'ext_target_optional_approval';
// Native designer ApproverType, plus the existing conditional-actors adapter.
const NATIVE_TYPES = new Set(['ext_target_noset', 'ext_target_approval', 'ext_target_approval_role',
  'ext_target_approval_originator', 'ext_target_approval_liaison', 'ext_target_dept_leader',
  'ext_target_direct_leader', 'ext_target_multi_management', SELF_SELECT, FORM_MEMBER,
  'ext_target_approval_invoke', 'ext_target_approval_connector', 'ext_target_approval_matrix',
  'ext_target_approval_condition']);

function invalid(reason, details = {}) {
  throw new CliError(t('process_dynamic_actors.invalid'), {
    code: 'PROCESS_DYNAMIC_ACTOR_INVALID', details: { reason, ...details, remoteWrites: 0 },
  });
}

function buildDynamicActor(node, input, kind, nodeType, helpers) {
  const allowed = ['kind', 'type', 'approverType', 'approvalMode', 'multiApproverType', 'description'];
  allowed.push(...(kind === 'formField' ? ['fieldId', 'fieldIds'] : ['range']));
  if (Object.keys(input).some(key => !allowed.includes(key))) { invalid('unsupported property'); }
  if (input.kind && input.type && input.kind !== input.type) { invalid('conflicting kind/type'); }
  const mode = helpers.normalizeApprovalMode(input.approvalMode || input.multiApproverType || 'all');
  if (!['all', 'or', 'oneByOne'].includes(mode)) { invalid('approvalMode'); }
  const approvalType = kind === 'formField' ? FORM_MEMBER : SELF_SELECT;
  const description = input.description || kind;
  const approverRules = helpers.createBaseApproverRules(approvalType, description, {});
  approverRules.multiApproverType = mode;
  approverRules['approvalType_' + approvalType] = mode;
  if (kind === 'formField') {
    if (input.fieldId !== undefined && input.fieldIds !== undefined) { invalid('use fieldId or fieldIds'); }
    const ids = input.fieldId === undefined ? input.fieldIds : [input.fieldId];
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !id.trim() || id !== id.trim())
      || new Set(ids).size !== ids.length) { invalid('fieldId/fieldIds'); }
    approverRules.formMember = ids.map(value => ({ value, label: value }));
    return { approvalType, approvals: [ids], approverRules, description,
      processProps: { multiApprove: mode }, carbonReceiver: { type: 'VARIABLE', value: [ids] } };
  }
  // Carbon self-selection needs a separate non-free entitlement and feature flag.
  // MultiApproval deliberately excludes this source in the native designer.
  if (!['approval', 'operator'].includes(nodeType)) { invalid('selfSelect requires approval/operator', { nodeType }); }
  const range = input.range === undefined ? { type: 'ALL' } : input.range;
  if (!range || typeof range !== 'object' || Array.isArray(range)
    || !['ALL', 'USER', 'ROLE'].includes(range.type)) { invalid('range.type'); }
  const rangeKey = range.type === 'USER' ? 'users' : range.type === 'ROLE' ? 'roles' : null;
  if (Object.keys(range).some(key => key !== 'type' && key !== rangeKey)) { invalid('range properties'); }
  const runtimeRange = { type: range.type };
  const viewRange = { type: range.type };
  if (rangeKey) {
    if (!Array.isArray(range[rangeKey]) || !range[rangeKey].length) { invalid('range must be nonempty'); }
    let items;
    try {
      items = rangeKey === 'users' ? helpers.normalizeUserApprovers({ users: range.users })
        : helpers.normalizeRoleApprovers({ roles: range.roles });
    } catch { invalid('range member/role requires a real ID'); }
    if (items.some(item => !item.id.trim() || !['YIDA', 'DINGTALK'].includes(item.roleType))) { invalid('range ID/roleType'); }
    if (new Set(items.map(item => String(item.id))).size !== items.length) { invalid('duplicate range ID'); }
    const key = rangeKey === 'users' ? 'approvalRange' : 'roleRange';
    viewRange[key] = items;
    runtimeRange[key] = rangeKey === 'users' ? items.map(item => item.id) : items;
  }
  approverRules.approvalOptionalRange = viewRange;
  return { approvalType, approvals: ['__optionalApproval_' + node._nodeId], approverRules, description,
    processProps: { multiApprove: mode, optionalApprovalRange: runtimeRange } };
}

function validateNativeActor(raw, nodeType, nodeId) {
  if (Array.isArray(raw)) { invalid('actor must be an object'); }
  if (raw.kind || raw.approverType) { invalid('unknown friendly actor kind', { kind: raw.kind || raw.approverType }); }
  const type = raw.approvalType || raw.type || 'ext_target_approval_originator';
  if (!NATIVE_TYPES.has(type)) { invalid('unknown native approvalType', { approvalType: type }); }
  if (raw.approverRules?.type && raw.approverRules.type !== type) { invalid('runtime/view approvalType mismatch'); }
  // Dynamic native payloads need both halves. Never default their runtime to originator.
  if (type === FORM_MEMBER || type === SELF_SELECT) {
    if (!raw.approvals || !raw.approverRules) { invalid('dynamic native actors require approvals and approverRules'); }
    if (type === SELF_SELECT && !['approval', 'operator'].includes(nodeType)) {
      invalid('selfSelect requires approval/operator', { nodeType });
    }
    if (type === FORM_MEMBER) {
      const members = raw.approverRules.formMember;
      const ids = Array.isArray(members) ? members.map(item => item?.value) : [];
      if (!ids?.length || ids.some(id => typeof id !== 'string' || !id.trim())
        || JSON.stringify(raw.approvals) !== JSON.stringify([ids])) { invalid('formMember/runtime mismatch'); }
      if (nodeType === 'carbon' && (raw.carbonReceiver?.type !== 'VARIABLE'
        || JSON.stringify(raw.carbonReceiver.value) !== JSON.stringify([ids]))) { invalid('carbonReceiver mismatch'); }
    } else {
      const view = raw.approverRules.approvalOptionalRange;
      const runtime = (raw.processProps || raw.props || {}).optionalApprovalRange;
      if (!view || !runtime || !['ALL', 'USER', 'ROLE'].includes(view.type) || view.type !== runtime.type
        || JSON.stringify(raw.approvals) !== JSON.stringify(['__optionalApproval_' + nodeId])) {
        invalid('selfSelect runtime/view range or generated node ID mismatch');
      }
      const key = view.type === 'USER' ? 'approvalRange' : view.type === 'ROLE' ? 'roleRange' : null;
      if (key) {
        const members = view[key];
        if (!Array.isArray(members) || !members.length || members.some(item => !item?.id)) { invalid('selfSelect range IDs'); }
        const ids = members.map(item => item.id);
        const runtimeIds = view.type === 'USER' ? runtime[key] : runtime[key]?.map(item => item.id);
        if (JSON.stringify(ids) !== JSON.stringify(runtimeIds)) { invalid('selfSelect runtime/view range IDs mismatch'); }
      }
    }
  }
}

// Check both emitted contracts, including legacy multiRules and nested branches.
function assertNativeActorTypes(value) {
  if (!value || typeof value !== 'object') { return; }
  if (Array.isArray(value)) { value.forEach(assertNativeActorTypes); return; }
  for (const [key, item] of Object.entries(value)) {
    if (['type', 'approvalType'].includes(key) && typeof item === 'string' && item.startsWith('ext_target_')
      && item !== 'ext_target_activity' && !NATIVE_TYPES.has(item)) {
      invalid('unknown native approvalType', { approvalType: item });
    }
    if (item && typeof item === 'object') { assertNativeActorTypes(item); }
  }
}

function actorRules(node) {
  const props = node?.props || {};
  return props.multiApproverRules ? props.multiApproverRules.multiRules || [] : [props.approverRules].filter(Boolean);
}

function collectFormMemberIds(view) {
  const ids = new Set();
  function visit(nodes) {
    for (const node of nodes || []) {
      for (const rule of actorRules(node)) {
        if (rule.type === FORM_MEMBER) { (rule.formMember || []).forEach(item => ids.add(item.value)); }
      }
      visit(node.children);
    }
  }
  visit(view?.schema?.children);
  return [...ids];
}

function assertFormMemberFields(ids, fields) {
  for (const fieldId of ids) {
    const field = fields.find(item => item.fieldId === fieldId);
    if (!field || field.componentName !== 'EmployeeField' || field.parentFieldId) {
      invalid('formField requires an existing top-level EmployeeField', { fieldId, componentName: field?.componentName });
    }
  }
}

function verifyDynamicActors(expected, actual, errors) {
  function signature(node) {
    return actorRules(node).filter(rule => [FORM_MEMBER, SELF_SELECT].includes(rule.type)).map(rule => {
      if (rule.type === FORM_MEMBER) { return { type: rule.type, mode: rule['approvalType_' + rule.type], ids: (rule.formMember || []).map(item => item.value) }; }
      const range = rule.approvalOptionalRange || {};
      return { type: rule.type, mode: rule['approvalType_' + rule.type], rangeType: range.type,
        users: range.type === 'USER' ? (range.approvalRange || []).map(item => String(item.id)) : [],
        roles: range.type === 'ROLE' ? (range.roleRange || []).map(item => ({ id: String(item.id), roleType: item.roleType || 'YIDA' })) : [] };
    });
  }
  const wanted = signature(expected);
  if (wanted.length && JSON.stringify(wanted) !== JSON.stringify(signature(actual))) {
    errors.push({ code: 'PROCESS_PLATFORM_VIEW_DYNAMIC_ACTORS_MISMATCH', nodeId: expected.id });
  }
}

module.exports = { assertNativeActorTypes, buildDynamicActor, validateNativeActor, collectFormMemberIds, assertFormMemberFields, verifyDynamicActors };
