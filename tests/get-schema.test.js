'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

jest.mock('../lib/app/form-navigation', () => ({
  fetchFormPageList: jest.fn(),
}));

const utils = require('../lib/core/utils');
const { fetchFormPageList } = require('../lib/app/form-navigation');
const { buildCanvasPageSchemaContent } = require('../lib/app/services/canvas-page-schema-builder');
const { buildNativePageSchemaContent } = require('../lib/app/services/native-page-schema-builder');
const {
  extractFieldSummary,
  extractOptionSummary,
  buildSchemaSummary,
  buildSemanticAnalysis,
  isSuccessfulSchemaResult,
  buildComponentAliasMaps,
  parseArgs,
  filterForms,
  fetchSchemaRecord,
  collectFieldNodes,
  findFieldNode,
  run,
} = require('../lib/app/get-schema');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
});

describe('parseArgs', () => {
  test('parses batch schema options', () => {
    expect(parseArgs([
      'APP_XXX',
      '--all',
      '--output-dir',
      '.cache/schemas',
      '--concurrency',
      '6',
      '--retries',
      '2',
      '--keyword',
      '客户',
    ])).toEqual({
      appType: 'APP_XXX',
      formUuid: '',
      all: true,
      outputDir: '.cache/schemas',
      concurrency: 6,
      retries: 2,
      keyword: '客户',
      compact: false,
      fields: [],
      field: '',
      json: false,
      summaryJson: false,
      analysisJson: false,
    });
  });

  test('keeps existing single form mode', () => {
    expect(parseArgs(['APP_XXX', 'FORM-AAA']).formUuid).toBe('FORM-AAA');
  });

  test('parses and deduplicates compact field queries', () => {
    expect(parseArgs([
      'APP_XXX',
      'FORM-AAA',
      '--compact',
      '--resolve-fields',
      '姓名, 状态',
      '--resolve-fields',
      '姓名，订单明细/商品名称',
    ])).toMatchObject({
      compact: true,
      fields: ['姓名', '状态', '订单明细/商品名称'],
    });

    expect(parseArgs(['APP_XXX', 'FORM-AAA', '--field', '姓名'])).toMatchObject({
      compact: false,
      field: '姓名',
      fields: [],
    });
  });

  test('parses compact field-map aliases', () => {
    expect(parseArgs(['APP_XXX', 'FORM-AAA', '--summary-json'])).toMatchObject({
      appType: 'APP_XXX',
      formUuid: 'FORM-AAA',
      summaryJson: true,
    });
    expect(parseArgs(['APP_XXX', 'FORM-AAA', '--field-map-json']).summaryJson).toBe(true);
    expect(parseArgs(['APP_XXX', 'FORM-AAA', '--field-map']).summaryJson).toBe(false);
    expect(parseArgs(['APP_XXX', 'FORM-AAA', '--analysis-json']).analysisJson).toBe(true);
  });
});

