'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { version } = require('../../package.json');
const { t } = require('./i18n');
const { buildCommandManifest } = require('./command-manifest');
const { buildEnvironmentSnapshot } = require('./env');
const coreUtils = require('./utils');
const { findProjectRoot, getAuthStatus } = coreUtils;

function redactLogin(login) {
  const redacted = { ...login };
  delete redacted.access_token;
  delete redacted.refresh_token;
  return redacted;
}

function compactLogin(login) {
  return {
    status: login.status,
    auth_mode: login.auth_mode,
    auth_source: login.auth_source,
    auth_store: login.auth_store,
    auth_profile: login.auth_profile,
    corp_id: login.corp_id,
    corp_name: login.corp_name,
    user_id: login.user_id,
    user_name: login.user_name,
    user_auth_store_writable: login.user_auth_store_writable,
    persistence_scope: login.persistence_scope,
    warning: login.warning,
    candidate_count: login.candidate_count,
    candidates: login.candidates,
    next_step: login.next_step,
    next_step_commands: login.next_step_commands,
    can_auto_use: login.can_auto_use === true,
  };
}

function resolveProjectRootCompat(fallback = {}) {
  if (typeof coreUtils.resolveProjectRoot === 'function') {
    return coreUtils.resolveProjectRoot();
  }
  const projectRoot = fallback.projectRoot || findProjectRoot();
  return {
    projectRoot,
    source: fallback.source || 'legacy:findProjectRoot',
    reason: fallback.reason || 'legacy_project_root_resolver',
    exists: typeof fallback.exists === 'boolean' ? fallback.exists : fs.existsSync(projectRoot),
    candidates: [],
  };
}

function buildSkillsDiagnosticsCompat(projectResolution) {
  if (typeof coreUtils.buildSkillsDiagnostics === 'function') {
    return coreUtils.buildSkillsDiagnostics({ projectResolution });
  }
  return {
    schema_version: 1,
    active_tool: null,
    selected: null,
    candidates: [],
    diagnostics: {
      install_note: 'skills_diagnostics_unavailable',
    },
  };
}

function compactProjectRootResolution(projectResolution) {
  return {
    source: projectResolution.source || null,
    reason: projectResolution.reason || null,
    candidates: (projectResolution.candidates || []).map((candidate) => ({
      projectRoot: candidate.projectRoot,
      source: candidate.source,
      reason: candidate.reason,
      exists: candidate.exists,
      hasConfig: candidate.hasConfig,
    })),
  };
}

function compactSkillsDiagnostics(skillsDiagnostics) {
  const compactCandidate = (candidate) => candidate
    ? {
      path: candidate.path,
      source: candidate.source,
      scope: candidate.scope,
      reason: candidate.reason,
      exists: candidate.exists,
      writable: candidate.writable,
      usable: candidate.usable,
      workspace_only: candidate.workspace_only,
    }
    : null;

  return {
    schema_version: skillsDiagnostics.schema_version,
    active_tool: skillsDiagnostics.active_tool,
    selected: compactCandidate(skillsDiagnostics.selected),
    candidates: (skillsDiagnostics.candidates || []).map(compactCandidate),
    diagnostics: skillsDiagnostics.diagnostics || {},
  };
}

function buildRuntimeSnapshot(projectRoot) {
  const detected = typeof coreUtils.detectRuntimeCapabilities === 'function'
    ? coreUtils.detectRuntimeCapabilities()
    : {};
  const capabilities = detected.capabilities || {};
  return {
    tool: detected.tool || null,
    display_name: detected.displayName || null,
    runtime: detected.runtime || 'unknown',
    subtype: detected.subtype || null,
    workspace_root: projectRoot || detected.workspaceRoot || null,
    workspace_root_source: detected.workspaceRootSource || 'project_root_resolution',
    browser_capabilities: {
      desktop_shell: capabilities.desktop_shell === true,
      agent_browser: capabilities.agent_browser === true,
      browser_auto_open: capabilities.browser_auto_open === true,
      playwright_required: false,
      playwright_policy: 'optional_fallback_only_do_not_install_by_default',
    },
  };
}

