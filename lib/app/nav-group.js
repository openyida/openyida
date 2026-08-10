'use strict';

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const {
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef, isAuthRefReady } = require('../core/yida-client');
const { parseYidaI18n } = require('../core/yida-i18n');

const ROOT_NAV_UUID = 'NAV-SYSTEM-PARENT-UUID';
const FORM_UUID_FALLBACK = 'NAV-SYSTEM-FROM-ME-UUID';

function resolveLocalizedText(value, fallback = '') {
  return parseYidaI18n(value, fallback, { parseJson: false });
}

function buildI18nTitle(name, enName) {
  return {
    zh_CN: name,
    en_US: enName || name,
    type: 'i18n',
  };
}

function normalizeNavNode(node) {
  const name = resolveLocalizedText(node.title || node.i18nTitle || node.name, '');
  return {
    id: node.id,
    navUuid: node.navUuid,
    parentNavUuid: node.parentNavUuid || ROOT_NAV_UUID,
    navType: node.navType || '',
    type: node.navType === 'NAV'
      ? 'group'
      : node.navType === 'LINK'
        ? 'link'
        : node.navType === 'SYSTEM'
          ? 'system'
          : 'page',
    name,
    title: node.title || node.i18nTitle || null,
    formUuid: node.formUuid || null,
    relateFormUuid: node.relateFormUuid || null,
    formType: node.formType || '',
    hidden: node.hidden === 'y',
    mobileHidden: node.mobileHidden === 'y',
    listOrder: node.listOrder,
    raw: node,
  };
}

function cloneRawNode(node) {
  return {
    ...node,
    children: [],
  };
}

function buildNavigationTree(list, options = {}) {
  const includeSystem = options.includeSystem === true;
  const nodes = (list || []).map(cloneRawNode);
  const byNavUuid = new Map(nodes.map((node) => [node.navUuid, node]));
  const roots = [];

  nodes.forEach((node) => {
    if (node.parentNavUuid === 'appSelf') {
      node.parentNavUuid = ROOT_NAV_UUID;
    }

    const parentNavUuid = node.parentNavUuid || ROOT_NAV_UUID;
    if (parentNavUuid !== ROOT_NAV_UUID && byNavUuid.has(parentNavUuid)) {
      byNavUuid.get(parentNavUuid).children.push(node);
    } else {
      node.parentNavUuid = ROOT_NAV_UUID;
      roots.push(node);
    }
  });

  const filterNode = (node) => {
    if (!includeSystem && node.navType === 'SYSTEM') {
      return null;
    }

    const normalized = normalizeNavNode(node);
    const children = (node.children || [])
      .map(filterNode)
      .filter(Boolean);

    return {
      ...normalized,
      children,
      childrenCount: children.length,
      raw: undefined,
    };
  };

  return roots
    .map(filterNode)
    .filter(Boolean);
}

function flattenTreeIds(nodes, output = []) {
  (nodes || []).forEach((node) => {
    output.push(node.id);
    flattenTreeIds(node.children || [], output);
  });
  return output;
}

function flattenTreeNodes(nodes, output = []) {
  (nodes || []).forEach((node) => {
    output.push(node);
    flattenTreeNodes(node.children || [], output);
  });
  return output;
}

function parseArgs(args) {
  const positional = [];
  const flags = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    if (['json', 'tree', 'flat', 'force', 'include-system', 'raw', 'dry-run'].includes(key)) {
      flags[key] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`--${key} requires a value`);
    }
    flags[key] = value;
    index++;
  }

  return { positional, flags };
}

function getNodeName(node) {
  return resolveLocalizedText(node.title || node.i18nTitle || node.name, '');
}

function isRootAlias(value) {
  return !value || ['root', '/', 'ROOT', ROOT_NAV_UUID].includes(value);
}

function resolveNode(list, value, options = {}) {
  if (isRootAlias(value)) {
    return {
      navUuid: ROOT_NAV_UUID,
      navType: 'ROOT',
      name: 'root',
      id: null,
    };
  }

  const matches = (list || []).filter((node) => {
    if (options.groupOnly && node.navType !== 'NAV') {
      return false;
    }
    if (options.excludeSystem && node.navType === 'SYSTEM') {
      return false;
    }

    return node.navUuid === value ||
      node.formUuid === value ||
      node.relateFormUuid === value ||
      getNodeName(node) === value;
  });

  if (matches.length === 0) {
    throw new Error(`Navigation node not found: ${value}`);
  }
  if (matches.length > 1) {
    const ids = matches.map((node) => node.navUuid || node.formUuid).join(', ');
    throw new Error(`Navigation node is ambiguous: ${value} (${ids})`);
  }

  return matches[0];
}

