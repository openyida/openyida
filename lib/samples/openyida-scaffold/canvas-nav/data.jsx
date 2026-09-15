/** 平台菜单沿用导航显示规则；独立入口按当前访问者的资源、视图和操作授权过滤。 */
function filterCanvasNavigation(items, navs, hiddenNav = [], { mode = 'platform', access } = {}) {
  if (!['platform', 'independent'].includes(mode)) throw new Error('未知导航模式');
  const isHidden = value => value === true || value === 'y' || value === 'true';
  const visibleIds = new Set();
  function collectVisible(nodes) {
    for (const nav of nodes) {
      if (isHidden(nav.hidden) || hiddenNav.includes(nav.slug) || hiddenNav.includes(nav.navUuid)) continue;
      if (nav.navUuid) visibleIds.add(nav.navUuid);
      if (nav.formUuid) visibleIds.add(nav.formUuid);
      collectVisible(nav.children || []);
    }
  }
  if (mode === 'platform') collectVisible(navs);
  const validRequirement = requirement => requirement && typeof requirement.formUuid === 'string' && requirement.formUuid.trim()
    && typeof requirement.operation === 'string' && requirement.operation.trim()
    && (requirement.viewUuid === undefined || (typeof requirement.viewUuid === 'string' && requirement.viewUuid.trim()));
  const grantKey = requirement => JSON.stringify([requirement.formUuid, requirement.viewUuid || '', requirement.operation]);
  const grants = new Map();
  for (const grant of access?.grants || []) {
    if (!validRequirement(grant)) continue;
    const key = grantKey(grant);
    // 重复结果存在拒绝或未知时，不采用其中的允许结果。
    grants.set(key, grant.allowed === true && grants.get(key) !== false);
  }
  function allowed(item, leaf) {
    const requirements = item.access;
    if (requirements === undefined) return mode === 'platform' || (!leaf && !item.formUuid && !item.navUuid);
    if (!Array.isArray(requirements) || !requirements.length || !requirements.every(validRequirement)) return false;
    if (leaf) {
      const operation = item.targetType === 'submission' ? 'OPERATE_CREATE' : 'OPERATE_VIEW';
      if (!item.formUuid || !requirements.some(requirement => requirement.formUuid === item.formUuid
        && (requirement.viewUuid || '') === (item.viewUuid || item.params?.viewUuid || '') && requirement.operation === operation)) return false;
    }
    return requirements.every(requirement => grants.get(grantKey(requirement)) === true);
  }
  function filterItems(nodes) {
    return nodes.flatMap(item => {
      const resourceId = item.navUuid || item.formUuid;
      if (isHidden(item.hidden) || (mode === 'platform' && resourceId && !visibleIds.has(resourceId))) return [];
      if (item.children !== undefined && !Array.isArray(item.children)) return [];
      if (item.children?.length) {
        if (!allowed(item, false)) return [];
        const children = filterItems(item.children);
        return children.length ? [{ ...item, children }] : [];
      }
      if (!allowed(item, true)) return [];
      return mode === 'independent' || visibleIds.has(resourceId) ? [item] : [];
    });
  }
  return filterItems(items);
}

/** 只在过滤后的叶子菜单中选择内容；无可用入口时返回 undefined。 */
function selectCanvasNavigation(items, requestedKey, defaultKey) {
  const leaves = [];
  function collect(nodes) {
    for (const item of nodes) {
      if (item.children?.length) collect(item.children);
      else if (!item.disabled) leaves.push(item);
    }
  }
  collect(items);
  return leaves.find(item => item.key === requestedKey) || leaves.find(item => item.key === defaultKey) || leaves[0];
}

/** 用途决定路由；独立页面走 custom，管理视图保留真实 viewUuid。 */
function buildCanvasNavigationUrl(item, appType, { embedded = false } = {}) {
  if (item.targetType === 'url') return item.url;
  if (!['submission', 'page', 'custom'].includes(item.targetType)) throw new Error('请明确导航入口用途');
  const formUuid = item.formUuid || item.navUuid;
  if (!appType || !formUuid) throw new Error('缺少导航目标');
  const query = new URLSearchParams(item.params || {});
  const route = { submission: 'submission', page: 'workbench', custom: 'custom' }[item.targetType];
  if (item.viewUuid) {
    if (route !== 'workbench') throw new Error('管理视图必须使用 workbench 入口');
    query.set('viewUuid', item.viewUuid);
  }
  if (route === 'custom') query.delete('isRenderNav');
  if (embedded) {
    if (route === 'workbench') query.set('iframe', 'true');
    else query.set('isRenderNav', 'false');
  }
  const suffix = query.toString();
  return `/${encodeURIComponent(appType)}/${route}/${encodeURIComponent(formUuid)}${suffix ? '?' + suffix : ''}`;
}

/** resolveAccess 是调用方对真实权限服务的适配，不是平台已有的接口或静态授权清单。 */
async function loadCanvasNavigation({ items, appType, formUuid, csrfToken, hiddenNav = [], signal, mode = 'platform', resolveAccess }) {
  if (!Array.isArray(items)) throw new Error('缺少 PRD 导航配置');
  if (!appType) throw new Error('缺少应用标识');
  if (!['platform', 'independent'].includes(mode)) throw new Error('未知导航模式');
  let needsAccess = mode === 'independent';
  const requirements = [];
  function collect(nodes) {
    for (const item of nodes) {
      if (item.access !== undefined) {
        needsAccess = true;
        if (Array.isArray(item.access)) requirements.push(...item.access);
      }
      if (Array.isArray(item.children)) collect(item.children);
    }
  }
  collect(items);
  let access;
  if (needsAccess) {
    if (typeof resolveAccess !== 'function') throw new Error('缺少当前访问者的权限查询能力');
    access = await resolveAccess({ appType, requirements, signal });
    if (access?.appType !== appType || !Array.isArray(access.grants)) throw new Error('权限查询失败，请重试');
  }
  if (signal?.aborted) throw new Error('导航加载已取消');
  // 独立菜单不依赖平台树是否含有被隐藏的资源；授权必须来自上述实时权限查询。
  if (mode === 'independent') return filterCanvasNavigation(items, [], [], { mode, access });
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
  if (result.success !== true || !Array.isArray(result.content?.navs)) throw new Error('导航加载失败，请重试');
  if (signal?.aborted) throw new Error('导航加载已取消');
  return filterCanvasNavigation(items, result.content.navs, hiddenNav, { mode, access });
}
