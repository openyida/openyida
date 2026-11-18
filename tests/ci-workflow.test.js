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

  test('isolates Windows parent-lifetime probes and runs each isolated suite exactly once', () => {
    const steps = workflow.jobs.test.steps;
    const probes = steps.find(step => step.name === 'Run Windows process probes');
    const remaining = steps.find(step => step.name === 'Run remaining Windows tests');
    expect(probes.if).toBe("runner.os == 'Windows'");
    expect(probes.run.split(/\s+/)).toContain('--runInBand');
    const serialSuites = probes.run.split('--runTestsByPath ')[1].trim().split(/\s+/);
    const excludedSuites = remaining.run.split('--testPathIgnorePatterns ')[1].trim().split(/\s+/);
    expect(serialSuites).toContain('tests/agent-parent-watch.test.js');
    expect(new Set(serialSuites).size).toBe(serialSuites.length);
    expect(excludedSuites.slice().sort()).toEqual(serialSuites.slice().sort());
    expect(remaining.if).toBe("(success() || failure()) && runner.os == 'Windows'");
  });
});
