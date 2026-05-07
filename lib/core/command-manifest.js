'use strict';

function command(id, path, usage, descriptionKey, options = {}) {
  return {
    id,
    path,
    command: path[0],
    name: path.join(' '),
    usage,
    descriptionKey,
    requiresLogin: options.requiresLogin !== false,
    output: options.output || 'text',
    aliases: options.aliases || [],
    examples: options.examples || [],
  };
}

const COMMAND_GROUPS = [
  {
    id: 'auth',
    titleKey: 'help.group_auth',
    commands: [
      command('login', ['login'], 'login [--qr|--browser] [--corp-id <corpId>]', 'help.cmd_login', {
        requiresLogin: false,
        output: 'json',
      }),
      command('logout', ['logout'], 'logout', 'help.cmd_logout', { requiresLogin: false }),
      command('auth', ['auth'], 'auth <status|login|refresh|logout>', 'help.cmd_auth', { requiresLogin: false }),
      command('org', ['org'], 'org <list|switch>', 'help.cmd_org'),
      command('env', ['env'], 'env [--json]', 'help.cmd_env', {
        requiresLogin: false,
        output: 'text|json',
      }),
      command('env-management', ['env'], 'env <list|show|switch|add|remove>', 'help.cmd_env_management', {
        requiresLogin: false,
      }),
    ],
  },
  {
    id: 'app',
    titleKey: 'help.group_app',
    commands: [
      command('app-list', ['app-list'], 'app-list [--size N]', 'help.cmd_app_list'),
      command('create-app', ['create-app'], 'create-app "<name>" [options]', 'help.cmd_create_app'),
      command('update-app', ['update-app'], 'update-app <appType> --name "..."', 'help.cmd_update_app'),
      command('export', ['export'], 'export <appType> [output]', 'help.cmd_export'),
      command('import', ['import'], 'import <file> [name]', 'help.cmd_import'),
    ],
  },
  {
    id: 'form',
    titleKey: 'help.group_form',
    commands: [
      command('create-form.create', ['create-form', 'create'], 'create-form create <appType> ...', 'help.cmd_create_form'),
      command('create-form.update', ['create-form', 'update'], 'create-form update <appType> ...', 'help.cmd_update_form'),
      command('list-forms', ['list-forms'], 'list-forms <appType> [--keyword <text>]', 'help.cmd_list_forms'),
      command('get-schema', ['get-schema'], 'get-schema <appType> <formUuid|--all>', 'help.cmd_get_schema'),
      command('create-page', ['create-page'], 'create-page <appType> "<name>"', 'help.cmd_create_page'),
      command('generate-page', ['generate-page'], 'generate-page <template>', 'help.cmd_generate_page'),
      command('check-page', ['check-page'], 'check-page <src>', 'help.cmd_check_page', { output: 'text|json' }),
      command('compile', ['compile'], 'compile <src>', 'help.cmd_compile', { requiresLogin: false }),
      command('publish', ['publish'], 'publish <src> <appType> <formUuid>', 'help.cmd_publish'),
      command('update-form-config', ['update-form-config'], 'update-form-config <appType> ...', 'help.cmd_update_form_config'),
    ],
  },
  {
    id: 'data',
    titleKey: 'help.group_data',
    commands: [
      command('data', ['data'], 'data <action> <resource> [args]', 'help.cmd_data'),
      command('task-center', ['task-center'], 'task-center <type> [options]', 'help.cmd_task_center'),
      command('get-permission', ['get-permission'], 'get-permission <appType> <formUuid>', 'help.cmd_get_permission'),
      command('save-permission', ['save-permission'], 'save-permission <appType> <formUuid> ...', 'help.cmd_save_permission'),
    ],
  },
  {
    id: 'process',
    titleKey: 'help.group_process',
    commands: [
      command('configure-process', ['configure-process'], 'configure-process <appType> ...', 'help.cmd_configure_process'),
      command('create-process', ['create-process'], 'create-process <appType> ...', 'help.cmd_create_process'),
      command('process.preview', ['process', 'preview'], 'process preview <appType> ...', 'help.cmd_process_preview'),
    ],
  },
  {
    id: 'share',
    titleKey: 'help.group_share',
    commands: [
      command('verify-short-url', ['verify-short-url'], 'verify-short-url <appType> ...', 'help.cmd_verify_url'),
      command('save-share-config', ['save-share-config'], 'save-share-config <appType> ...', 'help.cmd_save_share'),
      command('get-page-config', ['get-page-config'], 'get-page-config <appType> <formUuid>', 'help.cmd_get_page_config'),
    ],
  },
  {
    id: 'report',
    titleKey: 'help.group_report',
    commands: [
      command('create-report', ['create-report'], 'create-report <appType> "<name>" ...', 'help.cmd_create_report'),
      command('append-chart', ['append-chart'], 'append-chart <appType> <reportId> ...', 'help.cmd_append_chart'),
    ],
  },
  {
    id: 'connector',
    titleKey: 'help.group_connector',
    commands: [
      command('connector.list', ['connector', 'list'], 'connector list', 'help.cmd_connector_list'),
      command('connector.create', ['connector', 'create'], 'connector create "name" "domain" ...', 'help.cmd_connector_create'),
      command('connector.detail', ['connector', 'detail'], 'connector detail <id>', 'help.cmd_connector_detail'),
      command('connector.delete', ['connector', 'delete'], 'connector delete <id>', 'help.cmd_connector_delete'),
      command('connector.add-action', ['connector', 'add-action'], 'connector add-action --operations <file> --connector-id <id>', 'help.cmd_connector_add_action'),
      command('connector.list-actions', ['connector', 'list-actions'], 'connector list-actions <id>', 'help.cmd_connector_list_actions'),
      command('connector.delete-action', ['connector', 'delete-action'], 'connector delete-action <id> <operation-id>', 'help.cmd_connector_delete_action'),
      command('connector.test', ['connector', 'test'], 'connector test --connector-id <id> --action <actionId>', 'help.cmd_connector_test'),
      command('connector.list-connections', ['connector', 'list-connections'], 'connector list-connections <id>', 'help.cmd_connector_list_connections'),
      command('connector.create-connection', ['connector', 'create-connection'], 'connector create-connection <id> <name>', 'help.cmd_connector_create_connection'),
      command('connector.smart-create', ['connector', 'smart-create'], 'connector smart-create --curl "..."', 'help.cmd_connector_smart'),
      command('connector.parse-api', ['connector', 'parse-api'], 'connector parse-api [options]', 'help.cmd_connector_parse_api'),
      command('connector.gen-template', ['connector', 'gen-template'], 'connector gen-template [output]', 'help.cmd_connector_gen_template'),
    ],
  },
  {
    id: 'integration',
    titleKey: 'help.group_integration',
    commands: [
      command('integration.create', ['integration', 'create'], 'integration create <appType> ...', 'help.cmd_integration'),
      command('dws', ['dws'], 'dws <command> [args]', 'help.cmd_dws'),
    ],
  },
  {
    id: 'utility',
    titleKey: 'help.group_utility',
    commands: [
      command('commands', ['commands'], 'commands [--json]', 'help.cmd_commands', {
        requiresLogin: false,
        output: 'json',
      }),
      command('copy', ['copy'], 'copy [--force]', 'help.cmd_copy', { requiresLogin: false }),
      command('sample', ['sample'], 'sample [--list]', 'help.cmd_sample', { requiresLogin: false }),
      command('doctor', ['doctor'], 'doctor [--fix]', 'help.cmd_doctor', { requiresLogin: false }),
      command('formula.evaluate', ['formula', 'evaluate'], 'formula evaluate <formula|file> [--schema file]', 'help.cmd_formula_evaluate', {
        requiresLogin: false,
        output: 'text|json',
      }),
      command('update', ['update'], 'update', 'help.cmd_update', { requiresLogin: false }),
      command('export-conversation', ['export-conversation'], 'export-conversation [options]', 'help.cmd_export_conversation', {
        requiresLogin: false,
      }),
      command('flash-to-prd', ['flash-to-prd'], 'flash-to-prd --file <path> --name "<project>"', 'help.cmd_flash_to_prd', {
        requiresLogin: false,
      }),
      command('cdn-config', ['cdn-config'], 'cdn-config [options]', 'help.cmd_cdn_config'),
      command('cdn-upload', ['cdn-upload'], 'cdn-upload <image-path>', 'help.cmd_cdn_upload'),
      command('cdn-refresh', ['cdn-refresh'], 'cdn-refresh [options]', 'help.cmd_cdn_refresh'),
    ],
  },
];

