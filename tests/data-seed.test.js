'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, prepareRecords, validateArguments } = require('../lib/core/data-seed');
const { buildWriteContract } = require('../lib/app/form-data-contract');

const field = (type, id, props = {}, children) => ({ componentName: type,
  props: { fieldId: id, ...props }, ...(children ? { children } : {}) });
const schema = { content: { pages: [{ componentAlias: { items: [
  { fieldId: 'textField_customer', alias: 'customer' },
  { fieldId: 'dateField_due', alias: 'due' },
  { fieldId: 'tableField_lines', alias: 'lines' },
  { fieldId: 'dateField_delivery', alias: 'delivery' },
] }, componentsTree: [field('TextField', 'textField_customer', { label: '客户' }),
  field('DateField', 'dateField_due'), field('CascadeDateField', 'cascadeDateField_period'),
  field('NumberField', 'numberField_price'),
  field('SelectField', 'selectField_status', { dataSource: [{ value: 'new' }, { value: 'done' }] }),
  field('TableField', 'tableField_lines', {}, [field('DateField', 'dateField_delivery')]),
] }] } };
const contract = buildWriteContract(schema);

describe('seed schema preparation', () => {
  const optionalSchema = (props = { validation: [] }) => buildWriteContract({ content: { pages: [{
    componentAlias: { items: [{ fieldId: 'country', alias: 'region' }] }, componentsTree: [
      field('TextField', 'name', { label: '名称' }), field('NumberField', 'amount'),
      field('UnsupportedField', 'country', { label: '未支持字段', ...props }),
      field('SerialNumberField', 'serial', { validation: [] }),
      field('TableField', 'lines', {}, [field('TextField', 'childName'),
        field('UnsupportedField', 'address', { validation: [] })]),
    ],
  }] } });
  test('omits only unsupported optional fields in main/table scopes and reports exact original paths', () => {
    const input = [{ name: '业务记录', country: ['secret-country'], serial: 'manual', lines: [{ childName: '明细', address: { secret: true } }] }];
    const before = JSON.stringify(input), skipped = [];
    expect(prepareRecords(input, optionalSchema(), {}, skipped)).toEqual([{ name: '业务记录', lines: [{ childName: '明细' }] }]);
    expect(skipped).toMatchObject([
      { recordIndex: 0, fieldId: 'country', path: '$[0]["country"]', reason: 'unsupported_optional_component' },
      { fieldId: 'serial', reason: 'server_generated' },
      { fieldId: 'address', parentFieldId: 'lines', path: '$[0]["lines"][0]["address"]' },
    ]);
    expect(JSON.stringify(skipped)).not.toContain('secret');
    expect(JSON.stringify(input)).toBe(before);
  });
  test.each([{ required: true, validation: [] }, { required: 'true', validation: [] }, {},
    { required: { type: 'JSExpression', value: 'true' }, validation: [] },
    { validation: [{ type: 'required', when: 'conditional' }] }, { validation: [{ type: 'custom' }] },
  ])('retains strict unsupported failure when optionality is not proven: %j', props => {
    expect(() => prepareRecords([{ name: 'A', country: ['CN'] }], optionalSchema(props), {}))
      .toThrow(expect.objectContaining({ details: expect.objectContaining({ issues: [expect.objectContaining({ code: 'UNSUPPORTED_COMPONENT' })] }) }));
  });
  test('still rejects unknown fields, duplicate aliases and invalid supported values', () => {
    for (const record of [{ name: 'A', unknown: [] }, { name: 'A', country: [], region: [] }, { name: 'A', country: [], amount: 'bad' }]) {
      expect(() => prepareRecords([record], optionalSchema(), { resolve_aliases: true })).toThrow();
    }
  });
  test('does not create an empty subform row after omission', () => {
    expect(() => prepareRecords([{ name: 'A', lines: [{ address: {} }] }], optionalSchema(), {}))
      .toThrow(expect.objectContaining({ details: expect.objectContaining({ issues: [expect.objectContaining({ code: 'NO_WRITABLE_SUBFORM_FIELDS' })] }) }));
  });
  test('uses live fields, configured aliases, scoped subforms and preserves ordinary text', () => {
    const input = [{ customer: '2026-11-03', due: '2026-11-03', numberField_price: 0,
      cascadeDateField_period: ['2026-11-03T10:30:00Z', ''], lines: [{ delivery: '2026-11-04 09:15' }] }];
    expect(prepareRecords(input, contract, { resolve_aliases: true })).toEqual([{
      textField_customer: '2026-11-03', dateField_due: Date.parse('2026-11-03T00:00:00+08:00'),
      numberField_price: 0, cascadeDateField_period: [Date.parse('2026-11-03T10:30:00Z'), ''],
      tableField_lines: [{ dateField_delivery: Date.parse('2026-11-04T09:15:00+08:00') }],
    }]);
    expect(input[0].due).toBe('2026-11-03');
  });

  test.each([
    ['2026-11-03', '-05:30', '2026-11-03T00:00:00-05:30'],
    ['2026-11-03T12:00:01.2', '+08:00', '2026-11-03T12:00:01.200+08:00'],
    ['2026-11-03T12:00+02:00', '+08:00', '2026-11-03T12:00:00+02:00'],
    ['2024-02-29', 'Z', '2024-02-29T00:00:00Z'],
  ])('converts %s independently of host timezone', (value, timezone, expected) => {
    expect(prepareRecords([{ dateField_due: value }], contract, { timezone })[0].dateField_due)
      .toBe(Date.parse(expected));
  });

  test.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-11-03T24:00',
    '2026-11-03T12:60', '2026-11-03T12:00+15:00', '11/03/2026', 'tomorrow', '1793635200000'])(
    'rejects invalid or ambiguous date %s', value => {
      expect(() => prepareRecords([{ dateField_due: value }], contract, {}))
        .toThrow(expect.objectContaining({ code: 'DATA_SEED_PREFLIGHT_FAILED' }));
    });

  test('rejects reversed ranges, unknown options, aliases without opt-in and display labels', () => {
    const records = [{ cascadeDateField_period: ['2026-11-04', '2026-11-03'] },
      { selectField_status: 'missing' }, { customer: 'A' }, { 客户: 'B' }];
    try {prepareRecords(records, contract, {}); throw new Error('Expected failure');} catch (error) {
      expect(error.code).toBe('DATA_SEED_PREFLIGHT_FAILED');
      expect(error.details.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ recordIndex: 0, code: 'REVERSED_DATE_RANGE' }),
        expect.objectContaining({ recordIndex: 1, code: 'UNKNOWN_OPTION' }),
        expect.objectContaining({ recordIndex: 2, code: 'UNKNOWN_FIELD' }),
        expect.objectContaining({ recordIndex: 3, code: 'UNKNOWN_FIELD' }),
      ]));
    }
  });

  test('accepts a different live schema without hardcoded field names', () => {
    const inventory = buildWriteContract({ content: { pages: [{ componentsTree: [
      field('NumberField', 'numberField_stock'), field('TextField', 'textField_sku'),
    ] }] } });
    expect(prepareRecords([{ numberField_stock: 10, textField_sku: 'SKU-42' }], inventory, {}))
      .toEqual([{ numberField_stock: 10, textField_sku: 'SKU-42' }]);
  });
});

