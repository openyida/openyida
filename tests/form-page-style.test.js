'use strict';

const { _private: createForm } = require('../lib/app/create-form');
const formCompiler = require('../lib/app/services/form-compiler');

describe('新建表单页面样式', () => {
  const args = ['主题表单', [], 'FORM-TEST', 'CORP-TEST', 'APP-TEST'];

  test.each([
    ['CLI 创建', () => createForm.buildFormSchema(...args)],
    ['CLI 空表单', () => createForm.buildEmptyFormSchema()],
    ['离线编译', () => formCompiler.buildFormSchema(...args)],
    ['离线空表单', () => formCompiler.buildEmptyFormSchema()],
  ])('%s 使用结构化背景且不写入页面 CSS/HTML', (name, build) => {
    const schema = JSON.parse(JSON.stringify(build()));
    const page = schema.pages[0].componentsTree[0];

    expect(page.props.pageStyle).toEqual({ backgroundColor: 'transparent' });
    expect(page).not.toHaveProperty('css');
    expect(page).not.toHaveProperty('html');
    expect(page.props.contentBgColor).toBe('white');
    expect(page.props.contentBgColorMobile).toBe('white');
  });

  test('各表单持有独立的样式对象，编辑不会污染后续默认值', () => {
    const first = formCompiler.buildFormSchema(...args);
    first.pages[0].componentsTree[0].props.pageStyle.backgroundColor = '#123456';

    const next = formCompiler.buildEmptyFormSchema();
    expect(next.pages[0].componentsTree[0].props.pageStyle.backgroundColor).toBe('transparent');
  });
});
