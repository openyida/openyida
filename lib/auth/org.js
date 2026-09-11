'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { createAuthRef, createYidaClient } = require('../core/yida-client');
const {
  clearAuthProfilePointer,
  clearProjectLegacyTokenSession,
  loadAuthProfilePointer,
  loadLocalTokenSession,
  loadTokenSession,
  normalizeCorpName,
  resolveTokenSession,
  isEnvTokenAuthMode,
  saveAuthProfilePointer,
  saveProjectLegacyTokenSession,
  saveTokenSession,
} = require('./token-store');
const { tokenLogin } = require('./token-auth');

const LIST_CORP_INFOS_PATH = '/query/userservice/listCorpInfos.json';

function getArgValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith('--')) {
    return null;
  }
  return args[index + 1];
}

function hasFlag(args, name) {
  return args.includes(name);
}

function getPayload(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }
  return response.content || response.data || response.result || response;
}

function normalizeCorpList(response) {
  const payload = getPayload(response);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload && payload.list)
      ? payload.list
      : Array.isArray(payload && payload.corpInfos)
        ? payload.corpInfos
        : [];

  return list
    .map((corp) => ({
      corpId: corp.corpId || corp.corp_id || corp.id,
      corpName: normalizeCorpName(corp) || corp.corpId || corp.corp_id || corp.id,
      logo: corp.logo,
      namespace: corp.namespace || '',
    }))
    .filter((corp) => corp.corpId);
}

function createProfileRequiredError(targetCorpId, resolution = {}) {
  const error = new Error(`目标组织存在多个可用登录态，请指定 --profile 或 --user-id 后重试：corpId=${targetCorpId}`);
  error.code = 'ORG_SWITCH_PROFILE_REQUIRED';
  error.targetCorpId = targetCorpId;
  error.candidateCount = resolution.candidate_count;
  error.candidates = resolution.candidates;
  return error;
}

function createEnvTokenSwitchError(targetCorpId, currentSession, resolution = {}) {
  const actualCorpId = currentSession && currentSession.corp_id;
  const error = new Error(`当前为 env token 登录态，不能通过 OAuth 切换组织：target=${targetCorpId}, actual=${actualCorpId || 'unknown'}`);
  error.code = 'ORG_SWITCH_ENV_TOKEN_MISMATCH';
  error.status = 'env_token_mismatch';
  error.targetCorpId = targetCorpId;
  error.actualCorpId = actualCorpId;
  error.auth_source = resolution.auth_source || (currentSession && currentSession.auth_source) || 'env';
  error.auth_store = resolution.auth_store || (currentSession && currentSession.auth_store) || 'env';
  error.can_auto_use = false;
  return error;
}

function restoreAuthProfilePointer(pointer, options = {}) {
  if (pointer && pointer.auth_profile) {
    saveAuthProfilePointer(pointer, options);
    return;
  }
  clearAuthProfilePointer(options);
}

function withoutAuthSelectors(options = {}) {
  const {
    authProfile,
    profile,
    corpId,
    userId,
    ...rest
  } = options;
  const env = rest.env || process.env;
  const nextEnv = { ...env };
  delete nextEnv.OPENYIDA_AUTH_PROFILE;
  delete nextEnv.OPENYIDA_AUTH_CORP_ID;
  delete nextEnv.OPENYIDA_AUTH_USER_ID;
  return {
    ...rest,
    env: nextEnv,
  };
}

function snapshotProjectAuth(options = {}) {
  return {
    pointer: loadAuthProfilePointer(options),
    legacySession: loadLocalTokenSession(options),
  };
}

function restoreProjectAuth(snapshot, options = {}) {
  restoreAuthProfilePointer(snapshot && snapshot.pointer, options);
  if (snapshot && snapshot.legacySession) {
    saveProjectLegacyTokenSession(snapshot.legacySession, options);
    return;
  }
  clearProjectLegacyTokenSession(options);
}

