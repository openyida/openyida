'use strict';

const fs = require('fs');
const path = require('path');
const { flattenCommandManifest } = require('./command-manifest');

function describeTask(tokens, entries = flattenCommandManifest()) {
  const match = entries.flatMap(entry => [entry.path, ...(entry.aliases || []).map(alias => alias.split(' '))]
    .map(parts => ({ entry, parts })))
    .filter(({ parts }) => parts.every((part, i) => tokens[i] === part))
    .sort((a, b) => b.parts.length - a.parts.length)[0];
  const entry = match?.entry;
  const policy = entry?.taskConcurrency;
  const args = tokens.slice(match?.parts.length || 1);
  const barrier = { barrier: true, locks: [], requiresLogin: entry?.requiresLogin !== false };
  if (!policy || policy.forbiddenFlags?.some(flag => args.some(arg => arg.split('=')[0] === flag))) { return barrier; }
  if (policy.kind === 'read') { return { ...barrier, barrier: false }; }
  if (policy.kind !== 'page' || !args[policy.sourcePosition] || args[policy.sourcePosition].startsWith('-')) { return barrier; }
  let source, stat;
  try { source = fs.realpathSync(args[policy.sourcePosition]); stat = fs.statSync(source); } catch { return barrier; }
  if (!stat.isFile()) { return barrier; }
  const stems = [source, args[policy.sourcePosition]].map(file =>
    path.parse(file).name.replace(/(?:\.(?:oyd|openyida|yida))+$/i, '').toLowerCase());
  // Both compilers write to the shared pages/build and pages/dist directories.
  // Inode identity also protects different symlinks/hard links to the same source.
  const locks = [`source:${stat.dev}:${stat.ino}`, ...new Set(stems.map(stem => `page-output:${stem}`))];
  if (policy.appPosition !== undefined) {
    const app = args[policy.appPosition], form = args[policy.formPosition];
    if (!/^APP_[A-Z0-9]+$/i.test(app || '') || !/^FORM-[A-Z0-9]+$/i.test(form || '')) { return barrier; }
    locks.push(`page:${app.toLowerCase()}:${form.toLowerCase()}`);
  }
  return { ...barrier, barrier: false, locks };
}

async function runTaskWave(tasks, options, execute) {
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 4) {
    throw new RangeError('Task concurrency must be an integer from 1 to 4.');
  }
  const pending = tasks.map((task, index) => ({ task, index }));
  const active = new Map(), results = new Array(tasks.length);
  let peakConcurrency = 0, stopped = false;
  const started = Date.now();
  const launch = ({ task, index }) => {
    const promise = Promise.resolve().then(() => execute(task, index)).catch(error => ({
      command: task.tokens.join(' '), success: false, exitCode: 1, error: error.message,
    })).then(result => {
      results[index] = result;
      if (!result.success && options.stopOnError) { stopped = true; }
    }).finally(() => active.delete(index));
    active.set(index, { policy: task.policy, promise });
    peakConcurrency = Math.max(peakConcurrency, active.size);
  };
  while ((!stopped && pending.length) || active.size) {
    for (let i = 0; !stopped && i < pending.length && active.size < options.concurrency;) {
      const next = pending[i];
      if (next.task.policy.barrier) {
        if (!active.size) { launch(pending.splice(i, 1)[0]); }
        break;
      }
      if ([...active.values()].some(item => item.policy.barrier)) { break; }
      if ([...active.values()].some(item => item.policy.locks.some(lock => next.task.policy.locks.includes(lock)))) { i++; continue; }
      launch(pending.splice(i, 1)[0]);
    }
    if (active.size) { await Promise.race([...active.values()].map(item => item.promise)); }
  }
  return { results: results.filter(Boolean), stopped, skipped: pending.length,
    concurrency: options.concurrency, peakConcurrency, elapsed: Date.now() - started };
}

function buildTaskExecutionPolicy(env = process.env) {
  const allowed = env.OPENYIDA_MANAGED_RUN !== '1';
  return {
    scope: 'single_orchestrator_independent_ready_tasks',
    cli_batch: { available: allowed, command: 'openyida batch <file> --concurrency 3 --json',
      default_concurrency: 1, max_concurrency: 4,
      ...(allowed ? {} : { reason: 'generic_batch_not_admitted_in_managed_run' }) },
    delegation: { status: 'host_tool_inventory_required', optional: true,
      use_for: ['independent analysis', 'page authoring', 'visual design', 'verification'],
      required_checks: ['actual tool name and input schema', 'allowed agent types and tools',
        'parallel tool-call support OR nonblocking dispatch with retrievable task results'],
      handoff: ['confirmed requirements and theme', 'input files and dependencies', 'exclusive output files',
        'actual app/page identities', 'required skill instructions or accessible references', 'completion and verification criteria'],
      rules: ['Use available subagents for independent reasoning/authoring branches; ready CLI work can run directly.',
        'A delegation tool alone does not prove concurrent dispatch. Blocking delegation needs verified parallel tool calls; nonblocking delegation needs real handles and result retrieval.',
        'The orchestrator joins results only at dependencies, owns shared settings and verifies outputs. Do not assume inherited skills or credentials.'],
    },
    forms: 'openyida create-form batch <appType> <plan.json> --concurrency 3 --json',
    rules: ['Only batch tasks whose inputs and resource IDs are ready. Put dependent work in a later batch.',
      'Audited reads and independent page compile/publish tasks may overlap. Same page/source/output conflicts wait; other commands are serial barriers.',
      'Stop-on-error stops queued work and waits for already running tasks. Inspect each result before retrying any remote write.',
      'When generic batch is not admitted, use audited command-family batches or actual host parallel tool calls if available. Never bypass managed scope.',
      'CLI task concurrency does not require background Agent or parallel sessions. Background shell is a separate optional host capability.'],
  };
}

module.exports = { describeTask, runTaskWave, buildTaskExecutionPolicy };
