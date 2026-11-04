'use strict';
const { buildWriteContract, prepareWriteData, compareWriteData } = require('../lib/app/form-data-contract');
const { prepareRecords } = require('../lib/core/data-seed');
const country = { value: 'CN', text: { zh_CN: '中国', en_US: 'China', type: 'i18n' } };
const second = { value: 'US', text: { zh_CN: '美国', en_US: 'United States', type: 'i18n' } };
const address = { regionIds: [110000, 110100, 110105, 110105009], address: '亚运村（测试样例）',
  regionText: [{ zh_CN: '北京' }, { zh_CN: '北京市' }, { zh_CN: '朝阳区' }, { zh_CN: '亚运村街道' }] };
const field = (componentName, fieldId, props = {}, children) => ({ componentName, props: { fieldId, validation: [], ...props }, ...(children ? { children } : {}) });
const contract = buildWriteContract({ content: { pages: [{ componentsTree: [
  field('CountrySelectField', 'country', { multiple: false }), field('CountrySelectField', 'countries', { multiple: true }),
  field('AddressField', 'address', { addressType: 'ADDRESS', countryMode: 'default' }),
  field('TableField', 'lines', {}, [field('TextField', 'name'), field('CountrySelectField', 'childCountry'), field('AddressField', 'childAddress')]),
] }] } });
const input = { country: [country], countries: [country, second], address,
  lines: [{ name: '明细', childCountry: [country], childAddress: address }] };
const observed = () => ({ country: ['中国'], country_id: ['CN'], countries: ['美国', '中国'], countries_id: '["US","CN"]', address: JSON.stringify(address),
  address_id: JSON.stringify('北京/北京市/朝阳区/亚运村街道/亚运村（测试样例）'),
  lines: [{ name: '明细', childCountry: ['中国'], childCountry_id: ['CN'], childAddress: JSON.stringify(address) }] });

test('native fixed region examples pass seed and verified-write without omission or input mutation', () => {
  const before = JSON.stringify(input), skipped = [];
  expect(prepareWriteData(input, contract)).toEqual(input);
  expect(prepareRecords([input], contract, {}, skipped)).toEqual([input]);expect(skipped).toEqual([]);
  expect(compareWriteData(input, observed(), contract)).toEqual([]);expect(JSON.stringify(input)).toBe(before);
});

test('actual create-form schema accepts every writable standard component in main and child scopes', () => {
  const { buildFormSchema } = require('../lib/app/create-form')._private;
  const ref = { appType: 'APP_TARGET', formUuid: 'FORM-TARGET', formType: 'receipt', instanceId: 'FINST-1', title: '客户甲' };
  const values = {
    TextField: '客户甲', TextareaField: '交付说明', RadioField: '选项一', SelectField: '选项一',
    CheckboxField: ['选项一'], MultiSelectField: ['选项一'], NumberField: 0, RateField: 4,
    DateField: '2026-11-04', CascadeDateField: ['2026-11-04', '2026-11-05'],
    EmployeeField: ['user-1'], DepartmentSelectField: ['123'], CountrySelectField: [country], AddressField: address,
    ImageField: [{ downloadUrl: 'https://example.test/image.webp' }],
    AttachmentField: [{ fileId: 'FILE-1', name: '说明.pdf' }], AssociationFormField: [ref],
  };
  const definitions = Object.keys(values).map(type => ({ type, label: type, options: ['选项一'], associationForm: ref }));
  const schema = buildFormSchema('标准组件', [...definitions,
    { type: 'SerialNumberField', label: '编号' },
    { type: 'TableField', label: '明细', children: definitions.map(def => ({ ...def, label: `子表${def.label}` })) },
  ], 'FORM-ALL', 'corp-test', 'APP_TEST', 'single', 'default', 'top');
  const contract = buildWriteContract({ content: schema });
  const makeRecord = parent => Object.fromEntries(contract.fields.filter(field => field.parentFieldId === parent
    && Object.hasOwn(values, field.componentType)).map(field => [field.fieldId, values[field.componentType]]));
  const table = contract.fields.find(field => field.componentType === 'TableField');
  const record = { ...makeRecord(null), [table.fieldId]: [makeRecord(table.fieldId)] };
  const skipped = [], prepared = prepareRecords([record], contract, {}, skipped)[0];
  expect(Object.keys(prepared)).toHaveLength(18);
  expect(Object.keys(prepared[table.fieldId][0])).toHaveLength(17);
  expect(skipped).toEqual([]);
  expect(compareWriteData(prepared, JSON.parse(JSON.stringify(prepared)), contract)).toEqual([]);
});
test.each([['CN'], [country, country], [{ value: 'cn', text: country.text }], [{ value: 'CN' }], [{ value: 'CN', text: {} }], [country, second]])(
  'invalid country values are rejected before write: %j', value => {
    expect(() => prepareRecords([{ country: value }], contract, {})).toThrow(expect.objectContaining({ code: 'DATA_SEED_PREFLIGHT_FAILED' }));
  });
