'use strict';

const fs = require('fs');
const path = require('path');
const { createAuthRef } = require('../core/yida-client');
const { saveProcess } = require('./integration-api');
const { assertAutomationCycle } = require('../process/services/process-service');
const baseline = require('./integration-baseline');
const { parse } = require('./integration-manage');
const { t } = require('../core/i18n');
const { isDeepStrictEqual } = require('util');

function indexNodes(nodes, key, children, result = new Map()) {
  for (const node of nodes || []) {
    if (!node[key] || result.has(node[key])) { baseline.fail('duplicate/missing node ID'); }
    result.set(node[key], node);
    indexNodes(node[children], key, children, result);
  }
  return result;
}

function applyPatch(record, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)
    || Object.keys(patch).some(key => !['nodes'].includes(key))
    || !Array.isArray(patch.nodes) || !patch.nodes.length) { baseline.fail('nonempty nodes patch required'); }
  const result = JSON.parse(JSON.stringify(record));
  const runtime = indexNodes(result.processJson.nodes, 'nodeId', 'childNodes');
  const view = indexNodes(result.viewJson.schema.children, 'id', 'children');
  const seen = new Set();
  for (const item of patch.nodes) {
    if (!item || Object.keys(item).some(key => !['id', 'name', 'description', 'message'].includes(key))) {
      baseline.fail('unsupported patch key');
    }
    const id = record.nodeIdMap[item.id] || item.id;
    const p = runtime.get(id), v = view.get(id);
    if (!p || !v || seen.has(id)) { baseline.fail('unknown/duplicate target node'); }
    seen.add(id);
    if (!Object.keys(item).some(key => key !== 'id')) { baseline.fail('empty node patch'); }
    for (const key of ['name', 'description']) {
      if (!Object.hasOwn(item, key)) { continue; }
      if (typeof item[key] !== 'string' || item[key].length > 2000) { baseline.fail('name/description'); }
      if (key === 'name') {
        const name = { zh_CN: item.name, en_US: item.name, type: 'i18n' };
        p.name = name; v.props.name = name;
      } else { p.description = item.description; v.props.description = item.description; }
    }
    if (Object.hasOwn(item, 'message')) {
      if (!item.message || typeof item.message !== 'object' || Array.isArray(item.message)
        || v.componentName !== 'SendMessageNode' || Object.keys(item.message).some(key => !['title', 'content'].includes(key))
        || !Object.keys(item.message).length || Object.values(item.message).some(value => typeof value !== 'string' || !value)) {
        baseline.fail('message patch');
      }
      if (!p.props?.messageInfo || !v.props?.sendMessageRules?.messageInfo) { baseline.fail('message definition incomplete'); }
      Object.assign(p.props.messageInfo, item.message);
      Object.assign(v.props.sendMessageRules.messageInfo, item.message);
    }
  }
  return result;
}

async function run(args) {
  if (!args.length || args.includes('--help')) { console.log(t('integration_update_v2.usage')); return; }
  const { positional, flags } = parse(args, ['patch', 'spec', 'expect'], ['publish']);
  if (positional.length !== 3 || !(flags.patch || flags.spec) || flags.patch && flags.spec) {
    baseline.fail('target and --patch required');
  }
  const [appType, formUuid, processCode] = positional;
  const target = { appType, formUuid, processCode };
  const patch = JSON.parse(fs.readFileSync(flags.patch || flags.spec, 'utf8'));
  const auth = createAuthRef();
  const record = baseline.loadBaseline(auth, target);
  const next = applyPatch(record, patch);
  const state = await baseline.readState(auth, target);
  if (state.fingerprint !== record.state.fingerprint || flags.expect && flags.expect !== state.fingerprint) {
    baseline.fail('remote definition/version changed');
  }
  const changed = !isDeepStrictEqual(record.processJson, next.processJson) || !isDeepStrictEqual(record.viewJson, next.viewJson);
  const output = { success: true, changed, processCode, fingerprint: state.fingerprint,
    runtimeVerified: false, concurrencyProtection: 'read-before-write; no server CAS' };
  const publishNeeded = flags.publish && state.binding.status !== 'y';
  if (flags['dry-run'] || !changed && !publishNeeded) {
    Object.assign(output, { dryRun: !!flags['dry-run'], remoteWrites: 0,
      changes: patch.nodes.map(item => ({ id: item.id, fields: Object.keys(item).filter(key => key !== 'id') })) });
    console.log(JSON.stringify(output, null, 2)); return output;
  }
  // Existing active flows must first be disabled: update cannot accidentally activate a draft.
  if (state.binding.status !== 'n') { baseline.fail('disable the flow before applying a patch'); }
  await assertAutomationCycle(auth, { ...target, processJson: next.processJson, viewJson: next.viewJson });
  const journal = path.join(path.dirname(baseline.location(auth, target)),
    'journal-' + Date.now() + '-' + processCode.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
  baseline.writePrivate(journal, { target, before: record, after: next, state: 'prepared' }, true);
  const recheck = await baseline.readState(auth, target);
  if (recheck.fingerprint !== state.fingerprint) { baseline.fail('concurrent change detected'); }
  if (recheck.binding?.status !== 'n') { baseline.fail('flow must remain disabled during update'); }
  baseline.writePrivate(journal, { target, before: record, after: next, state: 'write_outcome_unknown' });
  let response;
  try { response = await saveProcess(auth, { ...target, processJson: next.processJson, viewJson: next.viewJson,
    isOnline: !!flags.publish, oneShot: true }); }
  catch (error) { baseline.fail(error.message, { remoteWrites: 1, retrySafe: false, journal }); }
  if (response?.success !== true) {
    baseline.fail(response?.errorMsg || 'write outcome unknown', { remoteWrites: 1, retrySafe: false, journal });
  }
  let update;
  try { update = await baseline.recordBaseline(auth, target, next.processJson, next.viewJson, next.nodeIdMap); }
  catch (error) { baseline.fail(error.message, { remoteWrites: 1, mutationAccepted: true, retrySafe: false, journal }); }
  if (update.flowStatus !== (flags.publish ? 'y' : 'n')) {
    baseline.fail('flow status verification failed', { remoteWrites: 1, mutationAccepted: true, retrySafe: false, journal });
  }
  baseline.writePrivate(journal, { target, state: 'verified', before: record, after: next });
  Object.assign(output, { remoteWrites: 1, published: !!flags.publish, readbackVerified: true, update, journal });
  console.log(JSON.stringify(output, null, 2)); return output;
}

module.exports = { run, applyPatch, indexNodes };
