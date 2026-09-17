'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('child_process', () => ({ execFile: jest.fn() }));
const { execFile } = require('child_process');
const {
  run,
  parseArgs,
  loadPlan,
  schedule,
  mapReferences,
  parseOutput,
  mergeCommandOutput,
  execute,
  expectedReadbackFields,
  readbackMatchesExpectedFields,
  normalizeAssociationReferences,
} = require('../lib/app/create-form/batch');
const { validateFormFieldDefinitions } = require('../lib/app/form-field-validator');

describe('dependency-aware form batches', () => {
  let dir;
  let file;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'form-batch-'));
    file = path.join(dir, 'forms.json');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
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

  test('normalizes compact same-batch association references before preflight', () => {
    const fields = [{
      type: 'AssociationFormField',
      label: '关联客户',
      associationForm: { $form: 'customer', field: '客户名称' },
    }];
    const normalized = normalizeAssociationReferences(fields, 'APP_X');
    const preflight = mapReferences(normalized, (_, field) => field ? 'textField_precheck' : 'FORM-PRECHECK');

    expect(normalized).toEqual([{
      type: 'AssociationFormField',
      label: '关联客户',
      associationForm: {
        appType: 'APP_X',
        formUuid: { $form: 'customer' },
        mainFieldId: { $form: 'customer', field: '客户名称' },
        mainFieldLabel: '客户名称',
        mainComponentName: 'TextField',
      },
    }]);
    expect(preflight[0].associationForm).toMatchObject({
      appType: 'APP_X',
      formUuid: 'FORM-PRECHECK',
      mainFieldId: 'textField_precheck',
      mainFieldLabel: '客户名称',
    });
    expect(validateFormFieldDefinitions(preflight)).toEqual([]);
  });

  test('compact association reference infers a dependency and resolves real IDs', () => {
    write([
      form('customer'),
      {
        key: 'relation',
        title: '客户关系',
        fields: [{
          type: 'AssociationFormField',
          label: '关联客户',
          associationForm: { $form: 'customer', field: '名称' },
        }],
      },
    ]);

    const loaded = loadPlan(file, { appType: 'APP_X' });
    expect(loaded.groups).toEqual([['customer'], ['relation']]);
    expect(mapReferences(loaded.forms[1].fields, (key, field) =>
      field ? `FIELD-${key}-${field}` : `FORM-${key}`
    )[0].associationForm).toMatchObject({
      appType: 'APP_X',
      formUuid: 'FORM-customer',
      mainFieldId: 'FIELD-customer-名称',
    });
  });

  test.each([
    [form('a'), form('a')],
    [{ ...form('a'), dependsOn: ['missing'] }],
    [{ ...form('a'), dependsOn: ['b'] }, { ...form('b'), dependsOn: ['a'] }],
    [{ ...form('a'), fields: [{ id: { $form: 'a' } }] }],
  ])('rejects invalid graphs before execution: %j', (...forms) => {
    write(forms); expect(() => loadPlan(file)).toThrow();
  });

  test.each([
    [{ ...form('customer'), icon: 'xian-qiye' }, 'CREATE_FORM_NAV_ICON_INVALID'],
    [{ ...form('customer'), locale: 'klingon' }, 'CREATE_FORM_INVALID_ARGUMENTS'],
    [{ ...form('customer'), title: '客户📇' }, 'OPENYIDA_ARTIFACT_EMOJI_FORBIDDEN'],
  ])('rejects invalid static definition before any batch execution: %j', async (invalidForm, errorCode) => {
    write([invalidForm]);
    const execute = executor();

    await expect(run(['APP_X', file], { execute })).rejects.toMatchObject({
      code: 'FORM_BATCH_INVALID',
      details: {
        reason: expect.objectContaining({ formKey: 'customer', errorCode }),
      },
    });
    expect(execute).not.toHaveBeenCalled();
    expect(fs.existsSync(file + '.state.json')).toBe(false);
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
    expect(worker).toHaveBeenCalledTimes(3);
  });

  test('a newly known form ID is resumed once before dependents are classified as blocked', async () => {
    const results = {};
    const calls = [];
    const forms = [{ key: 'a', dependsOn: [] }, { key: 'b', dependsOn: ['a'] }];
    const worker = jest.fn(async item => {
      calls.push(item.key);
      if (item.key === 'a' && calls.filter(key => key === 'a').length === 1) {
        results.a.formUuid = 'FORM-A';
        throw new Error('post-create readback failed');
      }
      return { formUuid: item.key === 'a' ? 'FORM-A' : 'FORM-B' };
    });

    await schedule(forms, 2, results, worker, () => {});

    expect(calls).toEqual(['a', 'a', 'b']);
    expect(results.a).toMatchObject({ status: 'success', formUuid: 'FORM-A' });
    expect(results.b).toMatchObject({ status: 'success', formUuid: 'FORM-B' });
  });

  test('failure propagates through a reverse-ordered dependency chain', async () => {
    const forms = [{ key: 'c', dependsOn: ['b'] }, { key: 'b', dependsOn: ['a'] }, { key: 'a', dependsOn: [] }];
    const worker = jest.fn(async () => { throw new Error('failed'); });
    const results = await schedule(forms, 3, {}, worker, () => {});
    expect(results.c.status).toBe('blocked');
    expect(results.b.status).toBe('blocked');
    expect(worker).toHaveBeenCalledTimes(1);
  });

  test('failed child diagnostics preserve the safe error code in batch results', async () => {
    const error = Object.assign(new Error('save failed'), { output: {
      errorCode: 'CREATE_FORM_SAVE_FAILED', formUuid: 'FORM-A',
    } });
    const results = await schedule([{ key: 'a', dependsOn: [] }], 1, {}, async () => { throw error; }, () => {});
    expect(results.a).toMatchObject({ status: 'failed', error: 'save failed', errorCode: 'CREATE_FORM_SAVE_FAILED', formUuid: 'FORM-A' });
  });

  test('an interrupted task is blocked from recreation on restart', async () => {
    const worker = jest.fn();
    const results = await schedule([{ key: 'a', dependsOn: [] }, { key: 'b', dependsOn: ['a'] }], 2, { a: { status: 'running' } }, worker, () => {});
    expect(worker).not.toHaveBeenCalled();
    expect(results.b.status).toBe('blocked');
  });

  function executor(failSchema = false) {
    return jest.fn(async args => {
      if (args[0] === 'login') { return { success: true, base_url: 'https://example.test' }; }
      if (args[1] === 'validate-fields') { return { success: true }; }
      if (args[1] === 'create') { return { success: true, formUuid: 'FORM-' + args[3] }; }
      if (failSchema) { throw new Error('readback failed'); }
      return { success: true, formUuid: args[2], fields: [{ label: '名称', componentName: 'TextField', fieldId: 'textField_name' }] };
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
    const firstOutput = await run(['APP_X', file], { execute });
    expect(firstOutput).toMatchObject({
      success: true,
      appUrl: 'https://example.test/APP_X/workbench',
      results: {
        customer: {
          url: 'https://example.test/APP_X/workbench/FORM-customer',
          formUrl: 'https://example.test/APP_X/workbench/FORM-customer',
          appUrl: 'https://example.test/APP_X/workbench',
        },
      },
    });
    const order = execute.mock.calls.map(([args]) => args).find(args => args[1] === 'create' && args[3] === 'order');
    expect(JSON.parse(order[4])).toEqual([{ formUuid: 'FORM-customer', mainFieldId: 'textField_name' }]);
    execute.mockClear();
    const repeatedOutput = await run(['APP_X', file], { execute });
    expect(execute.mock.calls.some(([args]) => args[1] === 'create')).toBe(false);
    expect(repeatedOutput.results.customer).toMatchObject({
      formUrl: 'https://example.test/APP_X/workbench/FORM-customer',
      appUrl: 'https://example.test/APP_X/workbench',
    });
    expect(fs.existsSync(file + '.state.json.lock')).toBe(false);
  });

  test('readback failure records the created ID and never silently retries creation', async () => {
    write([form('a')]);
    const execute = executor(true);
    const output = await run(['APP_X', file], { execute });
    expect(output.results.a).toMatchObject({ status: 'failed', formUuid: 'FORM-a' });
    execute.mockClear();
    const retry = await run(['APP_X', file], { execute });
    expect(retry).toMatchObject({
      success: false,
      errorCode: 'FORM_BATCH_PARTIAL_FAILURE',
      recoveryAction: 'rerun_unchanged_plan',
    });
    expect(retry.nextAction).toBe(retry.recoveryAction);
    expect(execute.mock.calls.some(([args]) => args[1] === 'create')).toBe(false);
    expect(execute.mock.calls.some(([args]) => args[1] === 'resume' && args[3] === 'FORM-a')).toBe(true);
  });

  test('unknown write outcomes require inspection instead of unchanged-plan retry', async () => {
    write([form('a')]);
    const execute = jest.fn(async args => {
      if (args[0] === 'login' || args[1] === 'validate-fields') { return { success: true }; }
      if (args[1] === 'create') { throw new Error('connection closed before a resource ID was returned'); }
      throw new Error('unexpected command');
    });

    const output = await run(['APP_X', file], { execute });

    expect(output).toMatchObject({
      success: false,
      errorCode: 'FORM_BATCH_PARTIAL_FAILURE',
      recoveryAction: 'inspect_unknown_write_then_reconcile',
      results: { a: { status: 'failed' } },
    });
    expect(output.results.a).not.toHaveProperty('formUuid');
    expect(output.nextAction).toBe(output.recoveryAction);
  });

  test('a post-create failure with a known ID resumes the same form inside the batch', async () => {
    write([form('a')]);
    const execute = jest.fn(async args => {
      if (args[0] === 'login' || args[1] === 'validate-fields') { return { success: true }; }
      if (args[1] === 'create') {
        throw Object.assign(new Error('schema save failed'), {
          output: { success: false, formUuid: 'FORM-HALF-A', stage: 'saveFormSchema' },
        });
      }
      if (args[1] === 'resume') {
        return { success: true, formUuid: args[3], recoveredBlankShell: true };
      }
      return { success: true, formUuid: args[2], fields: [{ label: '名称', componentName: 'TextField', fieldId: 'textField_name' }] };
    });

    const output = await run(['APP_X', file], { execute });

    expect(output).toMatchObject({
      success: true,
      results: { a: { status: 'success', formUuid: 'FORM-HALF-A' } },
    });
    expect(execute.mock.calls.filter(([args]) => args[1] === 'create')).toHaveLength(1);
    expect(execute.mock.calls.filter(([args]) => args[1] === 'resume')).toEqual([[
      ['create-form', 'resume', 'APP_X', 'FORM-HALF-A', JSON.stringify(form('a').fields), '--json'],
    ]]);
  });

  test('a successful create with an empty readback resumes inside the same batch', async () => {
    write([form('a')]);
    let readCount = 0;
    const execute = jest.fn(async args => {
      if (args[0] === 'login' || args[1] === 'validate-fields') { return { success: true }; }
      if (args[1] === 'create') { return { success: true, formUuid: 'FORM-EMPTY-A' }; }
      if (args[1] === 'resume') { return { success: true, formUuid: 'FORM-EMPTY-A' }; }
      readCount++;
      return {
        success: true,
        formUuid: 'FORM-EMPTY-A',
        fields: readCount === 1 ? [] : [{ label: '名称', componentName: 'TextField', fieldId: 'textField_name' }],
      };
    });

    const output = await run(['APP_X', file], { execute });

    expect(output).toMatchObject({
      success: true,
      results: { a: { status: 'success', formUuid: 'FORM-EMPTY-A' } },
    });
    expect(execute.mock.calls.filter(([args]) => args[1] === 'create')).toHaveLength(1);
    expect(execute.mock.calls.filter(([args]) => args[1] === 'resume')).toHaveLength(1);
  });

  test('readback matching ignores layout fields and requires real business fields', () => {
    const fields = [
      { type: 'Divider', title: '基本信息' },
      { type: 'ColumnContainer', children: [[{ type: 'TextField', label: '名称' }], [{ type: 'NumberField', label: '金额' }]] },
    ];
    expect(expectedReadbackFields(fields)).toEqual([
      { label: '名称', componentName: 'TextField' },
      { label: '金额', componentName: 'NumberField' },
    ]);
    expect(readbackMatchesExpectedFields({
      formUuid: 'FORM-A',
      fields: [{ label: '名称', componentName: 'TextField' }],
    }, fields)).toBe(false);
    expect(readbackMatchesExpectedFields({
      formUuid: 'FORM-A',
      fields: [
        { label: '名称', componentName: 'TextField' },
        { label: '金额', componentName: 'NumberField' },
      ],
    }, fields)).toBe(true);
  });

  test('batch help is discoverable without a plan or side effects', async () => {
    expect(parseArgs(['--help'])).toEqual({ help: true });
    expect(await run(['--help'])).toMatchObject({ success: true, help: true });
    expect(console.log).not.toHaveBeenCalled();
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

  test('machine children request JSON once and parse existing success output', async () => {
    execFile.mockImplementation((_node, argv, _options, callback) => {
      expect(argv.filter(arg => arg === '--json')).toHaveLength(1);
      expect(argv.filter(arg => arg === '--quiet')).toHaveLength(1);
      callback(null, '{\n"success":true,"formUuid":"FORM-A"\n}', '');
    });
    await expect(execute(['create-form', 'create', 'APP_X', 'A', '[]', '--json', '--quiet']))
      .resolves.toEqual({ success: true, formUuid: 'FORM-A' });
    execFile.mockImplementationOnce((_node, _argv, _options, callback) => {
      callback(null, 'progress\n{"success":true,"formUuid":"FORM-B"}', '');
    });
    await expect(execute(['create-form', 'create', 'APP_X', 'B', '[]']))
      .resolves.toEqual({ success: true, formUuid: 'FORM-B' });
  });

  test('stderr failure retains error code and an earlier created ID without argv', async () => {
    execFile.mockImplementation((_node, _argv, _options, callback) => {
      callback(new Error('Command failed: private argv'), '{"success":true,"formUuid":"FORM-A"}',
        JSON.stringify({ success: false, errorCode: 'CREATE_FORM_SAVE_FAILED', errorMsg: 'save failed', details: { token: 'private-token' } }));
    });
    await expect(execute(['create-form', 'create', 'APP_X', 'A', '[]'])).rejects.toMatchObject({
      message: 'save failed', output: { success: false, errorCode: 'CREATE_FORM_SAVE_FAILED', errorMsg: 'save failed', formUuid: 'FORM-A' },
    });
  });

  test('failure diagnostics redact grant and bearer secrets before truncating', async () => {
    const previous = process.env.OPENYIDA_AGENT_TASK_GRANT;
    process.env.OPENYIDA_AGENT_TASK_GRANT = 'fixture-secret-grant';
    execFile.mockImplementation((_node, _argv, _options, callback) => {
      callback(new Error('Command failed: private argv'), '', JSON.stringify({ success: false, errorCode: 'CREATE_FORM_FAILED',
        errorMsg: 'fixture-secret-grant Authorization: Bearer private-access-token password=private-password ' + 'x'.repeat(5000) }));
    });
    try {
      expect.assertions(3);
      await execute(['create-form', 'create', 'APP_X', 'A', '[]']).catch(error => {
        expect(error.message).toHaveLength(2048);
        expect(error.message).toContain('***');
        expect(JSON.stringify(error.output)).not.toMatch(/fixture-secret-grant|private-access-token|private-password|private argv/);
      });
    } finally {
      if (previous === undefined) { delete process.env.OPENYIDA_AGENT_TASK_GRANT; }
      else { process.env.OPENYIDA_AGENT_TASK_GRANT = previous; }
    }
  });

  test('non-JSON stderr is bounded and redacted; empty failures omit argv', async () => {
    execFile.mockImplementationOnce((_node, _argv, _options, callback) => {
      callback(new Error('Command failed: private argv'), '', 'Bearer private-access-token');
    });
    await expect(execute(['create-form', 'validate-fields', '[]']))
      .rejects.toMatchObject({ message: 'Bearer ***' });
    execFile.mockImplementationOnce((_node, _argv, _options, callback) => {
      callback(Object.assign(new Error('Command failed: private argv'), { code: 'ETIMEDOUT' }), '', '');
    });
    await expect(execute(['create-form', 'validate-fields', '[]']))
      .rejects.toMatchObject({ message: 'Missing command result', output: { errorCode: 'ETIMEDOUT' } });
  });

  test.each([
    'request failed: {"accessToken":"private-access"}',
    'request failed: {"refresh_token":"private-refresh","other":"private-tail"}',
    'request failed: {"authorization":{"value":"private-nested"}}',
    'request failed: {"accessToken":"private-incomplete',
    'request failed: {"access\\u0054oken":"private-escaped-key"}',
    'request failed: {\\"accessToken\\":\\"private-escaped-json\\"}',
  ])('embedded quoted credentials never enter structured failure summaries: %s', async message => {
    execFile.mockImplementationOnce((_node, _argv, _options, callback) => {
      callback(new Error('Command failed: private argv'), '',
        JSON.stringify({ success: false, errorCode: 'CREATE_FORM_FAILED', errorMsg: message }));
    });
    expect.assertions(3);
    await execute(['create-form', 'validate-fields', '[]']).catch(error => {
      expect(error.message).toMatch(/^request failed: \{\\?\[REDACTED\]$/);
      expect(error.output.errorCode).toBe('CREATE_FORM_FAILED');
      expect(JSON.stringify(error.output)).not.toContain('private-');
    });
  });

  test('unparseable stderr with quoted secrets is discarded before batch state persistence', async () => {
    execFile.mockImplementationOnce((_node, _argv, _options, callback) => {
      callback(new Error('Command failed: private argv'), '', 'network failed: {"apiKey":"private-key"}\nbroken JSON');
    });
    const results = await schedule([{ key: 'a', dependsOn: [] }], 1, {},
      () => execute(['create-form', 'create', 'APP_X', 'A', '[]']), () => {});
    expect(results.a.error).toBe('network failed: {[REDACTED]');
    expect(JSON.stringify(results)).not.toContain('private-key');
  });

  test('merges partial resource identity with structured child diagnostics on failure', async () => {
    const stdout = 'progress\n{"formUuid":"FORM-HALF-A"}\n';
    const stderr = '{"success":false,"errorCode":"SAVE_FAILED","message":"schema save failed"}\n';
    expect(mergeCommandOutput(stdout, stderr, true)).toEqual({
      formUuid: 'FORM-HALF-A',
      success: false,
      errorCode: 'SAVE_FAILED',
      message: 'schema save failed',
    });

    const execFileImpl = jest.fn((runtime, argv, options, callback) => {
      callback(new Error('Command failed'), stdout, stderr);
    });
    await expect(execute(['create-form', 'create'], { execFile: execFileImpl })).rejects.toMatchObject({
      message: 'schema save failed',
      output: {
        formUuid: 'FORM-HALF-A',
        success: false,
        errorCode: 'SAVE_FAILED',
      },
    });
  });

  test.each([
    ['errorMsg', 'schema save failed'],
    ['error', 'HTTP 409 concurrent mutation'],
  ])('uses structured %s before raw stderr diagnostics', async (field, message) => {
    const execFileImpl = jest.fn((_command, _args, _options, callback) => {
      callback(new Error('Command failed'), '', `request failed\n${JSON.stringify({ success: false, [field]: message })}\n`);
    });

    await expect(execute(['create-form', 'create'], { execFile: execFileImpl }))
      .rejects.toMatchObject({ message, output: { success: false, errorMsg: message } });
  });
});
