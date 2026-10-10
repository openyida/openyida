'use strict';

// URLs derived by the CLI from a successful app result and its authenticated
// base URL. Constructing a route does not verify the recipient's access rights.
function buildApplicationEntryUrls({ appType, baseUrl, systemLink }) {
  if (typeof appType !== 'string' || !/^APP_[A-Za-z0-9_-]+$/.test(appType)) { return {}; }
  let origin;
  const params = new URLSearchParams();
  try {
    const base = new URL(baseUrl);
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) { return {}; }
    origin = base.origin;
  } catch { return {}; }
  try {
    if (systemLink) {
      const app = new URL(systemLink, origin);
      if (['https:', 'http:'].includes(app.protocol) && !app.username && !app.password && (app.pathname === `/${appType}` || app.pathname.startsWith(`/${appType}/`))) {
        origin = app.origin;
        for (const key of ['corpid', 'locale']) {
          if (app.searchParams.has(key)) { params.set(key, app.searchParams.get(key)); }
        }
      }
    }
  } catch { /* Ignore malformed optional links; retain the authenticated base. */ }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  const workbenchUrl = `${origin}/${appType}/workbench${suffix}`;
  return { appUrl: workbenchUrl, workbenchUrl, adminUrl: `${origin}/${appType}/admin${suffix}` };
}

function readRenderNav(config) {
  const value = config && Object.prototype.hasOwnProperty.call(config, 'renderNav')
    ? config.renderNav : config?.isRenderNav;
  if (value === false || value === 'false') {return false;}
  if (value === true || value === 'true') {return true;}
  return null;
}

function buildDisplayPageEntryUrls({ appType, formUuid, baseUrl, config, formType = config?.formType }) {
  if (formType !== 'display' || !/^FORM[-_][A-Za-z0-9_-]+$/.test(formUuid || '')) {return {};}
  if (config?.formType && config.formType !== 'display') {return {};}
  if ((config?.appType && config.appType !== appType) || (config?.formUuid && config.formUuid !== formUuid)) {return {};}
  const appUrls = buildApplicationEntryUrls({ appType, baseUrl });
  if (!appUrls.workbenchUrl) {return {};}
  const origin = new URL(appUrls.workbenchUrl).origin;
  const renderNav = readRenderNav(config);
  const workbenchUrl = `${origin}/${appType}/workbench/${formUuid}`;
  const standaloneUrl = renderNav === false ? `${origin}/${appType}/custom/${formUuid}` : null;
  return {
    url: standaloneUrl || workbenchUrl,
    workbenchUrl,
    standaloneUrl,
    navigationVerification: { renderNav, verified: renderNav !== null },
  };
}

module.exports = { buildApplicationEntryUrls, buildDisplayPageEntryUrls, readRenderNav };
