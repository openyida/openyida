'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../lib/core/query-data');

// ── 工具函数 mock ─────────────────────────────────────────────────────

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  triggerLogin: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

jest.mock('../lib/app/services/form-mode-service', () => ({
  readFormMode: jest.fn(),
}));

const utils = require('../lib/core/utils');
const formModeService = require('../lib/app/services/form-mode-service');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

async function expectCliError(promise, message, exitCode = 1) {
  let error;
  try {
    await promise;
  } catch (err) {
    error = err;
  }
  expect(error).toBeTruthy();
  expect(error.isCliError).toBe(true);
  expect(error.exitCode).toBe(exitCode);
  if (message) {
    expect(error.message).toContain(message);
  }
  return error;
}

function getLoggedJson(mockLog) {
  const lastCall = mockLog.mock.calls[mockLog.mock.calls.length - 1];
  return JSON.parse(lastCall[0]);
}

function buildAliasSchema() {
  return {
    success: true,
    content: {
      pages: [
        {
          componentAlias: {
            items: [
              { fieldId: 'textField_phone', alias: 'phone' },
              { fieldId: 'tableField_items', alias: 'items' },
              { fieldId: 'numberField_amount', alias: 'amount' },
            ],
          },
          componentsTree: [
            {
              componentName: 'Page',
              children: [
                {
                  componentName: 'FormContainer',
                  children: [
                    {
                      componentName: 'TextField',
                      props: { fieldId: 'textField_phone' },
                    },
                    {
                      componentName: 'TableField',
                      props: { fieldId: 'tableField_items' },
                      children: [
                        {
                          componentName: 'NumberField',
                          props: { fieldId: 'numberField_amount' },
                        },
                      ],
                    },
                  ],
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
  // 默认已登录
  utils.loadAuthData.mockReturnValue(mockAuthData);
  // 默认按普通表单处理（非流程表单）
  formModeService.readFormMode.mockResolvedValue({ mode: 'receipt' });
});

// ── 参数校验 ──────────────────────────────────────────────────────────

describe('run() 参数校验', () => {
  test('参数不足时打印错误并以 exit code 1 退出', async () => {
    await expectCliError(run(['query']), '缺少必填参数');
  });

  test('参数为空数组时打印错误并以 exit code 1 退出', async () => {
    await expectCliError(run([]), '缺少必填参数');
  });

  test('未知 action/resource 组合时打印错误并退出', async () => {
    const error = await expectCliError(run(['unknown', 'resource']), '暂未实现的命令');
    expect(error.code).toBe('DATA_ERROR');
  });

  test.each(['FORM_XXX', 'FORM-XXX'])(
    'query 漏写 form 且 formUuid 为 %s 时在认证和网络前给出精确纠错',
    async formUuid => {
      utils.loadAuthData.mockReturnValue(null);

      const error = await expectCliError(
        run(['query', 'APP_XXX', formUuid]),
        `openyida data query form APP_XXX ${formUuid}`
      );

      expect(error.code).toBe('DATA_RESOURCE_REQUIRED');
      expect(utils.loadAuthData).not.toHaveBeenCalled();
      expect(utils.triggerLogin).not.toHaveBeenCalled();
      expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
      expect(utils.httpGet).not.toHaveBeenCalled();
      expect(utils.httpPost).not.toHaveBeenCalled();
    }
  );

  test('显式未知资源不触发漏写 form 纠错', async () => {
    const error = await expectCliError(
      run(['query', 'unknown-resource', 'APP_XXX', 'FORM_XXX']),
      '暂未实现的命令：query unknown-resource'
    );

    expect(error.code).toBe('DATA_ERROR');
    expect(error.message).not.toContain('openyida data query form');
  });
});

// ── 未登录场景 ────────────────────────────────────────────────────────

describe('run() 未登录场景', () => {
  test('loadAuthData 返回 null 时尝试 triggerLogin，仍失败则打印错误并退出', async () => {
    utils.loadAuthData.mockReturnValue(null);
    utils.triggerLogin.mockReturnValue(null);

    await expectCliError(run(['query', 'form', 'APP_XXX', 'FORM-XXX']), '无法获取有效 token 登录态');
  });

  test('loadAuthData 返回不可用对象时尝试 triggerLogin，仍失败则退出', async () => {
    utils.loadAuthData.mockReturnValue({});
    utils.triggerLogin.mockReturnValue(null);

    await expectCliError(run(['query', 'form', 'APP_XXX', 'FORM-XXX']), '无法获取有效 token 登录态');
  });
});

// ── query form 场景 ───────────────────────────────────────────────────

describe('run() query form', () => {
  test('查询成功时输出 JSON 结果', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { totalCount: 5, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'form', 'APP_XXX', 'FORM-XXX']);

    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"success": true'));

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('查询失败时打印错误并以 exit code 1 退出', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: false,
      errorMsg: '权限不足',
      errorCode: '403',
    });

    await expectCliError(run(['query', 'form', 'APP_XXX', 'FORM-XXX']), '权限不足');
  });

  test('传入 --page 和 --size 参数时正常执行', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { totalCount: 0, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--page', '2', '--size', '50']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--size 超过 100 时被截断为 100', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { totalCount: 0, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--size', '999']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('传入 --search-json 参数时正常执行', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { totalCount: 1, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--search-json', '{"field_1":"value"}']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--resolve-aliases 会把查询条件中的组件别名转换为 fieldId', async () => {
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet
      .mockResolvedValueOnce(buildAliasSchema())
      .mockResolvedValueOnce({
        success: true,
        content: { totalCount: 1, data: [] },
      });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--search-json', '{"phone":"123"}', '--resolve-aliases']);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpGet.mock.calls[0][1]).toBe('/alibaba/web/APP_XXX/_view/query/formdesign/getFormSchema.json');
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({
      searchFieldJson: '{"textField_phone":"123"}',
    });

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--resolve-aliases 支持数组式查询条件的 key 字段', async () => {
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet
      .mockResolvedValueOnce(buildAliasSchema())
      .mockResolvedValueOnce({
        success: true,
        content: { totalCount: 1, data: [] },
      });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--search-json', '[{"key":"phone","value":"123"}]', '--resolve-aliases']);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({
      searchFieldJson: '[{"key":"textField_phone","value":"123"}]',
    });

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--search-json 传入非法 JSON 时打印错误并退出', async () => {
    await expectCliError(
      run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--search-json', 'not-json']),
      'JSON'
    );
  });

  test('传入 --search-file 时读取文件作为查询条件', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-search-'));
    const searchPath = path.join(tmpDir, 'search.json');
    fs.writeFileSync(searchPath, JSON.stringify([{ key: 'field_1', value: 'value' }]), 'utf-8');

    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { totalCount: 1, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--search-file', searchPath]);
      expect(utils.httpGet).toHaveBeenCalledTimes(1);
      expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
        searchFieldJson: '[{"key":"field_1","value":"value"}]',
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      mockLog.mockRestore();
      mockError.mockRestore();
    }
  });

  test('--all 自动分页拉取完整表单数据', async () => {
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          totalCount: 3,
          data: [{ id: 'A' }, { id: 'B' }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        content: {
          totalCount: 3,
          data: [{ id: 'C' }],
        },
      });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--all', '--size', '2']);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({ currentPage: '1', pageSize: '2' });
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({ currentPage: '2', pageSize: '2' });
    expect(mockLog.mock.calls[0][0]).toContain('"pagesFetched": 2');
    expect(mockLog.mock.calls[0][0]).toContain('"id": "C"');

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--resolve-aliases 会映射 dynamicOrder 中的别名', async () => {
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet
      .mockResolvedValueOnce(buildAliasSchema())
      .mockResolvedValueOnce({
        success: true,
        content: { totalCount: 0, data: [] },
      });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--dynamic-order', '{"phone":"+"}', '--resolve-aliases']);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({
      dynamicOrder: '{"textField_phone":"+"}',
    });

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('同时传入 --search-json 和 --search-file 时打印错误并退出', async () => {
    await expectCliError(
      run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--search-json', '[]', '--search-file', '.cache/openyida/search.json']),
      '不能同时使用'
    );
  });
});

