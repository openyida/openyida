'use strict';

const { verifyDynamicActors } = require('./process-dynamic-actors');

// The native MultiApproval setter stores flat UI rules, while runtime rules
// are grouped by status. Keep the two representations separate.
function buildMultiApproverRules(config, legacyRules) {
  if (Array.isArray(legacyRules)) {
    return { processRules: JSON.parse(JSON.stringify(legacyRules)),
      viewRules: JSON.parse(JSON.stringify(legacyRules)) };
  }
  const rule = { ...config.processProps, type: config.approvalType,
    description: config.approverRules.description };
  if (config.approvals !== undefined) { rule.approvals = config.approvals; }
  return {
    processRules: [{ status: '0', rules: [rule] }],
    viewRules: [JSON.parse(JSON.stringify(config.approverRules))],
  };
}

function verifyActorRoles(expectedNodes, actualNodes, errors) {
  function rolesOf(node) {
    const props = node && node.props || {};
    const rules = props.multiApproverRules
      ? props.multiApproverRules.multiRules : [props.approverRules];
    return (rules || []).filter(rule => rule && rule.type === 'ext_target_approval_role')
      .map(rule => (rule.roles || []).map(role => ({ id: String(role.id), roleType: role.roleType || 'YIDA' })));
  }
  (expectedNodes || []).forEach((node, index) => {
    const actual = (actualNodes || [])[index];
    verifyDynamicActors(node, actual, errors);
    const expectedConditional = node.props?.approverRules;
    if (expectedConditional?.mode === 'ApprovalNode_rules_multiple'
      && JSON.stringify(expectedConditional) !== JSON.stringify(actual?.props?.approverRules)) {
      errors.push({ code: 'PROCESS_PLATFORM_VIEW_CONDITIONAL_ACTORS_MISMATCH', nodeId: node.id });
    }
    const expectedRoles = rolesOf(node);
    if (expectedRoles.length && JSON.stringify(expectedRoles) !== JSON.stringify(rolesOf(actual))) {
      errors.push({ code: 'PROCESS_PLATFORM_VIEW_ACTOR_ROLES_MISMATCH', nodeId: node.id });
    }
    if (Array.isArray(node.children)) { verifyActorRoles(node.children, actual && actual.children, errors); }
  });
}

module.exports = { buildMultiApproverRules, verifyActorRoles };
