'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  extractContentDisposition,
  parseArgs,
  run,
  validateVerification,
} = require('../lib/core/upload-attachment');

const authRef = {
  baseUrl: 'https://www.aliwork.com',
  authMode: 'token',
  authSource: 'token',
  corpId: 'corp-1',
  userId: 'user-1',
  authData: { auth_mode: 'token', auth_source: 'token' },
};

function policy(contentDisposition = 'attachment; filename="合同.pdf"') {
  return Buffer.from(JSON.stringify({
    expiration: '2099-01-01T00:00:00.000Z',
    conditions: [{ 'Content-Disposition': contentDisposition }],
  }), 'utf8').toString('base64');
}

function signInfo(fileName = 'contract.pdf') {
  return {
    host: 'https://oss.example.com',
    objectName: `APP_TEST/2026/8-13/${fileName}`,
    policy: policy(),
    accessid: 'temporary-access-id',
    signature: 'temporary-signature',
    url: `/ossFileHandle?file=${fileName}`,
    downloadUrl: `/ossFileHandle?type=download&file=${fileName}`,
    previewUrl: `/inst/preview?file=${fileName}`,
  };
}

function attachmentFromSign(info, name, size) {
  return {
    name,
    size,
    fileUuid: info.objectName,
    url: info.url,
    downloadUrl: info.downloadUrl,
    previewUrl: info.previewUrl,
  };
}

function createUploadResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: jest.fn(() => 'oss-request-1') },
    text: jest.fn(async () => ''),
  };
}

let tempDir;
let filePath;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-attachment-'));
  filePath = path.join(tempDir, '合同.pdf');
  fs.writeFileSync(filePath, Buffer.from('test-pdf'));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

test('parseArgs preserves repeated --file values and defaults to replace with concurrency 3', () => {
  const parsed = parseArgs([
    'APP_TEST',
    'FORM-TEST',
    '--inst-id',
    'FINST-1',
    '--attachment-field',
    'attachmentField_contract',
    '--file',
    'a.pdf',
    '--file',
    'b.pdf',
  ]);
  expect(parsed.files).toEqual(['a.pdf', 'b.pdf']);
  expect(parsed.append).toBe(false);
  expect(parsed.concurrency).toBe(3);
});

test('extractContentDisposition returns the exact signed policy value', () => {
  const value = 'attachment; filename="合同.pdf"; filename*=UTF-8\'\'%E5%90%88%E5%90%8C.pdf';
  expect(extractContentDisposition(policy(value))).toBe(value);
});

test('extractContentDisposition supports an OSS eq-array condition', () => {
  const value = 'attachment; filename="a.pdf"';
  const encoded = Buffer.from(JSON.stringify({
    conditions: [['eq', '$Content-Disposition', value]],
  })).toString('base64');
  expect(extractContentDisposition(encoded)).toBe(value);
});

test('extractContentDisposition rejects policies without the signed field', () => {
  const encoded = Buffer.from(JSON.stringify({ conditions: [] })).toString('base64');
  expect(() => extractContentDisposition(encoded)).toThrow('Content-Disposition');
});

test('dry-run validates files and emits a plan without creating a client', async () => {
  const result = await run([
    'APP_TEST',
    'FORM-TEST',
    '--inst-id',
    'FINST-1',
    '--attachment-field',
    'attachmentField_contract',
    '--file',
    filePath,
    '--dry-run',
  ], { authRef });

  expect(result).toMatchObject({
    success: true,
    dryRun: true,
    plan: {
      appType: 'APP_TEST',
      formUuid: 'FORM-TEST',
      formInstId: 'FINST-1',
      attachmentField: 'attachmentField_contract',
      mode: 'replace',
      concurrency: 3,
    },
  });
});

