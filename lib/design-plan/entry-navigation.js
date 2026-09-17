'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const filled = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, message, details) => {
  if (!condition) {throw new CliError(message, { code: 'DESIGN_PLAN_INVALID_ENTRY_NAVIGATION', ...(details ? { details } : {}) });}
};

// Resource names are planning references. Runtime IDs and permissions are resolved after creation.
function buildEntryNavigation(plan, resources, pages) {
  const recommendation = plan.execution?.entryRecommendation;
  if (recommendation === undefined) {return null;}
  assert(object(recommendation) && ['unified', 'service-management', 'frontend-only'].includes(recommendation.mode), '入口方案需要明确 unified/service-management/frontend-only');
  assert(Array.isArray(recommendation.entries) && recommendation.entries.length > 0, '入口方案缺少 entries');
  const names = new Set(resources.map(resource => resource.name));
  const entryKeys = new Set();
  const platformOrder = [];
  for (const entry of recommendation.entries) {
    assert(object(entry) && filled(entry.key) && !entryKeys.has(entry.key) && filled(entry.name), '入口 key/name 缺失或重复');
    entryKeys.add(entry.key);
    assert(['service', 'management', 'workspace'].includes(entry.role), `入口 ${entry.name} 需要明确业务身份`);
    const page = pages.find(item => item.sceneKey === entry.sceneKey);
    assert(entry.sceneKey === undefined || page, `入口 ${entry.name} 引用了未知 sceneKey`);
    assert(entry.sceneKey === undefined || pages.filter(item => item.sceneKey === entry.sceneKey).length === 1, `入口 ${entry.name} 的 sceneKey 必须唯一关联页面`);
    if (entry.role === 'service') {
      assert(page?.pageSpecHandoff.entryMode === 'standalone', `访客入口 ${entry.name} 必须关联独立页面`);
    }
    assert(Array.isArray(entry.menu) && entry.menu.length > 0, `入口 ${entry.name} 缺少任务菜单，单步入口也需记录唯一任务`);
    const keys = new Set();
    const leaves = [];
    const visit = items => {
      for (const item of items) {
        assert(object(item) && filled(item.key) && !keys.has(item.key) && filled(item.label), `入口 ${entry.name} 的菜单 key/label 缺失或重复`);
        keys.add(item.key);
        if (item.children !== undefined) {
          assert(Array.isArray(item.children) && item.children.length > 0, `菜单 ${item.label} 的分组为空`);
          visit(item.children);
          continue;
        }
        assert(names.has(item.resource), `菜单 ${item.label} 引用了未知资源`);
        assert(['local', 'submission', 'page', 'custom'].includes(item.targetType), `菜单 ${item.label} 缺少入口用途`);
        if (item.targetType === 'submission') {
          assert(resources.some(resource => resource.name === item.resource && ['normal-form', 'process-form'].includes(resource.type)), `菜单 ${item.label} 的提交目标必须是表单`);
        }
        assert(item.viewUuid === undefined || (filled(item.viewUuid) && item.targetType === 'page'), `菜单 ${item.label} 的 viewUuid 仅用于真实管理视图`);
        const targetPage = pages.find(candidate => candidate.name === item.resource);
        if (item.targetType === 'local') {
          const missingFields = [!filled(entry.sceneKey) && 'entry.sceneKey',
            (!page || item.resource !== page.name) && 'menu.resource', !filled(item.viewKey) && 'menu.viewKey'].filter(Boolean);
          assert(filled(entry.sceneKey) && page && item.resource === page.name && filled(item.viewKey),
            t('cli.design_plan_local_menu_binding', item.label, entry.name),
            { entryKey: entry.key, menuKey: item.key, sceneKey: entry.sceneKey || null,
              pageName: page?.name || null, resource: item.resource, missingFields });
        }
        if (item.targetType === 'custom') {
          assert(targetPage?.pageSpecHandoff.entryMode === 'standalone', `菜单 ${item.label} 的 custom 目标必须为独立页面`);
        }
        if (item.targetType === 'page') {
          assert(targetPage?.pageSpecHandoff.entryMode !== 'standalone', `菜单 ${item.label} 应使用 custom 路径打开独立页面，避免双导航`);
        }
        assert(Array.isArray(item.access) && item.access.length > 0, `菜单 ${item.label} 缺少权限依赖`);
        for (const requirement of item.access) {
          assert(object(requirement) && names.has(requirement.resource) && filled(requirement.operation)
            && filled(requirement.dataScope), `菜单 ${item.label} 需填写权限资源、操作和数据范围`);
          assert(requirement.viewUuid === undefined || filled(requirement.viewUuid), `菜单 ${item.label} 的权限视图无效`);
        }
        const operation = item.targetType === 'submission' ? 'OPERATE_CREATE' : 'OPERATE_VIEW';
        assert(item.access.some(requirement => requirement.resource === item.resource && requirement.operation === operation
          && (requirement.viewUuid || '') === (item.viewUuid || '')), `菜单 ${item.label} 缺少目标用途对应的 ${operation} 权限`);
        leaves.push(item);
      }
    };
    visit(entry.menu);
    assert(leaves.some(item => item.key === entry.defaultMenuKey), `入口 ${entry.name} 的默认菜单必须指向有效任务`);
    if (entry.role !== 'service') {
      const first = leaves.find(item => item.key === entry.defaultMenuKey);
      assert(first.targetType !== 'custom', `管理入口 ${entry.name} 不能默认跳到独立前台`);
      platformOrder.push(first.resource, ...leaves.filter(item => item.targetType !== 'custom').map(item => item.resource));
    }
  }
  const roles = recommendation.entries.map(entry => entry.role);
  assert(recommendation.mode !== 'service-management' || (roles.includes('service') && roles.includes('management')), '前后台方案必须同时包含访客端和业务管理端');
  assert(recommendation.mode !== 'frontend-only' || roles.every(role => role === 'service'), '仅前台方案不能包含管理入口');
  return { recommendation: JSON.parse(JSON.stringify(recommendation)), platformOrder: [...new Set(platformOrder)] };
}

module.exports = { buildEntryNavigation };
