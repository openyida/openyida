#!/usr/bin/env node

'use strict';

/**
 * Generation eval 的稳定 Schema snapshot 与差异计算（纯函数、零副作用）。
 */

const VOLATILE_KEYS = new Set([
  'createdAt',
  'createTime',
  'finishedAt',
  'gmtCreate',
  'gmtModified',
  'modifiedAt',
  'requestId',
  'startedAt',
  'timestamp',
  'traceId',
  'updatedAt',
  'updateTime',
]);

const ID_KEYS = [
  'id',
  'fieldId',
  'formUuid',
  'pageId',
  'processCode',
  'reportId',
  'integrationId',
  'permissionId',
  'name',
  'label',
];

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {return JSON.stringify(value);}
  if (Array.isArray(value)) {return `[${value.map(stableStringify).join(',')}]`;}
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function resourceKey(item, index = 0, typeHint = '') {
  if (!item || typeof item !== 'object') {return `${typeHint || 'value'}:${index}`;}
  const type = item.type || item.resourceType || typeHint || 'resource';
  for (const key of ID_KEYS) {
    if (item[key] !== undefined && item[key] !== null && String(item[key])) {
      return `${type}:${key}:${String(item[key])}`;
    }
  }
  return `${type}:index:${index}`;
}

function normalizeSchemaValue(value, options = {}) {
  const volatileKeys = options.volatileKeys || VOLATILE_KEYS;
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeSchemaValue(item, options));
    if (normalized.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      return normalized.sort((a, b) => resourceKey(a).localeCompare(resourceKey(b)));
    }
    return normalized;
  }
  if (!value || typeof value !== 'object') {return value;}
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (volatileKeys.has(key)) {continue;}
    out[key] = normalizeSchemaValue(value[key], options);
  }
  return out;
}

function snapshotResources(snapshot) {
  if (!snapshot) {return [];}
  if (Array.isArray(snapshot)) {return snapshot;}
  if (Array.isArray(snapshot.resources)) {return snapshot.resources;}

  const collectionKeys = ['apps', 'forms', 'pages', 'processes', 'reports', 'integrations', 'permissions', 'fields'];
  const resources = [];
  for (const key of collectionKeys) {
    if (!Array.isArray(snapshot[key])) {continue;}
    const singular = key.endsWith('ies') ? `${key.slice(0, -3)}y` : key.replace(/s$/, '');
    for (const item of snapshot[key]) {
      resources.push(item && typeof item === 'object' && !item.type ? { type: singular, ...item } : item);
    }
  }
  return resources.length ? resources : [snapshot];
}

function normalizeSchemaSnapshot(snapshot, options = {}) {
  return snapshotResources(snapshot)
    .map((item) => normalizeSchemaValue(item, options))
    .map((item, index) => ({ key: resourceKey(item, index), value: item }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function diffSchemaSnapshots(before, after, options = {}) {
  const beforeItems = normalizeSchemaSnapshot(before, options);
  const afterItems = normalizeSchemaSnapshot(after, options);
  const beforeMap = new Map(beforeItems.map((item) => [item.key, item.value]));
  const afterMap = new Map(afterItems.map((item) => [item.key, item.value]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, value] of afterMap) {
    if (!beforeMap.has(key)) {added.push({ key, after: value });}
  }
  for (const [key, value] of beforeMap) {
    if (!afterMap.has(key)) {removed.push({ key, before: value });}
  }
  for (const [key, beforeValue] of beforeMap) {
    if (!afterMap.has(key)) {continue;}
    const afterValue = afterMap.get(key);
    if (stableStringify(beforeValue) !== stableStringify(afterValue)) {
      changed.push({ key, before: beforeValue, after: afterValue });
    }
  }

  return {
    added,
    removed,
    changed,
    summary: { added: added.length, removed: removed.length, changed: changed.length },
  };
}

function checkExpectedSchemaDiff(diff = {}, expected = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, required: true, detail });
  const summary = diff.summary || {
    added: (diff.added || []).length,
    removed: (diff.removed || []).length,
    changed: (diff.changed || []).length,
  };

  for (const kind of ['Added', 'Removed', 'Changed']) {
    const value = summary[kind.toLowerCase()] || 0;
    const minProp = `min${kind}`;
    const maxProp = `max${kind}`;
    if (Number.isFinite(expected[minProp])) {
      add(`schemaDiff:${minProp}`, value >= expected[minProp], `期望 ≥${expected[minProp]}，实际 ${value}`);
    }
    if (Number.isFinite(expected[maxProp])) {
      add(`schemaDiff:${maxProp}`, value <= expected[maxProp], `期望 ≤${expected[maxProp]}，实际 ${value}`);
    }
  }

  const keysFor = (kind) => new Set((diff[kind] || []).map((item) => item.key));
  for (const kind of ['added', 'removed', 'changed']) {
    const expectedKeys = expected[`${kind}Keys`];
    if (!Array.isArray(expectedKeys)) {continue;}
    const actualKeys = keysFor(kind);
    for (const key of expectedKeys) {
      add(`schemaDiff:${kind}:${key}`, actualKeys.has(key), actualKeys.has(key) ? '命中' : '未命中');
    }
  }
  if (Array.isArray(expected.stableKeys)) {
    const unstable = new Set([
      ...(diff.removed || []).map((item) => item.key),
      ...(diff.changed || []).map((item) => item.key),
    ]);
    for (const key of expected.stableKeys) {
      add(`schemaDiff:stable:${key}`, !unstable.has(key), unstable.has(key) ? '发生了非预期变化' : '保持稳定');
    }
  }

  return { pass: checks.every((check) => check.ok), checks };
}

module.exports = {
  VOLATILE_KEYS,
  ID_KEYS,
  stableStringify,
  resourceKey,
  normalizeSchemaValue,
  snapshotResources,
  normalizeSchemaSnapshot,
  diffSchemaSnapshots,
  checkExpectedSchemaDiff,
};
