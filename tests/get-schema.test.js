'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
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
  parseArgs,
  filterForms,
  fetchSchemaRecord,
  run,
} = require('../lib/app/get-schema');

const mockCookieData = {
  cookies: [{ name: 'tianshu_csrf_token', value: 'tok123' }],
  csrf_token: 'tok123',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadCookieData.mockReturnValue(mockCookieData);
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
    });
  });

  test('keeps existing single form mode', () => {
    expect(parseArgs(['APP_XXX', 'FORM-AAA']).formUuid).toBe('FORM-AAA');
  });
});

describe('extractFieldSummary', () => {
  test('extracts nested fields and report field codes', () => {
    const summary = extractFieldSummary({
      content: {
        pages: [
          {
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
                        props: { fieldId: 'selectField_status', label: { en_US: 'Status' } },
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
        reportFieldCode: 'textField_name',
      },
      {
        label: 'Status',
        componentName: 'SelectField',
        fieldId: 'selectField_status',
        reportFieldCode: 'selectField_status_value',
      },
    ]);
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
      { csrfToken: 'tok123', cookies: [] },
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
});
