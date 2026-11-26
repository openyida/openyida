'use strict';

const fs = require('fs');
const path = require('path');
const { fail, readRecipe, safePath, sha256 } = require('./files');
const { requireWorkspaceRecipe } = require('./workspace-app');

const VERSION = 'yida-workspace-v1';
const DIGEST = 'dfeeb732000f03c026debcb310b4bd837a8e10179036d371a0c1d3da3a58131e';
const PATHS = ['README.md', 'project.json', 'src/main.tsx', 'src/styles/app.css', 'workspace.lock.json'];

function readWorkspaceTemplate() {
  const raw = fs.readFileSync(path.join(__dirname, 'templates', VERSION + '.json'));
  if (sha256(raw) !== DIGEST) {
    fail('WORKSPACE starter integrity check failed', 'CODE_WORKSPACE_TEMPLATE_INTEGRITY_ERROR');
  }
  const { version, files: source } = JSON.parse(raw.toString('utf8'));
  if (version !== VERSION || !source || Object.keys(source).length !== PATHS.length ||
      PATHS.some(name => typeof source[name] !== 'string')) {
    fail('WORKSPACE starter is invalid', 'CODE_WORKSPACE_TEMPLATE_INTEGRITY_ERROR');
  }
  const files = Object.fromEntries(PATHS.map(name => [safePath(name), Buffer.from(source[name], 'utf8')]));
  requireWorkspaceRecipe(readRecipe('', files));
  return { version, files };
}

module.exports = { readWorkspaceTemplate };
