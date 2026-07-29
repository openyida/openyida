'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const querystring = require('querystring');
const { spawnSync } = require('child_process');

const CREATE_FORM_PATH = path.join(__dirname, '..', 'lib', 'app', 'create-form.js');
const BIN_PATH = path.join(__dirname, '..', 'bin', 'yida.js');
const FORM_COMPILER_PATH = path.join(__dirname, '..', 'lib', 'app', 'services', 'form-compiler.js');
const FORM_VALIDATION_PATH = path.join(__dirname, '..', 'lib', 'app', 'services', 'form-validation.js');
const sourceCode = fs.readFileSync(CREATE_FORM_PATH, 'utf-8');
const compilerSourceCode = fs.readFileSync(FORM_COMPILER_PATH, 'utf-8');
const validationSourceCode = fs.readFileSync(FORM_VALIDATION_PATH, 'utf-8');
const createFormSplitSource = [
  'args.js',
  'commands.js',
  'definition-reader.js',
  'field-normalizers.js',
  'rule-builder.js',
  'api-path.js',
  'schema-patch.js',
  'validation-builder.js',
].map((file) => fs.readFileSync(path.join(__dirname, '..', 'lib', 'app', 'create-form', file), 'utf-8')).join('\n');
const combinedCreateFormSource = sourceCode + '\n' + createFormSplitSource;
const createForm = require('../lib/app/create-form');
const { createDefinitionReaders } = require('../lib/app/create-form/definition-reader');
const formCompiler = require('../lib/app/services/form-compiler');
const { verifyFieldBindings } = require('../lib/app/services/field-bindings');

// ── Bug #1: HTTP helpers must use master token auth / auto-login plumbing ──

describe('create-form.js imports', () => {
  test('uses token-first authRef HTTP helpers while keeping auto-login wrapper', () => {
    expect(sourceCode).toContain("require('../core/yida-client')");
    expect(sourceCode).toContain('createAuthRef');
    const requireLine = sourceCode
      .split('\n')
      .find((line) => line.includes('require("../core/utils")') || line.includes("require('../core/utils')"));
    expect(requireLine).toBeDefined();
    expect(requireLine).toContain('httpPost');
    expect(requireLine).toContain('httpGet');
    expect(requireLine).toContain('requestWithAutoLogin');
  });

  test('request wrappers delegate to token auth HTTP helpers', () => {
    const getBody = extractFunctionBody(sourceCode, 'sendGetRequest');
    const postBody = extractFunctionBody(sourceCode, 'sendPostRequest');
    const updateBody = extractFunctionBody(sourceCode, 'sendUpdateConfigRequest');
    expect(getBody).toContain('httpGet(baseUrl, requestPath, queryParams)');
    expect(postBody).toContain('httpPost(baseUrl, requestPath, postData');
    expect(updateBody).toMatch(/httpPost\(\s*baseUrl,/);
    expect(postBody).toContain('authRef && authRef.cookies');
    expect(updateBody).toContain('authRef && authRef.cookies');
    expect(postBody).not.toContain('Cookie:');
    expect(updateBody).not.toContain('Cookie:');
  });
});

describe('legacy process form bridge', () => {
  test('creates through shared form services without stdout and tolerates config warnings', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-form-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify({
      fields: [
        { key: 'requester', type: 'TextField', label: '申请人', required: true },
      ],
    }));

    jest.resetModules();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockUtils = {
      loadAuthData: jest.fn(() => ({
        csrf_token: 'csrf',
        cookies: [{ name: 'session', value: 'private' }],
        corp_id: 'corp',
        base_url: 'https://example.test',
        auth_mode: 'cookie',
        auth_source: 'cookie',
      })),
      httpPost: jest.fn((baseUrl, requestPath) => {
        if (requestPath.includes('saveFormSchemaInfo')) {
          return Promise.resolve({ success: true, content: { formUuid: 'FORM_BRIDGE' } });
        }
        if (requestPath.includes('/_view/query/formdesign/saveFormSchema.json')) {
          return Promise.resolve({ success: true });
        }
        if (requestPath.includes('updateFormConfig')) {
          return Promise.resolve({ success: false, errorMsg: 'config warning' });
        }
        return Promise.resolve({ success: true });
      }),
      requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
      loadCookieData: jest.fn(),
      triggerLogin: jest.fn(),
      resolveBaseUrl: jest.fn(() => 'https://example.test'),
      httpGet: jest.fn(() => Promise.resolve({ success: true, content: { gmtModified: 100 } })),
    };

    jest.doMock('../lib/core/utils', () => mockUtils);
    const isolatedCreateForm = require('../lib/app/create-form');
    const result = await isolatedCreateForm.createFormForLegacyProcess({
      baseUrl: 'https://example.test',
      cookies: [{ name: 'session', value: 'private' }],
      csrfToken: 'csrf',
      corpId: 'corp',
    }, {
      appType: 'APP_TEST',
      formTitle: '流程申请',
      fieldsJsonFile: fieldsPath,
    });

    expect(result).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formUuid: 'FORM_BRIDGE',
      formTitle: '流程申请',
      fieldCount: 1,
      configResult: { success: false, errorMsg: 'config warning' },
    });
    const saveCall = mockUtils.httpPost.mock.calls.find(function (call) {
      return call[1].includes('/_view/query/formdesign/saveFormSchema.json');
    });
    const savedSchema = JSON.parse(querystring.parse(saveCall[2]).content);
    const savedText = JSON.stringify(savedSchema);
    expect(savedText).toContain('textField_');
    expect(savedText).toContain('required');
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.dontMock('../lib/core/utils');
    jest.resetModules();
  });
});

describe('legacy create-form server revision isolation', () => {
  test('uses the adjacent exact-read revision even when a patch mutates root gmtModified', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Revision Test',
      fields: [{ key: 'name', type: 'TextField', label: 'Name' }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await isolatedCreateForm.run([
      'patch',
      'APP_TEST',
      'FORM_TEST',
      JSON.stringify([{ action: 'replace', path: '/gmtModified', value: 999 }]),
    ]);

    const saveCall = mockUtils.httpPost.mock.calls.find(call => call[1].includes('/saveFormSchema.json'));
    const saveBody = querystring.parse(saveCall[2]);
    expect(saveBody.gmtModified).toBe('100');
    expect(JSON.parse(saveBody.content).gmtModified).toBe(999);
    expect(mockUtils.requestWithAutoLogin).toHaveBeenCalledTimes(3);
    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('missing exact-read revision blocks save and config network calls', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Revision Test',
      fields: [{ key: 'name', type: 'TextField', label: 'Name' }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    }).schema;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'patch',
      'APP_TEST',
      'FORM_TEST',
      JSON.stringify([{ action: 'add', path: '/custom', value: true }]),
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_SCHEMA_REVISION_INVALID' });

    expect(mockUtils.httpPost).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });
});

describe('legacy create-form schema-aware update evidence', () => {
  test('label-based update resolves fields internally and emits compact evidence', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Schema Aware Update',
      fields: [
        { key: 'title', type: 'TextField', label: '事项名称' },
        { key: 'remark', type: 'TextField', label: '备注' },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_SCHEMA_AWARE',
    }).schema;
    initial.gmtModified = 100;
    const {
      isolatedCreateForm,
      mockUtils,
      consoleSpy,
      mockChalk,
    } = loadIsolatedLegacyForm(initial);

    await isolatedCreateForm.run([
      'update',
      'APP_TEST',
      'FORM_SCHEMA_AWARE',
      JSON.stringify([{ action: 'update', label: '备注', changes: { required: true } }]),
    ]);

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.formUuid === 'FORM_SCHEMA_AWARE');
    expect(payload).toMatchObject({
      success: true,
      formUuid: 'FORM_SCHEMA_AWARE',
      appType: 'APP_TEST',
      changesApplied: 1,
      changes: [
        {
          action: 'update',
          label: '备注',
          changedProps: 'required',
          resolved: {
            label: '备注',
            componentName: 'TextField',
            fieldId: expect.stringMatching(/^textField_/),
          },
          updatedProps: { required: true },
        },
      ],
    });
    const getSchemaCalls = mockUtils.httpGet.mock.calls.filter(call => call[1].includes('getFormSchema'));
    expect(getSchemaCalls).toHaveLength(1);
    const saveCall = mockUtils.httpPost.mock.calls.find(call => call[1].includes('/saveFormSchema.json'));
    const savedSchema = JSON.parse(querystring.parse(saveCall[2]).content);
    const savedContainer = findFormContainer(savedSchema.pages[0].componentsTree[0]);
    const savedRemark = savedContainer.children.find(child => child.props.label.zh_CN === '备注');
    expect(savedRemark.props.validation).toEqual(expect.arrayContaining([{ type: 'required' }]));
    expect(JSON.stringify(parseConsoleJsonPayloads(consoleSpy))).not.toContain('事项名称');
    const listItemText = mockChalk.listItem.mock.calls.map(call => call.join(' ')).join('\n');
    expect(listItemText).toContain('备注');
    expect(listItemText).not.toContain('事项名称');

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('ambiguous label update returns compact candidates and does not save', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Schema Aware Ambiguous',
      fields: [
        { key: 'remarkA', type: 'TextField', label: '备注' },
        { key: 'remarkB', type: 'TextareaField', label: '备注' },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_SCHEMA_AMBIGUOUS',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'update',
      'APP_TEST',
      'FORM_SCHEMA_AMBIGUOUS',
      JSON.stringify([{ action: 'update', label: '备注', changes: { required: true } }]),
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_FIELD_RESOLUTION_FAILED' });

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.error === 'CREATE_FORM_FIELD_RESOLUTION_FAILED');
    expect(payload).toMatchObject({
      success: false,
      appType: 'APP_TEST',
      formUuid: 'FORM_SCHEMA_AMBIGUOUS',
      diagnostics: [
        {
          action: 'update',
          code: 'CREATE_FORM_FIELD_AMBIGUOUS',
          label: '备注',
          candidates: [
            { label: '备注', componentName: 'TextField', fieldId: expect.stringMatching(/^textField_/) },
            { label: '备注', componentName: 'TextareaField', fieldId: expect.stringMatching(/^textareaField_/) },
          ],
        },
      ],
    });
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('/saveFormSchema.json'))).toHaveLength(0);
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('updateFormConfig'))).toHaveLength(0);

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('missing label update returns compact diagnostics and candidates', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Schema Aware Missing',
      fields: [{ key: 'title', type: 'TextField', label: '事项名称' }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_SCHEMA_MISSING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'update',
      'APP_TEST',
      'FORM_SCHEMA_MISSING',
      JSON.stringify([{ action: 'update', label: '备注', changes: { required: true } }]),
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_FIELD_RESOLUTION_FAILED' });

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.error === 'CREATE_FORM_FIELD_RESOLUTION_FAILED');
    expect(payload).toMatchObject({
      success: false,
      appType: 'APP_TEST',
      formUuid: 'FORM_SCHEMA_MISSING',
      diagnostics: [
        {
          action: 'update',
          code: 'CREATE_FORM_FIELD_NOT_FOUND',
          label: '备注',
          candidates: [
            { label: '事项名称', componentName: 'TextField', fieldId: expect.stringMatching(/^textField_/) },
          ],
        },
      ],
    });
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('/saveFormSchema.json'))).toHaveLength(0);

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });
});