function buildMutableForest(list) {
  const nodes = (list || []).map(cloneRawNode);
  const byNavUuid = new Map(nodes.map((node) => [node.navUuid, node]));
  const roots = [];

  nodes.forEach((node) => {
    if (node.parentNavUuid === 'appSelf') {
      node.parentNavUuid = ROOT_NAV_UUID;
    }

    const parentNavUuid = node.parentNavUuid || ROOT_NAV_UUID;
    if (parentNavUuid !== ROOT_NAV_UUID && byNavUuid.has(parentNavUuid)) {
      byNavUuid.get(parentNavUuid).children.push(node);
    } else {
      node.parentNavUuid = ROOT_NAV_UUID;
      roots.push(node);
    }
  });

  return { roots, byNavUuid };
}

function findParentContainer(roots, navUuid) {
  const visit = (children, parent) => {
    for (let index = 0; index < children.length; index++) {
      const node = children[index];
      if (node.navUuid === navUuid) {
        return { children, index, parent };
      }
      const nested = visit(node.children || [], node);
      if (nested) {
        return nested;
      }
    }
    return null;
  };

  return visit(roots, null);
}

function hasDescendantGroup(node) {
  return (node.children || []).some((child) => child.navType === 'NAV' || hasDescendantGroup(child));
}

function isDescendant(parent, maybeChildNavUuid) {
  return (parent.children || []).some((child) => {
    return child.navUuid === maybeChildNavUuid || isDescendant(child, maybeChildNavUuid);
  });
}

function moveNodeInTree(list, nodeNavUuid, targetParentNavUuid, options = {}) {
  const { roots, byNavUuid } = buildMutableForest(list);
  const node = byNavUuid.get(nodeNavUuid);
  if (!node) {
    throw new Error(`Navigation node not found: ${nodeNavUuid}`);
  }

  if (node.navType === 'SYSTEM') {
    throw new Error('System navigation nodes cannot be moved');
  }

  const targetParent = targetParentNavUuid === ROOT_NAV_UUID ? null : byNavUuid.get(targetParentNavUuid);
  if (targetParentNavUuid !== ROOT_NAV_UUID && (!targetParent || targetParent.navType !== 'NAV')) {
    throw new Error(`Target parent is not a group: ${targetParentNavUuid}`);
  }

  if (node.navType === 'NAV') {
    if (targetParent && targetParent.parentNavUuid !== ROOT_NAV_UUID) {
      throw new Error('A group can only be moved under the root or a top-level group');
    }
    if (targetParent && hasDescendantGroup(node)) {
      throw new Error('A group containing child groups cannot be moved under another group');
    }
    if (targetParent && isDescendant(node, targetParent.navUuid)) {
      throw new Error('A group cannot be moved into itself or its descendants');
    }
  }

  const current = findParentContainer(roots, nodeNavUuid);
  if (!current) {
    throw new Error(`Navigation node is not in the tree: ${nodeNavUuid}`);
  }
  current.children.splice(current.index, 1);

  const targetChildren = targetParent ? targetParent.children : roots;
  node.parentNavUuid = targetParentNavUuid;

  let insertIndex = targetChildren.length;
  if (options.before) {
    insertIndex = targetChildren.findIndex((item) => item.navUuid === options.before);
    if (insertIndex === -1) {
      throw new Error(`--before node is not a child of the target parent: ${options.before}`);
    }
  } else if (options.after) {
    insertIndex = targetChildren.findIndex((item) => item.navUuid === options.after);
    if (insertIndex === -1) {
      throw new Error(`--after node is not a child of the target parent: ${options.after}`);
    }
    insertIndex += 1;
  }

  targetChildren.splice(insertIndex, 0, node);

  return {
    roots,
    ids: flattenTreeIds(roots, []),
    movedNode: node,
  };
}

function detachNodeFromTree(roots, byNavUuid, node) {
  const siblings = node.parentNavUuid === ROOT_NAV_UUID
    ? roots
    : (byNavUuid.get(node.parentNavUuid) || {}).children;
  if (!siblings) {
    throw new Error(`Navigation parent not found: ${node.parentNavUuid}`);
  }
  const index = siblings.findIndex((item) => item.navUuid === node.navUuid);
  if (index === -1) {
    throw new Error(`Navigation node not found under parent: ${node.navUuid}`);
  }
  siblings.splice(index, 1);
}

function reorderRootNodes(list, values) {
  const targets = Array.isArray(values) ? values.filter(Boolean) : [];
  if (targets.length === 0) {
    throw new Error('At least one navigation item is required');
  }

  const { roots, byNavUuid } = buildMutableForest(list);
  const orderedNodes = targets.map((value) => resolveNode(list, value, { excludeSystem: true }));
  const seen = new Set();
  orderedNodes.forEach((node) => {
    if (seen.has(node.navUuid)) {
      throw new Error(`Duplicate navigation item: ${node.navUuid}`);
    }
    seen.add(node.navUuid);
  });

  orderedNodes.forEach((node) => {
    const mutableNode = byNavUuid.get(node.navUuid);
    detachNodeFromTree(roots, byNavUuid, mutableNode);
    mutableNode.parentNavUuid = ROOT_NAV_UUID;
  });

  const insertionIndex = roots.findIndex((node) => node.navType !== 'SYSTEM');
  if (insertionIndex === -1) {
    roots.push(...orderedNodes.map((node) => byNavUuid.get(node.navUuid)));
  } else {
    roots.splice(insertionIndex, 0, ...orderedNodes.map((node) => byNavUuid.get(node.navUuid)));
  }

  return {
    roots,
    ids: flattenTreeIds(roots),
    orderedNavUuids: orderedNodes.map((node) => node.navUuid),
  };
}

