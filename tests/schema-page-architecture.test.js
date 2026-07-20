'use strict';

const fs = require('fs');
const path = require('path');
const {
  createApplyOperationId,
  createApplyJournal,
  updateJournalOperation,
} = require('../lib/schema/apply-store');
const { createDefaultRegistry } = require('../lib/schema/resource-registry');
const { hashStable } = require('../lib/schema/state-store');

const ROOT = path.resolve(__dirname, '..');
const FORBIDDEN_CONTROL_NAMES = /page-(?:bootstrap|continuation|practical|provenance|recovery|trust)/;
const LEGACY_PUBLISH_ORCHESTRATION = Object.freeze([
  'lib/app/publish.js',
  'lib/auth/login.js',
  'lib/core/browser-handoff.js',
  'lib/core/utils.js',
]);

describe('live page architecture surface', () => {
  test('schema command reaches the default page adapter without a second control plane', () => {
    const graph = collectRelativeRequireGraph(path.join(ROOT, 'lib', 'schema', 'command.js'));
    const relative = [...graph].map(file => normalizePath(path.relative(ROOT, file))).sort();

    expect(relative).toContain('lib/schema/resource-registry.js');
    expect(relative).toContain('lib/schema/adapters/page-adapter.js');
    expect(relative).toContain('lib/schema/page-canvas-foundation.js');
    expect(relative).toContain('lib/schema/page-source-loader.js');
    expect(relative).toContain('lib/schema/page-foundation.js');
    expect(relative).toContain('lib/schema/page-data-source-builder.js');
    expect(relative).toContain('lib/app/canvas-compile.js');
    expect(relative).toContain('lib/app/services/canvas-page-compiler.js');
    expect(relative).toContain('lib/app/services/canvas-page-schema-builder.js');
    expect(relative).toContain('lib/app/services/native-page-schema-builder.js');
    expect(relative).toContain('lib/app/services/native-page-compiler.js');
    expect(relative).toContain('lib/app/services/page-resource-service.js');
    expect(relative).not.toContain('lib/app/publish.js');
    expect(relative.filter(file => FORBIDDEN_CONTROL_NAMES.test(file))).toEqual([]);
  });

  test('native page Schema builder has no legacy CLI, auth, browser, or network orchestration', () => {
    const graph = collectRelativeRequireGraph(
      path.join(ROOT, 'lib', 'app', 'services', 'native-page-schema-builder.js')
    );
    const relative = [...graph].map(file => normalizePath(path.relative(ROOT, file))).sort();

    expect(relative).toEqual([
      'lib/app/services/native-page-schema-builder.js',
      'lib/formula/field-refs.js',
    ]);
    for (const forbidden of LEGACY_PUBLISH_ORCHESTRATION) {
      expect(relative).not.toContain(forbidden);
    }
    expect(fs.readFileSync(
      path.join(ROOT, 'lib', 'schema', 'page-data-source-builder.js'),
      'utf8'
    )).not.toContain("require('../app/publish')");
  });

  test('schema page modules contain only the reviewed low-level live surface', () => {
    const schemaDirectory = path.join(ROOT, 'lib', 'schema');
    const modules = fs.readdirSync(schemaDirectory)
      .filter(name => /^page-.*\.js$/.test(name))
      .sort();

    expect(modules).toEqual([
      'page-canvas-foundation.js',
      'page-data-source-builder.js',
      'page-foundation.js',
      'page-source-loader.js',
    ]);
    for (const removed of [
      'page-practical-runtime-provider.js',
      'page-provenance-bootstrap.js',
      'page-recovery.js',
      'page-trust-ceremony.js',
    ]) {
      expect(fs.existsSync(path.join(schemaDirectory, removed))).toBe(false);
    }
  });

  test('default page adapter exposes no provider, claim, lease, or page-specific journal broker', () => {
    const registry = createDefaultRegistry();
    const adapter = registry.get('page');
    const source = fs.readFileSync(path.join(ROOT, 'lib', 'schema', 'adapters', 'page-adapter.js'), 'utf8');

    expect(registry.listTypes()).toEqual(['app', 'form', 'page', 'process']);
    for (const property of ['claim', 'lease', 'provider', 'runtimeLease']) {
      expect(Object.prototype.hasOwnProperty.call(adapter, property)).toBe(false);
    }
    expect(source).not.toMatch(FORBIDDEN_CONTROL_NAMES);
    expect(source).not.toContain('journalPath');
    expect(source).not.toContain('pageRecovery');
  });

  test('generic journal rejects the removed pageRecovery payload', () => {
    const environment = { endpoint: 'https://example.test', corpId: 'corp-test' };
    const registry = createDefaultRegistry();
    const journal = createApplyJournal({
      environment,
      manifestHash: hashStable({ manifest: true }),
      planId: hashStable({ plan: true }),
      registry,
    });

    expect(() => updateJournalOperation(journal, {
      operationId: createApplyOperationId({
        planId: journal.planId,
        resourceType: 'page',
        key: 'home',
        operation: 'create',
      }),
      resourceType: 'page',
      key: 'home',
      operation: 'create',
      adapterVersion: 1,
      desiredHash: hashStable({ desired: true }),
      status: 'pending',
      pageRecovery: { stage: 'PAGE_CREATED' },
    }, { environment, registry })).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    }));
  });

  test('legacy page command modules remain present', () => {
    for (const relative of [
      'lib/app/create-page.js',
      'lib/app/compile.js',
      'lib/app/publish.js',
      'lib/page-config/get-page-config.js',
      'lib/page-config/save-share-config.js',
    ]) {
      expect(fs.existsSync(path.join(ROOT, relative))).toBe(true);
    }
  });
});

function collectRelativeRequireGraph(entry) {
  const visited = new Set();

  function visit(file) {
    const resolved = resolveModuleFile(file);
    if (!resolved || visited.has(resolved)) {
      return;
    }
    visited.add(resolved);
    const source = fs.readFileSync(resolved, 'utf8');
    const pattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (match[1].startsWith('.')) {
        visit(path.resolve(path.dirname(resolved), match[1]));
      }
    }
  }

  visit(entry);
  return visited;
}

function resolveModuleFile(candidate) {
  for (const target of [candidate, `${candidate}.js`, path.join(candidate, 'index.js')]) {
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      return fs.realpathSync(target);
    }
  }
  return null;
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}
