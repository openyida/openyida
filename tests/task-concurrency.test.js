'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describeTask, runTaskWave, buildTaskExecutionPolicy } = require('../lib/core/task-concurrency');
const { flattenCommandManifest, buildCommandManifest } = require('../lib/core/command-manifest');

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const task = (id, locks = [], barrier = false) => ({ id, tokens: [id], policy: { locks, barrier } });
const success = id => ({ command: id, success: true, exitCode: 0 });

test('invalid scheduler limits fail instead of leaving a queued wave stuck', async () => {
  await expect(runTaskWave([task('0')], { concurrency: 0 }, () => success('0'))).rejects.toThrow(RangeError);
});

test('ready tasks overlap, obey the limit and retain input order', async () => {
  const started = [], releases = [deferred(), deferred(), deferred()];
  const running = runTaskWave([task('0'), task('1'), task('2')], { concurrency: 2 }, async item => {
    started.push(item.id); await releases[Number(item.id)].promise; return success(item.id);
  });
  await tick(); expect(started).toEqual(['0', '1']);
  releases[1].resolve(); await tick(); expect(started).toEqual(['0', '1', '2']);
  releases[2].resolve(); releases[0].resolve();
  const result = await running;
  expect(result.peakConcurrency).toBe(2);
  expect(result.results.map(item => item.command)).toEqual(['0', '1', '2']);
});

test('conflicting writes wait, while a different resource can proceed', async () => {
  const releases = [deferred(), deferred(), deferred()]; const started = [];
  const running = runTaskWave([task('0', ['page:a']), task('1', ['page:a']), task('2', ['page:b'])], { concurrency: 3 }, async item => {
    started.push(item.id); await releases[Number(item.id)].promise; return success(item.id);
  });
  await tick(); expect(started).toEqual(['0', '2']);
  releases[0].resolve(); await tick(); expect(started).toEqual(['0', '2', '1']);
  releases[1].resolve(); releases[2].resolve(); await running;
});

test('an unaudited command is a barrier before and after independent work', async () => {
  const releases = [deferred(), deferred(), deferred()]; const started = [];
  const running = runTaskWave([task('0'), task('1', [], true), task('2')], { concurrency: 3 }, async item => {
    started.push(item.id); await releases[Number(item.id)].promise; return success(item.id);
  });
  await tick(); expect(started).toEqual(['0']);
  releases[0].resolve(); await tick(); expect(started).toEqual(['0', '1']);
  releases[1].resolve(); await tick(); expect(started).toEqual(['0', '1', '2']);
  releases[2].resolve(); await running;
});

test('stop-on-error skips queued work but drains running mutations', async () => {
  const release = deferred(); const started = [];
  const running = runTaskWave([task('0'), task('1'), task('2')], { concurrency: 2, stopOnError: true }, async item => {
    started.push(item.id);
    if (item.id === '0') { return { success: false, exitCode: 1 }; }
    await release.promise; return success(item.id);
  });
  await tick(); expect(started).toEqual(['0', '1']);
  let finished = false; running.then(() => { finished = true; });
  await tick(); expect(finished).toBe(false);
  release.resolve();
  expect(await running).toMatchObject({ stopped: true, skipped: 1, results: [{ success: false }, { success: true }] });
});

test('manifest policies protect page targets, output collisions, aliases and global settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-wave-'));
  try {
    const a = path.join(root, 'a.jsx'), b = path.join(root, 'b.jsx');
    fs.writeFileSync(a, 'a'); fs.writeFileSync(b, 'b');
    const publish = (src, form, extra = []) => describeTask(['publish', src, 'APP_TEST', form, ...extra]);
    const first = publish(a, 'FORM-A'), second = publish(b, 'FORM-A');
    expect(first.barrier).toBe(false);
    expect(first.locks.filter(key => second.locks.includes(key))).toEqual(['page:app_test:form-a']);
    expect(publish(a, 'FORM-A', ['--auto-nav-order']).barrier).toBe(true);
    expect(publish(a, 'FORM-A', ['--open=true']).barrier).toBe(true);
    expect(describeTask(['update-app', 'APP_TEST']).barrier).toBe(true);
    expect(describeTask(['get-schema', 'APP_TEST', '--all', '--output-dir=schemas']).barrier).toBe(true);
    expect(describeTask(['get-schema', 'APP_TEST', 'FORM-A']).barrier).toBe(false);
    const folder = path.join(root, 'nested'); fs.mkdirSync(folder);
    const alias = path.join(folder, 'b.jsx'); fs.symlinkSync(a, alias);
    const aliasPolicy = publish(alias, 'FORM-B');
    expect(aliasPolicy.locks).toContain(first.locks[0]);
    expect(aliasPolicy.locks.filter(key => describeTask(['compile', b]).locks.includes(key))).toContain('page-output:b');
    expect(describeTask(['check-page', a]).locks).toContain(first.locks[0]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('command aliases use their actual matched length for resource arguments', () => {
  const policy = describeTask(['inspect', '--output-dir', 'shared'], [{
    path: ['schema', 'inspect'], aliases: ['inspect'], requiresLogin: false,
    taskConcurrency: { kind: 'read', forbiddenFlags: ['--output-dir'] },
  }]);
  expect(policy).toMatchObject({ barrier: true, requiresLogin: false });
});

test('capability and manifest preserve managed admission and distinguish task execution', () => {
  expect(buildTaskExecutionPolicy({})).toMatchObject({ scope: 'single_orchestrator_independent_ready_tasks', cli_batch: { available: true, max_concurrency: 4 } });
  expect(buildTaskExecutionPolicy({}).delegation).toMatchObject({ status: 'host_tool_inventory_required', optional: true });
  expect(buildTaskExecutionPolicy({ OPENYIDA_MANAGED_RUN: '1' }).cli_batch).toMatchObject({ available: false });
  const manifest = flattenCommandManifest();
  expect(manifest.find(entry => entry.id === 'batch').managedRun.scope).toBe('denied');
  expect(manifest.find(entry => entry.id === 'publish').managedRun.mutation.operation).toBe('publish_page');
  const localized = buildCommandManifest({ t: value => value, version: 'test' });
  expect(localized.commands.find(entry => entry.id === 'publish').task_concurrency).toMatchObject({ kind: 'page' });
});
