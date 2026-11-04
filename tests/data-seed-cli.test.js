'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');

test.each(['optional', 'required', 'only-optional', 'filtered-empty'])(
  'CLI skips optional unsupported fields and verifies retained empty cells: %s', async scenario => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-seed-optional-'));
    const source = path.join(workspace, 'records.json');
    const records = scenario === 'only-optional' ? [{ address: { detail: 'omitted' } }]
      : [{ name: '客户甲', address: { detail: 'omitted' }, lines: [{ title: '交付', tags: [] }] },
        { name: '客户乙', address: {}, lines: [{ title: '运维', tags: [] }] }];
    fs.writeFileSync(source, JSON.stringify(records));
    const saved = new Map(), requests = [];
    const server = http.createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) {body += chunk;}
      const url = new URL(req.url, 'http://127.0.0.1'), endpoint = url.pathname.split('/').pop();
      requests.push(endpoint); const response = { success: true, content: {} };
      if (endpoint === 'getFormNavigationListByOrder.json') {response.content = [{ formUuid: 'FORM-TEST', title: 'Customers', formType: 'receipt' }];}
      else if (endpoint === 'getBindingByFormUuid.json') {response.content = { formUuid: 'FORM-TEST', procCode: '' };}
      else if (endpoint === 'getFormSchema.json') {response.content = { pages: [{ componentsTree: [
        { componentName: 'TextField', props: { fieldId: 'name' } },
        { componentName: 'UnsupportedField', props: { fieldId: 'address', validation: scenario === 'required' ? [{ type: 'required' }] : [] } },
        { componentName: 'TableField', props: { fieldId: 'lines' }, children: [
          { componentName: 'TextField', props: { fieldId: 'title' } },
          { componentName: 'CheckboxField', props: { fieldId: 'tags' } },
        ] },
      ] }] };}
      else if (endpoint === 'saveFormData.json') {
        const id = `FINST-${saved.size + 1}`; saved.set(id, JSON.parse(new URLSearchParams(body).get('formDataJson'))); response.content = id;
      } else if (endpoint === 'getFormDataById.json') {
        const id = url.searchParams.get('formInstId'), data = saved.get(id);
        response.content = { formInstId: id, modelUuid: 'FORM-TEST', formData: { name: data.name,
          lines: JSON.stringify(data.lines.map(row => ({ title: row.title }))) },
        instValue: JSON.stringify([{ componentName: 'TableField', fieldId: 'lines', fieldData: { value: data.lines.map((row, i) => [
          { componentName: 'TextField', fieldId: 'title', rowId: `ROW-${i}`, fieldData: { value: row.title } },
          ...(scenario === 'filtered-empty' ? [] : [{ componentName: 'CheckboxField', fieldId: 'tags', rowId: `ROW-${i}`, fieldData: {} }]),
        ]) } }]) };
      } else {response.success = false; response.errorMsg = 'Unexpected endpoint';}
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(response));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
      const result = await invoke(baseUrl, workspace, source);
      const output = JSON.parse(result.code === 0 ? result.stdout : result.stderr.slice(result.stderr.indexOf('{\n  "success"')));
      const writeCount = () => requests.filter(name => name === 'saveFormData.json').length;
      if (scenario === 'required') {
        expect(result.code).toBe(1); expect(output.details.fallback).toMatchObject({ allowed: true, readbackRequired: true });
        expect(writeCount()).toBe(0);
      } else if (scenario === 'only-optional') {
        expect(result.code).toBe(0); expect(output).toMatchObject({ skipped: true, completed: 0, readbackVerified: false, mutationPerformed: false });
        expect(writeCount()).toBe(0); expect(fs.existsSync(`${source}.seed-receipt.json`)).toBe(false);
      } else if (scenario === 'filtered-empty') {
        expect(result.code).toBe(1); expect(output).toMatchObject({ errorCode: 'DATA_SEED_INCOMPLETE', mutationAccepted: true });
        expect(writeCount()).toBe(1);
        expect((await invoke(baseUrl, workspace, source)).code).toBe(1); expect(writeCount()).toBe(1);
      } else {
        expect(result.code).toBe(0); expect(output).toMatchObject({ completed: 2, readbackVerified: true, requestedFieldsVerified: false });
        expect(output.skippedFields.map(field => field.recordIndex)).toEqual([0, 1]);
        expect([...saved.values()]).toEqual(records.map(({ address: _address, ...record }) => record));
        expect(writeCount()).toBe(2);
        expect(requests.filter(name => name === 'getFormDataById.json')).toHaveLength(2);
        const rerun = await invoke(baseUrl, workspace, source);
        expect(JSON.parse(rerun.stdout)).toMatchObject({ mutationPerformed: false, completed: 2 });
        expect(writeCount()).toBe(2);
      }
      expect(requests.filter(name => name === 'getFormSchema.json').length).toBe(scenario === 'optional' || scenario === 'filtered-empty' ? 2 : 1);
    } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(workspace, { recursive: true, force: true }); }
  }, 30000);

