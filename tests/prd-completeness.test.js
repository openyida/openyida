'use strict';

const {
  evaluatePrdCompleteness,
  parseArgs,
  parsePrdMarkdown,
} = require('../lib/app/check-prd-completeness');

function formSchema(fields) {
  return {
    pages: [{
      componentsTree: [{
        componentName: 'Page',
        children: fields,
      }],
    }],
  };
}

function field(componentName, label, fieldId, props = {}) {
  return {
    componentName,
    props: {
      label,
      fieldId,
      ...props,
    },
  };
}

function canvasSchema(runtimeCode = 'var YidaComp = function Page() { return null; };') {
  return {
    pages: [{
      componentsTree: [{
        componentName: 'Page',
        children: [{
          componentName: 'YidaCodeCanvas',
          props: {
            code: 'export default function Page() { return null; }',
            runtimeCode,
          },
        }],
      }],
    }],
    actions: { module: { compiled: '', source: '' } },
  };
}

function buildPrd() {
  return `
# 销售管理 PRD

## 3. 数据结构（业务语义，不含细节 ID）

### 客户信息

| 字段名 | 字段类型 | 必填 | 默认值 / 选项 | 关联关系 | 分组 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 客户名称 | 文本 | 是 |  |  | 基础信息 | 名称 |
| 状态 | 单选 | 否 | 潜在、成交 |  | 状态 | 跟进状态 |

### 初始示例数据计划

| 表单 | 默认写入数量 | 示例记录语义 | 是否允许跳过 | 跳过条件 |
| --- | --- | --- | --- | --- |
| 客户信息 | 1 | 客户名称=星河科技，状态=潜在 | 否 |  |

## 7. 资源蓝图

| 资源 | 类型 | 用途 | 关键字段 / 功能 | 创建策略 |
| --- | --- | --- | --- | --- |
| 销售工作台 | display-page / main | 入口和概览 | 客户入口 | 创建 |
| 客户信息 | normal-form | 客户数据录入 | 客户名称、状态 | 创建 |

## 8. 资源创建顺序

| 顺序 | 资源 | 依赖原因 | 创建后记录 |
| --- | --- | --- | --- |
| 1 | 应用 | 承载资源 | appType |

## 9. 页面实现交付顺序

| 顺序 | 页面 | 实现重点 | 依赖资源 | 验收点 |
| --- | --- | --- | --- | --- |
| 1 | 销售工作台 | 首页 | 客户信息 | 能进入客户表单 |

## 10. 导航顺序

| 分组 | 页面顺序 | 导航呈现 | 放置原则 |
| --- | --- | --- | --- |
| 首页 | 销售工作台、客户信息 | 平台导航 | 第一入口放最前 |

## 11. 验收标准

| 场景 | 验收标准 |
| --- | --- |
| 数据录入 | 客户信息表单能提交并可查询 |
`;
}

