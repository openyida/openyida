'use strict';

const { execute, parseArgs } = require('../lib/feedback/github');
const { shouldSkipAutoUpdateCommand } = require('../lib/core/update');

const response = (status, data) => ({ status: status < 400 ? 0 : 1,
  stdout: `HTTP/2.0 ${status} Response\r\nContent-Type: application/json\r\n\r\n${data === undefined ? '' : JSON.stringify(data)}` });
const ownFork = (name = 'openyida') => ({ fork: true, full_name: `contributor/${name}`,
  owner: { login: 'contributor' }, parent: { full_name: 'openyida/openyida' } });
let state, spawn;
beforeEach(() => {
  state = { starred: false, fork: null };
  spawn = jest.fn((binary, argv) => {
    const method = argv[argv.indexOf('--method') + 1];
    const endpoint = argv[argv.indexOf('--method') + 2];
    if (endpoint === 'user') { return response(200, { login: 'contributor', type: 'User' }); }
    if (endpoint === 'graphql') {
      if (state.graphql) { return state.graphql; }
      const nodes = state.fork ? [{ nameWithOwner: state.fork.full_name, isFork: state.fork.fork,
        owner: state.fork.owner, parent: { nameWithOwner: state.fork.parent?.full_name } }] : [];
      return response(200, { data: { repository: { forks: { nodes, pageInfo: { hasNextPage: false } } } } });
    }
    if (endpoint === 'user/starred/openyida/openyida') {
      if (method === 'PUT') { state.starred = true; return response(204); }
      return state.starResponse || response(state.starred ? 204 : 404);
    }
    if (endpoint === 'repos/contributor/openyida') { return response(state.fork ? 200 : 404, state.fork); }
    if (endpoint === 'repos/openyida/openyida/forks') {
      if (!state.pending) { state.fork = ownFork(); }
      return response(202, { full_name: 'contributor/openyida' });
    }
    throw new Error('Unexpected gh endpoint');
  });
});
const run = (args = ['status']) => execute(parseArgs(args), { spawnSyncFn: spawn, env: {} });
const writes = () => spawn.mock.calls.filter(([, argv]) => {
  const i = argv.indexOf('--method');
  return argv[i + 1] !== 'GET' && argv[i + 2] !== 'graphql';
});

