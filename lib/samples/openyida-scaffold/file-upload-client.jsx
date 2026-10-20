// Browser-only client. Shared by Canvas publishing and legacy JSX pages.
// No local CLI token, platform cookies or CSRF are sent to OSS.
function createYidaFileClient(hostWindow) {
  function fail(code, message, stage, details) {
    const error = new Error(message);
    error.code = code;
    error.stage = stage;
    if (details) Object.assign(error, details);
    return error;
  }

  function identity(binding) {
    if (!binding || !/^APP_[A-Za-z0-9_-]+$/.test(binding.appType || '')) {
      throw fail('FILE_APP_REQUIRED', 'A valid appType is required', 'validation');
    }
    const params = { appType: binding.appType };
    for (const key of ['formUuid', 'procInstId', 'fileSource', 'businessType']) {
      if (binding[key]) params[key] = String(binding[key]);
    }
    return params;
  }

  async function request(action, binding, values, signal) {
    const context = identity(binding);
    const params = action === 'getDownloadUrl' || action === 'bindFiles'
      ? { appType: context.appType } : context;
    // Token authentication needs no CSRF. Existing browser session deployments
    // may still enforce it; reuse platform runtime context without reading cookies
    // or rejecting requests when that context is absent.
    const sessionCsrf = hostWindow.g_config && hostWindow.g_config._csrf_token;
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    let endpoint = '/' + params.appType + '/openapi/file/' + action + '.json';
    if (sessionCsrf) {
      endpoint += '?_csrf_token=' + encodeURIComponent(sessionCsrf);
      headers.global_csrf_token = String(sessionCsrf);
    }
    let response;
    try {
      response = await hostWindow.fetch(endpoint, {
        method: 'POST', credentials: 'include', redirect: 'error', signal,
        headers,
        body: JSON.stringify(Object.assign(params, values)),
      });
    } catch (error) {
      throw fail('FILE_NETWORK_ERROR', 'File API request failed at ' + action, action);
    }
    if (!response.ok) throw fail('FILE_HTTP_ERROR', 'File API HTTP ' + response.status, action);
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw fail('FILE_RESPONSE_INVALID', 'File API returned a non-JSON response', action);
    }
    const needsConfirmation = action === 'confirmUpload' || action === 'bindFiles';
    if (!payload || payload.success !== true || !payload.content || payload.content.success === false
      || (needsConfirmation && payload.content.success !== true)) {
      throw fail(String(payload && (payload.errorCode || payload.code) || 'FILE_API_ERROR'),
        payload && (payload.errorMsg || payload.message) || 'File API failed', action);
    }
    return payload.content;
  }

  function platformUrl(value) {
    if (!value) return '';
    const origin = hostWindow.location.origin;
    const url = new hostWindow.URL(value, origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) {
      throw fail('FILE_URL_INVALID', 'File URL must use the current platform origin', 'getDownloadUrl');
    }
    return url.href;
  }

  async function getDownloadUrl(binding, objectName, options = {}) {
    if (!objectName) throw fail('FILE_OBJECT_REQUIRED', 'objectName is required', 'validation');
    const result = await request('getDownloadUrl', binding, {
      objectName, type: options.type || 'download', ...(options.instId ? { instId: options.instId } : {}),
    }, options.signal);
    const downloadUrl = platformUrl(result.downloadUrl || result.url);
    if (!downloadUrl) throw fail('FILE_URL_MISSING', 'Download URL is missing', 'getDownloadUrl');
    return { downloadUrl, previewUrl: platformUrl(result.previewUrl), url: downloadUrl };
  }

  async function upload(binding, file, options = {}) {
    identity(binding);
    if (!file || !/\.[A-Za-z0-9]{1,20}$/.test(file.name || '')) {
      throw fail('FILE_EXTENSION_INVALID', 'File name must contain a valid extension', 'validation');
    }
    const maxBytes = options.maxBytes === undefined ? 100 * 1024 * 1024 : options.maxBytes;
    if (!Number.isFinite(file.size) || file.size <= 0 || !Number.isFinite(maxBytes) || maxBytes <= 0 || file.size > maxBytes) {
      throw fail('FILE_SIZE_INVALID', 'File is empty or exceeds the upload size limit', 'validation');
    }
    const fileInfo = { fileName: file.name, fileSize: file.size };
    const credential = await request('getUploadCredential', binding, {
      ...fileInfo, contentType: file.type || 'application/octet-stream',
    }, options.signal);
    for (const key of ['accessid', 'policy', 'signature', 'host', 'objectName', 'uploadToken']) {
      if (!credential[key]) throw fail('FILE_CREDENTIAL_INVALID', 'Incomplete upload credential', 'getUploadCredential');
    }
    const host = new hostWindow.URL(credential.host);
    if (host.protocol !== 'https:' || host.username || host.password) {
      throw fail('FILE_HOST_INVALID', 'Upload host must use HTTPS', 'getUploadCredential');
    }
    const form = new hostWindow.FormData();
    form.append('key', credential.objectName);
    form.append('policy', credential.policy);
    form.append('OSSAccessKeyId', credential.accessid);
    form.append('signature', credential.signature);
    form.append('success_action_status', '200');
    form.append('Content-Disposition', 'attachment; filename=' + file.name);
    form.append('file', file, file.name);
    const headers = {};
    if (credential.headerEnabled === 'y' && credential.headers) {
      for (const key of Object.keys(credential.headers)) {
        // Only forward gateway headers; never leak the platform session.
        if (!['content-type', 'cookie', 'authorization', 'global_csrf_token', 'x-csrf-token', 'content-disposition'].includes(key.toLowerCase())) {
          headers[key] = credential.headers[key];
        }
      }
    }
    let response;
    try {
      response = await hostWindow.fetch(host.href, {
        method: 'POST', credentials: 'omit', body: form, headers, signal: options.signal,
      });
    } catch (error) {
      throw fail('FILE_OSS_NETWORK_ERROR', 'OSS upload request failed; check the upload host and network', 'oss');
    }
    if (!response.ok) throw fail('FILE_OSS_FAILED', 'OSS upload HTTP ' + response.status, 'oss');
    const confirmed = await request('confirmUpload', binding, {
      ...fileInfo, objectName: credential.objectName, uploadToken: credential.uploadToken,
    }, options.signal);
    const uploaded = {
      name: file.name, size: file.size, type: file.type || '',
      objectName: credential.objectName, fileUuid: credential.objectName,
      fileUploadId: confirmed.fileUploadId,
    };
    try {
      return Object.assign(uploaded, await getDownloadUrl(binding, credential.objectName, options));
    } catch (error) {
      // Recovery can refresh the URL without uploading/confirming a second time.
      error.uploadedFile = uploaded;
      throw error;
    }
  }

  async function bindFiles(binding, instId, files, options = {}) {
    identity(binding);
    if (!binding.formUuid || !instId || !Array.isArray(files)) {
      throw fail('FILE_BIND_IDENTITY_REQUIRED', 'formUuid, saved instId and files are required', 'validation');
    }
    const fileNames = files.map(file => typeof file === 'string' ? file : file && file.objectName);
    if (fileNames.some(name => !name)) throw fail('FILE_OBJECT_REQUIRED', 'Every file needs objectName', 'validation');
    if (!fileNames.length) return { success: true, instId, fileCount: 0 };
    return request('bindFiles', binding, {
      formUuid: binding.formUuid, instId, fileNames: [...new Set(fileNames)],
    }, options.signal);
  }

  return { ready: true, upload, getDownloadUrl, bindFiles };
}
