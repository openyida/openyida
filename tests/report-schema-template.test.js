'use strict';

const {
  buildDataViewQueryModel,
  buildFieldDefinition,
  buildFilterItem,
  buildOrderByItem,
  buildDataSetEntry,
  buildSchema,
} = require('../lib/report/schema-template');

// ── buildDataViewQueryModel ───────────────────────────────────────────────────

describe('buildDataViewQueryModel', () => {
  test('无参数时返回带默认值的结构', () => {
    const result = buildDataViewQueryModel();
    expect(result).toEqual({
      cubeCode: '',
      fieldDefinitionList: [],
      fieldList: [],
      filterList: [],
      orderByList: [],
    });
  });

  test('传入参数时正确赋值', () => {
    const result = buildDataViewQueryModel({
      cubeCode: 'FORM_ABC123',
      fieldDefinitionList: [{ alias: 'f1' }],
      filterList: [{ filterKey: 'filter-xxx', alias: 'f1' }],
    });
    expect(result.cubeCode).toBe('FORM_ABC123');
    expect(result.fieldDefinitionList).toHaveLength(1);
    expect(result.filterList).toHaveLength(1);
    expect(result.filterList[0].filterKey).toBe('filter-xxx');
  });
});

// ── buildFieldDefinition ──────────────────────────────────────────────────────

describe('buildFieldDefinition', () => {
  test('无参数时返回带默认值的结构', () => {
    const result = buildFieldDefinition();
    expect(result.isDim).toBe(false);
    expect(result.dataType).toBe('STRING');
    expect(result.aggregateType).toBe('NONE');
    expect(result.timeGranularityType).toBeNull();
  });

  test('aliasName 为空时用 alias 填充', () => {
    const result = buildFieldDefinition({ alias: 'field_abc', aliasName: '' });
    expect(result.aliasName).toBe('field_abc');
  });

  test('fieldCode 为空时用 alias 填充', () => {
    const result = buildFieldDefinition({ alias: 'field_abc', fieldCode: '' });
    expect(result.fieldCode).toBe('field_abc');
  });

  test('传入完整参数时正确赋值', () => {
    const result = buildFieldDefinition({
      cubeCode: 'FORM_ABC',
      alias: 'f_status',
      aliasName: '项目状态',
      fieldCode: 'selectField_status',
      dataType: 'STRING',
      aggregateType: 'COUNT',
    });
    expect(result.cubeCode).toBe('FORM_ABC');
    expect(result.alias).toBe('f_status');
    expect(result.aliasName).toBe('项目状态');
    expect(result.aggregateType).toBe('COUNT');
  });
});

// ── buildFilterItem ───────────────────────────────────────────────────────────

describe('buildFilterItem', () => {
  test('无参数时返回带默认值的结构', () => {
    const result = buildFilterItem();
    expect(result.filterKey).toBe('');
    expect(result.alias).toBe('');
    expect(result.conditionType).toBe('EqualTo');
    expect(result.value).toBeNull();
  });

  test('filterKey 为空时用 alias 填充', () => {
    const result = buildFilterItem({ alias: 'f_status', filterKey: '' });
    expect(result.filterKey).toBe('f_status');
  });

  test('传入 filterKey 时优先使用 filterKey', () => {
    const result = buildFilterItem({ filterKey: 'filter-uuid-xxx', alias: 'f_status' });
    expect(result.filterKey).toBe('filter-uuid-xxx');
  });

  test('传入 value 时正确赋值', () => {
    const result = buildFilterItem({ filterKey: 'filter-xxx', alias: 'f_status', value: ['已完成'] });
    expect(result.value).toEqual(['已完成']);
  });
});

// ── buildOrderByItem ──────────────────────────────────────────────────────────

describe('buildOrderByItem', () => {
  test('默认排序方向为 ASC', () => {
    const result = buildOrderByItem('f_date');
    expect(result.alias).toBe('f_date');
    expect(result.orderType).toBe('ASC');
  });

  test('可以指定 DESC 排序', () => {
    const result = buildOrderByItem('f_count', 'DESC');
    expect(result.orderType).toBe('DESC');
  });
});

// ── buildDataSetEntry ─────────────────────────────────────────────────────────