describe('prd completeness check', () => {
  const forms = [
    { formUuid: 'FORM-HOME', formName: '销售工作台', formType: 'display' },
    { formUuid: 'FORM-CUSTOMER', formName: '客户信息', formType: 'receipt' },
  ];

  test('passes a targeted lightweight PRD completeness check', async () => {
    const result = await evaluatePrdCompleteness(buildPrd(), {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms)),
      fetchSchema: jest.fn((appType, formUuid) => {
        if (formUuid === 'FORM-HOME') {
          return Promise.resolve(canvasSchema());
        }
        return Promise.resolve(formSchema([
          field('TextField', '客户名称', 'textField_name', { required: true }),
          field('RadioField', '状态', 'radioField_status', {
            options: [{ label: '潜在', value: 'lead' }, { label: '成交', value: 'won' }],
          }),
        ]));
      }),
      fetchOneFormRecordCount: jest.fn(() => Promise.resolve(1)),
    });

    expect(result).toMatchObject({
      success: true,
      verdict: 'pass',
      coverage: {
        resources: '2/2',
        fields: '2/2',
        pages: '1/1',
        seedRecords: '1/1',
        navigation: 'pass',
      },
      hardFailures: [],
      warnings: [],
      manualReview: [],
    });
  });

  test('treats allowed skipped seed records as warning instead of hard failure', async () => {
    const prd = buildPrd().replace(
      '| 客户信息 | 1 | 客户名称=星河科技，状态=潜在 | 否 |  |',
      '| 客户信息 | 1 | 客户名称=星河科技，状态=潜在 | 是 | 可由用户导入 |'
    );

    const result = await evaluatePrdCompleteness(prd, {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms)),
      fetchSchema: jest.fn((appType, formUuid) => {
        if (formUuid === 'FORM-HOME') {
          return Promise.resolve(canvasSchema());
        }
        return Promise.resolve(formSchema([
          field('TextField', '客户名称', 'textField_name', { required: true }),
          field('RadioField', '状态', 'radioField_status', {
            options: [{ label: '潜在', value: 'lead' }, { label: '成交', value: 'won' }],
          }),
        ]));
      }),
      fetchOneFormRecordCount: jest.fn(() => Promise.resolve(0)),
    });

    expect(result.verdict).toBe('warning');
    expect(result.coverage.seedRecords).toBe('1/1');
    expect(result.hardFailures.map(failure => failure.code)).not.toContain('seed_record_missing');
    expect(result.warnings.map(warning => warning.code)).toContain('seed_record_skipped');
  });

  test('returns warning verdict when manual review items remain', async () => {
    const prd = buildPrd().replace(
      '| 数据录入 | 客户信息表单能提交并可查询 |',
      '| 数据录入 | 客户信息表单能提交并可查询 |\n| 视觉一致性 | 首屏体验和品牌风格一致 |'
    );

    const result = await evaluatePrdCompleteness(prd, {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms)),
      fetchSchema: jest.fn((appType, formUuid) => {
        if (formUuid === 'FORM-HOME') {
          return Promise.resolve(canvasSchema());
        }
        return Promise.resolve(formSchema([
          field('TextField', '客户名称', 'textField_name', { required: true }),
          field('RadioField', '状态', 'radioField_status', {
            options: [{ label: '潜在', value: 'lead' }, { label: '成交', value: 'won' }],
          }),
        ]));
      }),
      fetchOneFormRecordCount: jest.fn(() => Promise.resolve(1)),
    });

    expect(result.verdict).toBe('warning');
    expect(result.hardFailures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.manualReview).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'manual_acceptance_required' }),
    ]));
  });

  test('returns fail verdict with explainable hard failures without scanning all data', async () => {
    const result = await evaluatePrdCompleteness(buildPrd(), {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms.slice().reverse())),
      fetchSchema: jest.fn((appType, formUuid) => {
        if (formUuid === 'FORM-HOME') {
          return Promise.resolve(canvasSchema(''));
        }
        return Promise.resolve(formSchema([
          field('TextField', '客户名称', 'textField_name', { required: true }),
        ]));
      }),
      fetchOneFormRecordCount: jest.fn(() => Promise.resolve(0)),
    });

    const failureCodes = result.hardFailures.map(failure => failure.code);

    expect(result.verdict).toBe('fail');
    expect(result.coverage).toMatchObject({
      resources: '2/2',
      fields: '1/2',
      pages: '0/1',
      seedRecords: '0/1',
      navigation: 'fail',
    });
    expect(failureCodes).toEqual(expect.arrayContaining([
      'field_missing',
      'display_page_unpublished',
      'seed_record_missing',
      'navigation_order_mismatch',
    ]));
  });

  test('queries seed records at most once per core form', async () => {
    const fetchOneFormRecordCount = jest.fn(() => Promise.resolve(1));
    const prd = buildPrd().replace(
      '| 客户信息 | 1 | 客户名称=星河科技，状态=潜在 | 否 |  |',
      '| 客户信息 | 1 | 客户名称=星河科技，状态=潜在 | 否 |  |\n| 客户信息 | 1 | 客户名称=云栖贸易，状态=成交 | 否 |  |'
    );

    const result = await evaluatePrdCompleteness(prd, {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms)),
      fetchSchema: jest.fn((appType, formUuid) => {
        if (formUuid === 'FORM-HOME') {
          return Promise.resolve(canvasSchema());
        }
        return Promise.resolve(formSchema([
          field('TextField', '客户名称', 'textField_name', { required: true }),
          field('RadioField', '状态', 'radioField_status', {
            options: [{ label: '潜在', value: 'lead' }, { label: '成交', value: 'won' }],
          }),
        ]));
      }),
      fetchOneFormRecordCount,
    });

    expect(result.coverage.seedRecords).toBe('2/2');
    expect(fetchOneFormRecordCount).toHaveBeenCalledTimes(1);
  });

  test('parses PRD sections and keeps the command mode-less', () => {
    const parsedArgs = parseArgs(['prd/demo/prd.md', '--app-type', 'APP_XXX', '--json']);
    const parsedPrd = parsePrdMarkdown(buildPrd());

    expect(parsedArgs).toEqual({
      prdPath: 'prd/demo/prd.md',
      appType: 'APP_XXX',
      json: true,
      help: false,
    });
    expect(parsedPrd.resources.map(resource => resource.name)).toEqual(['销售工作台', '客户信息']);
    expect(parsedPrd.fields.map(item => item.label)).toEqual(['客户名称', '状态']);
    expect(parsedPrd.navigationOrder).toEqual(['销售工作台', '客户信息']);
    expect(parsedArgs).not.toHaveProperty('mode');
  });
});
