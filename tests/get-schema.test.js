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
const {
  extractFieldSummary,
  extractOptionSummary,
  buildSchemaSummary,
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
        options: [],
        optionCount: 0,
        optionsTruncated: false,
      },
      {
        label: 'Status',
        componentName: 'SelectField',
        fieldId: 'selectField_status',
        alias: '',
        reportFieldCode: 'selectField_status_value',
        options: [
          { label: '待访', value: 'pending' },
          { label: '已离开', value: 'left' },
        ],
        optionCount: 2,
        optionsTruncated: false,
      },
    ]);
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
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-A', formName: '客户信息', formType: 'form', pathName: 'customer' },
    ]);
    utils.httpGet.mockResolvedValue({
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
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(['APP_XXX', '--all', '--summary-json', '--output-dir', outputDir]);

    const index = JSON.parse(fs.readFileSync(path.join(outputDir, 'index.json'), 'utf-8'));
    expect(index[0]).toHaveProperty('fieldSummary');
    expect(index[0]).toHaveProperty('schemaFile');
    expect(index[0]).not.toHaveProperty('schema');

    const output = JSON.parse(mockLog.mock.calls[mockLog.mock.calls.length - 1][0]);
    expect(output.summaryOnly).toBe(true);
    expect(output.forms[0]).toHaveProperty('fieldSummary');
    expect(output.forms[0]).not.toHaveProperty('schema');
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