test('status reports only missing optional actions and uses fixed github.com with no account mutations', () => {
  expect(run()).toMatchObject({ authenticated: true, login: 'contributor', starred: false,
    fork: { state: 'absent' }, suggestedActions: ['star', 'fork'], issueRequiresStarOrFork: false, mutationPerformed: false });
  expect(writes()).toHaveLength(0);
  for (const [binary, argv, options] of spawn.mock.calls) {
    expect(binary).toBe('gh');
    expect(argv.slice(0, 3)).toEqual(['api', '--hostname', 'github.com']);
    expect(options).toMatchObject({ stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 });
    expect(options).not.toHaveProperty('shell');
  }
});
test('detects existing renamed personal forks and stars without inviting or recreating either', () => {
  state.starred = true; state.fork = ownFork('my-renamed-openyida');
  expect(run()).toMatchObject({ starred: true, fork: { state: 'ready', url: 'https://github.com/contributor/my-renamed-openyida' }, suggestedActions: [] });
  expect(run(['fork', '--confirm'])).toMatchObject({ alreadyApplied: true, mutationPerformed: false });
  expect(run(['star', '--confirm'])).toMatchObject({ alreadyApplied: true, mutationPerformed: false });
  expect(writes()).toHaveLength(0);
});
test.each(['star', 'fork'])('%s without explicit confirmation fails before account access', action => {
  expect(() => run([action])).toThrow(expect.objectContaining({ code: 'FEEDBACK_GITHUB_CONFIRMATION_REQUIRED' }));
  expect(spawn).not.toHaveBeenCalled();
});
test.each([['status', '--confirm'], ['status', '--repo', 'other/repo'], ['fork', '--confirm', '--confirm'], ['issue'], ['star', '--yes']])(
  'rejects unsupported input %j', args => {
    expect(() => run(args)).toThrow(); expect(spawn).not.toHaveBeenCalled();
  }
);
test('missing gh returns a nonblocking fallback and never exposes credential diagnostics', () => {
  spawn.mockReturnValue({ status: null, error: { code: 'ENOENT' }, stderr: 'secret-token' });
  const result = run();
  expect(result).toMatchObject({ authenticated: false, reason: 'gh_unavailable', starred: null, suggestedActions: [] });
  expect(JSON.stringify(result)).not.toContain('secret-token');
});
test('unsigned-in accounts and rate limits remain unknown and do not cause writes', () => {
  spawn.mockReturnValue(response(401, { message: 'secret-token' }));
  expect(run()).toMatchObject({ authenticated: false, fork: { state: 'unknown' }, suggestedActions: [] });
  expect(() => run(['star', '--confirm'])).toThrow(expect.objectContaining({ code: 'FEEDBACK_GITHUB_FAILED' }));
  expect(writes()).toHaveLength(0);
});
test.each([
  ['missing tool', { status: null, error: { code: 'ENOENT' } }, 'gh_unavailable'],
  ['execution denied', { status: null, error: { code: 'EACCES' } }, 'account_unverified'],
  ['network timeout', { status: null, error: { code: 'ETIMEDOUT' } }, 'account_unverified'],
  ['unauthorized', response(401, { message: 'private diagnostic' }), 'account_unverified'],
  ['permission denied', response(403), 'account_unverified'],
  ['rate limited', response(429), 'account_unverified'],
  ['unavailable service', response(503), 'account_unverified'],
  ['invalid identity', response(200, { login: 'contributor', type: 'Organization' }), 'account_unverified'],
])('%s preserves unknown account/Fork state without setup or mutation', (_label, result, reason) => {
  spawn.mockReturnValue({ ...result, stderr: 'credential-not-for-report' });
  const status = run();
  expect(status).toMatchObject({ reason, authenticated: false, login: null,
    starred: null, fork: { state: 'unknown', url: null }, suggestedActions: [], mutationPerformed: false });
  expect(JSON.stringify(status)).not.toMatch(/private diagnostic|credential-not-for-report/);
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(spawn.mock.calls[0][0]).toBe('gh');
  expect(spawn.mock.calls[0][1]).toEqual(expect.arrayContaining(['api', '--method', 'GET', 'user']));
  expect(writes()).toHaveLength(0);
});
test('rechecking after user login reuses the current identity without installing, logging in or publishing', () => {
  const authenticated = spawn.getMockImplementation();
  spawn.mockReturnValue(response(401));
  expect(run().reason).toBe('account_unverified');
  spawn.mockImplementation(authenticated);
  state.fork = ownFork('existing-contribution');
  expect(run()).toMatchObject({ authenticated: true, login: 'contributor',
    fork: { state: 'ready', url: 'https://github.com/contributor/existing-contribution' } });
  expect(writes()).toHaveLength(0);
  expect(spawn.mock.calls.every(([binary, argv]) => binary === 'gh' && argv[0] === 'api')).toBe(true);
});
test('permission errors are not confused with absent Star/Fork states', () => {
  state.starResponse = response(403); state.graphql = response(200, { errors: [{ message: 'denied' }] });
  expect(run()).toMatchObject({ starred: null, fork: { state: 'unknown' }, suggestedActions: [] });
  expect(() => run(['fork', '--confirm'])).toThrow(expect.objectContaining({ code: 'FEEDBACK_GITHUB_FAILED' }));
  expect(writes()).toHaveLength(0);
});
test('incomplete fork pages and unverified owners are not treated as missing forks', () => {
  state.graphql = response(200, { data: { repository: { forks: { nodes: [{ nameWithOwner: 'other/openyida' }], pageInfo: { hasNextPage: true } } } } });
  expect(run().fork.state).toBe('unknown');
  expect(writes()).toHaveLength(0);
});
test('an unrelated same-name repository prevents a new Fork', () => {
  state.fork = { full_name: 'contributor/openyida', owner: { login: 'contributor' }, fork: false };
  state.graphql = response(200, { data: { repository: { forks: { nodes: [], pageInfo: { hasNextPage: false } } } } });
  expect(run().fork.state).toBe('conflict');
  expect(() => run(['fork', '--confirm'])).toThrow();
  expect(writes()).toHaveLength(0);
});
test('a confirmed Star performs one PUT and verifies it without creating a Fork or Issue', () => {
  expect(run(['star', '--confirm', '--json'])).toMatchObject({ starred: true, readbackVerified: true, mutationPerformed: true, suggestedActions: ['fork'] });
  expect(writes()).toHaveLength(1);
  expect(writes()[0][1]).toContain('PUT');
});
test('unknown write outcomes never trigger automatic replay', () => {
  const original = spawn.getMockImplementation();
  spawn.mockImplementation((binary, argv, options) => argv.includes('PUT') ? { status: null, error: { code: 'ETIMEDOUT' } } : original(binary, argv, options));
  expect(() => run(['star', '--confirm'])).toThrow(expect.objectContaining({ details: expect.objectContaining({ mutationPerformed: 'unknown', inspectBeforeRetry: true }) }));
  expect(writes()).toHaveLength(1);
});
test('a confirmed Fork performs one personal creation request and verifies it', () => {
  expect(run(['fork', '--confirm'])).toMatchObject({ fork: { state: 'ready' }, completion: 'verified', mutationPerformed: true });
  expect(writes()).toHaveLength(1);
  expect(writes()[0][1]).toEqual(expect.arrayContaining(['repos/openyida/openyida/forks', '--field', 'default_branch_only=true']));
});
test('asynchronous Fork creation stays pending and never requests a second Fork', () => {
  state.pending = true;
  expect(run(['fork', '--confirm'])).toMatchObject({ completion: 'pending-verification', readbackVerified: false, mutationPerformed: true });
  expect(writes()).toHaveLength(1);
});
test('feedback GitHub operations bypass auto-update; managed runs cannot access personal accounts', () => {
  expect(shouldSkipAutoUpdateCommand('feedback', ['github', 'status'])).toBe(true);
  expect(() => execute({ action: 'status' }, { spawnSyncFn: spawn, env: { OPENYIDA_MANAGED_RUN: '1' } })).toThrow();
  expect(spawn).not.toHaveBeenCalled();
});
