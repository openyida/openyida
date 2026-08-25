'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const querystring = require('querystring');
const { CliError } = require('../lib/core/cli-error');

jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => ({ status: 0 })),
  execSync: jest.fn(),
}));

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
  findProjectRoot: jest.fn(() => require('os').tmpdir()),
}));

jest.mock('../lib/core/chalk', () => ({
  warn: jest.fn(),
}));

jest.mock('../lib/process/configure-process', () => ({
  run: jest.fn(async () => ({ success: true })),
}));

jest.mock('../lib/app/create-form', () => ({
  createFormForLegacyProcess: jest.fn(),
}));

const childProcess = require('child_process');
const utils = require('../lib/core/utils');
const configureProcess = require('../lib/process/configure-process');
const createForm = require('../lib/app/create-form');
const createProcess = require('../lib/process/create-process');
const previewProcess = require('../lib/process/preview-process');

const mockAuthData = {
  auth_mode: 'token',
  auth_source: 'token',
  user_id: 'user-1',
  base_url: 'https://www.aliwork.com',
  corp_id: 'corp-1',
};

describe('small process commands', () => {
  let tmpDir;
  let logSpy;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-small-'));
    jest.clearAllMocks();
    utils.loadAuthData.mockReturnValue(mockAuthData);
    utils.findProjectRoot.mockReturnValue(tmpDir);
    utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
    childProcess.spawnSync.mockReturnValue({ status: 0 });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('create-process reuses a form, switches type, and runs configure-process', async () => {
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(processDefPath, JSON.stringify({ nodes: [] }), 'utf8');
    utils.httpPost.mockResolvedValueOnce({ success: true });
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        appType: 'APP_XXX',
        procCode: 'TPROC_1',
      },
    });

    const result = await createProcess.run(['APP_XXX', '--formUuid', 'FORM_1', processDefPath]);

    expect(result).toMatchObject({
      success: true,
      appType: 'APP_XXX',
      formUuid: 'FORM_1',
      processCode: 'TPROC_1',
    });
    expect(utils.httpPost.mock.calls[0][1]).toContain('/APP_XXX/query/formdesign/switchFormType.json');
    expect(utils.httpGet.mock.calls[0][1]).toContain('/APP_XXX/query/formProcBinding/getBindingByFormUuid.json');
    expect(querystring.parse(utils.httpPost.mock.calls[0][2])).toMatchObject({
      toFormType: 'process',
      formUuid: 'FORM_1',
    });
    expect(configureProcess.run).toHaveBeenCalledWith(
      ['APP_XXX', 'FORM_1', processDefPath, 'TPROC_1'],
      { suppressOutput: true }
    );
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
  });

  test('create-process creates a form through the JS bridge without invoking the CLI subprocess', async () => {
    const fieldsPath = path.join(tmpDir, 'fields.json');
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([{ type: 'TextField', label: '姓名' }]), 'utf8');
    fs.writeFileSync(processDefPath, JSON.stringify({ nodes: [] }), 'utf8');
    createForm.createFormForLegacyProcess.mockResolvedValueOnce({
      success: true,
      appType: 'APP_XXX',
      formUuid: 'FORM_CREATED',
      formTitle: '流程表单',
      fieldCount: 1,
      configResult: { success: false, errorMsg: 'legacy warning' },
    });
    utils.httpPost.mockResolvedValueOnce({ success: true });
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        appType: 'APP_XXX',
        procCode: 'TPROC_CREATED',
      },
    });

    const result = await createProcess.run([
      'APP_XXX',
      '流程表单',
      fieldsPath,
      processDefPath,
    ]);

    expect(createForm.createFormForLegacyProcess).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://www.aliwork.com' }),
      {
        appType: 'APP_XXX',
        formTitle: '流程表单',
        fieldsJsonFile: fieldsPath,
      }
    );
    expect(childProcess.execSync).not.toHaveBeenCalled();
    expect(configureProcess.run).toHaveBeenCalledWith(
      [
        'APP_XXX',
        'FORM_CREATED',
        processDefPath,
        'TPROC_CREATED',
      ],
      { suppressOutput: true }
    );
    expect(result).toEqual({
      success: true,
      formUuid: 'FORM_CREATED',
      formTitle: '流程表单',
      appType: 'APP_XXX',
      fieldCount: 1,
      processCode: 'TPROC_CREATED',
      url: 'https://www.aliwork.com/APP_XXX/workbench/FORM_CREATED',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
  });

  test('create-process reports switch stage with compact failure details', async () => {
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(processDefPath, JSON.stringify({ nodes: [] }), 'utf8');
    utils.httpPost.mockResolvedValueOnce({
      success: false,
      errorMsg: 'permission denied',
      content: {
        nested: 'x'.repeat(2000),
        token: 'private-token-value',
      },
    });

    let thrown;
    try {
      await createProcess.run(['APP_XXX', '--formUuid', 'FORM_1', processDefPath]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      isCliError: true,
      code: 'CREATE_PROCESS_SWITCH_FAILED',
      details: {
        stage: 'switch_form_type',
        completedStages: ['load_auth', 'reuse_form'],
        context: {
          appType: 'APP_XXX',
          formUuid: 'FORM_1',
          processDefinitionFile: processDefPath,
        },
        cause: {
          success: false,
          errorMsg: 'permission denied',
          content: {
            type: 'object',
            keys: ['nested', 'token'],
          },
        },
      },
    });
    expect(thrown.details.nextStep).toContain('表单管理权限');
    expect(JSON.stringify(thrown.details)).not.toContain('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  });

  test('create-process preserves configure-process inner failure stage', async () => {
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(processDefPath, JSON.stringify({ nodes: [] }), 'utf8');
    utils.httpPost.mockResolvedValueOnce({ success: true });
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        appType: 'APP_XXX',
        procCode: 'TPROC_1',
      },
    });
    configureProcess.run.mockRejectedValueOnce(new CliError('save denied', {
      code: 'CONFIGURE_PROCESS_SAVE_FAILED',
      details: {
        stage: 'save_definition',
        completedStages: ['read_definition', 'load_auth', 'build_definition'],
        nextStep: '检查流程节点配置后重试。',
      },
    }));

    let thrown;
    try {
      await createProcess.run(['APP_XXX', '--formUuid', 'FORM_1', processDefPath]);
    } catch (error) {
      thrown = error;
    }

    const payload = logSpy.mock.calls
      .map(call => call[0])
      .filter(line => typeof line === 'string' && line.startsWith('{'))
      .map(line => JSON.parse(line))
      .find(item => item && item.success === false);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(configureProcess.run).toHaveBeenCalledWith(
      ['APP_XXX', 'FORM_1', processDefPath, 'TPROC_1'],
      { suppressOutput: true }
    );
    expect(payload).toMatchObject({
      success: false,
      formUuid: 'FORM_1',
      appType: 'APP_XXX',
      error: expect.stringContaining('save denied'),
      stage: 'save_definition',
      completedStages: ['load_auth', 'reuse_form', 'switch_form_type', 'resolve_process_code'],
      nextStep: '检查流程节点配置后重试。',
      retryCommand: 'openyida create-process APP_XXX --formUuid FORM_1 ' + path.basename(processDefPath),
      configureProcess: {
        stage: 'save_definition',
        completedStages: ['read_definition', 'load_auth', 'build_definition'],
        nextStep: '检查流程节点配置后重试。',
      },
    });
    expect(payload.stage).not.toBe('configure_process');
    expect(thrown).toMatchObject({
      isCliError: true,
      code: 'CREATE_PROCESS_CONFIGURE_FAILED',
      details: {
        stage: 'save_definition',
        completedStages: ['load_auth', 'reuse_form', 'switch_form_type', 'resolve_process_code'],
        nextStep: '检查流程节点配置后重试。',
        createProcessStage: 'configure_process',
        context: {
          appType: 'APP_XXX',
          formUuid: 'FORM_1',
          processCode: 'TPROC_1',
          retryCommand: 'openyida create-process APP_XXX --formUuid FORM_1 ' + path.basename(processDefPath),
        },
        configureProcess: {
          stage: 'save_definition',
          completedStages: ['read_definition', 'load_auth', 'build_definition'],
          nextStep: '检查流程节点配置后重试。',
        },
      },
    });
    expect(thrown.details.stage).not.toBe('configure_process');
  });

  test('preview-process writes an HTML preview and returns metadata', async () => {
    const outputPath = path.join(tmpDir, 'preview.html');
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          instanceStatus: 'COMPLETED',
          originator: { name: 'Ada' },
          createTime: '2026-05-01 10:00:00',
          actionExecutor: [],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        content: [],
      });

    const result = await previewProcess.run(['APP_XXX', 'PROC_INST_1', '--output', outputPath]);

    expect(result).toMatchObject({
      success: true,
      outputPath,
      processInstanceId: 'PROC_INST_1',
      instanceStatus: 'COMPLETED',
    });
    expect(fs.readFileSync(outputPath, 'utf8')).toContain('PROC_INST_1');
    expect(utils.httpGet.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/v1/process/getInstanceById.json');
    expect(utils.httpGet.mock.calls[1][1]).toBe('/dingtalk/web/APP_XXX/v1/process/getOperationRecords.json');
    expect(childProcess.spawnSync).toHaveBeenCalled();
    const [, args] = childProcess.spawnSync.mock.calls[0];
    expect(args[args.length - 1]).toBe(outputPath);
  });

  test('preview browser launcher passes local file paths as argv', () => {
    const filePath = 'C:\\tmp\\preview & report.html';
    expect(previewProcess.resolvePreviewBrowserLauncher(filePath, 'darwin')).toEqual({
      command: 'open',
      args: [filePath],
    });
    expect(previewProcess.resolvePreviewBrowserLauncher(filePath, 'win32')).toEqual({
      command: 'rundll32',
      args: ['url.dll,FileProtocolHandler', filePath],
    });
    expect(previewProcess.resolvePreviewBrowserLauncher(filePath, 'linux')).toEqual({
      command: 'xdg-open',
      args: [filePath],
    });
  });

  test('usage errors reject as CliError instead of exiting', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });

    try {
      await expect(createProcess.run([])).rejects.toMatchObject({
        isCliError: true,
        code: 'CREATE_PROCESS_INVALID_ARGUMENTS',
      });
      await expect(previewProcess.run([])).rejects.toMatchObject({
        isCliError: true,
        code: 'PREVIEW_PROCESS_INVALID_ARGUMENTS',
      });
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });
});
