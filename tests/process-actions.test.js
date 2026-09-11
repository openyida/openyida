'use strict';

const { buildNodeActions } = require('../lib/process/services/process-actions');
const { buildProcessAndViewJson } = require('../lib/process/services/process-compiler');
const { verifyPlatformView } = require('../lib/process/services/process-view-verifier');

const enabled = [
  { action: 'forward', hidden: false },
  { action: 'append', hidden: false },
];

function compile(node) {
  return buildProcessAndViewJson({ nodes: [node] }, 'TPROC_TEST', 'FORM_TEST', 'https://www.aliwork.com', 'APP_TEST');
}

function verify(actual, expected) {
  return verifyPlatformView({ success: true, content: JSON.stringify(actual) }, expected, 'FORM_TEST');
}

describe('process action contract', () => {
  test('keeps historical defaults without enabling new permissions', () => {
    const result = buildNodeActions();
    expect(Object.keys(result.processProps).sort()).toEqual(['actions', 'appendActions']);
    for (const group of ['normalActions', 'appendActions']) {
      expect(result.viewActions[group].map(({ action, hidden }) => [action, hidden])).toEqual([
        ['agree', false], ['disagree', false], ['save', true], ['forward', true], ['append', true], ['return', true],
      ]);
    }
  });

  test.each(['approval', 'operator', 'multiApproval'])('generates designer and runtime settings for %s', type => {
    const result = compile({ type, name: '审批', approver: 'originator', actions: { normalActions: enabled, appendActions: enabled } });
    const runtime = result.processJson.nodes.find(node => node.type === 'approval').props;
    const view = result.viewJson.schema.children.find(node => node.props.actions).props.actions;
    expect(runtime).toMatchObject({
      allowTaskAppend: true, moldList: ['BEFORE_APPEND'], isConsiderAppendedAction: true, isNeedEndTaskGroupChain: true,
      actions: view.normalActions, appendActions: view.appendActions,
    });
    expect(view.normalActions.find(item => item.action === 'append')).toMatchObject({
      hidden: false, appendPosition: ['BEFORE_APPEND'], appendResult: 'valid',
    });
    // The mobile approval bar calls indexOf on this server-extracted field.
    expect(runtime.moldList.indexOf('BEFORE_APPEND')).toBe(0);
    expect(runtime.moldList.indexOf('AFTER_APPEND')).toBe(-1);
    expect(verify(result.viewJson, result.viewJson).valid).toBe(true);
  });

  test('supports forward alone without granting append permissions', () => {
    const result = buildNodeActions({ normalActions: [enabled[0]] });
    expect(result.processProps.actions.find(item => item.action === 'forward').hidden).toBe(false);
    expect(result.processProps.actions.find(item => item.action === 'append').hidden).toBe(true);
    expect(result.processProps.allowTaskAppend).toBeUndefined();
  });

  test('preserves explicit post-append and non-participating result', () => {
    const config = { normalActions: [{ action: 'append', hidden: false, appendPosition: ['AFTER_APPEND'], appendResult: 'invalid' }] };
    const before = JSON.stringify(config);
    const { processProps, viewActions } = buildNodeActions(config);
    expect(processProps).toMatchObject({ moldList: ['AFTER_APPEND'], isConsiderAppendedAction: false, isNeedEndTaskGroupChain: false });
    expect(JSON.stringify(config)).toBe(before);
    processProps.actions[0].hidden = true;
    expect(viewActions.normalActions[0].hidden).toBe(false);
  });

  test('repairs legacy raw action passthrough and mirrors it into the view', () => {
    const result = compile({ type: 'approval', name: '审批', approver: {
      type: 'originator', processProps: { actions: enabled, appendActions: enabled, moldList: ['AFTER_APPEND'], isConsiderAppendedAction: false },
    } });
    const runtime = result.processJson.nodes.find(node => node.type === 'approval').props;
    const view = result.viewJson.schema.children.find(node => node.props.actions).props.actions;
    expect(runtime).toMatchObject({ allowTaskAppend: true, moldList: ['AFTER_APPEND'], isNeedEndTaskGroupChain: false });
    expect(view.normalActions).toEqual(runtime.actions);
    expect(view.appendActions).toEqual(runtime.appendActions);
  });

  test('explicitly disabling append clears legacy flags', () => {
    const result = buildNodeActions({ normalActions: [{ action: 'append', hidden: true }] }, {
      actions: enabled, allowTaskAppend: true, moldList: ['BEFORE_APPEND'], isConsiderAppendedAction: true,
    });
    expect(result.processProps).toMatchObject({ allowTaskAppend: false, moldList: [], isConsiderAppendedAction: false, isNeedEndTaskGroupChain: false });
  });

  test('legacy complete lists do not gain omitted approval permissions', () => {
    const { processProps, viewActions } = buildNodeActions(undefined, { actions: [enabled[0]], appendActions: [] });
    expect(processProps.actions.map(item => item.action)).toEqual(['forward']);
    expect(viewActions.normalActions.map(item => item.action)).toEqual(['forward']);
    expect(processProps.appendActions).toEqual([]);
  });

  test('retains legacy visibility semantics and custom action types', () => {
    const { processProps } = buildNodeActions(undefined, { actions: [{ action: 'forward' }, { action: 'customAction' }] });
    expect(processProps.actions.map(({ action, hidden }) => ({ action, hidden }))).toEqual([
      { action: 'forward', hidden: false }, { action: 'customAction', hidden: false },
    ]);
  });

  test('supports both append positions and preserves custom names and comments', () => {
    const { processProps } = buildNodeActions({ normalActions: [
      { ...enabled[1], appendPosition: ['BEFORE_APPEND', 'AFTER_APPEND'] },
      { ...enabled[0], name: { zh_CN: '转交审批' }, remark: { required: true } },
    ] });
    expect(processProps.moldList).toEqual(['BEFORE_APPEND', 'AFTER_APPEND']);
    expect(processProps.actions.find(item => item.action === 'forward')).toMatchObject({
      name: { zh_CN: '转交审批' }, alias: { zh_CN: '转交审批' }, remark: { required: true },
    });
  });

  test('rejects invalid legacy result types instead of treating string false as a rule', () => {
    expect(() => buildNodeActions(undefined, { actions: enabled, isConsiderAppendedAction: 'false' }))
      .toThrow(expect.objectContaining({ code: 'PROCESS_COMPILE_ACTION_CONFIG_INVALID' }));
  });

  test.each([
    null, [], { normalActions: {} }, { normalActions: [{ action: 'appned', hidden: false }] },
    { normalActions: [{ action: 'append', hidden: 'false' }] },
    { normalActions: [enabled[1], enabled[1]] },
    ...[null, [], 'BEFORE_APPEND', ['unknown'], ['BEFORE_APPEND', 'BEFORE_APPEND']].map(appendPosition => ({ normalActions: [{ ...enabled[1], appendPosition }] })),
    { normalActions: [{ ...enabled[1], appendResult: 'unknown' }] },
    { appendActions: [enabled[1]] },
  ])('rejects invalid settings before any publishing: %j', config => {
    expect(() => buildNodeActions(config)).toThrow(expect.objectContaining({ code: 'PROCESS_COMPILE_ACTION_CONFIG_INVALID' }));
  });

  test.each(['missing actions', 'hidden append', 'missing position', 'changed result', 'appended forward'])('readback rejects %s', mutation => {
    const result = compile({ type: 'approval', approver: 'originator', actions: { normalActions: enabled, appendActions: enabled } });
    const actual = JSON.parse(JSON.stringify(result.viewJson));
    const props = actual.schema.children.find(node => node.props.actions).props;
    const append = props.actions.normalActions.find(item => item.action === 'append');
    if (mutation === 'missing actions') { delete props.actions; }
    if (mutation === 'hidden append') { append.hidden = true; }
    if (mutation === 'missing position') { delete append.appendPosition; }
    if (mutation === 'changed result') { append.appendResult = 'invalid'; }
    if (mutation === 'appended forward') { props.actions.appendActions.find(item => item.action === 'forward').hidden = true; }
    expect(verify(actual, result.viewJson)).toMatchObject({ valid: false, verificationLevel: 'PUBLISHED_UNVERIFIED', errors: expect.arrayContaining([
      expect.objectContaining({ code: 'PROCESS_PLATFORM_VIEW_ACTION_MISMATCH' }),
    ]) });
  });

  test('readback tolerates platform-added remark metadata and recall button', () => {
    const result = compile({ type: 'approval', approver: 'originator', actions: { normalActions: enabled } });
    const actual = JSON.parse(JSON.stringify(result.viewJson));
    const actions = actual.schema.children.find(node => node.props.actions).props.actions;
    actions.normalActions[0].remark = { popUp: true, required: false };
    actions.normalActions.push({ action: 'recall', hidden: true });
    expect(verify(actual, result.viewJson).valid).toBe(true);
  });
});
