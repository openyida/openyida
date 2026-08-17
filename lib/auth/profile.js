'use strict';

const { CliError } = require('../core/cli-error');
const {
  isHostInjectedTokenMode,
  listUserAuthProfiles,
  loadAuthProfilePointer,
  loadTokenSession,
  saveAuthProfilePointer,
} = require('./token-store');

function cleanObject(value) {
  const result = { ...value };
  Object.keys(result).forEach((key) => {
    if (result[key] === undefined || result[key] === null || result[key] === '') {
      delete result[key];
    }
  });
  return result;
}

function toProfileSummary(session = {}, currentAuthProfile) {
  return cleanObject({
    auth_profile: session.auth_profile,
    corp_id: session.corp_id,
    corp_name: session.corp_name,
    user_id: session.user_id,
    user_name: session.user_name,
    auth_store: session.auth_store || 'user',
    last_used_at: session.last_used_at,
    is_current: !!currentAuthProfile && session.auth_profile === currentAuthProfile,
  });
}

function getCurrentAuthProfile(options = {}) {
  const pointer = loadAuthProfilePointer(options);
  return pointer && pointer.auth_profile ? pointer.auth_profile : null;
}

function listAuthProfiles(options = {}) {
  const currentAuthProfile = getCurrentAuthProfile(options);
  const profiles = listUserAuthProfiles(options)
    .map((profile) => toProfileSummary(profile, currentAuthProfile))
    .sort((left, right) => String(right.last_used_at || '').localeCompare(String(left.last_used_at || '')));

  return {
    ok: true,
    auth_mode: 'token',
    status: 'ok',
    auth_store: 'user',
    current_auth_profile: currentAuthProfile,
    count: profiles.length,
    profiles,
  };
}

function createProfileNotFoundError(target, options = {}) {
  const nextStep = options.nextStep || 'Run openyida auth profiles to list existing profiles. If the target is missing, run openyida login to add it, then switch again.';
  throw new CliError(
    `auth profile not found: ${target}`,
    {
      code: 'AUTH_PROFILE_NOT_FOUND',
      details: {
        target,
        nextStep,
        next_step: nextStep,
      },
    }
  );
}

function createProfileRequiredError(target, candidates) {
  const nextStep = 'Run openyida auth profiles, then run openyida auth profile switch <auth_profile> with the exact profile id.';
  throw new CliError(
    `multiple auth profiles match target: ${target}; pass the exact auth_profile`,
    {
      code: 'AUTH_PROFILE_REQUIRED',
      details: {
        target,
        candidate_count: candidates.length,
        candidates,
        nextStep,
        next_step: nextStep,
      },
    }
  );
}

function resolveSwitchTarget(target, options = {}) {
  const normalizedTarget = String(target || '').trim();
  if (!normalizedTarget) {
    throw new CliError(
      'target auth profile or corpId is required',
      {
        code: 'INVALID_ARGUMENTS',
        usage: 'Usage: openyida auth profile switch <profile|corpId>',
      }
    );
  }

  const currentAuthProfile = getCurrentAuthProfile(options);
  const profiles = listUserAuthProfiles(options);
  const exactProfile = profiles.find((profile) => profile.auth_profile === normalizedTarget);
  if (exactProfile) {
    return {
      session: exactProfile,
      currentAuthProfile,
      target_kind: 'auth_profile',
    };
  }

  let candidates = profiles.filter((profile) => profile.corp_id === normalizedTarget);
  if (options.userId) {
    candidates = candidates.filter((profile) => profile.user_id === options.userId);
  }
  const candidateSummaries = candidates.map((profile) => toProfileSummary(profile, currentAuthProfile));
  if (candidateSummaries.length > 1) {
    createProfileRequiredError(normalizedTarget, candidateSummaries);
  }
  if (candidates.length === 1) {
    return {
      session: candidates[0],
      currentAuthProfile,
      target_kind: 'corp_id',
    };
  }

  createProfileNotFoundError(normalizedTarget);
}

function switchAuthProfile(target, options = {}) {
  if (isHostInjectedTokenMode(options.env || process.env)) {
    throw new CliError(
      'host-injected token mode cannot switch local auth profiles',
      {
        code: 'AUTH_PROFILE_SWITCH_HOST_INJECTED',
        details: {
          nextStep: 'Ask the host runtime to inject the target organization token instead of switching local profiles.',
          next_step: 'Ask the host runtime to inject the target organization token instead of switching local profiles.',
        },
      }
    );
  }

  const previousSession = loadTokenSession(options);
  const { session, currentAuthProfile, target_kind: targetKind } = resolveSwitchTarget(target, options);
  saveAuthProfilePointer(session, options);

  return cleanObject({
    ok: true,
    auth_mode: 'token',
    status: currentAuthProfile === session.auth_profile ? 'already_selected' : 'switched',
    can_auto_use: true,
    target_kind: targetKind,
    previous_auth_profile: currentAuthProfile,
    previous_corp_id: previousSession && previousSession.corp_id,
    auth_profile: session.auth_profile,
    auth_store: session.auth_store || 'user',
    persistence_scope: session.persistence_scope || 'user',
    corp_id: session.corp_id,
    corp_name: session.corp_name,
    user_id: session.user_id,
    user_name: session.user_name,
    base_url: session.base_url,
    message: 'current project auth pointer switched to existing profile',
  });
}

async function run(args = []) {
  const subCommand = args[0];
  const json = args.includes('--json');
  const options = {
    userId: getArgValue(args, '--user-id'),
  };

  if (!subCommand || subCommand === 'list' || subCommand === 'profiles') {
    const result = listAuthProfiles(options);
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  if (subCommand === 'switch') {
    const target = getFirstPositionalArg(args, 1);
    const result = switchAuthProfile(target, options);
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  throw new CliError(
    'Usage: openyida auth profile <switch>',
    {
      code: 'INVALID_ARGUMENTS',
      usage: 'Usage: openyida auth profiles | openyida auth profile switch <profile|corpId>',
      details: json ? { nextStep: 'Run openyida auth profiles to list existing profiles.' } : undefined,
    }
  );
}

function getArgValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith('--')) {
    return null;
  }
  return args[index + 1];
}

function getFirstPositionalArg(args, startIndex = 0) {
  const valueFlags = new Set(['--user-id']);
  for (let index = startIndex; index < args.length; index++) {
    const arg = args[index];
    if (valueFlags.has(arg)) {
      index++;
      continue;
    }
    if (!arg.startsWith('--')) {
      return arg;
    }
  }
  return null;
}

module.exports = {
  listAuthProfiles,
  run,
  switchAuthProfile,
};