const BUILDER_CORE_COMMAND_IDS = Object.freeze([
  'agent-capabilities',
  'commands',
  'login',
  'logout',
  'auth',
  'app-list',
  'list-forms',
  'get-schema',
  'data',
  'nav-group',
  'get-permission',
  'save-permission',
  'create-app',
  'create-form.create',
  'create-form.icons',
  'create-page',
  'publish',
]);

function commandBriefs(manifest, commandIds) {
  const byId = new Map((manifest.commands || []).map(entry => [entry.id, entry]));
  return commandIds
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(entry => ({
      id: entry.id,
      usage: entry.usage,
      requires_login: entry.requires_login,
      output: entry.output,
      permission_mode: entry.permission && entry.permission.mode,
      side_effect_kind: entry.side_effect && entry.side_effect.kind,
      examples: entry.examples || [],
      args: entry.args || [],
      canonical: entry.canonical || null,
    }));
}

function forbiddenAliasBriefs(manifest) {
  return (manifest.forbidden_aliases || []).map(entry => ({
    pattern: entry.pattern,
    matcher: entry.matcher,
    suggested_command_id: entry.suggested_command_id,
    suggested_usage: entry.suggested_usage,
    alternative_command_ids: entry.alternative_command_ids || [],
    alternative_usages: entry.alternative_usages || [],
    message_key: entry.message_key,
    message_args: entry.message_args || [],
    message: entry.message,
  }));
}

function buildAuthPath(login, env = process.env) {
  const authSource = login.auth_source || 'token_session';
  const envTokenSession = authSource === 'env' || login.failure_reason === 'env_token_missing';
  const authPath = {
    mode: login.auth_mode || 'token',
    source: authSource,
    store: login.auth_store,
    auth_profile: login.auth_profile,
    corp_id: login.corp_id,
    corp_name: login.corp_name,
    user_id: login.user_id,
    user_name: login.user_name,
    user_auth_store_writable: login.user_auth_store_writable,
    persistence_scope: login.persistence_scope,
    warning: login.warning,
    next_step: login.next_step,
    next_step_commands: login.next_step_commands,
    can_auto_use: login.can_auto_use === true,
    interactive_login_allowed: !envTokenSession,
    browser_session_auth_allowed: false,
    auth_runtime: envTokenSession ? 'env_token_bootstrap' : 'token_oauth_session',
    cookie_auth_supported: false,
    cookie_check_required: false,
    playwright_cookie_check_required: false,
    qr_login_required: false,
    prohibited_legacy_checks: [
      'browser_cookie',
      'playwright_cookie',
      'qr_login',
      'cookie_cache',
    ],
    missing_token_action: envTokenSession
      ? 'STOP_AND_REQUEST_ENV_TOKEN'
      : 'RUN_OPENYIDA_LOGIN_IF_USER_APPROVES',
  };
  return authPath;
}

