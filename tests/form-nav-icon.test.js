'use strict';

const {
  FORM_NAV_ICON_GROUPS,
  FORM_NAV_ICONS,
  inferFormNavIcon,
  normalizeFormNavIcon,
  resolveFormNavIcon,
} = require('../lib/app/create-form/nav-icon');

describe('form navigation icon catalog', () => {
  test('matches the current yida-next navigation picker catalog', () => {
    expect(FORM_NAV_ICON_GROUPS.map((group) => [group.key, group.items.length])).toEqual([
      ['defaultIcons', 31],
      ['systemIcons', 55],
    ]);
    expect(FORM_NAV_ICONS).toHaveLength(86);
    expect(new Set(FORM_NAV_ICONS.map((item) => item.name)).size).toBe(86);
    expect(FORM_NAV_ICONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'biaodan', label: '表单' }),
      expect.objectContaining({ name: 'Project', label: '项目' }),
      expect.objectContaining({ name: 'Todo', label: '任务' }),
      expect.objectContaining({ name: 'name-card', label: '名片' }),
    ]));
  });

  test('accepts explicit icon names case-insensitively and preserves canonical casing', () => {
    expect(normalizeFormNavIcon('project')).toBe('Project');
    expect(normalizeFormNavIcon('CalendarSeventeen')).toBe('CalendarSeventeen');
    expect(normalizeFormNavIcon('not-an-icon')).toBe('');
  });

  test('infers business-specific icons from the title before field labels', () => {
    expect(inferFormNavIcon('客户登记表', [{ label: '任务名称' }])).toBe('name-card');
    expect(inferFormNavIcon('项目任务表', [])).toBe('Project');
    expect(inferFormNavIcon('费用报销', [])).toBe('dingdingka');
    expect(inferFormNavIcon('考勤记录', [])).toBe('clock');
  });

  test('uses nested field semantics when the title is generic', () => {
    expect(inferFormNavIcon('信息登记', [{
      type: 'ColumnContainer',
      children: [[{ type: 'TextField', label: '会议室' }]],
    }])).toBe('huiyishi');
  });

  test('resolves auto and explicit values while reporting invalid values', () => {
    expect(resolveFormNavIcon('auto', '差旅申请', [])).toEqual({
      icon: 'airplane',
      source: 'auto',
    });
    expect(resolveFormNavIcon('todo', '普通表单', [])).toEqual({
      icon: 'Todo',
      source: 'explicit',
    });
    expect(resolveFormNavIcon('unknown', '普通表单', [])).toEqual({
      icon: '',
      source: 'invalid',
    });
  });
});
