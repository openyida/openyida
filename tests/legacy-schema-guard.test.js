'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  assertLegacyDirectWriteAllowed,
  extractLegacyGuardArgs,
} = require('../lib/core/legacy-schema-guard');

describe('legacy schema-managed guard', () => {
  test('strips guard-only arguments before command parsing', () => {
    const split = extractLegacyGuardArgs([
      'pages/src/home.oyd.jsx',
      'APP_TEST',
      'FORM-PAGE',
      '--schema-state',
      '.cache/openyida/state.v1.json',
      '--resource-context={"app":{"appType":"APP_TEST"}}',
    ]);

    expect(split.args).toEqual(['pages/src/home.oyd.jsx', 'APP_TEST', 'FORM-PAGE']);
    expect(split.guardOptions.statePaths).toEqual(['.cache/openyida/state.v1.json']);
    expect(split.guardOptions.contextInputs).toHaveLength(1);
  });

  test('explicit schema-managed flag fails closed for legacy writes', () => {
    const split = extractLegacyGuardArgs(['--schema-managed']);

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'publish',
      resourceType: 'page',
      action: 'update',
      appType: 'APP_TEST',
      formUuid: 'FORM-PAGE',
    }, { guardOptions: split.guardOptions })).toThrow(expect.objectContaining({
      code: 'LEGACY_SCHEMA_MANAGED_GUARD',
    }));
  });

  test('schema-managed resource context blocks matching publish target', () => {
    const context = JSON.stringify({
      kind: 'openyida_resource_context',
      page: {
        formUuid: 'FORM-PAGE',
        schemaManaged: true,
      },
    });

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'publish',
      resourceType: 'page',
      action: 'update',
      appType: 'APP_TEST',
      formUuid: 'FORM-PAGE',
    }, {
      guardOptions: { contextInputs: [context] },
      env: {},
    })).toThrow(expect.objectContaining({
      code: 'LEGACY_SCHEMA_MANAGED_GUARD',
    }));
  });

  test('schema-managed app context blocks direct writes under that app', () => {
    const context = JSON.stringify({
      app: {
        appType: 'APP_MANAGED',
        schemaManaged: true,
      },
    });

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'create-form update',
      resourceType: 'form',
      action: 'update',
      appType: 'APP_MANAGED',
      formUuid: 'FORM-DATA',
    }, {
      guardOptions: { contextInputs: [context] },
      env: {},
    })).toThrow(expect.objectContaining({
      code: 'LEGACY_SCHEMA_MANAGED_GUARD',
    }));
  });

  test('schema state exact identity match blocks legacy process write', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-legacy-guard-'));
    const statePath = path.join(tmpDir, 'state.v1.json');
    fs.writeFileSync(statePath, JSON.stringify({
      kind: 'openyida_resource_state',
      contractVersion: 1,
      revision: 1,
      resources: {
        process: {
          approval: {
            bindings: {
              appType: 'APP_TEST',
              formUuid: 'FORM-PROC',
              processCode: 'TPROC-TEST',
            },
          },
        },
      },
    }));

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'configure-process',
      resourceType: 'process',
      action: 'update',
      appType: 'APP_TEST',
      formUuid: 'FORM-PROC',
      processCode: 'TPROC-TEST',
    }, {
      guardOptions: { statePaths: [statePath] },
      env: {},
    })).toThrow(expect.objectContaining({
      code: 'LEGACY_SCHEMA_MANAGED_GUARD',
    }));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('schema state child resource matches require exact child identity within the same app', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-legacy-guard-'));
    const statePath = path.join(tmpDir, 'state.v1.json');
    fs.writeFileSync(statePath, JSON.stringify({
      kind: 'openyida_resource_state',
      contractVersion: 1,
      revision: 1,
      resources: {
        form: {
          visitor: {
            bindings: {
              appType: 'APP_TEST',
              formUuid: 'FORM-MANAGED',
            },
          },
        },
        page: {
          home: {
            bindings: {
              appType: 'APP_TEST',
              formUuid: 'FORM-PAGE-MANAGED',
            },
          },
        },
        process: {
          approval: {
            bindings: {
              appType: 'APP_TEST',
              formUuid: 'FORM-PROC-MANAGED',
              processCode: 'TPROC-MANAGED',
            },
          },
        },
      },
    }));

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'create-form update',
      resourceType: 'form',
      action: 'update',
      appType: 'APP_TEST',
      formUuid: 'FORM-OTHER',
    }, {
      guardOptions: { statePaths: [statePath] },
      env: {},
    })).not.toThrow();

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'publish',
      resourceType: 'page',
      action: 'update',
      appType: 'APP_TEST',
      formUuid: 'FORM-PAGE-OTHER',
    }, {
      guardOptions: { statePaths: [statePath] },
      env: {},
    })).not.toThrow();

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'configure-process',
      resourceType: 'process',
      action: 'update',
      appType: 'APP_TEST',
      formUuid: 'FORM-PROC-OTHER',
      processCode: 'TPROC-OTHER',
    }, {
      guardOptions: { statePaths: [statePath] },
      env: {},
    })).not.toThrow();

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'configure-process',
      resourceType: 'process',
      action: 'update',
      appType: 'APP_TEST',
      formUuid: 'FORM-PROC-MANAGED',
      processCode: 'TPROC-OTHER',
    }, {
      guardOptions: { statePaths: [statePath] },
      env: {},
    })).not.toThrow();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('bound page context blocks accidental create-page but nonmatching state is allowed', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-legacy-guard-'));
    const statePath = path.join(tmpDir, 'state.v1.json');
    fs.writeFileSync(statePath, JSON.stringify({
      kind: 'openyida_resource_state',
      contractVersion: 1,
      revision: 1,
      resources: {
        page: {
          other: {
            bindings: {
              appType: 'APP_OTHER',
              formUuid: 'FORM-OTHER',
            },
          },
        },
      },
    }));

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'publish',
      resourceType: 'page',
      action: 'update',
      appType: 'APP_TEST',
      formUuid: 'FORM-PAGE',
    }, {
      guardOptions: { statePaths: [statePath] },
      env: {},
    })).not.toThrow();

    expect(() => assertLegacyDirectWriteAllowed({
      command: 'create-page',
      resourceType: 'page',
      action: 'create',
      appType: 'APP_TEST',
    }, {
      guardOptions: {
        contextInputs: [JSON.stringify({
          page: {
            formUuid: 'FORM-PAGE',
            allowCreate: false,
          },
        })],
      },
      env: {},
    })).toThrow(expect.objectContaining({
      code: 'LEGACY_RESOURCE_CONTEXT_CONFLICT',
    }));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
