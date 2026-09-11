'use strict';

const fs = require('fs');
const { CliError } = require('../core/cli-error');
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

async function uploadAttachment(files, options = {}) {
  // Reuse the ImageField upload/sign/public-URL flow, without invoking recognition.
  const { inferAppType, getAuthRef, uploadImageForAI } = require('../ai/ai');
  const appType = inferAppType(options);
  if (!appType) {throw new CliError('ASSET_APP_TYPE_REQUIRED', { code: 'ASSET_APP_TYPE_REQUIRED' });}
  for (const file of files) {
    if (fs.statSync(file).size > MAX_IMAGE_BYTES) {
      throw new CliError('ASSET_TOO_LARGE', { code: 'ASSET_TOO_LARGE' });
    }
  }
  const authRef = getAuthRef(options);
  const results = [];
  for (const file of files) {
    const upload = await uploadImageForAI(file, { appType }, authRef);
    if (typeof upload.imageUrl !== 'string' || !/^https?:\/\//i.test(upload.imageUrl)) {
      throw new CliError('ASSET_ATTACHMENT_URL_INVALID', { code: 'ASSET_ATTACHMENT_URL_INVALID' });
    }
    results.push({ success: true, originalPath: file, cdnUrl: upload.imageUrl });
  }
  return results;
}

module.exports = { MAX_IMAGE_BYTES, uploadAttachment };