function buildInteractiveLogin(auth, runtime) {
  const base = {
    suppress_flag: '--no-browser',
    suppress_env: 'OPENYIDA_NO_BROWSER',
    completion_signal: 'process_exit_and_final_json',
    playwright_required: false,
  };

  if (!auth.interactive_login_allowed) {
    return {
      mode: 'not_required',
      browser_default: 'not_required',
      browser_owner: 'none',
      recommended_command: null,
      agent_action: 'do_not_run_oauth_login',
      reason: auth.source === 'env' ? 'env_token_bootstrap' : 'login_not_required',
      ...base,
    };
  }

  const browser = runtime.browser_capabilities || {};
  if (browser.desktop_shell) {
    return {
      mode: 'cli_auto_open',
      browser_default: 'cli_auto_open',
      browser_owner: 'cli',
      recommended_command: 'openyida login',
      agent_action: 'wait_for_login_command',
      reason: 'desktop_shell_available',
      ...base,
    };
  }

  if (browser.agent_browser) {
    return {
      mode: 'caller_open_url',
      browser_default: 'caller_open_url',
      browser_owner: 'agent_browser',
      recommended_command: 'openyida login --no-browser',
      agent_action: 'open_cli_printed_url_once_with_agent_browser',
      url_source: 'login_command_stderr',
      manual_user_open_fallback: 'only_when_agent_browser_tool_unavailable_or_failed',
      must_not_only_print_url_when_agent_browser_available: true,
      reason: 'web_sandbox_agent_browser_available',
      ...base,
    };
  }

  return {
    mode: 'unsupported',
    browser_default: 'unsupported',
    browser_owner: 'none',
    recommended_command: null,
    agent_action: 'ask_user_for_browser_access',
    reason: 'no_desktop_shell_or_agent_browser_detected',
    ...base,
  };
}

function buildBuilderPath(login, projectRoot, manifest, env = process.env, runtimeSnapshot = null) {
  const auth = buildAuthPath(login, env);
  const canTrustSummaryPreflight = auth.can_auto_use === true;
  const runtime = runtimeSnapshot || buildRuntimeSnapshot(projectRoot);

  return {
    schema_version: 1,
    preflight: {
      recommended_command: 'openyida agent-capabilities --summary-json',
      run_once: true,
      additional_env_check_default: false,
      additional_login_check_default: false,
      trust_summary_json_as_builder_preflight: true,
      full_capabilities_command: 'openyida agent-capabilities --json',
      full_capabilities_only_when: 'Need full command_manifest.commands, forbidden_aliases, or detailed environment diagnostics.',
    },
    auth,
    runtime,
    interactive_login: buildInteractiveLogin(auth, runtime),
    environment_check_simplification: {
      contract_role: 'machine_readable_builder_runtime_not_yida_agent_business_logic',
      minimal_probe_commands: [
        'which openyida',
        'openyida agent-capabilities --summary-json',
      ],
      can_skip_default_exploration_when_summary_ok: canTrustSummaryPreflight,
      skip_default_command_patterns: [
        'openyida --help',
        'openyida <command> --help',
        'openyida env --json',
        'openyida login --check-only --json',
        'browser login',
        'qr login',
        'Playwright cookie inspection',
        'cookie cache inspection',
        'openyida app-list',
      ],
      skip_help_discovery_default: true,
      skip_env_noise_default: true,
      skip_login_check_only_default: canTrustSummaryPreflight,
      skip_browser_login_default: !auth.interactive_login_allowed,
      skip_cookie_or_playwright_checks_default: true,
      default_app_list_policy: 'skip_when_bound_app_type_unique',
      stop_when_env_token_missing: auth.missing_token_action === 'STOP_AND_REQUEST_ENV_TOKEN' && !auth.can_auto_use,
    },
    command_contract: {
      command_prefix: manifest.command_prefix,
      supported_command_count: manifest.commands.length,
      supported_command_ids: manifest.commands.map(entry => entry.id),
      canonical_builder_commands: commandBriefs(manifest, BUILDER_CORE_COMMAND_IDS),
      forbidden_aliases_available_in: 'openyida commands --json',
      forbidden_alias_count: manifest.forbidden_aliases.length,
      forbidden_aliases: forbiddenAliasBriefs(manifest),
      unknown_command_policy: 'deny_with_manifest_suggestion_before_asking_user',
    },
    bound_context: {
      existing_app_type_policy: 'do_not_call_app_list_by_default',
      skip_app_list_when: [
        'appType is already provided by the user',
        'a bound app context is already available',
      ],
      call_app_list_only_when: [
        'name_search',
        'target_conflict',
        'failure_diagnosis',
      ],
    },
    resource_context_resolution: {
      contract_role: 'structured_runtime_hint_not_skill_stage_rewrite',
      if_bound_app_type_unique: {
        action: 'reuse_bound_app_type',
        command: null,
        skip_command_ids: ['app-list'],
      },
      app_name_search: {
        command_id: 'app-list',
        usage: 'openyida app-list [--size N]',
      },
      app_forms_or_pages_lookup: {
        command_id: 'list-forms',
        usage: 'openyida list-forms <appType> [--keyword <text>]',
      },
      schema_or_field_lookup: {
        command_id: 'get-schema',
        usages: [
          'openyida get-schema <appType> <formUuid> --summary-json',
          'openyida get-schema <appType> --all --summary-json --keyword <text> --output-dir .cache/openyida/<task>/schemas',
        ],
      },
      preflight_context: {
        command_id: 'agent-capabilities',
        usage: 'openyida agent-capabilities --summary-json',
      },
    },
    paths: {
      workdir: projectRoot,
      page_source_cli_path_policy: 'If builder Bash cwd is the project/ directory, pass page source paths as pages/src/<file>.',
      page_source_examples: [
        'pages/src/home.canvas.jsx',
        'pages/src/dashboard.oyd.jsx',
      ],
    },
  };
}

