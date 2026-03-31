'use strict';

const {
  buildFilterFieldDef,
  buildFilterFieldListItem,
  buildSelectFilter,
  injectFilterLinkage,
} = require('../lib/report/filter-builder');

// ── buildFilterFieldDef ───────────────────────────────────────────────────────

describe('buildFilterFieldDef', () => {
  test('返回正确的字段结构', () => {
    const result = buildFilterFieldDef(
      'FORM-ABC123',
      'f_status',
      { type: 'i18n', zh_CN: '项目状态' },
      'selectField_status',
      'STRING'
    );
    expect(result.alias).toBe('f_status');
    expect(result.dataType).toBe('STRING');
    expect(result.aggregateType).toBe('NONE');
    expect(result.timeGranularityType).toBeNull();
  });

  test('cubeCode 中的连字符自动转换为下划线', () => {
    const result = buildFilterFieldDef(
      'FORM-E4CA4FA5DC44463D85C0CAC3799DC27EEUS7',
      'f_status',
      '项目状态',
      'selectField_status',
      'STRING'
    );
    expect(result.cubeCode).toBe('FORM_E4CA4FA5DC44463D85C0CAC3799DC27EEUS7');
    expect(result.classifiedCode).toBe('FORM_E4CA4FA5DC44463D85C0CAC3799DC27EEUS7');
  });

  test('selectField_ 的 fieldCode 自动添加 _value 后缀', () => {
    const result = buildFilterFieldDef(
      'FORM-ABC',
      'f_status',
      '项目状态',
      'selectField_status',
      'STRING'
    );
    expect(result.fieldCode).toBe('selectField_status_value');
  });

  test('textField_ 的 fieldCode 不添加 _value 后缀', () => {
    const result = buildFilterFieldDef(
      'FORM-ABC',
      'f_name',
      '项目名称',
      'textField_name',
      'STRING'
    );
    expect(result.fieldCode).toBe('textField_name');
  });
});

// ── buildFilterFieldListItem ──────────────────────────────────────────────────

describe('buildFilterFieldListItem', () => {
  test('返回与 buildFilterFieldDef 相同结构的对象', () => {
    const defResult = buildFilterFieldDef('FORM-ABC', 'f_status', '项目状态', 'selectField_status', 'STRING');
    const listResult = buildFilterFieldListItem('FORM-ABC', 'f_status', '项目状态', 'selectField_status', 'STRING');
    expect(listResult).toEqual(defResult);
  });

  test('包含所有必要字段', () => {
    const result = buildFilterFieldListItem('FORM-ABC', 'f_priority', '优先级', 'selectField_priority', 'STRING');
    expect(result).toHaveProperty('cubeCode');
    expect(result).toHaveProperty('isDim');
    expect(result).toHaveProperty('alias');
    expect(result).toHaveProperty('aliasName');
    expect(result).toHaveProperty('classifiedCode');
    expect(result).toHaveProperty('fieldCode');
    expect(result).toHaveProperty('dataType');
    expect(result).toHaveProperty('aggregateType');
    expect(result).toHaveProperty('timeGranularityType');
  });
});

// ── buildSelectFilter ─────────────────────────────────────────────────────────