describe('buildDataSetEntry', () => {
  test('无参数时返回带默认值的结构', () => {
    const result = buildDataSetEntry();
    expect(result.limit).toBe(1000);
    expect(result.dataViewQueryModel).toBeDefined();
    expect(result.dataViewQueryModel.cubeCode).toBe('');
  });

  test('包含 dataViewQueryModel 嵌套结构', () => {
    const result = buildDataSetEntry({
      cubeCode: 'FORM_ABC',
      fieldDefinitionList: [{ alias: 'f1' }],
    });
    expect(result.dataViewQueryModel.cubeCode).toBe('FORM_ABC');
    expect(result.dataViewQueryModel.fieldDefinitionList).toHaveLength(1);
  });

  test('传入 valueField/labelField/defaultValue 时包含在结果中', () => {
    const result = buildDataSetEntry({
      valueField: { fieldCode: 'selectField_status' },
      labelField: { fieldCode: 'textField_name' },
      defaultValue: '全部',
    });
    expect(result.valueField).toBeDefined();
    expect(result.labelField).toBeDefined();
    expect(result.defaultValue).toBe('全部');
  });

  test('不传 valueField 时结果中不包含该字段', () => {
    const result = buildDataSetEntry({ cubeCode: 'FORM_ABC' });
    expect(result).not.toHaveProperty('valueField');
    expect(result).not.toHaveProperty('labelField');
    expect(result).not.toHaveProperty('defaultValue');
  });

  test('可以自定义 limit', () => {
    const result = buildDataSetEntry({ limit: 500 });
    expect(result.limit).toBe(500);
  });
});

// ── buildSchema.simpleIndicatorCard ──────────────────────────────────────────

describe('buildSchema.simpleIndicatorCard', () => {
  test('返回正确的 componentName', () => {
    const result = buildSchema.simpleIndicatorCard();
    expect(result.componentName).toBe('YoushuSimpleIndicatorCard');
  });

  test('自动生成 componentId', () => {
    const result = buildSchema.simpleIndicatorCard();
    expect(typeof result.componentId).toBe('string');
    expect(result.componentId.length).toBeGreaterThan(0);
  });

  test('可以传入自定义 componentId', () => {
    const result = buildSchema.simpleIndicatorCard({ componentId: 'my-indicator' });
    expect(result.componentId).toBe('my-indicator');
  });

  test('settings 包含默认的 columnCount', () => {
    const result = buildSchema.simpleIndicatorCard();
    expect(result.props.settings.columnCount).toBe(4);
    expect(result.props.settings.columnCountForH5).toBe(2);
  });

  test('settings 可以被覆盖', () => {
    const result = buildSchema.simpleIndicatorCard({ settings: { columnCount: 2 } });
    expect(result.props.settings.columnCount).toBe(2);
  });
});

// ── buildSchema.lineChart ─────────────────────────────────────────────────────

describe('buildSchema.lineChart', () => {
  test('返回正确的 componentName', () => {
    const result = buildSchema.lineChart();
    expect(result.componentName).toBe('YoushuLineChart');
  });

  test('settings 包含默认的 height 和 smooth', () => {
    const result = buildSchema.lineChart();
    expect(result.props.settings.height).toBe(300);
    expect(result.props.settings.smooth).toBe(false);
  });

  test('settings 可以被覆盖', () => {
    const result = buildSchema.lineChart({ settings: { smooth: true, height: 400 } });
    expect(result.props.settings.smooth).toBe(true);
    expect(result.props.settings.height).toBe(400);
  });
});

// ── buildSchema.pieChart ──────────────────────────────────────────────────────

describe('buildSchema.pieChart', () => {
  test('返回正确的 componentName', () => {
    const result = buildSchema.pieChart();
    expect(result.componentName).toBe('YoushuPieChart');
  });

  test('settings 包含默认的 innerRadius', () => {
    const result = buildSchema.pieChart();
    expect(result.props.settings.innerRadius).toBe(0);
  });

  test('labelConfig 默认 showLabel 为 true', () => {
    const result = buildSchema.pieChart();
    expect(result.props.settings.labelConfig.showLabel).toBe(true);
  });
});

// ── buildSchema.groupedBarChart ───────────────────────────────────────────────

describe('buildSchema.groupedBarChart', () => {
  test('返回正确的 componentName', () => {
    const result = buildSchema.groupedBarChart();
    expect(result.componentName).toBe('YoushuGroupedBarChart');
  });

  test('settings 包含默认的 isStack', () => {
    const result = buildSchema.groupedBarChart();
    expect(result.props.settings.isStack).toBe(false);
  });
});

// ── 多次调用 componentId 唯一性 ───────────────────────────────────────────────

describe('buildSchema componentId 唯一性', () => {
  test('多次调用 lineChart 生成不同的 componentId', () => {
    const ids = new Set(
      Array.from({ length: 10 }, () => buildSchema.lineChart().componentId)
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  test('多次调用 pieChart 生成不同的 componentId', () => {
    const ids = new Set(
      Array.from({ length: 10 }, () => buildSchema.pieChart().componentId)
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});
