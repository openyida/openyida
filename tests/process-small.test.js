'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const querystring = require('querystring');

jest.mock('child_process', () => ({
  execSync: jest.fn(() => ''),
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

const childProcess = require('child_process');
const utils = require('../lib/core/utils');
const configureProcess = require('../lib/process/configure-process');
const createProcess = require('../lib/process/create-process');
const previewProcess = require('../lib/process/preview-process');

const mockAuthData = {
  auth_mode: 'token',
  auth_source: 'token',
  user_id: 'user-1',
  csrf_token: 'csrf-token',
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
    childProcess.execSync.mockReturnValue('');
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
        formNavigationList: [
          { formUuid: 'FORM_1', processCode: 'TPROC_1' },
        ],
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
    expect(querystring.parse(utils.httpPost.mock.calls[0][2])).toMatchObject({
      _csrf_token: 'csrf-token',
      toFormType: 'process',
      formUuid: 'FORM_1',
    });
    expect(configureProcess.run).toHaveBeenCalledWith(['APP_XXX', 'FORM_1', processDefPath, 'TPROC_1']);
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
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
    expect(childProcess.execSync).toHaveBeenCalled();
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