describe('legacy create-form compact field resolver', () => {
  test('add-option missing field returns compact diagnostics and does not save', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Compact Add Option Missing',
      fields: [
        { key: 'status', type: 'SelectField', label: '状态', options: ['待处理'] },
        { key: 'title', type: 'TextField', label: '事项名称' },
        { key: 'owner', type: 'TextField', label: '负责人' },
        { key: 'priority', type: 'SelectField', label: '优先级', options: ['普通'] },
        { key: 'remark', type: 'TextareaField', label: '备注' },
        { key: 'city', type: 'TextField', label: '城市' },
        { key: 'amount', type: 'NumberField', label: '金额' },
        { key: 'date', type: 'DateField', label: '日期' },
        { key: 'dept', type: 'DepartmentSelectField', label: '部门' },
        { key: 'attachment', type: 'AttachmentField', label: '附件' },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_ADD_OPTION_MISSING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy, mockChalk } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'add-option',
      'APP_TEST',
      'FORM_ADD_OPTION_MISSING',
      '不存在字段',
      '已完成',
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_FIELD_RESOLUTION_FAILED' });

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.error === 'CREATE_FORM_FIELD_RESOLUTION_FAILED');
    expect(payload).toMatchObject({
      success: false,
      appType: 'APP_TEST',
      formUuid: 'FORM_ADD_OPTION_MISSING',
      diagnostics: [
        {
          action: 'add-option',
          code: 'CREATE_FORM_FIELD_NOT_FOUND',
          label: '不存在字段',
          candidates: expect.any(Array),
        },
      ],
    });
    expect(payload.diagnostics[0].candidates.length).toBeLessThanOrEqual(8);
    expect(payload).not.toHaveProperty('availableFields');
    expect(JSON.stringify(payload)).not.toContain('availableFields');
    expect(mockChalk.hint.mock.calls.map(call => call.join(' ')).join('\n')).not.toContain('可用字段');
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('/saveFormSchema.json'))).toHaveLength(0);
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('updateFormConfig'))).toHaveLength(0);

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('bind-datasource missing field returns compact diagnostics and does not save', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Compact Bind Missing',
      fields: [
        { key: 'status', type: 'SelectField', label: '状态', options: ['待处理'] },
        { key: 'title', type: 'TextField', label: '事项名称' },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_BIND_MISSING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy, mockChalk } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'bind-datasource',
      'APP_TEST',
      'FORM_BIND_MISSING',
      '不存在字段',
      JSON.stringify({ url: '/gateway/options.json', labelField: 'name', valueField: 'id' }),
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_FIELD_RESOLUTION_FAILED' });

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.error === 'CREATE_FORM_FIELD_RESOLUTION_FAILED');
    expect(payload).toMatchObject({
      success: false,
      appType: 'APP_TEST',
      formUuid: 'FORM_BIND_MISSING',
      diagnostics: [
        {
          action: 'bind-datasource',
          code: 'CREATE_FORM_FIELD_NOT_FOUND',
          label: '不存在字段',
          candidates: expect.any(Array),
        },
      ],
    });
    expect(payload).not.toHaveProperty('availableFields');
    expect(JSON.stringify(payload)).not.toContain('availableFields');
    expect(mockChalk.hint.mock.calls.map(call => call.join(' ')).join('\n')).not.toContain('可用字段');
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('/saveFormSchema.json'))).toHaveLength(0);
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('updateFormConfig'))).toHaveLength(0);

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('validation success emits compact resolved evidence without unrelated field labels', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Compact Validation Evidence',
      fields: [
        { key: 'title', type: 'TextField', label: '事项名称' },
        { key: 'remark', type: 'TextField', label: '备注' },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_VALIDATION_EVIDENCE',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, consoleSpy } = loadIsolatedLegacyForm(initial);

    await isolatedCreateForm.run([
      'validation',
      'APP_TEST',
      'FORM_VALIDATION_EVIDENCE',
      JSON.stringify([{ field: '备注', type: 'required' }]),
    ]);

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.formUuid === 'FORM_VALIDATION_EVIDENCE');
    expect(payload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formUuid: 'FORM_VALIDATION_EVIDENCE',
      validationsApplied: 1,
      rules: [
        {
          type: 'required',
          fieldLabel: '备注',
          resolved: {
            label: '备注',
            componentName: 'TextField',
            fieldId: expect.stringMatching(/^textField_/),
          },
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('事项名称');

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('validation missing field returns compact diagnostics and does not save', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Compact Validation Missing',
      fields: [
        { key: 'title', type: 'TextField', label: '事项名称' },
        { key: 'remark', type: 'TextField', label: '备注' },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_VALIDATION_MISSING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'validation',
      'APP_TEST',
      'FORM_VALIDATION_MISSING',
      JSON.stringify([{ field: '不存在字段', type: 'required' }]),
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_FIELD_RESOLUTION_FAILED' });

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.error === 'CREATE_FORM_FIELD_RESOLUTION_FAILED');
    expect(payload).toMatchObject({
      success: false,
      appType: 'APP_TEST',
      formUuid: 'FORM_VALIDATION_MISSING',
      diagnostics: [
        {
          code: 'CREATE_FORM_FIELD_NOT_FOUND',
          label: '不存在字段',
          candidates: expect.any(Array),
        },
      ],
    });
    expect(payload).not.toHaveProperty('availableFields');
    expect(JSON.stringify(payload)).not.toContain('availableFields');
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('/saveFormSchema.json'))).toHaveLength(0);
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('updateFormConfig'))).toHaveLength(0);

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('rule missing field returns compact diagnostics and does not save', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Compact Rule Missing',
      fields: [
        { key: 'status', type: 'SelectField', label: '状态', options: ['待处理'] },
        { key: 'remark', type: 'TextField', label: '备注' },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_RULE_MISSING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'rule',
      'APP_TEST',
      'FORM_RULE_MISSING',
      JSON.stringify([{ type: 'visibility', source: '不存在字段', target: '备注', equals: '待处理' }]),
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_FIELD_RESOLUTION_FAILED' });

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.error === 'CREATE_FORM_FIELD_RESOLUTION_FAILED');
    expect(payload).toMatchObject({
      success: false,
      appType: 'APP_TEST',
      formUuid: 'FORM_RULE_MISSING',
      diagnostics: [
        {
          code: 'CREATE_FORM_FIELD_NOT_FOUND',
          label: '不存在字段',
          candidates: expect.any(Array),
        },
      ],
    });
    expect(payload).not.toHaveProperty('availableFields');
    expect(JSON.stringify(payload)).not.toContain('availableFields');
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('/saveFormSchema.json'))).toHaveLength(0);
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('updateFormConfig'))).toHaveLength(0);

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('rule resolves tableLabel-scoped fields and emits compact evidence', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Compact Rule Table Evidence',
      fields: [
        { key: 'title', type: 'TextField', label: '事项名称' },
        { key: 'status', type: 'SelectField', label: '状态', options: ['待处理'] },
        { key: 'remark', type: 'TextField', label: '备注' },
        {
          key: 'items',
          type: 'TableField',
          label: '明细',
          children: [
            { key: 'status', type: 'SelectField', label: '状态', options: ['待处理'] },
            { key: 'remark', type: 'TextField', label: '备注' },
          ],
        },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_RULE_TABLE_EVIDENCE',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await isolatedCreateForm.run([
      'rule',
      'APP_TEST',
      'FORM_RULE_TABLE_EVIDENCE',
      JSON.stringify([{
        type: 'visibility',
        tableLabel: '明细',
        source: '状态',
        target: { tableLabel: '明细', label: '备注' },
        equals: '待处理',
      }]),
    ]);

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.formUuid === 'FORM_RULE_TABLE_EVIDENCE');
    expect(payload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formUuid: 'FORM_RULE_TABLE_EVIDENCE',
      rulesApplied: 1,
      rules: [
        {
          type: 'visibility',
          resolved: {
            source: {
              label: '状态',
              componentName: 'SelectField',
              path: ['明细', '状态'],
              tableAncestors: [{ label: '明细', componentName: 'TableField' }],
            },
            targets: [
              {
                label: '备注',
                componentName: 'TextField',
                path: ['明细', '备注'],
                tableAncestors: [{ label: '明细', componentName: 'TableField' }],
              },
            ],
          },
        },
      ],
      eventBindings: [
        {
          label: '状态',
          event: 'onChange',
          resolved: {
            label: '状态',
            componentName: 'SelectField',
            path: ['明细', '状态'],
            tableAncestors: [{ label: '明细', componentName: 'TableField' }],
          },
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('事项名称');

    const saveCall = mockUtils.httpPost.mock.calls.find(call => call[1].includes('/saveFormSchema.json'));
    const savedSchema = JSON.parse(querystring.parse(saveCall[2]).content);
    const savedContainer = findFormContainer(savedSchema.pages[0].componentsTree[0]);
    const topLevelStatus = savedContainer.children.find(child => child.props.label.zh_CN === '状态');
    const table = savedContainer.children.find(child => child.props.label.zh_CN === '明细');
    const tableStatus = table.children.find(child => child.props.label.zh_CN === '状态');
    expect(topLevelStatus.props.onChange).toBeUndefined();
    expect(tableStatus.props.onChange).toMatchObject({
      type: 'actionRef',
      name: expect.stringMatching(/^openyidaRuleChange_/),
    });

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('add-option can resolve a target field by fieldId and emits compact evidence', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Compact FieldId Success',
      fields: [
        { key: 'status', type: 'SelectField', label: '状态', options: ['待处理'] },
        { key: 'title', type: 'TextField', label: '事项名称' },
      ],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_FIELD_ID_SUCCESS',
    }).schema;
    initial.gmtModified = 100;
    const formContainer = findFormContainer(initial.pages[0].componentsTree[0]);
    const statusFieldId = formContainer.children.find(child => child.props.label.zh_CN === '状态').props.fieldId;
    const { isolatedCreateForm, consoleSpy } = loadIsolatedLegacyForm(initial);

    await isolatedCreateForm.run([
      'add-option',
      'APP_TEST',
      'FORM_FIELD_ID_SUCCESS',
      statusFieldId,
      '已完成',
    ]);

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.formUuid === 'FORM_FIELD_ID_SUCCESS');
    expect(payload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formUuid: 'FORM_FIELD_ID_SUCCESS',
      fieldLabel: statusFieldId,
      resolved: {
        label: '状态',
        fieldId: statusFieldId,
        componentName: 'SelectField',
      },
      added: ['已完成'],
    });
    expect(JSON.stringify(payload)).not.toContain('事项名称');

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('update with missing fieldId returns compact diagnostics and does not save', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Compact FieldId Missing',
      fields: [{ key: 'title', type: 'TextField', label: '事项名称' }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_FIELD_ID_MISSING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'update',
      'APP_TEST',
      'FORM_FIELD_ID_MISSING',
      JSON.stringify([{ action: 'update', fieldId: 'textField_missing', changes: { required: true } }]),
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_FIELD_RESOLUTION_FAILED' });

    const payload = parseConsoleJsonPayloads(consoleSpy).find(item => item && item.error === 'CREATE_FORM_FIELD_RESOLUTION_FAILED');
    expect(payload).toMatchObject({
      success: false,
      appType: 'APP_TEST',
      formUuid: 'FORM_FIELD_ID_MISSING',
      diagnostics: [
        {
          action: 'update',
          code: 'CREATE_FORM_FIELD_ID_NOT_FOUND',
          fieldId: 'textField_missing',
          candidates: expect.any(Array),
        },
      ],
    });
    expect(payload.diagnostics[0].candidates.length).toBeLessThanOrEqual(8);
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('/saveFormSchema.json'))).toHaveLength(0);
    expect(mockUtils.httpPost.mock.calls.filter(call => call[1].includes('updateFormConfig'))).toHaveLength(0);

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });
});