function invokeCommand(baseUrl, workspace, args) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) {delete env[key];}
  }
  Object.assign(env, { OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ACCESS_TOKEN: 'test-only-access',
    OPENYIDA_AUTH_DIR: path.join(workspace, 'auth'), OPENYIDA_ENDPOINT: baseUrl,
    OPENYIDA_TOKEN_CORP_ID: 'ding-test', OPENYIDA_TOKEN_USER_ID: 'user-test',
    OPENYIDA_LANG: 'en', OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0' });
  return new Promise((resolve, reject) => execFile(process.execPath, [BIN, ...args],
    { cwd: workspace, env, encoding: 'utf8', timeout: 20000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') {reject(error);}
      else {resolve({ code: error ? error.code : 0, stdout, stderr });}
    }));
}

function invoke(baseUrl, workspace, source, extra = []) {
  return invokeCommand(baseUrl, workspace, ['data', 'seed', 'form', 'APP_TEST', 'FORM-TEST',
    '--expect-form-name', 'Customers', '--records-file', source, '--json', ...extra]);
}

test.each(['valid', 'omitted-empty-child', 'invalid-child', 'duplicate', 'wrong-readback-target'])(
  'linked CLI enforces association contracts across nested/cross-app seed records: %s', async scenario => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-association-contract-'));
    const source = path.join(workspace, 'records.json');
    const ref = { appType: 'APP_REMOTE', formUuid: 'FORM-REMOTE', formType: 'receipt', instanceId: 'FINST-A', title: '客户甲' };
    const second = { ...ref, instanceId: 'FINST-B', title: '客户乙', subTitle: '杭州' };
    const rows = [{ related: [ref, second], lines: [{ customer: [ref] }] }, { related: [], lines: [{ customer: [] }] }];
    if (scenario === 'invalid-child') {rows[1].lines[0].customer = [{ ...ref, subTitle: {} }];}
    if (scenario === 'duplicate') {rows[1].related = [ref, { ...ref, title: '旧标题' }];}
    fs.writeFileSync(source, JSON.stringify(rows));
    const persisted = new Map(), requests = [];
    const server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) {body += chunk;}
      const url = new URL(req.url, 'http://127.0.0.1');
      const endpoint = url.pathname.split('/').pop();
      requests.push(endpoint);
      const result = { success: true, content: {} };
      if (endpoint === 'getFormNavigationListByOrder.json') {
        result.content = [{ formUuid: 'FORM-TEST', title: 'Customers', formType: 'receipt' }];
      } else if (endpoint === 'getBindingByFormUuid.json') {
        result.content = { formUuid: 'FORM-TEST', procCode: '' };
      } else if (endpoint === 'getFormSchema.json') {
        result.content = { pages: [{ componentsTree: [
          { componentName: 'AssociationFormField', props: { fieldId: 'related', multiple: true, associationForm: ref } },
          { componentName: 'TableField', props: { fieldId: 'lines' }, children: [
            { componentName: 'AssociationFormField', props: { fieldId: 'customer', multiple: false, associationForm: ref } },
          ] },
        ] }] };
      } else if (endpoint === 'saveFormData.json') {
        const id = `FINST-${persisted.size + 1}`;
        persisted.set(id, JSON.parse(new URLSearchParams(body).get('formDataJson')));
        result.content = id;
      } else if (endpoint === 'getFormDataById.json') {
        const id = url.searchParams.get('formInstId'), data = persisted.get(id);
        const projection = data.related.map(item => ({ ...item,
          ...(scenario === 'wrong-readback-target' ? { appType: 'APP_WRONG' } : {}),
        })).reverse();
        result.content = { formInstId: id, modelUuid: 'FORM-TEST', formData: {
          related_id: JSON.stringify(JSON.stringify(projection)),
          lines: JSON.stringify(data.lines.map(row => scenario === 'omitted-empty-child' && !row.customer.length
            ? {} : { customer_id: JSON.stringify(row.customer.map(item => ({ instanceId: item.instanceId }))) })),
        } };
        if (scenario === 'omitted-empty-child') {
          result.content.instValue = JSON.stringify([{ componentName: 'TableField', fieldId: 'lines', fieldData: { value:
            data.lines.map((row, index) => [{ componentName: 'AssociationFormField', fieldId: 'customer',
              rowId: `ROW-${index}`, fieldData: { value: row.customer } }]),
          } }]);
        }
      } else {
        result.success = false; result.errorMsg = 'Unexpected endpoint';
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
      const result = await invoke(baseUrl, workspace, source);
      expect(result.code).toBe(['valid', 'omitted-empty-child'].includes(scenario) ? 0 : 1);
      const output = result.code === 0 ? JSON.parse(result.stdout)
        : JSON.parse(result.stderr.slice(result.stderr.indexOf('{\n  "success"')));
      const writeCount = () => requests.filter(name => name === 'saveFormData.json').length;
      const readCount = () => requests.filter(name => name === 'getFormDataById.json').length;
      expect(requests.filter(name => name === 'getFormSchema.json')).toHaveLength(1);
      if (['valid', 'omitted-empty-child'].includes(scenario)) {
        expect(output).toMatchObject({ success: true, readbackVerified: true, completed: 2 });
        expect(writeCount()).toBe(2); expect(readCount()).toBe(2);
        expect(persisted.get('FINST-1').lines[0].customer).toEqual([{ ...ref, subTitle: '' }]);
        expect(persisted.get('FINST-2')).toEqual(rows[1]);
      } else if (scenario === 'wrong-readback-target') {
        expect(output).toMatchObject({ errorCode: 'DATA_SEED_INCOMPLETE', details: { causeCode: 'DATA_WRITE_READBACK_MISMATCH' } });
        expect(writeCount()).toBe(1); expect(readCount()).toBe(1);
        // A known accepted write may only be read again, never silently replayed.
        expect((await invoke(baseUrl, workspace, source)).code).toBe(1);
        expect(writeCount()).toBe(1); expect(readCount()).toBe(2);
      } else {
        expect(output.errorCode).toBe('DATA_SEED_PREFLIGHT_FAILED');
        expect(writeCount()).toBe(0); expect(readCount()).toBe(0);
        expect(fs.existsSync(`${source}.seed-receipt.json`)).toBe(false);
      }
      expect(requests.some(name => name.startsWith('searchForm'))).toBe(false);
    } finally {
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }, 30000);

