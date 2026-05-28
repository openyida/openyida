'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../lib/core/query-data');

// ── 工具函数 mock ─────────────────────────────────────────────────────

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  triggerLogin: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');

const mockCookieData = {
  cookies: [{ name: 'tianshu_csrf_token', value: 'tok123' }],
  csrf_token: 'tok123',
};

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
  utils.loadCookieData.mockReturnValue(mockCookieData);
});

// ── 参数校验 ──────────────────────────────────────────────────────────

describe('run() 参数校验', () => {
  test('参数不足时打印错误并以 exit code 1 退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['query'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('缺少必填参数'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('参数为空数组时打印错误并以 exit code 1 退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('未知 action/resource 组合时打印错误并退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['unknown', 'resource'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});

// ── 未登录场景 ────────────────────────────────────────────────────────

describe('run() 未登录场景', () => {
  test('loadCookieData 返回 null 时尝试 triggerLogin，仍失败则打印错误并退出', async () => {
    utils.loadCookieData.mockReturnValue(null);
    utils.triggerLogin.mockReturnValue(null);

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['query', 'form', 'APP_XXX', 'FORM-XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('无法获取有效登录态'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('loadCookieData 返回无 cookies 字段时尝试 triggerLogin，仍失败则退出', async () => {
    utils.loadCookieData.mockReturnValue({ csrf_token: 'tok' }); // 无 cookies 字段
    utils.triggerLogin.mockReturnValue(null);

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['query', 'form', 'APP_XXX', 'FORM-XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
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

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['query', 'form', 'APP_XXX', 'FORM-XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('权限不足'));

    mockExit.mockRestore();
    mockError.mockRestore();
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
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--search-json', 'not-json'])
    ).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('JSON'));

    mockExit.mockRestore();
    mockError.mockRestore();
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
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      run(['query', 'form', 'APP_XXX', 'FORM-XXX', '--search-json', '[]', '--search-file', '.cache/openyida/search.json'])
    ).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('不能同时使用'));

    mockExit.mockRestore();
    mockError.mockRestore();
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

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['get', 'form', 'APP_XXX', '--inst-id', 'INST-999'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('实例不存在'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('缺少 --inst-id 时打印错误并退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['get', 'form', 'APP_XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});

// ── create form 场景 ──────────────────────────────────────────────────

describe('run() create form', () => {
  test('创建成功时输出 JSON 结果', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { formInstId: 'INST-NEW' },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['create', 'form', 'APP_XXX', 'FORM-XXX', '--data-json', '{"textField_1":"hello"}']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"success": true'));

    mockLog.mockRestore();
    mockError.mockRestore();
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

  test('缺少 --data-json 时打印错误并退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['create', 'form', 'APP_XXX', 'FORM-XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});

describe('run() update form alias resolution', () => {
  test('--resolve-aliases 缺少 --form-uuid 时提示错误', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      run(['update', 'form', 'APP_XXX', '--inst-id', 'INST-001', '--data-json', '{"phone":"123"}', '--resolve-aliases'])
    ).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('--resolve-aliases 需要提供 formUuid'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});

describe('run() batch-update form', () => {
  function writeBatchFile(records) {
    const tmpFile = path.join(os.tmpdir(), 'openyida-batch-update-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    fs.writeFileSync(tmpFile, JSON.stringify(records), 'utf8');
    return tmpFile;
  }

  test('按文件顺序批量更新并输出汇总结果', async () => {
    const batchFile = writeBatchFile([
      { formInstId: 'INST-001', formData: { textField_status: '已处理' } },
      { formInstId: 'INST-002', formData: { textField_status: '已关闭' } },
    ]);
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formInstId: 'INST-001' } })
      .mockResolvedValueOnce({ success: true, content: { formInstId: 'INST-002' } });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['batch-update', 'form', 'APP_XXX', '--file', batchFile, '--max', '2']);

    expect(utils.httpPost).toHaveBeenCalledTimes(2);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/v1/form/updateFormData.json');
    expect(decodeURIComponent(utils.httpPost.mock.calls[0][2])).toContain('formInstId=INST-001');
    expect(decodeURIComponent(utils.httpPost.mock.calls[1][2])).toContain('formInstId=INST-002');
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      total: 2,
      attempted: 2,
      successCount: 2,
      failureCount: 0,
      max: 2,
    });

    fs.unlinkSync(batchFile);
    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('记录数超过 --max 时拦截且不发送请求', async () => {
    const batchFile = writeBatchFile([
      { formInstId: 'INST-001', formData: { textField_status: '已处理' } },
      { formInstId: 'INST-002', formData: { textField_status: '已关闭' } },
    ]);
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['batch-update', 'form', 'APP_XXX', '--file', batchFile, '--max', '1'])).rejects.toThrow('process.exit(1)');

    expect(utils.httpPost).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('超过上限 1'));

    fs.unlinkSync(batchFile);
    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('--stop-on-error 遇到失败后停止后续记录', async () => {
    const batchFile = writeBatchFile([
      { formInstId: 'INST-001', formData: { textField_status: '已处理' } },
      { formInstId: 'INST-002', formData: { textField_status: '已关闭' } },
      { formInstId: 'INST-003', formData: { textField_status: '已取消' } },
    ]);
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formInstId: 'INST-001' } })
      .mockResolvedValueOnce({ success: false, errorMsg: '更新失败' });
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['batch-update', 'form', 'APP_XXX', '--file', batchFile, '--stop-on-error'])).rejects.toThrow('process.exit(1)');

    expect(utils.httpPost).toHaveBeenCalledTimes(2);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('"success": false'));
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('"total": 3'));
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('"attempted": 2'));
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('"successCount": 1'));
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('"failureCount": 1'));
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('"stoppedOnError": true'));

    fs.unlinkSync(batchFile);
    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('--resolve-aliases 会转换每条记录的 formData 字段别名', async () => {
    const batchFile = writeBatchFile([
      { formInstId: 'INST-001', formData: { phone: '123' } },
    ]);
    utils.requestWithAutoLogin.mockImplementation((fn, session) => fn(session));
    utils.httpGet.mockResolvedValueOnce(buildAliasSchema());
    utils.httpPost.mockResolvedValueOnce({ success: true });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['batch-update', 'form', 'APP_XXX', '--file', batchFile, '--form-uuid', 'FORM-XXX', '--resolve-aliases']);

    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(utils.httpPost.mock.calls[0][2])).toContain('updateFormDataJson={"textField_phone":"123"}');

    fs.unlinkSync(batchFile);
    mockLog.mockRestore();
    mockError.mockRestore();
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
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['query', 'tasks', 'APP_XXX', '--type', 'invalid'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('缺少 --type 时打印错误并退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['query', 'tasks', 'APP_XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});