// ── get form（--inst-id）场景 ─────────────────────────────────────────

describe('run() get form', () => {
  test('传入 --inst-id 时调用实例详情接口并输出结果', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { formInstId: 'INST-001', formData: {} },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['get', 'form', 'APP_XXX', '--inst-id', 'INST-001']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"success": true'));

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('传入 --form-uuid 时补全被 50 条截断的子表数据', async () => {
    const truncatedRows = Array.from({ length: 50 }, (_, index) => ({ rowId: `old-${index}` }));
    const hydratedRows = Array.from({ length: 60 }, (_, index) => ({ rowId: `new-${index}` }));
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          formInstId: 'INST-001',
          formData: {
            textField_1: 'ok',
            tableField_1: truncatedRows,
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        content: {
          totalCount: 60,
          data: hydratedRows,
        },
      });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['get', 'form', 'APP_XXX', '--inst-id', 'INST-001', '--form-uuid', 'FORM-XXX']);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({
      formUuid: 'FORM-XXX',
      formInstanceId: 'INST-001',
      tableFieldId: 'tableField_1',
      pageSize: '100',
    });
    expect(mockLog.mock.calls[0][0]).toContain('"hydratedCount": 60');
    expect(mockLog.mock.calls[0][0]).toContain('"rowId": "new-59"');

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--inst-id 查询失败时打印错误并退出', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: false,
      errorMsg: '实例不存在',
      errorCode: '404',
    });

    await expectCliError(run(['get', 'form', 'APP_XXX', '--inst-id', 'INST-999']), '实例不存在');
  });

  test('缺少 --inst-id 时打印错误并退出', async () => {
    await expectCliError(run(['get', 'form', 'APP_XXX']), '缺少必填参数');
  });
});

