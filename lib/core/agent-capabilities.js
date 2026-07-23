'use strict';

const crypto = require('crypto');
const path = require('path');
const { version } = require('../../package.json');
const { t } = require('./i18n');
const { buildCommandManifest } = require('./command-manifest');
const { buildEnvironmentSnapshot } = require('./env');
const { getAuthStatus } = require('./utils');

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
    can_auto_use: login.can_auto_use === true,
  };
}

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function hasEnvTokenCredential(env = process.env) {
  return !!(
    String(env.OPENYIDA_ACCESS_TOKEN || '').trim() ||
    String(env.OPENYIDA_REFRESH_TOKEN || '').trim()
  );
}

const BUILDER_CORE_COMMAND_IDS = Object.freeze([
  'agent-capabilities',
  'commands',
  'app-list',
  'list-forms',
  'get-schema',
  'create-app',
  'create-form.create',
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

function buildAuthFastPath(login, env = process.env) {
  const hostInjectedTokenMode = isTruthyEnv(env.YIDA_AUTH_ENABLED);
  const envTokenPresent = hasEnvTokenCredential(env);
  const authSource = login.auth_source || (hostInjectedTokenMode || envTokenPresent ? 'env' : 'token_session');
  const hostTokenEnvDetected = hostInjectedTokenMode || envTokenPresent || authSource === 'env';

  return {
    mode: login.auth_mode || 'token',
    source: authSource,
    can_auto_use: login.can_auto_use === true,
    host_injected_token_mode: hostInjectedTokenMode,
    host_token_env_detected: hostTokenEnvDetected,
    env_token_present: envTokenPresent,
    interactive_login_allowed: !hostTokenEnvDetected,
    browser_session_auth_allowed: false,
    auth_runtime: 'token_oauth_session',
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
    missing_token_action: hostInjectedTokenMode
      ? 'STOP_AND_REQUEST_HOST_TOKEN'
      : 'RUN_OPENYIDA_LOGIN_IF_USER_APPROVES',
  };
}

function buildBuilderFastPath(login, projectRoot, manifest, env = process.env) {
  const auth = buildAuthFastPath(login, env);
  const canTrustSummaryPreflight = auth.can_auto_use === true || auth.host_injected_token_mode === true;

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
    environment_check_simplification: {
      contract_role: 'machine_readable_fast_path_for_builder_runtime_not_yida_agent_business_logic',
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
      skip_browser_login_default: auth.host_token_env_detected,
      skip_cookie_or_playwright_checks_default: true,
      default_app_list_policy: 'skip_when_bound_app_type_unique',
      stop_when_host_token_missing: auth.host_injected_token_mode && !auth.env_token_present,
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

function compactBuilderFastPath(builderFastPath) {
  const environment = builderFastPath.environment_check_simplification;
  const commandContract = builderFastPath.command_contract;
  const resourceContext = builderFastPath.resource_context_resolution;
  const paths = builderFastPath.paths;

  return {
    schema_version: builderFastPath.schema_version,
    preflight: builderFastPath.preflight,
    auth: {
      mode: builderFastPath.auth.mode,
      source: builderFastPath.auth.source,
      can_auto_use: builderFastPath.auth.can_auto_use,
      host_injected_token_mode: builderFastPath.auth.host_injected_token_mode,
      host_token_env_detected: builderFastPath.auth.host_token_env_detected,
      env_token_present: builderFastPath.auth.env_token_present,
      interactive_login_allowed: builderFastPath.auth.interactive_login_allowed,
      browser_session_auth_allowed: builderFastPath.auth.browser_session_auth_allowed,
      auth_runtime: builderFastPath.auth.auth_runtime,
      cookie_auth_supported: builderFastPath.auth.cookie_auth_supported,
      cookie_check_required: builderFastPath.auth.cookie_check_required,
      playwright_cookie_check_required: builderFastPath.auth.playwright_cookie_check_required,
      qr_login_required: builderFastPath.auth.qr_login_required,
      missing_token_action: builderFastPath.auth.missing_token_action,
    },
    environment_check_simplification: {
      minimal_probe_commands: environment.minimal_probe_commands,
      can_skip_default_exploration_when_summary_ok: environment.can_skip_default_exploration_when_summary_ok,
      skip_login_check_only_default: environment.skip_login_check_only_default,
      skip_browser_login_default: environment.skip_browser_login_default,
      skip_cookie_or_playwright_checks_default: environment.skip_cookie_or_playwright_checks_default,
      stop_when_host_token_missing: environment.stop_when_host_token_missing,
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
      existing_app_type_policy: builderFastPath.bound_context.existing_app_type_policy,
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
    })),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(digestPayload)))
    .digest('hex');
}

function buildAgentCapabilitiesSummary() {
  const envSnapshot = buildEnvironmentSnapshot();
  const manifest = buildCommandManifest({ t, version });
  const projectRoot = envSnapshot.active.projectRoot;
  const loginStatus = getAuthStatus({ projectRoot, includeSecrets: false });
  const builderFastPath = compactBuilderFastPath(
    buildBuilderFastPath(loginStatus, projectRoot, manifest)
  );

  return {
    schema_version: 1,
    name: 'openyida-agent-capabilities-summary',
    version,
    login: compactLogin(loginStatus),
    workdir: projectRoot,
    workdir_exists: !!envSnapshot.active.projectRootExists,
    cache_dir: path.join(projectRoot, '.cache'),
    openyida_task_cache_dir: path.join(projectRoot, '.cache', 'openyida'),
    command_manifest_digest: buildCommandManifestDigest(manifest),
    command_manifest_digest_algorithm: 'sha256',
    command_count: manifest.summary.command_count,
    full_capabilities_command: 'openyida agent-capabilities --json',
    builder_fast_path: builderFastPath,
  };
}

function buildAgentCapabilities() {
  const envSnapshot = buildEnvironmentSnapshot();
  const manifest = buildCommandManifest({ t, version });
  const projectRoot = envSnapshot.active.projectRoot;
  const loginStatus = redactLogin(getAuthStatus({ projectRoot, includeSecrets: false }));
  const builderFastPath = buildBuilderFastPath(loginStatus, projectRoot, manifest);

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
    login: loginStatus,
    recommended: {
      preflight_command: 'openyida agent-capabilities --summary-json',
      full_capabilities_command: 'openyida agent-capabilities --json',
      mutation_guard: 'Run mutating commands only when login.status is ok or after a successful openyida login.',
      workdir: projectRoot,
      cache_dir: path.join(projectRoot, '.cache'),
      openyida_task_cache_dir: path.join(projectRoot, '.cache', 'openyida'),
      default_full_app_workflow: manifest.summary.core_workflows.full_app_fast_build,
    },
    builder_fast_path: builderFastPath,
    skills: {
      index_file: 'skills-index.json',
      entry: 'openyida',
      category_namespace: 'yida-skills/',
      routing_contract: 'Use route_groups[].signals to choose a yida-skills/<area> category, rank only skills in that category by description/tags/signals, then call use_skill when available.',
      note: 'Use host use_skill/search_skills when available; otherwise load only the current-stage SKILL.md selected by the root routing table.',
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
        full_app: 'Default fast_build is complete after creating the app, core forms, primary page, publishing it, and returning an access URL.',
      },
      fast_build_data_contract: 'Default fast_build page code must not call this.dataSourceMap.* unless the same run created and bound a designer data source; use this.utils.yida.* or an entry-only page by default.',
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
  compactBuilderFastPath,
  buildCommandManifestDigest,
  run,
};
