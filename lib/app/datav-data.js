'use strict';

const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { CliError } = require('../core/cli-error');
const { connect, parseConfig } = require('./datav-designer');

function fail(code, details = {}) {
  return new CliError('Native DataV data query could not be verified. Inspect the same layer before continuing.', { code, details });
}

function canonical(value) {
  if (Array.isArray(value)) {return value.map(canonical);}
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function hash(value) {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function validateQuery(query, datasetId) {
  const allowed = ['datasetId', 'field', 'condition', 'orderBy', 'paging', 'distinct', 'autoMapping', 'enabledCache'];
  if (!query || typeof query !== 'object' || Array.isArray(query) || query.datasetId !== datasetId
    || Object.keys(query).some(key => !allowed.includes(key)) || !Array.isArray(query.field) || !query.field.length
    || query.field.some(field => !field || typeof field.code !== 'string' || !field.code || typeof field.chartKey !== 'string' || !field.chartKey)
    || !Array.isArray(query.condition) || !Array.isArray(query.orderBy)
    || !query.paging || !Number.isInteger(query.paging.limit) || query.paging.limit < 1 || query.paging.limit > 1000) {
    throw fail('DATAV_QUERY_INVALID');
  }
  const walk = value => {
    if (!value || typeof value !== 'object') {return;}
    for (const [key, child] of Object.entries(value)) {
      if (/^(?:__proto__|constructor|prototype)$|token|password|secret|cookie|authorization|credential|ticket|signature/i.test(key)) {
        throw fail('DATAV_QUERY_INVALID');
      }
      walk(child);
    }
  };
  walk(query);
  return query;
}

function unwrap(value, metadata, component) {
  if (!value || value.isError || value.success === false || value.type !== 'dataset_yida'
    || Number(value.screen_id) !== metadata.datavId || value.name !== component + '.source'
    || !Number.isSafeInteger(Number(value.id)) || Number(value.id) <= 0
    || !value.config || !value.config.yidaQuery || typeof value.config.yidaQuery.datasetId !== 'string') {
    throw fail('DATAV_DATA_SOURCE_UNSUPPORTED');
  }
  return value;
}

async function run(client, metadata, args) {
  const { component } = args;
  let query;
  if (args.action === 'configure-data') {
    try {query = JSON.parse(fs.readFileSync(args.queryFile, 'utf8'));} catch {throw fail('DATAV_QUERY_INVALID');}
  }
  const remote = await connect(client, metadata);
  const config = parseConfig(await remote.get('/api/admin/v3/screen/' + metadata.datavId + '/config.js?x-datav-from-app=yida&m=1'), metadata.datavId);
  const layers = config.scenes.flatMap(scene => Object.entries(scene.layers || {})).filter(([id]) => id === component);
  if (layers.length !== 1 || !layers[0][1].data?.source) {throw fail('DATAV_COMPONENT_NOT_FOUND');}
  const url = '/api/admin/v2/data_source/' + metadata.datavId + ',' + encodeURIComponent(component)
    + '.source?screenId=' + metadata.datavId + '&x-datav-from-app=yida';
  const read = async () => {
    let value;
    try {value = JSON.parse(await remote.get(url));} catch {throw fail('DATAV_DATA_READ_FAILED');}
    return unwrap(value, metadata, component);
  };
  const current = await read();
  const expectedHash = hash(current);
  const view = value => ({ component, interface: 'source', sourceType: value.type,
    query: value.config.yidaQuery, expectedHash: hash(value), dataValuesIncluded: false,
    credentialsIncluded: false, runtimeVerified: false });
  // Only return query fields; storage authentication and template mock values never leave the session.
  validateQuery(current.config.yidaQuery, current.config.yidaQuery.datasetId);
  if (args.action === 'data') {return view(current);}
  validateQuery(query, current.config.yidaQuery.datasetId);
  if (expectedHash !== args.expectedHash) {throw fail('DATAV_DATA_CONFLICT', { expectedHash });}
  if (hash(query) === hash(current.config.yidaQuery)) {return { ...view(current), changed: false, readbackVerified: true };}
  if (!remote.csrf) {throw fail('DATAV_DESIGNER_UNAVAILABLE');}
  // Re-read immediately before the single write. The platform has no atomic compare-and-swap contract.
  if (hash(await read()) !== expectedHash) {throw fail('DATAV_DATA_CONFLICT');}
  const next = { type: current.type, config: { ...current.config, yidaQuery: query } };
  const recovery = ['datav', 'data', metadata.appType, metadata.formUuid, '--component', component, '--json'];
  let response;
  try {
    response = JSON.parse(await remote.put('/api/admin/v2/data_source/' + Number(current.id)
      + '?screenId=' + metadata.datavId + '&x-datav-from-app=yida', { rawJSON: JSON.stringify(next) }, remote.csrf));
  } catch {
    throw fail('DATAV_DATA_WRITE_UNCERTAIN', { ...metadata, component, sideEffectState: 'unknown', retrySafe: false, recovery });
  }
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw fail('DATAV_DATA_WRITE_UNCERTAIN', { ...metadata, component, sideEffectState: 'unknown', retrySafe: false, recovery });
  }
  if (response.isError || response.success === false) {
    throw fail('DATAV_DATA_WRITE_REJECTED', { platformErrorCode: response.code, retrySafe: false, recovery });
  }
  let after;
  try {
    after = await read();
    if (hash({ type: after.type, config: after.config }) !== hash(next) || after.id !== current.id) {throw fail('DATAV_DATA_READBACK_MISMATCH');}
  } catch {
    throw fail('DATAV_DATA_READBACK_MISMATCH', { ...metadata, component, sideEffectState: 'applied', retrySafe: false, recovery });
  }
  return { ...view(after), changed: true, readbackVerified: true, publishRequested: false,
    concurrencyCheck: 'client_read_before_write' };
}

module.exports = { run, hash, validateQuery };