test.each(['verified', 'preflight', 'check', 'readback', 'timeout'])('real CLI seed route and recovery: %s', async scenario => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-seed-cli-'));
  const source = path.join(workspace, 'records.json');
  fs.writeFileSync(source, JSON.stringify([
    { textField_name: 'private-example', dateField_due: '2026-11-03' },
    scenario === 'preflight' ? { unknownField: 'private-example' } : { textField_name: 'Another' },
  ]));
  const persisted = new Map();
  let writes = 0, readbacks = 0, mismatch = scenario === 'readback';
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) {body += chunk;}
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = url.pathname;
    const result = { success: true, content: {} };
    if (route.endsWith('getFormNavigationListByOrder.json')) {
      result.content = [{ formUuid: 'FORM-TEST', title: 'Customers', formType: 'receipt' }];
    } else if (route.endsWith('getFormSchema.json')) {
      result.content = { pages: [{ componentsTree: [
        { componentName: 'TextField', props: { fieldId: 'textField_name', label: 'Customer' } },
        { componentName: 'DateField', props: { fieldId: 'dateField_due' } },
      ] }] };
    } else if (route.endsWith('saveFormData.json')) {
      writes++;
      const id = `ID-${writes}`;
      persisted.set(id, JSON.parse(new URLSearchParams(body).get('formDataJson')));
      if (scenario === 'timeout') {req.socket.destroy(); return;}
      result.content = id;
    } else if (route.endsWith('getFormDataById.json')) {
      readbacks++;
      const id = url.searchParams.get('formInstId');
      result.content = { formInstId: id, modelUuid: 'FORM-TEST', formData: mismatch ? {} : persisted.get(id) };
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = await invoke(baseUrl, workspace, source, scenario === 'check' ? ['--check'] : []);
    if (['verified', 'check'].includes(scenario)) {
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject(scenario === 'check'
        ? { checked: true, mutationPerformed: false }
        : { completed: 2, readbackVerified: true, formInstIds: ['ID-1', 'ID-2'] });
    } else {
      expect(result.code).toBe(1);
      const start = result.stderr.indexOf('{\n  "success"');
      expect(start).toBeGreaterThanOrEqual(0);
      const payload = JSON.parse(result.stderr.slice(start));
      expect(payload.errorCode).toBe(scenario === 'preflight' ? 'DATA_SEED_PREFLIGHT_FAILED' : 'DATA_SEED_INCOMPLETE');
      expect(JSON.stringify(payload)).not.toContain('private-example');
      expect(JSON.stringify(payload)).not.toContain('test-only-access');
      expect(payload.details).toMatchObject(scenario === 'preflight' ? { sideEffectState: 'none' } : { retrySafe: false, failedIndex: 0 });
    }
    if (scenario === 'verified') {
      expect(persisted.get('ID-1').dateField_due).toBe(Date.parse('2026-11-03T00:00:00+08:00'));
      expect((await invoke(baseUrl, workspace, source)).code).toBe(0);
      expect(writes).toBe(2);
      expect(readbacks).toBe(2);
    } else if (scenario === 'readback') {
      expect(writes).toBe(1);
      mismatch = false;
      expect((await invoke(baseUrl, workspace, source)).code).toBe(0);
      expect(writes).toBe(2);
      expect(readbacks).toBe(3);
    } else if (scenario === 'timeout') {
      expect((await invoke(baseUrl, workspace, source)).code).toBe(1);
      expect(writes).toBe(1);
    } else {
      expect(writes).toBe(0);
      expect(fs.existsSync(`${source}.seed-receipt.json`)).toBe(false);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 30000);

test('verified customer receipt feeds associated records without ID lookup queries and retains business spot-checks', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-seed-association-cli-'));
  const customersFile = path.join(workspace, 'customers.json');
  const followupsFile = path.join(workspace, 'followups.json');
  // Duplicate display names and reverse-sorted IDs expose name/sort based mismatches.
  const customers = [{ textField_name: '同名客户', textField_region: '杭州' },
    { textField_name: '同名客户', textField_region: '上海' }];
  fs.writeFileSync(customersFile, JSON.stringify(customers));
  const persisted = new Map();
  const requests = [];
  const customerIds = ['FINST-Z', 'FINST-A'];
  let customerWrites = 0, followupWrites = 0;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) {body += chunk;}
    const url = new URL(req.url, 'http://127.0.0.1');
    const params = new URLSearchParams(body);
    const formUuid = url.searchParams.get('formUuid') || params.get('formUuid');
    const endpoint = url.pathname.split('/').pop();
    const request = { endpoint, formUuid, formInstId: url.searchParams.get('formInstId') };
    requests.push(request);
    const result = { success: true, content: {} };
    if (endpoint === 'getFormNavigationListByOrder.json') {
      result.content = [{ formUuid: 'FORM-CUSTOMER', title: '客户', formType: 'receipt' },
        { formUuid: 'FORM-FOLLOWUP', title: '跟进', formType: 'receipt' }];
    } else if (endpoint === 'getBindingByFormUuid.json') {
      result.content = { formUuid, procCode: '' };
    } else if (endpoint === 'getFormSchema.json') {
      const fields = formUuid === 'FORM-CUSTOMER'
        ? [['TextField', 'textField_name'], ['TextField', 'textField_region']]
        : [['TextField', 'textField_note'], ['AssociationFormField', 'associationFormField_customer']];
      result.content = { pages: [{ componentsTree: fields.map(([componentName, fieldId]) => ({
        componentName, props: { fieldId },
      })) }] };
    } else if (endpoint === 'saveFormData.json') {
      const id = formUuid === 'FORM-CUSTOMER' ? customerIds[customerWrites++] : `FOLLOWUP-${++followupWrites}`;
      const data = JSON.parse(params.get('formDataJson'));
      persisted.set(id, { formUuid, data });
      request.formInstId = id;
      result.content = id;
    } else if (endpoint === 'getFormDataById.json') {
      const id = url.searchParams.get('formInstId');
      const record = persisted.get(id);
      result.content = { formInstId: id, modelUuid: record.formUuid, formData: JSON.stringify(record.data) };
    } else {
      result.success = false;
      result.errorMsg = 'Unexpected endpoint';
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const seed = (formUuid, name, source) => invokeCommand(baseUrl, workspace,
    ['data', 'seed', 'form', 'APP_TEST', formUuid, '--expect-form-name', name, '--records-file', source, '--json']);
  const spotCheck = (formUuid, id) => invokeCommand(baseUrl, workspace,
    ['data', 'query', 'form', 'APP_TEST', formUuid, '--inst-id', id, '--json']);
  try {
    const created = await seed('FORM-CUSTOMER', '客户', customersFile);
    expect(created.code).toBe(0);
    const receipt = JSON.parse(created.stdout);
    expect(receipt).toMatchObject({ success: true, readbackVerified: true, completed: 2 });
    expect(receipt.items.every(item => item.status === 'verified')).toBe(true);
    const idsByIndex = new Map(receipt.items.map(item => [item.recordIndex, item.formInstId]));
    expect([...idsByIndex.values()]).toEqual(customerIds);
    expect(requests.filter(req => req.endpoint === 'getFormDataById.json')).toHaveLength(2);

    // Read the current command's receipt file as the fallback for truncated stdout.
    const stored = JSON.parse(fs.readFileSync(receipt.receiptFile, 'utf8'));
    expect(stored.target).toEqual(receipt.target);
    expect(stored.items).toEqual(receipt.items);

    const followups = [1, 0].map(recordIndex => ({
      textField_note: `${customers[recordIndex].textField_region}客户跟进`,
      associationFormField_customer: [{ appType: 'APP_TEST', formUuid: 'FORM-CUSTOMER', formType: 'receipt',
        instanceId: idsByIndex.get(recordIndex), title: customers[recordIndex].textField_name }],
    }));
    fs.writeFileSync(followupsFile, JSON.stringify(followups));
    const followed = await seed('FORM-FOLLOWUP', '跟进', followupsFile);
    expect(followed.code).toBe(0);
    const followReceipt = JSON.parse(followed.stdout);
    expect(followReceipt).toMatchObject({ success: true, readbackVerified: true, completed: 2 });
    expect(persisted.get('FOLLOWUP-1').data).toMatchObject({ textField_note: '上海客户跟进',
      associationFormField_customer: [{ instanceId: 'FINST-A', subTitle: '' }] });
    expect(persisted.get('FOLLOWUP-2').data.associationFormField_customer[0].instanceId).toBe('FINST-Z');
    expect(requests.filter(req => req.endpoint === 'getFormDataById.json')).toHaveLength(4);
    for (const [formUuid, id] of [['FORM-CUSTOMER', idsByIndex.get(1)], ['FORM-FOLLOWUP', followReceipt.formInstIds[0]]]) {
      const checked = await spotCheck(formUuid, id);
      expect(checked.code).toBe(0);
      const record = JSON.parse(checked.stdout).content;
      expect(record.formInstId).toBe(id);
      expect(JSON.parse(record.formData)).toEqual(persisted.get(id).data);
    }
    expect(requests.filter(req => req.endpoint === 'getFormDataById.json')).toHaveLength(6);
    expect(requests.filter(req => req.endpoint.startsWith('searchForm'))).toEqual([]);
    expect(requests.filter(req => req.endpoint === 'saveFormData.json')).toHaveLength(4);
    // Reusing the customer receipt must not create a duplicate or rediscover its IDs.
    expect((await seed('FORM-CUSTOMER', '客户', customersFile)).code).toBe(0);
    expect(customerWrites).toBe(2);
    expect(requests.filter(req => req.endpoint === 'getFormDataById.json')).toHaveLength(6);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 30000);
