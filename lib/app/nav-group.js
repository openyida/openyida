'use strict';

const querystring = require('querystring');
const {
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef, isAuthRefReady } = require('../core/yida-client');
const { CliError } = require('../core/cli-error');
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
    if (['json', 'tree', 'flat', 'force', 'include-system', 'raw'].includes(key)) {
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

function snapshotNavigationRoots(roots) {
  const snapshot = [];

  const visit = (nodes, parentNavUuid) => {
    (nodes || []).forEach((node, siblingIndex) => {
      snapshot.push({
        navUuid: node.navUuid,
        parentNavUuid,
        siblingIndex,
        navType: node.navType || '',
      });
      visit(node.children || [], node.navUuid);
    });
  };

  visit(roots || [], ROOT_NAV_UUID);
  return snapshot;
}

function buildNavigationSnapshot(list) {
  return snapshotNavigationRoots(buildMutableForest(list).roots);
}

function navigationSnapshotsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    return other &&
      item.navUuid === other.navUuid &&
      item.parentNavUuid === other.parentNavUuid &&
      item.siblingIndex === other.siblingIndex &&
      item.navType === other.navType;
  });
}

function findFirstNavigationDifference(actual, expected) {
  const actualItems = Array.isArray(actual) ? actual : [];
  const expectedItems = Array.isArray(expected) ? expected : [];
  const length = Math.max(actualItems.length, expectedItems.length);

  for (let index = 0; index < length; index++) {
    const actualItem = actualItems[index] || null;
    const expectedItem = expectedItems[index] || null;
    if (!actualItem || !expectedItem ||
      actualItem.navUuid !== expectedItem.navUuid ||
      actualItem.parentNavUuid !== expectedItem.parentNavUuid ||
      actualItem.siblingIndex !== expectedItem.siblingIndex ||
      actualItem.navType !== expectedItem.navType) {
      return {
        index,
        actual: actualItem,
        expected: expectedItem,
      };
    }
  }

  return null;
}

function summarizeNavigationOrderDiff(code, beforeOrder, expectedOrder, observedOrder) {
  const hasObservedOrder = Array.isArray(observedOrder);
  return {
    beforeCount: Array.isArray(beforeOrder) ? beforeOrder.length : 0,
    expectedCount: Array.isArray(expectedOrder) ? expectedOrder.length : 0,
    observedCount: hasObservedOrder ? observedOrder.length : null,
    firstPlannedChange: findFirstNavigationDifference(beforeOrder, expectedOrder),
    ...(code === 'NAV_ORDER_READBACK_MISMATCH' && hasObservedOrder
      ? { firstReadbackMismatch: findFirstNavigationDifference(observedOrder, expectedOrder) }
      : {}),
  };
}

