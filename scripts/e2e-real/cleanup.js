#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real');

function getRegistryDir(env = process.env) {
  return env.OPENYIDA_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR;
}

function listRegistries(registryDir = getRegistryDir()) {
  if (!fs.existsSync(registryDir)) {return [];}
  return fs.readdirSync(registryDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const registryPath = path.join(registryDir, file);
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      return { registryPath, registry };
    })
    .sort((a, b) => String(a.registry.startedAt || '').localeCompare(String(b.registry.startedAt || '')));
}

function printSummary(items) {
  if (items.length === 0) {
    console.log('No real E2E registries found.');
    return;
  }

  for (const item of items) {
    const registry = item.registry;
    console.log(`\n${registry.runId || path.basename(item.registryPath)} [${registry.status || 'unknown'}]`);
    console.log(`Registry: ${item.registryPath}`);
    for (const resource of registry.resources || []) {
      const id = resource.appType || resource.formUuid || resource.pageId || 'unknown';
      const secondary = resource.formUuid || resource.pageId || '';
      console.log(`- ${resource.type}: ${id}${secondary && secondary !== id ? ` / ${secondary}` : ''} ${resource.name || ''}`);
    }
  }

  console.log('\nOpenYida does not yet expose a safe app/form deletion command, so this script lists disposable resources recorded by real E2E runs for manual cleanup.');
}

function isPathInside(parentPath, childPath) {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function ownershipResult(resource, options) {
  const runId = options.runId;
  const namePrefix = options.namePrefix || `${runId}__`;
  if (!resource || resource.runId !== runId) {
    return { owned: false, relevant: false, reason: 'different_run' };
  }
  if (resource.owned !== true) {
    return { owned: false, relevant: true, reason: 'owned_flag_missing' };
  }
  if (!resource.name || !String(resource.name).startsWith(namePrefix)) {
    return { owned: false, relevant: true, reason: 'name_prefix_mismatch' };
  }
  return { owned: true, relevant: true, reason: null };
}

function cleanupOwnedResources(options = {}) {
  const registry = options.registry || { resources: [] };
  const runId = options.runId;
  const namePrefix = options.namePrefix || `${runId}__`;
  const localRoot = options.localRoot;
  const removePath = options.removePath || function removeOwnedPath(targetPath) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  };
  const removed = [];
  const residual = [];
  const skipped = [];

  if (!runId || !localRoot) {
    throw new Error('cleanupOwnedResources requires runId and localRoot');
  }

  (registry.resources || []).slice().reverse().forEach(function (resource) {
    const ownership = ownershipResult(resource, { runId, namePrefix });
    if (!ownership.owned) {
      skipped.push({ resource, reason: ownership.reason, blocksCleanup: ownership.relevant });
      return;
    }

    if (resource.type !== 'local-artifact') {
      residual.push({ resource, reason: 'remote_cleanup_unsupported' });
      return;
    }

    const targetPath = resource.path || resource.exactId;
    if (!targetPath || !isPathInside(localRoot, targetPath)) {
      skipped.push({ resource, reason: 'local_path_outside_run_root', blocksCleanup: true });
      return;
    }

    removePath(targetPath);
    removed.push({ resource, path: targetPath });
  });

  const blocked = residual.length > 0 || skipped.some(function (item) { return item.blocksCleanup; });
  return {
    status: blocked ? 'cleanup_blocked' : 'passed',
    removed,
    residual,
    skipped,
  };
}

function run(options = {}) {
  const registryDir = options.registryDir || getRegistryDir(options.env || process.env);
  const items = listRegistries(registryDir);
  printSummary(items);
  return items;
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  cleanupOwnedResources,
  getRegistryDir,
  isPathInside,
  listRegistries,
  ownershipResult,
  run,
};
