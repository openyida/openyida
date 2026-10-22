'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { t } = require('../core/i18n');
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Validate the entire manifest before downloading or creating any destination files. */
function validateManifest(manifest, id) {
  if (manifest?.id !== id || !Array.isArray(manifest.files) || manifest.files.length !== 2) {
    throw new Error(t('design_template.invalid_manifest'));
  }
  const names = new Set();
  let size = 0;
  for (const f of manifest.files) {
    if (!['design.md', 'app_theme.css'].includes(f?.name) || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,119}$/.test(f.name || '') || f.name.includes('..') ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(f.name) || f.name.endsWith('.') ||
        names.has(f.name.toLowerCase()) || !/^[a-f0-9]{64}$/.test(f.sha256 || '') ||
        !Number.isSafeInteger(f.size) || f.size < 1 || f.size > MAX_FILE_BYTES) {
      throw new Error(t('design_template.invalid_manifest'));
    }
    const url = new URL(f.url);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
      throw new Error(t('design_template.invalid_manifest'));
    }
    names.add(f.name.toLowerCase()); size += f.size;
  }
  if (size > 2 * MAX_FILE_BYTES) { throw new Error(t('design_template.invalid_manifest')); }
}

/** Check SHA-256 and byte count, never forward login credentials to signed asset URLs. */
async function downloadTemplate(manifest, id, output, fetchImpl = globalThis.fetch) {
  validateManifest(manifest, id);
  const destination = path.resolve(output);
  if (fs.existsSync(destination)) { throw new Error(t('design_template.output_exists')); }
  const files = [];
  for (const f of manifest.files) {
    const response = await fetchImpl(f.url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) { throw new Error(t('design_template.file_error')); }
    const parts = []; let size = 0;
    for await (const part of response.body) {
      size += part.length;
      if (size > f.size) { throw new Error(t('design_template.file_error')); }
      parts.push(Buffer.from(part));
    }
    const buffer = Buffer.concat(parts);
    if (size !== f.size || crypto.createHash('sha256').update(buffer).digest('hex') !== f.sha256) {
      throw new Error(t('design_template.file_error'));
    }
    files.push({ name: f.name, buffer, sha256: f.sha256 });
  }
  // mkdir is exclusive; do not overwrite even an empty pre-existing user directory.
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination);
  const written = [];
  try {
    for (const file of files) {
      const target = path.join(destination, file.name);
      fs.writeFileSync(target, file.buffer, { flag: 'wx' }); written.push(target);
    }
  } catch (error) {
    for (const target of written) { fs.unlinkSync(target); }
    try { fs.rmdirSync(destination); } catch { /* Preserve concurrent user files. */ }
    throw error;
  }
  return { id, directory: destination, files: files.map(f => ({ name: f.name, sha256: f.sha256 })) };
}
module.exports = { validateManifest, downloadTemplate };
