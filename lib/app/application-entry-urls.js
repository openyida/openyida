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

function buildApplicationSettingsUrls(options) {
  const { adminUrl } = buildApplicationEntryUrls(options);
  if (!adminUrl) { return {}; }
  const url = new URL(adminUrl);
  const settings = suffix => `${url.origin}${url.pathname}/appSetting/${suffix}${url.search}`;
  return { themeSettingsUrl: settings('themeSetting'), basicSettingsUrl: settings('basicSetting'), dataCardManageUrl: settings('dataCardManage'), coolCardManageUrl: settings('coolCardManage') };
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

function preferredLinkPresentationTool(runtime = {}) {
  return runtime.subtype === 'qwenwork_web' ? 'show_link'
    : runtime.subtype === 'qwenwork_desktop' ? 'artifact_show_link' : null;
}

// A host action contract; CLI output cannot prove host tool execution.
function buildLinkPresentationCompletionGate() {
  return {
    host: 'qwenwork',
    required_when: 'verified_target_and_available_host_link_tool_unless_user_excludes_target',
    order: ['verify_business_result', 'select_verified_entry', 'call_host_link_tool', 'inspect_tool_result', 'final_reply'],
    evidence: 'actual_host_tool_result_for_selected_url_in_current_turn',
    not_evidence: ['create_app_success', 'resource_readback', 'markdown_link', 'sidebar_open', 'browser_handoff', 'previous_turn_tool_result'],
    fallback: 'Only declared tool absence or an actual call failure permits clickable-link fallback. Record the evidence internally; an omitted call is not tool absence.',
    enforcement_owner: 'host_agent',
  };
}

function buildCreatedAppLinkPresentation(entry, runtime = {}) {
  if (runtime.tool !== 'qwenwork' || !entry.adminUrl || !entry.appType) { return null; }
  try {
    const url = new URL(entry.adminUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.pathname !== `/${entry.appType}/admin`) { return null; }
  } catch { return null; }
  return {
    status: 'pending', timing: 'before_final_reply',
    preferredTool: preferredLinkPresentationTool(runtime), toolAvailability: 'check_host_tool_inventory',
    url: entry.adminUrl, title: entry.appName || entry.appType, maxCallsPerTurn: 1,
    completionGate: buildLinkPresentationCompletionGate(),
    instruction: 'Keep pending while building. Before final summary or delivery completion, call the host link tool once with this exact URL using its declared parameters, then inspect its result. App shells and partial deliveries also require this. --no-open does not cancel it. Honor user exclusions; never recreate the app for presentation.',
  };
}

module.exports = { buildApplicationEntryUrls, buildApplicationSettingsUrls, buildDisplayPageEntryUrls, readRenderNav,
  preferredLinkPresentationTool, buildLinkPresentationCompletionGate, buildCreatedAppLinkPresentation };