describe('buildSelectFilter', () => {
  const filterDef = {
    title: '项目状态',
    cubeCode: 'FORM-ABC123',
    mockData: [{ label: '进行中', value: '进行中' }],
  };
  const valueFieldDef = { fieldCode: 'selectField_status', aliasName: '项目状态', dataType: 'STRING' };
  const labelFieldDef = { fieldCode: 'selectField_status', aliasName: '项目状态', dataType: 'STRING' };

  test('返回正确的 componentName', () => {
    const result = buildSelectFilter(filterDef, valueFieldDef, labelFieldDef, {}, 'tenant123');
    expect(result.componentName).toBe('YoushuSelectFilter');
  });

  test('包含 id 和 props', () => {
    const result = buildSelectFilter(filterDef, valueFieldDef, labelFieldDef, {}, 'tenant123');
    expect(result.id).toBeDefined();
    expect(result.props).toBeDefined();
  });

  test('props 包含 dataSetModelMap.selectFilter', () => {
    const result = buildSelectFilter(filterDef, valueFieldDef, labelFieldDef, {}, 'tenant123');
    expect(result.props.dataSetModelMap).toBeDefined();
    expect(result.props.dataSetModelMap.selectFilter).toBeDefined();
  });

  test('selectFilter 的 cubeCode 连字符转为下划线', () => {
    const result = buildSelectFilter(filterDef, valueFieldDef, labelFieldDef, {}, 'tenant123');
    const selectFilter = result.props.dataSetModelMap.selectFilter;
    expect(selectFilter.dataViewQueryModel.cubeCode).toBe('FORM_ABC123');
  });

  test('mockData 正确传入', () => {
    const result = buildSelectFilter(filterDef, valueFieldDef, labelFieldDef, {}, 'tenant123');
    const mockEntry = result.props.mockData[0];
    expect(mockEntry.data.data).toEqual([{ label: '进行中', value: '进行中' }]);
  });

  test('componentTitle 使用 filterDef.title', () => {
    const result = buildSelectFilter(filterDef, valueFieldDef, labelFieldDef, {}, 'tenant123');
    expect(result.props.componentTitle.zh_CN).toBe('项目状态');
  });

  test('无 title 时使用默认值"筛选器"', () => {
    const result = buildSelectFilter(
      { cubeCode: 'FORM-ABC' },
      valueFieldDef,
      labelFieldDef,
      {},
      'tenant123'
    );
    expect(result.props.componentTitle.zh_CN).toBe('筛选器');
  });

  test('多次调用生成不同的 id（唯一性）', () => {
    const ids = new Set(
      Array.from({ length: 10 }, () =>
        buildSelectFilter(filterDef, valueFieldDef, labelFieldDef, {}, 'tenant123').id
      )
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});

// ── injectFilterLinkage ───────────────────────────────────────────────────────

// injectFilterLinkage 签名：(dataSetModelMap, filterMeta, filterFieldCode, cubeCode, cubeTenantId)
// filterKey 由函数内部随机生成，paramId 由 filterMeta.filterNodeId 派生

function buildMockFilterMeta() {
  return {
    filterNodeId: 'node_filter_abc123',
    valueFieldAliasName: '项目状态',
  };
}

describe('injectFilterLinkage', () => {
  test('向 dataViewQueryModel.filterList 注入联动配置', () => {
    const dataSetModelMap = {
      dataset_1: {
        dataViewQueryModel: {
          fieldDefinitionList: [],
          filterList: [],
        },
        filterList: [],
      },
    };
    const result = injectFilterLinkage(
      dataSetModelMap,
      buildMockFilterMeta(),
      'selectField_status',
      'FORM-ABC',
      'tenant123'
    );
    expect(result.dataset_1.dataViewQueryModel.filterList).toHaveLength(1);
  });

  test('注入的 filterKey 格式为 filter-xxxx-xxxx-xxxx-xxxx', () => {
    const dataSetModelMap = {
      dataset_1: {
        dataViewQueryModel: { fieldDefinitionList: [], filterList: [] },
        filterList: [],
      },
    };
    const result = injectFilterLinkage(
      dataSetModelMap,
      buildMockFilterMeta(),
      'selectField_status',
      'FORM-ABC',
      'tenant123'
    );
    const injected = result.dataset_1.dataViewQueryModel.filterList[0];
    expect(injected.filterKey).toMatch(/^filter-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
  });

  test('注入的 paramId 包含 filterNodeId', () => {
    const dataSetModelMap = {
      dataset_1: {
        dataViewQueryModel: { fieldDefinitionList: [], filterList: [] },
        filterList: [],
      },
    };
    const result = injectFilterLinkage(
      dataSetModelMap,
      buildMockFilterMeta(),
      'selectField_status',
      'FORM-ABC',
      'tenant123'
    );
    const injected = result.dataset_1.dataViewQueryModel.filterList[0];
    expect(injected.paramId).toContain('node_filter_abc123');
  });

  test('dataViewQueryModel.filterList 条目包含 filterType 和 conditionType', () => {
    const dataSetModelMap = {
      dataset_1: {
        dataViewQueryModel: { fieldDefinitionList: [], filterList: [] },
        filterList: [],
      },
    };
    const result = injectFilterLinkage(
      dataSetModelMap,
      buildMockFilterMeta(),
      'selectField_status',
      'FORM-ABC',
      'tenant123'
    );
    const injected = result.dataset_1.dataViewQueryModel.filterList[0];
    expect(injected.filterType).toBe('relate');
    expect(injected.conditionType).toBe('EqualTo');
    expect(injected.value).toBeNull();
  });

  test('ds.filterList 条目包含 fieldInfo（含字段元信息）', () => {
    const dataSetModelMap = {
      dataset_1: {
        dataViewQueryModel: { fieldDefinitionList: [], filterList: [] },
        filterList: [],
      },
    };
    const result = injectFilterLinkage(
      dataSetModelMap,
      buildMockFilterMeta(),
      'selectField_status',
      'FORM-ABC',
      'tenant123'
    );
    const dsFilterEntry = result.dataset_1.filterList[0];
    expect(dsFilterEntry.fieldInfo).toBeDefined();
    expect(dsFilterEntry.filterType).toBe('relate');
    expect(dsFilterEntry.conditionType).toBe('EqualTo');
  });

  test('同时向 fieldDefinitionList 追加筛选引用字段', () => {
    const dataSetModelMap = {
      dataset_1: {
        dataViewQueryModel: { fieldDefinitionList: [], filterList: [] },
        filterList: [],
      },
    };
    const result = injectFilterLinkage(
      dataSetModelMap,
      buildMockFilterMeta(),
      'selectField_status',
      'FORM-ABC',
      'tenant123'
    );
    expect(result.dataset_1.dataViewQueryModel.fieldDefinitionList).toHaveLength(1);
  });

  test('返回修改后的 dataSetModelMap 引用（原地修改）', () => {
    const dataSetModelMap = {
      dataset_1: {
        dataViewQueryModel: { fieldDefinitionList: [], filterList: [] },
        filterList: [],
      },
    };
    const result = injectFilterLinkage(
      dataSetModelMap,
      buildMockFilterMeta(),
      'selectField_status',
      'FORM-ABC',
      'tenant123'
    );
    expect(result).toBe(dataSetModelMap);
  });
});
