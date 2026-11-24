'use strict';

const { buildCardConfig, assertCapacity, TYPES } = require('../lib/app/data-card-builder');
const schema = () => ({ config: { keep: 'unknown' }, pages: [{ componentsTree: [{ componentName: 'Page', children: [
  { componentName: 'RootHeader' }, { componentName: 'RootContent', props: { rglSwitch: true } }, { componentName: 'RootFooter' },
] }] }] });
const field = (fieldId, aggregate = 'NONE', extra = {}) => ({ fieldId, aggregate, ...extra });
const sources = [{ componentName: 'TextField', props: { fieldId: 'textField_id', label: '编号' } },
  { componentName: 'SelectField', props: { fieldId: 'selectField_region', label: '区域' } },
  { componentName: 'NumberField', props: { fieldId: 'numberField_amount', label: '金额' } },
  { componentName: 'DateField', props: { fieldId: 'dateField_time', label: '日期' } },
  { componentName: 'TableField', props: { fieldId: 'tableField_lines' }, children: [
    { componentName: 'NumberField', props: { fieldId: 'numberField_child' } },
  ] }];
function client() { return { getAuthRef: () => ({ corpId: 'ding-test' }), get: jest.fn(async () => ({ success: true,
  content: JSON.stringify({ pages: [{ componentsTree: [{ componentName: 'Page', children: sources }] }] }) })), postFormOnce: jest.fn() }; }
