'use strict';

const path = require('path');
const { version } = require('../../package.json');
const { t } = require('./i18n');
const { buildCommandManifest } = require('./command-manifest');
const { buildEnvironmentSnapshot } = require('./env');
const { checkLoginOnly } = require('../auth/login');

function redactLogin(login) {
  const redacted = { ...login };
  delete redacted.csrf_token;
  delete redacted.cookies;
  return redacted;
}

function buildAgentCapabilities() {
  const envSnapshot = buildEnvironmentSnapshot();
  const loginStatus = redactLogin(checkLoginOnly({ includeSecrets: false }));
  const manifest = buildCommandManifest({ t, version });
  const projectRoot = envSnapshot.active.projectRoot;

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
      preflight_command: 'openyida agent-capabilities --json',
      mutation_guard: 'Run mutating commands only when login.status is ok or after a successful openyida login.',
      workdir: projectRoot,
      cache_dir: path.join(projectRoot, '.cache'),
      openyida_task_cache_dir: path.join(projectRoot, '.cache', 'openyida'),
      default_full_app_workflow: manifest.summary.core_workflows.full_app_fast_build,
    },
    skills: {
      index_file: 'skills-index.json',
      entry: 'openyida',
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
        'openyida agent-capabilities --json',
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

async function run() {
  console.log(JSON.stringify(buildAgentCapabilities(), null, 2));
}

module.exports = {
  buildAgentCapabilities,
  run,
};
