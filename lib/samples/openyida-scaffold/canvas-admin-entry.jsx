import React from 'react';
import { Button } from 'antd';

// Page-scoped server context, not CLI credentials or a copied administrator list.
// The platform's app-admin scope includes super/app managers, not only MAIN.
function readCanvasAppAdmin(appType) {
  try {
    // Access pages may expose appType on pageConfig rather than g_config.
    // Any explicit conflicting context remains unknown; never borrow parent roles.
    const appContexts = [window.g_config?.appType, window.pageConfig?.appType]
      .filter(value => value !== undefined && value !== null && value !== '');
    const user = window.loginUser;
    if (!/^APP_[A-Za-z0-9_-]+$/.test(appType || '') || !appContexts.length || appContexts.some(value => value !== appType)
      || typeof user?.userId !== 'string' || !user.userId.trim()) return { appType, status: 'unknown' };
    const flag = user.isAppAdmin;
    const status = flag === 'y' || flag === true ? 'allowed' : flag === 'n' || flag === false ? 'denied' : 'unknown';
    return { appType, status };
  } catch (_error) { return { appType, status: 'unknown' }; }
}

function useCanvasAppAdmin(appType) {
  const [access, setAccess] = React.useState({ appType, status: 'unknown' });
  React.useEffect(() => {
    const refresh = () => setAccess(readCanvasAppAdmin(appType));
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [appType]);
  return access.appType === appType ? access.status : 'unknown';
}

function buildCanvasWorkbenchEntry({ appType, workbenchFormUuid, viewUuid, params = {}, useDefaultWorkbench = false }) {
  if (!appType || (!workbenchFormUuid && !useDefaultWorkbench)) return null;
  if (workbenchFormUuid && [window.g_config?.formUuid, window.pageConfig?.formUuid].includes(workbenchFormUuid)) return null;
  const query = { ...params };
  // Do not carry the visitor page's navigation hiding/embedding settings back.
  for (const key of ['isRenderNav', 'iframe', 'hideLeftNav', 'navConfig.layout']) delete query[key];
  if (viewUuid && workbenchFormUuid) query.viewUuid = viewUuid;
  return { targetType: workbenchFormUuid ? 'page' : 'app', appType, formUuid: workbenchFormUuid, params: query };
}

/** Render under CanvasThemeProvider; extract canvas-admin-entry as one fragment. */
function CanvasAdminWorkbenchButton({ appType, workbenchFormUuid, viewUuid, params, useDefaultWorkbench = false, label = '业务工作台' }) {
  const status = useCanvasAppAdmin(appType);
  if (status !== 'allowed') return null;
  const entry = buildCanvasWorkbenchEntry({ appType, workbenchFormUuid, viewUuid, params, useDefaultWorkbench });
  if (!entry) return null;
  let href;
  try { href = buildCanvasPageUrl(entry, { appType }); } catch (_error) { return null; }
  return <Button href={href} style={{ color: 'var(--color-text1-4, inherit)' }} onClick={event => {
    if (readCanvasAppAdmin(appType).status !== 'allowed') { event.preventDefault(); return; }
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigateCanvasPage(entry, { appType });
  }}>{label}</Button>;
}