function normalizePlanSelector(value, location) {
  if (typeof value === 'string' && value.trim()) {
    return {
      ref: value.trim(),
      name: '',
      optional: false,
    };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${location} must be a navigation ID, exact name, or selector object`);
  }
  const ref = String(value.ref || '').trim();
  if (!ref) {
    throw new Error(`${location}.ref is required`);
  }
  return {
    ref,
    name: String(value.name || '').trim(),
    optional: value.optional === true,
  };
}

function normalizeNavigationPlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Navigation plan must be a JSON object');
  }
  if (value.version !== 1) {
    throw new Error('Navigation plan version must be 1');
  }
  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new Error('Navigation plan items must be a non-empty array');
  }

  const groups = new Set();
  const items = value.items.map((entry, index) => {
    const location = `items[${index}]`;
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && entry.group !== undefined) {
      const name = String(entry.group || '').trim();
      if (!name) {
        throw new Error(`${location}.group is required`);
      }
      if (groups.has(name)) {
        throw new Error(`Duplicate navigation group in plan: ${name}`);
      }
      groups.add(name);
      if (!Array.isArray(entry.items) || entry.items.length === 0) {
        throw new Error(`${location}.items must be a non-empty array`);
      }
      return {
        kind: 'group',
        name,
        navUuid: String(entry.navUuid || '').trim(),
        items: entry.items.map((item, itemIndex) => normalizePlanSelector(
          item,
          `${location}.items[${itemIndex}]`
        )),
      };
    }
    return {
      kind: 'item',
      selector: normalizePlanSelector(entry, location),
    };
  });

  return { version: 1, items };
}

function resolvePlanSelector(list, selector, options = {}) {
  let node;
  try {
    node = resolveNode(list, selector.ref, {
      groupOnly: options.groupOnly === true,
      excludeSystem: true,
    });
  } catch (error) {
    if (selector.optional && /not found/.test(error.message)) {
      return null;
    }
    throw error;
  }

  if (!options.groupOnly && node.navType === 'NAV') {
    throw new Error(`Navigation plan item must reference a page or link: ${selector.ref}`);
  }
  const actualName = getNodeName(node);
  if (selector.name && selector.name !== actualName) {
    throw new Error(
      `Navigation item name mismatch for ${selector.ref}: expected ${selector.name}, got ${actualName}`
    );
  }
  return node;
}

function resolveNavigationPlan(list, value, options = {}) {
  const plan = value && value.version === 1 && Array.isArray(value.items) &&
    value.items.every(item => item && (item.kind === 'group' || item.kind === 'item'))
    ? value
    : normalizeNavigationPlan(value);
  const seenNodes = new Set();
  const deferred = [];
  const groupsToCreate = [];

  const items = plan.items.map((entry) => {
    if (entry.kind === 'item') {
      const node = resolvePlanSelector(list, entry.selector);
      if (!node) {
        deferred.push({ ref: entry.selector.ref, name: entry.selector.name || null, parent: 'root' });
        return null;
      }
      if (seenNodes.has(node.navUuid)) {
        throw new Error(`Duplicate navigation item in plan: ${node.navUuid}`);
      }
      seenNodes.add(node.navUuid);
      return { kind: 'item', node };
    }

    const children = entry.items.map((selector) => {
      const node = resolvePlanSelector(list, selector);
      if (!node) {
        deferred.push({ ref: selector.ref, name: selector.name || null, parent: entry.name });
        return null;
      }
      if (seenNodes.has(node.navUuid)) {
        throw new Error(`Duplicate navigation item in plan: ${node.navUuid}`);
      }
      seenNodes.add(node.navUuid);
      return node;
    }).filter(Boolean);

    if (children.length === 0) {
      return null;
    }

    const groupSelector = {
      ref: entry.navUuid || entry.name,
      name: entry.navUuid ? entry.name : '',
      optional: !entry.navUuid,
    };
    const group = resolvePlanSelector(list, groupSelector, { groupOnly: true });
    if (!group) {
      groupsToCreate.push(entry.name);
      if (options.requireGroups === true) {
        throw new Error(`Navigation group was not created: ${entry.name}`);
      }
    }
    return {
      kind: 'group',
      name: entry.name,
      group,
      children,
    };
  }).filter(Boolean);

  return {
    version: 1,
    plan,
    items,
    groupsToCreate,
    deferred,
  };
}

function relocateMutableNode(roots, byNavUuid, navUuid, parentNavUuid) {
  const node = byNavUuid.get(navUuid);
  if (!node) {
    throw new Error(`Navigation node not found: ${navUuid}`);
  }
  const current = findParentContainer(roots, navUuid);
  if (!current) {
    throw new Error(`Navigation node is not in the tree: ${navUuid}`);
  }
  current.children.splice(current.index, 1);
  const parent = parentNavUuid === ROOT_NAV_UUID ? null : byNavUuid.get(parentNavUuid);
  if (parentNavUuid !== ROOT_NAV_UUID && (!parent || parent.navType !== 'NAV')) {
    throw new Error(`Target parent is not a group: ${parentNavUuid}`);
  }
  node.parentNavUuid = parentNavUuid;
  (parent ? parent.children : roots).push(node);
}

function reorderPlannedChildren(children, orderedNavUuids, preserveSystem) {
  const byNavUuid = new Map(children.map(node => [node.navUuid, node]));
  const planned = orderedNavUuids.map((navUuid) => {
    const node = byNavUuid.get(navUuid);
    if (!node) {
      throw new Error(`Navigation node is not under the expected parent: ${navUuid}`);
    }
    return node;
  });
  const plannedIds = new Set(orderedNavUuids);
  const system = preserveSystem
    ? children.filter(node => node.navType === 'SYSTEM')
    : [];
  const remaining = children.filter(node => (
    !plannedIds.has(node.navUuid) && (!preserveSystem || node.navType !== 'SYSTEM')
  ));
  return system.concat(planned, remaining);
}

function buildNavigationPlanState(list, resolved) {
  const { roots, byNavUuid } = buildMutableForest(list);
  const expectedOrders = [];
  const expectedRoot = [];
  const moves = [];

  resolved.items.forEach((entry) => {
    if (entry.kind === 'item') {
      expectedRoot.push(entry.node.navUuid);
      if (entry.node.parentNavUuid !== ROOT_NAV_UUID && entry.node.parentNavUuid !== 'appSelf') {
        moves.push({ navUuid: entry.node.navUuid, parentNavUuid: ROOT_NAV_UUID });
      }
      relocateMutableNode(roots, byNavUuid, entry.node.navUuid, ROOT_NAV_UUID);
      return;
    }

    if (!entry.group) {
      throw new Error(`Navigation group is unresolved: ${entry.name}`);
    }
    expectedRoot.push(entry.group.navUuid);
    if (entry.group.parentNavUuid !== ROOT_NAV_UUID && entry.group.parentNavUuid !== 'appSelf') {
      moves.push({ navUuid: entry.group.navUuid, parentNavUuid: ROOT_NAV_UUID });
    }
    relocateMutableNode(roots, byNavUuid, entry.group.navUuid, ROOT_NAV_UUID);
    const childOrder = entry.children.map(node => node.navUuid);
    entry.children.forEach((node) => {
      if (node.parentNavUuid !== entry.group.navUuid) {
        moves.push({ navUuid: node.navUuid, parentNavUuid: entry.group.navUuid });
      }
      relocateMutableNode(roots, byNavUuid, node.navUuid, entry.group.navUuid);
    });
    const mutableGroup = byNavUuid.get(entry.group.navUuid);
    mutableGroup.children = reorderPlannedChildren(mutableGroup.children, childOrder, false);
    expectedOrders.push({
      parentNavUuid: entry.group.navUuid,
      orderedNavUuids: childOrder,
    });
  });

  const reorderedRoots = reorderPlannedChildren(roots, expectedRoot, true);
  expectedOrders.unshift({
    parentNavUuid: ROOT_NAV_UUID,
    orderedNavUuids: expectedRoot,
  });
  return {
    roots: reorderedRoots,
    ids: flattenTreeIds(reorderedRoots),
    moves,
    expectedOrders,
  };
}

function directChildOrder(list, parentNavUuid) {
  const { roots, byNavUuid } = buildMutableForest(list);
  const children = parentNavUuid === ROOT_NAV_UUID
    ? roots
    : (byNavUuid.get(parentNavUuid) || {}).children || [];
  return children
    .filter(node => node.navType !== 'SYSTEM')
    .map(node => node.navUuid);
}

function plannedOrderMatches(actual, expected) {
  return expected.every((navUuid, index) => actual[index] === navUuid);
}

function verifyNavigationPlan(list, resolved) {
  const state = buildNavigationPlanState(list, resolved);
  const mismatches = state.expectedOrders.map((expected) => {
    const actual = directChildOrder(list, expected.parentNavUuid);
    if (plannedOrderMatches(actual, expected.orderedNavUuids)) {
      return null;
    }
    return {
      parentNavUuid: expected.parentNavUuid,
      expected: expected.orderedNavUuids,
      actual,
    };
  }).filter(Boolean);
  return {
    matched: mismatches.length === 0,
    mismatches,
    tree: buildNavigationTree(list),
  };
}

function normalizeComparableText(value) {
  return String(value || '').trim().toLowerCase();
}

function getNavigationPriority(node) {
  const name = normalizeComparableText(getNodeName(node));
  const formType = normalizeComparableText(node.formType);
  const navType = normalizeComparableText(node.navType);

  if (navType === 'system') {
    return 99;
  }

  if (/门户|首页|主页|工作台|入口|总览|概览|home|homepage|portal|workspace|overview/.test(name)) {
    return 0;
  }

  if (formType === 'display') {
    return 1;
  }

  if (formType === 'process') {
    return 2;
  }

  if (['receipt', 'form'].includes(formType)) {
    return 3;
  }

  if (navType === 'nav') {
    return 4;
  }

  return 5;
}

function compareNavigationNodes(a, b) {
  const priorityDiff = getNavigationPriority(a) - getNavigationPriority(b);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const orderA = Number.isFinite(Number(a.listOrder)) ? Number(a.listOrder) : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(Number(b.listOrder)) ? Number(b.listOrder) : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return String(a.id || a.navUuid || '').localeCompare(String(b.id || b.navUuid || ''));
}

function autoOrderRootNodes(list) {
  const { roots } = buildMutableForest(list);
  const systemRoots = roots.filter((node) => node.navType === 'SYSTEM');
  const sortableRoots = roots
    .filter((node) => node.navType !== 'SYSTEM')
    .slice()
    .sort(compareNavigationNodes);

  const orderedRoots = systemRoots.concat(sortableRoots);

  return {
    roots: orderedRoots,
    ids: flattenTreeIds(orderedRoots),
    orderedNavUuids: sortableRoots.map((node) => node.navUuid),
    orderedNodes: sortableRoots.map((node) => ({
      navUuid: node.navUuid,
      formUuid: node.formUuid || null,
      name: getNodeName(node),
      formType: node.formType || '',
      priority: getNavigationPriority(node),
    })),
  };
}

function verifyAutoOrder(list, expectedOrderedNavUuids) {
  const actual = directChildOrder(list, ROOT_NAV_UUID);
  const expected = expectedOrderedNavUuids || [];
  const matched = actual.length === expected.length && plannedOrderMatches(actual, expected);
  return {
    matched,
    expected,
    actual,
  };
}

function countChildren(list, navUuid) {
  return (list || []).filter((node) => node.parentNavUuid === navUuid).length;
}

function loadAuthRef() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new Error('No valid Yida login cache found. Run openyida login first.');
  }
  return authRef;
}

async function fetchNavigationList(appType, authRef) {
  const result = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formnav/getFormNavigationListByOrder.json`,
      {
        _api: 'Nav.queryList',
        _mock: false,
        _locale_time_zone_offset: 28800000,
        _stamp: Date.now(),
      }
    );
  }, authRef);

  if (!result || result.success === false) {
    throw new Error(result ? result.errorMsg || 'Failed to fetch app navigation list' : 'Failed to fetch app navigation list');
  }

  return Array.isArray(result.content) ? result.content : [];
}

