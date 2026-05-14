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
  getRegistryDir,
  listRegistries,
  run,
};
