#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const {
  COMMAND_GROUPS,
  flattenCommandManifest,
  listCommandPermissionIds,
  listCommandSideEffectIds,
} = require('../lib/core/command-manifest');

const ROOT = path.resolve(__dirname, '..');
const ROUTER_FILE = path.join(ROOT, 'bin/yida.js');
const README_FILE = path.join(ROOT, 'README.md');

const errors = [];

function toRelative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function commandRoot(value) {
  return String(value || '').trim().split(/\s+/)[0];
}

function collectRouterCases() {
  const text = fs.readFileSync(ROUTER_FILE, 'utf8');
  const cases = new Set();
  const pattern = /case '([^']+)'\s*:/g;
  let match = pattern.exec(text);
  while (match) {
    cases.add(match[1]);
    match = pattern.exec(text);
  }
  return cases;
}

function collectManifestRoots(commands) {
  const roots = new Set();
  for (const entry of commands) {
    roots.add(entry.path[0]);
    for (const alias of entry.aliases || []) {
      roots.add(commandRoot(alias));
    }
  }
  return roots;
}

function validateUniqueIds(commands) {
  const seen = new Set();
  for (const entry of commands) {
    if (seen.has(entry.id)) {
      errors.push(`Duplicate command manifest id: ${entry.id}`);
    }
    seen.add(entry.id);
  }
}

function validateRouterCoverage(commands) {
  const routerCases = collectRouterCases();
  const manifestRoots = collectManifestRoots(commands);

  for (const routerCase of [...routerCases].sort()) {
    if (!manifestRoots.has(routerCase)) {
      errors.push(`${toRelative(ROUTER_FILE)}: route case "${routerCase}" is missing from command manifest roots or aliases`);
    }
  }

  for (const root of [...manifestRoots].sort()) {
    if (!routerCases.has(root)) {
      errors.push(`${toRelative(ROUTER_FILE)}: command manifest root/alias "${root}" has no route case`);
    }
  }
}

function validateReadmeCoverage(commands) {
  const readme = fs.readFileSync(README_FILE, 'utf8');
  const visibleRoots = new Set(commands.filter(entry => !entry.hidden).map(entry => entry.path[0]));

  for (const root of [...visibleRoots].sort()) {
    const pattern = new RegExp(`openyida\\s+${escapeRegExp(root)}(\\s|\`|$)`);
    if (!pattern.test(readme)) {
      errors.push(`${toRelative(README_FILE)}: visible command root "${root}" is missing from CLI reference`);
    }
  }
}

function validateGroupReferences() {
  const commands = new Set(flattenCommandManifest().map(entry => entry.id));
  for (const group of COMMAND_GROUPS) {
    for (const commandId of group.commands.map(entry => entry.id)) {
      if (!commands.has(commandId)) {
        errors.push(`Command group "${group.id}" references unknown command id "${commandId}"`);
      }
    }
  }
}

function validateSideEffects(commands) {
  const allowedKinds = new Set(['local_read', 'local_write', 'remote_read', 'remote_write', 'mixed']);
  const commandIds = new Set(commands.map(entry => entry.id));

  for (const sideEffectId of listCommandSideEffectIds()) {
    if (!commandIds.has(sideEffectId)) {
      errors.push(`Side effect metadata references unknown command id: ${sideEffectId}`);
    }
  }

  for (const entry of commands) {
    const sideEffect = entry.sideEffect;
    if (!sideEffect || typeof sideEffect !== 'object') {
      errors.push(`Command manifest id "${entry.id}" is missing sideEffect metadata`);
      continue;
    }
    if (!allowedKinds.has(sideEffect.kind)) {
      errors.push(`Command manifest id "${entry.id}" has invalid sideEffect.kind "${sideEffect.kind}"`);
    }
    if (typeof sideEffect.mutates_yida !== 'boolean') {
      errors.push(`Command manifest id "${entry.id}" sideEffect.mutates_yida must be boolean`);
    }
    if (typeof sideEffect.mutates_local !== 'boolean') {
      errors.push(`Command manifest id "${entry.id}" sideEffect.mutates_local must be boolean`);
    }
    if (sideEffect.kind === 'mixed') {
      if (sideEffect.action_dependent !== true) {
        errors.push(`Command manifest id "${entry.id}" mixed sideEffect.action_dependent must be true`);
      }
      if (!Array.isArray(sideEffect.read_actions)) {
        errors.push(`Command manifest id "${entry.id}" mixed sideEffect.read_actions must be an array`);
      }
      if (!Array.isArray(sideEffect.mutating_actions)) {
        errors.push(`Command manifest id "${entry.id}" mixed sideEffect.mutating_actions must be an array`);
      }
    }
  }
}

