'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
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
  run: jest.fn(async () => ({
    success: true,
    processCode: 'TPROC_1',
    processId: 101,
    processVersion: 1,
    verificationLevel: 'PLATFORM_VIEW_VERIFIED',
    platformViewVerified: true,
  })),
}));

jest.mock('../lib/app/create-form', () => ({
  createFormForLegacyProcess: jest.fn(),
}));

const childProcess = require('child_process');
const utils = require('../lib/core/utils');
const chalk = require('../lib/core/chalk');
const i18n = require('../lib/core/i18n');
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
    i18n.setLanguage('zh');
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('create-process reuses a form and delegates conversion and publishing to configure-process', async () => {
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(processDefPath, JSON.stringify({ nodes: [] }), 'utf8');
    const result = await createProcess.run(['APP_XXX', '--formUuid', 'FORM_1', processDefPath]);

    expect(result).toMatchObject({
      success: true,
      appType: 'APP_XXX',
      formUuid: 'FORM_1',
      processCode: 'TPROC_1',
    });
    expect(utils.httpPost).not.toHaveBeenCalled();
    expect(utils.httpGet).not.toHaveBeenCalled();
    expect(configureProcess.run).toHaveBeenCalledWith(
      ['APP_XXX', 'FORM_1', processDefPath],
      { suppressOutput: true }
    );
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
  });

  test('create-process rejects an invalid process definition before creating or converting a form', async () => {
    const fieldsPath = path.join(tmpDir, 'fields.json');
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(fieldsPath, JSON.stringify([{ type: 'TextField', label: '姓名' }]), 'utf8');
    fs.writeFileSync(processDefPath, JSON.stringify({
      nodes: [{ type: 'multiApproval', name: '缺少多人审批人', mode: 'all' }],
    }), 'utf8');

    await expect(createProcess.run([
      'APP_XXX', '流程表单', fieldsPath, processDefPath,
    ])).rejects.toMatchObject({
      code: 'PROCESS_COMPILE_APPROVER_REQUIRED',
    });
    expect(createForm.createFormForLegacyProcess).not.toHaveBeenCalled();
    expect(utils.httpPost).not.toHaveBeenCalled();
    expect(configureProcess.run).not.toHaveBeenCalled();
  });

  test('create-process returns localized compiler errors through the public English call chain', async () => {
    const processDefPath = path.join(tmpDir, 'process-en.json');
    fs.writeFileSync(processDefPath, JSON.stringify({
      nodes: [{
        type: 'multiApproval',
        name: 'Joint review',
        mode: 'invalid',
        approver: { type: 'user', users: [{ id: 'user-1', name: 'Reviewer' }] },
      }],
    }), 'utf8');
    i18n.setLanguage('en');

    await expect(createProcess.run([
      'APP_XXX', '--formUuid', 'FORM_1', processDefPath,
    ])).rejects.toMatchObject({
      code: 'PROCESS_COMPILE_MULTI_APPROVAL_MODE_INVALID',
      message: 'Multi-approval mode must be all, or, or oneByOne: invalid',
    });
    expect(configureProcess.run).not.toHaveBeenCalled();
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
    });
    configureProcess.run.mockResolvedValueOnce({
      success: true,
      processCode: 'TPROC_CREATED',
      processId: 202,
      processVersion: 1,
      verificationLevel: 'PLATFORM_VIEW_VERIFIED',
      platformViewVerified: true,
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
      processId: 202,
      processVersion: 1,
      verificationLevel: 'PLATFORM_VIEW_VERIFIED',
      platformViewVerified: true,
      url: 'https://www.aliwork.com/APP_XXX/workbench/FORM_CREATED',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
  });

  test('create-process preserves configure-process conversion failure details', async () => {
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(processDefPath, JSON.stringify({ nodes: [] }), 'utf8');
    configureProcess.run.mockRejectedValueOnce(new CliError('permission denied', {
      code: 'CONFIGURE_PROCESS_SWITCH_FAILED',
      details: {
        stage: 'switch_form_type',
        completedStages: ['read_definition', 'load_auth', 'build_definition'],
        nextStep: '确认当前账号有表单管理权限。',
      },
    }));

    let thrown;
    try {
      await createProcess.run(['APP_XXX', '--formUuid', 'FORM_1', processDefPath]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      isCliError: true,
      code: 'CREATE_PROCESS_CONFIGURE_FAILED',
      details: {
        stage: 'switch_form_type',
        configureProcess: {
          stage: 'switch_form_type',
        },
      },
    });
    expect(configureProcess.run).toHaveBeenCalledTimes(1);
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('create-process preserves configure-process inner failure stage', async () => {
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(processDefPath, JSON.stringify({ nodes: [] }), 'utf8');
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
      ['APP_XXX', 'FORM_1', processDefPath],
      { suppressOutput: true }
    );
    expect(payload).toMatchObject({
      success: false,
      errorCode: 'CONFIGURE_PROCESS_SAVE_FAILED',
      formUuid: 'FORM_1',
      appType: 'APP_XXX',
      error: expect.stringContaining('save denied'),
      stage: 'save_definition',
      completedStages: ['validate_inputs', 'load_auth', 'reuse_form'],
      nextStep: '检查流程节点配置后重试。',
      retryCommand: 'openyida create-process APP_XXX --formUuid FORM_1 ' + path.basename(processDefPath),
      configureProcess: {
        code: 'CONFIGURE_PROCESS_SAVE_FAILED',
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
        completedStages: ['validate_inputs', 'load_auth', 'reuse_form'],
        nextStep: '检查流程节点配置后重试。',
        createProcessStage: 'configure_process',
        context: {
          appType: 'APP_XXX',
          formUuid: 'FORM_1',
          processCode: null,
          retryCommand: 'openyida create-process APP_XXX --formUuid FORM_1 ' + path.basename(processDefPath),
        },
        configureProcess: {
          code: 'CONFIGURE_PROCESS_SAVE_FAILED',
          stage: 'save_definition',
          completedStages: ['read_definition', 'load_auth', 'build_definition'],
          nextStep: '检查流程节点配置后重试。',
        },
      },
    });
    expect(thrown.details.stage).not.toBe('configure_process');
  });

  test.each([
    ['draft unknown', 'NON_IDEMPOTENT_RESULT_UNKNOWN', 'create_draft'],
    ['save unknown', 'NON_IDEMPOTENT_RESULT_UNKNOWN', 'save_definition'],
    ['publish unknown', 'NON_IDEMPOTENT_RESULT_UNKNOWN', 'publish_process'],
    ['published unverified', 'PUBLISHED_UNVERIFIED', 'verify_published_view'],
  ])('create-process preserves %s and never emits a write retry command', async (_label, code, stage) => {
    const processDefPath = path.join(tmpDir, 'process.json');
    fs.writeFileSync(processDefPath, JSON.stringify({ nodes: [] }), 'utf8');
    configureProcess.run.mockRejectedValueOnce(new CliError('unsafe result', {
      code,
      details: {
        stage,
        completedStages: ['read_definition', 'load_auth', 'build_definition'],
        nextStep: '修正后重试写入。',
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
    const warnings = chalk.warn.mock.calls.map(call => call.join(' ')).join('\n');

    expect(thrown).toMatchObject({ code });
    expect(payload).toMatchObject({ errorCode: code, stage });
    expect(payload).not.toHaveProperty('retryCommand');
    expect(payload.nextStep).toMatch(/只读|人工/);
    expect(thrown.details.context).not.toHaveProperty('retryCommand');
    expect(warnings).not.toContain('openyida create-process');
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
