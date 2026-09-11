'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildMutation,
  createRunId,
  run,
  selectTarget,
} = require('../scripts/e2e-real/permission/runner');

function packageFixture(operatePermit = '{"OPERATE_VIEW":"y"}') {
  return {
    packageUuid: 'PKG-TARGET',
    packageType: 'FORM_PACKAGE_VIEW',
    packageName: { zh_CN: '默认组' },
    description: { zh_CN: '默认组' },
    roleMembers: [{ roleType: 'DEFAULT' }],
    roleData: '{"include":[{"roleType":"DEFAULT","roleValue":"ALL"}]}',
    dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
    operatePermit,
    customButtonPermit: '[]',
    fieldPermit: '{"fieldRange":"FORM"}',
    viewData: '{"all":"y","viewUuids":[]}',
  };
}

function createHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-permission-e2e-'));
  const runId = 'OY_PERM_TEST_20260825000000000_a1b2c3';
  const before = packageFixture();
  let current = structuredClone(before);
  const calls = { mutate: [], restore: [], read: 0 };
  const config = {
    enabled: true,
    missing: [],
    runId,
    namePrefix: `${runId}__`,
    registryDir: root,
  };
  const candidate = {
    appType: 'APP-TARGET',
    formUuid: 'FORM-TARGET',
    package: structuredClone(before),
  };
  const options = {
    config,
    workDir: path.join(root, runId),
    exclusionEvidence: {
      excludedIds: new Set(),
      processResidualCount: 29,
      integrationResidualCount: 6,
      sourceCount: 2,
    },
    discoverCandidates: async () => ({
      candidates: [candidate],
      counts: { appsScanned: 2, formsScanned: 3, permissionCandidates: 1 },
    }),
    readPackages: async () => {
      calls.read += 1;
      return [structuredClone(current)];
    },
    mutate: async (_target, mutation) => {
      calls.mutate.push(mutation);
      current.operatePermit = JSON.stringify(mutation.expectedOperatePermit);
      return { success: true };
    },
    restore: async (_target, restorePackage) => {
      calls.restore.push(structuredClone(restorePackage));
      current = structuredClone(restorePackage);
      return { success: true };
    },
  };
  return {
    before,
    calls,
    candidate,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
    config,
    getCurrent: () => current,
    options,
    root,
  };
}