function loadIsolatedLegacyForm(schema) {
  jest.resetModules();
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const mockUtils = {
    loadAuthData: jest.fn(() => ({
      csrf_token: 'csrf',
      cookies: [{ name: 'session', value: 'private' }],
      corp_id: 'corp',
      base_url: 'https://example.test',
      auth_mode: 'cookie',
      auth_source: 'cookie',
    })),
    loadCookieData: jest.fn(() => ({
      csrf_token: 'csrf',
      cookies: [{ name: 'session', value: 'private' }],
      corp_id: 'corp',
    })),
    triggerLogin: jest.fn(),
    resolveBaseUrl: jest.fn(() => 'https://example.test'),
    httpGet: jest.fn(() => Promise.resolve({ success: true, content: schema })),
    httpPost: jest.fn((baseUrl, requestPath) => {
      if (requestPath.includes('updateFormConfig')) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    }),
    requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
    detectActiveTool: jest.fn(() => null),
  };
  const mockChalk = {
    banner: jest.fn(),
    step: jest.fn(),
    label: jest.fn(),
    success: jest.fn(),
    fail: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    result: jest.fn(),
    usage: jest.fn(),
    hint: jest.fn(),
    listItem: jest.fn(),
  };
  jest.doMock('../lib/core/utils', () => mockUtils);
  jest.doMock('../lib/core/chalk', () => mockChalk);
  return {
    isolatedCreateForm: require('../lib/app/create-form'),
    mockUtils,
    mockChalk,
    consoleSpy,
  };
}

// ── Bug #2: generateFieldId 必须使用递增计数器确保唯一性 ──

describe('generateFieldId uniqueness', () => {
  test('generateFieldId uses an incrementing counter variable', () => {
    expect(compilerSourceCode).toContain('_fieldIdCounter');
  });

  test('generateFieldId increments the counter on each call', () => {
    const functionBody = extractFunctionBody(compilerSourceCode, 'generateFieldId');
    expect(functionBody).toBeDefined();
    expect(functionBody).toContain('_fieldIdCounter++');
  });

  test('counter value is included in the generated suffix', () => {
    const functionBody = extractFunctionBody(compilerSourceCode, 'generateFieldId');
    expect(functionBody).toBeDefined();
    expect(functionBody).toContain('counterPart');
    expect(functionBody).toMatch(/suffix\s*=.*counterPart/);
  });
});

// ── Bug #3: buildFormSchema 必须包含 componentDidMount 生命周期 ──