test('replace mode uploads, calls back, updates the instance, and verifies read-back', async () => {
  const info = signInfo('contract.pdf');
  const persisted = attachmentFromSign(info, '合同.pdf', 8);
  const client = {
    get: jest.fn(async requestPath => {
      if (requestPath === '/ossSign') {return { success: true, content: info };}
      return {
        success: true,
        content: { formData: { attachmentField_contract: [persisted] } },
      };
    }),
    postForm: jest.fn(async () => ({ success: true, content: {} })),
  };
  const fetchImpl = jest.fn(async () => createUploadResponse(200));

  const result = await run([
    'APP_TEST',
    'FORM-TEST',
    '--inst-id',
    'FINST-1',
    '--attachment-field',
    'attachmentField_contract',
    '--file',
    filePath,
  ], { authRef, client, fetchImpl });

  expect(result).toMatchObject({
    success: true,
    mode: 'replace',
    uploadedCount: 1,
    attachmentCount: 1,
    verification: { passed: true },
  });
  expect(fetchImpl).toHaveBeenCalledWith(info.host, expect.objectContaining({ method: 'POST' }));
  expect(client.postForm.mock.calls[0][0]).toBe('/query/attach/uploadCallBack.json');
  expect(client.postForm.mock.calls[1][0]).toBe('/dingtalk/web/APP_TEST/v1/form/updateFormData.json');
  const updatePayload = JSON.parse(client.postForm.mock.calls[1][1].updateFormDataJson);
  expect(updatePayload.attachmentField_contract).toEqual([persisted]);
  expect(client.get).toHaveBeenCalledTimes(2);
});

test('append mode preserves existing attachments before updating', async () => {
  const info = signInfo('contract.pdf');
  const existing = {
    name: 'old.pdf',
    size: 3,
    fileUuid: 'old-file',
    downloadUrl: '/old/download',
    previewUrl: '/old/preview',
  };
  const uploaded = attachmentFromSign(info, '合同.pdf', 8);
  const client = {
    get: jest.fn()
      .mockResolvedValueOnce({ success: true, content: info })
      .mockResolvedValueOnce({
        success: true,
        content: { formData: { attachmentField_contract: JSON.stringify([existing]) } },
      })
      .mockResolvedValueOnce({
        success: true,
        content: { formData: { attachmentField_contract: [existing, uploaded] } },
      }),
    postForm: jest.fn(async () => ({ success: true, content: {} })),
  };

  const result = await run([
    'APP_TEST',
    'FORM-TEST',
    '--inst-id',
    'FINST-1',
    '--attachment-field',
    'attachmentField_contract',
    '--file',
    filePath,
    '--append',
  ], { authRef, client, fetchImpl: jest.fn(async () => createUploadResponse(204)) });

  expect(result.mode).toBe('append');
  expect(result.attachmentCount).toBe(2);
  const updatePayload = JSON.parse(client.postForm.mock.calls[1][1].updateFormDataJson);
  expect(updatePayload.attachmentField_contract).toEqual([existing, uploaded]);
});

test('form update failure reports uploaded objects as potential OSS orphans', async () => {
  const info = signInfo('contract.pdf');
  const client = {
    get: jest.fn(async () => ({ success: true, content: info })),
    postForm: jest.fn()
      .mockResolvedValueOnce({ success: true, content: {} })
      .mockResolvedValueOnce({ success: false, errorMsg: 'write rejected' }),
  };

  await expect(run([
    'APP_TEST',
    'FORM-TEST',
    '--inst-id',
    'FINST-1',
    '--attachment-field',
    'attachmentField_contract',
    '--file',
    filePath,
  ], { authRef, client, fetchImpl: jest.fn(async () => createUploadResponse()) })).rejects.toMatchObject({
    code: 'ATTACHMENT_UPLOAD_FORM_UPDATE_FAILED',
    details: {
      stage: 'form-update',
      potentialOrphans: [expect.objectContaining({ fileUuid: info.objectName })],
    },
  });
});

test('verification rejects attachment arrays missing required native fields', () => {
  expect(() => validateVerification({
    formData: {
      attachmentField_contract: [{ name: 'bad.pdf', size: 1, fileUuid: 'bad' }],
    },
  }, 'attachmentField_contract', 1, [{ fileUuid: 'bad' }])).toThrow('验收失败');
});

test('invalid fieldId and concurrency fail before remote access', async () => {
  await expect(run([
    'APP_TEST',
    'FORM-TEST',
    '--inst-id',
    'FINST-1',
    '--attachment-field',
    '附件',
    '--file',
    filePath,
    '--concurrency',
    '9',
  ], { authRef })).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_INVALID_ARGUMENTS' });
});