test.each([{}, '北京', { ...address, regionIds: [] }, { ...address, regionIds: [NaN] }, { ...address, regionText: [] }, { ...address, address: 0 }])(
  'invalid addresses never disappear as optional omissions: %j', value => {
    expect(() => prepareWriteData({ address: value }, contract)).toThrow();
  });
test.each([
  row => { row.country_id = ['US']; }, row => { delete row.country_id; }, row => { row.country_id = '[bad'; },
  row => { row.address = JSON.stringify({ ...address, address: '另一个地址' }); },
  row => { row.address = JSON.stringify({ ...address, regionIds: [110000, 110100, 110106, 110106001] }); },
  row => { delete row.address; }, row => { row.address = '{bad'; },
  row => { row.lines[0].childCountry_id = ['US']; }, row => { delete row.lines[0].childAddress; },
])('incorrect, hidden or malformed region readbacks cannot pass verification', change => {
  const row = observed();change(row);expect(compareWriteData(input, row, contract).length).toBeGreaterThan(0);
});
test('country identities and region IDs tolerate native read serialization but do not use labels as IDs', () => {
  const row = observed();row.address = JSON.stringify(JSON.stringify({ ...address, regionIds: address.regionIds.map(String) }));
  row.country_id = JSON.stringify(JSON.stringify(['CN']));expect(compareWriteData(input, row, contract)).toEqual([]);
  delete row.country_id;row.country = ['CN'];expect(compareWriteData(input, row, contract)).toEqual([]);
  row.country = ['中国'];expect(compareWriteData(input, row, contract)).toHaveLength(1);
});
test('explicit empty countries use typed raw evidence, including checked subform rows', () => {
  const wanted = { country: [], lines: [{ name: '空值', childCountry: [] }] };
  const raw = [{ componentName: 'CountrySelectField', fieldId: 'country', fieldData: {} },
    { componentName: 'TableField', fieldId: 'lines', fieldData: { value: [[
      { componentName: 'TextField', fieldId: 'name', rowId: 'row-1', fieldData: { value: '空值' } },
      { componentName: 'CountrySelectField', fieldId: 'childCountry', rowId: 'row-1', fieldData: {} },
    ]] } }];
  expect(compareWriteData(wanted, { lines: [{ name: '空值' }] }, contract, raw)).toEqual([]);
  expect(compareWriteData(wanted, { lines: [{ name: '空值' }] }, contract)).toHaveLength(2);
});
test('unsupported address modes retain existing optional-field skip and strict required-field behavior', () => {
  for (const props of [{ addressType: 'LOCATION' }, { countryMode: 'international' }]) {
    const optional = buildWriteContract({ content: { pages: [{ componentsTree: [field('TextField', 'name'), field('AddressField', 'location', props)] }] } });
    const skipped = [];expect(prepareRecords([{ name: 'A', location: address }], optional, {}, skipped)).toEqual([{ name: 'A' }]);expect(skipped).toHaveLength(1);
    optional.props.location.required = true;
    expect(() => prepareRecords([{ name: 'A', location: address }], optional, {})).toThrow();
  }
});