function chart(type, overrides = {}) {
  const dimensions = field('selectField_region'), measure = field('numberField_amount', 'SUM');
  const roles = {
    analysis: { xField: dimensions, yField: [measure] },
    indicator: { kpi: [measure, field('numberField_amount', 'AVG')] },
    bar: { xField: dimensions, yField: [measure] }, line: { xField: field('dateField_time'), yField: [measure] },
    pie: { xField: dimensions, yField: [measure] }, table: { columnFields: [dimensions, field('numberField_amount')] },
    combo: { xField: field('dateField_time'), leftYFields: [measure], rightYFields: [field('numberField_amount', 'AVG')] },
    gauge: { valueField: measure }, funnel: { xField: dimensions, yField: [measure] },
    calendarheatmap: { xField: field('dateField_time', 'NONE', { timeGranularity: 'MONTH' }), yField: [measure] },
  };
  return { type, title: '评测' + type, formUuid: 'FORM-source', ...roles[type], ...overrides };
}
test.each(TYPES)('builds %s with real bindings, native registration and a complete full-width layout', async type => {
  const c = client(), original = schema();
  const result = await buildCardConfig(original, { charts: [chart(type)] }, c, 'APP_TEST');
  const content = result.pages[0].componentsTree[0].children[1];
  expect(result.config.keep).toBe('unknown');
  expect(content.children).toHaveLength(1);
  const node = content.children[0], ds = Object.values(node.props.dataSetModelMap)[0];
  expect(ds.dataViewQueryModel.cubeTenantId).toBe('ding-test');
  expect(ds.dataViewQueryModel.fieldDefinitionList.every(f => f.fieldCode && f.alias)).toBe(true);
  expect(content.props.layout[0]).toMatchObject({ x: 0, y: 0, w: type === 'table' ? 6 : 3, i: node.props.fieldId });
  expect(result.pages[0].componentsMap.some(entry => entry.componentName === node.componentName)).toBe(true);
  expect(original.pages[0].componentsTree[0].children[1].children).toBeUndefined();
  expect(c.get).toHaveBeenCalledTimes(1);
  expect(c.postFormOnce).not.toHaveBeenCalled();
});
test('counts existing and new charts together before fetching source data', async () => {
  const c = client();
  await expect(buildCardConfig(schema(), { charts: Array.from({ length: 6 }, () => chart('bar')) }, c, 'APP_TEST'))
    .rejects.toMatchObject({ code: 'DATA_CARD_COMPONENT_LIMIT', details: { count: 6 } });
  expect(c.get).not.toHaveBeenCalled();
  const s = schema();s.pages[0].componentsTree[0].children[1].children = Array.from({ length: 6 }, () => ({ componentName: 'YoushuTable' }));
  expect(() => assertCapacity(s)).toThrow(expect.objectContaining({ code: 'DATA_CARD_COMPONENT_LIMIT' }));
});
test('gauge ranges and six-column tables express actual units and readable widths', async () => {
  const result = await buildCardConfig(schema(), { charts: [chart('gauge', { range: { min: 0, max: 100 } }), chart('table', { w: 6 })] }, client(), 'APP_TEST');
  const content = result.pages[0].componentsTree[0].children[1];
  expect(content.children[0].props.settings.tick).toMatchObject({ min: 0, max: 100 });
  expect(content.props.layout[1].w).toBe(6);
  await expect(buildCardConfig(schema(), { charts: [chart('gauge', { range: { min: 100, max: 0 } })] }, client(), 'APP_TEST')).rejects.toMatchObject({ code: 'DATA_CARD_INVALID_CONFIG' });
});
test('generates native filter header and matching references without temporary builder metadata', async () => {
  const c = client();const result = await buildCardConfig(schema(), { charts: [chart('bar'), chart('table')], filters: [
    { type: 'select', title: '区域筛选', formUuid: 'FORM-source', fieldId: 'selectField_region', linkTo: [0, 1] },
  ] }, c, 'APP_TEST');
  const root = result.pages[0].componentsTree[0];
  const header = root.children[0].children[0];
  expect(header.props.showTitle).toBe(false);
  const filter = header.children[0].children[0].children[0];
  expect(filter.componentName).toBe('YoushuSelectFilter');
  expect(filter.__filterMeta__).toBeUndefined();
  for (const node of root.children[1].children) {
    const ds = Object.values(node.props.dataSetModelMap)[0];
    expect(ds.dataViewQueryModel.filterList[0].paramId).toBe(filter.id + '-selectFilter');
    expect(ds.filterList[0].paramId).toBe(filter.id + '-selectFilter');
    expect(ds.dataViewQueryModel.fieldDefinitionList.some(f => f.alias === ds.dataViewQueryModel.filterList[0].alias)).toBe(true);
  }
});
test('does not link a filter to another form merely because field titles match', async () => {
  const c = client();
  await expect(buildCardConfig(schema(), { charts: [chart('bar', { formUuid: 'FORM-other' })], filters: [
    { type: 'select', title: '区域', formUuid: 'FORM-source', fieldId: 'selectField_region', linkTo: [0] },
  ] }, c, 'APP_TEST')).rejects.toMatchObject({ code: 'DATA_CARD_INVALID_CONFIG' });
});
test.each([
  chart('pivot'), chart('bar', { appTag: 'override' }), chart('bar', { w: 7 }),
  chart('bar', { xField: field('selectField_region', 'SUM') }),
  chart('line', { xField: field('dateField_time', 'NONE', { timeGranularity: 'WEEK' }) }),
  chart('calendarheatmap', { xField: field('textField_id') }),
  chart('indicator', { kpi: [field('numberField_child', 'SUM')] }),
  chart('indicator', { kpi: [field('textField_id', 'SUM')] }),
  chart('gauge', { valueField: [field('numberField_amount', 'SUM'), field('numberField_amount', 'AVG')] }),
])('rejects unsupported or misleading configurations before any card write %j', async value => {
  const c = client();
  await expect(buildCardConfig(schema(), { charts: [value] }, c, 'APP_TEST')).rejects.toBeInstanceOf(Error);
  expect(c.postFormOnce).not.toHaveBeenCalled();
});
test('cannot silently replace or extend an existing filter graph', async () => {
  const c = client(), s = schema();s.pages[0].componentsTree[0].children[0].children = [{ componentName: 'YoushuPageHeader' }];
  await expect(buildCardConfig(s, { charts: [chart('bar')], filters: [
    { type: 'select', title: '区域', formUuid: 'FORM-source', fieldId: 'selectField_region' },
  ] }, c, 'APP_TEST')).rejects.toMatchObject({ code: 'DATA_CARD_INVALID_CONFIG' });
});
