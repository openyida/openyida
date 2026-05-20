'use strict';

const querystring = require('querystring');

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');

const ROOT_NAV_UUID = 'NAV-SYSTEM-PARENT-UUID';

function parseArgs(args) {
  const parsed = {
    subCommand: args[0] || '',
    appType: args[1] || '',
    name: '',
    group: '',
    page: '',
    to: '',
    order: '',
    position: null,
    force: false,
  };

  for (let index = 2; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--name' && args[index + 1]) {
      parsed.name = args[index + 1];
      index++;
    } else if (arg === '--group' && args[index + 1]) {
      parsed.group = args[index + 1];
      index++;
    } else if (arg === '--page' && args[index + 1]) {
      parsed.page = args[index + 1];
      index++;
    } else if (arg === '--to' && args[index + 1]) {
      parsed.to = args[index + 1];
      index++;
    } else if (arg === '--order' && args[index + 1]) {
      parsed.order = args[index + 1];
      index++;
    } else if (arg === '--position' && args[index + 1]) {
      parsed.position = Number(args[index + 1]);
      index++;
    } else if (arg === '--force') {
      parsed.force = true;
    }
  }

  return parsed;
}

function ensurePosition(position, maxLength) {
  if (position == null || Number.isNaN(position)) {
    return null;
  }
  return Math.max(0, Math.min(position, maxLength));
}

function resolveLocalizedText(value, fallback = '') {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    return value.zh_CN || value.en_US || value.zh_TW || fallback;
  }

  return fallback;
}

function toI18nTitle(name) {
  return JSON.stringify({
    pureEn_US: name,
    en_US: name,
    zh_CN: name,
    envLocale: null,
    type: 'i18n',
    ja_JP: null,
    key: null,
  });
}

function normalizeNode(node) {
  if (!node) {
    return null;
  }

  return {
    id: node.id,
    navUuid: node.navUuid,
    title: resolveLocalizedText(node.title || node.i18nTitle || node.name, ''),
    navType: node.navType || '',
    formUuid: node.formUuid || '',
    parentNavUuid: node.parentNavUuid || ROOT_NAV_UUID,
    parentId: node.parentId == null ? 0 : node.parentId,
    listOrder: typeof node.listOrder === 'number' ? node.listOrder : 0,
    hidden: node.hidden || 'n',
    mobileHidden: node.mobileHidden == null ? 'n' : node.mobileHidden,
    raw: node,
  };
}

function filterVisibleNodes(nodes) {
  return nodes.filter((node) => node.hidden !== 'y' && node.navType !== 'SYSTEM');
}

function sortByListOrder(nodes) {
  return [...nodes].sort((left, right) => {
    if (left.listOrder !== right.listOrder) {
      return left.listOrder - right.listOrder;
    }
    return left.id - right.id;
  });
}

function buildTree(nodes) {
  const visibleNodes = sortByListOrder(filterVisibleNodes(nodes));
  const nodeMap = new Map();
  visibleNodes.forEach((node) => {
    nodeMap.set(node.navUuid, { ...node, children: [] });
  });

  const groups = [];
  const ungrouped = [];

  visibleNodes.forEach((node) => {
    const current = nodeMap.get(node.navUuid);
    if (current.parentNavUuid !== ROOT_NAV_UUID) {
      const parent = nodeMap.get(current.parentNavUuid);
      if (parent) {
        parent.children.push(current);
        return;
      }
    }

    if (current.navType === 'NAV') {
      groups.push(current);
    } else {
      ungrouped.push(current);
    }
  });

  return { groups, ungrouped };
}

function findNode(nodes, identifier, predicate) {
  if (!identifier) {
    return null;
  }

  const normalized = String(identifier).trim();
  return nodes.find((node) => {
    if (predicate && !predicate(node)) {
      return false;
    }

    return [
      String(node.id),
      node.navUuid,
      node.formUuid,
      node.title,
    ].filter(Boolean).includes(normalized);
  }) || null;
}

function requireSubCommand(parsed) {
  const supported = ['list', 'create', 'move', 'sort', 'rename', 'delete'];
  if (!supported.includes(parsed.subCommand)) {
    throw new Error(t('nav_group.invalid_subcommand'));
  }
}