function flattenCommandManifest(groups = COMMAND_GROUPS) {
  return groups.flatMap(group => group.commands.map(entry => ({ ...entry, group: group.id })));
}

function localizeCommand(entry, translate) {
  return {
    id: entry.id,
    name: entry.name,
    path: entry.path,
    command: entry.command,
    usage: `openyida ${entry.usage}`,
    raw_usage: entry.usage,
    description: translate(entry.descriptionKey),
    description_key: entry.descriptionKey,
    group: entry.group,
    requires_login: entry.requiresLogin,
    output: entry.output,
    aliases: entry.aliases,
    examples: entry.examples,
  };
}

function buildCommandManifest(options = {}) {
  const translate = typeof options.t === 'function' ? options.t : key => key;
  const commands = flattenCommandManifest();

  return {
    schema_version: 1,
    name: 'openyida',
    version: options.version || null,
    aliases: ['yida'],
    command_prefix: 'openyida',
    groups: COMMAND_GROUPS.map(group => ({
      id: group.id,
      title: translate(group.titleKey),
      title_key: group.titleKey,
      commands: group.commands.map(entry => entry.id),
    })),
    commands: commands.map(entry => localizeCommand(entry, translate)),
  };
}

module.exports = {
  COMMAND_GROUPS,
  buildCommandManifest,
  flattenCommandManifest,
};
