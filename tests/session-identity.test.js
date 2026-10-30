'use strict';

const { sessionIdentity } = require('../lib/auth/session-identity');
const { normalizeTokenResponse } = require('../lib/auth/token-auth');
const { normalizeTokenSession } = require('../lib/auth/token-store');

test.each([
  { identity_type: 'PERSONAL' },
  { identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' },
  { identity_type: 'ORGANIZATION', organization_type: 'QWENWORK' },
  { identity_type: 'ORGANIZATION', organization_type: 'OTHER' },
])('classification survives response and session normalization: %j', classification => {
  const response = normalizeTokenResponse({ ...classification, access_token: 'fixture-access' }, 'https://tenant.example.test', 'cli');
  expect(sessionIdentity(normalizeTokenSession(response))).toEqual(classification);
});

test.each([undefined, null, ''])('historical empty classification defaults to DingTalk: %s', field => {
  const legacy = { corp_id: 'yida0123456789abcdef0123456789abcdef', identity_type: field, organization_type: field };
  const expected = { identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' };
  expect(sessionIdentity(legacy)).toEqual(expected);
  expect(sessionIdentity(normalizeTokenResponse(legacy, 'https://tenant.example.test', 'cli'))).toEqual(expected);
  expect(sessionIdentity(normalizeTokenSession(legacy))).toEqual(expected);
});

test.each([
  { identity_type: 'UNKNOWN' },
  { identity_type: 'PERSONAL', organization_type: 'DINGTALK' },
  { identity_type: 'ORGANIZATION' },
  { organization_type: 'QWENWORK' },
  { identity_type: 'ORGANIZATION', organization_type: 'GROUP' },
])('inconsistent classification is rejected without echoing the fields: %j', classification => {
  expect(() => sessionIdentity(classification)).toThrow(expect.objectContaining({ code: 'AUTH_IDENTITY_TYPE_INVALID', details: { reason: 'identity_classification' } }));
});

test.each([
  { classification: { identity_type: 'PERSONAL' }, change: {} },
  { classification: { identity_type: 'PERSONAL' }, change: { identity_type: null, organization_type: '' } },
  { classification: { identity_type: 'ORGANIZATION', organization_type: 'QWENWORK' }, change: {} },
  { classification: { identity_type: 'PERSONAL' }, change: { corp_id: 'yidaffffffffffffffffffffffffffffffff' } },
  { classification: { identity_type: 'ORGANIZATION', organization_type: 'QWENWORK' }, change: { user_id: 'another-member' } },
])('legacy refresh inherits classification only for the same identity: %j', async ({ classification, change }) => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const http = require('http');
  const { saveTokenSession, saveProjectLegacyTokenSession, loadTokenSession } = require('../lib/auth/token-store');
  const { tokenRefresh } = require('../lib/auth/token-auth');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-identity-refresh-'));
  const server = http.createServer((req, res) => {
    req.resume();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', access_token: 'fixture-next-access', refresh_token: 'fixture-next-refresh', expires_in: 1800, ...change }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const options = { projectRoot: root, authDir: path.join(root, 'auth'), env: {}, endpoint };
  try {
    const identityChanged = 'corp_id' in change || 'user_id' in change;
    const save = identityChanged ? saveProjectLegacyTokenSession : saveTokenSession;
    save({ ...classification, base_url: endpoint, client_id: 'cli', corp_id: 'yida0123456789abcdef0123456789abcdef', user_id: 'member', access_token: 'fixture-access', refresh_token: 'fixture-refresh' }, options);
    const refreshed = await tokenRefresh(options);
    expect(refreshed.access_token).toBe('fixture-next-access');
    if (identityChanged) {
      expect(refreshed).toMatchObject({ identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
      expect(loadTokenSession(options)).toMatchObject({ identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
    } else { expect(loadTokenSession(options)).toMatchObject(classification); }
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    fs.rmSync(root, { recursive: true, force: true });
  }
});
