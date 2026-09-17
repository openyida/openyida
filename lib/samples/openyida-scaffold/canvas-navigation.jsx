// Merge this fragment into the Canvas page. Supply IDs from resource readback.
// Local tabs use state/hash and do not call this cross-page helper.
function buildCanvasPageUrl(entry, { appType, platformOrigin } = {}) {
  const type = entry.targetType;
  if (type === 'url') {
    const external = new URL(entry.url);
    if (!['https:', 'http:'].includes(external.protocol)) throw new Error('Expected an HTTP(S) URL');
    return external.href;
  }
  const app = entry.appType || appType;
  if (!/^APP_[A-Za-z0-9_-]+$/.test(app || '')) throw new Error('Missing verified appType');
  const routes = { app: 'workbench', page: 'workbench', custom: 'custom', submission: 'submission', detail: 'formDetail' };
  if (!Object.prototype.hasOwnProperty.call(routes, type)) throw new Error('Unknown page target type');
  const id = type === 'page' ? entry.navUuid || entry.formUuid : entry.formUuid;
  if (type !== 'app' && !/^[A-Za-z0-9_-]+$/.test(id || '')) throw new Error('Missing verified page ID');
  // Normal pages use their own origin. Opaque or non-platform embeddings must
  // supply the verified platform origin; never guess a tenant or read window.top.
  const origin = new URL(platformOrigin || window.location.origin);
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Invalid platform origin');
  const url = new URL('/' + app + '/' + routes[type] + (type === 'app' ? '' : '/' + id), origin.origin);
  Object.entries(entry.params || {}).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') url.searchParams.set(key, String(val));
  });
  if (type === 'submission' || type === 'detail') url.searchParams.set('isRenderNav', 'false');
  if (type === 'detail') {
    if (typeof entry.formInstId !== 'string' || !entry.formInstId.trim()) throw new Error('Missing formInstId');
    url.searchParams.set('formInstId', entry.formInstId);
    url.searchParams.set('navConfig.layout', '1180');
  }
  if (entry.hash) url.hash = entry.hash;
  return url.href;
}

function navigateCanvasPage(entry, context = {}) {
  if (entry.targetType === 'local') {
    if (!entry.viewKey || typeof context.selectView !== 'function') throw new Error('Missing local view handler');
    context.selectView(entry.viewKey);
    return;
  }
  if (entry.targetType === 'submission' || entry.targetType === 'detail') {
    // Validate before opening; the standard container owns PC/mobile behavior.
    buildCanvasPageUrl(entry, context);
    if (typeof context.openForm !== 'function') throw new Error('Connect useYidaFormOpen first');
    context.openForm({ ...entry, type: entry.targetType, appType: entry.appType || context.appType });
    return;
  }
  const href = buildCanvasPageUrl(entry, context);
  const utils = context.utils || window.__OPENYIDA_UTILS__;
  if (entry.openMode === 'new-tab' || entry.targetType === 'url') {
    if (typeof utils?.openPage === 'function') return utils.openPage({ url: href });
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  if (typeof utils?.router?.push === 'function') return utils.router.push(href, {}, false, true);
  window.location.assign(href);
}
