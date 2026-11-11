'use strict';

const { run, echoContent, httpbinEchoContent, startEchoServer, connectorFixtureNames } = require('../scripts/e2e-real/issue-560-479');

test('real issue regression cannot write without both explicit enable flags', async () => {
  await expect(run({ env: {} })).resolves.toMatchObject({ skipped: true });
  await expect(run({ env: { OPENYIDA_E2E: '1' } })).resolves.toMatchObject({ skipped: true });
});

test('long run IDs produce stable distinct fixture labels within the observed platform boundary', () => {
  const run = 'OY_560_479_' + '20261111_LONG_RUN'.repeat(8);
  const names = connectorFixtureNames(run);
  expect(connectorFixtureNames(run)).toEqual(names);
  expect(new Set(Object.values(names)).size).toBe(Object.keys(names).length);
  expect(Object.values(names).every(name => name.length <= 24)).toBe(true);
  expect(connectorFixtureNames(run + '_OTHER').header).not.toBe(names.header);
});

test('runtime echo parser handles testOperation and nested invokeService envelopes', () => {
  const echo = { fixtureRunId: 'OWNED_RUN', observed: { header: true, query: false } };
  expect(echoContent({ content: JSON.stringify(echo) }, 'OWNED_RUN')).toEqual(echo);
  expect(echoContent({ content: { serviceReturnValue: JSON.stringify(echo) } }, 'OWNED_RUN')).toEqual(echo);
  expect(echoContent({ content: JSON.stringify(echo) }, 'ANOTHER_RUN')).toBeNull();
});

test('public echo checks exact run path and synthetic values without retaining echoed credentials', () => {
  const raw = { url: 'https://httpbin.org/anything/OWNED_RUN?probe_key=FAKE_PROBE', method: 'GET',
    args: { probe_key: 'FAKE_PROBE' }, headers: { Authorization: 'FAKE_PROBE' } };
  const expected = { fixtureRunId: 'OWNED_RUN', observed: { header: true, query: true } };
  expect(httpbinEchoContent({ content: JSON.stringify(raw) }, 'OWNED_RUN', 'FAKE_PROBE')).toEqual(expected);
  expect(httpbinEchoContent(raw, 'OWNED_RUN', 'OTHER')).toMatchObject({ observed: { header: false, query: false } });
  expect(httpbinEchoContent(raw, 'OWNED', 'FAKE_PROBE')).toBeNull();
  expect(httpbinEchoContent({ ...raw, method: 'POST' }, 'OWNED_RUN', 'FAKE_PROBE')).toBeNull();
  expect(httpbinEchoContent({ ...raw, url: 'https://other.test/anything/OWNED_RUN' }, 'OWNED_RUN', 'FAKE_PROBE')).toBeNull();
  expect(JSON.stringify(expected)).not.toContain('FAKE_PROBE');
});

test('local echo detects synthetic header/query values without exposing arbitrary headers or paths', async () => {
  const fixture = await startEchoServer('OWNED_LOCAL', 'FAKE_PROBE');
  try {
    const health = await fetch(fixture.url + '/health');
    expect(health.headers.get('x-openyida-fixture')).toBe('OWNED_LOCAL');
    const response = await fetch(fixture.url + '/echo?probe_key=FAKE_PROBE', {
      headers: { Authorization: 'FAKE_PROBE', 'X-Do-Not-Reflect': 'private-value' },
    });
    const body = await response.json();
    expect(body).toEqual({ fixtureRunId: 'OWNED_LOCAL', observed: { header: true, query: true } });
    expect(JSON.stringify(body)).not.toMatch(/FAKE_PROBE|private-value/);
    expect((await fetch(fixture.url + '/etc/passwd')).status).toBe(404);
  } finally { fixture.close(); }
});