function buildNavigationOrderPlan(list, ordered) {
  const beforeOrder = buildNavigationSnapshot(list);
  const expectedOrder = snapshotNavigationRoots(ordered.roots);
  return {
    beforeOrder,
    expectedOrder,
    targetNavUuids: ordered.orderedNavUuids.slice(),
    changed: !navigationSnapshotsEqual(beforeOrder, expectedOrder),
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

async function postNavAction(appType, action, payload, authRef, options = {}) {
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

  const requestFn = (auth) => {
    const path = `/dingtalk/web/${appType}/query/formnav/${endpoint}` +
      `?_api=${encodeURIComponent(apiNames[action])}` +
      '&_mock=false' +
      `&_stamp=${Date.now()}`;
    return httpPost(auth.baseUrl, path, querystring.stringify(payload));
  };
  const result = options.oneShot === true
    ? await requestFn(authRef)
    : await requestWithAutoLogin(requestFn, authRef);

  if (!result || result.success === false || result.__needLogin || result.__csrfExpired) {
    throw new Error(result ? result.errorMsg || `Nav action failed: ${action}` : `Nav action failed: ${action}`);
  }

  return result;
}

function buildNavigationOrderSuccess(appType, action, ordered, observedList, plan, recoveredByReadback) {
  const orderedNodes = ordered.orderedNavUuids.map((navUuid) => normalizeNavNode(
    resolveNode(observedList, navUuid, { excludeSystem: true })
  ));
  return {
    success: true,
    appType,
    action,
    targetParentNavUuid: ROOT_NAV_UUID,
    changed: plan.changed,
    alreadyApplied: !plan.changed,
    mutationPerformed: plan.changed,
    readbackVerified: true,
    recoveredByReadback: recoveredByReadback === true,
    sideEffectState: plan.changed ? 'committed' : 'none',
    orderedNavUuids: ordered.orderedNavUuids,
    orderedNodes,
    skipped: !plan.changed,
  };
}

function buildNavigationOrderError(code, appType, action, plan, observedOrder, cause) {
  const sideEffectState = code === 'NAV_ORDER_NOT_APPLIED' ? 'none' : 'unknown';
  const retrySafe = code === 'NAV_ORDER_NOT_APPLIED';
  const readbackVerified = code === 'NAV_ORDER_NOT_APPLIED';
  const status = code === 'NAV_ORDER_NOT_APPLIED'
    ? 'NOT_APPLIED'
    : code === 'NAV_ORDER_READBACK_MISMATCH'
      ? 'SEMANTIC_FAILURE'
      : 'RESULT_UNKNOWN';
  return new CliError(code, {
    code,
    details: {
      target: {
        type: 'navigationOrder',
        appType,
        action,
        navUuids: plan.targetNavUuids,
      },
      changed: plan.changed,
      ...(code === 'NAV_ORDER_NOT_APPLIED' ? { mutationPerformed: false } : {}),
      readbackVerified,
      retryable: retrySafe,
      retrySafe,
      sideEffectState,
      status,
      readbackAllowed: true,
      orderDiff: summarizeNavigationOrderDiff(
        code,
        plan.beforeOrder,
        plan.expectedOrder,
        observedOrder
      ),
      cause: cause && cause.message ? cause.message : undefined,
      nextStep: `openyida nav-group list ${appType} --flat`,
    },
  });
}

async function applyNavigationOrder(appType, action, list, ordered, authRef, dependencies = {}) {
  const fetchList = dependencies.fetchNavigationList || fetchNavigationList;
  const postAction = dependencies.postNavAction || postNavAction;
  const plan = buildNavigationOrderPlan(list, ordered);

  if (!plan.changed) {
    return buildNavigationOrderSuccess(appType, action, ordered, list, plan, false);
  }

  const firstNode = resolveNode(list, ordered.orderedNavUuids[0], { excludeSystem: true });
  let mutationError = null;
  try {
    await postAction(appType, 'updateOrderNew', {
      currentId: firstNode.id,
      parentNavUuid: ROOT_NAV_UUID,
      navType: firstNode.navType,
      ids: ordered.ids.join(','),
    }, authRef, { oneShot: true });
  } catch (error) {
    mutationError = error;
  }

  let updatedList;
  try {
    updatedList = await fetchList(appType, authRef);
  } catch (readbackError) {
    throw buildNavigationOrderError(
      'NAV_ORDER_RESULT_UNKNOWN',
      appType,
      action,
      plan,
      null,
      readbackError
    );
  }

  const observedOrder = buildNavigationSnapshot(updatedList);
  if (navigationSnapshotsEqual(observedOrder, plan.expectedOrder)) {
    return buildNavigationOrderSuccess(appType, action, ordered, updatedList, plan, !!mutationError);
  }
  if (navigationSnapshotsEqual(observedOrder, plan.beforeOrder)) {
    throw buildNavigationOrderError(
      'NAV_ORDER_NOT_APPLIED',
      appType,
      action,
      plan,
      observedOrder,
      mutationError
    );
  }
  throw buildNavigationOrderError(
    'NAV_ORDER_READBACK_MISMATCH',
    appType,
    action,
    plan,
    observedOrder,
    mutationError
  );
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
  return applyNavigationOrder(appType, 'order', list, ordered, authRef);
}

async function autoOrderNavigation(appType, authRef) {
  const list = await fetchNavigationList(appType, authRef);
  const ordered = autoOrderRootNodes(list);
  if (!ordered.orderedNavUuids.length) {
    const plan = buildNavigationOrderPlan(list, ordered);
    return buildNavigationOrderSuccess(appType, 'auto-order', ordered, list, plan, false);
  }
  return applyNavigationOrder(appType, 'auto-order', list, ordered, authRef);
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
    result = await orderRootNodes(appType, positional.slice(1), authRef);
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
  applyNavigationOrder,
  autoOrderNavigation,
  autoOrderRootNodes,
  buildNavigationOrderPlan,
  buildNavigationSnapshot,
  buildI18nTitle,
  buildNavigationTree,
  compareNavigationNodes,
  flattenTreeIds,
  flattenTreeNodes,
  getNavigationPriority,
  moveNodeInTree,
  normalizeNavNode,
  navigationSnapshotsEqual,
  orderRootNodes,
  parseArgs,
  reorderRootNodes,
  resolveLocalizedText,
  resolveNode,
  run,
};
