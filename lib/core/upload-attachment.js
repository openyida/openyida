'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CliError } = require('./cli-error');
const { t } = require('./i18n');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('./yida-client');

const USAGE = `Usage:
  openyida data upload-attachment form <appType> <formUuid> \\
    --inst-id <formInstId> --attachment-field <attachmentField_xxx> \\
    --file <path> [--file <path> ...] [--append] [--concurrency <1-5>] [--dry-run]`;

const MIME_TYPES = Object.freeze({
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
});

function cliError(code, message, details = {}) {
  return new CliError(message, {
    code,
    details,
    usage: USAGE,
  });
}

function invalidArgument(detail) {
  throw cliError('ATTACHMENT_UPLOAD_INVALID_ARGUMENTS', t('attachment_upload.invalid', detail), {
    stage: 'validation',
  });
}

function parseArgs(args = []) {
  const options = {
    appType: args[0],
    formUuid: args[1],
    files: [],
    append: false,
    concurrency: 3,
    dryRun: false,
    help: args.includes('--help') || args.includes('-h'),
  };

  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--file') {
      options.files.push(args[++index]);
    } else if (token === '--inst-id') {
      options.instId = args[++index];
    } else if (token === '--attachment-field') {
      options.attachmentField = args[++index];
    } else if (token === '--concurrency') {
      options.concurrency = Number(args[++index]);
    } else if (token === '--append') {
      options.append = true;
    } else if (token === '--dry-run') {
      options.dryRun = true;
    } else if (token === '--help' || token === '-h') {
      continue;
    } else {
      invalidArgument(`unknown option ${token || '<empty>'}`);
    }
  }
  return options;
}