async function postNavAction(appType, action, payload, authRef) {
  const endpoints = {
    save: 'saveFormNavigation.json',
    update: 'updateFormNavigation.json',
    updateTitle: 'updateNavigationTitle.json',
    updateOrderNew: 'updateFormNavigationOrderNew.json',
    delete: 'deleteFormNavigation.json',
  };
  const apiNames = {
    save: 'Nav.save',
    update: 'Nav.update',
    updateTitle: 'Nav.updateTitle',
    updateOrderNew: 'Nav.updateOrderNew',
    delete: 'Nav.delete',
  };
  const endpoint = endpoints[action];
  if (!endpoint) {
    throw new Error(`Unknown nav action: ${action}`);
  }

  const result = await requestWithAutoLogin((auth) => {
    const path = `/dingtalk/web/${appType}/query/formnav/${endpoint}` +
      `?_api=${encodeURIComponent(apiNames[action])}` +
      '&_mock=false' +
      `&_stamp=${Date.now()}`;
    return httpPost(auth.baseUrl, path, querystring.stringify(payload));
  }, authRef);

  if (!result || result.success === false) {
    throw new Error(result ? result.errorMsg || `Nav action failed: ${action}` : `Nav action failed: ${action}`);
  }

  return result;
}

function normalizeListOutput(list, options = {}) {
  const includeSystem = options.includeSystem === true;
  return (list || [])
    .filter((node) => includeSystem || node.navType !== 'SYSTEM')
    .map((node) => {
      const normalized = normalizeNavNode(node);
      if (!options.raw) {
        delete normalized.raw;
      }
      return normalized;
    });
}

