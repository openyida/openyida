'use strict';

const { groupFieldsByGroup: groupFields } = require('../lib/app/services/form-compiler');
const legacy = require('../lib/app/create-form')._private;

function findForm(value) {
  if (!value || typeof value !== 'object') {return undefined;}
  if (value.componentName === 'FormContainer' && Array.isArray(value.children)) {return value;}
  return Object.values(value).map(findForm).find(Boolean);
}

test.each([['legacy create', legacy]])('%s generates three groups from visible Dividers', (_, api) => {
  const fields = [
    { type: 'Divider', title: '基本信息' }, { type: 'TextField', label: '名称' },
    { type: 'Divider', title: '跟进' }, { type: 'TextField', label: '负责人' },
    { type: 'Divider', title: '其他' }, { type: 'TextareaField', label: '备注' },
  ];
  const form = findForm(api.buildFormSchema('分组测试', fields, 'FORM_TEST', 'corp', 'APP_TEST', 'section'));
  expect(form.children.map(group => group.props.title.zh_CN)).toEqual(['基本信息', '跟进', '其他']);
  expect(form.children.map(group => group.children.map(child => child.componentName)))
    .toEqual([['Divider', 'TextField'], ['Divider', 'TextField'], ['Divider', 'TextareaField']]);
});

test('explicit groups, hidden dividers and table contents retain their existing boundaries', () => {
  const fields = [
    { type: 'TextField', label: '甲' },
    { type: 'Divider', title: '隐藏', behavior: 'HIDDEN' },
    { type: 'TextField', label: '乙', group: '显式' },
    { type: 'TableField', label: '明细', children: [{ type: 'Divider', title: '子表' }] },
    { type: 'TextField', label: '丙', group: '显式' },
  ];
  const groups = groupFields(fields);
  expect(groups.map(group => group.groupName)).toEqual(['基本信息', '显式']);
  expect(groups[0].fields).toEqual([fields[0], fields[1], fields[3]]);
  expect(groups[1].fields).toEqual([fields[2], fields[4]]);
});

test('adjacent or repeated Divider titles keep field order and independent boundaries', () => {
  const fields = [{ type: 'Divider', title: '同名' }, { type: 'Divider', title: '同名' }, { type: 'TextField', label: '姓名' }];
  expect(groupFields(fields).map(group => group.fields)).toEqual([[fields[0]], [fields[1], fields[2]]]);
});
