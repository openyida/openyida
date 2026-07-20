'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildDefaultPageDataSource,
  buildNativePageSchemaContent,
  extractPageDataSource,
  mergePageDataSource,
} = require('../lib/app/services/native-page-schema-builder');
const { compileNativePageSource } = require('../lib/app/services/native-page-compiler');
const { compileCanvasPageSource } = require('../lib/app/services/canvas-page-compiler');
const {
  buildDataSourceOnlyCanvasPagePatch,
  buildDataSourceOnlyNativePagePatch,
  computeDataSourceOnlyShellFingerprint,
  createDataSourceOnlyShellProfile,
  projectDataSourceOnlyShell,
} = require('../lib/schema/page-data-source-builder');
const { projectCanvasPageSchema } = require('../lib/schema/page-canvas-foundation');
const { loadPageSource } = require('../lib/schema/page-source-loader');
const { hashStable } = require('../lib/schema/state-store');

const PAGE_TITLE = 'Synthetic Page';
const PAGE_BINDING = 'FORM-SYNTHETIC';
const SOURCE = 'export default function Page() { return <div>Offline</div>; }\n';
const CANVAS_SOURCE = 'import React from "react";\nexport default function Page() { return <div>Canvas</div>; }\n';

describe('native page data-source shell builder', () => {
  let compiledPage;
  let compiledCanvasPage;
  let initialProfile;
  let initialSchema;
  let workspace;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-page-builder-'));
    const sourcePath = path.join(workspace, 'pages', 'home.oyd.jsx');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, SOURCE, 'utf8');
    fs.writeFileSync(path.join(workspace, 'pages', 'home.canvas.jsx'), CANVAS_SOURCE, 'utf8');
    compiledPage = compileNativePageSource(loadPageSource('pages/home.oyd.jsx', {
      workspaceRoot: workspace,
    }));
    compiledCanvasPage = compileCanvasPageSource(loadPageSource('pages/home.canvas.jsx', {
      workspaceRoot: workspace,
    }));
    initialSchema = makeInitialSchema();
    initialProfile = createDataSourceOnlyShellProfile({
      fingerprint: computeDataSourceOnlyShellFingerprint(initialSchema),
      profileId: 'synthetic-data-source-shell-v1',
    });
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('projects only a privately branded exact data-source shell', () => {
    expect(projectInitial()).toMatchObject({
      classification: 'PAGE_CREATED',
      managed: {
        formType: 'display',
        profile: 'native/default',
        title: PAGE_TITLE,
      },
      remoteSchemaHash: remoteSchemaHash(initialSchema),
    });
    expect(() => projectInitial({
      shellProfile: clone(initialProfile),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_INITIAL_PROFILE_REQUIRED',
    }));
  });

  test('normalizes only the approved root timestamp path', () => {
    const changed = clone(initialSchema);
    changed.gmtModified += 1;
    expect(computeDataSourceOnlyShellFingerprint(changed))
      .toBe(computeDataSourceOnlyShellFingerprint(initialSchema));
    expect(projectInitial({ schema: changed }).remoteSchemaHash)
      .toBe(projectInitial().remoteSchemaHash);

    changed.pages[0].componentsTree[0].dataSource.globalConfig.gmtModified = 1;
    expect(() => projectInitial({ schema: changed })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT',
    }));
  });

  test.each([
    ['extra root key', schema => { schema.extra = true; }],
    ['second page', schema => { schema.pages.push(clone(schema.pages[0])); }],
    ['second tree entry', schema => {
      schema.pages[0].componentsTree.push(clone(schema.pages[0].componentsTree[0]));
    }],
    ['actions', schema => { schema.actions = {}; }],
    ['Page component', schema => { schema.pages[0].componentsTree[0].componentName = 'Page'; }],
    ['Jsx component', schema => {
      schema.pages[0].componentsTree[0].children = [{ componentName: 'Jsx' }];
    }],
    ['unknown data-source key', schema => {
      schema.pages[0].componentsTree[0].dataSource.unknown = {};
    }],
    ['data-source mutation', schema => {
      schema.pages[0].componentsTree[0].dataSource.globalConfig.fit.type = 'ts';
    }],
    ['status mutation', schema => { schema.status = 'DRAFT'; }],
  ])('rejects unsupported initial-shell drift: %s', (label, mutate) => {
    const changed = clone(initialSchema);
    mutate(changed);
    expect(label).toBeTruthy();
    expect(() => projectInitial({ schema: changed })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT',
    }));
  });

  test('never treats an existing saved native page as an initial shell', () => {
    const saved = JSON.parse(buildNativePageSchemaContent(
      compiledPage.source,
      compiledPage.compiled,
      PAGE_BINDING,
      {
        nextNodeId: deterministicFactory('node'),
        nextSuffix: deterministicFactory('suffix'),
      }
    ));

    expect(() => projectInitial({ schema: saved })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT',
    }));
  });

  test('builds a deterministic frozen patch without stdout or filesystem writes', () => {
    const beforeFiles = listFiles(workspace);
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    let first;
    let second;
    try {
      first = buildPatch();
      second = buildPatch();
    } finally {
      stdout.mockRestore();
    }

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      initialRemoteSchemaHash: remoteSchemaHash(initialSchema),
      preparedRemoteSchemaHash: hashStable(first.schema),
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.schema)).toBe(true);
    expect(listFiles(workspace)).toEqual(beforeFiles);
    expect(stdout).not.toHaveBeenCalled();
  });

  test('preserves the approved initial data source plus only legacy builder additions', () => {
    const patch = buildPatch();
    const initial = initialSchema.pages[0].componentsTree[0].dataSource;
    const expected = mergePageDataSource(initial, buildDefaultPageDataSource(PAGE_BINDING));

    expect(extractPageDataSource(patch.schema)).toEqual(expected);
    expect(patch.initialDataSourceHash).toBe(hashStable(initial));
    expect(patch.preparedDataSourceHash).toBe(hashStable(expected));
  });

  test('builds a deterministic Canvas patch from the approved initial shell', () => {
    const patch = buildDataSourceOnlyCanvasPagePatch({
      compiledPage: compiledCanvasPage,
      expectedInitialRemoteSchemaHash: remoteSchemaHash(initialSchema),
      formUuid: PAGE_BINDING,
      observedFormType: 'display',
      observedTitle: PAGE_TITLE,
      operationId: hashStable({ operation: 'page:create:canvas' }),
      remoteSchema: initialSchema,
      shellProfile: initialProfile,
    });
    const projection = projectCanvasPageSchema({
      observedFormType: 'display',
      observedTitle: PAGE_TITLE,
      schema: patch.schema,
    });

    expect(patch).toMatchObject({
      initialRemoteSchemaHash: remoteSchemaHash(initialSchema),
      preparedRemoteSchemaHash: projection.remoteSchemaHash,
    });
    expect(Object.isFrozen(patch)).toBe(true);
    expect(Object.isFrozen(patch.schema)).toBe(true);
    expect(projection.managed).toEqual({
      compiledHash: compiledCanvasPage.compiledHash,
      formType: 'display',
      profile: 'canvas/default',
      sourceHash: compiledCanvasPage.sourceHash,
      title: PAGE_TITLE,
    });
  });

  test('rejects stale full-Schema hash and observed identity drift', () => {
    expect(() => buildPatch({
      expectedInitialRemoteSchemaHash: hashStable({ stale: true }),
    })).toThrow(expect.objectContaining({ code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT' }));
    expect(() => buildPatch({
      expectedManagedHash: hashStable({
        compiledHash: compiledPage.compiledHash,
        formType: 'display',
        profile: 'native/default',
        sourceHash: compiledPage.sourceHash,
        title: PAGE_TITLE,
      }),
      observedTitle: 'Other',
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT',
    }));
    expect(() => buildPatch({ observedFormType: 'receipt' })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_OBSERVED_IDENTITY_INVALID',
    }));
  });

  function projectInitial(overrides = {}) {
    return projectDataSourceOnlyShell({
      observedFormType: 'display',
      observedTitle: PAGE_TITLE,
      schema: initialSchema,
      shellProfile: initialProfile,
      ...overrides,
    });
  }

  function buildPatch(overrides = {}) {
    return buildDataSourceOnlyNativePagePatch({
      compiledPage,
      expectedInitialRemoteSchemaHash: remoteSchemaHash(initialSchema),
      formUuid: PAGE_BINDING,
      observedFormType: 'display',
      observedTitle: PAGE_TITLE,
      operationId: hashStable({ operation: 'page:create' }),
      remoteSchema: initialSchema,
      shellProfile: initialProfile,
      ...overrides,
    });
  }
});

function makeInitialSchema() {
  return {
    gmtModified: 1,
    i18nData: [],
    pages: [{
      componentsTree: [{
        dataSource: {
          globalConfig: clone(buildDefaultPageDataSource('FORM-FOUNDATION').globalConfig),
          list: [],
          offline: [],
          online: [],
          sync: true,
        },
      }],
    }],
    status: 'ONLINE',
  };
}

function remoteSchemaHash(schema) {
  const normalized = clone(schema);
  delete normalized.gmtModified;
  return hashStable(normalized);
}

function listFiles(root) {
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      for (const child of listFiles(target)) {
        result.push(`${entry.name}/${child}`);
      }
    } else {
      result.push(entry.name);
    }
  }
  return result.sort();
}

function deterministicFactory(prefix) {
  let counter = 0;
  return () => `${prefix}${++counter}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