async function listGroups(appType, flags, authRef) {
  const list = await fetchNavigationList(appType, authRef);
  if (flags.flat) {
    return {
      success: true,
      appType,
      items: normalizeListOutput(list, {
        includeSystem: flags['include-system'],
        raw: flags.raw,
      }),
    };
  }

  return {
    success: true,
    appType,
    tree: buildNavigationTree(list, {
      includeSystem: flags['include-system'],
    }),
  };
}

async function createGroup(appType, name, flags, authRef) {
  if (!name) {
    throw new Error('Group name is required');
  }

  const list = await fetchNavigationList(appType, authRef);
  const parent = resolveNode(list, flags.parent || ROOT_NAV_UUID, { groupOnly: true });
  if (parent.navUuid !== ROOT_NAV_UUID && parent.parentNavUuid !== ROOT_NAV_UUID) {
    throw new Error('New groups can only be created at root or under a top-level group');
  }

  const title = buildI18nTitle(name, flags.en);
  await postNavAction(appType, 'save', {
    parentNavUuid: parent.navUuid,
    title: JSON.stringify(title),
  }, authRef);

  const updatedList = await fetchNavigationList(appType, authRef);
  const created = updatedList
    .filter((node) => node.navType === 'NAV' && getNodeName(node) === name)
    .sort((a, b) => (b.gmtCreate || 0) - (a.gmtCreate || 0))[0];

  return {
    success: true,
    appType,
    action: 'create',
    group: created ? normalizeNavNode(created) : { name, parentNavUuid: parent.navUuid },
  };
}

