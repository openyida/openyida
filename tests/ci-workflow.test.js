'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const workflow = yaml.load(fs.readFileSync(path.join(__dirname, '../.github/workflows/ci.yml'), 'utf8'));

describe('CI workflow triggers', () => {
  test('validates PRs targeting main and stacked release branches', () => {
    expect(workflow.on).toHaveProperty('pull_request');
    const pullRequest = workflow.on.pull_request || {};
    expect(pullRequest).not.toHaveProperty('branches');
    expect(pullRequest).not.toHaveProperty('branches-ignore');
    expect(pullRequest).not.toHaveProperty('types');
  });

  test('keeps branch pushes restricted to main', () => {
    expect(workflow.on.push).toEqual({ branches: ['main'] });
  });

  test('does not grant extra permissions or run privileged PR events', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.on).not.toHaveProperty('pull_request_target');
  });
});
