'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ROOT_NAV_UUID,
  applyNavigationPlan,
  autoOrderRootNodes,
  buildNavigationPlanState,
  buildNavigationTree,
  flattenTreeIds,
  getNavigationPriority,
  moveNodeInTree,
  normalizeNavigationPlan,
  parseArgs,
  reorderRootNodes,
  resolveNavigationPlan,
  resolveNode,
  verifyNavigationPlan,
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
    expect(parseArgs(['APP_XXX', '--plan', 'navigation-plan.json', '--dry-run'])).toEqual({
      positional: ['APP_XXX'],
      flags: {
        plan: 'navigation-plan.json',
        'dry-run': true,
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

  test('navigation plan resolves exact IDs and builds group and root order together', () => {
    const plan = normalizeNavigationPlan({
      version: 1,
      items: [
        {
          group: '分组二',
          items: [{ ref: 'FORM-A', name: '表单 A' }],
        },
        {
          group: '分组一',
          navUuid: 'NAV-GROUP-1',
          items: ['FORM-B'],
        },
      ],
    });
    const resolved = resolveNavigationPlan(fixture, plan, { requireGroups: true });
    const state = buildNavigationPlanState(fixture, resolved);

    expect(state.moves).toEqual([
      { navUuid: 'FORM-A', parentNavUuid: 'NAV-GROUP-2' },
    ]);
    expect(state.expectedOrders).toEqual([
      {
        parentNavUuid: ROOT_NAV_UUID,
        orderedNavUuids: ['NAV-GROUP-2', 'NAV-GROUP-1'],
      },
      {
        parentNavUuid: 'NAV-GROUP-2',
        orderedNavUuids: ['FORM-A'],
      },
      {
        parentNavUuid: 'NAV-GROUP-1',
        orderedNavUuids: ['FORM-B'],
      },
    ]);
    expect(state.ids).toEqual([1, 5, 2, 3, 4]);
  });

  test('navigation plan fails before mutation when a required item is missing', () => {
    const plan = {
      version: 1,
      items: [{ group: '分组一', items: ['FORM-MISSING'] }],
    };

    expect(() => resolveNavigationPlan(fixture, plan))
      .toThrow('Navigation node not found: FORM-MISSING');
  });

  test('navigation plan does not recreate a group when its declared navUuid is stale', () => {
    const plan = {
      version: 1,
      items: [{ group: '分组一', navUuid: 'NAV-MISSING', items: ['FORM-A'] }],
    };

    expect(() => resolveNavigationPlan(fixture, plan))
      .toThrow('Navigation node not found: NAV-MISSING');
  });

  test('navigation plan defers optional future pages without creating an empty group', () => {
    const resolved = resolveNavigationPlan(fixture, {
      version: 1,
      items: [
        'FORM-A',
        {
          group: '后续页面',
          items: [{ ref: 'PAGE-FUTURE', name: '后续页面', optional: true }],
        },
      ],
    });

    expect(resolved.groupsToCreate).toEqual([]);
    expect(resolved.deferred).toEqual([
      { ref: 'PAGE-FUTURE', name: '后续页面', parent: '后续页面' },
    ]);
    expect(resolved.items).toHaveLength(1);
  });

  test('navigation plan verification checks root order, group order, and parent placement', () => {
    const plan = {
      version: 1,
      items: [
        { group: '分组二', items: ['FORM-A'] },
        { group: '分组一', items: ['FORM-B'] },
      ],
    };
    const arranged = [
      fixture[0],
      fixture[4],
      { ...fixture[1], parentNavUuid: 'NAV-GROUP-2' },
      fixture[2],
      fixture[3],
    ];
    const resolved = resolveNavigationPlan(arranged, plan, { requireGroups: true });

    expect(verifyNavigationPlan(arranged, resolved)).toMatchObject({
      matched: true,
      mismatches: [],
    });
    expect(verifyNavigationPlan(fixture, resolveNavigationPlan(fixture, plan, { requireGroups: true })))
      .toMatchObject({ matched: false });
  });

  test('order plan creates groups, moves items, orders roots, and verifies the readback', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-nav-plan-'));
    const planFile = path.join(directory, 'navigation-plan.json');
    fs.writeFileSync(planFile, JSON.stringify({
      version: 1,
      items: [
        { ref: 'FORM-A', name: '表单 A' },
        { group: '数据管理', items: [{ ref: 'FORM-B', name: '表单 B' }] },
      ],
    }));

    let state = fixture.map(node => ({ ...node }));
    let nextId = 20;
    const postNavAction = jest.fn(async (appType, action, payload) => {
      expect(appType).toBe('APP-TEST');
      expect(action).toBe('updateOrderNew');
      const current = state.find(node => node.id === payload.currentId);
      current.parentNavUuid = payload.parentNavUuid;
      const byId = new Map(state.map(node => [node.id, node]));
      state = payload.ids.split(',').map(id => byId.get(Number(id)));
      return { success: true };
    });
    const dependencies = {
      fetchNavigationList: jest.fn(async () => state.map(node => ({ ...node }))),
      createGroup: jest.fn(async (appType, name) => {
        const group = {
          id: nextId++,
          navUuid: `NAV-${name}`,
          parentNavUuid: ROOT_NAV_UUID,
          navType: 'NAV',
          title: { zh_CN: name },
        };
        state.push(group);
        return { success: true, group: { ...group, name } };
      }),
      postNavAction,
    };

    try {
      const result = await applyNavigationPlan(
        'APP-TEST',
        planFile,
        {},
        { ready: true },
        dependencies
      );

      expect(result).toMatchObject({
        success: true,
        action: 'order',
        mode: 'plan',
        createdGroups: [expect.objectContaining({ name: '数据管理' })],
        movedItems: [expect.objectContaining({ navUuid: 'FORM-B' })],
        verification: { matched: true, mismatches: [] },
      });
      expect(result.orderedParents).toContain(ROOT_NAV_UUID);
      expect(postNavAction).toHaveBeenCalledTimes(2);

      const repeated = await applyNavigationPlan(
        'APP-TEST',
        planFile,
        {},
        { ready: true },
        dependencies
      );
      expect(repeated).toMatchObject({
        success: true,
        createdGroups: [],
        movedItems: [],
        orderedParents: [],
        verification: { matched: true },
      });
      expect(postNavAction).toHaveBeenCalledTimes(2);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
