/** PRD 决定菜单结构，平台结果只过滤不可见入口；同一资源可对应多个任务入口。 */
function filterCanvasNavigation(items, navs, hiddenNav = []) {
  const visibleIds = new Set();
  function collectVisible(nodes) {
    for (const nav of nodes) {
      if (nav.hidden || hiddenNav.includes(nav.slug) || hiddenNav.includes(nav.navUuid)) continue;
      if (nav.navUuid) visibleIds.add(nav.navUuid);
      collectVisible(nav.children || []);
    }
  }
  collectVisible(navs);
  function filterItems(nodes) {
    return nodes.flatMap(item => {
      const resourceId = item.navUuid || item.formUuid;
      if (item.hidden || (resourceId && !visibleIds.has(resourceId))) return [];
      if (item.children?.length) {
        const children = filterItems(item.children);
        return children.length ? [{ ...item, children }] : [];
      }
      return visibleIds.has(resourceId) ? [item] : [];
    });
  }
  return filterItems(items);
}

/** 按入口任务选择提交页或管理页；targetType 由 PRD 明确，表单类型不决定入口用途。 */
function buildCanvasNavigationUrl(item, appType, { embedded = false } = {}) {
  if (item.targetType === 'url') return item.url;
  if (!['submission', 'page'].includes(item.targetType)) throw new Error('请明确导航入口用途');
  const formUuid = item.formUuid || item.navUuid;
  if (!appType || !formUuid) throw new Error('缺少导航目标');
  const query = new URLSearchParams(item.params || {});
  const route = item.targetType === 'submission' ? 'submission' : 'workbench';
  if (embedded) {
    if (route === 'submission') query.set('isRenderNav', 'false');
    else query.set('iframe', 'true');
  }
  const suffix = query.toString();
  return `/${encodeURIComponent(appType)}/${route}/${encodeURIComponent(formUuid)}${suffix ? '?' + suffix : ''}`;
}

/** 使用当前访问者的登录态读取导航；csrfToken、hiddenNav 由当前页面运行态提供。 */
async function loadCanvasNavigation({ items, appType, formUuid, csrfToken, hiddenNav = [], signal }) {
  if (!Array.isArray(items)) throw new Error('缺少 PRD 导航配置');
  if (!appType) throw new Error('缺少应用标识');
  const query = new URLSearchParams({ _api: 'nattyFetch', _mock: 'false' });
  if (formUuid) query.set('formUuid', formUuid);
  if (csrfToken) query.set('_csrf_token', csrfToken);
  const response = await fetch(`/${encodeURIComponent(appType)}/query/formdesign/getAccessableNavs.json?${query}`, {
    credentials: 'include',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error('导航加载失败，请重试');
  const result = await response.json();
  if (result.success !== true || !Array.isArray(result.content?.navs)) {
    throw new Error('导航加载失败，请重试');
  }
  return filterCanvasNavigation(items, result.content.navs, hiddenNav);
}