describe('permission real E2E runner', () => {
  test('creates collision-resistant permission run ids', () => {
    const id = createRunId(new Date('2026-08-25T00:00:00.000Z'), () => Buffer.from('a1b2c3', 'hex'));
    expect(id).toBe('OY_PERM_20260825000000000_a1b2c3');
  });

  test('selects a deterministic non-residual target', () => {
    const candidates = [
      { appType: 'APP-B', formUuid: 'FORM-B', package: packageFixture() },
      { appType: 'APP-A', formUuid: 'FORM-A', package: packageFixture() },
    ];
    const selected = selectTarget(candidates, new Set(['FORM-A']));
    expect(selected.appType).toBe('APP-B');
    expect(selected.formUuid).toBe('FORM-B');
  });

  test('accepts omitted packageType only because discovery queried FORM_PACKAGE_VIEW', () => {
    const permitPackage = packageFixture();
    delete permitPackage.packageType;
    const selected = selectTarget([{
      appType: 'APP-A',
      formUuid: 'FORM-A',
      package: permitPackage,
    }], new Set());
    expect(selected.package.packageType).toBeUndefined();
  });

  test('builds a one-key action mutation that remains non-empty', () => {
    const mutation = buildMutation(packageFixture());
    expect(mutation.operation).toBe('OPERATE_COMMENT');
    expect(mutation.beforeOperatePermit).toEqual({ OPERATE_VIEW: 'y' });
    expect(mutation.expectedOperatePermit).toEqual({
      OPERATE_VIEW: 'y',
      OPERATE_COMMENT: 'y',
    });
  });

  test('persists a complete pre-write manifest before invoking mutate', async () => {
    const harness = createHarness();
    const originalMutate = harness.options.mutate;
    let preWriteManifest = null;
    harness.options.mutate = async (target, mutation) => {
      const manifestPath = path.join(harness.options.workDir, 'acceptance-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      preWriteManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(preWriteManifest).toMatchObject({
        runId: harness.config.runId,
        status: 'running',
        target: {
          role: 'DEFAULT',
          packageType: 'FORM_PACKAGE_VIEW',
        },
        sample: {
          dimension: 'operatePermit',
          operation: 'OPERATE_COMMENT',
        },
        resourceCounts: {
          created: 0,
          mutated: 0,
          restored: 0,
          permissionCandidates: 1,
        },
        ownership: {
          status: 'passed',
          runIdMatched: true,
          ownedFlag: true,
          namePrefixMatched: true,
          ownedResourceCount: 1,
        },
        mutation: { status: 'pre_write', exactReadback: false },
      });
      return originalMutate(target, mutation);
    };
    try {
      await expect(run(harness.options)).resolves.toMatchObject({ status: 'passed' });
      expect(preWriteManifest).not.toBeNull();
    } finally {
      harness.cleanup();
    }
  });

  test('mutates once, exact-readbacks, and restores only operatePermit', async () => {
    const harness = createHarness();
    try {
      const result = await run(harness.options);
      expect(result.status).toBe('passed');
      expect(harness.calls.mutate).toHaveLength(1);
      expect(harness.calls.restore).toHaveLength(1);
      expect(harness.calls.read).toBe(4);
      expect(harness.getCurrent()).toEqual(harness.before);
      expect(harness.calls.restore[0]).toMatchObject({
        dataPermit: harness.before.dataPermit,
        roleData: harness.before.roleData,
        fieldPermit: harness.before.fieldPermit,
        operatePermit: harness.before.operatePermit,
      });
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest).toMatchObject({
        runId: harness.config.runId,
        status: 'passed',
        resourceCounts: {
          created: 0,
          mutated: 1,
          restored: 1,
          processResidualsExcluded: 29,
          integrationResidualsExcluded: 6,
        },
        restore: { status: 'passed', exactReadback: true },
        cleanup: { status: 'passed', ownedResidualCount: 0 },
      });
      expect(JSON.stringify(manifest)).not.toContain('APP-TARGET');
      expect(JSON.stringify(manifest)).not.toContain('FORM-TARGET');
      expect(JSON.stringify(manifest)).not.toContain('PKG-TARGET');
    } finally {
      harness.cleanup();
    }
  });

  test('fails before mutation when exact before no longer matches selection', async () => {
    const harness = createHarness();
    harness.options.readPackages = async () => [packageFixture('{"OPERATE_EDIT":"y"}')];
    try {
      await expect(run(harness.options)).rejects.toMatchObject({
        code: 'PERMISSION_E2E_BEFORE_CHANGED',
      });
      expect(harness.calls.mutate).toHaveLength(0);
      expect(harness.calls.restore).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test('blocks restore instead of overwriting a non-owned concurrent change', async () => {
    const harness = createHarness();
    const originalRead = harness.options.readPackages;
    harness.options.readPackages = async () => {
      const packages = await originalRead();
      if (harness.calls.read === 3) {
        packages[0].operatePermit = '{"OPERATE_EDIT":"y"}';
      }
      return packages;
    };
    try {
      await expect(run(harness.options)).rejects.toMatchObject({
        code: 'PERMISSION_E2E_RESTORE_OWNERSHIP_LOST',
      });
      expect(harness.calls.restore).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test('blocks restore when the runner-owned resource metadata is no longer provable', async () => {
    const harness = createHarness();
    let ownershipCorrupted = false;
    harness.options.writeJson = (filePath, value) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      if (!ownershipCorrupted
        && path.basename(filePath) === 'registry.json'
        && value.mutation.status === 'passed') {
        value.resources[0].owned = false;
        ownershipCorrupted = true;
      }
      return filePath;
    };
    try {
      await expect(run(harness.options)).rejects.toMatchObject({
        code: 'PERMISSION_E2E_RESTORE_OWNERSHIP_UNPROVEN',
      });
      expect(ownershipCorrupted).toBe(true);
      expect(harness.calls.mutate).toHaveLength(1);
      expect(harness.calls.restore).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });
});