function compactBuilderPath(builderPath) {
  const environment = builderPath.environment_check_simplification;
  const commandContract = builderPath.command_contract;
  const resourceContext = builderPath.resource_context_resolution;
  const paths = builderPath.paths;
  const auth = {
    mode: builderPath.auth.mode,
    source: builderPath.auth.source,
    store: builderPath.auth.store,
    auth_profile: builderPath.auth.auth_profile,
    corp_id: builderPath.auth.corp_id,
    corp_name: builderPath.auth.corp_name,
    user_id: builderPath.auth.user_id,
    user_name: builderPath.auth.user_name,
    user_auth_store_writable: builderPath.auth.user_auth_store_writable,
    persistence_scope: builderPath.auth.persistence_scope,
    warning: builderPath.auth.warning,
    next_step: builderPath.auth.next_step,
    next_step_commands: builderPath.auth.next_step_commands,
    can_auto_use: builderPath.auth.can_auto_use,
    interactive_login_allowed: builderPath.auth.interactive_login_allowed,
    browser_session_auth_allowed: builderPath.auth.browser_session_auth_allowed,
    auth_runtime: builderPath.auth.auth_runtime,
    cookie_auth_supported: builderPath.auth.cookie_auth_supported,
    cookie_check_required: builderPath.auth.cookie_check_required,
    playwright_cookie_check_required: builderPath.auth.playwright_cookie_check_required,
    qr_login_required: builderPath.auth.qr_login_required,
    missing_token_action: builderPath.auth.missing_token_action,
  };
  return {
    schema_version: builderPath.schema_version,
    preflight: builderPath.preflight,
    auth,
    runtime: builderPath.runtime,
    interactive_login: builderPath.interactive_login,
    environment_check_simplification: {
      minimal_probe_commands: environment.minimal_probe_commands,
      can_skip_default_exploration_when_summary_ok: environment.can_skip_default_exploration_when_summary_ok,
      skip_login_check_only_default: environment.skip_login_check_only_default,
      skip_browser_login_default: environment.skip_browser_login_default,
      skip_cookie_or_playwright_checks_default: environment.skip_cookie_or_playwright_checks_default,
      stop_when_env_token_missing: environment.stop_when_env_token_missing,
      default_app_list_policy: environment.default_app_list_policy,
    },
    command_contract: {
      command_prefix: commandContract.command_prefix,
      supported_command_count: commandContract.supported_command_count,
      canonical_builder_command_ids: commandContract.canonical_builder_commands.map(entry => entry.id),
      forbidden_aliases_available_in: commandContract.forbidden_aliases_available_in,
      forbidden_alias_count: commandContract.forbidden_alias_count,
      unknown_command_policy: commandContract.unknown_command_policy,
    },
    bound_context: {
      existing_app_type_policy: builderPath.bound_context.existing_app_type_policy,
    },
    resource_context_resolution: {
      if_bound_app_type_unique: resourceContext.if_bound_app_type_unique,
      full_contract_in: 'openyida agent-capabilities --json',
    },
    paths: {
      page_source_cli_path_policy: paths.page_source_cli_path_policy,
    },
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

function buildCommandManifestDigest(manifest) {
  const digestPayload = {
    schema_version: manifest.schema_version,
    command_prefix: manifest.command_prefix,
    summary: {
      command_count: manifest.summary.command_count,
      group_count: manifest.summary.group_count,
      forbidden_alias_count: manifest.summary.forbidden_alias_count,
      side_effect_counts: manifest.summary.side_effect_counts,
      permission_mode_counts: manifest.summary.permission_mode_counts,
      core_workflows: manifest.summary.core_workflows,
    },
    forbidden_aliases: (manifest.forbidden_aliases || []).map(entry => ({
      pattern: entry.pattern,
      suggested_command_id: entry.suggested_command_id,
      suggested_usage: entry.suggested_usage,
    })),
    commands: manifest.commands.map(entry => ({
      id: entry.id,
      usage: entry.usage,
      requires_login: entry.requires_login,
      output: entry.output,
      side_effect_kind: entry.side_effect && entry.side_effect.kind,
      permission_mode: entry.permission && entry.permission.mode,
      permission_effect: entry.permission && entry.permission.effect,
      args: entry.args || [],
      canonical: entry.canonical || null,
    })),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(digestPayload)))
    .digest('hex');
}

function buildAgentCapabilitiesSummary() {
  const manifest = buildCommandManifest({ t, version });
  const envSnapshot = buildEnvironmentSnapshot();
  const projectResolution = resolveProjectRootCompat({
    projectRoot: envSnapshot.active.projectRoot,
    source: 'environment_snapshot',
    reason: 'environment_active_project_root',
    exists: envSnapshot.active.projectRootExists,
  });
  const projectRoot = projectResolution.projectRoot || envSnapshot.active.projectRoot;
  const skillsDiagnostics = compactSkillsDiagnostics(buildSkillsDiagnosticsCompat(projectResolution));
  const loginStatus = getAuthStatus({ projectRoot, includeSecrets: false });
  const runtime = buildRuntimeSnapshot(projectRoot);
  const builderPath = compactBuilderPath(
    buildBuilderPath(loginStatus, projectRoot, manifest, process.env, runtime)
  );

  return {
    schema_version: 1,
    name: 'openyida-agent-capabilities-summary',
    version,
    login: compactLogin(loginStatus),
    workdir: projectRoot,
    workdir_exists: !!projectResolution.exists,
    workdir_source: projectResolution.source,
    workdir_reason: projectResolution.reason,
    project_root: compactProjectRootResolution(projectResolution),
    cache_dir: path.join(projectRoot, '.cache'),
    openyida_task_cache_dir: path.join(projectRoot, '.cache', 'openyida'),
    skills: skillsDiagnostics,
    command_manifest_digest: buildCommandManifestDigest(manifest),
    command_manifest_digest_algorithm: 'sha256',
    command_count: manifest.summary.command_count,
    full_capabilities_command: 'openyida agent-capabilities --json',
    runtime,
    builder_path: builderPath,
  };
}

function buildAgentCapabilities() {
  const envSnapshot = buildEnvironmentSnapshot();
  const manifest = buildCommandManifest({ t, version });
  const projectResolution = resolveProjectRootCompat({
    projectRoot: envSnapshot.active.projectRoot,
    source: 'environment_snapshot',
    reason: 'environment_active_project_root',
    exists: envSnapshot.active.projectRootExists,
  });
  const projectRoot = projectResolution.projectRoot || envSnapshot.active.projectRoot;
  const skillsDiagnostics = buildSkillsDiagnosticsCompat(projectResolution);
  const loginStatus = redactLogin(getAuthStatus({ projectRoot, includeSecrets: false }));
  const runtime = buildRuntimeSnapshot(projectRoot);
  const builderPath = buildBuilderPath(loginStatus, projectRoot, manifest, process.env, runtime);

  return {
    schema_version: 1,
    name: 'openyida-agent-capabilities',
    openyida: {
      version,
      aliases: manifest.aliases,
      command_prefix: manifest.command_prefix,
    },
    system: envSnapshot.system,
    active: envSnapshot.active,
    runtime,
    login: loginStatus,
    recommended: {
      preflight_command: 'openyida agent-capabilities --summary-json',
      full_capabilities_command: 'openyida agent-capabilities --json',
      mutation_guard: 'Run mutating commands only when login.status is ok or after a successful openyida login.',
      workdir: projectRoot,
      workdir_source: projectResolution.source,
      workdir_reason: projectResolution.reason,
      cache_dir: path.join(projectRoot, '.cache'),
      openyida_task_cache_dir: path.join(projectRoot, '.cache', 'openyida'),
      default_full_app_workflow: manifest.summary.core_workflows.full_app_build,
    },
    builder_path: builderPath,
    skills: {
      index_file: 'skills-index.json',
      entry: 'openyida',
      category_namespace: 'yida-skills/',
      routing_contract: 'Use route_groups[].signals to choose a yida-skills/<area> category, rank only skills in that category by description/tags/signals, then call use_skill when available.',
      note: 'Use host use_skill/search_skills when available; otherwise load only the current-stage SKILL.md selected by the root routing table.',
      installation: skillsDiagnostics,
    },
    commands: {
      count: manifest.summary.command_count,
      group_count: manifest.summary.group_count,
      side_effect_counts: manifest.summary.side_effect_counts,
      permission_mode_counts: manifest.summary.permission_mode_counts,
      read_only_command_ids: manifest.summary.read_only_command_ids,
      mutating_command_ids: manifest.summary.mutating_command_ids,
      allow_command_ids: manifest.summary.allow_command_ids,
      ask_command_ids: manifest.summary.ask_command_ids,
      deny_command_ids: manifest.summary.deny_command_ids,
      core_workflows: manifest.summary.core_workflows,
      forbidden_alias_count: manifest.summary.forbidden_alias_count,
      forbidden_alias_patterns: manifest.summary.forbidden_alias_patterns,
    },
    sideEffects: {
      read_only_preflight: [
        'openyida agent-capabilities --summary-json',
        'openyida env --json',
        'openyida login --check-only --json',
        'openyida commands --json',
      ],
      retry_policy: 'Do not repeat the same failed command without changing login state, organization, parameters, files, or field IDs.',
      completion_contracts: {
        full_app: 'Default full-app build is complete after creating or reusing the app, core forms, primary page, publishing it, and returning access URLs. If three or more resources/links are returned, present them in a Markdown table with type, purpose/name, URL, and status.',
      },
      full_app_data_contract: 'Default full-app page code must not call this.dataSourceMap.* unless the same run created and bound a designer data source; use this.utils.yida.* or an entry-only page by default.',
    },
    command_manifest: {
      schema_version: manifest.schema_version,
      groups: manifest.groups,
      side_effect_schema: manifest.side_effect_schema,
      permission_schema: manifest.permission_schema,
      forbidden_alias_schema: manifest.forbidden_alias_schema,
      forbidden_aliases: manifest.forbidden_aliases,
      summary: manifest.summary,
      commands: manifest.commands,
    },
  };
}

function shouldUseSummary(args = []) {
  return args.includes('--summary-json') || args.includes('--compact');
}

async function run(args = []) {
  const payload = shouldUseSummary(args)
    ? buildAgentCapabilitiesSummary()
    : buildAgentCapabilities();
  console.log(JSON.stringify(payload, null, 2));
}

module.exports = {
  buildAgentCapabilities,
  buildAgentCapabilitiesSummary,
  compactBuilderPath,
  buildCommandManifestDigest,
  run,
};