describe('buildSemanticAnalysis', () => {
  test('summarizes actions, url params and field behavior without returning source', () => {
    const schema = {
      content: {
        actions: {
          module: {
            source: `export function didMount() {
              if (this.state.urlParams.type === 'my') {
                this.$('employeeField_owner').setValue({ value: 'u1' });
                this.$('employeeField_owner').setBehavior('READONLY');
              }
            }`,
            compiled: 'compiled-secret',
          },
          list: [{ id: 'didMount', title: 'didMount' }],
        },
        pages: [{
          componentsTree: [{
            componentName: 'FormContainer',
            props: { associationRules: [{ rules: ['x'] }] },
            children: [{
              componentName: 'EmployeeField',
              props: {
                fieldId: 'employeeField_owner',
                label: { zh_CN: '负责人' },
                behavior: 'READONLY',
                validation: [{ type: 'required' }],
              },
            }],
          }],
        }],
      },
    };
    const output = buildSemanticAnalysis('APP_X', 'FORM_X', schema, [{ fieldId: 'employeeField_owner' }]);
    expect(output).toMatchObject({
      kind: 'yida_schema_semantic_analysis',
      contractVersion: 1,
      resource: { appType: 'APP_X', formUuid: 'FORM_X' },
      fieldCount: 1,
      semantics: {
        actions: {
          functions: ['didMount'],
          urlParams: ['type'],
          referencedMutationFields: ['employeeField_owner'],
        },
        fieldBehaviors: [{
          fieldId: 'employeeField_owner',
          behavior: 'READONLY',
          validationTypes: ['required'],
        }],
        associationRuleCount: 1,
      },
    });
    expect(output.semantics.actions.fieldMutations).toEqual([
      { fieldId: 'employeeField_owner', operation: 'setValue' },
      { fieldId: 'employeeField_owner', operation: 'setBehavior' },
    ]);
    expect(JSON.stringify(output)).not.toContain('compiled-secret');
    expect(output.resource.schemaHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('correlates a field event binding with its action function and registry entry', () => {
    const schema = {
      content: {
        actions: {
          module: {
            source: 'export function handleStatusChange() {}',
            compiled: 'compiled',
          },
          list: [{ id: 'handleStatusChange', title: 'handleStatusChange' }],
        },
        pages: [{
          componentsTree: [{
            componentName: 'FormContainer',
            children: [{
              componentName: 'SelectField',
              props: {
                fieldId: 'selectField_status',
                label: { zh_CN: '状态' },
                onChange: {
                  type: 'JSExpression',
                  value: 'this.utils.legaoBuiltin.execEventFlow.bind(this, [this.handleStatusChange])',
                  events: [{
                    type: 'actionRef',
                    id: 'handleStatusChange',
                    name: 'handleStatusChange',
                    params: {},
                    uuid: '123_0',
                  }],
                },
              },
            }],
          }],
        }],
      },
    };

    const output = buildSemanticAnalysis('APP_X', 'FORM_X', schema, []);
    expect(output.semantics.actions.bindings).toContainEqual(expect.objectContaining({
      fieldId: 'selectField_status',
      event: 'onChange',
      actionName: 'handleStatusChange',
      actionFunctionFound: true,
      actionEntryFound: true,
      verified: true,
    }));
  });
});

describe('extractFieldSummary', () => {
  test('extracts nested fields and report field codes', () => {
    const summary = extractFieldSummary({
      content: {
        pages: [
          {
            componentAlias: {
              items: [
                { fieldId: 'textField_name', alias: 'customerName' },
              ],
            },
            componentsTree: [
              {
                componentName: 'FormContainer',
                children: [
                  {
                    componentName: 'TextField',
                    props: { fieldId: 'textField_name', label: { zh_CN: '姓名' } },
                  },
                  {
                    componentName: 'SectionContainer',
                    children: [
                      {
                        componentName: 'SelectField',
                        props: {
                          fieldId: 'selectField_status',
                          label: { en_US: 'Status' },
                          dataSource: {
                            options: [
                              { label: { zh_CN: '待访' }, value: 'pending' },
                              { text: '已离开', value: 'left' },
                            ],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(summary).toEqual([
      {
        label: '姓名',
        componentName: 'TextField',
        fieldId: 'textField_name',
        alias: 'customerName',
        reportFieldCode: 'textField_name',
        reportFieldCodeCandidates: ['textField_name'],
        options: [],
        optionCount: 0,
        optionsTruncated: false,
      },
      {
        label: 'Status',
        componentName: 'SelectField',
        fieldId: 'selectField_status',
        alias: '',
        reportFieldCode: 'selectField_status',
        reportFieldCodeCandidates: ['selectField_status', 'selectField_status_value'],
        options: [
          { label: '待访', value: 'pending' },
          { label: '已离开', value: 'left' },
        ],
        optionCount: 2,
        optionsTruncated: false,
      },
    ]);
  });

  test('includes advanced field types supported by form creation', () => {
    const advancedTypes = [
      'SerialNumberField', 'DepartmentSelectField', 'AddressField',
      'AssociationFormField', 'MultiSelectField', 'CascadeDateField',
    ];
    const summary = extractFieldSummary({
      content: {
        pages: [{
          componentsTree: [{
            componentName: 'FormContainer',
            children: advancedTypes.map((componentName, index) => ({
              componentName,
              props: { fieldId: `field_${index}`, label: componentName },
            })),
          }],
        }],
      },
    });
    expect(summary.map(item => item.componentName)).toEqual(advancedTypes);
    expect(summary.find(item => item.componentName === 'MultiSelectField').reportFieldCode)
      .toBe('field_4');
    expect(summary.find(item => item.componentName === 'MultiSelectField').reportFieldCodeCandidates)
      .toEqual(['field_4', 'field_4_value']);
  });

  test('extracts lightweight options from static props', () => {
    expect(extractOptionSummary({
      options: ['待访', { label: '已离开', value: 'left' }, { label: 0, value: 0 }, { label: false, value: false }],
    })).toEqual([
      { label: '待访', value: '待访' },
      { label: '已离开', value: 'left' },
      { label: '0', value: '0' },
      { label: 'false', value: 'false' },
    ]);
  });

  test('marks option summaries as truncated when option count exceeds compact limit', () => {
    const options = Array.from({ length: 55 }, (_, index) => ({ label: `选项${index}`, value: index }));
    const [field] = extractFieldSummary({
      content: {
        pages: [
          {
            componentsTree: [
              {
                componentName: 'FormContainer',
                children: [
                  {
                    componentName: 'SelectField',
                    props: { fieldId: 'selectField_many', label: '大量选项', options },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(field.options).toHaveLength(50);
    expect(field.optionCount).toBe(55);
    expect(field.optionsTruncated).toBe(true);
  });

  test('includes required and effective default value when present', () => {
    const [field] = extractFieldSummary({
      content: {
        pages: [{
          componentsTree: [{
            componentName: 'FormContainer',
            children: [{
              componentName: 'SelectField',
              props: {
                fieldId: 'selectField_risk',
                label: '风险等级',
                required: true,
                complexValue: { value: '低' },
                options: ['低', '中', '高'],
              },
            }],
          }],
        }],
      },
    });
    expect(field).toMatchObject({ required: true, defaultValue: '低' });
  });

  test('detects required validation rules when props.required is absent', () => {
    const [field] = extractFieldSummary({
      content: { pages: [{ componentsTree: [{
        componentName: 'FormContainer',
        children: [{
          componentName: 'TextField',
          props: {
            fieldId: 'text_required',
            label: '必填字段',
            validation: [{ type: 'required', message: '必填' }],
          },
        }],
      }] }] },
    });
    expect(field.required).toBe(true);
  });

  test('builds alias maps and finds fields by alias', () => {
    const schema = {
      content: {
        pages: [
          {
            componentAlias: {
              items: [
                { fieldId: 'textField_name', alias: 'customerName' },
              ],
            },
            componentsTree: [
              {
                componentName: 'FormContainer',
                children: [
                  {
                    componentName: 'TextField',
                    props: { fieldId: 'textField_name', label: { zh_CN: '姓名' } },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const aliasMaps = buildComponentAliasMaps(schema);
    const nodes = collectFieldNodes(schema);

    expect(aliasMaps.aliasByFieldId.textField_name).toBe('customerName');
    expect(aliasMaps.fieldIdByAlias.customerName).toBe('textField_name');
    expect(findFieldNode(nodes, 'customerName', aliasMaps.aliasByFieldId).props.fieldId).toBe('textField_name');
  });
});

describe('buildSchemaSummary', () => {
  test('rejects success envelopes that do not contain a schema pages container', () => {
    expect(isSuccessfulSchemaResult({ success: true, content: {} })).toBe(false);
    expect(isSuccessfulSchemaResult({ success: true, content: { pages: [] } })).toBe(true);
    expect(isSuccessfulSchemaResult({
      success: true,
      content: { pages: [{ componentsTree: [] }] },
    })).toBe(true);
  });

  test('builds compact field map without full schema pages', () => {
    const summary = buildSchemaSummary('APP_XXX', 'FORM-A', {
      content: {
        pages: [
          {
            componentsTree: [
              {
                componentName: 'FormContainer',
                children: [
                  {
                    componentName: 'TextField',
                    props: { fieldId: 'textField_name', label: '姓名' },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      success: true,
      appType: 'APP_XXX',
      formUuid: 'FORM-A',
      fieldCount: 1,
    });
    expect(summary.fields[0]).toMatchObject({
      label: '姓名',
      fieldId: 'textField_name',
    });
    expect(summary).not.toHaveProperty('content');
    expect(summary).not.toHaveProperty('pages');
    expect(summary).not.toHaveProperty('displayPage');
  });

  test('adds YidaCodeCanvas display page signals without exposing schema content', () => {
    const sourceCode = 'export default function Page() { return React.createElement("div", null, "ok"); }';
    const runtimeCode = 'var YidaComp = function Page(){ return window.React.createElement("div", null, "ok"); };';
    const summary = buildSchemaSummary('APP_XXX', 'FORM-CANVAS', {
      content: buildCanvasPageSchemaContent(
        sourceCode,
        runtimeCode,
        '["react","antd"]',
        'FORM-CANVAS'
      ),
    });

    expect(summary).toMatchObject({
      success: true,
      appType: 'APP_XXX',
      formUuid: 'FORM-CANVAS',
      fieldCount: 0,
      fields: [],
      displayPage: {
        hasYidaCodeCanvas: true,
        hasNativeJsx: false,
        runtimeCodeBytes: Buffer.byteLength(runtimeCode, 'utf8'),
        sourceCodeBytes: Buffer.byteLength(sourceCode, 'utf8'),
        compiledCodeBytes: 0,
        importedModules: ['react', 'antd'],
        componentCount: 1,
      },
    });
    expect(summary).not.toHaveProperty('content');
    expect(summary).not.toHaveProperty('pages');
  });

  test('adds native custom page signals for legacy display pages', () => {
    const sourceCode = 'export function renderJsx() { return React.createElement("div", null, "ok"); }';
    const compiledCode = 'function renderJsx(){return React.createElement("div",null,"ok");}';
    const content = buildNativePageSchemaContent(sourceCode, compiledCode, 'FORM-NATIVE');
    const summary = buildSchemaSummary('APP_XXX', 'FORM-NATIVE', { content });

    expect(summary.displayPage).toMatchObject({
      hasYidaCodeCanvas: false,
      hasNativeJsx: true,
      runtimeCodeBytes: 0,
      sourceCodeBytes: Buffer.byteLength(sourceCode, 'utf8'),
      compiledCodeBytes: Buffer.byteLength(compiledCode, 'utf8'),
      importedModules: [],
      componentCount: 1,
    });

    const deepYidaComponents = JSON.parse(content).pages[0].componentsMap.filter(
      (entry) => entry.package === '@ali/vc-deep-yida'
    );
    expect(deepYidaComponents.length).toBeGreaterThan(0);
    deepYidaComponents.forEach((entry) => {
      expect(entry).not.toHaveProperty('version');
    });
  });
});

describe('filterForms', () => {
  test('filters by name uuid type or path', () => {
    const forms = [
      { formName: '客户信息', formUuid: 'FORM-A', formType: 'form', pathName: 'customer' },
      { formName: '费用报销', formUuid: 'FORM-B', formType: 'process', pathName: 'expense' },
    ];

    expect(filterForms(forms, '客户')).toHaveLength(1);
    expect(filterForms(forms, 'FORM-B')).toHaveLength(1);
    expect(filterForms(forms, 'process')).toHaveLength(1);
  });
});

describe('fetchSchemaRecord', () => {
  test('retries failed schema fetches', async () => {
    utils.requestWithAutoLogin
      .mockResolvedValueOnce({ success: false, errorMsg: 'temporary failure' })
      .mockResolvedValueOnce({
        success: true,
        content: { pages: [] },
      });

    const record = await fetchSchemaRecord(
      'APP_XXX',
      { formUuid: 'FORM-A', formName: '客户信息' },
      { authMode: 'token', authSource: 'token' },
      1
    );

    expect(record.success).toBe(true);
    expect(record.attempts).toBe(2);
  });
});

describe('run --all', () => {
  test('writes individual schema files and an index when output-dir is provided', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schemas-'));
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-A', formName: '客户信息', formType: 'form', pathName: 'customer' },
    ]);
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { pages: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(['APP_XXX', '--all', '--output-dir', outputDir]);

    const indexPath = path.join(outputDir, 'index.json');
    expect(fs.existsSync(indexPath)).toBe(true);
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    expect(index).toHaveLength(1);
    expect(index[0].schemaFile).toContain('FORM-A');
    expect(fs.existsSync(index[0].schemaFile)).toBe(true);

    const output = JSON.parse(mockLog.mock.calls[mockLog.mock.calls.length - 1][0]);
    expect(output.successCount).toBe(1);
    expect(output.outputDir).toBe(outputDir);
    mockLog.mockRestore();
  });

  test('summary-json keeps batch stdout and index compact', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schemas-compact-'));
    const canvasSource = 'export default function Page() { return React.createElement("div", null, "ok"); }';
    const canvasRuntime = 'var YidaComp = function Page(){ return window.React.createElement("div", null, "ok"); };';
    const nativeSource = 'export function renderJsx() { return React.createElement("div", null, "ok"); }';
    const nativeCompiled = 'function renderJsx(){return React.createElement("div",null,"ok");}';
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-A', formName: '客户信息', formType: 'form', pathName: 'customer' },
      { formUuid: 'FORM-CANVAS', formName: 'Canvas 页', formType: 'display', pathName: 'canvas' },
      { formUuid: 'FORM-NATIVE', formName: 'Native 页', formType: 'display', pathName: 'native' },
    ]);
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          pages: [
            {
              componentsTree: [
                {
                  componentName: 'FormContainer',
                  children: [
                    {
                      componentName: 'TextField',
                      props: { fieldId: 'textField_name', label: '姓名' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        content: buildCanvasPageSchemaContent(
          canvasSource,
          canvasRuntime,
          '["react","antd"]',
          'FORM-CANVAS'
        ),
      })
      .mockResolvedValueOnce({
        success: true,
        content: buildNativePageSchemaContent(nativeSource, nativeCompiled, 'FORM-NATIVE'),
      });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(['APP_XXX', '--all', '--summary-json', '--output-dir', outputDir, '--concurrency', '1']);

    const index = JSON.parse(fs.readFileSync(path.join(outputDir, 'index.json'), 'utf-8'));
    expect(index[0]).toHaveProperty('fieldSummary');
    expect(index[0]).toHaveProperty('schemaFile');
    expect(index[0]).not.toHaveProperty('schema');
    expect(index[0]).not.toHaveProperty('displayPage');
    expect(index[1].displayPage).toMatchObject({
      hasYidaCodeCanvas: true,
      hasNativeJsx: false,
      runtimeCodeBytes: Buffer.byteLength(canvasRuntime, 'utf8'),
      sourceCodeBytes: Buffer.byteLength(canvasSource, 'utf8'),
      importedModules: ['react', 'antd'],
      componentCount: 1,
    });
    expect(index[2].displayPage).toMatchObject({
      hasYidaCodeCanvas: false,
      hasNativeJsx: true,
      runtimeCodeBytes: 0,
      sourceCodeBytes: Buffer.byteLength(nativeSource, 'utf8'),
      compiledCodeBytes: Buffer.byteLength(nativeCompiled, 'utf8'),
      importedModules: [],
      componentCount: 1,
    });

    const output = JSON.parse(mockLog.mock.calls[mockLog.mock.calls.length - 1][0]);
    expect(output.summaryOnly).toBe(true);
    expect(output.forms[0]).toHaveProperty('fieldSummary');
    expect(output.forms[0]).not.toHaveProperty('schema');
    expect(output.forms[1].displayPage.hasYidaCodeCanvas).toBe(true);
    expect(output.forms[2].displayPage.hasNativeJsx).toBe(true);
    mockLog.mockRestore();
  });
});

describe('run compact compatibility', () => {
  test('compact stdout only contains requested safe field metadata', async () => {
    utils.httpGet.mockResolvedValue({
      success: true,
      content: {
        internalEndpoint: '/private/schema/path',
        pages: [
          {
            componentsTree: [
              {
                componentName: 'FormContainer',
                children: [
                  {
                    componentName: 'TextField',
                    props: {
                      fieldId: 'textField_name',
                      label: '姓名',
                      valueType: 'custom',
                      cookie: 'SECRET_COOKIE',
                      headers: { authorization: 'SECRET_TOKEN' },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(['APP_XXX', 'FORM-A', '--compact', '--resolve-fields', '姓名,不存在']);

    const rawOutput = mockLog.mock.calls[mockLog.mock.calls.length - 1][0];
    const output = JSON.parse(rawOutput);
    expect(output).toMatchObject({
      kind: 'yida_schema_field_resolution',
      contractVersion: 1,
      resource: { appType: 'APP_XXX', formUuid: 'FORM-A' },
      missingFields: ['不存在'],
      ambiguousFields: [],
    });
    expect(output.fields).toHaveLength(1);
    expect(output.fields[0]).toMatchObject({
      query: '姓名',
      label: '姓名',
      fieldId: 'textField_name',
      componentType: 'TextField',
      path: ['textField_name'],
      labelPath: ['姓名'],
      parentFieldId: null,
    });
    expect(output.resource.schemaHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(rawOutput).not.toContain('SECRET_COOKIE');
    expect(rawOutput).not.toContain('SECRET_TOKEN');
    expect(rawOutput).not.toContain('/private/schema/path');
    expect(output).not.toHaveProperty('content');
    mockLog.mockRestore();
  });

  test('keeps the legacy --field output structure unchanged', async () => {
    const props = {
      fieldId: 'textField_name',
      label: '姓名',
      valueType: 'custom',
      legacyMarker: { keep: true },
    };
    utils.httpGet.mockResolvedValue({
      success: true,
      content: {
        pages: [
          {
            componentsTree: [
              {
                componentName: 'FormContainer',
                children: [{ componentName: 'TextField', props }],
              },
            ],
          },
        ],
      },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(['APP_XXX', 'FORM-A', '--field', '姓名']);

    const output = JSON.parse(mockLog.mock.calls[mockLog.mock.calls.length - 1][0]);
    expect(output).toEqual({
      componentName: 'TextField',
      fieldId: 'textField_name',
      alias: '',
      label: '姓名',
      props,
    });
    expect(output).not.toHaveProperty('kind');
    mockLog.mockRestore();
  });

  test('keeps the complete server result unchanged without compact flags', async () => {
    const serverResult = {
      success: true,
      content: {
        pages: [],
        compatibilityMarker: { keep: true },
      },
    };
    utils.httpGet.mockResolvedValue(serverResult);

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(['APP_XXX', 'FORM-A']);

    const output = JSON.parse(mockLog.mock.calls[mockLog.mock.calls.length - 1][0]);
    expect(output).toEqual(serverResult);
    mockLog.mockRestore();
  });
});