function getAuthRef() {
  let cookieData = loadCookieData();
  if (!cookieData) {
    cookieData = triggerLogin();
  }

  if (!cookieData || !cookieData.cookies) {
    throw new Error(t('nav_group.no_login'));
  }

  return {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
}

async function requestNavGet(authRef, appType, path, params) {
  const result = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/dingtalk/web/${appType}${path}`,
      { ...params, _mock: false, _api: params._api, _csrf_token: auth.csrfToken },
      auth.cookies
    );
  }, authRef);

  if (!result || result.success === false) {
    throw new Error(result ? (result.errorMsg || t('common.unknown_error')) : t('common.request_failed'));
  }

  return result;
}

async function requestNavPost(authRef, appType, path, params) {
  const result = await requestWithAutoLogin((auth) => {
    return httpPost(
      auth.baseUrl,
      `/dingtalk/web/${appType}${path}`,
      querystring.stringify({ ...params, _mock: false, _api: params._api, _csrf_token: auth.csrfToken }),
      auth.cookies
    );
  }, authRef);

  if (!result || result.success === false) {
    throw new Error(result ? (result.errorMsg || t('common.unknown_error')) : t('common.request_failed'));
  }

  return result;
}

async function fetchNavigationList(appType, authRef) {
  const result = await requestNavGet(
    authRef,
    appType,
    '/query/formnav/getFormNavigationListByOrder.json',
    { _api: 'Nav.queryList' }
  );

  return Array.isArray(result.content) ? result.content.map(normalizeNode).filter(Boolean) : [];
}

async function fetchNavigationDetail(appType, authRef, navUuid) {
  const result = await requestNavGet(
    authRef,
    appType,
    '/query/formnav/getNavigationByKey.json',
    { _api: 'Nav.getDetail', navUuid }
  );

  return normalizeNode(result.content);
}

async function createGroup(appType, authRef, name) {
  const result = await requestNavPost(
    authRef,
    appType,
    '/query/formnav/saveFormNavigation.json',
    {
      _api: 'Nav.save',
      _locale_time_zone_offset: '28800000',
      title: toI18nTitle(name),
      navType: 'NAV',
      parentId: 0,
      hidden: 'n',
      mobileHidden: 'n',
    }
  );

  return result.content;
}

async function renameGroup(appType, authRef, node, name) {
  await requestNavPost(
    authRef,
    appType,
    '/query/formnav/updateNavigationTitle.json',
    {
      _api: 'Nav.updateTitle',
      navUuid: node.navUuid,
      title: toI18nTitle(name),
    }
  );
}

async function updateNavigationNode(appType, authRef, node, overrides) {
  const raw = node.raw || {};
  await requestNavPost(
    authRef,
    appType,
    '/query/formnav/updateFormNavigation.json',
    {
      _api: 'Nav.update',
      id: node.id,
      navUuid: node.navUuid,
      navType: node.navType,
      parentId: overrides.parentId == null ? node.parentId : overrides.parentId,
      parentNavUuid: overrides.parentNavUuid || node.parentNavUuid || ROOT_NAV_UUID,
      hidden: overrides.hidden || node.hidden,
      mobileHidden: overrides.mobileHidden == null ? node.mobileHidden : overrides.mobileHidden,
      title: toI18nTitle(overrides.title || node.title),
      icon: raw.icon || '',
      i18nTitle: raw.i18nTitle || '',
      isNewReport: raw.isNewReport || '',
      isNewForm: raw.isNewForm || '',
      slug: raw.slug || '',
      formType: raw.formType || '',
      formUuid: node.formUuid || '',
      url: raw.url || '',
      topicId: raw.topicId || '',
      displayType: raw.displayType || '',
      relateFormUuid: raw.relateFormUuid || node.formUuid || '',
      processCode: raw.processCode || '',
      listOrder: raw.listOrder == null ? node.listOrder : raw.listOrder,
      formStatus: raw.formStatus || '',
      relateFormType: raw.relateFormType || '',
    }
  );
}

async function deleteGroup(appType, authRef, node) {
  await requestNavPost(
    authRef,
    appType,
    '/query/formnav/deleteFormNavigation.json',
    {
      _api: 'Nav.delete',
      navUuid: node.navUuid,
    }
  );
}

async function reorderVisibleNodes(appType, authRef, orderedNodes) {
  const visibleNodes = filterVisibleNodes(orderedNodes);
  await requestNavPost(
    authRef,
    appType,
    '/query/formnav/updateFormNavigationOrder.json',
    {
      _api: 'Nav.updateOrder',
      ids: visibleNodes.map((node) => node.id).join(','),
      listOrders: visibleNodes.map((_, index) => index).join(','),
    }
  );
}

function moveNodeInArray(nodes, navUuid, targetIndex) {
  const list = [...nodes];
  const fromIndex = list.findIndex((node) => node.navUuid === navUuid);
  if (fromIndex === -1) {
    return list;
  }
  const [item] = list.splice(fromIndex, 1);
  const nextIndex = Math.max(0, Math.min(targetIndex, list.length));
  list.splice(nextIndex, 0, item);
  return list;
}

function computeGroupTailIndex(nodes, groupNavUuid) {
  const groupIndex = nodes.findIndex((node) => node.navUuid === groupNavUuid);
  if (groupIndex === -1) {
    return nodes.length;
  }

  let tailIndex = groupIndex + 1;
  while (
    tailIndex < nodes.length &&
    nodes[tailIndex].parentNavUuid === groupNavUuid &&
    nodes[tailIndex].navType !== 'NAV'
  ) {
    tailIndex++;
  }

  return tailIndex;
}

function parseOrderIdentifiers(orderValue) {
  if (!orderValue) {
    throw new Error(t('nav_group.order_required'));
  }

  let parsed;
  try {
    parsed = JSON.parse(orderValue);
  } catch (error) {
    throw new Error(t('nav_group.order_invalid_json'));
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(t('nav_group.order_invalid_json'));
  }

  return parsed.map((value) => String(value));
}

function buildListOutput(appType, nodes) {
  const tree = buildTree(nodes);
  return {
    appType,
    groups: tree.groups.map((group) => ({
      id: group.id,
      navUuid: group.navUuid,
      title: group.title,
      listOrder: group.listOrder,
      children: sortByListOrder(group.children).map((child) => ({
        id: child.id,
        navUuid: child.navUuid,
        formUuid: child.formUuid,
        title: child.title,
        navType: child.navType,
        listOrder: child.listOrder,
      })),
    })),
    ungrouped: tree.ungrouped.map((node) => ({
      id: node.id,
      navUuid: node.navUuid,
      formUuid: node.formUuid,
      title: node.title,
      navType: node.navType,
      listOrder: node.listOrder,
    })),
  };
}

async function handleList(appType, authRef) {
  const nodes = await fetchNavigationList(appType, authRef);
  console.log(JSON.stringify(buildListOutput(appType, nodes), null, 2));
}

async function handleCreate(parsed, authRef) {
  if (!parsed.name) {
    throw new Error(t('nav_group.name_required'));
  }

  const nodesBefore = await fetchNavigationList(parsed.appType, authRef);
  const createdId = await createGroup(parsed.appType, authRef, parsed.name);
  const nodesAfter = await fetchNavigationList(parsed.appType, authRef);
  const createdNode = findNode(nodesAfter, String(createdId), (node) => node.navType === 'NAV');

  if (!createdNode) {
    throw new Error(t('nav_group.create_failed'));
  }

  const position = ensurePosition(parsed.position, filterVisibleNodes(nodesAfter).length - 1);
  if (position != null) {
    const visibleNodes = sortByListOrder(filterVisibleNodes(nodesAfter));
    const reordered = moveNodeInArray(visibleNodes, createdNode.navUuid, position);
    await reorderVisibleNodes(parsed.appType, authRef, reordered);
  }

  const finalNodes = await fetchNavigationList(parsed.appType, authRef);
  const finalNode = findNode(finalNodes, createdNode.navUuid, (node) => node.navType === 'NAV');
  console.log(JSON.stringify({
    action: 'create',
    appType: parsed.appType,
    group: {
      id: finalNode.id,
      navUuid: finalNode.navUuid,
      title: finalNode.title,
      listOrder: finalNode.listOrder,
    },
    previousVisibleCount: filterVisibleNodes(nodesBefore).length,
  }, null, 2));
}

async function handleRename(parsed, authRef) {
  if (!parsed.group || !parsed.name) {
    throw new Error(t('nav_group.rename_usage'));
  }

  const nodes = await fetchNavigationList(parsed.appType, authRef);
  const group = findNode(nodes, parsed.group, (node) => node.navType === 'NAV');
  if (!group) {
    throw new Error(t('nav_group.group_not_found', parsed.group));
  }

  await renameGroup(parsed.appType, authRef, group, parsed.name);
  const renamed = await fetchNavigationDetail(parsed.appType, authRef, group.navUuid);
  console.log(JSON.stringify({
    action: 'rename',
    appType: parsed.appType,
    group: {
      id: renamed.id,
      navUuid: renamed.navUuid,
      title: renamed.title,
    },
  }, null, 2));
}

async function handleDelete(parsed, authRef) {
  if (!parsed.group) {
    throw new Error(t('nav_group.group_required'));
  }

  const nodes = await fetchNavigationList(parsed.appType, authRef);
  const group = findNode(nodes, parsed.group, (node) => node.navType === 'NAV');
  if (!group) {
    throw new Error(t('nav_group.group_not_found', parsed.group));
  }

  const children = sortByListOrder(nodes.filter((node) => node.parentNavUuid === group.navUuid));
  if (children.length > 0 && !parsed.force) {
    throw new Error(t('nav_group.group_not_empty', group.title));
  }

  for (const child of children) {
    await updateNavigationNode(parsed.appType, authRef, child, {
      parentNavUuid: ROOT_NAV_UUID,
    });
  }

  await deleteGroup(parsed.appType, authRef, group);
  const finalNodes = await fetchNavigationList(parsed.appType, authRef);
  console.log(JSON.stringify({
    action: 'delete',
    appType: parsed.appType,
    group: {
      id: group.id,
      navUuid: group.navUuid,
      title: group.title,
    },
    releasedChildren: children.map((child) => ({
      id: child.id,
      navUuid: child.navUuid,
      title: child.title,
    })),
    remainingVisibleCount: filterVisibleNodes(finalNodes).length,
  }, null, 2));
}

async function handleMove(parsed, authRef) {
  if (!parsed.page || !parsed.to) {
    throw new Error(t('nav_group.move_usage'));
  }

  const nodes = await fetchNavigationList(parsed.appType, authRef);
  const page = findNode(nodes, parsed.page, (node) => node.navType !== 'NAV' && node.navType !== 'SYSTEM');
  if (!page) {
    throw new Error(t('nav_group.page_not_found', parsed.page));
  }

  const group = findNode(nodes, parsed.to, (node) => node.navType === 'NAV');
  if (!group) {
    throw new Error(t('nav_group.group_not_found', parsed.to));
  }

  await updateNavigationNode(parsed.appType, authRef, page, {
    parentNavUuid: group.navUuid,
  });

  const updatedNodes = await fetchNavigationList(parsed.appType, authRef);
  const updatedPage = findNode(updatedNodes, page.navUuid);
  const visibleNodes = sortByListOrder(filterVisibleNodes(updatedNodes));
  const position = ensurePosition(parsed.position, visibleNodes.length - 1);
  const targetIndex = position != null ? position : computeGroupTailIndex(visibleNodes, group.navUuid);
  const reordered = moveNodeInArray(visibleNodes, updatedPage.navUuid, targetIndex);
  await reorderVisibleNodes(parsed.appType, authRef, reordered);

  const finalPage = await fetchNavigationDetail(parsed.appType, authRef, page.navUuid);
  console.log(JSON.stringify({
    action: 'move',
    appType: parsed.appType,
    page: {
      id: finalPage.id,
      navUuid: finalPage.navUuid,
      formUuid: finalPage.formUuid,
      title: finalPage.title,
      parentNavUuid: finalPage.parentNavUuid,
    },
    group: {
      id: group.id,
      navUuid: group.navUuid,
      title: group.title,
    },
  }, null, 2));
}

async function handleSort(parsed, authRef) {
  const identifiers = parseOrderIdentifiers(parsed.order);
  const nodes = sortByListOrder(filterVisibleNodes(await fetchNavigationList(parsed.appType, authRef)));
  const orderedNodes = [];
  const used = new Set();

  identifiers.forEach((identifier) => {
    const node = findNode(nodes, identifier);
    if (!node) {
      throw new Error(t('nav_group.node_not_found', identifier));
    }
    if (!used.has(node.navUuid)) {
      used.add(node.navUuid);
      orderedNodes.push(node);
    }
  });

  nodes.forEach((node) => {
    if (!used.has(node.navUuid)) {
      orderedNodes.push(node);
    }
  });

  await reorderVisibleNodes(parsed.appType, authRef, orderedNodes);
  const finalNodes = sortByListOrder(filterVisibleNodes(await fetchNavigationList(parsed.appType, authRef)));
  console.log(JSON.stringify({
    action: 'sort',
    appType: parsed.appType,
    orderedNavUuids: finalNodes.map((node) => node.navUuid),
  }, null, 2));
}

async function run(args) {
  const parsed = parseArgs(args);
  requireSubCommand(parsed);

  if (!parsed.appType) {
    console.error(t('nav_group.usage'));
    process.exit(1);
  }

  const authRef = getAuthRef();

  switch (parsed.subCommand) {
    case 'list':
      await handleList(parsed.appType, authRef);
      break;
    case 'create':
      await handleCreate(parsed, authRef);
      break;
    case 'rename':
      await handleRename(parsed, authRef);
      break;
    case 'delete':
      await handleDelete(parsed, authRef);
      break;
    case 'move':
      await handleMove(parsed, authRef);
      break;
    case 'sort':
      await handleSort(parsed, authRef);
      break;
    default:
      throw new Error(t('nav_group.invalid_subcommand'));
  }
}

module.exports = {
  ROOT_NAV_UUID,
  parseArgs,
  resolveLocalizedText,
  normalizeNode,
  filterVisibleNodes,
  sortByListOrder,
  buildTree,
  findNode,
  moveNodeInArray,
  computeGroupTailIndex,
  parseOrderIdentifiers,
  buildListOutput,
  run,
};