async function renameGroup(appType, value, name, flags, authRef) {
  if (!value || !name) {
    throw new Error('Usage: openyida nav-group rename <appType> <groupNavUuid|name> <newName>');
  }

  const list = await fetchNavigationList(appType, authRef);
  const group = resolveNode(list, value, { groupOnly: true });
  const title = buildI18nTitle(name, flags.en);
  await postNavAction(appType, 'updateTitle', {
    navUuid: group.navUuid,
    title: JSON.stringify(title),
  }, authRef);

  const updatedList = await fetchNavigationList(appType, authRef);
  const updated = resolveNode(updatedList, group.navUuid, { groupOnly: true });
  return {
    success: true,
    appType,
    action: 'rename',
    group: normalizeNavNode(updated),
  };
}

async function deleteGroup(appType, value, flags, authRef) {
  if (!value) {
    throw new Error('Usage: openyida nav-group delete <appType> <groupNavUuid|name> [--force]');
  }

  const list = await fetchNavigationList(appType, authRef);
  const group = resolveNode(list, value, { groupOnly: true });
  const childrenCount = countChildren(list, group.navUuid);
  if (childrenCount > 0 && !flags.force) {
    throw new Error(`Group is not empty (${childrenCount} children). Move children first or pass --force.`);
  }

  await postNavAction(appType, 'delete', {
    navUuid: group.navUuid,
  }, authRef);

  return {
    success: true,
    appType,
    action: 'delete',
    group: normalizeNavNode(group),
    childrenCount,
  };
}

async function moveNode(appType, value, flags, authRef) {
  if (!value) {
    throw new Error('Usage: openyida nav-group move <appType> <navUuid|formUuid|name> --to <groupNavUuid|groupName|root>');
  }
  if (!flags.to) {
    throw new Error('--to is required');
  }

  const list = await fetchNavigationList(appType, authRef);
  const node = resolveNode(list, value, { excludeSystem: true });
  const targetParent = resolveNode(list, flags.to, { groupOnly: true });
  const before = flags.before ? resolveNode(list, flags.before, { excludeSystem: true }).navUuid : null;
  const after = flags.after ? resolveNode(list, flags.after, { excludeSystem: true }).navUuid : null;

  if (before && after) {
    throw new Error('Use only one of --before or --after');
  }

  const moved = moveNodeInTree(list, node.navUuid, targetParent.navUuid, { before, after });
  await postNavAction(appType, 'updateOrderNew', {
    currentId: node.id,
    parentNavUuid: targetParent.navUuid,
    navType: node.navType,
    ids: moved.ids.join(','),
  }, authRef);

  const updatedList = await fetchNavigationList(appType, authRef);
  const updated = resolveNode(updatedList, node.navUuid, { excludeSystem: true });
  return {
    success: true,
    appType,
    action: 'move',
    node: normalizeNavNode(updated),
    targetParentNavUuid: targetParent.navUuid,
  };
}

async function orderRootNodes(appType, values, authRef) {
  if (!values || values.length === 0) {
    throw new Error('Usage: openyida nav-group order <appType> <navUuid|formUuid|name> [more items...]');
  }

  const list = await fetchNavigationList(appType, authRef);
  const ordered = reorderRootNodes(list, values);
  const firstNode = resolveNode(list, ordered.orderedNavUuids[0], { excludeSystem: true });

  await postNavAction(appType, 'updateOrderNew', {
    currentId: firstNode.id,
    parentNavUuid: ROOT_NAV_UUID,
    navType: firstNode.navType,
    ids: ordered.ids.join(','),
  }, authRef);

  const updatedList = await fetchNavigationList(appType, authRef);
  const orderedNodes = ordered.orderedNavUuids.map((navUuid) => {
    const node = resolveNode(updatedList, navUuid, { excludeSystem: true });
    return {
      navUuid: node.navUuid,
      formUuid: node.formUuid || null,
      name: getNodeName(node),
      formType: node.formType || '',
      priority: getNavigationPriority(node),
    };
  });
  return {
    success: true,
    appType,
    action: 'order',
    targetParentNavUuid: ROOT_NAV_UUID,
    orderedNavUuids: ordered.orderedNavUuids,
    orderedNodes,
  };
}

