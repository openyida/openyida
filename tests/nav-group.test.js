'use strict';

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://lvsumd.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const {
  parseArgs,
  buildTree,
  buildListOutput,
  moveNodeInArray,
  computeGroupTailIndex,
  parseOrderIdentifiers,
  filterVisibleNodes,
} = require('../lib/app/nav-group');

const mockCookieData = {
  cookies: [{ name: 'tianshu_csrf_token', value: 'tok123' }],
  csrf_token: 'tok123',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadCookieData.mockReturnValue(mockCookieData);
});

describe('parseArgs', () => {
  test('解析 create 参数', () => {
    expect(parseArgs(['create', 'APP_XXX', '--name', '员工奖励', '--position', '3'])).toEqual({
      subCommand: 'create',
      appType: 'APP_XXX',
      name: '员工奖励',
      group: '',
      page: '',
      to: '',
      order: '',
      position: 3,
      force: false,
    });
  });

  test('解析 delete force 参数', () => {
    expect(parseArgs(['delete', 'APP_XXX', '--group', 'NAV-123', '--force'])).toEqual({
      subCommand: 'delete',
      appType: 'APP_XXX',
      name: '',
      group: 'NAV-123',
      page: '',
      to: '',
      order: '',
      position: null,
      force: true,
    });
  });
});

describe('tree helpers', () => {
  const nodes = [
    { id: 1, navUuid: 'NAV-A', title: '工作台', navType: 'NAV', parentNavUuid: 'NAV-SYSTEM-PARENT-UUID', listOrder: 0, hidden: 'n' },
    { id: 2, navUuid: 'FORM-A', formUuid: 'FORM-A', title: 'HR 管理门户', navType: 'PAGE', parentNavUuid: 'NAV-A', listOrder: 1, hidden: 'n' },
    { id: 3, navUuid: 'NAV-B', title: '测试', navType: 'NAV', parentNavUuid: 'NAV-SYSTEM-PARENT-UUID', listOrder: 2, hidden: 'n' },
    { id: 4, navUuid: 'FORM-B', formUuid: 'FORM-B', title: '孤立页', navType: 'PAGE', parentNavUuid: 'NAV-SYSTEM-PARENT-UUID', listOrder: 3, hidden: 'n' },
    { id: 5, navUuid: 'SYS-1', title: '待我处理', navType: 'SYSTEM', parentNavUuid: 'NAV-SYSTEM-PARENT-UUID', listOrder: 4, hidden: 'n' },
    { id: 6, navUuid: 'FORM-C', formUuid: 'FORM-C', title: '隐藏页', navType: 'PAGE', parentNavUuid: 'NAV-B', listOrder: 5, hidden: 'y' },
  ];

  test('buildTree 只保留可见节点并按 parentNavUuid 组装', () => {
    const tree = buildTree(nodes);
    expect(tree.groups).toHaveLength(2);
    expect(tree.groups[0].title).toBe('工作台');
    expect(tree.groups[0].children).toHaveLength(1);
    expect(tree.groups[0].children[0].title).toBe('HR 管理门户');
    expect(tree.ungrouped).toHaveLength(1);
    expect(tree.ungrouped[0].title).toBe('孤立页');
  });

  test('buildListOutput 返回稳定 JSON 结构', () => {
    expect(buildListOutput('APP_XXX', nodes)).toEqual({
      appType: 'APP_XXX',
      groups: [
        {
          id: 1,
          navUuid: 'NAV-A',
          title: '工作台',
          listOrder: 0,
          children: [
            {
              id: 2,
              navUuid: 'FORM-A',
              formUuid: 'FORM-A',
              title: 'HR 管理门户',
              navType: 'PAGE',
              listOrder: 1,
            },
          ],
        },
        {
          id: 3,
          navUuid: 'NAV-B',
          title: '测试',
          listOrder: 2,
          children: [],
        },
      ],
      ungrouped: [
        {
          id: 4,
          navUuid: 'FORM-B',
          formUuid: 'FORM-B',
          title: '孤立页',
          navType: 'PAGE',
          listOrder: 3,
        },
      ],
    });
  });

  test('filterVisibleNodes 过滤 hidden 和 SYSTEM', () => {
    expect(filterVisibleNodes(nodes).map((node) => node.navUuid)).toEqual(['NAV-A', 'FORM-A', 'NAV-B', 'FORM-B']);
  });
});

describe('ordering helpers', () => {
  const nodes = [
    { navUuid: 'NAV-A', parentNavUuid: 'NAV-SYSTEM-PARENT-UUID', navType: 'NAV' },
    { navUuid: 'FORM-A1', parentNavUuid: 'NAV-A', navType: 'PAGE' },
    { navUuid: 'FORM-A2', parentNavUuid: 'NAV-A', navType: 'PAGE' },
    { navUuid: 'NAV-B', parentNavUuid: 'NAV-SYSTEM-PARENT-UUID', navType: 'NAV' },
    { navUuid: 'FORM-B1', parentNavUuid: 'NAV-B', navType: 'PAGE' },
  ];

  test('computeGroupTailIndex 找到分组尾部位置', () => {
    expect(computeGroupTailIndex(nodes, 'NAV-A')).toBe(3);
    expect(computeGroupTailIndex(nodes, 'NAV-B')).toBe(5);
  });

  test('moveNodeInArray 按目标位置移动节点', () => {
    expect(moveNodeInArray(nodes, 'FORM-B1', 1).map((node) => node.navUuid)).toEqual([
      'NAV-A', 'FORM-B1', 'FORM-A1', 'FORM-A2', 'NAV-B',
    ]);
  });

  test('parseOrderIdentifiers 解析排序 JSON', () => {
    expect(parseOrderIdentifiers('["NAV-A","FORM-B1"]')).toEqual(['NAV-A', 'FORM-B1']);
  });
});
