'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  httpPostJson: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
  isLoginExpired: jest.fn(() => false),
  isCsrfTokenExpired: jest.fn(() => false),
}));

const utils = require('../lib/core/utils');
const {
  buildSavePayload,
  buildSettingsUrl,
  normalizeFormComponents,
  normalizeStoredConfig,
  run,
} = require('../lib/process/ai-form-setting');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
  csrf_token: 'csrf-token',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  utils.httpPostJson.mockResolvedValue({ success: true, content: { version: 3 } });
  process.env.YIDA_QUIET = '1';
});

afterEach(() => {
  delete process.env.YIDA_QUIET;
});

describe('ai-form-setting helpers', () => {
  test('buildSavePayload creates modelConfig and checkItem for all item types', () => {
    const payload = buildSavePayload({
      status: 'AUTO',
      items: [
        {
          itemId: 'text-risk',
          itemType: 'TEXT',
          itemName: '文本风险检查',
          modelId: 'qwen-plus',
          prompt: '请检查[申请金额]和[备注]',
          variables: [
            { varName: '申请金额', fieldId: 'numberField_total', fieldType: 'NumberField' },
            { varName: '备注', fieldId: 'textareaField_note', fieldType: 'TextareaField' },
          ],
        },
        {
          itemId: 'image-risk',
          itemType: 'IMAGE',
          itemName: '图文票据核对',
          modelId: 'qwen-vl-max',
          prompt: '请核对[发票号]',
          variables: [
            { varName: '发票号', fieldId: 'textField_invoiceNo', fieldType: 'TextField' },
          ],
        },
        {
          itemId: 'attachment-risk',
          itemType: 'ATTACHMENT',
          itemName: '附件合规检查',
          modelId: 'deepseek-v3',
          prompt: '请阅读[附件]',
          variables: [
            { varName: '附件', fieldId: 'attachmentField_file', fieldType: 'AttachmentField' },
          ],
        },
      ],
    });

    const checkItem = JSON.parse(payload.checkItem);
    const modelConfig = JSON.parse(payload.modelConfig);

    expect(payload.status).toBe('AUTO');
    expect(checkItem.items).toHaveLength(3);
    expect(checkItem.items[0].prompt.content).toBe('请检查[numberField_total]和[textareaField_note]');
    expect(checkItem.items[1]).toMatchObject({
      itemId: 'image-risk',
      itemType: 'IMAGE',
      itemName: '图文票据核对',
    });
    expect(modelConfig.models['attachment-risk']).toMatchObject({
      modelType: 'ATTACHMENT',
      modelId: 'deepseek-v3',
      deepThinking: false,
    });
  });

  test('normalizeStoredConfig restores field-id tags to display variable names', () => {
    const normalized = normalizeStoredConfig({
      status: 'AUTO',
      version: 3,
      modelConfig: JSON.stringify({
        models: {
          item_1: { modelType: 'TEXT', modelId: 'qwen-plus', deepThinking: false },
        },
      }),
      checkItem: JSON.stringify({
        items: [
          {
            itemId: 'item_1',
            itemType: 'TEXT',
            itemName: '文本检查',
            order: 1,
            enabled: true,
            prompt: {
              content: '检查[numberField_total]',
              variables: [
                { varName: '申请金额', fieldId: 'numberField_total', fieldName: '申请金额', fieldType: 'NumberField' },
              ],
            },
          },
        ],
      }),
    });

    expect(normalized).toMatchObject({
      status: 'AUTO',
      enabled: true,
      version: 3,
      itemCount: 1,
    });
    expect(normalized.items[0].prompt.displayContent).toBe('检查[申请金额]');
    expect(normalized.items[0].model).toMatchObject({ modelId: 'qwen-plus' });
  });

  test('normalizeFormComponents extracts unique fields from nested component response', () => {
    const fields = normalizeFormComponents({
      content: [
        { fieldId: 'textField_title', fieldName: { zh_CN: '标题' }, fieldType: 'TextField' },
        {
          children: [
            { key: 'attachmentField_file', label: { zh_CN: '附件' }, componentName: 'AttachmentField' },
            { key: 'attachmentField_file', label: { zh_CN: '附件' }, componentName: 'AttachmentField' },
          ],
        },
      ],
    });

    expect(fields).toEqual([
      { fieldId: 'textField_title', fieldName: '标题', fieldType: 'TextField' },
      { fieldId: 'attachmentField_file', fieldName: '附件', fieldType: 'AttachmentField' },
    ]);
  });

  test('buildSettingsUrl points to the aiFormSetting page', () => {
    expect(buildSettingsUrl('https://www.aliwork.com', 'APP_XXX', 'FORM_XXX'))
      .toBe('https://www.aliwork.com/APP_XXX/admin/FORM_XXX/settings/aiFormSetting');
  });
});

describe('ai-form-setting run', () => {
  test('enable posts AUTO status and outputs JSON', async () => {
    utils.httpPost.mockResolvedValue({ success: true, content: { status: 'AUTO' } });
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await run(['enable', 'APP_XXX', 'FORM_XXX', '--json']);

    expect(utils.httpPost).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      '/APP_XXX/query/aiApprove/updateAIApproveStatus.json',
      expect.stringContaining('status=AUTO')
    );
    const postData = utils.httpPost.mock.calls[0][2];
    expect(querystring.parse(postData)).toMatchObject({
      formUuid: 'FORM_XXX',
      status: 'AUTO',
    });
    expect(JSON.parse(mockLog.mock.calls[0][0])).toMatchObject({
      success: true,
      appType: 'APP_XXX',
      formUuid: 'FORM_XXX',
      status: 'AUTO',
      enabled: true,
    });
    expect(result).toMatchObject({
      success: true,
      status: 'AUTO',
      enabled: true,
    });

    mockLog.mockRestore();
  });

  test('save posts JSON config through yida-client', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ai-form-setting-'));
    const configFile = path.join(tempDir, 'ai-config.json');
    fs.writeFileSync(configFile, JSON.stringify({
      items: [
        {
          itemName: '文本风险检查',
          itemType: 'TEXT',
          modelId: 'qwen-plus',
          prompt: '请检查备注',
        },
      ],
    }));
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const result = await run(['save', 'APP_XXX', 'FORM_XXX', configFile, '--json']);

      expect(utils.httpPostJson).toHaveBeenCalledWith(
        'https://www.aliwork.com',
        '/APP_XXX/query/aiApprove/saveOrUpdateAIApproveConfig.json?_csrf_token=csrf-token',
        expect.objectContaining({ formUuid: 'FORM_XXX' }),
        {
          csrfToken: 'csrf-token',
          referer: 'https://www.aliwork.com/APP_XXX/admin/FORM_XXX/settings/aiFormSetting',
        }
      );
      expect(result).toMatchObject({
        success: true,
        appType: 'APP_XXX',
        formUuid: 'FORM_XXX',
        version: 3,
      });
    } finally {
      mockLog.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('usage and argument errors do not exit the process', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      await expect(run([])).resolves.toEqual({ help: true });
      await expect(run(['enable', 'APP_XXX'])).rejects.toMatchObject({
        isCliError: true,
        code: 'AI_FORM_SETTING_INVALID_ARGUMENTS',
      });
      await expect(run(['missing'])).rejects.toMatchObject({
        isCliError: true,
        code: 'AI_FORM_SETTING_UNKNOWN_SUBCOMMAND',
      });
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