async function autoOrderNavigation(appType, authRef) {
  const list = await fetchNavigationList(appType, authRef);
  const ordered = autoOrderRootNodes(list);
  if (!ordered.orderedNavUuids.length) {
    return {
      success: true,
      appType,
      action: 'auto-order',
      targetParentNavUuid: ROOT_NAV_UUID,
      orderedNavUuids: [],
      orderedNodes: [],
      skipped: true,
    };
  }

  const firstNode = resolveNode(list, ordered.orderedNavUuids[0], { excludeSystem: true });
  await postNavAction(appType, 'updateOrderNew', {
    currentId: firstNode.id,
    parentNavUuid: ROOT_NAV_UUID,
    navType: firstNode.navType,
    ids: ordered.ids.join(','),
  }, authRef);

  const updatedList = await fetchNavigationList(appType, authRef);
  const verification = verifyAutoOrder(updatedList, ordered.orderedNavUuids);
  if (!verification.matched) {
    throw new Error(`Automatic navigation ordering verification failed: ${JSON.stringify(verification)}`);
  }
  const orderedNodes = ordered.orderedNavUuids.map((navUuid) => normalizeNavNode(
    resolveNode(updatedList, navUuid, { excludeSystem: true })
  ));
  return {
    success: true,
    appType,
    action: 'auto-order',
    targetParentNavUuid: ROOT_NAV_UUID,
    orderedNavUuids: ordered.orderedNavUuids,
    orderedNodes,
    verification,
  };
}

async function setVisibility(appType, value, hidden, authRef) {
  if (!value) {
    throw new Error('Usage: openyida nav-group <hide|show> <appType> <navUuid|formUuid|name>');
  }

  const list = await fetchNavigationList(appType, authRef);
  const node = resolveNode(list, value, { excludeSystem: true });
  const nextHidden = hidden ? 'y' : 'n';
  await postNavAction(appType, 'update', {
    ...node,
    title: JSON.stringify(node.title || node.i18nTitle || buildI18nTitle(getNodeName(node))),
    formUuid: node.formUuid || FORM_UUID_FALLBACK,
    hidden: nextHidden,
    mobileHidden: nextHidden,
  }, authRef);

  const updatedList = await fetchNavigationList(appType, authRef);
  const updated = resolveNode(updatedList, node.navUuid, { excludeSystem: true });
  return {
    success: true,
    appType,
    action: hidden ? 'hide' : 'show',
    node: normalizeNavNode(updated),
  };
}

