'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { findDuplicateSourceMismatches } = require('../lib/app/publish');

describe('publish prechecks', () => {
  let workspace;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-publish-precheck-'));
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('detects project and artifacts copies with the same name but different content', () => {
    const projectRoot = path.join(workspace, 'project');
    const projectSourceDir = path.join(projectRoot, 'pages', 'src');
    const artifactDir = path.join(workspace, 'projects', 'demo-id', 'artifacts');
    fs.mkdirSync(projectSourceDir, { recursive: true });
    fs.mkdirSync(artifactDir, { recursive: true });

    const sourcePath = path.join(projectSourceDir, 'dashboard.jsx');
    const artifactPath = path.join(artifactDir, 'dashboard.jsx');
    fs.writeFileSync(sourcePath, 'export function renderJsx() { return <div>A</div>; }\n', 'utf8');
    fs.writeFileSync(artifactPath, 'export function renderJsx() { return <div>B</div>; }\n', 'utf8');

    const mismatches = findDuplicateSourceMismatches(sourcePath, projectRoot);

    expect(mismatches).toEqual([
      { sourcePath, duplicatePath: artifactPath },
    ]);
  });
});
