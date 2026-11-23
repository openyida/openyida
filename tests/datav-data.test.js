'use strict';

jest.mock('../lib/app/datav-designer', () => ({
  ...jest.requireActual('../lib/app/datav-designer'), connect: jest.fn(),
}));
const fs = require('node:fs');
const { connect } = require('../lib/app/datav-designer');
const { run, hash, validateQuery } = require('../lib/app/datav-data');
const { parse } = require('../lib/app/datav');
const metadata = { appType: 'APP_TEST', formUuid: 'DATAV-123', datavId: 12 };
const query = { datasetId: 'FORM_TEST', field: [{ code: 'amount', chartKey: 'y', aggregation: 'SUM' }],
  condition: [], orderBy: [], paging: { start: 0, pageIndex: 1, limit: 1000 } };
const binding = { id: 456, screen_id: 12, name: 'bar_1.source', type: 'dataset_yida',
  config: { yidaQuery: query, dataset_yida: 42, yidaAuth: { userId: 'private-user' }, data: 'private-mock' } };
const scene = { config: {}, scenes: [{ layers: { bar_1: { data: { source: {} } } } }] };
const envelope = `Cube("main:/admin/v3/screen/12/config.js", [], function (module, exports, require, load, __dirname, __filename) {module.exports = ${JSON.stringify(scene)};\nreturn module.exports;});`;
let remote;
let next;
beforeEach(() => {
  next = structuredClone(query); next.field[0].aggregation = 'COUNT';
  remote = { csrf: 'private-csrf', get: jest.fn(url => Promise.resolve(url.includes('config.js') ? envelope : JSON.stringify(binding))),
    put: jest.fn().mockResolvedValue('{}') };
  connect.mockResolvedValue(remote);
  jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(next));
});
afterEach(() => jest.restoreAllMocks());
const args = () => ({ action: 'configure-data', component: 'bar_1', queryFile: 'query.json', expectedHash: hash(binding) });

test('reads a query without exposing storage identity, mock data or credentials', async () => {
  const result = await run({}, metadata, { action: 'data', component: 'bar_1' });
  expect(result).toMatchObject({ query, expectedHash: hash(binding), dataValuesIncluded: false, runtimeVerified: false });
  expect(JSON.stringify(result)).not.toContain('private-');
  expect(remote.put).not.toHaveBeenCalled();
  expect(remote.get.mock.calls[1][0]).toContain('screenId=12');
});

test('replaces only the query in the original source and verifies the complete preserved config', async () => {
  const after = { ...binding, config: { ...binding.config, yidaQuery: next } };
  remote.put.mockImplementation(async () => {remote.get.mockImplementation(url => Promise.resolve(url.includes('config.js') ? envelope : JSON.stringify(after))); return '{}';});
  const result = await run({}, metadata, args());
  expect(remote.put).toHaveBeenCalledTimes(1);
  const [url, body, csrf] = remote.put.mock.calls[0];
  expect(url).toBe('/api/admin/v2/data_source/456?screenId=12&x-datav-from-app=yida');
  expect(JSON.parse(body.rawJSON)).toEqual({ type: binding.type, config: after.config });
  expect(csrf).toBe('private-csrf');
  expect(result).toMatchObject({ changed: true, readbackVerified: true, publishRequested: false, runtimeVerified: false });
});

test('rejects stale input and concurrent edits without writing', async () => {
  await expect(run({}, metadata, { ...args(), expectedHash: 'stale' })).rejects.toMatchObject({ code: 'DATAV_DATA_CONFLICT' });
  const changed = { ...binding, updatedAt: 'new' };
  remote.get.mockResolvedValueOnce(envelope).mockResolvedValueOnce(JSON.stringify(binding)).mockResolvedValueOnce(JSON.stringify(changed));
  await expect(run({}, metadata, args())).rejects.toMatchObject({ code: 'DATAV_DATA_CONFLICT' });
  expect(remote.put).not.toHaveBeenCalled();
});

test('a no-op does not write', async () => {
  next = query;
  expect(await run({}, metadata, args())).toMatchObject({ changed: false, readbackVerified: true });
  expect(remote.put).not.toHaveBeenCalled();
});

test.each([
  { ...binding, screen_id: 13 }, { ...binding, name: 'another.source' },
  { ...binding, type: 'api' }, { ...binding, isError: true },
])('rejects wrong source ownership and unsupported sources', async value => {
  remote.get.mockImplementation(url => Promise.resolve(url.includes('config.js') ? envelope : JSON.stringify(value)));
  await expect(run({}, metadata, args())).rejects.toMatchObject({ code: 'DATAV_DATA_SOURCE_UNSUPPORTED' });
  expect(remote.put).not.toHaveBeenCalled();
});

test('does not replay a failed write and retains same-target recovery', async () => {
  remote.put.mockRejectedValue(Error('private-network-detail'));
  await expect(run({}, metadata, args())).rejects.toMatchObject({ code: 'DATAV_DATA_WRITE_UNCERTAIN',
    details: { retrySafe: false, sideEffectState: 'unknown', recovery: ['datav', 'data', 'APP_TEST', 'DATAV-123', '--component', 'bar_1', '--json'] } });
  expect(remote.put).toHaveBeenCalledTimes(1);
});

test('an accepted write with stale readback is not reported as verified', async () => {
  await expect(run({}, metadata, args())).rejects.toMatchObject({ code: 'DATAV_DATA_READBACK_MISMATCH', details: { sideEffectState: 'applied', retrySafe: false } });
  expect(remote.put).toHaveBeenCalledTimes(1);
});

test('validates dataset identity, query shape and credential boundaries', () => {
  for (const bad of [{ ...query, datasetId: 'another' }, { ...query, field: [] },
    { ...query, paging: { limit: 1001 } }, { ...query, secret: 'private' },
    { ...query, field: [{ code: 'x', chartKey: 'x', token: 'private' }] }]) {
    expect(() => validateQuery(bad, 'FORM_TEST')).toThrow();
  }
  expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 }));
});

test('action-specific arguments are required before any remote access', () => {
  expect(parse(['data', 'APP_TEST', 'DATAV-123', '--component', 'bar_1'])).toMatchObject({ action: 'data' });
  for (const input of [ ['data', 'APP_TEST', 'DATAV-123'], ['configure-data', 'APP_TEST', 'DATAV-123', '--component', 'bar_1'],
    ['data', 'APP_TEST', 'DATAV-123', '--component', 'bar_1', '--confirm'] ]) {
    expect(() => parse(input)).toThrow();
  }
});
