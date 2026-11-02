'use strict';

const { spawnSync } = require('child_process');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const REPOSITORY = 'openyida/openyida';
const links = Object.freeze({ repository: `https://github.com/${REPOSITORY}`,
  issue: `https://github.com/${REPOSITORY}/issues/new`, fork: `https://github.com/${REPOSITORY}/fork` });

/** Parse explicit account actions; submitting an Issue never implies Star or Fork consent. */
function parseArgs(args = []) {
  const [action, ...flags] = args;
  const install = flags.includes('--install');
  if (!['status', 'star', 'fork', 'setup'].includes(action) || new Set(flags).size !== flags.length
    || flags.some(flag => !['--json', '--confirm', '--install'].includes(flag))
    || (install && action !== 'setup')
    || (action === 'status' && flags.includes('--confirm'))
    || (action === 'setup' && !install && flags.includes('--confirm'))) {
    throw new CliError(t('feedback_github.usage'), { code: 'FEEDBACK_GITHUB_USAGE' });
  }
  if ((['star', 'fork'].includes(action) || install) && !flags.includes('--confirm')) {
    throw new CliError(t(install ? 'feedback_github.setup_consent' : 'feedback_github.confirmation'), { code: 'FEEDBACK_GITHUB_CONFIRMATION_REQUIRED' });
  }
  return { action, confirm: flags.includes('--confirm'), ...(action === 'setup' ? { install } : {}) };
}