describe('buildFormSchema lifeCycles', () => {
  test('lifeCycles includes componentDidMount with actionRef to didMount', () => {
    const formSchemaFunction = extractFunctionBody(compilerSourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();

    // 检查 lifeCycles 中包含 componentDidMount 配置
    expect(formSchemaFunction).toContain('componentDidMount');
    expect(formSchemaFunction).toContain("name: 'didMount'");
    expect(formSchemaFunction).toContain("type: 'actionRef'");
  });
});

// ── Bug #4: buildFormSchema 不能有重复嵌套的 FormContainer ──

describe('buildFormSchema FormContainer structure', () => {
  test('FormContainer does not nest another FormContainer as direct child', () => {
    const formSchemaFunction = extractFunctionBody(compilerSourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();

    const formContainerMatches = formSchemaFunction.match(/componentName:\s*['"]FormContainer['"]/g) || [];
    expect(formContainerMatches.length).toBe(1);
  });

  test('RootContent has exactly one FormContainer child', () => {
    const formSchemaFunction = extractFunctionBody(compilerSourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();

    const rootContentIndex = formSchemaFunction.search(/['"]RootContent['"]/);
    expect(rootContentIndex).toBeGreaterThan(-1);

    const afterRootContent = formSchemaFunction.slice(rootContentIndex);
    const formContainerCount = (afterRootContent.match(/componentName:\s*['"]FormContainer['"]/g) || []).length;
    expect(formContainerCount).toBe(1);
  });
});

describe('component alias schema support', () => {
  test('buildFormSchema writes component alias metadata at page level', () => {
    const formSchemaFunction = extractFunctionBody(compilerSourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();
    expect(compilerSourceCode).toContain('function normalizeComponentAlias(');
    expect(compilerSourceCode).toContain('function buildComponentAliasItems(');
    expect(formSchemaFunction).toContain('componentAliasItems');
    expect(formSchemaFunction).toContain('items: componentAliasItems');
  });

  test('field definitions accept alias and componentAlias without writing them into props', () => {
    expect(compilerSourceCode).toContain('field.componentAlias');
    expect(compilerSourceCode).toContain('field.component_alias');
    expect(compilerSourceCode).toContain('field.alias');
    expect(compilerSourceCode).toContain('component[COMPONENT_ALIAS_META]');
  });

  test('rules and validations can resolve component aliases as field refs', () => {
    expect(sourceCode).toContain('function buildComponentAliasMaps(');
    expect(sourceCode).toContain('aliasByFieldId');
    expect(sourceCode).toContain('fieldIdByAlias');
    expect(sourceCode).toContain('byRef[descriptor.alias]');
    expect(sourceCode).toContain('fieldMap[descriptor.alias]');
  });
});

describe('form presentation components', () => {
  test('buildFormSchema supports Divider, ColumnContainer and PageSection using vc-deep-yida component names', () => {
    const fields = [
      {
        type: 'PageSection',
        label: '基本信息',
        showHeadDivider: true,
        children: [
          {
            type: 'ColumnContainer',
            layout: '6:6',
            columnGap: '16px',
            rowGap: '16px',
            display: 'VERTICAL',
            children: [
              [{ type: 'TextField', label: '姓名' }],
              [{ type: 'NumberField', label: '年龄' }],
            ],
          },
          {
            type: 'Divider',
            title: '联系方式',
            dividerType: 'double-color-trapezoid',
            showTitle: true,
            colorType: 'custom',
            backgroundColor: '#0089ff',
            secondaryColor: '#cce5ff',
          },
        ],
      },
    ];

    const schema = createForm._private.buildFormSchema(
      '布局测试',
      fields,
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );
    const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);

    expect(schema.pages[0].componentsMap.map((item) => item.componentName)).toEqual(expect.arrayContaining([
      'PageSection',
      'ColumnsLayout',
      'Column',
      'Divider',
      'TextField',
      'NumberField',
    ]));
    expect(formContainer.children[0]).toMatchObject({
      componentName: 'PageSection',
      props: {
        behavior: 'NORMAL',
        showHeader: true,
        showHeadDivider: true,
        sectionHeaderStyle: 'origin',
      },
    });
    expect(formContainer.children[0].props.label).toBeUndefined();
    expect(formContainer.children[0].props.title.zh_CN).toBe('基本信息');

    const columnsLayout = formContainer.children[0].children[0];
    expect(columnsLayout).toMatchObject({
      componentName: 'ColumnsLayout',
      props: {
        layout: '6:6',
        columnGap: '16px',
        rowGap: '16px',
        display: 'VERTICAL',
      },
    });
    expect(columnsLayout.children.map((child) => child.componentName)).toEqual(['Column', 'Column']);
    expect(columnsLayout.children[0].children[0].componentName).toBe('TextField');
    expect(columnsLayout.children[1].children[0].componentName).toBe('NumberField');

    const divider = formContainer.children[0].children[1];
    expect(divider).toMatchObject({
      componentName: 'Divider',
      props: {
        behavior: 'NORMAL',
        type: 'double-color-trapezoid',
        showTitle: true,
        colorType: 'custom',
        backgroundColor: '#0089ff',
        secondaryColor: '#cce5ff',
      },
    });
    expect(divider.props.label).toBeUndefined();
    expect(divider.props.title.zh_CN).toBe('联系方式');
  });

  test('field definition type can come from componentName or componentType without charAt crashes', () => {
    const fields = [
      {
        componentName: 'ColumnContainer',
        layout: '6:6',
        children: [
          [{ componentType: 'TextField', label: '姓名' }],
          [{ componentName: 'NumberField', label: '年龄' }],
        ],
      },
    ];

    expect(() => createForm._private.validateFormFieldDefinitions(fields)).not.toThrow();
    expect(createForm._private.countDataFieldDefinitions(fields)).toBe(2);

    const schema = createForm._private.buildFormSchema(
      '低层类型兼容测试',
      fields,
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );
    const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);
    const columnsLayout = formContainer.children[0];

    expect(columnsLayout.componentName).toBe('ColumnsLayout');
    expect(columnsLayout.children[0].children[0].componentName).toBe('TextField');
    expect(columnsLayout.children[1].children[0].componentName).toBe('NumberField');
  });

  test('field definition validation reports missing nested type with a stable path', () => {
    const fields = [
      {
        type: 'ColumnContainer',
        children: [
          [{ type: 'TextField', label: '姓名' }],
          [{ label: '缺类型字段' }],
        ],
      },
    ];

    expect(() => createForm._private.validateFormFieldDefinitions(fields)).toThrow(expect.objectContaining({
      code: 'CREATE_FORM_FIELD_TYPE_MISSING',
      details: expect.objectContaining({
        path: 'fields[0].children[1][0]',
        label: '缺类型字段',
      }),
    }));
  });

  test('AssociationFormField requires associationForm.formUuid in nested definitions', () => {
    expect(() => createForm._private.validateFormFieldDefinitions([
      {
        type: 'TableField',
        label: '明细',
        children: [
          { type: 'AssociationFormField', label: '关联客户', associationForm: { formUuid: '' } },
        ],
      },
    ])).toThrow(expect.objectContaining({
      code: 'CREATE_FORM_ASSOCIATION_FORM_UUID_MISSING',
      details: expect.objectContaining({
        path: 'fields[0].children[0]',
        label: '关联客户',
      }),
    }));

    expect(() => createForm._private.validateFormFieldDefinitions([
      {
        type: 'ColumnContainer',
        children: [
          [
            { type: 'AssociationFormField', label: '关联订单', associationForm: {} },
          ],
        ],
      },
    ])).toThrow(expect.objectContaining({
      code: 'CREATE_FORM_ASSOCIATION_FORM_UUID_MISSING',
      details: expect.objectContaining({
        path: 'fields[0].children[0][0]',
        label: '关联订单',
      }),
    }));

    expect(() => createForm._private.validateFormFieldDefinitions([
      {
        type: 'AssociationFormField',
        label: '关联车辆',
        associationForm: { formUuid: 'FORM_VEHICLE' },
      },
    ])).not.toThrow();
  });

  test('field JSON validator rejects three-dimensional ColumnContainer children with a stable diagnostic path', () => {
    const diagnostics = createForm._private.collectFormFieldValidationDiagnostics([
      {
        type: 'ColumnContainer',
        children: [
          [[{ type: 'TextField', label: '姓名' }]],
        ],
      },
    ]);

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
        path: 'fields[0].children[0][0]',
        expected: 'FieldDefinition object',
        actual: 'array',
        suggestion: expect.any(String),
      }),
    ]));

    expect(() => createForm._private.validateFormFieldDefinitions([
      {
        type: 'ColumnContainer',
        children: [
          [[{ type: 'TextField', label: '姓名' }]],
        ],
      },
    ])).toThrow(expect.objectContaining({
      code: 'CREATE_FORM_INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
      details: expect.objectContaining({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
            path: 'fields[0].children[0][0]',
          }),
        ]),
      }),
    }));
  });

  test('field JSON validator accepts correct two-dimensional ColumnContainer children', () => {
    const diagnostics = createForm._private.collectFormFieldValidationDiagnostics([
      {
        type: 'ColumnContainer',
        children: [
          [{ type: 'TextField', label: '姓名' }],
          [{ type: 'SelectField', label: '状态', dataSource: ['待处理'] }],
        ],
      },
    ]);

    expect(diagnostics).toEqual([]);
  });

  test('field JSON validator accepts Column object children for ColumnContainer and ColumnsLayout', () => {
    const fields = [
      {
        type: 'ColumnContainer',
        layout: '6:6',
        children: [
          {
            type: 'Column',
            children: [
              { type: 'TextField', label: '姓名' },
            ],
          },
          {
            componentName: 'Column',
            children: [
              { type: 'SelectField', label: '状态', dataSource: ['待处理'] },
            ],
          },
        ],
      },
      {
        type: 'ColumnsLayout',
        layout: '12',
        children: [
          {
            type: 'Column',
            children: [
              { componentType: 'NumberField', label: '金额' },
            ],
          },
        ],
      },
    ];

    expect(createForm._private.collectFormFieldValidationDiagnostics(fields)).toEqual([]);
    expect(() => createForm._private.validateFormFieldDefinitions(fields)).not.toThrow();

    const schema = createForm._private.buildFormSchema(
      'Column 对象兼容测试',
      fields,
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );
    const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);

    expect(formContainer.children[0].children[0].children[0].componentName).toBe('TextField');
    expect(formContainer.children[0].children[1].children[0].componentName).toBe('SelectField');
    expect(formContainer.children[1].children[0].children[0].componentName).toBe('NumberField');
  });

  test('field JSON gate intentionally rejects top-level Column without reporting unsupported type', () => {
    const diagnostics = createForm._private.collectFormFieldValidationDiagnostics([
      {
        type: 'Column',
        children: [
          { type: 'TextField', label: '姓名' },
        ],
      },
    ]);

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'COLUMN_OUTSIDE_COLUMN_CONTAINER',
        path: 'fields[0]',
      }),
    ]));
    expect(diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'UNSUPPORTED_FIELD_TYPE',
      }),
    ]));
  });

  test('field JSON validator accepts one-dimensional TableField children and rejects nested TableField', () => {
    expect(createForm._private.collectFormFieldValidationDiagnostics([
      {
        type: 'TableField',
        label: '明细',
        children: [
          { type: 'TextField', label: '项目' },
        ],
      },
    ])).toEqual([]);

    expect(createForm._private.collectFormFieldValidationDiagnostics([
      {
        type: 'TableField',
        label: '明细',
        children: [
          { type: 'TableField', label: '嵌套明细', children: [] },
        ],
      },
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'NESTED_TABLE_FIELD_UNSUPPORTED',
        path: 'fields[0].children[0]',
      }),
    ]));
  });

  test('field JSON validator rejects SelectField without fixed or remote data source', () => {
    expect(createForm._private.collectFormFieldValidationDiagnostics([
      { type: 'SelectField', label: '状态' },
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'OPTION_FIELD_DATASOURCE_MISSING',
        path: 'fields[0].dataSource',
      }),
    ]));
  });

  test('field JSON validator does not require Divider label', () => {
    expect(createForm._private.collectFormFieldValidationDiagnostics([
      { type: 'Divider', title: '基础信息', dividerType: 'solid' },
    ])).toEqual([]);
  });

  test('field JSON validator accepts non-empty i18n object labels and rejects empty labels', () => {
    expect(createForm._private.collectFormFieldValidationDiagnostics([
      { type: 'TextField', label: { zh_CN: '姓名', en_US: 'Name' } },
      {
        type: 'PageSection',
        label: { zh_CN: '基础信息', en_US: 'Basic Info' },
        children: [
          { type: 'TextField', label: { zh_CN: '手机号' } },
        ],
      },
    ])).toEqual([]);

    expect(createForm._private.collectFormFieldValidationDiagnostics([
      { type: 'TextField', label: '' },
      { type: 'TextField', label: {} },
      { type: 'TextField' },
      { type: 'TextField', label: { type: 'i18n', envLocale: 'zh_CN', key: 'name' } },
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'BUSINESS_FIELD_LABEL_MISSING',
        path: 'fields[0].label',
      }),
      expect.objectContaining({
        code: 'BUSINESS_FIELD_LABEL_MISSING',
        path: 'fields[1].label',
      }),
      expect.objectContaining({
        code: 'BUSINESS_FIELD_LABEL_MISSING',
        path: 'fields[2].label',
      }),
      expect.objectContaining({
        code: 'BUSINESS_FIELD_LABEL_MISSING',
        path: 'fields[3].label',
      }),
    ]));
  });

  test('TableField children reject presentation components before schema build', () => {
    const fields = [
      {
        type: 'TableField',
        label: '明细',
        children: [
          { type: 'Divider', title: '子表分组' },
        ],
      },
    ];

    expect(() => createForm._private.validateFormFieldDefinitions(fields)).toThrow(expect.objectContaining({
      code: 'CREATE_FORM_TABLE_CHILD_PRESENTATION_UNSUPPORTED',
      details: expect.objectContaining({
        path: 'fields[0].children[0]',
        title: '子表分组',
      }),
    }));
  });

  test('counts only business fields inside presentation containers', () => {
    expect(createForm._private.countDataFieldDefinitions([
      { type: 'Divider', title: '分割线' },
      {
        type: 'GroupContainer',
        label: '分组',
        children: [
          {
            type: 'ColumnContainer',
            layout: '6:6',
            children: [
              [{ type: 'TextField', label: '姓名' }],
              [{ type: 'SelectField', label: '状态' }],
            ],
          },
        ],
      },
    ])).toBe(2);
  });

  test('Divider defaults to bold-with-thin so generated enterprise forms use the recommended section style', () => {
    const schema = createForm._private.buildFormSchema(
      '分割线测试',
      [{ type: 'Divider', title: '默认分割线' }],
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );
    const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);
    const divider = formContainer.children[0];

    expect(divider.componentName).toBe('Divider');
    expect(divider.props.type).toBe('bold-with-thin');
    expect(divider.props.title.zh_CN).toBe('默认分割线');
  });

  test('Divider only preserves supported type values and falls back to the priority default', () => {
    const schema = createForm._private.buildFormSchema(
      '分割线样式白名单测试',
      [
        { type: 'Divider', title: '品牌分组', dividerType: 'left-dot-title' },
        { type: 'Divider', title: '强分区', dividerType: 'multi-parallelograms-end' },
        { type: 'Divider', title: '旧样式', dividerType: 'solid-center' },
      ],
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );
    const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);

    expect(formContainer.children[0].props.type).toBe('left-dot-title');
    expect(formContainer.children[1].props.type).toBe('multi-parallelograms-end');
    expect(formContainer.children[2].props.type).toBe('bold-with-thin');
  });

  test('Divider forms inject yida global theme style on current and top documents', () => {
    const schema = createForm._private.buildFormSchema(
      '分割线主题测试',
      [{ type: 'Divider', title: '默认分割线' }],
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );
    const root = schema.pages[0].componentsTree[0];

    expect(root.lifeCycles.componentDidMount).toMatchObject({
      name: 'openyidaDividerThemeDidMount',
      type: 'actionRef',
    });
    expect(schema.actions.list).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openyidaDividerThemeDidMount',
        relatedEventId: 'lifecycle:didMount',
      }),
    ]));
    expect(schema.actions.module.source).toContain('openyida:divider-theme:start');
    expect(schema.actions.module.source).toContain('yida-global-theme');
    expect(schema.actions.module.source).toContain('window.top.document');
    expect(schema.actions.module.source).toContain('--color-brand1-9');
    expect(schema.actions.module.source).toContain("deepBlue: '#3954E4'");
    expect(schema.actions.module.compiled).toContain('openyidaDividerThemeDidMount');
  });

  test('forms without Divider do not inject divider theme action', () => {
    const schema = createForm._private.buildFormSchema(
      '普通字段测试',
      [{ type: 'TextField', label: '姓名' }],
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );

    expect(schema.pages[0].componentsTree[0].lifeCycles.componentDidMount.name).toBe('didMount');
    expect(schema.actions.module.source).not.toContain('openyida:divider-theme:start');
    expect(schema.actions.module.source).not.toContain('yida-global-theme');
  });

  test('update add can insert presentation components inside nested containers', () => {
    const schema = createForm._private.buildFormSchema(
      '布局测试',
      [
        {
          type: 'ColumnContainer',
          layout: '6:6',
          children: [
            [{ type: 'TextField', label: '姓名' }],
            [{ type: 'TextField', label: '工号' }],
          ],
        },
      ],
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );
    createForm._private.applyChangesToSchema(schema, [
      {
        action: 'add',
        after: '姓名',
        field: { type: 'Divider', title: '联系方式', dividerType: 'solid' },
      },
    ]);

    const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);
    const firstColumnChildren = formContainer.children[0].children[0].children;
    expect(firstColumnChildren.map((child) => child.componentName)).toEqual(['TextField', 'Divider']);
    expect(firstColumnChildren[1].props.title.zh_CN).toBe('联系方式');
    expect(schema.pages[0].componentsMap.map((item) => item.componentName)).toContain('Divider');
  });

  test('update schemas get divider theme action after adding Divider', () => {
    const schema = createForm._private.buildFormSchema(
      '后续新增分割线',
      [{ type: 'TextField', label: '姓名' }],
      'FORM_TEST',
      'CORP_TEST',
      'APP_TEST',
      'single',
      'default',
      'top'
    );
    createForm._private.applyChangesToSchema(schema, [
      { action: 'add', field: { type: 'Divider', title: '联系方式' }, after: '姓名' },
    ]);

    const applied = createForm._private.ensureDividerThemeAction(schema);

    expect(applied).toBe(true);
    expect(schema.pages[0].componentsTree[0].lifeCycles.componentDidMount.name).toBe('openyidaDividerThemeDidMount');
    expect(schema.actions.module.source).toContain('openyida:divider-theme:start');
    expect(schema.actions.module.source).toContain('openyidaInjectDividerTheme');
  });
});

