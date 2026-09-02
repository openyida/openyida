'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function platformView(formUuid, children) {
  return {
    success: true,
    content: JSON.stringify({
      bindingForm: formUuid,
      formulaRules: [],
      globalSetting: {},
      schema: {
        componentName: 'CanvasEngine',
        children: children || [
          { componentName: 'ApplyNode', props: { name: { zh_CN: '发起' } } },
          { componentName: 'EndNode', props: { name: { zh_CN: '结束' } } },
        ],
      },
    }),
  };
}

function loadSubject(options = {}) {
  const mockGet = jest.fn();
  const mockGetOnce = jest.fn();
  const mockPostForm = jest.fn();
  const mockPostFormOnce = jest.fn();
  const authRef = {
    baseUrl: 'https://www.aliwork.com',
    authMode: 'token',
    authSource: 'token',
  };

  jest.resetModules();
  jest.doMock('../lib/core/yida-client', () => ({
    createAuthRef: jest.fn(() => authRef),
    createYidaClient: jest.fn(() => ({
      get: mockGet,
      getOnce: mockGetOnce,
      postForm: mockPostForm,
      postFormOnce: mockPostFormOnce,
    })),
  }));
  jest.doMock('../lib/core/chalk', () => ({ warn: jest.fn() }));

  const subject = require('../lib/process/configure-process');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-safety-'));
  const definitionFile = path.join(tempDir, 'process.json');
  fs.writeFileSync(definitionFile, JSON.stringify(options.definition || { nodes: [] }));
  return {
    subject,
    definitionFile,
    tempDir,
    mockGet,
    mockGetOnce,
    mockPostForm,
    mockPostFormOnce,
  };
}

function queueExistingProcess(harness, options = {}) {
  const processId = options.processId || 100;
  const processVersion = options.processVersion || 2;
  harness.mockGet
    .mockResolvedValueOnce({
      success: true,
      content: {
        appType: 'APP_TEST',
        formUuid: 'FORM_TEST',
        procCode: options.bindingProcessCode || 'TPROC_TEST',
      },
    })
    .mockResolvedValueOnce({
      success: true,
      content: { data: options.published === false ? [] : [{ id: processId, version: String(processVersion) }] },
    })
    .mockResolvedValueOnce({
      success: true,
      content: { data: options.saved || [] },
    });
}

