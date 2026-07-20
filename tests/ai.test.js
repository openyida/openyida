'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://demo.aliwork.com'),
  findProjectRoot: jest.fn(),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

jest.mock('../lib/core/chalk', () => ({
  warn: jest.fn(),
}));

const utils = require('../lib/core/utils');
const {
  run,
  getAuthRef,
  callTextFromAI,
  uploadImageForAI,
  invokeImageRecognition,
  normalizeImageResult,
  parseArgs,
} = require('../lib/ai/ai');

const authRef = {
  baseUrl: 'https://demo.aliwork.com',
  authMode: 'token',
  authSource: 'token',
  corpId: 'corp-1',
  userId: 'user-1',
};

describe('openyida ai command helpers', () => {
  let tmpDir;
  let originalFetch;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ai-test-'));
    originalFetch = global.fetch;
    jest.clearAllMocks();
    utils.findProjectRoot.mockReturnValue(tmpDir);
    utils.loadAuthData.mockReturnValue({
      base_url: authRef.baseUrl,
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp-1',
      user_id: 'user-1',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('parseArgs parses text and image options', () => {
    const textArgs = parseArgs(['text', '--prompt', 'hello', '--max-tokens', '1200', '--json']);
    expect(textArgs).toMatchObject({
      subCommand: 'text',
      prompt: 'hello',
      maxTokens: 1200,
      json: true,
    });

    const imageArgs = parseArgs([
      'image',
      '--file',
      'plant.png',
      '--app-type',
      'APP_X',
      '--connector-id',
      'Http_1',
      '--action-id',
      'recognize',
      '--connection',
      '42',
      '--no-baike',
    ]);
    expect(imageArgs).toMatchObject({
      subCommand: 'image',
      file: 'plant.png',
      appType: 'APP_X',
      connectorId: 'Http_1',
      actionId: 'recognize',
      connection: 42,
      baike: false,
    });
  });

  test('callTextFromAI posts prompt to txtFromAI endpoint', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: { content: 'true', damo_requestId: 'req-1' },
    });

    const result = await callTextFromAI('检查文本', { maxTokens: 3000 }, authRef);

    expect(result).toMatchObject({ success: true, content: 'true' });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const [baseUrl, requestPath, postData] = utils.httpPost.mock.calls[0];
    expect(baseUrl).toBe('https://demo.aliwork.com');
    expect(requestPath).toBe('/query/intelligent/txtFromAI.json');
    expect(querystring.parse(postData)).toMatchObject({
      prompt: '检查文本',
      maxTokens: '3000',
      skill: 'ToText',
    });
  });

  test('callTextFromAI reports API failures as CliError', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: false,
      errorMsg: 'AI quota exceeded',
    });

    await expect(callTextFromAI('检查文本', { maxTokens: 3000 }, authRef)).rejects.toMatchObject({
      isCliError: true,
      code: 'AI_TEXT_REQUEST_FAILED',
      message: 'AI quota exceeded',
    });
  });

  test('invokeImageRecognition mirrors HAR invokeService payload', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: {
        serviceReturnValue: {
          result: [
            { score: 0.13435246, name: '非植物', baike_info: { description: '' } },
          ],
          log_id: '2054438629859550369',
        },
      },
    });

    const value = await invokeImageRecognition('https://oss.example.com/a.png', {
      connectorId: 'Http_2aa221179eef4c128de666c5b9c8df1b',
      actionId: 'flowerrecognize',
      connection: 2391,
      baike: true,
    }, authRef);

    expect(value.result[0].name).toBe('非植物');
    const [, requestPath, postData] = utils.httpPost.mock.calls[0];
    expect(requestPath).toBe('/query/publicService/invokeService.json');
    const parsed = querystring.parse(postData);
    const inputs = JSON.parse(parsed.inputs);
    const serviceInfo = JSON.parse(parsed.serviceInfo);
    expect(inputs.body).toEqual({
      image: 'https://oss.example.com/a.png',
      baike: '1',
    });
    expect(serviceInfo.connectorInfo).toEqual({
      connectorId: 'Http_2aa221179eef4c128de666c5b9c8df1b',
      actionId: 'flowerrecognize',
      type: 'httpConnector',
      connection: 2391,
    });
  });

  test('uploadImageForAI follows ossSign, OSS post, upload2Oss, optional callback', async () => {
    const imagePath = path.join(tmpDir, 'plant.png');
    fs.writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          accessid: 'access-id',
          signature: 'signature',
          appType: 'APP_X',
          expire: '1778651341',
          host: 'https://oss.example.com',
          downloadUrl: '/ossFileHandle?appType=APP_X&fileName=obj.png&type=download',
          previewUrl: '/ossFileHandle?appType=APP_X&fileName=obj.png&type=open',
          objectName: 'APP_X_obj.png',
          policy: 'policy',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        content: 'https://public.example.com/plant.png',
      });
    utils.httpPost.mockResolvedValueOnce({ success: true, content: {} });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: (name) => name === 'x-oss-request-id' ? 'OSS_REQ_1' : '' },
    });

    const result = await uploadImageForAI(imagePath, {
      appType: 'APP_X',
      formUuid: 'FORM_X',
    }, authRef);

    expect(result).toMatchObject({
      appType: 'APP_X',
      fileName: 'plant.png',
      contentType: 'image/png',
      objectName: 'APP_X_obj.png',
      imageUrl: 'https://public.example.com/plant.png',
      ossRequestId: 'OSS_REQ_1',
      callback: 'ok',
    });
    expect(utils.httpGet.mock.calls[0][1]).toBe('/ossSign');
    expect(utils.httpGet.mock.calls[1][1]).toBe('/aliyun/sdk/upload2Oss.json');
    expect(global.fetch).toHaveBeenCalledWith('https://oss.example.com', expect.objectContaining({
      method: 'POST',
    }));
    const callbackBody = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(callbackBody).toMatchObject({
      appType: 'APP_X',
      formUuid: 'FORM_X',
      objectName: 'APP_X_obj.png',
      ossRequestId: 'OSS_REQ_1',
      businessType: 'inst',
    });
  });

  test('normalizeImageResult exposes confidence percentage', () => {
    expect(normalizeImageResult({
      result: [
        { name: '非植物', score: 0.13435246, baike_info: { baike_url: '' } },
      ],
    })).toEqual([
      expect.objectContaining({
        name: '非植物',
        score: 0.13435246,
        confidence: 13.44,
        baikeInfo: { baike_url: '' },
      }),
    ]);
  });

  test('getAuthRef uses cached login state and allows base URL override', () => {
    const result = getAuthRef({ baseUrl: 'https://custom.example.com' });

    expect(result).toMatchObject({
      baseUrl: 'https://custom.example.com',
      authMode: 'token',
      authSource: 'token',
    });
    expect(result).not.toHaveProperty('cookies');
  });

  test('run returns help and unknown subcommands without process.exit', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });

    try {
      await expect(run(['--help'])).resolves.toEqual({ help: true });
      expect(utils.loadAuthData).not.toHaveBeenCalled();

      await expect(run(['missing'])).rejects.toMatchObject({
        isCliError: true,
        code: 'AI_UNKNOWN_SUBCOMMAND',
      });
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