// ── JS 语法检查 ──

describe('create-form.js syntax', () => {
  test('passes Node.js syntax check', () => {
    const { execSync } = require('child_process');
    expect(() => {
      execSync('node --check ' + CREATE_FORM_PATH, { stdio: 'pipe' });
    }).not.toThrow();
  });
});

describe('create-form module API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('exports run and parseArgs without executing the command on require', () => {
    expect(createForm).toEqual(expect.objectContaining({
      run: expect.any(Function),
      parseArgs: expect.any(Function),
    }));
  });

  test('parseArgs throws CliError for invalid usage instead of exiting', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    let thrown;
    try {
      createForm.parseArgs(['create', 'APP_XXX']);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toMatchObject({
      code: 'CREATE_FORM_INVALID_ARGUMENTS',
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('parseArgs supports validation mode without process.argv mutation', () => {
    expect(createForm.parseArgs([
      'validation',
      'APP_XXX',
      'FORM_XXX',
      '.cache/openyida/forms/validations.json',
    ])).toMatchObject({
      mode: 'validation',
      appType: 'APP_XXX',
      formUuid: 'FORM_XXX',
      validationJsonOrFile: '.cache/openyida/forms/validations.json',
    });
  });

  test('parseArgs keeps validate three-argument compatibility for validation rules', () => {
    expect(createForm.parseArgs([
      'validate',
      'APP_XXX',
      'FORM_XXX',
      '.cache/openyida/forms/validations.json',
    ])).toMatchObject({
      mode: 'validation',
      appType: 'APP_XXX',
      formUuid: 'FORM_XXX',
      validationJsonOrFile: '.cache/openyida/forms/validations.json',
    });
  });

  test('parseArgs treats validate-fields with one target as local field JSON validation', () => {
    expect(createForm.parseArgs([
      'validate-fields',
      '.cache/openyida/forms/fields.json',
      '--json',
    ])).toMatchObject({
      mode: 'validate-fields',
      fieldsJsonOrFile: '.cache/openyida/forms/fields.json',
      json: true,
    });
  });

  test('parseArgs keeps validate inline rule compatibility', () => {
    expect(createForm.parseArgs([
      'validate',
      'APP_XXX',
      'FORM_XXX',
      '--field',
      '手机号',
      '--type',
      'phone',
    ])).toMatchObject({
      mode: 'validation',
      appType: 'APP_XXX',
      formUuid: 'FORM_XXX',
      validationJsonOrFile: '',
      inlineValidationRule: expect.objectContaining({
        field: '手机号',
        type: 'phone',
      }),
    });
  });
});

describe('create-form create recovery guardrails', () => {
  afterEach(() => {
    delete process.env.OPENYIDA_UPDATE_FORM_CONFIG_RETRY_DELAYS_MS;
    process.exitCode = undefined;
    jest.restoreAllMocks();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('invalid field definitions fail before saveFormSchemaInfo creates a blank form', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-invalid-fields-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      {
        type: 'ColumnContainer',
        children: [
          [{ type: 'TextField', label: '姓名' }],
          [{ label: '缺类型字段' }],
        ],
      },
    ]));

    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand();

    await expect(isolatedCreateForm.run([
      'create',
      'APP_TEST',
      '坏字段表单',
      fieldsPath,
    ])).rejects.toMatchObject({
      code: 'CREATE_FORM_FIELD_TYPE_MISSING',
      details: expect.objectContaining({
        path: 'fields[0].children[1][0]',
        label: '缺类型字段',
      }),
    });

    expect(mockUtils.httpPost).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('missing AssociationFormField formUuid fails before saveFormSchemaInfo creates a blank form', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-missing-association-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      {
        type: 'AssociationFormField',
        label: '关联车辆',
        associationForm: { appType: 'APP_TEST' },
      },
    ]));

    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand();

    await expect(isolatedCreateForm.run([
      'create',
      'APP_TEST',
      '用车申请',
      fieldsPath,
    ])).rejects.toMatchObject({
      code: 'CREATE_FORM_ASSOCIATION_FORM_UUID_MISSING',
      details: expect.objectContaining({
        path: 'fields[0]',
        label: '关联车辆',
      }),
    });

    expect(mockUtils.httpPost).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('create-form create stops locally when field JSON gate fails and does not call platform APIs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-field-gate-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      { type: 'SelectField', label: '状态' },
    ]));

    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand();

    await expect(isolatedCreateForm.run([
      'create',
      'APP_TEST',
      '字段 Gate 测试',
      fieldsPath,
    ])).rejects.toMatchObject({
      code: 'CREATE_FORM_OPTION_FIELD_DATASOURCE_MISSING',
      details: expect.objectContaining({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'OPTION_FIELD_DATASOURCE_MISSING',
            path: 'fields[0].dataSource',
          }),
        ]),
      }),
    });

    expect(mockUtils.httpPost).not.toHaveBeenCalled();
    expect(mockUtils.httpGet).not.toHaveBeenCalled();
    expect(mockUtils.requestWithAutoLogin).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('create-form update validates add fields before getFormSchema or save calls', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-update-field-gate-'));
    const changesPath = path.join(tmpDir, 'changes.json');
    fs.writeFileSync(changesPath, JSON.stringify([
      {
        action: 'add',
        field: {
          type: 'ColumnContainer',
          children: [
            [[{ type: 'TextField', label: '姓名' }]],
          ],
        },
      },
    ]));

    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand();

    await expect(isolatedCreateForm.run([
      'update',
      'APP_TEST',
      'FORM_TEST',
      changesPath,
    ])).rejects.toMatchObject({
      code: 'CREATE_FORM_INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
      details: expect.objectContaining({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
            path: 'changes[0].field.children[0][0]',
          }),
        ]),
      }),
    });

    expect(mockUtils.httpGet).not.toHaveBeenCalled();
    expect(mockUtils.httpPost).not.toHaveBeenCalled();
    expect(mockUtils.requestWithAutoLogin).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('create-form validate-fields runs local JSON gate and returns diagnostics without login or platform APIs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-field-validate-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      {
        type: 'ColumnContainer',
        children: [
          [[{ type: 'TextField', label: '姓名' }]],
        ],
      },
    ]));

    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand();

    const previousExitCode = process.exitCode;
    await expect(isolatedCreateForm.run([
      'validate-fields',
      fieldsPath,
      '--json',
    ])).resolves.toMatchObject({
      success: false,
      valid: false,
    });

    const payload = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(payload).toMatchObject({
      success: false,
      valid: false,
      diagnostics: [
        expect.objectContaining({
          code: 'INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
          path: 'fields[0].children[0][0]',
        }),
      ],
    });
    expect(mockUtils.httpPost).not.toHaveBeenCalled();
    expect(mockUtils.httpGet).not.toHaveBeenCalled();
    expect(mockUtils.requestWithAutoLogin).not.toHaveBeenCalled();
    process.exitCode = previousExitCode;
    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('create-form validate-fields CLI emits exactly one JSON payload for invalid input', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-validate-cli-invalid-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      {
        type: 'ColumnContainer',
        children: [
          [[{ type: 'TextField', label: '姓名' }]],
        ],
      },
    ]));

    const result = spawnSync(process.execPath, [
      BIN_PATH,
      'create-form',
      'validate-fields',
      fieldsPath,
      '--json',
    ], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, {
        OPENYIDA_SKIP_UPDATE_CHECK: '1',
        NO_UPDATE_NOTIFIER: '1',
      }),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({
      success: false,
      valid: false,
      diagnostics: [
        expect.objectContaining({
          code: 'INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
          path: 'fields[0].children[0][0]',
        }),
      ],
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('create-form validate-fields CLI emits success JSON and exit code 0 for valid input', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-validate-cli-valid-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      { type: 'TextField', label: { zh_CN: '姓名', en_US: 'Name' } },
    ]));

    const result = spawnSync(process.execPath, [
      BIN_PATH,
      'create-form',
      'validate-fields',
      fieldsPath,
      '--json',
    ], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, {
        OPENYIDA_SKIP_UPDATE_CHECK: '1',
        NO_UPDATE_NOTIFIER: '1',
      }),
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      success: true,
      valid: true,
      fieldCount: 1,
      diagnostics: [],
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('post-create getFormSchema failure emits structured recovery JSON with formUuid', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-post-create-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      { type: 'TextField', label: '姓名' },
    ]));

    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand({
      httpGet: jest.fn(() => Promise.resolve({
        success: false,
        errorMsg: 'schema read failed',
        errorCode: 'READ_FAILED',
        content: { shouldNotLeak: true },
      })),
    });

    await expect(isolatedCreateForm.run([
      'create',
      'APP_TEST',
      '半成功表单',
      fieldsPath,
    ])).rejects.toMatchObject({
      code: 'CREATE_FORM_GET_SCHEMA_FAILED',
    });

    const recoveryPayload = consoleSpy.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .find((payload) => payload && payload.success === false && payload.formUuid === 'FORM_HALF_CREATED');

    expect(recoveryPayload).toMatchObject({
      success: false,
      appType: 'APP_TEST',
      formTitle: '半成功表单',
      formUuid: 'FORM_HALF_CREATED',
      stage: 'getFormSchema',
      error: 'schema read failed',
      errorCode: 'CREATE_FORM_GET_SCHEMA_FAILED',
    });
    expect(recoveryPayload.retryAdvice).toContain('list-forms APP_TEST');
    expect(JSON.stringify(recoveryPayload)).not.toContain('shouldNotLeak');
    expect(mockUtils.httpPost).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('post-create updateFormConfig retries transient form not found and then succeeds', async () => {
    process.env.OPENYIDA_UPDATE_FORM_CONFIG_RETRY_DELAYS_MS = '0,0';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-config-retry-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      { type: 'TextField', label: '姓名' },
    ]));

    let updateConfigAttempts = 0;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand({
      httpPost: jest.fn((baseUrl, requestPath) => {
        if (requestPath.includes('saveFormSchemaInfo')) {
          return Promise.resolve({ success: true, content: { formUuid: 'FORM_CONFIG_RETRY' } });
        }
        if (requestPath.includes('updateFormConfig')) {
          updateConfigAttempts += 1;
          if (updateConfigAttempts === 1) {
            return Promise.resolve({ success: false, errorMsg: '表单不存在' });
          }
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      }),
    });

    await expect(isolatedCreateForm.run([
      'create',
      'APP_TEST',
      '配置重试表单',
      fieldsPath,
    ])).resolves.toBeUndefined();

    const payload = consoleSpy.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .find((item) => item && item.formUuid === 'FORM_CONFIG_RETRY');

    expect(payload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formTitle: '配置重试表单',
      formUuid: 'FORM_CONFIG_RETRY',
      fieldCount: 1,
    });
    expect(payload).not.toHaveProperty('configWarning');
    expect(mockUtils.httpPost.mock.calls.filter((call) => call[1].includes('updateFormConfig'))).toHaveLength(2);

    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('post-create updateFormConfig retry exhaustion reports post-save warning', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-config-failed-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      { type: 'TextField', label: '姓名' },
    ]));
    process.env.OPENYIDA_UPDATE_FORM_CONFIG_RETRY_DELAYS_MS = '0,0';

    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand({
      httpPost: jest.fn((baseUrl, requestPath) => {
        if (requestPath.includes('saveFormSchemaInfo')) {
          return Promise.resolve({ success: true, content: { formUuid: 'FORM_CONFIG_FAILED' } });
        }
        if (requestPath.includes('updateFormConfig')) {
          return Promise.resolve({ success: false, errorMsg: '表单不存在', content: { shouldNotLeak: true } });
        }
        return Promise.resolve({ success: true });
      }),
    });

    await expect(isolatedCreateForm.run([
      'create',
      'APP_TEST',
      '配置失败表单',
      fieldsPath,
    ])).resolves.toBeUndefined();

    const recoveryPayload = consoleSpy.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .find((payload) => payload && payload.formUuid === 'FORM_CONFIG_FAILED');

    expect(recoveryPayload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formTitle: '配置失败表单',
      formUuid: 'FORM_CONFIG_FAILED',
      stage: 'updateFormConfig',
      schemaSaved: true,
      configWarning: '表单不存在',
      configResult: {
        success: false,
        errorMsg: '表单不存在',
      },
    });
    expect(recoveryPayload.retryAdvice).toBeUndefined();
    expect(JSON.stringify(recoveryPayload)).not.toContain('shouldNotLeak');
    expect(mockUtils.httpPost.mock.calls.filter((call) => call[1].includes('updateFormConfig'))).toHaveLength(3);

    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('post-create updateFormConfig does not retry non-retryable permission errors', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-config-permission-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([
      { type: 'TextField', label: '姓名' },
    ]));

    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedCreateFormCommand({
      httpPost: jest.fn((baseUrl, requestPath) => {
        if (requestPath.includes('saveFormSchemaInfo')) {
          return Promise.resolve({ success: true, content: { formUuid: 'FORM_CONFIG_PERMISSION' } });
        }
        if (requestPath.includes('updateFormConfig')) {
          return Promise.resolve({ success: false, errorMsg: '权限不足', errorCode: 'PERMISSION_DENIED' });
        }
        return Promise.resolve({ success: true });
      }),
    });

    await expect(isolatedCreateForm.run([
      'create',
      'APP_TEST',
      '配置权限表单',
      fieldsPath,
    ])).resolves.toBeUndefined();

    const warningPayload = consoleSpy.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .find((payload) => payload && payload.formUuid === 'FORM_CONFIG_PERMISSION');

    expect(warningPayload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formTitle: '配置权限表单',
      formUuid: 'FORM_CONFIG_PERMISSION',
      stage: 'updateFormConfig',
      schemaSaved: true,
      configWarning: '权限不足',
      configResult: {
        success: false,
        errorMsg: '权限不足',
        errorCode: 'PERMISSION_DENIED',
      },
    });
    expect(mockUtils.httpPost.mock.calls.filter((call) => call[1].includes('updateFormConfig'))).toHaveLength(1);

    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('update mode keeps success true when post-save updateFormConfig fails', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Update Warning',
      fields: [{ key: 'name', type: 'TextField', label: '姓名' }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_UPDATE_WARNING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);
    mockUtils.httpPost.mockImplementation((baseUrl, requestPath) => {
      if (requestPath.includes('updateFormConfig')) {
        return Promise.resolve({ success: false, errorMsg: '权限不足', errorCode: 'PERMISSION_DENIED' });
      }
      return Promise.resolve({ success: true });
    });

    await expect(isolatedCreateForm.run([
      'update',
      'APP_TEST',
      'FORM_UPDATE_WARNING',
      JSON.stringify([{ action: 'add', field: { type: 'TextField', label: '备注' } }]),
    ])).resolves.toBeUndefined();

    const warningPayload = consoleSpy.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .find((payload) => payload && payload.formUuid === 'FORM_UPDATE_WARNING');

    expect(warningPayload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formUuid: 'FORM_UPDATE_WARNING',
      stage: 'updateFormConfig',
      schemaSaved: true,
      configWarning: '权限不足',
      configResult: {
        success: false,
        errorMsg: '权限不足',
        errorCode: 'PERMISSION_DENIED',
      },
    });
    expect(mockUtils.httpPost.mock.calls.filter((call) => call[1].includes('updateFormConfig'))).toHaveLength(1);

    consoleSpy.mockRestore();
  });

  test('patch mode reports post-save updateFormConfig failure as warning', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Patch Warning',
      fields: [{ key: 'name', type: 'TextField', label: '姓名' }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_PATCH_WARNING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy, mockChalk } = loadIsolatedLegacyForm(initial);
    mockUtils.httpPost.mockImplementation((baseUrl, requestPath) => {
      if (requestPath.includes('updateFormConfig')) {
        return Promise.resolve({ success: false, errorMsg: '权限不足', errorCode: 'PERMISSION_DENIED' });
      }
      return Promise.resolve({ success: true });
    });

    await expect(isolatedCreateForm.run([
      'patch',
      'APP_TEST',
      'FORM_PATCH_WARNING',
      JSON.stringify([{ action: 'add', path: '/postSaveWarningProbe', value: true }]),
    ])).resolves.toBeUndefined();

    const warningPayload = consoleSpy.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .find((payload) => payload && payload.formUuid === 'FORM_PATCH_WARNING');

    expect(warningPayload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formUuid: 'FORM_PATCH_WARNING',
      stage: 'updateFormConfig',
      schemaSaved: true,
      configWarning: '权限不足',
      configResult: {
        success: false,
        errorMsg: '权限不足',
        errorCode: 'PERMISSION_DENIED',
      },
    });
    expect(mockChalk.result.mock.calls.some((call) => call[0] === false)).toBe(false);
    expect(mockChalk.result).toHaveBeenCalledWith(true, 'Schema 补丁保存成功', expect.any(Array));
    expect(mockChalk.warn).toHaveBeenCalledWith(expect.stringContaining('权限不足'));
    expect(mockUtils.httpPost.mock.calls.filter((call) => call[1].includes('updateFormConfig'))).toHaveLength(1);

    consoleSpy.mockRestore();
  });

  test('add-option mode reports post-save updateFormConfig failure as warning', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Add Option Warning',
      fields: [{ key: 'status', type: 'SelectField', label: '状态', options: ['待处理'] }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_ADD_OPTION_WARNING',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy, mockChalk } = loadIsolatedLegacyForm(initial);
    mockUtils.httpPost.mockImplementation((baseUrl, requestPath) => {
      if (requestPath.includes('updateFormConfig')) {
        return Promise.resolve({ success: false, errorMsg: '权限不足', errorCode: 'PERMISSION_DENIED' });
      }
      return Promise.resolve({ success: true });
    });

    await expect(isolatedCreateForm.run([
      'add-option',
      'APP_TEST',
      'FORM_ADD_OPTION_WARNING',
      '状态',
      '已完成',
    ])).resolves.toBeUndefined();

    const warningPayload = consoleSpy.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .find((payload) => payload && payload.formUuid === 'FORM_ADD_OPTION_WARNING');

    expect(warningPayload).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formUuid: 'FORM_ADD_OPTION_WARNING',
      fieldLabel: '状态',
      added: ['已完成'],
      stage: 'updateFormConfig',
      schemaSaved: true,
      configWarning: '权限不足',
      configResult: {
        success: false,
        errorMsg: '权限不足',
        errorCode: 'PERMISSION_DENIED',
      },
    });
    expect(mockChalk.result.mock.calls.some((call) => call[0] === false)).toBe(false);
    expect(mockChalk.result).toHaveBeenCalledWith(true, '选项追加成功', expect.any(Array));
    expect(mockChalk.warn).toHaveBeenCalledWith(expect.stringContaining('权限不足'));
    expect(mockUtils.httpPost.mock.calls.filter((call) => call[1].includes('updateFormConfig'))).toHaveLength(1);

    consoleSpy.mockRestore();
  });
});

