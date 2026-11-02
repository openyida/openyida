'use strict';

const { fail } = require('./model');

/** Parse native record links as identifiers only; never fetch arbitrary URLs or forward their query. */
function parse(value) {
  let url;
  try { url = new URL(value); } catch (_) { fail('INVALID_CONFIG', 'detail URL'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) { fail('INVALID_CONFIG', 'native detail URL'); }
  for (const key of ['appType', 'formUuid', 'formInstId', 'activityId']) {
    if (url.searchParams.getAll(key).length > 1) { fail('INVALID_CONFIG', `duplicate ${key}`); }
  }
  const modern = /^\/(APP_[\w-]+)\/(formDetail|processDetail)\/(FORM[_-][\w-]+)\/?$/.exec(url.pathname);
  const legacy = /^\/alibaba\/(?:web|mobile)\/(APP_[\w-]+)\/inst\/(formEdit|taskDetail)\.html$/.exec(url.pathname);
  if (!modern && !legacy) { fail('UNSUPPORTED', 'native formDetail/processDetail link required'); }
  const appType = (modern || legacy)[1];
  const formUuid = modern ? modern[3] : url.searchParams.get('formUuid');
  const instance = url.searchParams.get('formInstId');
  const activityId = url.searchParams.get('activityId');
  if (!/^FORM[_-][\w-]+$/.test(formUuid || '') || !/^[\w-]+$/.test(instance || '')
    || activityId !== null && !/^[\w-]+$/.test(activityId)
    || url.searchParams.has('appType') && url.searchParams.get('appType') !== appType
    || url.searchParams.has('formUuid') && url.searchParams.get('formUuid') !== formUuid) { fail('INVALID_CONFIG', 'detail target'); }
  return { appType, formUuid, instance, ...(activityId ? { activityId } : {}), origin: url.origin,
    kind: modern ? modern[2] : legacy[2] === 'formEdit' ? 'formDetail' : 'processDetail' };
}

/** Refuse cross-organization routing; authenticate to the link's environment before printing. */
function verifyOrigin(target, client) {
  const base = client.getAuthRef?.()?.baseUrl;
  let origin;
  try { origin = new URL(base).origin; } catch (_) { fail('TARGET_MISMATCH', 'authenticated origin unavailable'); }
  if (origin !== target.origin) { fail('TARGET_MISMATCH', 'detail URL origin differs from authenticated environment'); }
}

module.exports = { parse, verifyOrigin };
