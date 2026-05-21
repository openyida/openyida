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

const utils = require('../lib/core/utils');
const {
  parseArgs,
  collectFieldNodes,
  analyzeSchema,
  renderMarkdown,
  run,
} = require('../lib/app/externalize-form');

function makeSchema() {
  return {
    success: true,
    content: {
      formTitle: 'Hero Approval',
      pages: [
        {
          componentsTree: [
            {
              componentName: 'FormContainer',
              children: [
                {
                  componentName: 'AssociationFormField',
                  props: {
                    fieldId: 'associationFormField_customer',
                    label: { zh_CN: '关联客户' },
                    validation: [{ type: 'required' }],
                    associationForm: {
                      appType: 'APP_TARGET',
                      formUuid: 'FORM-CUSTOMER',
                      formTitle: '客户信息',
                      mainFieldId: 'textField_name',
                      mainFieldLabel: { zh_CN: '客户名称' },
                    },
                  },
                },
                {
                  componentName: 'EmployeeField',
                  props: {
                    fieldId: 'employeeField_owner',
                    label: { zh_CN: '负责人' },
                  },
                },
                {
                  componentName: 'TextField',
                  props: {
                    fieldId: 'textField_name',
                    label: { zh_CN: '英雄姓名' },
                    validation: [{ type: 'required' }],
                  },
                },
                {
                  componentName: 'AttachmentField',
                  props: {
                    fieldId: 'attachmentField_files',
                    label: { zh_CN: '证明材料' },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseArgs', () => {
  test('parses externalize-form options', () => {
    expect(parseArgs([
      'APP_XXX',
      'FORM-AAA',
      '--schema-file',
      '.cache/schema.json',
      '--output',
      '.cache/report.md',
      '--mirror-fields-output',
      '.cache/fields.json',
      '--format',
      'markdown',
      '--target',
      'open',
      '--mirror-title',
      '外部填报',
    ])).toEqual({
      appType: 'APP_XXX',
      formUuid: 'FORM-AAA',
      schemaFile: '.cache/schema.json',
      output: '.cache/report.md',
      mirrorFieldsOutput: '.cache/fields.json',
      format: 'markdown',
      target: 'open',
      mirrorTitle: '外部填报',
      help: false,
    });
  });

  test('rejects unsupported output format', () => {
    expect(() => parseArgs(['APP_XXX', 'FORM-AAA', '--format', 'xml'])).toThrow('Unsupported format');
  });
});

describe('schema analysis', () => {
  test('collects field nodes from a form schema', () => {
    const fields = collectFieldNodes(makeSchema());
    expect(fields.map(field => field.componentName)).toEqual([
      'AssociationFormField',
      'EmployeeField',
      'TextField',
      'AttachmentField',
    ]);
    expect(fields[0]).toMatchObject({
      label: '关联客户',
      fieldId: 'associationFormField_customer',
      required: true,
    });
  });

  test('flags auth-bound fields and creates mirror fields', () => {
    const report = analyzeSchema(makeSchema(), {
      appType: 'APP_XXX',
      formUuid: 'FORM-AAA',
      target: 'open',
      mirrorFieldsOutput: '.cache/external-fields.json',
    });

    expect(report.summary).toMatchObject({
      totalFields: 4,
      blockedFields: 2,
      reviewFields: 1,
      safeFields: 1,
      associationFields: 1,
      authBoundFields: 2,
    });
    expect(report.fields.find(field => field.componentName === 'AssociationFormField')).toMatchObject({
      riskLevel: 'blocked',
      externalStrategy: 'snapshot-and-resolve-internal',
      associationTarget: {
        formUuid: 'FORM-CUSTOMER',
        mainFieldId: 'textField_name',
      },
    });
    expect(report.mirrorFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'TextField',
        label: '客户名称',
        sourceStrategy: 'association-main-field-snapshot',
      }),
      expect.objectContaining({
        type: 'TextField',
        label: '关联客户业务标识',
        sourceStrategy: 'association-business-key-for-internal-resolution',
      }),
      expect.objectContaining({
        type: 'TextField',
        label: '负责人姓名',
      }),
      expect.objectContaining({
        type: 'TextField',
        label: '英雄姓名',
      }),
    ]));
    expect(report.recommendedActions[0]).toContain('openyida create-form create');
  });

  test('renders markdown report with field risks', () => {
    const markdown = renderMarkdown(analyzeSchema(makeSchema(), {
      appType: 'APP_XXX',
      formUuid: 'FORM-AAA',
      target: 'open',
    }));
    expect(markdown).toContain('# External Access Plan');
    expect(markdown).toContain('| 关联客户 | AssociationFormField | blocked |');
    expect(markdown).toContain('```json');
  });
});

describe('run', () => {
  test('schema-file mode writes report and mirror fields without login', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-externalize-'));
    const schemaFile = path.join(tmpDir, 'schema.json');
    const reportFile = path.join(tmpDir, 'report.json');
    const fieldsFile = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(schemaFile, JSON.stringify(makeSchema()), 'utf-8');

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    await run([
      'APP_XXX',
      'FORM-AAA',
      '--schema-file',
      schemaFile,
      '--output',
      reportFile,
      '--mirror-fields-output',
      fieldsFile,
    ]);

    expect(utils.loadCookieData).not.toHaveBeenCalled();
    expect(fs.existsSync(reportFile)).toBe(true);
    expect(fs.existsSync(fieldsFile)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
    const mirrorFields = JSON.parse(fs.readFileSync(fieldsFile, 'utf-8'));
    expect(report.summary.blockedFields).toBe(2);
    expect(report.files.report).toBe(reportFile);
    expect(mirrorFields.some(field => field.label === '客户名称')).toBe(true);
    expect(JSON.parse(mockLog.mock.calls[0][0])).toHaveProperty('files.report', reportFile);

    mockLog.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('--help prints usage without login', async () => {
    const mockErrorWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
    await run(['--help']);
    expect(utils.loadCookieData).not.toHaveBeenCalled();
    expect(mockErrorWrite).toHaveBeenCalledWith(expect.stringContaining('externalize-form'));
    mockErrorWrite.mockRestore();
  });
});