function validatePermissions(commands) {
  const allowedModes = new Set(['allow', 'ask', 'deny']);
  const allowedEffects = new Set(['read', 'write', 'external', 'destructive', 'unknown']);
  const commandIds = new Set(commands.map(entry => entry.id));

  for (const permissionId of listCommandPermissionIds()) {
    if (!commandIds.has(permissionId)) {
      errors.push(`Permission metadata references unknown command id: ${permissionId}`);
    }
  }

  for (const entry of commands) {
    const permission = entry.permission;
    if (!permission || typeof permission !== 'object') {
      errors.push(`Command manifest id "${entry.id}" is missing permission metadata`);
      continue;
    }
    if (!allowedModes.has(permission.mode)) {
      errors.push(`Command manifest id "${entry.id}" has invalid permission.mode "${permission.mode}"`);
    }
    if (!allowedEffects.has(permission.effect)) {
      errors.push(`Command manifest id "${entry.id}" has invalid permission.effect "${permission.effect}"`);
    }
    if (permission.mode === 'ask' && permission.effect !== 'destructive') {
      errors.push(`Command manifest id "${entry.id}" permission.mode ask must use permission.effect destructive`);
    }
    if (permission.effect === 'destructive' && permission.mode !== 'ask') {
      errors.push(`Command manifest id "${entry.id}" permission.effect destructive must use permission.mode ask`);
    }
    if (permission.mode === 'allow' && permission.effect === 'unknown' && permission.action_dependent !== true) {
      errors.push(`Command manifest id "${entry.id}" permission.mode allow with unknown effect must be action-dependent`);
    }
    if (entry.sideEffect && entry.sideEffect.kind === 'mixed') {
      if (permission.action_dependent !== true) {
        errors.push(`Command manifest id "${entry.id}" mixed permission.action_dependent must be true`);
      }
      if (!Array.isArray(permission.read_actions)) {
        errors.push(`Command manifest id "${entry.id}" mixed permission.read_actions must be an array`);
      }
      if (!Array.isArray(permission.ask_actions)) {
        errors.push(`Command manifest id "${entry.id}" mixed permission.ask_actions must be an array`);
      }
      if (permission.mode === 'allow' && !Object.prototype.hasOwnProperty.call(permission, 'ask_actions')) {
        errors.push(`Command manifest id "${entry.id}" mixed allow permission must explicitly define ask_actions`);
      }
    }
    if (Array.isArray(permission.ask_actions)) {
      for (const action of permission.ask_actions) {
        if (typeof action !== 'string' || !action.trim()) {
          errors.push(`Command manifest id "${entry.id}" permission.ask_actions entries must be non-empty strings`);
        }
      }
    }
  }
}

function run() {
  const commands = flattenCommandManifest();

  validateUniqueIds(commands);
  validateGroupReferences();
  validateRouterCoverage(commands);
  validateReadmeCoverage(commands);
  validateSideEffects(commands);
  validatePermissions(commands);

  if (errors.length > 0) {
    console.error('Command manifest validation failed:');
    for (const error of errors) {
      console.error('  error ' + error);
    }
    process.exit(1);
  }

  console.log(`Command manifest OK: ${commands.length} entries aligned with router and README`);
}

run();