function readNavigationPlan(planFile) {
  if (!planFile) {
    throw new Error('Usage: openyida nav-group order <appType> --plan <navigation-plan.json>');
  }
  const absolutePath = path.resolve(process.cwd(), planFile);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read navigation plan ${planFile}: ${error.message}`);
  }
  return {
    absolutePath,
    plan: normalizeNavigationPlan(value),
  };
}

async function applyNavigationPlan(appType, planFile, flags, authRef, dependencies = {}) {
  const fetchList = dependencies.fetchNavigationList || fetchNavigationList;
  const createNavigationGroup = dependencies.createGroup || createGroup;
  const postAction = dependencies.postNavAction || postNavAction;
  const input = readNavigationPlan(planFile);
  let list = await fetchList(appType, authRef);
  let resolved = resolveNavigationPlan(list, input.plan);

  if (flags['dry-run']) {
    return {
      success: true,
      appType,
      action: 'order',
      mode: 'plan',
      dryRun: true,
      planFile: input.absolutePath,
      groupsToCreate: resolved.groupsToCreate,
      resolvedItems: resolved.items.map((entry) => (
        entry.kind === 'item'
          ? { parent: 'root', navUuid: entry.node.navUuid, name: getNodeName(entry.node) }
          : {
            parent: entry.name,
            navUuid: entry.group ? entry.group.navUuid : null,
            items: entry.children.map(node => ({ navUuid: node.navUuid, name: getNodeName(node) })),
          }
      )),
      deferred: resolved.deferred,
    };
  }

  const createdGroups = [];
  for (const groupName of resolved.groupsToCreate) {
    const created = await createNavigationGroup(appType, groupName, {}, authRef);
    createdGroups.push(created.group);
  }

  if (resolved.groupsToCreate.length > 0) {
    list = await fetchList(appType, authRef);
  }
  resolved = resolveNavigationPlan(list, input.plan, { requireGroups: true });

  const movedItems = [];
  let desired = buildNavigationPlanState(list, resolved);
  for (const move of desired.moves) {
    const currentNode = resolveNode(list, move.navUuid, { excludeSystem: true });
    const currentParent = currentNode.parentNavUuid === 'appSelf'
      ? ROOT_NAV_UUID
      : currentNode.parentNavUuid || ROOT_NAV_UUID;
    if (currentParent === move.parentNavUuid) {
      continue;
    }
    const moved = moveNodeInTree(list, move.navUuid, move.parentNavUuid);
    await postAction(appType, 'updateOrderNew', {
      currentId: currentNode.id,
      parentNavUuid: move.parentNavUuid,
      navType: currentNode.navType,
      ids: moved.ids.join(','),
    }, authRef);
    movedItems.push({
      navUuid: move.navUuid,
      name: getNodeName(currentNode),
      parentNavUuid: move.parentNavUuid,
    });
    list = await fetchList(appType, authRef);
  }

  resolved = resolveNavigationPlan(list, input.plan, { requireGroups: true });
  desired = buildNavigationPlanState(list, resolved);
  const orderedParents = [];
  for (const expected of desired.expectedOrders) {
    const actual = directChildOrder(list, expected.parentNavUuid);
    if (plannedOrderMatches(actual, expected.orderedNavUuids)) {
      continue;
    }
    const currentDesired = buildNavigationPlanState(list, resolved);
    const firstNode = resolveNode(list, expected.orderedNavUuids[0], { excludeSystem: true });
    await postAction(appType, 'updateOrderNew', {
      currentId: firstNode.id,
      parentNavUuid: expected.parentNavUuid,
      navType: firstNode.navType,
      ids: currentDesired.ids.join(','),
    }, authRef);
    orderedParents.push(expected.parentNavUuid);
    list = await fetchList(appType, authRef);
  }

  resolved = resolveNavigationPlan(list, input.plan, { requireGroups: true });
  const verification = verifyNavigationPlan(list, resolved);
  if (!verification.matched) {
    throw new Error(`Navigation plan verification failed: ${JSON.stringify(verification.mismatches)}`);
  }

  return {
    success: true,
    appType,
    action: 'order',
    mode: 'plan',
    dryRun: false,
    planFile: input.absolutePath,
    createdGroups,
    movedItems,
    orderedParents,
    deferred: resolved.deferred,
    verification,
  };
}

function printUsage() {
  console.error(`
Usage:
  openyida nav-group list <appType> [--flat] [--include-system] [--raw]
  openyida nav-group create <appType> "<groupName>" [--parent <groupNavUuid|groupName>] [--en "<EnglishName>"]
  openyida nav-group rename <appType> <groupNavUuid|groupName> "<newName>" [--en "<EnglishName>"]
  openyida nav-group delete <appType> <groupNavUuid|groupName> [--force]
  openyida nav-group move <appType> <navUuid|formUuid|name> --to <groupNavUuid|groupName|root> [--before <node>] [--after <node>]
  openyida nav-group order <appType> <navUuid|formUuid|name> [more items...]
  openyida nav-group auto-order <appType>
  openyida nav-group order <appType> --plan <navigation-plan.json> [--dry-run]
  openyida nav-group hide <appType> <navUuid|formUuid|name>
  openyida nav-group show <appType> <navUuid|formUuid|name>
`);
}

async function run(args) {
  const subCommand = args[0];
  if (!subCommand || subCommand === '--help' || subCommand === '-h') {
    printUsage();
    return;
  }

  const { positional, flags } = parseArgs(args.slice(1));
  const appType = positional[0];
  if (!appType) {
    printUsage();
    process.exit(1);
  }

  const authRef = loadAuthRef();
  let result;

  if (subCommand === 'list' || subCommand === 'tree') {
    result = await listGroups(appType, flags, authRef);
  } else if (subCommand === 'create' || subCommand === 'add') {
    result = await createGroup(appType, positional[1], flags, authRef);
  } else if (subCommand === 'rename' || subCommand === 'update') {
    result = await renameGroup(appType, positional[1], positional[2], flags, authRef);
  } else if (subCommand === 'delete' || subCommand === 'remove') {
    result = await deleteGroup(appType, positional[1], flags, authRef);
  } else if (subCommand === 'move') {
    result = await moveNode(appType, positional[1], flags, authRef);
  } else if (subCommand === 'order' || subCommand === 'reorder') {
    result = flags.plan
      ? await applyNavigationPlan(appType, flags.plan, flags, authRef)
      : await orderRootNodes(appType, positional.slice(1), authRef);
  } else if (subCommand === 'auto-order' || subCommand === 'autoorder' || subCommand === 'sort') {
    result = await autoOrderNavigation(appType, authRef);
  } else if (subCommand === 'hide') {
    result = await setVisibility(appType, positional[1], true, authRef);
  } else if (subCommand === 'show') {
    result = await setVisibility(appType, positional[1], false, authRef);
  } else {
    throw new Error(`Unknown nav-group subcommand: ${subCommand}`);
  }

  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  ROOT_NAV_UUID,
  applyNavigationPlan,
  autoOrderNavigation,
  autoOrderRootNodes,
  verifyAutoOrder,
  buildI18nTitle,
  buildNavigationTree,
  compareNavigationNodes,
  flattenTreeIds,
  flattenTreeNodes,
  getNavigationPriority,
  moveNodeInTree,
  normalizeNavigationPlan,
  normalizeNavNode,
  orderRootNodes,
  parseArgs,
  reorderRootNodes,
  resolveNavigationPlan,
  resolveLocalizedText,
  resolveNode,
  verifyNavigationPlan,
  buildNavigationPlanState,
  run,
};