// ── create form 场景 ──────────────────────────────────────────────────

describe('run() create form', () => {
  test('receipt 创建成功时输出根层 formInstId 和已验证资源，同时深度保留 content', async () => {
    const content = {
      formInstId: 'INST-NEW',
      formData: { textField_1: 'hello' },
      metadata: { nested: { preserved: true } },
    };
    utils.httpPost.mockResolvedValue({
      success: true,
      content,
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-json', '{"textField_1":"hello"}']);
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
    expect(getLoggedJson(mockLog)).toEqual({
      success: true,
      content,
      formInstId: 'INST-NEW',
      resource: { type: 'formInstance', id: 'INST-NEW' },
      idVerified: true,
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/v1/form/saveFormData.json');

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test.each([
    ['receipt', { mode: 'receipt' }, 'formInstId', 'formInstance', 'FINST-SCALAR'],
    ['process', { mode: 'process', processCode: 'PROC-XXX' }, 'processInstanceId', 'processInstance', 'PFINST-SCALAR'],
  ])('%s 创建成功且平台 content 直接返回 ID 时输出稳定根层契约', async (
    _label,
    mode,
    idKey,
    resourceType,
    platformId
  ) => {
    formModeService.readFormMode.mockResolvedValue(mode);
    utils.httpPost.mockResolvedValue({ success: true, content: platformId });
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-json', '{"textField_1":"hello"}']);

    const output = getLoggedJson(mockLog);
    mockLog.mockRestore();
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(output.content).toBe(platformId);
    expect(output[idKey]).toBe(platformId);
    expect(output.resource).toEqual({ type: resourceType, id: platformId });
    expect(output.idVerified).toBe(true);
  });

  test('传入 --data-file 时读取文件作为创建数据', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-data-'));
    const dataPath = path.join(tmpDir, 'data.json');
    fs.writeFileSync(dataPath, JSON.stringify({ textField_1: 'from-file' }), 'utf-8');

    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpPost.mockResolvedValue({
      success: true,
      content: { formInstId: 'INST-FILE' },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-file', dataPath]);
      expect(utils.httpPost).toHaveBeenCalledTimes(1);
      expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/v1/form/saveFormData.json');
      expect(decodeURIComponent(utils.httpPost.mock.calls[0][2])).toContain('formDataJson={"textField_1":"from-file"}');
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      mockLog.mockRestore();
      mockError.mockRestore();
    }
  });

  test('--resolve-aliases 会把提交数据中的组件别名转换为 fieldId', async () => {
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet.mockResolvedValueOnce(buildAliasSchema());
    utils.httpPost.mockResolvedValue({
      success: true,
      content: { formInstId: 'INST-ALIAS' },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([
      'create',
      'form',
      'APP_XXX',
      'FORM-XXX',
      '--data-json',
      '{"phone":"123","items":[{"amount":8}]}',
      '--resolve-aliases',
    ]);

    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const postBody = decodeURIComponent(utils.httpPost.mock.calls[0][2]);
    expect(postBody).toContain('formDataJson={"textField_phone":"123","tableField_items":[{"numberField_amount":8}]}');

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('目标表单是流程表单时自动使用 startInstance.json 发起流程', async () => {
    formModeService.readFormMode.mockResolvedValue({ mode: 'process', processCode: 'PROC-XXX' });
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    const content = {
      processInstanceId: 'PROC-INST-NEW',
      workflow: { nested: { preserved: true } },
    };
    utils.httpPost.mockResolvedValue({
      success: true,
      content,
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-json', '{"textField_1":"hello"}']);

    expect(formModeService.readFormMode).toHaveBeenCalledWith(
      expect.objectContaining({ corpId: 'corp-1' }),
      { appType: 'APP_XXX', formUuid: 'FORM-XXX' }
    );
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/v1/process/startInstance.json');
    const postBody = decodeURIComponent(utils.httpPost.mock.calls[0][2]);
    expect(postBody).toContain('processCode=PROC-XXX');
    expect(postBody).toContain('formDataJson={"textField_1":"hello"}');
    expect(getLoggedJson(mockLog)).toEqual({
      success: true,
      content,
      processInstanceId: 'PROC-INST-NEW',
      resource: { type: 'processInstance', id: 'PROC-INST-NEW' },
      idVerified: true,
    });

    mockLog.mockRestore();
    mockWarn.mockRestore();
  });

  test.each([
    ['readFormMode 抛错', () => formModeService.readFormMode.mockRejectedValue(new Error('binding timeout')), 'FORM_MODE_READ_FAILED'],
    ['readFormMode 返回空值', () => formModeService.readFormMode.mockResolvedValue(null), 'FORM_MODE_RESULT_INVALID'],
    ['readFormMode 返回 receipt/processCode 冲突', () => formModeService.readFormMode.mockResolvedValue({ mode: 'receipt', processCode: 'PROC-CONFLICT' }), 'FORM_MODE_RESULT_INVALID'],
    ['readFormMode 返回 process 但缺少 processCode', () => formModeService.readFormMode.mockResolvedValue({ mode: 'process' }), 'FORM_MODE_RESULT_INVALID'],
  ])('%s 时 fail-closed 且远端写入为 0', async (_label, arrangeMode, expectedCauseCode) => {
    arrangeMode();
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));

    const error = await expectCliError(
      run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-json', '{"textField_1":"hello"}'])
    );

    expect(error.code).toBe('DATA_FORM_MODE_UNVERIFIED');
    expect(error.details).toEqual({ causeCode: expectedCauseCode });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test.each([
    ['receipt', { mode: 'receipt' }],
    ['process', { mode: 'process', processCode: 'PROC-XXX' }],
  ])('%s 创建成功但平台未返回 ID 时不猜测或重试', async (_label, mode) => {
    formModeService.readFormMode.mockResolvedValue(mode);
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    const content = { accepted: true, nested: { instanceId: 'DO-NOT-GUESS' } };
    utils.httpPost.mockResolvedValue({ success: true, content });
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-json', '{"textField_1":"hello"}']);

    const output = getLoggedJson(mockLog);
    mockLog.mockRestore();
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(output.content).toEqual(content);
    expect(output.resource).toBeNull();
    expect(output.idVerified).toBe(false);
    expect(output).not.toHaveProperty('formInstId');
    expect(output).not.toHaveProperty('processInstanceId');
  });

  test.each([
    ['receipt', { mode: 'receipt' }, '/dingtalk/web/APP_XXX/v1/form/saveFormData.json'],
    ['process', { mode: 'process', processCode: 'PROC-XXX' }, '/dingtalk/web/APP_XXX/v1/process/startInstance.json'],
  ])('%s 写失败时使用 one-shot 边界且不重试', async (_label, mode, expectedPath) => {
    formModeService.readFormMode.mockResolvedValue(mode);
    utils.requestWithAutoLogin.mockRejectedValue(new Error('auto-login replay must not run'));
    utils.httpPost.mockRejectedValue(new Error('write failed'));

    await expect(
      run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-json', '{"textField_1":"hello"}'])
    ).rejects.toThrow('write failed');

    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe(expectedPath);
  });

  test('root/content ID 冲突时保留 content 但不验证或猜测资源 ID', async () => {
    const result = {
      success: true,
      formInstId: 'INST-ROOT',
      content: {
        formInstId: 'INST-CONTENT',
        nested: { preserved: true },
      },
    };
    utils.requestWithAutoLogin.mockResolvedValue(result);
    utils.httpPost.mockResolvedValue(result);
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-json', '{"textField_1":"hello"}']);

    const output = getLoggedJson(mockLog);
    mockLog.mockRestore();
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(output.content).toEqual(result.content);
    expect(output.resource).toBeNull();
    expect(output.idVerified).toBe(false);
  });

  test('缺少 --data-json 时打印错误并退出', async () => {
    await expectCliError(run(['create', 'form', 'APP_XXX', 'FORM-XXX']), '缺少必填参数');
  });
});

describe('run() update form alias resolution', () => {
  test('--resolve-aliases 缺少 --form-uuid 时提示错误', async () => {
    await expectCliError(
      run(['update', 'form', 'APP_XXX', '--inst-id', 'INST-001', '--data-json', '{"phone":"123"}', '--resolve-aliases']),
      '--resolve-aliases 需要提供 formUuid'
    );
  });
});

describe('run() query subform alias resolution', () => {
  test('--resolve-aliases 会把子表组件别名转换为 tableFieldId', async () => {
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet
      .mockResolvedValueOnce(buildAliasSchema())
      .mockResolvedValueOnce({
        success: true,
        content: { totalCount: 0, data: [] },
      });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([
      'query',
      'subform',
      'APP_XXX',
      'FORM-XXX',
      '--inst-id',
      'INST-001',
      '--table-field-id',
      'items',
      '--resolve-aliases',
    ]);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({
      tableFieldId: 'tableField_items',
    });

    mockLog.mockRestore();
    mockError.mockRestore();
  });
});

// ── query tasks 场景 ──────────────────────────────────────────────────

describe('run() query tasks', () => {
  test('查询待办任务成功时输出结果', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { totalCount: 3, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['query', 'tasks', 'APP_XXX', '--type', 'todo']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"success": true'));

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--type 传入非法值时打印错误并退出', async () => {
    await expectCliError(run(['query', 'tasks', 'APP_XXX', '--type', 'invalid']), '--type 仅支持');
  });

  test('缺少 --type 时打印错误并退出', async () => {
    await expectCliError(run(['query', 'tasks', 'APP_XXX']), '缺少必填参数');
  });
});
