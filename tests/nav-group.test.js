'use strict';

const {
  ROOT_NAV_UUID,
  applyNavigationOrder,
  autoOrderRootNodes,
  buildNavigationTree,
  flattenTreeIds,
  flattenTreeNodes,
  getNavigationPriority,
  moveNodeInTree,
  parseArgs,
  reorderRootNodes,
  resolveNode,
} = require('../lib/app/nav-group');

const fixture = [
  { id: 1, navUuid: 'NAV-SYSTEM-RUNNING-UUID', parentNavUuid: ROOT_NAV_UUID, navType: 'SYSTEM', title: { zh_CN: '待我处理' }, listOrder: 0 },
  { id: 2, navUuid: 'FORM-A', formUuid: 'FORM-A', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', title: { zh_CN: '表单 A' }, listOrder: 1 },
  { id: 3, navUuid: 'NAV-GROUP-1', parentNavUuid: ROOT_NAV_UUID, navType: 'NAV', title: { zh_CN: '分组一', en_US: 'Group One' }, listOrder: 2 },
  { id: 4, navUuid: 'FORM-B', formUuid: 'FORM-B', parentNavUuid: 'NAV-GROUP-1', navType: 'PAGE', title: { zh_CN: '表单 B' }, listOrder: 3 },
  { id: 5, navUuid: 'NAV-GROUP-2', parentNavUuid: ROOT_NAV_UUID, navType: 'NAV', title: { zh_CN: '分组二' }, listOrder: 4 },
];

describe('nav-group helpers', () => {
  test('parseArgs separates positionals and flags', () => {
    expect(parseArgs(['APP_XXX', 'FORM-A', '--to', '分组一', '--after', 'FORM-B', '--force'])).toEqual({
      positional: ['APP_XXX', 'FORM-A'],
      flags: {
        to: '分组一',
        after: 'FORM-B',
        force: true,
      },
    });
  });

  test('buildNavigationTree returns groups and pages without system nodes by default', () => {
    const tree = buildNavigationTree(fixture);

    expect(tree.map((node) => node.name)).toEqual(['表单 A', '分组一', '分组二']);
    expect(tree[1]).toMatchObject({
      navUuid: 'NAV-GROUP-1',
      type: 'group',
      childrenCount: 1,
    });
    expect(tree[1].children[0]).toMatchObject({
      navUuid: 'FORM-B',
      type: 'page',
    });
  });

  test('resolveNode resolves by navUuid, formUuid, and display name', () => {
    expect(resolveNode(fixture, 'FORM-A').navUuid).toBe('FORM-A');
    expect(resolveNode(fixture, '分组一', { groupOnly: true }).navUuid).toBe('NAV-GROUP-1');
    expect(resolveNode(fixture, 'root').navUuid).toBe(ROOT_NAV_UUID);
  });

  test('moveNodeInTree moves a page into a target group and returns flattened ids', () => {
    const moved = moveNodeInTree(fixture, 'FORM-A', 'NAV-GROUP-2');
    const flatNodes = [];
    const walk = (nodes) => nodes.forEach((node) => {
      flatNodes.push([node.navUuid, node.parentNavUuid]);
      walk(node.children || []);
    });
    walk(moved.roots);

    expect(flatNodes).toContainEqual(['FORM-A', 'NAV-GROUP-2']);
    expect(flattenTreeIds(moved.roots)).toEqual([1, 3, 4, 5, 2]);
    expect(moved.ids).toEqual([1, 3, 4, 5, 2]);
  });

  test('reorderRootNodes places selected dashboards and forms before the remaining root items', () => {
    const withDashboards = fixture.concat([
      { id: 6, navUuid: 'PAGE-HOME', formUuid: 'PAGE-HOME', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', title: { zh_CN: '首页看板' }, listOrder: 5 },
      { id: 7, navUuid: 'PAGE-618', formUuid: 'PAGE-618', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', title: { zh_CN: '618看板' }, listOrder: 6 },
      { id: 8, navUuid: 'FORM-ORDER', formUuid: 'FORM-ORDER', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', title: { zh_CN: '订单表' }, listOrder: 7 },
    ]);
    const moved = reorderRootNodes(withDashboards, ['PAGE-HOME', 'FORM-ORDER', 'PAGE-618']);
    const visibleRootOrder = moved.roots
      .filter((node) => node.parentNavUuid === ROOT_NAV_UUID && node.navType !== 'SYSTEM')
      .map((node) => node.navUuid);

    expect(visibleRootOrder).toEqual(['PAGE-HOME', 'FORM-ORDER', 'PAGE-618', 'FORM-A', 'NAV-GROUP-1', 'NAV-GROUP-2']);
    expect(moved.orderedNavUuids).toEqual(['PAGE-HOME', 'FORM-ORDER', 'PAGE-618']);
    expect(moved.ids).toEqual([1, 6, 8, 7, 2, 3, 4, 5]);
  });

  test('reorderRootNodes rejects duplicate items', () => {
    expect(() => reorderRootNodes(fixture, ['FORM-A', 'FORM-A']))
      .toThrow('Duplicate navigation item: FORM-A');
  });

  test('autoOrderRootNodes ranks portal, custom pages, process forms, then forms', () => {
    const mixed = [
      { id: 1, navUuid: 'NAV-SYSTEM-RUNNING-UUID', parentNavUuid: ROOT_NAV_UUID, navType: 'SYSTEM', title: { zh_CN: '待我处理' }, listOrder: 0 },
      { id: 2, navUuid: 'FORM-RECEIPT', formUuid: 'FORM-RECEIPT', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', formType: 'receipt', title: { zh_CN: '访客登记表' }, listOrder: 1 },
      { id: 3, navUuid: 'PAGE-DASHBOARD', formUuid: 'PAGE-DASHBOARD', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', formType: 'display', title: { zh_CN: '数据看板' }, listOrder: 2 },
      { id: 4, navUuid: 'FORM-PROCESS', formUuid: 'FORM-PROCESS', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', formType: 'process', title: { zh_CN: '访客审批表' }, listOrder: 3 },
      { id: 5, navUuid: 'PAGE-PORTAL', formUuid: 'PAGE-PORTAL', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', formType: 'display', title: { zh_CN: '访客管理首页' }, listOrder: 4 },
      { id: 6, navUuid: 'NAV-GROUP-1', parentNavUuid: ROOT_NAV_UUID, navType: 'NAV', title: { zh_CN: '配置分组' }, listOrder: 5 },
    ];

    const ordered = autoOrderRootNodes(mixed);
    const visibleRootOrder = ordered.roots
      .filter((node) => node.parentNavUuid === ROOT_NAV_UUID && node.navType !== 'SYSTEM')
      .map((node) => node.navUuid);

    expect(visibleRootOrder).toEqual([
      'PAGE-PORTAL',
      'PAGE-DASHBOARD',
      'FORM-PROCESS',
      'FORM-RECEIPT',
      'NAV-GROUP-1',
    ]);
    expect(ordered.ids).toEqual([1, 5, 3, 4, 2, 6]);
    expect(getNavigationPriority(mixed[4])).toBe(0);
    expect(getNavigationPriority(mixed[2])).toBe(1);
    expect(getNavigationPriority(mixed[3])).toBe(2);
    expect(getNavigationPriority(mixed[1])).toBe(3);
  });

  test('moveNodeInTree rejects moving a system node', () => {
    expect(() => moveNodeInTree(fixture, 'NAV-SYSTEM-RUNNING-UUID', ROOT_NAV_UUID))
      .toThrow('System navigation nodes cannot be moved');
  });
});

describe('navigation order mutation contract', () => {
  const mixed = [
    { id: 1, navUuid: 'NAV-SYSTEM-RUNNING-UUID', parentNavUuid: ROOT_NAV_UUID, navType: 'SYSTEM', title: { zh_CN: '待我处理' }, listOrder: 0 },
    { id: 2, navUuid: 'FORM-RECEIPT', formUuid: 'FORM-RECEIPT', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', formType: 'receipt', title: { zh_CN: '访客登记表' }, listOrder: 1 },
    { id: 3, navUuid: 'PAGE-DASHBOARD', formUuid: 'PAGE-DASHBOARD', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', formType: 'display', title: { zh_CN: '数据看板' }, listOrder: 2 },
    { id: 4, navUuid: 'FORM-PROCESS', formUuid: 'FORM-PROCESS', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', formType: 'process', title: { zh_CN: '访客审批表' }, listOrder: 3 },
    { id: 5, navUuid: 'PAGE-PORTAL', formUuid: 'PAGE-PORTAL', parentNavUuid: ROOT_NAV_UUID, navType: 'PAGE', formType: 'display', title: { zh_CN: '访客管理首页' }, listOrder: 4 },
  ];

  function expectedAutoOrder() {
    const ordered = autoOrderRootNodes(mixed);
    return {
      ordered,
      list: flattenTreeNodes(ordered.roots, []),
    };
  }

  test('skips POST when the complete navigation order is already applied', async () => {
    const expected = expectedAutoOrder();
    const orderedAgain = autoOrderRootNodes(expected.list);
    const postNavAction = jest.fn();
    const fetchNavigationList = jest.fn();

    const result = await applyNavigationOrder(
      'APP_XXX',
      'auto-order',
      expected.list,
      orderedAgain,
      {},
      { postNavAction, fetchNavigationList }
    );

    expect(postNavAction).not.toHaveBeenCalled();
    expect(fetchNavigationList).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      changed: false,
      alreadyApplied: true,
      mutationPerformed: false,
      readbackVerified: true,
      sideEffectState: 'none',
    });
  });

  test('writes once and verifies the complete readback order', async () => {
    const expected = expectedAutoOrder();
    const postNavAction = jest.fn().mockResolvedValue({ success: true });
    const fetchNavigationList = jest.fn().mockResolvedValue(expected.list);

    const result = await applyNavigationOrder(
      'APP_XXX',
      'auto-order',
      mixed,
      expected.ordered,
      {},
      { postNavAction, fetchNavigationList }
    );

    expect(postNavAction).toHaveBeenCalledTimes(1);
    expect(postNavAction).toHaveBeenCalledWith(
      'APP_XXX',
      'updateOrderNew',
      expect.objectContaining({ ids: '1,5,3,4,2' }),
      {},
      { oneShot: true }
    );
    expect(fetchNavigationList).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      changed: true,
      mutationPerformed: true,
      readbackVerified: true,
      recoveredByReadback: false,
      sideEffectState: 'committed',
    });
  });

  test('recovers a lost write response when readback matches the expected order', async () => {
    const expected = expectedAutoOrder();
    const postNavAction = jest.fn().mockRejectedValue(new Error('timeout'));
    const fetchNavigationList = jest.fn().mockResolvedValue(expected.list);

    await expect(applyNavigationOrder(
      'APP_XXX',
      'auto-order',
      mixed,
      expected.ordered,
      {},
      { postNavAction, fetchNavigationList }
    )).resolves.toMatchObject({
      success: true,
      recoveredByReadback: true,
      sideEffectState: 'committed',
      readbackVerified: true,
    });
    expect(postNavAction).toHaveBeenCalledTimes(1);
  });

  test('reports a retry-safe no-write result when readback stays at the original order', async () => {
    const expected = expectedAutoOrder();
    const postNavAction = jest.fn().mockRejectedValue(new Error('timeout'));
    const fetchNavigationList = jest.fn().mockResolvedValue(mixed);

    await expect(applyNavigationOrder(
      'APP_XXX',
      'auto-order',
      mixed,
      expected.ordered,
      {},
      { postNavAction, fetchNavigationList }
    )).rejects.toMatchObject({
      code: 'NAV_ORDER_NOT_APPLIED',
      details: {
        retrySafe: true,
        sideEffectState: 'none',
        readbackVerified: true,
        orderDiff: {
          beforeCount: 5,
          expectedCount: 5,
          observedCount: 5,
          firstPlannedChange: {
            index: 1,
          },
        },
      },
    });
  });

  test('reports a non-retryable mismatch for an intermediate navigation order', async () => {
    const expected = expectedAutoOrder();
    const intermediate = [mixed[0], mixed[4], mixed[1], mixed[2], mixed[3]];
    const postNavAction = jest.fn().mockResolvedValue({ success: true });
    const fetchNavigationList = jest.fn().mockResolvedValue(intermediate);

    await expect(applyNavigationOrder(
      'APP_XXX',
      'auto-order',
      mixed,
      expected.ordered,
      {},
      { postNavAction, fetchNavigationList }
    )).rejects.toMatchObject({
      code: 'NAV_ORDER_READBACK_MISMATCH',
      details: {
        retrySafe: false,
        sideEffectState: 'unknown',
        readbackVerified: false,
        status: 'SEMANTIC_FAILURE',
        orderDiff: {
          beforeCount: 5,
          expectedCount: 5,
          observedCount: 5,
          firstPlannedChange: {
            index: 1,
          },
          firstReadbackMismatch: {
            index: 2,
          },
        },
      },
    });
  });

  test('reports an unknown non-retryable result when post-write readback fails', async () => {
    const expected = expectedAutoOrder();
    const postNavAction = jest.fn().mockRejectedValue(new Error('timeout'));
    const fetchNavigationList = jest.fn().mockRejectedValue(new Error('readback unavailable'));

    await expect(applyNavigationOrder(
      'APP_XXX',
      'auto-order',
      mixed,
      expected.ordered,
      {},
      { postNavAction, fetchNavigationList }
    )).rejects.toMatchObject({
      code: 'NAV_ORDER_RESULT_UNKNOWN',
      details: {
        retrySafe: false,
        sideEffectState: 'unknown',
        readbackVerified: false,
        nextStep: 'openyida nav-group list APP_XXX --flat',
        orderDiff: {
          beforeCount: 5,
          expectedCount: 5,
          observedCount: null,
          firstPlannedChange: {
            index: 1,
          },
        },
      },
    });
  });

  test('keeps large navigation error details focused on the first difference', async () => {
    const large = [mixed[0]].concat(Array.from({ length: 60 }, (_, index) => ({
      id: index + 10,
      navUuid: `FORM-${index}`,
      formUuid: `FORM-${index}`,
      parentNavUuid: ROOT_NAV_UUID,
      navType: 'PAGE',
      formType: 'receipt',
      title: { zh_CN: `表单 ${index}` },
      listOrder: index + 1,
    })));
    const ordered = reorderRootNodes(large, ['FORM-59']);
    const postNavAction = jest.fn().mockRejectedValue(new Error('timeout'));
    const fetchNavigationList = jest.fn().mockRejectedValue(new Error('readback unavailable'));

    let error;
    try {
      await applyNavigationOrder(
        'APP_LARGE',
        'order',
        large,
        ordered,
        {},
        { postNavAction, fetchNavigationList }
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: 'NAV_ORDER_RESULT_UNKNOWN',
      details: {
        orderDiff: {
          beforeCount: 61,
          expectedCount: 61,
          observedCount: null,
          firstPlannedChange: {
            index: 1,
          },
        },
      },
    });
    expect(error.details).not.toHaveProperty('beforeOrder');
    expect(error.details).not.toHaveProperty('expectedOrder');
    expect(error.details).not.toHaveProperty('observedOrder');
    expect(JSON.stringify(error.details)).not.toContain('FORM-30');
  });
});
