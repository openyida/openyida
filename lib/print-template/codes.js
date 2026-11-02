'use strict';

const { fail, object, unwrap } = require('./model');
const FORMATS = ['qrcode', 'barcode'];
const PREFIXES = ['textField', 'numberField', 'selectField', 'radioField', 'serialNo'];
const CODE_EDITIONS = new Set(['pro', 'vip', 'isv', 'hybrid_cloud']);

/** Match the native editor's field-code whitelist, without enabling unrelated field types. */
function eligible(field) {
  return typeof field?.key === 'string' && PREFIXES.some(prefix => field.key.startsWith(prefix))
    && !/\.(qrcode|barcode)$/.test(field.key);
}

/** Read the existing edition and rollout gate; never change entitlements or gray configuration. */
async function capabilities(client) {
  const results = await Promise.allSettled([
    client.get('/query/commodity/getSimpleCommodityInfo.json', {}).then(response => unwrap(response, 'getSimpleCommodityInfo')),
    client.get('/query/compromiseDing/orgInGray.json', { grayKey: 'yida_fe_print_support_qrcode' }).then(response => unwrap(response, 'orgInGray')),
  ]);
  const edition = results[0].status === 'fulfilled' && object(results[0].value)
    ? String(results[0].value.corpVersion || '').toLowerCase() : '';
  const gray = results[1].status === 'fulfilled' && typeof results[1].value === 'boolean' ? results[1].value : null;
  const enabled = CODE_EDITIONS.has(edition) && gray === true;
  return { enabled, edition, gray, reason: enabled ? null : !edition ? 'edition_unverified'
    : !CODE_EDITIONS.has(edition) ? 'edition_not_supported' : gray === false ? 'feature_not_enabled' : 'feature_unverified' };
}

/** Derive the native .qrcode/.barcode image key from a live, eligible field. */
function transform(field, format) {
  if (!FORMATS.includes(format) || !eligible(field)) { fail('UNSUPPORTED', `field code: ${field?.label || field?.key}`); }
  if (!field.codeFormats?.includes(format)) {
    fail('CODE_UNAVAILABLE', `${format}: ${field.codeUnavailableReason || 'capability_unverified'}`);
  }
  return { ...field, key: `${field.key}.${format}`, label: `${field.label}.${format === 'qrcode' ? '二维码' : '条形码'}`, type: 'img', codeFormat: format };
}

/** Validate derived keys in native exports as strictly as authored code blocks. */
function resolveNative(key, dictionary) {
  const match = typeof key === 'string' && /^(.*)\.(qrcode|barcode)$/.exec(key);
  if (!match) { return null; }
  const field = dictionary.find(item => item.key === match[1]);
  if (!field) { fail('FIELD_REFERENCE', match[1]); }
  return transform(field, match[2]);
}

module.exports = { FORMATS, eligible, capabilities, transform, resolveNative };