describe('seed writes and recovery', () => {
  let dir, source, options, write, verify, prepare;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-seed-'));
    source = path.join(dir, 'customers.json');
    fs.writeFileSync(source, JSON.stringify([{ textField_customer: '远山科技' }, { textField_customer: '青禾商贸' }]));
    options = { records_file: source, expect_form_name: '客户' };
    write = jest.fn().mockResolvedValueOnce({ idVerified: true, formInstId: 'ID-1' })
      .mockResolvedValueOnce({ idVerified: true, formInstId: 'ID-2' });
    verify = jest.fn().mockResolvedValue({ readbackVerified: true });
    prepare = jest.fn().mockResolvedValue(contract);
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
  const identity = { baseUrl: 'https://example.test', corpId: 'corp', userId: 'user' };
  const invoke = extra => run({ appType: 'APP_X', formUuid: 'FORM-X', options, identity, prepare, write, verify, ...extra });
  const receipt = () => JSON.parse(fs.readFileSync(`${source}.seed-receipt.json`, 'utf8'));

  const unsupportedContract = props => buildWriteContract({ content: { pages: [{ componentsTree: [
    field('TextField', 'textField_customer'), field('UnsupportedField', 'country', { validation: [], ...props }),
  ] }] } });
  test('writes the remaining fields and persists omission coverage without business values', async () => {
    prepare.mockResolvedValue(unsupportedContract());
    fs.writeFileSync(source, JSON.stringify([{ textField_customer: 'A', country: ['secret-value'] }]));
    expect(await invoke()).toMatchObject({ success: true, readbackVerified: true, requestedFieldsVerified: false,
      completed: 1, skippedFields: [{ fieldId: 'country' }] });
    expect(write).toHaveBeenCalledWith({ textField_customer: 'A' });
    expect(verify.mock.calls[0][1]).toEqual({ textField_customer: 'A' });
    expect(JSON.stringify(receipt())).not.toContain('secret-value');
    expect(receipt()).toMatchObject({ skippedFields: [{ fieldId: 'country' }], requestedFieldsVerified: false });
    expect(await invoke()).toMatchObject({ mutationPerformed: false, completed: 1 });
    expect(write).toHaveBeenCalledTimes(1);
  });
  test('all unsupported optional fields return an explicit no-write skip, not an empty record', async () => {
    prepare.mockResolvedValue(unsupportedContract());
    fs.writeFileSync(source, JSON.stringify([{ country: [] }]));
    expect(await invoke()).toMatchObject({ success: true, skipped: true, readbackVerified: false,
      completed: 0, formInstIds: [], mutationPerformed: false, nextStep: 'continue_without_seed_records' });
    expect(write).not.toHaveBeenCalled(); expect(verify).not.toHaveBeenCalled();
    expect(fs.existsSync(`${source}.seed-receipt.json`)).toBe(false);
  });
  test('a required unsupported field offers fallback only before any receipt or lock exists', async () => {
    prepare.mockResolvedValue(unsupportedContract({ required: true }));
    fs.writeFileSync(source, JSON.stringify([{ textField_customer: 'A', country: [] }]));
    await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_PREFLIGHT_FAILED', details: {
      sideEffectState: 'none', retrySameInput: false, fallback: { allowed: true, readbackRequired: true },
    } });
    fs.writeFileSync(`${source}.seed-receipt.json`, '{"items":[{"status":"pending"}]}');
    await expect(invoke()).rejects.toMatchObject({ details: { fallback: { allowed: false }, nextStep: 'inspect_existing_receipt_do_not_create' } });
    expect(write).not.toHaveBeenCalled();
  });
  test('omission policy cannot reinterpret an older pending receipt', async () => {
    prepare.mockResolvedValue(unsupportedContract());
    fs.writeFileSync(source, JSON.stringify([{ textField_customer: 'A', country: [] }]));
    fs.writeFileSync(`${source}.seed-receipt.json`, JSON.stringify({ version: 1, inputHash: 'old-policy', items: [{ status: 'pending', formInstId: 'OLD' }] }));
    await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_RECEIPT_MISMATCH' });
    expect(write).not.toHaveBeenCalled(); expect(verify).not.toHaveBeenCalled();
  });
  test('check mode previews omissions without creating a receipt or claiming a readback', async () => {
    prepare.mockResolvedValue(unsupportedContract()); options.check = true;
    fs.writeFileSync(source, JSON.stringify([{ textField_customer: 'A', country: [] }]));
    expect(await invoke()).toMatchObject({ checked: true, records: [{ textField_customer: 'A' }], skippedFields: [{ fieldId: 'country' }] });
    expect(write).not.toHaveBeenCalled(); expect(fs.existsSync(`${source}.seed-receipt.json`)).toBe(false);
  });

  test('writes once per row, verifies before next write, and reuses verified IDs on rerun', async () => {
    const events = [];
    write.mockReset().mockImplementation(async () => {
      events.push('write'); return { idVerified: true, formInstId: `ID-${events.length}` };
    });
    verify.mockImplementation(async () => { events.push('verify'); });
    const result = await invoke();
    expect(events).toEqual(['write', 'verify', 'write', 'verify']);
    expect(result).toMatchObject({ success: true, readbackVerified: true, completed: 2, formInstIds: ['ID-1', 'ID-3'] });
    expect(await invoke()).toMatchObject({ completed: 2, mutationPerformed: false, formInstIds: result.formInstIds });
    expect(write).toHaveBeenCalledTimes(2);
    expect(receipt().items.every(item => item.status === 'verified')).toBe(true);
  });

  test('checks the entire batch before writing and check mode has no local receipt', async () => {
    options.check = true;
    expect(await invoke()).toMatchObject({ checked: true, mutationPerformed: false, count: 2 });
    expect(fs.existsSync(`${source}.seed-receipt.json`)).toBe(false);
    delete options.check;
    fs.writeFileSync(source, JSON.stringify([{ textField_customer: 'A' }, { missing: 'B' }]));
    await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_PREFLIGHT_FAILED' });
    expect(write).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  test('prepares all association payloads before the first write', async () => {
    const normalize = jest.fn().mockImplementationOnce(data => data)
      .mockImplementationOnce(() => { throw new Error('Invalid association metadata'); });
    await expect(invoke({ normalize })).rejects.toThrow('Invalid association metadata');
    expect(write).not.toHaveBeenCalled();
  });

  test('retains an accepted ID and resumes by readback, without recreating it', async () => {
    verify.mockRejectedValueOnce(Object.assign(new Error('Mismatch'), { code: 'READBACK_MISMATCH' }));
    await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_INCOMPLETE', details: {
      completed: 0, failedIndex: 0, retrySafe: false,
      partial: { items: [expect.objectContaining({ formInstId: 'ID-1', status: 'pending' }), expect.anything()] },
    } });
    expect(write).toHaveBeenCalledTimes(1);
    expect(await invoke()).toMatchObject({ completed: 2, formInstIds: ['ID-1', 'ID-2'] });
    expect(write).toHaveBeenCalledTimes(2);
    expect(verify.mock.calls.map(call => call[0])).toEqual(['ID-1', 'ID-1', 'ID-2']);
  });

  test.each(['network', 'missing-id', 'conflicting-ids'])('never replays an unknown %s write', async kind => {
    write.mockReset();
    if (kind === 'network') {write.mockRejectedValue(new Error('Disconnected'));}
    else {write.mockResolvedValue({ idVerified: false, candidateIds: kind === 'conflicting-ids' ? ['ID-1', 'ID-OTHER'] : [] });}
    await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_INCOMPLETE', details: { failedIndex: 0, sideEffectState: 'unknown' } });
    await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_INCOMPLETE' });
    expect(write).toHaveBeenCalledTimes(1);
    expect(verify).not.toHaveBeenCalled();
    if (kind === 'conflicting-ids') {expect(receipt().items[0].candidateIds).toEqual(['ID-1', 'ID-OTHER']);}
  });

  test('retains first success when second fails and refuses to replay either write', async () => {
    write.mockReset().mockResolvedValueOnce({ idVerified: true, formInstId: 'ID-1' })
      .mockRejectedValueOnce(new Error('Timeout'));
    await expect(invoke()).rejects.toMatchObject({ details: { completed: 1, failedIndex: 1 } });
    await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_INCOMPLETE' });
    expect(write).toHaveBeenCalledTimes(2);
    expect(receipt().items[0]).toMatchObject({ status: 'verified', formInstId: 'ID-1' });
  });

  test.each(['input', 'identity', 'target', 'schema', 'timezone'])('rejects changed %s receipt reuse', async kind => {
    await invoke();
    const extra = {};
    if (kind === 'input') {fs.writeFileSync(source, JSON.stringify([{ textField_customer: 'Changed' }]));}
    if (kind === 'identity') {extra.identity = { ...identity, userId: 'other' };}
    if (kind === 'target') {extra.formUuid = 'FORM-OTHER';}
    if (kind === 'schema') {prepare.mockResolvedValue({ ...contract, schemaHash: 'changed' });}
    if (kind === 'timezone') {options.timezone = 'Z';}
    await expect(invoke(extra)).rejects.toMatchObject({ code: 'DATA_SEED_RECEIPT_MISMATCH' });
    expect(write).toHaveBeenCalledTimes(2);
  });

  test('concurrent invocation is blocked while an original write is in flight', async () => {
    let release, started;
    const writing = new Promise(resolve => { started = resolve; });
    write.mockReset().mockImplementationOnce(() => { started(); return new Promise(resolve => { release = resolve; }); })
      .mockResolvedValueOnce({ idVerified: true, formInstId: 'ID-2' });
    const first = invoke();
    await writing;
    await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_LOCKED' });
    release({ idVerified: true, formInstId: 'ID-1' });
    await expect(first).resolves.toMatchObject({ completed: 2 });
  });

  test.each(['null', '{invalid', '{"version":1,"items":[]}'])('invalid receipt fails without writing: %s', async content => {
    fs.writeFileSync(`${source}.seed-receipt.json`, content);
    await expect(invoke()).rejects.toMatchObject({ isCliError: true });
    expect(write).not.toHaveBeenCalled();
    expect(fs.existsSync(`${source}.seed-receipt.json.lock`)).toBe(false);
  });

  test.each([[], {}, [{}], Array.from({ length: 31 }, () => ({}))].map(records => [records]))('invalid record input fails without writes: %j', async records => {
    fs.writeFileSync(source, JSON.stringify(records));
    await expect(invoke()).rejects.toMatchObject({ code: records.length === 1 ? 'DATA_SEED_PREFLIGHT_FAILED' : 'DATA_SEED_INVALID_RECORDS' });
    expect(write).not.toHaveBeenCalled();
  });
});

test.each([{ timezone: 'Asia/Shanghai' }, { timezone: '+14:01' }, { check: 'false' },
  { resolve_aliases: 'yes' }, { extra: true }, { records_file: true }])('rejects unsupported arguments: %j', override => {
  expect(() => validateArguments(['APP_X', 'FORM-X'], { expect_form_name: '客户', records_file: 'records.json', ...override }))
    .toThrow(expect.objectContaining({ code: 'DATA_SEED_INVALID_ARGUMENTS' }));
});