function loadIsolatedCreateFormCommand(overrides = {}) {
  jest.resetModules();
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const mockUtils = Object.assign({
    loadAuthData: jest.fn(() => ({
      csrf_token: 'csrf',
      cookies: [{ name: 'session', value: 'private' }],
      corp_id: 'corp',
      base_url: 'https://example.test',
      auth_mode: 'cookie',
      auth_source: 'cookie',
    })),
    loadCookieData: jest.fn(),
    triggerLogin: jest.fn(),
    resolveBaseUrl: jest.fn(() => 'https://example.test'),
    httpGet: jest.fn(() => Promise.resolve({ success: true, content: { gmtModified: 100 } })),
    httpPost: jest.fn((baseUrl, requestPath) => {
      if (requestPath.includes('saveFormSchemaInfo')) {
        return Promise.resolve({ success: true, content: { formUuid: 'FORM_HALF_CREATED' } });
      }
      return Promise.resolve({ success: true });
    }),
    requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
    detectActiveTool: jest.fn(() => null),
  }, overrides);
  jest.doMock('../lib/core/utils', () => mockUtils);
  jest.doMock('../lib/core/chalk', () => ({
    banner: jest.fn(),
    step: jest.fn(),
    label: jest.fn(),
    success: jest.fn(),
    fail: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    result: jest.fn(),
    usage: jest.fn(),
    hint: jest.fn(),
    listItem: jest.fn(),
  }));
  return {
    isolatedCreateForm: require('../lib/app/create-form'),
    mockUtils,
    consoleSpy,
  };
}

