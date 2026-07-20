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
      side_effect_counts: manifest.summary.side_effect_counts,
      permission_mode_counts: manifest.summary.permission_mode_counts,
      core_workflows: manifest.summary.core_workflows,
    },
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
  };
}

function buildAgentCapabilities() {
  const envSnapshot = buildEnvironmentSnapshot();
  const manifest = buildCommandManifest({ t, version });
  const projectRoot = envSnapshot.active.projectRoot;
  const loginStatus = redactLogin(getAuthStatus({ projectRoot, includeSecrets: false }));

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
  buildCommandManifestDigest,
  run,
};
