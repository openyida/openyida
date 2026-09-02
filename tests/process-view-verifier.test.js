'use strict';

const {
  verifyPlatformView,
  visibleNodeSequence,
} = require('../lib/process/services/process-view-verifier');

function name(value) {
  return { zh_CN: value, en_US: value };
}

function view(children) {
  return {
    bindingForm: 'FORM_TEST',
    formulaRules: [],
    globalSetting: {},
    schema: { componentName: 'CanvasEngine', children },
  };
}

function response(payload) {
  return { success: true, content: JSON.stringify(payload) };
}

function expectedView() {
  return view([
    { componentName: 'ApplyNode', props: { name: name('发起') } },
    {
      componentName: 'MultiApprovalNode',
      props: {
        name: name('多人会审'),
        multiApproverRules: {
          approvalType_multi: 'all',
          multiRules: [{ status: '0', rules: [] }],
        },
      },
    },
    { componentName: 'ApprovalNode', props: { name: name('财务审批'), approverRules: { multiApproverType: 'or' } } },
    { componentName: 'EndNode', props: { name: name('结束') } },
  ]);
}

describe('published process platform view verifier', () => {
  test('verifies visible component, localized name, order, and approval mode', () => {
    const expected = expectedView();
    const result = verifyPlatformView(response(expected), expected, 'FORM_TEST');

    expect(result).toMatchObject({
      verificationLevel: 'PLATFORM_VIEW_VERIFIED',
      valid: true,
      errors: [],
    });
    expect(visibleNodeSequence(expected)).toEqual([
      { componentName: 'ApplyNode', name: '发起', approvalMode: null },
      { componentName: 'MultiApprovalNode', name: '多人会审', approvalMode: 'all' },
      { componentName: 'ApprovalNode', name: '财务审批', approvalMode: 'or' },
      { componentName: 'EndNode', name: '结束', approvalMode: null },
    ]);
  });

  test.each([
    ['component', function mutate(payload) { payload.schema.children[1].componentName = 'ApprovalNode'; }],
    ['name', function mutate(payload) { payload.schema.children[1].props.name.zh_CN = '其他审批'; }],
    ['order', function mutate(payload) { payload.schema.children.splice(1, 2, payload.schema.children[2], payload.schema.children[1]); }],
    ['mode', function mutate(payload) { payload.schema.children[1].props.multiApproverRules.approvalType_multi = 'or'; }],
  ])('returns PUBLISHED_UNVERIFIED for a %s mismatch', (_label, mutate) => {
    const expected = expectedView();
    const actual = JSON.parse(JSON.stringify(expected));
    mutate(actual);

    expect(verifyPlatformView(response(actual), expected, 'FORM_TEST')).toMatchObject({
      verificationLevel: 'PUBLISHED_UNVERIFIED',
      valid: false,
      errors: [expect.objectContaining({ code: 'PROCESS_PLATFORM_VIEW_NODE_SEQUENCE_MISMATCH' })],
    });
  });

  test('rejects incomplete view-only payloads without fabricating verification', () => {
    expect(verifyPlatformView(
      response({ bindingForm: 'FORM_TEST' }),
      expectedView(),
      'FORM_TEST'
    )).toMatchObject({
      verificationLevel: 'PUBLISHED_UNVERIFIED',
      valid: false,
      errors: [expect.objectContaining({ code: 'PROCESS_PLATFORM_VIEW_SCHEMA_MISSING' })],
    });
  });
});