/** Run gh against github.com only. Never expose its raw output or credential diagnostics. */
function request(method, endpoint, options, fields = []) {
  const spawn = options.spawnSyncFn || spawnSync;
  const result = spawn('gh', ['api', '--hostname', 'github.com', '--include', '--method', method, endpoint, ...fields], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
    env: { ...(options.env || process.env), GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = String(result.stdout || '');
  const status = Number(output.match(/^HTTP\/[\d.]+\s+(\d{3})\b/)?.[1]) || null;
  const separator = output.match(/\r?\n\r?\n/);
  let data = null;
  try { data = separator ? JSON.parse(output.slice(separator.index + separator[0].length)) : null; }
  catch { /* Empty responses and invalid JSON remain unverified. */ }
  return { status, data, ok: result.status === 0 && status >= 200 && status < 300,
    unavailable: result.error?.code === 'ENOENT' };
}

/** Verify ownership and upstream before offering an existing personal Fork for contributions. */
function readFork(response, login) {
  if (response.status === 404) { return { state: 'absent', url: null }; }
  if (!response.ok) { return { state: 'unknown', url: null }; }
  const repo = response.data;
  if (repo?.fork === true && repo.parent?.full_name?.toLowerCase() === REPOSITORY
    && repo.full_name?.toLowerCase() === `${login}/openyida`.toLowerCase()
    && repo.owner?.login?.toLowerCase() === login.toLowerCase()) {
    return { state: 'ready', url: `https://github.com/${login}/openyida` };
  }
  return { state: 'conflict', url: null };
}

/** Include renamed personal Forks; never infer absence from an incomplete or failed query. */
function inspectFork(login, options) {
  const query = 'query { repository(owner:"openyida", name:"openyida") { forks(first:100, affiliations:[OWNER]) { nodes { nameWithOwner isFork owner { login } parent { nameWithOwner } } pageInfo { hasNextPage } } } }';
  const response = request('POST', 'graphql', options, ['--raw-field', `query=${query}`]);
  const connection = response.data?.data?.repository?.forks;
  if (!response.ok || response.data?.errors || !Array.isArray(connection?.nodes)
    || typeof connection.pageInfo?.hasNextPage !== 'boolean') { return { state: 'unknown', url: null }; }
  for (const repo of connection.nodes) {
    const [owner, name, extra] = String(repo?.nameWithOwner || '').split('/');
    if (repo?.isFork === true && repo.parent?.nameWithOwner?.toLowerCase() === REPOSITORY
      && owner.toLowerCase() === login.toLowerCase() && repo.owner?.login?.toLowerCase() === login.toLowerCase()
      && /^[A-Za-z0-9_.-]+$/.test(name || '') && !extra) {
      return { state: 'ready', url: `https://github.com/${owner}/${name}` };
    }
  }
  if (connection.nodes.length || connection.pageInfo.hasNextPage) { return { state: 'unknown', url: null }; }
  return readFork(request('GET', `repos/${login}/openyida`, options), login);
}

/** Read account, Star and personal Fork state without changing it; unknown is never treated as absent. */
function inspect(options) {
  const account = request('GET', 'user', options);
  const login = account.data?.login;
  const base = { success: true, repository: REPOSITORY, links, mutationPerformed: false, issueRequiresStarOrFork: false };
  if (!account.ok || account.data?.type !== 'User' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(login || '')) {
    return { ...base, authenticated: false, reason: account.unavailable ? 'gh_unavailable' : 'account_unverified',
      login: null, starred: null, fork: { state: 'unknown', url: null }, suggestedActions: [] };
  }
  const star = request('GET', `user/starred/${REPOSITORY}`, options);
  const starred = star.ok && star.status === 204 ? true : star.status === 404 ? false : null;
  const fork = inspectFork(login, options);
  return { ...base, authenticated: true, login, starred, fork,
    suggestedActions: [...(starred === false ? ['star'] : []), ...(fork.state === 'absent' ? ['fork'] : [])] };
}

/** Execute one explicitly authorized action, then read it back. No retry, clone, remote change or Issue submission. */
function execute(parsed, options = {}) {
  const validated = parseArgs([parsed.action, ...(parsed.confirm === true ? ['--confirm'] : []), ...(parsed.install === true ? ['--install'] : [])]);
  const { action } = validated;
  if ((options.env || process.env).OPENYIDA_MANAGED_RUN === '1') {
    throw new CliError(t('feedback_github.failed'), { code: 'FEEDBACK_GITHUB_MANAGED_DENIED' });
  }
  if (action === 'setup') { return require('./github-setup').setup(validated, options); }
  const result = inspect(options);
  if (action === 'status') { return result; }
  const fail = (stage, mutationPerformed = false) => {
    throw new CliError(t('feedback_github.failed'), { code: 'FEEDBACK_GITHUB_FAILED',
      details: { stage, action, mutationPerformed, inspectBeforeRetry: true } });
  };
  if (!result.authenticated) { fail('account'); }
  if (action === 'star') {
    if (result.starred === true) { return { ...result, action, alreadyApplied: true }; }
    if (result.starred !== false) { fail('star-status'); }
    const written = request('PUT', `user/starred/${REPOSITORY}`, options);
    if (!written.ok) { fail('star-write', 'unknown'); }
    const verified = request('GET', `user/starred/${REPOSITORY}`, options);
    if (!verified.ok || verified.status !== 204) { fail('star-readback', true); }
    return { ...result, action, starred: true, mutationPerformed: true, readbackVerified: true,
      suggestedActions: result.suggestedActions.filter(item => item !== 'star') };
  }
  if (result.fork.state === 'ready') { return { ...result, action, alreadyApplied: true }; }
  if (result.fork.state !== 'absent') { fail('fork-status'); }
  const created = request('POST', `repos/${REPOSITORY}/forks`, options, ['--field', 'default_branch_only=true']);
  if (!created.ok) { fail('fork-write', 'unknown'); }
  const fork = readFork(request('GET', `repos/${result.login}/openyida`, options), result.login);
  return { ...result, action, fork, mutationPerformed: true, readbackVerified: fork.state === 'ready',
    completion: fork.state === 'ready' ? 'verified' : 'pending-verification',
    suggestedActions: result.suggestedActions.filter(item => item !== 'fork') };
}

/** CLI entrypoint. The confirmation flag attests to the user's explicit choice of this action. */
function run(args = []) {
  const parsed = parseArgs(args);
  const result = execute(parsed);
  if (result.success === false) {
    throw new CliError(result.message, { code: 'FEEDBACK_GITHUB_SETUP_FAILED', details: result });
  }
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { parseArgs, execute, run };
