'use strict';

const { _private: { buildProcessAndViewJson } } = require('../lib/process/configure-process');
const { collectFormMemberIds, assertFormMemberFields } = require('../lib/process/services/process-dynamic-actors');
const { verifyPlatformView } = require('../lib/process/services/process-view-verifier');

function compile(node) {
  return buildProcessAndViewJson({ nodes: [node] }, 'TPROC_TEST', 'FORM_TEST', 'https://www.aliwork.com', 'APP_TEST');
}
function runtime(result) { return result.processJson.nodes.find(node => ['approval', 'carbon'].includes(node.type)); }
function visible(result) { return result.viewJson.schema.children.find(node => /ApprovalNode|OperatorNode|CarbonNode/.test(node.componentName)); }

describe('native form-member and initiator self-selection contracts', () => {
  test.each([['approval', 'approver'], ['operator', 'executor'], ['carbon', 'receiver'], ['multiApproval', 'approver']])(
    '%s reads real member fields instead of defaulting to originator', (type, key) => {
      const result = compile({ type, [key]: { kind: 'formField', fieldIds: ['employeeField_owner', 'employeeField_reviewer'], approvalMode: 'or' } });
      const node = runtime(result);
      expect(collectFormMemberIds(result.viewJson)).toEqual(['employeeField_owner', 'employeeField_reviewer']);
      const rule = type === 'multiApproval' ? visible(result).props.multiApproverRules.multiRules[0] : visible(result).props.approverRules;
      expect(rule).toMatchObject({ type: 'ext_target_approval_variable', multiApproverType: 'or',
        approvalType_ext_target_approval_variable: 'or', formMember: [{ value: 'employeeField_owner' }, { value: 'employeeField_reviewer' }] });
      if (type === 'carbon') {
        expect(node.props.params.find(param => param.key === 'receiver').value).toEqual({ type: 'VARIABLE', value: [['employeeField_owner', 'employeeField_reviewer']] });
      } else if (type === 'multiApproval') {
        expect(node.props.multiRules[0].rules[0]).toMatchObject({ type: 'ext_target_approval_variable', approvals: [['employeeField_owner', 'employeeField_reviewer']] });
      } else {
        expect(node).toMatchObject({ approvalType: 'ext_target_approval_variable', props: { approvals: [['employeeField_owner', 'employeeField_reviewer']], multiApprove: 'or' } });
      }
    });

  test.each(['approval', 'operator'])('%s uses the generated node ID for self-selection', type => {
    const result = compile({ type, [type === 'operator' ? 'executor' : 'approver']: { kind: 'selfSelect' } });
    expect(runtime(result)).toMatchObject({ approvalType: 'ext_target_optional_approval', props: {
      approvals: ['__optionalApproval_' + visible(result).id], optionalApprovalRange: { type: 'ALL' },
    } });
    expect(visible(result).props.approverRules.approvalOptionalRange).toEqual({ type: 'ALL' });
  });

  test('USER limits selection to IDs while preserving designer labels', () => {
    const result = compile({ type: 'approval', approver: { kind: 'selfSelect', range: { type: 'USER', users: [{ id: 'u1', name: '负责人' }] } } });
    expect(runtime(result).props.optionalApprovalRange).toEqual({ type: 'USER', approvalRange: ['u1'] });
    expect(visible(result).props.approverRules.approvalOptionalRange).toMatchObject({ type: 'USER', approvalRange: [{ id: 'u1', label: '负责人' }] });
  });

  test('ROLE preserves Yida and DingTalk role provenance', () => {
    const result = compile({ type: 'operator', executor: { kind: 'selfSelect', range: { type: 'ROLE', roles: [
      { id: 'r1', roleType: 'YIDA' }, { id: 'r2', roleType: 'DINGTALK' },
    ] } } });
    expect(runtime(result).props.optionalApprovalRange).toMatchObject({ type: 'ROLE', roleRange: [
      { id: 'r1', roleType: 'YIDA' }, { id: 'r2', roleType: 'DINGTALK' },
    ] });
  });

  test.each([
    { kind: 'formField' }, { kind: 'formField', fieldId: '' },
    { kind: 'formField', fieldIds: ['a', 'a'] }, { kind: 'formField', fieldId: 'a', fieldIds: ['b'] },
    { kind: 'formField', fieldId: 'a', processProps: { approvals: [['originator']] } },
    { kind: 'selfSelect', range: { type: 'USER', users: [] } },
    { kind: 'selfSelect', range: { type: 'ROLE', roles: [] } },
    { kind: 'selfSelect', range: { type: 'ALL', users: ['u'] } },
    { kind: 'selfSelect', range: { type: 'ORG' } }, { kind: 'selfSelect', range: null },
    { kind: 'selfSelect', range: { type: 'USER', users: [{}] } },
    { kind: 'selfSelect', range: { type: 'ROLE', roles: [{ id: 'r1', roleType: 'typo' }] } },
    { kind: 'selfSelect', approvalMode: 'typo' }, { kind: 'selfSelected' },
    { approvalType: 'ext_target_approval_field', approvals: [['a']] },
    { approvalType: 'ext_target_approval_variable' },
    { approvalType: 'ext_target_approval', approverRules: { type: 'ext_target_typo' } },
    { kind: 'user', users: ['u1'], approverRules: { type: 'ext_target_typo' } },
  ])('rejects malformed or guessed sources locally: %j', approver => {
    expect(() => compile({ type: 'approval', approver })).toThrow(expect.objectContaining({ code: 'PROCESS_DYNAMIC_ACTOR_INVALID' }));
  });

  test('rejects guessed enums hidden in legacy multiRules', () => {
    expect(() => compile({ type: 'multiApproval', approver: 'originator',
      multiRules: [{ status: '0', rules: [{ type: 'ext_target_approval_field' }] }],
    })).toThrow(expect.objectContaining({ code: 'PROCESS_DYNAMIC_ACTOR_INVALID' }));
  });

  test.each(['carbon', 'multiApproval'])('does not pretend %s self-selection is available', type => {
    expect(() => compile({ type, [type === 'carbon' ? 'receiver' : 'approver']: { kind: 'selfSelect' } }))
      .toThrow(expect.objectContaining({ code: 'PROCESS_DYNAMIC_ACTOR_INVALID', details: { reason: 'selfSelect requires approval/operator', nodeType: type, remoteWrites: 0 } }));
  });

  test.each([
    [[]], [[{ fieldId: 'member', componentName: 'TextField' }]],
    [[{ fieldId: 'member', componentName: 'EmployeeField', parentFieldId: 'table' }]],
  ])('rejects missing, non-member and subtable fields before saving', fields => {
    expect(() => assertFormMemberFields(['member'], fields)).toThrow(expect.objectContaining({ details: expect.objectContaining({ fieldId: 'member', remoteWrites: 0 }) }));
  });

  test('accepts a real top-level EmployeeField', () => {
    expect(() => assertFormMemberFields(['member'], [{ fieldId: 'member', componentName: 'EmployeeField', parentFieldId: null }])).not.toThrow();
  });

  test.each([
    { kind: 'formField', fieldId: 'member' },
    { kind: 'selfSelect', range: { type: 'USER', users: ['u1'] } },
    { kind: 'selfSelect', range: { type: 'ROLE', roles: [{ id: 'r1', roleType: 'DINGTALK' }] } },
  ])('accepts the same saved actor despite nonsemantic label changes', approver => {
    const result = compile({ type: 'approval', approver });
    const actual = JSON.parse(JSON.stringify(result.viewJson));
    const rule = actual.schema.children.find(node => node.componentName === 'ApprovalNode').props.approverRules;
    rule.description = '平台补充描述';
    if (rule.formMember) { rule.formMember[0].label = '负责人'; }
    expect(verifyPlatformView({ success: true, content: JSON.stringify(actual) }, result.viewJson, 'FORM_TEST').valid).toBe(true);
  });

  test.each([
    [{ kind: 'formField', fieldId: 'member' }, rule => { rule.formMember[0].value = 'other'; }],
    [{ kind: 'selfSelect', range: { type: 'USER', users: ['u1'] } }, rule => { rule.approvalOptionalRange.approvalRange[0].id = 'u2'; }],
    [{ kind: 'selfSelect', range: { type: 'ROLE', roles: [{ id: 'r1', roleType: 'DINGTALK' }] } }, rule => { rule.approvalOptionalRange.roleRange[0].roleType = 'YIDA'; }],
    [{ kind: 'selfSelect' }, rule => { rule.approvalOptionalRange.type = 'USER'; }],
    [{ kind: 'selfSelect', approvalMode: 'or' }, rule => { rule.approvalType_ext_target_optional_approval = 'all'; }],
  ])('published-view verification detects actor drift', (approver, mutate) => {
    const result = compile({ type: 'approval', approver });
    const actual = JSON.parse(JSON.stringify(result.viewJson));
    mutate(actual.schema.children.find(node => node.componentName === 'ApprovalNode').props.approverRules);
    expect(verifyPlatformView({ success: true, content: JSON.stringify(actual) }, result.viewJson, 'FORM_TEST')).toMatchObject({
      valid: false, errors: expect.arrayContaining([expect.objectContaining({ code: 'PROCESS_PLATFORM_VIEW_DYNAMIC_ACTORS_MISMATCH' })]),
    });
  });
});