function createTemporaryLoginOptions(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-org-switch-login-'));
  return {
    options: {
      ...options,
      projectRoot: path.join(root, 'project'),
      authDir: path.join(root, 'auth'),
    },
    cleanup: () => {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function buildSwitchResult(status, currentSession, nextSession, message, extra = {}) {
  return {
    ok: true,
    auth_mode: 'token',
    status,
    can_auto_use: true,
    previous_corp_id: currentSession && currentSession.corp_id,
    corp_id: nextSession.corp_id,
    corp_name: nextSession.corp_name,
    user_id: nextSession.user_id,
    user_name: nextSession.user_name,
    base_url: nextSession.base_url,
    message,
    ...extra,
  };
}

async function listOrganizations(options = {}) {
  const authRef = createAuthRef();
  const response = await createYidaClient({ authRef }).get(LIST_CORP_INFOS_PATH);
  if (response && response.success === false) {
    throw new Error(response.errorMsg || response.message || response.errorCode || 'list corp infos failed');
  }
  const organizations = normalizeCorpList(response);
  return {
    ok: true,
    auth_mode: 'token',
    status: 'ok',
    current_corp_id: authRef.corpId,
    count: organizations.length,
    organizations: organizations.map((corp) => ({
      ...corp,
      isCurrent: !!authRef.corpId && corp.corpId === authRef.corpId,
    })),
    raw: options.includeRaw ? response : undefined,
  };
}

async function switchOrganization(targetCorpId, options = {}) {
  if (!targetCorpId) {
    throw new Error('corpId is required. Usage: openyida org switch --corp-id dingXXX');
  }

  const projectOptions = withoutAuthSelectors(options);
  const originalSnapshot = snapshotProjectAuth(projectOptions);
  const currentSession = loadTokenSession(projectOptions);
  if (currentSession && currentSession.corp_id === targetCorpId) {
    return {
      ok: true,
      auth_mode: 'token',
      status: 'already_in_org',
      can_auto_use: true,
      corp_id: currentSession.corp_id,
      corp_name: currentSession.corp_name,
      user_id: currentSession.user_id,
      user_name: currentSession.user_name,
      base_url: currentSession.base_url,
      message: 'already in target organization',
    };
  }

  const targetResolution = resolveTokenSession({
    ...options,
    corpId: targetCorpId,
  });
  if (targetResolution.session && targetResolution.session.corp_id === targetCorpId) {
    if (targetResolution.session.auth_profile) {
      saveAuthProfilePointer(targetResolution.session, projectOptions);
    }
    return buildSwitchResult(
      'switched',
      currentSession,
      targetResolution.session,
      'switched organization by existing auth profile',
      { switch_source: 'existing_profile' }
    );
  }
  if (targetResolution.status === 'profile_required') {
    throw createProfileRequiredError(targetCorpId, targetResolution);
  }
  if (isEnvTokenAuthMode(projectOptions.env)) {
    throw createEnvTokenSwitchError(targetCorpId, currentSession, targetResolution);
  }

  const loginOptions = {
    ...projectOptions,
    endpoint: options.endpoint || (currentSession && currentSession.base_url),
    clientId: options.clientId || (currentSession && currentSession.client_id),
    corpId: targetCorpId,
  };

  const login = options.tokenLogin || tokenLogin;
  const temporaryLogin = createTemporaryLoginOptions(loginOptions);
  let loginResult;
  try {
    loginResult = await login(temporaryLogin.options);
  } finally {
    temporaryLogin.cleanup();
  }
  if (!loginResult || !loginResult.access_token) {
    restoreProjectAuth(originalSnapshot, projectOptions);
    return {
      ...(loginResult || {}),
      ok: false,
      auth_mode: 'token',
      status: 'token_not_issued',
      can_auto_use: false,
      message: (loginResult && loginResult.message) || 'login did not issue access_token',
    };
  }

  if (loginResult.corp_id !== targetCorpId) {
    restoreProjectAuth(originalSnapshot, projectOptions);
    const error = new Error(`登录到的组织与目标组织不一致：target=${targetCorpId}, actual=${loginResult.corp_id || 'unknown'}`);
    error.code = 'ORG_SWITCH_CORP_MISMATCH';
    error.targetCorpId = targetCorpId;
    error.actualCorpId = loginResult.corp_id;
    throw error;
  }

  const savedSession = saveTokenSession(loginResult, projectOptions);

  return buildSwitchResult(
    'switched',
    currentSession,
    savedSession,
    'switched organization by OAuth login',
    { switch_source: 'oauth_login' }
  );
}

function printList(result) {
  const { c, banner, sep } = require('../core/chalk');
  banner('openyida org list - 组织列表', { stderr: false });
  if (!result.organizations.length) {
    console.log('  暂无可访问组织');
    console.log(`  ${sep()}\n`);
    return;
  }
  result.organizations.forEach((corp) => {
    const icon = corp.isCurrent ? `${c.green}✔${c.reset}` : `${c.dim}○${c.reset}`;
    const current = corp.isCurrent ? ` ${c.green}(当前)${c.reset}` : '';
    console.log(`    ${icon} ${corp.corpName}${current}`);
    console.log(`      ${c.dim}corpId: ${corp.corpId}${c.reset}`);
  });
  console.log(`\n  ${sep()}\n`);
}

function printSwitch(result) {
  const { banner, label, success, warn, sep } = require('../core/chalk');
  banner('openyida org switch - 组织切换', { stderr: false });
  if (result.status === 'already_in_org') {
    warn('已在目标组织中，无需切换', false);
  } else {
    success('组织切换成功', false);
  }
  if (result.previous_corp_id) {
    label('From', result.previous_corp_id, { stderr: false });
  }
  label('Corp ID', result.corp_id || '', { stderr: false });
  if (result.user_id) {
    label('User ID', result.user_id, { stderr: false });
  }
  console.log(`  ${sep()}\n`);
}

async function run(args = []) {
  const subCommand = args[0];
  const json = hasFlag(args, '--json');
  const options = {
    quiet: hasFlag(args, '--quiet') || json,
    clientId: getArgValue(args, '--client-id'),
    authProfile: getArgValue(args, '--profile'),
    userId: getArgValue(args, '--user-id'),
  };

  if (subCommand === 'list') {
    const result = await listOrganizations(options);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printList(result);
    }
    return result;
  }

  if (subCommand === 'switch') {
    const targetCorpId = getArgValue(args, '--corp-id') || args.slice(1).find(arg => !arg.startsWith('--'));
    const result = await switchOrganization(targetCorpId, options);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printSwitch(result);
    }
    return result;
  }

  throw new Error('Usage: openyida org <list|switch>');
}

module.exports = {
  LIST_CORP_INFOS_PATH,
  listOrganizations,
  normalizeCorpList,
  run,
  switchOrganization,
};
