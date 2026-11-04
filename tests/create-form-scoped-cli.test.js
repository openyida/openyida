'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const BIN = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');

function invoke(baseUrl, cwd, args) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^OPENYIDA_|QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) {delete env[key];}
  }
  Object.assign(env, { OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ACCESS_TOKEN: 'test-only-access',
    OPENYIDA_AUTH_DIR: path.join(cwd, 'auth'), OPENYIDA_ENDPOINT: baseUrl,
    OPENYIDA_TOKEN_CORP_ID: 'ding-test', OPENYIDA_TOKEN_USER_ID: 'user-test',
    OPENYIDA_LANG: 'en', OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NODE_NO_WARNINGS: '1', NO_COLOR: '1', FORCE_COLOR: '0' });
  return new Promise((resolve, reject) => execFile(process.execPath, [BIN, ...args],
    { cwd, env, encoding: 'utf8', timeout: 25000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') {reject(error);}
      else {resolve({ code: error ? error.code : 0, stdout, stderr });}
    }));
}

test.each(['complete', 'missing-child'])('public batch create/readback/resume keeps main/table scopes: %s', async scenario => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-scoped-form-cli-'));
  const source = path.join(workspace, 'forms.json');
  const relation = key => ({ key, type: 'AssociationFormField', label: '关联客户',
    associationForm: { appType: 'APP_TEST', formUuid: { $form: 'customer' },
      mainFieldId: { $form: 'customer', field: '客户名称' } } });
  const contractFields = [relation('customer'),
    { key: 'delivery', type: 'TableField', label: '交付明细', children: [relation('customer')] },
    { key: 'payment', type: 'TableField', label: '回款明细', children: [relation('customer')] }];
  fs.writeFileSync(source, JSON.stringify({ forms: [
    { key: 'customer', title: '客户档案', fields: [{ key: 'name', type: 'TextField', label: '客户名称' }] },
    { key: 'contract', title: '合同', fields: contractFields },
  ] }));
  const forms = new Map(), requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) {body += chunk;}
    const url = new URL(req.url, 'http://127.0.0.1'), params = new URLSearchParams(body);
    const endpoint = url.pathname.split('/').pop();
    const id = url.searchParams.get('formUuid') || params.get('formUuid') || params.get('navUuid');
    requests.push({ endpoint, id });
    const result = { success: true, content: {} };
    if (endpoint === 'getFormNavigationListByOrder.json') {
      result.content = [...forms].map(([formUuid, form], index) => ({ id: index + 1,
        navUuid: formUuid, formUuid, parentNavUuid: 'NAV-ROOT', parentId: 0, navType: 'PAGE',
        formType: 'receipt', title: { zh_CN: form.title, type: 'i18n' }, icon: form.icon,
        hidden: 'n', mobileHidden: 'n', formStatus: 'ONLINE', relateFormUuid: formUuid }));
    } else if (endpoint === 'saveFormSchemaInfo.json') {
      const formUuid = `FORM-LOCAL-${forms.size + 1}`;
      forms.set(formUuid, { title: params.get('formTitle') || params.get('title') || '合同', icon: '', schema: null });
      result.content = { formUuid };
    } else if (endpoint === 'saveFormSchema.json') {
      forms.get(id).schema = JSON.parse(params.get('content'));
      if (scenario === 'missing-child' && id === 'FORM-LOCAL-2') {
        const remove = nodes => nodes.forEach(node => {
          if (node.componentName === 'TableField' && node.props.label.zh_CN === '交付明细') {node.children = [];}
          else if (node.children) {remove(node.children);}
        });
        remove(forms.get(id).schema.pages[0].componentsTree);
      }
    } else if (endpoint === 'getFormSchema.json') {
      Object.assign(result, { appType: 'APP_TEST', formUuid: id, gmtModified: 101 });
      result.content = forms.get(id)?.schema || { gmtModified: 100 };
    } else if (endpoint === 'updateFormNavigation.json') {
      const form = forms.get(id) || [...forms.values()].at(-1);
      form.icon = params.get('icon');
    } else {
      result.success = false; result.errorMsg = `Unexpected endpoint: ${endpoint}`;
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const count = endpoint => requests.filter(request => request.endpoint === endpoint).length;
  try {
    const result = await invoke(baseUrl, workspace, ['create-form', 'batch', 'APP_TEST', source, '--concurrency', '1', '--json']);
    // Batch JSON is always written to stdout, including a partial failure.
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({ success: scenario === 'complete', results: {
      customer: { status: 'success', formUuid: 'FORM-LOCAL-1' },
      contract: { status: scenario === 'complete' ? 'success' : 'failed', formUuid: 'FORM-LOCAL-2' },
    } });
    expect(result.code).toBe(scenario === 'complete' ? 0 : 1);
    expect(count('saveFormSchemaInfo.json')).toBe(2);
    expect(count('saveFormSchema.json')).toBe(2);
    if (scenario === 'complete') {
      const fields = output.results.contract.fields.filter(field => field.label === '关联客户');
      expect(fields).toHaveLength(3);
      expect(new Set(fields.map(field => field.fieldId)).size).toBe(3);
      const customerId = output.results.customer.fields.find(field => field.label === '客户名称').fieldId;
      const resolved = JSON.parse(JSON.stringify(contractFields).replaceAll('{"$form":"customer","field":"客户名称"}', JSON.stringify(customerId))
        .replaceAll('{"$form":"customer"}', '"FORM-LOCAL-1"'));
      const resumed = await invoke(baseUrl, workspace, ['create-form', 'resume', 'APP_TEST', 'FORM-LOCAL-2', JSON.stringify(resolved), '--json']);
      expect(resumed.code).toBe(0);
      expect(JSON.parse(resumed.stdout)).toMatchObject({ success: true, addedFieldCount: 0, finalFieldCount: 5 });
      expect((await invoke(baseUrl, workspace, ['create-form', 'batch', 'APP_TEST', source, '--json'])).code).toBe(0);
      expect(count('saveFormSchemaInfo.json')).toBe(2);
      expect(count('saveFormSchema.json')).toBe(2);
    } else {
      expect(output.results.contract.errorCode).toBe('CREATE_FORM_RESUME_READBACK_MISMATCH');
      expect(output.results.contract.errorCode).not.toBe('CREATE_FORM_RESUME_CONFLICT');
    }
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 45000);