function validateAndResolveFiles(options) {
  if (!/^APP_[A-Za-z0-9_-]+$/.test(options.appType || '')) {
    invalidArgument('appType must start with APP_');
  }
  if (!/^FORM[-_][A-Za-z0-9_-]+$/.test(options.formUuid || '')) {
    invalidArgument('formUuid must start with FORM- or FORM_');
  }
  if (!options.instId) {
    invalidArgument('--inst-id is required');
  }
  if (!/^attachmentField_[A-Za-z0-9_-]+$/.test(options.attachmentField || '')) {
    invalidArgument('--attachment-field must be a real attachmentField_xxx fieldId');
  }
  if (!options.files.length || options.files.some(file => !file)) {
    invalidArgument('at least one --file is required');
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 5) {
    invalidArgument('--concurrency must be an integer from 1 to 5');
  }

  return options.files.map(file => {
    const absolutePath = path.resolve(file);
    let stat;
    try {
      stat = fs.statSync(absolutePath);
    } catch (error) {
      invalidArgument(`file not found: ${absolutePath}`);
    }
    if (!stat.isFile()) {
      invalidArgument(`not a regular file: ${absolutePath}`);
    }
    return {
      path: absolutePath,
      name: path.basename(absolutePath),
      size: stat.size,
      contentType: MIME_TYPES[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream',
    };
  });
}

function buildObjectName(appType, filePath, now = new Date()) {
  return [
    appType,
    String(now.getFullYear()),
    `${now.getMonth() + 1}-${now.getDate()}`,
    `${crypto.randomUUID().toUpperCase()}${path.extname(filePath)}`,
  ].join('/');
}

function decodePolicy(policyValue) {
  const text = Buffer.from(String(policyValue || ''), 'base64').toString('utf8');
  try {
    return JSON.parse(text);
  } catch (firstError) {
    return JSON.parse(text.replace(/\\\$/g, '$'));
  }
}

function extractContentDisposition(policyValue) {
  let policy;
  try {
    policy = decodePolicy(policyValue);
  } catch (error) {
    throw cliError(
      'ATTACHMENT_UPLOAD_INVALID_POLICY',
      t('attachment_upload.stage_failed', 'oss-policy', 'invalid Base64 JSON policy'),
      { stage: 'oss-policy' }
    );
  }

  for (const condition of policy.conditions || []) {
    if (condition && !Array.isArray(condition) && condition['Content-Disposition']) {
      return String(condition['Content-Disposition']);
    }
    if (
      Array.isArray(condition) &&
      condition.length >= 3 &&
      condition[0] === 'eq' &&
      condition[1] === '$Content-Disposition'
    ) {
      return String(condition[2]);
    }
  }
  throw cliError(
    'ATTACHMENT_UPLOAD_MISSING_CONTENT_DISPOSITION',
    t('attachment_upload.stage_failed', 'oss-policy', 'signed Content-Disposition is missing'),
    { stage: 'oss-policy' }
  );
}

function responseContent(response) {
  if (response && response.success === false) {
    throw new Error(response.errorMsg || response.message || 'Yida request failed');
  }
  return response && response.content !== undefined ? response.content : response;
}

function requireSignInfo(response, fileName) {
  const signInfo = responseContent(response);
  const required = [
    'host',
    'objectName',
    'policy',
    'accessid',
    'signature',
    'url',
    'downloadUrl',
    'previewUrl',
  ];
  const missing = required.filter(key => !signInfo || !signInfo[key]);
  if (missing.length > 0) {
    throw new Error(`ossSign response for ${fileName} is missing ${missing.join(', ')}`);
  }
  return signInfo;
}

async function uploadOne(client, options, file, fetchImpl) {
  let signInfo;
  let ossRequestId = '';
  let ossUploaded = false;
  try {
    const requestedObjectName = buildObjectName(options.appType, file.path);
    signInfo = requireSignInfo(await client.get('/ossSign', {
      scene: 'AttachmentField',
      _api: 'nattyFetch',
      _mock: 'false',
      appType: options.appType,
      fileName: file.name,
      fileSize: String(file.size),
      contentType: file.contentType,
      isOpen: 'n',
      newContext: 'y',
      objectName: requestedObjectName,
      procInstId: '',
      businessType: '',
      accelerate: 'y',
      _stamp: String(Date.now()),
    }), file.name);

    const uploadForm = new FormData();
    uploadForm.append('key', signInfo.objectName);
    uploadForm.append('policy', signInfo.policy);
    uploadForm.append('OSSAccessKeyId', signInfo.accessid);
    uploadForm.append('signature', signInfo.signature);
    if (signInfo.expire) {uploadForm.append('expire', String(signInfo.expire));}
    if (signInfo.appType) {uploadForm.append('appType', String(signInfo.appType));}
    uploadForm.append('success_action_status', '200');
    uploadForm.append('Content-Disposition', extractContentDisposition(signInfo.policy));
    uploadForm.append('file', new Blob([fs.readFileSync(file.path)], { type: file.contentType }), file.name);

    const uploadResponse = await fetchImpl(signInfo.host, { method: 'POST', body: uploadForm });
    if (!uploadResponse.ok && uploadResponse.status !== 204) {
      const body = await uploadResponse.text();
      throw new Error(`OSS HTTP ${uploadResponse.status}: ${body.slice(0, 160)}`);
    }
    ossUploaded = true;
    ossRequestId = uploadResponse.headers.get('x-oss-request-id') || '';

    responseContent(await client.postForm('/query/attach/uploadCallBack.json', {
      appType: options.appType,
      formUuid: options.formUuid,
      fileName: file.name,
      fileSize: String(file.size),
      objectName: signInfo.objectName,
      procInstId: '',
      ossRequestId,
      businessType: 'inst',
    }));

    return {
      name: file.name,
      size: file.size,
      fileUuid: signInfo.objectName,
      url: signInfo.url,
      downloadUrl: signInfo.downloadUrl,
      previewUrl: signInfo.previewUrl,
    };
  } catch (error) {
    const stage = error && error.details && error.details.stage
      ? error.details.stage
      : ossUploaded ? 'attachment-callback' : signInfo ? 'oss-upload' : 'oss-sign';
    throw cliError('ATTACHMENT_UPLOAD_FILE_FAILED', t('attachment_upload.stage_failed', stage, error.message), {
      stage,
      file: file.name,
      potentialOrphan: ossUploaded && signInfo ? {
        name: file.name,
        size: file.size,
        fileUuid: signInfo.objectName,
        ossRequestId,
      } : null,
    });
  }
}

async function mapConcurrentSettled(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => consume()));
  return results;
}

function normalizeAttachments(value) {
  if (Array.isArray(value)) {return value;}
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function normalizeFormData(content) {
  const value = content && content.formData;
  if (value && typeof value === 'object' && !Array.isArray(value)) {return value;}
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }
  return {};
}

function validateVerification(content, attachmentField, expectedCount, uploaded) {
  const attachments = normalizeAttachments(normalizeFormData(content)[attachmentField]);
  const requiredKeys = ['name', 'size', 'fileUuid', 'downloadUrl', 'previewUrl'];
  const invalid = attachments.some(item => !item || requiredKeys.some(key => item[key] === undefined || item[key] === ''));
  const uploadedIds = new Set(uploaded.map(item => item.fileUuid));
  const persistedIds = new Set(attachments.map(item => item && item.fileUuid).filter(Boolean));
  const missingUploaded = [...uploadedIds].filter(fileUuid => !persistedIds.has(fileUuid));
  if (attachments.length !== expectedCount || invalid || missingUploaded.length > 0) {
    throw cliError('ATTACHMENT_UPLOAD_VERIFICATION_FAILED', t('attachment_upload.verification_failed'), {
      stage: 'verification',
      expectedCount,
      actualCount: attachments.length,
      missingUploaded,
      invalidAttachmentObject: invalid,
      completedStages: ['oss-upload', 'attachment-callback', 'form-update'],
    });
  }
  return attachments;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
  return value;
}