describe('configure-process replacement and verification safety', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('../lib/core/yida-client');
    jest.dontMock('../lib/core/chalk');
  });

  test('parses explicit --replace without treating it as processCode', () => {
    const harness = loadSubject();
    expect(harness.subject.parseArgs([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST', '--replace',
    ])).toMatchObject({ processCodeArg: 'TPROC_TEST', replace: true });
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test.each([
    ['PUBLISHED process', { published: true, saved: [] }],
    ['SAVED draft', { published: false, saved: [{ id: 101, version: '1', status: 'SAVED' }] }],
  ])('requires --replace for an existing %s before any write', async (_label, state) => {
    const harness = loadSubject();
    queueExistingProcess(harness, state);

    await expect(harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST',
    ])).rejects.toMatchObject({
      code: 'CONFIGURE_PROCESS_REPLACE_REQUIRED',
      details: expect.objectContaining({ remoteWrites: 0 }),
    });
    expect(harness.mockPostForm).not.toHaveBeenCalled();
    expect(harness.mockPostFormOnce).not.toHaveBeenCalled();
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test('rejects an unowned processCode before version reads or writes', async () => {
    const harness = loadSubject();
    harness.mockGet.mockResolvedValueOnce({
      success: true,
      content: { appType: 'APP_TEST', formUuid: 'FORM_TEST', procCode: 'TPROC_OTHER' },
    });

    await expect(harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST', '--replace',
    ])).rejects.toMatchObject({
      code: 'CONFIGURE_PROCESS_OWNERSHIP_UNVERIFIED',
      details: expect.objectContaining({ remoteWrites: 0 }),
    });
    expect(harness.mockGet).toHaveBeenCalledTimes(1);
    expect(harness.mockPostFormOnce).not.toHaveBeenCalled();
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test('uses one-shot draft/save/publish and verifies the exact published platform view', async () => {
    const harness = loadSubject();
    queueExistingProcess(harness);
    harness.mockPostFormOnce
      .mockResolvedValueOnce({ success: true, content: { processId: 101, processVersion: 3 } })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    harness.mockGetOnce
      .mockResolvedValueOnce({ success: true, content: { data: [{ id: 101, version: '3', status: 'PUBLISHED' }] } })
      .mockResolvedValueOnce(platformView('FORM_TEST'));
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST', '--replace',
    ]);

    expect(harness.mockPostForm).not.toHaveBeenCalled();
    expect(harness.mockPostFormOnce.mock.calls.map((call) => call[0])).toEqual([
      '/APP_TEST/query/simpleProcess/newDraftProcess.json',
      '/alibaba/web/APP_TEST/query/simpleProcess/saveProcessById.json',
      '/alibaba/web/APP_TEST/query/simpleProcess/publishProcessById.json',
    ]);
    expect(harness.mockGetOnce.mock.calls[1][0]).toBe(
      '/alibaba/web/APP_TEST/query/simpleProcess/getProcessById.json'
    );
    expect(result).toMatchObject({
      success: true,
      verificationLevel: 'PLATFORM_VIEW_VERIFIED',
      platformViewVerified: true,
    });
    expect(result).not.toHaveProperty('processJsonVerified');
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test('recovers a success-without-id draft only from one exact new SAVED identity', async () => {
    const harness = loadSubject();
    queueExistingProcess(harness, {
      saved: [{ id: 50, version: '1', status: 'SAVED' }],
    });
    harness.mockPostFormOnce
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    harness.mockGetOnce
      .mockResolvedValueOnce({
        success: true,
        content: {
          data: [
            { id: 50, version: '1', status: 'SAVED' },
            { id: 101, version: '3', status: 'SAVED' },
          ],
        },
      })
      .mockResolvedValueOnce({ success: true, content: { data: [{ id: 101, version: '3' }] } })
      .mockResolvedValueOnce(platformView('FORM_TEST'));
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST', '--replace',
    ]);

    const savedBody = harness.mockPostFormOnce.mock.calls[1][1]({ csrfToken: 'csrf' });
    expect(savedBody).toMatchObject({ processId: '101', processVersion: '3' });
    expect(result).toMatchObject({ processId: 101, processVersion: 3 });
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test.each([
    ['zero', [{ id: 50, version: '1', status: 'SAVED' }], 0],
    ['multiple', [
      { id: 50, version: '1', status: 'SAVED' },
      { id: 101, version: '3', status: 'SAVED' },
      { id: 102, version: '3', status: 'SAVED' },
    ], 2],
  ])('fails closed when success-without-id recovery has %s exact candidates', async (_label, observed, candidateCount) => {
    const harness = loadSubject();
    queueExistingProcess(harness, {
      saved: [{ id: 50, version: '1', status: 'SAVED' }],
    });
    harness.mockPostFormOnce.mockResolvedValueOnce({ success: true });
    harness.mockGetOnce.mockResolvedValueOnce({ success: true, content: { data: observed } });

    await expect(harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST', '--replace',
    ])).rejects.toMatchObject({
      code: 'NON_IDEMPOTENT_RESULT_UNKNOWN',
      details: expect.objectContaining({
        resultUnknown: true,
        identityRecovery: expect.objectContaining({ candidateCount }),
      }),
    });
    expect(harness.mockPostFormOnce).toHaveBeenCalledTimes(1);
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test('does not mistake a concurrent higher SAVED version for the requested draft', async () => {
    const harness = loadSubject();
    queueExistingProcess(harness, {
      saved: [{ id: 50, version: '1', status: 'SAVED' }],
    });
    harness.mockPostFormOnce
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    harness.mockGetOnce
      .mockResolvedValueOnce({
        success: true,
        content: {
          data: [
            { id: 50, version: '1', status: 'SAVED' },
            { id: 999, version: '4', status: 'SAVED' },
            { id: 101, version: '3', status: 'SAVED' },
          ],
        },
      })
      .mockResolvedValueOnce({ success: true, content: { data: [{ id: 101, version: '3' }] } })
      .mockResolvedValueOnce(platformView('FORM_TEST'));
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST', '--replace',
    ]);

    expect(result).toMatchObject({ processId: 101, processVersion: 3 });
    expect(result.processId).not.toBe(999);
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test('returns a stable unknown-result code and never retries a challenged draft write', async () => {
    const harness = loadSubject();
    queueExistingProcess(harness, { published: false });
    harness.mockPostFormOnce.mockResolvedValueOnce({ success: false, __needLogin: true });

    await expect(harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST',
    ])).rejects.toMatchObject({ code: 'NON_IDEMPOTENT_RESULT_UNKNOWN' });
    expect(harness.mockPostFormOnce).toHaveBeenCalledTimes(1);
    expect(harness.mockPostForm).not.toHaveBeenCalled();
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test.each([
    ['draft', 0],
    ['save', 1],
    ['publish', 2],
  ])('treats a thrown %s transport error as an unknown one-shot result', async (_stage, successfulWrites) => {
    const harness = loadSubject();
    queueExistingProcess(harness, { published: false });
    const successfulResults = [
      { success: true, content: { processId: 101, processVersion: 1 } },
      { success: true },
    ];
    successfulResults.slice(0, successfulWrites).forEach((result) => {
      harness.mockPostFormOnce.mockResolvedValueOnce(result);
    });
    harness.mockPostFormOnce.mockRejectedValueOnce(new Error('socket closed after request'));

    await expect(harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST',
    ])).rejects.toMatchObject({
      code: 'NON_IDEMPOTENT_RESULT_UNKNOWN',
      details: expect.objectContaining({ resultUnknown: true }),
    });
    expect(harness.mockPostFormOnce).toHaveBeenCalledTimes(successfulWrites + 1);
    expect(harness.mockPostForm).not.toHaveBeenCalled();
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });

  test('returns PUBLISHED_UNVERIFIED when getProcessById cannot prove the visible view', async () => {
    const harness = loadSubject();
    queueExistingProcess(harness);
    harness.mockPostFormOnce
      .mockResolvedValueOnce({ success: true, content: { processId: 101, processVersion: 3 } })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    harness.mockGetOnce
      .mockResolvedValueOnce({ success: true, content: { data: [{ id: 101, version: '3', status: 'PUBLISHED' }] } })
      .mockResolvedValueOnce({ success: true, content: JSON.stringify({ bindingForm: 'FORM_TEST' }) });

    await expect(harness.subject.run([
      'APP_TEST', 'FORM_TEST', harness.definitionFile, 'TPROC_TEST', '--replace',
    ])).rejects.toMatchObject({ code: 'PUBLISHED_UNVERIFIED' });
    expect(harness.mockPostFormOnce).toHaveBeenCalledTimes(3);
    fs.rmSync(harness.tempDir, { recursive: true, force: true });
  });
});