describe('create-form definition readers', () => {
  function createTestReaders() {
    return createDefinitionReaders({
      fs,
      path,
      safeParseJson: JSON.parse,
      error(message) {
        throw new Error(message);
      },
      t(key) {
        return key;
      },
    });
  }

  test('create fields unwrap update-style add changes produced by agents', () => {
    const { readFieldsDefinition } = createTestReaders();

    const result = readFieldsDefinition(JSON.stringify([
      { action: 'add', field: { type: 'Divider', title: '访客信息' } },
      { action: 'add', field: { type: 'TextField', label: '访客姓名', required: true } },
    ]));

    expect(result).toMatchObject({
      columns: 1,
      validations: [],
      fields: [
        { type: 'Divider', title: '访客信息' },
        { type: 'TextField', label: '访客姓名', required: true },
      ],
    });
  });
});

describe('form compiler field bindings', () => {
  test('compileFormDefinition reuses existing field bindings by semantic path', () => {
    const compiled = formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      appType: 'APP_XXX',
      formUuid: 'FORM_XXX',
      fields: [
        { key: 'visitorName', type: 'TextField', label: '访客姓名' },
        {
          key: 'items',
          type: 'TableField',
          label: '明细',
          children: [
            { key: 'productName', type: 'TextField', label: '产品名称' },
          ],
        },
      ],
    }, {
      existingBindings: {
        visitorName: 'textField_keep',
        items: 'tableField_keep',
        'items.productName': 'textField_child_keep',
      },
    });

    expect(compiled.fieldBindings).toEqual({
      visitorName: 'textField_keep',
      items: 'tableField_keep',
      'items.productName': 'textField_child_keep',
    });
    expect(JSON.stringify(compiled.schema)).toContain('textField_keep');
    expect(JSON.stringify(compiled.schema)).toContain('textField_child_keep');
  });

  test('compileFormDefinition accepts componentType for business field definitions', () => {
    const compiled = formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      fields: [
        { key: 'visitorName', componentType: 'TextField', label: '访客姓名' },
      ],
    });

    expect(compiled.fieldBindingComponents).toEqual({
      visitorName: 'TextField',
    });
    expect(JSON.stringify(compiled.schema)).toContain('textField_');
  });

  test('compileFormDefinition rejects missing and unsupported field types with stable compiler errors', () => {
    expect(() => formCompiler.compileFormDefinition({
      formTitle: '缺类型',
      fields: [
        { key: 'badField', label: '缺类型字段' },
      ],
    })).toThrow(expect.objectContaining({
      code: 'FORM_COMPILER_FIELD_TYPE_MISSING',
    }));

    expect(() => formCompiler.compileFormDefinition({
      formTitle: '展示布局不支持',
      fields: [
        { key: 'layout', componentName: 'ColumnContainer', label: '低层布局' },
      ],
    })).toThrow(expect.objectContaining({
      code: 'FORM_COMPILER_UNSUPPORTED_FIELD_TYPE',
    }));
  });

  test('compileFormDefinition rejects emoji before returning a schema', () => {
    expect(() => formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      fields: [
        { key: 'status', type: 'TextField', label: '✅ 状态' },
      ],
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_FORM_SCHEMA_EMOJI_FORBIDDEN',
      details: expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining('label'),
            emoji: '✅',
          }),
        ]),
      }),
    }));
  });

  test('compileFormDefinition validates AssociationFormField association targets', () => {
    expect(() => formCompiler.compileFormDefinition({
      formTitle: '缺关联配置',
      fields: [
        { key: 'customer', type: 'AssociationFormField', label: '关联客户', associationForm: {} },
      ],
    })).toThrow(expect.objectContaining({
      code: 'FORM_COMPILER_ASSOCIATION_FORM_UUID_MISSING',
      details: expect.objectContaining({
        semanticPath: 'customer',
        label: '关联客户',
      }),
    }));

    expect(() => formCompiler.compileFormDefinition({
      formTitle: '子表缺关联配置',
      fields: [
        {
          key: 'items',
          type: 'TableField',
          label: '明细',
          children: [
            { key: 'vehicle', type: 'AssociationFormField', label: '关联车辆', associationForm: { formUuid: ' ' } },
          ],
        },
      ],
    })).toThrow(expect.objectContaining({
      code: 'FORM_COMPILER_ASSOCIATION_FORM_UUID_MISSING',
      details: expect.objectContaining({
        semanticPath: 'items.vehicle',
        label: '关联车辆',
      }),
    }));

    expect(() => formCompiler.compileFormDefinition({
      formTitle: '非法 manifest 引用',
      fields: [
        { key: 'customer', type: 'AssociationFormField', label: '关联客户', form: 'customer' },
      ],
    })).toThrow(expect.objectContaining({
      code: 'FORM_COMPILER_ASSOCIATION_FORM_UUID_MISSING',
      details: expect.objectContaining({
        semanticPath: 'customer',
        form: 'customer',
      }),
    }));

    const manifestReferenceCompiled = formCompiler.compileFormDefinition({
      formTitle: 'manifest 引用',
      fields: [
        {
          key: 'customer',
          type: 'AssociationFormField',
          label: '关联客户',
          form: 'form:customer',
        },
      ],
    });

    expect(manifestReferenceCompiled.fieldBindingComponents.customer).toBe('AssociationFormField');

    const compiled = formCompiler.compileFormDefinition({
      formTitle: '合法关联配置',
      fields: [
        {
          key: 'customer',
          type: 'AssociationFormField',
          label: '关联客户',
          associationForm: { appType: 'APP_CUSTOMER', formUuid: 'FORM_CUSTOMER' },
        },
      ],
    });

    expect(JSON.stringify(compiled.schema)).toContain('FORM_CUSTOMER');
    expect(compiled.fieldBindingComponents.customer).toBe('AssociationFormField');
  });

  test('compileFormDefinition rejects dots inside semantic keys', () => {
    expect(() => formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      fields: [
        { key: 'bad.key', type: 'TextField', label: '访客姓名' },
      ],
    })).toThrow(/semantic key/);
  });

  test('object-style fields keep property name as authoritative semantic key', () => {
    const compiled = formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      fields: {
        visitorName: { key: 'visitorName', type: 'TextField', label: '访客姓名' },
      },
    }, {
      existingBindings: {
        visitorName: 'textField_keep',
      },
    });

    expect(compiled.fieldBindings).toEqual({ visitorName: 'textField_keep' });
  });

  test('object-style fields reject conflicting internal semantic keys', () => {
    let thrown;
    try {
      formCompiler.compileFormDefinition({
        formTitle: '访客登记',
        fields: {
          visitorName: { key: 'customerName', type: 'TextField', label: '访客姓名' },
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'FORM_COMPILER_SEMANTIC_KEY_CONFLICT',
    });
  });

  test('compileFormDefinition rejects duplicate top-level semantic paths', () => {
    let thrown;
    try {
      formCompiler.compileFormDefinition({
        formTitle: '访客登记',
        fields: [
          { key: 'visitorName', type: 'TextField', label: '访客姓名' },
          { key: 'visitorName', type: 'TextField', label: '联系人姓名' },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'FORM_COMPILER_DUPLICATE_SEMANTIC_PATH',
    });
  });

  test('compileFormDefinition rejects duplicate table child semantic paths', () => {
    let thrown;
    try {
      formCompiler.compileFormDefinition({
        formTitle: '访客登记',
        fields: [
          {
            key: 'items',
            type: 'TableField',
            label: '明细',
            children: [
              { key: 'productName', type: 'TextField', label: '产品名称' },
              { key: 'productName', type: 'TextField', label: '商品名称' },
            ],
          },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'FORM_COMPILER_DUPLICATE_SEMANTIC_PATH',
      details: expect.objectContaining({
        semanticPath: 'items.productName',
      }),
    });
  });

  test('verifyFieldBindings checks read-back schema by fieldId', () => {
    const compiled = formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      fields: [
        { key: 'visitorName', type: 'TextField', label: '访客姓名' },
      ],
    }, {
      existingBindings: {
        visitorName: 'textField_keep',
      },
    });
    const verification = verifyFieldBindings({ content: compiled.schema }, {
      visitorName: 'textField_keep',
      missingField: 'textField_missing',
      wrongType: 'textField_keep',
    }, {
      expectedComponentTypes: {
        visitorName: 'TextField',
        wrongType: 'NumberField',
      },
    });

    expect(verification.verified).toEqual(['visitorName']);
    expect(verification.missing).toEqual([{ semanticPath: 'missingField', fieldId: 'textField_missing' }]);
    expect(verification.mismatched).toEqual([{
      semanticPath: 'wrongType',
      fieldId: 'textField_keep',
      expectedComponentType: 'NumberField',
      actualComponentType: 'TextField',
    }]);
  });
});

// ── 辅助函数：提取函数体 ──

function extractFunctionBody(source, functionName) {
  const pattern = new RegExp('function\\s+' + functionName + '\\s*\\(');
  const match = pattern.exec(source);
  if (!match) {return null;}

  let braceCount = 0;
  let started = false;
  const startIndex = match.index;

  for (let charIndex = match.index; charIndex < source.length; charIndex++) {
    if (source[charIndex] === '{') {
      braceCount++;
      started = true;
    } else if (source[charIndex] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        return source.slice(startIndex, charIndex + 1);
      }
    }
  }
  return null;
}

function findFormContainer(node) {
  if (node.componentName === 'FormContainer') {
    return node;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findFormContainer(child);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function parseConsoleJsonPayloads(consoleSpy) {
  return consoleSpy.mock.calls
    .map(call => call[0])
    .filter(line => typeof line === 'string' && line.startsWith('{'))
    .map(line => JSON.parse(line));
}

// ── add-option 模式 parseArgs 测试 ──────────────────

describe('add-option mode in source code', () => {
  test('parseArgs recognizes add-option mode', () => {
    expect(combinedCreateFormSource).toContain("mode === 'add-option'");
    expect(combinedCreateFormSource).toContain("if (mode === 'add-option')");
  });

  test('mainAddOption function is defined', () => {
    expect(sourceCode).toContain('async function mainAddOption(');
  });

  test('main routes to mainAddOption for add-option mode', () => {
    expect(combinedCreateFormSource).toContain("case 'add-option'");
    expect(sourceCode).toContain('addOption: mainAddOption');
  });

  test('add-option validates OPTION_FIELD_TYPES', () => {
    expect(sourceCode).toContain('OPTION_FIELD_TYPES.indexOf(targetComponent.componentName)');
  });

  test('add-option deduplicates options by value', () => {
    expect(sourceCode).toContain('existingValues.has(optionText)');
  });

  test('add-option appends to existing dataSource', () => {
    expect(sourceCode).toContain('existingDataSource.push(newItem)');
  });
});

describe('patch mode in source code', () => {
  test('parseArgs recognizes patch mode', () => {
    expect(combinedCreateFormSource).toContain("mode === 'patch'");
    expect(combinedCreateFormSource).toContain('patchJsonOrFile');
  });

  test('mainPatch function is defined and routed', () => {
    expect(sourceCode).toContain('async function mainPatch(');
    expect(combinedCreateFormSource).toContain("case 'patch'");
    expect(sourceCode).toContain('patch: mainPatch');
  });

  test('patch mode supports field props and JSON pointer operations', () => {
    expect(sourceCode).toContain("action === 'field-props'");
    expect(sourceCode).toContain('applyJsonPointerOperation(schema, operation)');
  });
});

describe('rule mode in source code', () => {
  test('parseArgs recognizes rule mode', () => {
    expect(combinedCreateFormSource).toContain("mode === 'rule'");
    expect(combinedCreateFormSource).toContain('rulesJsonOrFile');
  });

  test('mainRule function is defined and routed', () => {
    expect(sourceCode).toContain('async function mainRule(');
    expect(combinedCreateFormSource).toContain("case 'rule'");
    expect(sourceCode).toContain('rule: mainRule');
  });

  test('rule mode generates action source and binds field onChange', () => {
    expect(sourceCode).toContain('function applyFormRules(');
    expect(sourceCode).toContain('openyidaApplyRules');
    expect(sourceCode).toContain('openyidaRuleChange_');
    expect(sourceCode).toContain("const eventName = 'onChange'");
  });

  test('rule mode supports visibility and set value rules', () => {
    expect(sourceCode).toContain("type: 'visibility'");
    expect(sourceCode).toContain("type: 'setValue'");
    expect(sourceCode).toContain('openyidaRuleSetBehavior');
    expect(sourceCode).toContain('openyidaRuleSetValue');
    expect(sourceCode).toContain("operator: 'always'");
  });
});

describe('validation mode in source code', () => {
  test('parseArgs recognizes validation mode and add-validation inline options', () => {
    expect(combinedCreateFormSource).toContain("mode === 'validation'");
    expect(combinedCreateFormSource).toContain('inlineValidationRule');
    expect(combinedCreateFormSource).toContain('parseInlineValidationOptions');
  });

  test('validation mode uses native field validation first', () => {
    expect(sourceCode).toContain('function applySmartValidations(');
    expect(sourceCode).toContain('toDesignerValidationRule');
    expect(createFormSplitSource).toContain('function normalizeDesignerValidationRule');
    expect(validationSourceCode).toContain('isNativeFieldValidationRule');
    expect(sourceCode).toContain('function resetGeneratedTextFieldValidationType');
    expect(sourceCode).toContain("field.props.validationType = 'text'");
    expect(sourceCode).not.toContain('field.props.validationType = rule.type');
    expect(sourceCode).toContain('found.field.props.validation = dedupeValidationRules');
    expect(validationSourceCode).toContain('customValidate');
    expect(sourceCode).toContain('cleanupLegacySmartValidationArtifacts');
  });

  test('smart validation emits native customValidate functions without submit hooks', () => {
    expect(validationSourceCode).toContain('function buildCustomValidateParam');
    expect(validationSourceCode).toContain("type: 'js'");
    expect(validationSourceCode).toContain('function validateRule(value, currentRule)');
    expect(validationSourceCode).toContain("=== 'idCard'");
    expect(validationSourceCode).toContain("=== 'bankCard'");
    expect(validationSourceCode).toContain("=== 'unifiedSocialCreditCode'");
    expect(validationSourceCode).toContain("=== 'compare'");
    expect(validationSourceCode).toContain("=== 'async'");
    expect(sourceCode).not.toContain('function buildSmartValidationActionSource');
  });

  test('create fields preserve validation definitions', () => {
    expect(compilerSourceCode).toContain('normalizeFieldValidationRules(field)');
    expect(compilerSourceCode).toContain("require('./form-validation')");
    expect(validationSourceCode).toContain('normalizeDesignerValidationRule');
    expect(combinedCreateFormSource).toContain('normalizeDesignerValidationRule');
  });
});

describe('bind-datasource mode in source code', () => {
  test('parseArgs recognizes bind-datasource aliases', () => {
    expect(combinedCreateFormSource).toContain("mode === 'bind-datasource'");
    expect(combinedCreateFormSource).toContain("mode === 'datasource'");
    expect(combinedCreateFormSource).toContain('dataSourceJsonOrFile');
  });

  test('mainBindDataSource is defined and routed', () => {
    expect(sourceCode).toContain('async function mainBindDataSource(');
    expect(combinedCreateFormSource).toContain("case 'bind-datasource'");
    expect(sourceCode).toContain('bindDataSource: mainBindDataSource');
  });

  test('datasource binding updates searchConfig and defaultDataSource', () => {
    expect(compilerSourceCode).toContain('function applySelectDataSourceConfig(');
    expect(formCompiler.applySelectDataSourceConfig).toEqual(expect.any(Function));
    expect(sourceCode).toContain('applySelectDataSourceConfig,');
    expect(compilerSourceCode).toContain('props.searchConfig = {');
    expect(compilerSourceCode).toContain('props.defaultDataSource = Object.assign');
    expect(sourceCode).toContain("action: 'bind-datasource'");
  });

  test('shared datasource helper normalizes remote option config into field props', () => {
    const props = {
      defaultDataSource: {
        customStashOptions: [],
        formula: { data: [], event: { 'onPageReady,onChange': [] } },
      },
    };

    const normalized = formCompiler.applySelectDataSourceConfig(props, {
      url: '/gateway/options.json',
      dataType: 'jsonp',
      queryParam: 'keyword',
      listPath: 'content.items',
      labelField: 'name',
      valueField: 'id',
      options: [{ label: 'Seed option', value: 'seed' }],
      props: {
        searchConfig: {
          url: '/gateway/override.json',
        },
        defaultDataSource: {
          searchConfig: {
            beforeFetch: 'function willFetch(params) { params.keyword = params.key; return params; }',
          },
        },
      },
    });

    expect(normalized).toMatchObject({
      url: '/gateway/options.json',
      dataType: 'jsonp',
      dataSourceType: 'custom',
      filterLocal: false,
      showSearch: true,
    });
    expect(props.dataSource).toEqual([
      expect.objectContaining({
        value: 'seed',
        text: expect.objectContaining({ zh_CN: 'Seed option' }),
      }),
    ]);
    expect(props.dataSourceType).toBe('custom');
    expect(props.filterLocal).toBe(false);
    expect(props.showSearch).toBe(true);
    expect(props.searchConfig).toMatchObject({
      dataType: 'jsonp',
      url: '/gateway/override.json',
      afterFetch: expect.any(String),
      beforeFetch: expect.any(String),
    });
    expect(props.defaultDataSource).toMatchObject({
      complexType: 'custom',
      url: '/gateway/options.json',
      searchConfig: {
        type: 'JSONP',
        url: '/gateway/options.json',
        afterFetch: expect.any(String),
        beforeFetch: 'function willFetch(params) { params.keyword = params.key; return params; }',
      },
    });
  });
});

describe('legacy create-form compatibility', () => {
  test('shared field reference helper resolves main and table filling rules', () => {
    expect(formCompiler.resolveFieldIdReferences).toEqual(expect.any(Function));
    expect(sourceCode).toContain('function resolveFieldIdReferences(');

    const formFields = [
      {
        componentName: 'TextField',
        props: {
          fieldId: 'textField_customerName',
          label: { zh_CN: '客户名称' },
        },
      },
      {
        componentName: 'TableField',
        props: {
          fieldId: 'tableField_lineItems',
          label: { zh_CN: '明细子表' },
        },
        children: [
          {
            componentName: 'TextField',
            props: {
              fieldId: 'textField_itemName',
              label: { zh_CN: '明细名称' },
            },
          },
        ],
      },
      {
        componentName: 'AssociationFormField',
        props: {
          fieldId: 'associationFormField_customer',
          label: { zh_CN: '关联客户' },
          dataFillingRules: {
            mainRules: [{
              source: 'remoteCustomerName',
              target: '@label:客户名称',
            }],
            tableRules: [{
              tableId: 'remoteLines',
              rules: [{
                source: 'remoteLineItems',
                target: '@label:明细子表',
              }],
            }],
          },
        },
      },
    ];

    formCompiler.resolveFieldIdReferences(formFields);

    const fillingRules = formFields[2].props.dataFillingRules;
    expect(fillingRules.mainRules[0]).toMatchObject({
      target: 'textField_customerName',
      targetFieldId: 'textField_customerName',
      targetType: 'TextField',
    });
    expect(fillingRules.tableRules[0].rules[0]).toMatchObject({
      target: 'tableField_lineItems',
      targetFieldId: 'tableField_lineItems',
      targetType: 'TableField',
    });
    expect(JSON.stringify(fillingRules)).not.toContain('@label:');
  });

  test('create mode reads only the shell revision and does not discover semantic keys', async () => {
    jest.resetModules();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockUtils = {
      loadAuthData: jest.fn(() => ({
        csrf_token: 'csrf',
        cookies: [{ name: 'tianshu_corp_user', value: 'corp_user' }],
        corp_id: 'corp',
        base_url: 'https://example.test',
        auth_mode: 'cookie',
        auth_source: 'cookie',
      })),
      loadCookieData: jest.fn(() => ({
        csrf_token: 'csrf',
        cookies: [{ name: 'tianshu_corp_user', value: 'corp_user' }],
        corp_id: 'corp',
      })),
      triggerLogin: jest.fn(),
      resolveBaseUrl: jest.fn(() => 'https://example.test'),
      httpGet: jest.fn(() => Promise.resolve({ success: true, content: { gmtModified: 100 } })),
      httpPost: jest.fn((baseUrl, requestPath) => {
        if (requestPath.includes('saveFormSchemaInfo')) {
          return Promise.resolve({ success: true, content: { formUuid: 'FORM_TEST' } });
        }
        if (requestPath.includes('saveFormSchema')) {
          return Promise.resolve({ success: true });
        }
        if (requestPath.includes('updateFormConfig')) {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      }),
      requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
      detectActiveTool: jest.fn(() => null),
    };

    jest.doMock('../lib/core/utils', () => mockUtils);
    jest.doMock('../lib/core/chalk', () => ({
      banner: jest.fn(),
      step: jest.fn(),
      label: jest.fn(),
      success: jest.fn(),
      fail: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      result: jest.fn(),
      usage: jest.fn(),
      hint: jest.fn(),
      listItem: jest.fn(),
    }));

    const isolatedCreateForm = require('../lib/app/create-form');
    await isolatedCreateForm.run([
      'create',
      'APP_XXX',
      '访客登记',
      JSON.stringify([{ key: 'visitorName', type: 'TextField', label: '访客姓名' }]),
    ]);

    expect(mockUtils.httpGet).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleSpy.mock.calls[0][0])).toMatchObject({
      success: true,
      formUuid: 'FORM_TEST',
      formTitle: '访客登记',
      appType: 'APP_XXX',
      fieldCount: 1,
      url: 'https://example.test/APP_XXX/workbench/FORM_TEST',
    });

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });
});