async function run(args = [], runtime = {}) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(USAGE);
    return { success: true, help: true };
  }

  const files = validateAndResolveFiles(options);
  const authRef = runtime.authRef || createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw cliError('ATTACHMENT_UPLOAD_LOGIN_REQUIRED', t('attachment_upload.login_required'), {
      stage: 'authentication',
    });
  }

  const plan = {
    appType: options.appType,
    formUuid: options.formUuid,
    formInstId: options.instId,
    attachmentField: options.attachmentField,
    mode: options.append ? 'append' : 'replace',
    concurrency: options.concurrency,
    baseUrl: authRef.baseUrl || '',
    corpId: authRef.corpId || '',
    files: files.map(file => ({ path: file.path, name: file.name, size: file.size })),
  };
  if (options.dryRun) {
    return printJson({ success: true, dryRun: true, plan });
  }

  const client = runtime.client || createYidaClient({ authRef });
  const fetchImpl = runtime.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw cliError('ATTACHMENT_UPLOAD_FETCH_UNAVAILABLE', t('attachment_upload.stage_failed', 'runtime', 'fetch is unavailable'), {
      stage: 'runtime',
    });
  }

  const outcomes = await mapConcurrentSettled(
    files,
    options.concurrency,
    file => uploadOne(client, options, file, fetchImpl)
  );
  const uploaded = outcomes.filter(item => item.status === 'fulfilled').map(item => item.value);
  const failures = outcomes.filter(item => item.status === 'rejected').map(item => item.reason);
  if (failures.length > 0) {
    const potentialOrphans = uploaded.map(item => ({
      name: item.name,
      size: item.size,
      fileUuid: item.fileUuid,
    }));
    failures.forEach(error => {
      if (error && error.details && error.details.potentialOrphan) {
        potentialOrphans.push(error.details.potentialOrphan);
      }
    });
    throw cliError('ATTACHMENT_UPLOAD_PARTIAL_FAILURE', t('attachment_upload.partial_failed'), {
      stage: 'file-upload',
      uploadedCount: uploaded.length,
      failedCount: failures.length,
      failures: failures.map(error => ({
        file: error && error.details && error.details.file,
        stage: error && error.details && error.details.stage,
        message: error && error.message,
      })),
      potentialOrphans,
    });
  }

  let existingAttachments = [];
  if (options.append) {
    try {
      const current = responseContent(await client.get(
        `/dingtalk/web/${options.appType}/v1/form/getFormDataById.json`,
        { formInstId: options.instId }
      ));
      existingAttachments = normalizeAttachments(normalizeFormData(current)[options.attachmentField]);
    } catch (error) {
      throw cliError('ATTACHMENT_UPLOAD_READ_EXISTING_FAILED', t('attachment_upload.stage_failed', 'read-existing', error.message), {
        stage: 'read-existing',
        potentialOrphans: uploaded.map(item => ({ name: item.name, size: item.size, fileUuid: item.fileUuid })),
      });
    }
  }

  const attachments = existingAttachments.concat(uploaded);
  try {
    responseContent(await client.postForm(
      `/dingtalk/web/${options.appType}/v1/form/updateFormData.json`,
      {
        formInstId: options.instId,
        updateFormDataJson: JSON.stringify({ [options.attachmentField]: attachments }),
      }
    ));
  } catch (error) {
    throw cliError('ATTACHMENT_UPLOAD_FORM_UPDATE_FAILED', t('attachment_upload.stage_failed', 'form-update', error.message), {
      stage: 'form-update',
      potentialOrphans: uploaded.map(item => ({ name: item.name, size: item.size, fileUuid: item.fileUuid })),
    });
  }

  let verified;
  try {
    const current = responseContent(await client.get(
      `/dingtalk/web/${options.appType}/v1/form/getFormDataById.json`,
      { formInstId: options.instId }
    ));
    verified = validateVerification(current, options.attachmentField, attachments.length, uploaded);
  } catch (error) {
    if (error && error.isCliError) {throw error;}
    throw cliError('ATTACHMENT_UPLOAD_VERIFICATION_FAILED', t('attachment_upload.stage_failed', 'verification', error.message), {
      stage: 'verification',
      completedStages: ['oss-upload', 'attachment-callback', 'form-update'],
    });
  }

  return printJson({
    success: true,
    formInstId: options.instId,
    attachmentField: options.attachmentField,
    mode: options.append ? 'append' : 'replace',
    uploadedCount: uploaded.length,
    attachmentCount: verified.length,
    files: uploaded.map(item => ({ name: item.name, size: item.size, fileUuid: item.fileUuid })),
    verification: { passed: true, attachmentCount: verified.length },
  });
}

module.exports = {
  USAGE,
  buildObjectName,
  decodePolicy,
  extractContentDisposition,
  mapConcurrentSettled,
  normalizeAttachments,
  parseArgs,
  run,
  validateVerification,
};
