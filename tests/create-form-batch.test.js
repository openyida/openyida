'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, parseArgs, loadPlan, schedule, mapReferences, parseOutput } = require('../lib/app/create-form/batch');

describe('dependency-aware form batches', () => {
  let dir;
  let file;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'form-batch-'));
    file = path.join(dir, 'forms.json');
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
    process.exitCode = 0;
  });
  const form = key => ({ key, title: key, fields: [{ type: 'TextField', label: '名称' }] });
  const write = forms => fs.writeFileSync(file, JSON.stringify({ forms }));
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

  test('references infer dependencies, fields files resolve relative to the plan', () => {
    fs.writeFileSync(path.join(dir, 'order-fields.json'), JSON.stringify([{ formUuid: { $form: 'customer' }, mainFieldId: { $form: 'customer', field: '名称' } }]));
    write([form('customer'), form('product'), { key: 'order', title: '订单', fieldsFile: 'order-fields.json' }]);
    expect(loadPlan(file).groups).toEqual([['customer', 'product'], ['order']]);
    expect(mapReferences({ title: '{{ordinary text}}', id: { $form: 'customer', field: '名称' } }, (key, field) => key + ':' + field))
      .toEqual({ title: '{{ordinary text}}', id: 'customer:名称' });
  });

  test.each([
    [form('a'), form('a')],
    [{ ...form('a'), dependsOn: ['missing'] }],
    [{ ...form('a'), dependsOn: ['b'] }, { ...form('b'), dependsOn: ['a'] }],
    [{ ...form('a'), fields: [{ id: { $form: 'a' } }] }],
  ])('rejects invalid graphs before execution: %j', (...forms) => {
    write(forms); expect(() => loadPlan(file)).toThrow();
  });

  test('limits concurrency and starts ready dependents without waiting for unrelated forms', async () => {
    const a = deferred(); const b = deferred(); const c = deferred();
    const calls = [];
    const forms = [{ key: 'a', dependsOn: [] }, { key: 'b', dependsOn: [] }, { key: 'c', dependsOn: ['a'] }];
    const work = schedule(forms, 2, {}, async item => {
      calls.push(item.key); await { a, b, c }[item.key].promise; return { formUuid: item.key };
    }, () => {});
    await new Promise(setImmediate); expect(calls).toEqual(['a', 'b']);
    a.resolve(); await new Promise(setImmediate); expect(calls).toEqual(['a', 'b', 'c']);
    c.resolve(); b.resolve();
    expect(Object.values(await work).every(item => item.status === 'success')).toBe(true);
  });

  test('failure blocks dependents while unrelated work completes and known IDs survive', async () => {
    const results = {};
    const forms = [{ key: 'a', dependsOn: [] }, { key: 'b', dependsOn: ['a'] }, { key: 'c', dependsOn: [] }];
    const worker = jest.fn(async item => {
      if (item.key === 'a') { results.a.formUuid = 'FORM-A'; throw new Error('schema save failed'); }
      return { formUuid: 'FORM-C' };
    });
    await schedule(forms, 2, results, worker, () => {});
    expect(results.a).toMatchObject({ status: 'failed', formUuid: 'FORM-A' });
    expect(results.b.status).toBe('blocked');
    expect(results.c.status).toBe('success');
    expect(worker).toHaveBeenCalledTimes(2);
  });

  test('failure propagates through a reverse-ordered dependency chain', async () => {
    const forms = [{ key: 'c', dependsOn: ['b'] }, { key: 'b', dependsOn: ['a'] }, { key: 'a', dependsOn: [] }];
    const worker = jest.fn(async () => { throw new Error('failed'); });
    const results = await schedule(forms, 3, {}, worker, () => {});
    expect(results.c.status).toBe('blocked');
    expect(results.b.status).toBe('blocked');
    expect(worker).toHaveBeenCalledTimes(1);
  });

  test('an interrupted task is blocked from recreation on restart', async () => {
    const worker = jest.fn();
    const results = await schedule([{ key: 'a', dependsOn: [] }, { key: 'b', dependsOn: ['a'] }], 2, { a: { status: 'running' } }, worker, () => {});
    expect(worker).not.toHaveBeenCalled();
    expect(results.b.status).toBe('blocked');
  });

  function executor(failSchema = false) {
    return jest.fn(async args => {
      if (args[0] === 'login' || args[1] === 'validate-fields') { return { success: true }; }
      if (args[1] === 'create') { return { success: true, formUuid: 'FORM-' + args[3] }; }
      if (failSchema) { throw new Error('readback failed'); }
      return { success: true, formUuid: args[2], fields: [{ label: '名称', fieldId: 'textField_name' }] };
    });
  }

  test('check performs local validation only and creates no checkpoint', async () => {
    write([form('a')]); const execute = executor();
    const output = await run(['APP_X', file, '--check'], { execute });
    expect(output.checked).toBe(true);
    expect(execute.mock.calls.every(([args]) => args[1] === 'validate-fields')).toBe(true);
    expect(fs.existsSync(file + '.state.json')).toBe(false);
  });

  test('real IDs and fields bind after readback; repeated run reuses completed forms', async () => {
    write([form('customer'), { ...form('order'), fields: [{ formUuid: { $form: 'customer' }, mainFieldId: { $form: 'customer', field: '名称' } }] }]);
    const execute = executor();
    expect((await run(['APP_X', file], { execute })).success).toBe(true);
    const order = execute.mock.calls.map(([args]) => args).find(args => args[1] === 'create' && args[3] === 'order');
    expect(JSON.parse(order[4])).toEqual([{ formUuid: 'FORM-customer', mainFieldId: 'textField_name' }]);
    execute.mockClear();
    await run(['APP_X', file], { execute });
    expect(execute.mock.calls.some(([args]) => args[1] === 'create')).toBe(false);
    expect(fs.existsSync(file + '.state.json.lock')).toBe(false);
  });

  test('readback failure records the created ID and never silently retries creation', async () => {
    write([form('a')]);
    const execute = executor(true);
    const output = await run(['APP_X', file], { execute });
    expect(output.results.a).toMatchObject({ status: 'failed', formUuid: 'FORM-a' });
    execute.mockClear();
    expect((await run(['APP_X', file], { execute })).success).toBe(false);
    expect(execute.mock.calls.some(([args]) => args[1] === 'create')).toBe(false);
  });

  test('reuse and plan fingerprints prevent accidental duplicate resources', async () => {
    write([{ ...form('a'), formUuid: 'FORM-existing' }]); const execute = executor();
    await run(['APP_X', file], { execute });
    expect(execute.mock.calls.some(([args]) => args[1] === 'create')).toBe(false);
    write([form('changed')]); execute.mockClear();
    await expect(run(['APP_X', file], { execute })).rejects.toThrow();
    expect(execute.mock.calls.some(([args]) => args[1] === 'create')).toBe(false);
  });

  test('parses pretty JSON and preserves a structured failure result', () => {
    expect(parseOutput('{\n"success":true\n}')).toEqual({ success: true });
    expect(parseOutput('progress\n{"success":false,"formUuid":"FORM-A"}\n')).toEqual({ success: false, formUuid: 'FORM-A' });
    expect(parseOutput('progress\n{"success":false,"formUuid":"FORM-A"}\n{"success":false,"errorCode":"ERROR"}').formUuid).toBe('FORM-A');
    expect(() => parseArgs(['APP_X', file, '--concurrency', '0'])).toThrow();
  });
});
