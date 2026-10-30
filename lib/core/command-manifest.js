'use strict';

const { getMaterialSourcingGuidance } = require('../asset/ai-image');
const { validateManagedPolicy, managedPolicySchema } = require('./managed-policy');
const { getVisualDecisionPolicy } = require('../design-plan/visual-policy');
const { confirmationPolicy } = require('../design-plan/confirmation');
const { getPageNavigationContract } = require('../design-plan/navigation-policy');
const { ENTRY_MODES } = require('../design-plan/entry-navigation');
const { DIVIDER_TYPES, DEFAULT_DIVIDER_TYPE } = require('../app/form-field-validator');
const { FORMULA_COMMANDS } = require('../formula/cli-contract');
const { printTemplateCommand, printTemplateEffects, printTemplatePermission } = require('../print-template/contract');

/** 应用交付只约定入口内容；展示方式由宿主负责。 */
function buildEntryDeliveryPolicy() {
  return {
    delivery_unit: 'application_entries',
    presentation: 'host_managed',
    entry_delivery: {
      max_count: 3,
      deduplicate_by: 'verified_url',
      order: ['frontend', 'management', 'admin'],
      by_scope: {
        'service-management': ['frontend', 'management', 'admin'],
        'frontend-only': ['frontend', 'admin'],
        'backend-only': ['management', 'admin'],
        unified: ['management', 'admin'],
      },
      explicit_user_exclusions: 'take_precedence',
      resource_only: 'current_resource_only',
      missing_entry: 'report_incomplete_without_guessing',
    },
  };
}


const SIDE_EFFECT_BASES = Object.freeze({
  local_read: Object.freeze({
    kind: 'local_read',
    mutates_yida: false,
    mutates_local: false,
  }),
  local_write: Object.freeze({
    kind: 'local_write',
    mutates_yida: false,
    mutates_local: true,
  }),
  remote_read: Object.freeze({
    kind: 'remote_read',
    mutates_yida: false,
    mutates_local: false,
  }),
  remote_write: Object.freeze({
    kind: 'remote_write',
    mutates_yida: true,
    mutates_local: false,
  }),
  mixed: Object.freeze({
    kind: 'mixed',
    mutates_yida: true,
    mutates_local: true,
    action_dependent: true,
    note: 'Action-dependent command: inspect read_actions and mutating_actions for the selected subcommand/options before deciding whether it is safe to run.',
  }),
});

const SIDE_EFFECT_SCHEMA = Object.freeze({
  version: 1,
  fields: {
    kind: 'One of local_read, local_write, remote_read, remote_write, mixed.',
    mutates_yida: 'Whether at least one action for this command can mutate remote Yida resources.',
    mutates_local: 'Whether at least one action for this command can mutate local files, config, cache, services, or auth state.',
    read_actions: 'For mixed commands, subcommands/options that are read-only.',
    mutating_actions: 'For mixed commands, subcommands/options that mutate local or remote state.',
    action_dependent: 'True for mixed commands; callers must inspect the selected action instead of trusting kind alone.',
  },
  kinds: {
    local_read: 'Reads local state or validates local files without mutation.',
    local_write: 'Writes local files, config, cache, auth state, or starts local-only setup.',
    remote_read: 'Reads remote Yida/DingTalk state without mutation.',
    remote_write: 'Mutates remote Yida/DingTalk resources.',
    mixed: 'Action-dependent command. Inspect mutates_yida, mutates_local, read_actions, and mutating_actions for the selected subcommand/options; unknown actions should be treated as mutating.',
  },
});

const PERMISSION_SCHEMA = Object.freeze({
  version: 1,
  fields: {
    mode: 'Default agent execution decision: allow, ask, or deny. Action-dependent commands must be checked against ask_actions before using the default.',
    effect: 'Primary effect category: read, write, external, destructive, or unknown.',
    reason: 'Human-readable rationale for the permission decision.',
    action_dependent: 'True when the top-level command contains both read-only and mutating actions.',
    read_actions: 'For action-dependent commands, subcommands/options that can be treated as allow/read.',
    preauthorized_actions: 'For action-dependent commands, mutating subcommands/options that are explicitly pre-authorized by policy.',
    ask_actions: 'For action-dependent commands, subcommands/options that should require confirmation.',
    preauthorized_patterns: 'Structured argument matchers that are explicitly pre-authorized by policy.',
    ask_patterns: 'Structured argument matchers that require confirmation.',
    unknown_action_mode: 'Decision for unrecognized actions under action-dependent commands. Use ask unless a caller has a more specific local proof.',
  },
  modes: {
    allow: 'Allowed by the current OpenYida agent policy without an extra OpenYida-specific confirmation.',
    ask: 'Requires user confirmation before agent execution; required for destructive operations and explicit-confirmation workflows such as legacy app theme upgrades.',
    deny: 'Should not be auto-executed by an agent.',
  },
  effects: {
    read: 'Reads, validates, inspects, or diagnoses without known mutation.',
    write: 'Creates, updates, publishes, imports, uploads, or writes local/remote state.',
    external: 'Touches identity, browser login, local servers, package updates, or third-party execution.',
    destructive: 'Deletes or removes existing state.',
    unknown: 'Action-dependent; callers should inspect read_actions, preauthorized_actions, ask_actions, and unknown_action_mode before using the default mode.',
  },
});

const FORBIDDEN_ALIAS_SCHEMA = Object.freeze({
  version: 1,
  fields: {
    pattern: 'Human-readable forbidden argv pattern. Match against arguments after openyida/yida.',
    matcher: 'Structured matcher for agents that need deterministic deny decisions.',
    suggested_command_id: 'Canonical command id to run instead.',
    suggested_usage: 'Concrete canonical OpenYida usage to show or execute after parameter correction.',
    alternative_command_ids: 'Optional extra command ids when the alias is ambiguous.',
    alternative_usages: 'Optional concrete usages for alternative command ids.',
    message_key: 'i18n key for the explanation suitable for a CLI hint or agent denial reason.',
    message_args: 'Arguments for message_key interpolation.',
    message: 'Localized explanation generated from message_key when a translator is available.',
  },
  matcher_types: {
    argv_prefix: 'Deny when the invocation argv begins with matcher.tokens.',
    command_has_option: 'Deny when matcher.command is the command root and matcher.option appears anywhere in argv.',
  },
  agent_policy: 'Deny forbidden aliases before asking the user; return suggested_command_id and suggested_usage as the repair hint.',
});

function sideEffect(kind, overrides = {}) {
  if (!SIDE_EFFECT_BASES[kind]) {
    throw new Error('Unknown side effect kind: ' + kind);
  }
  const effect = {
    ...SIDE_EFFECT_BASES[kind],
    ...overrides,
  };
  if (effect.kind === 'mixed') {
    if (!Array.isArray(effect.read_actions)) {
      effect.read_actions = [];
    }
    if (!Array.isArray(effect.mutating_actions)) {
      effect.mutating_actions = [];
    }
  }
  return effect;
}

function sideEffectEntries(ids, effect) {
  return ids.map(id => [id, effect]);
}

function permission(mode, effect, overrides = {}) {
  return {
    mode,
    effect,
    ...overrides,
  };
}

function permissionEntries(ids, metadata) {
  return ids.map(id => [id, metadata]);
}

function actionDependentPermission(options = {}) {
  return permission('allow', 'unknown', {
    reason: ACTION_DEPENDENT_REASON,
    preauthorized_actions: options.preauthorized_actions || [],
    preauthorized_patterns: options.preauthorized_patterns || [],
    ask_actions: options.ask_actions || [],
    ask_patterns: options.ask_patterns || [],
    unknown_action_mode: 'ask',
  });
}

function cloneSideEffect(effect) {
  const cloned = { ...effect };
  if (Array.isArray(effect.read_actions)) {
    cloned.read_actions = [...effect.read_actions];
  }
  if (Array.isArray(effect.mutating_actions)) {
    cloned.mutating_actions = [...effect.mutating_actions];
  }
  return cloned;
}

function cloneSideEffectSchema() {
  return JSON.parse(JSON.stringify(SIDE_EFFECT_SCHEMA));
}

function clonePermissionSchema() {
  return JSON.parse(JSON.stringify(PERMISSION_SCHEMA));
}

function cloneForbiddenAliasSchema() {
  return JSON.parse(JSON.stringify(FORBIDDEN_ALIAS_SCHEMA));
}

function cloneMatcher(matcher) {
  if (!matcher || typeof matcher !== 'object') {
    return matcher;
  }
  const cloned = { ...matcher };
  if (Array.isArray(matcher.tokens)) {
    cloned.tokens = [...matcher.tokens];
  }
  return cloned;
}

function cloneForbiddenAlias(entry) {
  const cloned = {
    ...entry,
    matcher: cloneMatcher(entry.matcher),
  };
  if (Array.isArray(entry.alternative_command_ids)) {
    cloned.alternative_command_ids = [...entry.alternative_command_ids];
  }
  if (Array.isArray(entry.alternative_usages)) {
    cloned.alternative_usages = [...entry.alternative_usages];
  }
  if (Array.isArray(entry.message_args)) {
    cloned.message_args = [...entry.message_args];
  }
  return cloned;
}

function localizeForbiddenAlias(entry, translate) {
  const localized = cloneForbiddenAlias(entry);
  if (localized.message_key) {
    localized.message = translate(localized.message_key, ...(localized.message_args || []));
  }
  return localized;
}

function normalizePermission(metadata, sideEffectMetadata) {
  const normalized = { ...metadata };
  if (sideEffectMetadata && sideEffectMetadata.kind === 'mixed') {
    if (normalized.action_dependent === undefined) {
      normalized.action_dependent = true;
    }
    if (!Array.isArray(normalized.read_actions)) {
      normalized.read_actions = Array.isArray(sideEffectMetadata.read_actions)
        ? [...sideEffectMetadata.read_actions]
        : [];
    }
  }
  return normalized;
}

function clonePermission(metadata) {
  const cloned = { ...metadata };
  if (Array.isArray(metadata.read_actions)) {
    cloned.read_actions = [...metadata.read_actions];
  }
  if (Array.isArray(metadata.preauthorized_actions)) {
    cloned.preauthorized_actions = [...metadata.preauthorized_actions];
  }
  if (Array.isArray(metadata.preauthorized_patterns)) {
    cloned.preauthorized_patterns = metadata.preauthorized_patterns.map(pattern => ({ ...pattern }));
  }
  if (Array.isArray(metadata.ask_actions)) {
    cloned.ask_actions = [...metadata.ask_actions];
  }
  if (Array.isArray(metadata.ask_patterns)) {
    cloned.ask_patterns = metadata.ask_patterns.map(pattern => ({ ...pattern }));
  }
  return cloned;
}

function cloneJsonMetadata(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return JSON.parse(JSON.stringify(value));
}

function listCommandSideEffectIds() {
  return [...COMMAND_SIDE_EFFECTS.keys()].sort();
}

function listCommandPermissionIds() {
  return [...COMMAND_PERMISSIONS.keys()].sort();
}

function normalizeInvocationArgv(argv = []) {
  const normalized = (Array.isArray(argv) ? argv : [])
    .map(value => String(value || '').trim())
    .filter(Boolean);
  if (normalized[0] === 'openyida' || normalized[0] === 'yida') {
    return normalized.slice(1);
  }
  return normalized;
}

function matcherMatchesArgv(argv, matcher) {
  const normalized = normalizeInvocationArgv(argv);
  if (!matcher || typeof matcher !== 'object' || normalized.length === 0) {
    return false;
  }

  if (matcher.type === 'argv_prefix') {
    const tokens = Array.isArray(matcher.tokens) ? matcher.tokens : [];
    return tokens.length > 0 && tokens.every((token, index) => normalized[index] === token);
  }

  if (matcher.type === 'command_has_option') {
    return normalized[0] === matcher.command && normalized.includes(matcher.option);
  }

  return false;
}

function findForbiddenAliasSuggestion(argv = []) {
  const match = FORBIDDEN_ALIASES.find(entry => matcherMatchesArgv(argv, entry.matcher));
  return match ? cloneForbiddenAlias(match) : null;
}

function levenshteinDistance(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function findNearestCommandSuggestion(argv = []) {
  const normalized = normalizeInvocationArgv(argv);
  const root = normalized[0];
  if (!root) {
    return null;
  }

  const candidates = new Map();
  for (const entry of flattenCommandManifest()) {
    if (!entry.hidden && entry.path && entry.path[0] && !candidates.has(entry.path[0])) {
      candidates.set(entry.path[0], entry);
    }
    for (const alias of entry.aliases || []) {
      const aliasRoot = String(alias || '').trim().split(/\s+/)[0];
      if (aliasRoot && !candidates.has(aliasRoot)) {
        candidates.set(aliasRoot, entry);
      }
    }
  }

  if (candidates.has(root)) {
    return null;
  }

  let best = null;
  for (const [candidate, entry] of candidates) {
    const distance = levenshteinDistance(root, candidate);
    if (!best || distance < best.distance) {
      best = { candidate, entry, distance };
    }
  }

  const threshold = Math.max(2, Math.floor(root.length / 3));
  if (!best || best.distance > threshold) {
    return null;
  }

  return {
    id: `nearest.${root}`,
    pattern: root,
    matcher: { type: 'argv_prefix', tokens: [root] },
    suggested_command_id: best.entry.id,
    suggested_usage: `openyida ${best.entry.usage}`,
    message_key: 'cli.nearest_command_suggestion',
    message_args: [root, best.candidate],
  };
}

function findCommandSuggestion(argv = []) {
  return findForbiddenAliasSuggestion(argv) || findNearestCommandSuggestion(argv);
}

const COMMAND_SIDE_EFFECTS = new Map([
  ['formula.functions', sideEffect('remote_read', { mutates_local: true })],
  ['formula.types', sideEffect('remote_read')],
  ['formula.inspect', sideEffect('remote_read')],
  ['formula.test', sideEffect('remote_read')],

  ['integration.copy', sideEffect('remote_write')],
  ['integration.rename', sideEffect('remote_write')],
  ['integration.delete', sideEffect('remote_write')],
  ['integration.monitor', sideEffect('mixed', { read_actions: ['default', '--dry-run'], mutating_actions: ['--file'] })],
  ['permission-manage', sideEffect('mixed', { read_actions: ['--dry-run'], mutating_actions: ['copy', 'rename', 'delete'] })],
  ['matrix', sideEffect('mixed', { read_actions: ['list', 'detail', 'references', 'rows', '--dry-run'], mutating_actions: ['create', 'update', 'delete', 'upsert-rows', 'delete-rows'] })],
  ['data-manage-style.guide', sideEffect('local_read')],
  ['data-manage-style.list', sideEffect('local_read')],
  ['data-manage-style.generate', sideEffect('local_write')],
  ['app-theme.snapshot', sideEffect('remote_read', { mutates_local: true })],
  ['app-theme.restore', sideEffect('mixed', { read_actions: ['--check', 'default'], mutating_actions: ['--confirm'] })],
  ['upgrade-app-theme', sideEffect('mixed', { mutates_yida: true, mutates_local: true,
    read_actions: ['--prepare'], mutating_actions: ['--confirm'] })],
  ['create-form.batch', sideEffect('remote_write', { mutates_local: true })],
  ...sideEffectEntries([
    'agent-capabilities',
    'check-design',
    'check-page',
    'commands',
    'create-form.icons',
    'create-form.validate-fields',
    'dingtalk-link',
    'design-plan.catalog',
    'formula.evaluate',
    'formula.check',
    'formula.contracts',
    'integration.diagnose',
  ], sideEffect('local_read')),

  ...sideEffectEntries([
    'build-page',
    'cdn-config',
    'compile',
    'connector.gen-template',
    'connector.parse-api',
    'copy',
    'design-plan.init',
    'design-plan.materialize',
    'design-plan.preview',
    'design-plan.patch',
    'export',
    'export-conversation',
    'flash-to-prd',
    'login',
    'login-qwenwork',
    'logout',
    'sample',
    'update',
  ], sideEffect('local_write')),

  ...sideEffectEntries([
    'app-list',
    'app-settings',
    'app-entry.get',
    'connector.detail',
    'connector.list',
    'connector.list-actions',
    'connector.list-connections',
    'check-prd-completeness',
    'dws.contact-user-search',
    'get-form-config',
    'get-page-config',
    'get-permission',
    'get-schema',
    'integration.check',
    'integration.detail-log',
    'integration.list',
    'list-forms',
    'process.preview',
    'process.fields',
    'read-dingtalk-tingji',
    'report.inspect',
    'verify-short-url',
  ], sideEffect('remote_read')),

  ['read-dingtalk-doc', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['<docUrl>', '<docUrl> --json'],
    mutating_actions: ['<docUrl> --output <file>', '<docUrl> -o <file>'],
  })],

  ['report.configure', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['--dry-run'],
    mutating_actions: ['apply configuration'],
  })],

  ['asset', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: ['status', 'sources', 'resolve --offline'],
    mutating_actions: ['resolve', 'resolve --manifest', 'resolve --upload-assets'],
  })],

  ...sideEffectEntries([
    'add-validation',
    'app-offline',
    'app-online',
    'append-chart',
    'cdn-refresh',
    'cdn-upload',
    'configure-process',
    'connector.add-action',
    'connector.update-action',
    'connector.create',
    'connector.create-connection',
    'connector.delete',
    'connector.delete-action',
    'connector.smart-create',
    'connector.test',
    'create-app',
    'create-form.add-option',
    'create-form.bind-datasource',
    'create-form.create',
    'create-form.patch',
    'create-form.resume',
    'create-form.rule',
    'create-form.update',
    'create-form.validation',
    'create-page',
    'create-process',
    'create-report',
    'externalize-form',
    'import',
    'integration.create',
    'integration.disable',
    'integration.enable',
    'publish',
    'save-permission',
    'save-share-config',
    'update-app',
    'app-entry.set',
    'update-form-config',
  ], sideEffect('remote_write')),

  ['ai', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['text', 'image --image-url'],
    mutating_actions: ['image --file'],
  })],
  ['ai-form-setting', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['get', 'fields', 'models'],
    mutating_actions: ['enable', 'disable', 'save'],
  })],
  ['agent-center', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['list', 'range', 'search-user'],
    mutating_actions: ['create', 'update', 'cancel'],
  })],
  ['a2a', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['agent-card'],
    mutating_actions: ['serve'],
  })],
  ['agent', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['doctor', 'status'],
    mutating_actions: ['connect', 'run', 'disconnect', 'logout'],
    note: 'Explicit local-agent control. Remote runs use only the current task grant and never read a personal OpenYida profile.',
  })],
  ['custom-button', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: ['list', 'inspect', 'options'],
    mutating_actions: ['create', 'update', 'delete'],
  })],
  ['form-message', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: ['list', 'inspect', 'options'],
    mutating_actions: ['create', 'update', 'delete'],
  })],
  ['cool-card', sideEffect('mixed', { mutates_yida: true, mutates_local: true, read_actions: ['list', 'templates', 'get'], mutating_actions: ['create'] })],
  ['solution-template', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: ['search', 'detail', 'prepare', 'ai-build', 'status'],
    mutating_actions: ['enable'],
    note: 'Direct enable writes a durable local request receipt before the one-shot platform copy. AI build only validates the template and returns the native builder handoff.',
  })],
  ['data-card', sideEffect('mixed', { mutates_yida: true, mutates_local: true, read_actions: ['list', 'get', 'probe', 'release-check', 'refs'], mutating_actions: ['create', 'save', 'publish', 'release-get', 'release-save', 'release-test'], note: 'release-get reads broadcast settings but the native backend may initialize the application cool app; classify it conservatively as a possible mutation.' })],
  ['plugin', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: ['dev-list', 'get', 'version-list', 'version-get', 'extensions', 'installed-list', 'installed-get', 'runtime-list', 'probe'],
    mutating_actions: ['create', 'create-version', 'save-dev', 'configure', 'enable', 'disable', 'upgrade', 'uninstall'],
    note: 'Organization-level YiDA plugin lifecycle. Writes require --confirm and deterministic readback; save-dev also writes a local backup.',
  })],
  ['print-template', sideEffect('mixed', printTemplateEffects)],
  ['form-view', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: ['list', 'inspect'],
    mutating_actions: ['save', 'create', 'order'],
  })],
  ['aggregate-table', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['list', 'inspect', 'preview', 'status'],
    mutating_actions: ['create-empty', 'save', 'publish'],
  })],
  ['app-permission', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['get', 'search-user'],
    mutating_actions: ['set', 'add', 'remove'],
  })],
  ['auth', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['status', 'profiles', 'profile list'],
    mutating_actions: ['login', 'refresh', 'logout', 'profile switch', 'qwenwork user-info'],
  })],
  ['batch', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: [],
    mutating_actions: ['depends on commands in batch'],
  })],
  ['integration.update', sideEffect('mixed', { mutates_yida: true, mutates_local: true,
    read_actions: ['--dry-run'], mutating_actions: ['apply patch'] })],
  ['basic-info', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['default', 'overview', 'commodity', 'grant', 'capacity', 'quota', 'abs-path', 'dataflow', 'i18n', 'domain'],
    mutating_actions: ['domain set'],
  })],
  ['bridge', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: [],
    mutating_actions: ['start'],
  })],
  ['corp-efficiency', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['overview', 'details', 'detail', 'groups'],
    mutating_actions: ['notify'],
  })],
  ['corp-manager', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['search-user', 'list'],
    mutating_actions: ['add', 'remove', 'address-book'],
  })],
  ['data', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['query', 'get'],
    mutating_actions: ['create', 'update', 'delete', 'transfer'],
  })],
  ['db-seq-fix', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['default', '--dry-run'],
    mutating_actions: ['--fix'],
  })],
  ['doctor', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['default'],
    mutating_actions: ['--fix'],
  })],
  ['dws', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['help', 'install', 'setup', 'contact user search', 'calendar event list', 'approval instance list'],
    mutating_actions: ['todo task create', 'chat robot send', 'depends on dws command'],
  })],
  ['env', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['default', '--json', 'list', 'show'],
    mutating_actions: ['setup', 'switch', 'add', 'remove'],
  })],
  ['er', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['default', '--format json'],
    mutating_actions: ['--output'],
  })],
  ['feedback', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: ['url', 'status', 'github status'],
    mutating_actions: ['setup', 'dismiss', 'report', 'github setup --install --confirm', 'github star', 'github fork'],
  })],
  ['i18n', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['overview', 'config', 'languages', 'list'],
    mutating_actions: ['upsert', 'delete', 'translate', 'translate-all', 'upgrade'],
  })],
  ['mcp', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: [],
    mutating_actions: ['default'],
  })],
  ['nav-group', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['list'],
    mutating_actions: ['create', 'rename', 'delete', 'move', 'order', 'auto-order', 'hide', 'show'],
  })],
  ['org', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['list'],
    mutating_actions: ['switch'],
  })],
  ['task-center', sideEffect('mixed', {
    mutates_yida: false,
    mutates_local: true,
    read_actions: ['todo', 'created', 'done', 'cc', 'proxy', 'capabilities', 'link', 'options', 'inspect', 'count'],
    mutating_actions: ['scaffold'],
  })],
]);

const ALLOW_WRITE_REASON = 'Allowed by policy: non-destructive write, update, publish, import, upload, or local file operation.';
const ALLOW_EXTERNAL_REASON = 'Allowed by policy: non-destructive auth, external service, local server, or package operation.';
const ACTION_DEPENDENT_REASON = 'Action-dependent command: allow only read_actions or preauthorized_actions; ask ask_actions and unknown mutating actions.';

const COMMAND_PERMISSIONS = new Map([
  ...permissionEntries([
    'agent-capabilities',
    'app-list',
    'app-entry.get',
    'app-settings',
    'check-design',
    'check-prd-completeness',
    'check-page',
    'commands',
    'connector.detail',
    'connector.list',
    'connector.list-actions',
    'connector.list-connections',
    'create-form.icons',
    'create-form.validate-fields',
    'dingtalk-link',
    'design-plan.catalog',
    'dws.contact-user-search',
    'formula.evaluate',
    'formula.check',
    'formula.contracts',
    'formula.functions',
    'formula.types',
    'formula.inspect',
    'formula.test',
    'get-form-config',
    'get-page-config',
    'get-permission',
    'get-schema',
    'integration.check',
    'integration.detail-log',
    'integration.diagnose',
    'integration.list',
    'list-forms',
    'process.preview',
    'process.fields',
    'read-dingtalk-tingji',
    'report.inspect',
    'verify-short-url',
  ], permission('allow', 'read', {
    reason: 'Read-only, diagnostic, validation, or manifest discovery command.',
  })),

  ['read-dingtalk-doc', actionDependentPermission({
    preauthorized_actions: [
      '<docUrl> --output <file>',
      '<docUrl> -o <file>',
    ],
    preauthorized_patterns: [{
      type: 'argv_contains_any',
      values: ['http://', 'https://'],
      description: 'A valid document URL is present; optional output writes are non-destructive local operations.',
    }],
  })],

  ...permissionEntries([
    'add-validation',
    'app-online',
    'append-chart',
    'build-page',
    'cdn-config',
    'cdn-refresh',
    'cdn-upload',
    'compile',
    'configure-process',
    'connector.add-action',
    'connector.update-action',
    'connector.create',
    'connector.create-connection',
    'connector.gen-template',
    'connector.parse-api',
    'connector.smart-create',
    'copy',
    'create-app',
    'create-form.add-option',
    'create-form.bind-datasource',
    'create-form.create',
    'create-form.batch',
    'create-form.patch',
    'create-form.resume',
    'create-form.rule',
    'create-form.update',
    'create-form.validation',
    'create-page',
    'create-process',
    'create-report',
    'design-plan.init',
    'design-plan.materialize',
    'design-plan.preview',
    'design-plan.patch',
    'export-conversation',
    'externalize-form',
    'export',
    'flash-to-prd',
    'import',
    'integration.create',
    'integration.update',
    'integration.disable',
    'integration.enable',
    'publish',
    'sample',
    'save-permission',
    'save-share-config',
    'update-app',
    'app-entry.set',
    'update-form-config',
  ], permission('allow', 'write', {
    reason: ALLOW_WRITE_REASON,
  })),

  ...permissionEntries([
    'login',
    'login-qwenwork',
    'logout',
    'update',
  ], permission('allow', 'external', {
    reason: ALLOW_EXTERNAL_REASON,
  })),

  ...permissionEntries([
    'connector.test',
  ], permission('allow', 'external', {
    reason: ALLOW_EXTERNAL_REASON,
  })),

  ...permissionEntries(['data-manage-style.guide', 'data-manage-style.list'], permission('allow', 'read')),
  ...permissionEntries(['data-manage-style.generate'], permission('allow', 'write', { reason: 'Generate a new local CSS file; no remote mutations.' })),
  ...permissionEntries(['app-theme.snapshot'], permission('allow', 'read', {
    reason: 'Read application theme configuration and archive CSS into a new local directory.',
  })),
  ...permissionEntries(['app-theme.restore'], permission('ask', 'write', {
    action_dependent: true, read_actions: ['--check', 'default'], ask_actions: ['--confirm'],
    preauthorized_actions: [], preauthorized_patterns: [], ask_patterns: [], unknown_action_mode: 'ask',
    reason: 'Confirm only for a user-authorized rollback of this UI improvement. A prior restore request remains valid; do not ask twice. Without --confirm this only checks the restore plan.',
  })),

  ...permissionEntries(['upgrade-app-theme'], permission('ask', 'write', {
    action_dependent: true, read_actions: ['--prepare'], ask_actions: ['--confirm'],
    preauthorized_actions: [], preauthorized_patterns: [], ask_patterns: [], unknown_action_mode: 'ask',
    reason: 'Only on an explicit user request to upgrade this existing app to the modern theme; require ask_human confirmation for the target app before execution. General beautification, app creation and blanket authorization do not qualify.',
  })),

  ...permissionEntries([
    'app-offline',
    'connector.delete',
    'connector.delete-action',
  ], permission('ask', 'destructive', {
    reason: 'Deletes, removes, or disables existing remote state.',
  })),

  ...permissionEntries([
    'a2a',
  ], actionDependentPermission({
    preauthorized_actions: ['serve'],
  })),
  ...permissionEntries([
    'agent',
  ], actionDependentPermission({
    ask_actions: ['connect', 'run', 'disconnect', 'logout'],
  })),

  ...permissionEntries(['print-template'], actionDependentPermission(printTemplatePermission)),
  ...permissionEntries(['cool-card'], actionDependentPermission({ preauthorized_actions: ['create'] })),
  ...permissionEntries(['solution-template'], actionDependentPermission({ ask_actions: ['enable'] })),
  ...permissionEntries(['data-card'], actionDependentPermission({ preauthorized_actions: ['create', 'save', 'publish', 'release-get'], ask_actions: ['release-save', 'release-test'] })),
  ...permissionEntries(['plugin'], actionDependentPermission({
    ask_actions: ['create', 'create-version', 'save-dev', 'configure', 'enable', 'disable', 'upgrade', 'uninstall'],
  })),
  ...permissionEntries([
    'form-view',
  ], actionDependentPermission({
    preauthorized_actions: ['save', 'create', 'order'],
  })),

  ...permissionEntries([
    'custom-button',
  ], actionDependentPermission({
    preauthorized_actions: ['create', 'update'],
    ask_actions: ['delete'],
  })),

  ...permissionEntries([
    'form-message',
  ], actionDependentPermission({
    preauthorized_actions: ['create', 'update'],
    ask_actions: ['delete'],
  })),

  ...permissionEntries([
    'aggregate-table',
  ], actionDependentPermission({
    preauthorized_actions: ['create-empty', 'save', 'publish'],
  })),

  ...permissionEntries([
    'asset',
  ], actionDependentPermission({
    preauthorized_actions: ['resolve', 'resolve --manifest', 'resolve --upload-assets'],
  })),

  ...permissionEntries([
    'ai',
  ], actionDependentPermission({
    preauthorized_actions: ['image --file'],
  })),

  ...permissionEntries([
    'agent-center',
  ], actionDependentPermission({
    preauthorized_actions: ['create', 'update', 'cancel'],
  })),

  ...permissionEntries([
    'ai-form-setting',
  ], actionDependentPermission({
    preauthorized_actions: ['enable', 'disable', 'save'],
  })),

  ...permissionEntries([
    'app-permission',
  ], actionDependentPermission({
    preauthorized_actions: ['set', 'add'],
    ask_actions: ['remove'],
  })),

  ...permissionEntries([
    'auth',
  ], actionDependentPermission({
    preauthorized_actions: ['login', 'refresh', 'logout', 'profile switch', 'qwenwork user-info'],
  })),

  ...permissionEntries([
    'batch',
  ], actionDependentPermission({
    preauthorized_patterns: [{
      type: 'option_value_excludes_any',
      option: '--commands',
      values: ['delete', 'remove'],
      description: 'Inline batch commands that do not contain delete/remove.',
    }],
    ask_patterns: [{
      type: 'argv_contains_any',
      values: ['delete', 'remove'],
      description: 'Batch command arguments or inline command text contains delete/remove.',
    }],
  })),

  ...permissionEntries([
    'basic-info',
  ], actionDependentPermission({
    preauthorized_actions: ['domain set'],
  })),

  ...permissionEntries([
    'bridge',
  ], actionDependentPermission({
    preauthorized_actions: ['start'],
  })),

  ...permissionEntries([
    'corp-efficiency',
  ], actionDependentPermission({
    preauthorized_actions: ['notify'],
  })),

  ...permissionEntries([
    'corp-manager',
  ], actionDependentPermission({
    preauthorized_actions: ['add', 'address-book'],
    ask_actions: ['remove'],
  })),

  ...permissionEntries([
    'data',
  ], actionDependentPermission({
    preauthorized_actions: ['create', 'update', 'transfer'],
    ask_actions: ['delete'],
  })),

  ...permissionEntries([
    'db-seq-fix',
  ], actionDependentPermission({
    preauthorized_actions: ['--fix'],
  })),

  ...permissionEntries([
    'doctor',
  ], actionDependentPermission({
    preauthorized_actions: ['--fix'],
  })),

  ...permissionEntries([
    'dws',
  ], actionDependentPermission({
    preauthorized_actions: ['install', 'setup', 'todo task create', 'chat robot send'],
    ask_actions: ['unrecognized dws command'],
  })),

  ...permissionEntries([
    'env',
  ], actionDependentPermission({
    preauthorized_actions: ['setup', 'switch', 'add'],
    ask_actions: ['remove'],
  })),

  ...permissionEntries([
    'er',
  ], actionDependentPermission({
    preauthorized_actions: ['--output'],
  })),

  ...permissionEntries([
    'feedback',
  ], actionDependentPermission({
    preauthorized_actions: ['setup', 'dismiss', 'report'],
  })),

  ...permissionEntries([
    'i18n',
  ], actionDependentPermission({
    preauthorized_actions: ['upsert', 'translate', 'translate-all', 'upgrade'],
    ask_actions: ['delete'],
  })),

  ...permissionEntries([
    'mcp',
  ], actionDependentPermission({
    preauthorized_actions: ['default'],
  })),

  ...permissionEntries([
    'nav-group',
  ], actionDependentPermission({
    preauthorized_actions: ['create', 'rename', 'move', 'order', 'auto-order', 'hide', 'show'],
    ask_actions: ['delete'],
  })),

  ...permissionEntries([
    'org',
  ], actionDependentPermission({
    preauthorized_actions: ['switch'],
  })),

  ...permissionEntries([
    'task-center',
  ], actionDependentPermission({
    preauthorized_actions: ['scaffold'],
  })),
]);

const FORBIDDEN_ALIASES = Object.freeze([
  Object.freeze({
    id: 'forbidden-alias.list-apps',
    pattern: 'list-apps',
    matcher: { type: 'argv_prefix', tokens: ['list-apps'] },
    suggested_command_id: 'app-list',
    suggested_usage: 'openyida app-list [--type managed|created] [--page N] [--size N]',
    message_key: 'cli.forbidden_alias_list_apps',
    message_args: ['list-apps', 'app-list'],
  }),
  Object.freeze({
    id: 'forbidden-alias.get-app',
    pattern: 'get-app',
    matcher: { type: 'argv_prefix', tokens: ['get-app'] },
    suggested_command_id: 'app-list',
    suggested_usage: 'openyida app-list [--type managed|created] [--page N] [--size N]',
    alternative_command_ids: ['get-schema', 'agent-capabilities'],
    alternative_usages: [
      'openyida get-schema <appType> <formUuid|--all> [--summary-json|--field-map-json|--analysis-json]',
      'openyida agent-capabilities --summary-json',
    ],
    message_key: 'cli.forbidden_alias_get_app',
    message_args: ['get-app', 'app-list', 'get-schema', 'agent-capabilities'],
  }),
  Object.freeze({
    id: 'forbidden-alias.create-app-json',
    pattern: 'create-app --json',
    matcher: { type: 'command_has_option', command: 'create-app', option: '--json' },
    suggested_command_id: 'create-app',
    suggested_usage: 'openyida create-app "<name>"|--name <name> [options] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]',
    message_key: 'cli.forbidden_alias_create_app_json',
    message_args: ['create-app --json', 'create-app'],
  }),
  Object.freeze({
    id: 'forbidden-alias.create-page-app-type-option',
    pattern: 'create-page --app-type',
    matcher: { type: 'command_has_option', command: 'create-page', option: '--app-type' },
    suggested_command_id: 'create-page',
    suggested_usage: 'openyida create-page <appType> "<name>" [--mode dashboard] [--hide-nav] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]',
    message_key: 'cli.forbidden_alias_create_page_app_type_option',
    message_args: ['create-page', '--app-type'],
  }),
  Object.freeze({
    id: 'forbidden-alias.create-form-name-fields-options',
    pattern: 'create-form <appType> --name <formTitle> --fields <fieldsJson>',
    matcher: { type: 'command_has_option', command: 'create-form', option: '--fields' },
    suggested_command_id: 'create-form.create',
    suggested_usage: 'openyida create-form create <appType> "<formTitle>" <fieldsJsonFile>',
    message_key: 'cli.forbidden_alias_create_form_name_fields_options',
    message_args: ['create-form', '--name', '--fields'],
  }),
  Object.freeze({
    id: 'forbidden-alias.get-schema-app-type-option',
    pattern: 'get-schema --app-type',
    matcher: { type: 'command_has_option', command: 'get-schema', option: '--app-type' },
    suggested_command_id: 'get-schema',
    suggested_usage: 'openyida get-schema <appType> <formUuid|--all> [--summary-json|--field-map-json|--analysis-json]',
    message_key: 'cli.forbidden_alias_get_schema_app_type_option',
    message_args: ['get-schema', '--app-type'],
  }),
  Object.freeze({
    id: 'forbidden-alias.get-schema-form-uuid-option',
    pattern: 'get-schema --form-uuid',
    matcher: { type: 'command_has_option', command: 'get-schema', option: '--form-uuid' },
    suggested_command_id: 'get-schema',
    suggested_usage: 'openyida get-schema <appType> <formUuid|--all> [--summary-json|--field-map-json|--analysis-json]',
    message_key: 'cli.forbidden_alias_get_schema_form_uuid_option',
    message_args: ['get-schema', '--form-uuid'],
  }),
]);

function command(id, path, usage, descriptionKey, options = {}) {
  const commandSideEffect = COMMAND_SIDE_EFFECTS.get(id);
  if (!commandSideEffect) {
    throw new Error('Missing side effect metadata for command: ' + id);
  }
  const commandPermission = options.permission || COMMAND_PERMISSIONS.get(id);
  if (!commandPermission) {
    throw new Error('Missing permission metadata for command: ' + id);
  }
  const normalizedPermission = normalizePermission(commandPermission, commandSideEffect);
  validateManagedPolicy(options.managedRun, id);

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
    args: cloneJsonMetadata(options.args, []),
    canonical: cloneJsonMetadata(options.canonical, null),
    deprecatedPatterns: cloneJsonMetadata(options.deprecatedPatterns, []),
    repairPatterns: cloneJsonMetadata(options.repairPatterns, []),
    examples: cloneJsonMetadata(options.examples, []),
    notes: cloneJsonMetadata(options.notes, []),
    noteKeys: cloneJsonMetadata(options.noteKeys, []),
    ...(options.resultReuse ? { resultReuse: cloneJsonMetadata(options.resultReuse, null) } : {}),
    hidden: options.hidden === true,
    managedRun: cloneJsonMetadata(options.managedRun, null),
    sideEffect: cloneSideEffect(commandSideEffect),
    permission: clonePermission(normalizedPermission),
  };
}

const COMMAND_GROUPS = [
  {
    id: 'auth',
    titleKey: 'help.group_auth',
    commands: [
      command('login', ['login'], 'login [--qwenwork] [target-url] [--env <name>|--intl|--overseas|--global|--yidaapps|--alibaba] [--client-id <clientId>] [--endpoint <url>] [--no-browser]', 'help.cmd_login', { managedRun: { scope: 'local', allowedFlags: ['--check-only', '--json', '--quiet'], requiredFlags: ['--check-only'] },
        requiresLogin: false,
        output: 'json',
      }),
      command('login-qwenwork', ['login-qwenwork'], 'login-qwenwork --exchange-ticket <ticket> --ticket-context <json> [--json]', 'help.cmd_login_qwenwork', { managedRun: { scope: 'denied', reason: 'identity_exchange' }, requiresLogin: false, output: 'json', hidden: true }),
      command('logout', ['logout'], 'logout', 'help.cmd_logout', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, requiresLogin: false }),
      command('auth', ['auth'], 'auth <status|login|refresh|logout|profiles|profile switch|qwenwork user-info> [--json]', 'help.cmd_auth', { managedRun: { scope: 'actions', actions: { status: { scope: 'local', allowedFlags: ['--json', '--quiet'] }, qwenwork: { scope: 'denied', reason: 'identity_exchange' } } }, requiresLogin: false }),
      command('org', ['org'], 'org <list|switch> [--json] [--corp-id <corpId>]', 'help.cmd_org', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
      command('env', ['env'], 'env [--json|setup|list|show|switch|add|remove] [options]', 'help.cmd_env', { managedRun: { scope: 'local', allowedFlags: ['--json', '--quiet'] },
        requiresLogin: false,
        output: 'text|json',
      }),
    ],
  },
  {
    id: 'app',
    titleKey: 'help.group_app',
    commands: [
      command('app-settings', ['app-settings'], 'app-settings <appType> [--section theme|basic|data-card|cool-card] [--json]', 'app_settings.description', {
        managedRun: { scope: 'app', appPosition: 0 }, output: 'json',
        args: [
          { name: 'appType', type: 'string', source: 'positional', position: 0, required: true },
          { name: 'section', type: 'string', source: 'option', builder_options: ['--section'], choices: ['theme', 'basic', 'data-card', 'cool-card'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Reads the target app before constructing tenant-specific themeSettingsUrl, basicSettingsUrl, dataCardManageUrl and coolCardManageUrl. --section selects the requested entry. Does not change any setting or verify recipient permissions.'],
      }),
      command('cool-card', ['cool-card'], 'cool-card <list|templates|create|get> <appType> [cardPageCode] [--type im|onebox] [--name <title>] [--page <n>] [--size <n>] [--search <text>] [--out <file>] [--json]', 'cool_card.description', {
        managedRun: { scope: 'actions', actions: {
          list: { scope: 'app', appPosition: 1 }, templates: { scope: 'app', appPosition: 1 }, get: { scope: 'app', appPosition: 1 },
          create: { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_setting' } },
        } }, output: 'json',
        args: [
          { name: 'action', type: 'string', source: 'positional', position: 0, required: true, choices: ['list', 'templates', 'create', 'get'] },
          { name: 'appType', type: 'string', source: 'positional', position: 1, required: true },
          { name: 'cardPageCode', type: 'string', source: 'positional', position: 2, description: 'Required only for get; native cool-card form... ID, never a CARD data-card ID.' },
          { name: 'type', type: 'string', source: 'option', builder_options: ['--type'], choices: ['im', 'onebox'], description: 'Required for templates/create, optional for list; not accepted by get.' },
          { name: 'name', type: 'string', source: 'option', builder_options: ['--name'], description: 'Required only for create.' },
          { name: 'page', type: 'string', source: 'option', builder_options: ['--page'], description: 'list/templates only; integer 1–1000.' },
          { name: 'size', type: 'string', source: 'option', builder_options: ['--size'], description: 'list/templates only; integer 1–100.' },
          { name: 'search', type: 'string', source: 'option', builder_options: ['--search'], description: 'list/templates only.' },
          { name: 'out', type: 'file', source: 'option', builder_options: ['--out'], description: 'create/get only; exports a full resource snapshot without overwriting.' },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        examples: ['openyida cool-card list APP_XXX --json', 'openyida cool-card create APP_XXX --type im --name "Order notification" --json'],
        notes: ['Native YiDA cool cards use query/cardDesign, cardPageCode and cardTemplateId. Require explicit choice of native cool cards; generic page cards and CARD data-card resources do not trigger this skill. im means interactive; onebox means pinned. Rendering uses native DingTalk components and protocols, not arbitrary HTML/CSS/React. Stored editorData or build status alone does not verify rendering. For styling beyond native capability, explain the platform limit and offer native redesign, static imagery or a link to a separate page; do not silently replace the chosen native card. templates requires --type and does not instantiate a template. get exports the complete resource snapshot without overwriting a file and parses editorData/variables without altering unknown configuration. create performs one allowlisted write, verifies the returned app/type/name and reads the new resource back. Empty resource creation is not completed configuration. nextAction hands the official entry to the user for configuration/save; its verificationCommand rereads the same resource afterward. Use sample yida-cool-card project-brief for an import-ready local design, not a saved server template. No schema save, publication, copying, official-card switch, entitlement mutation or message delivery is supported; editor build APIs require a separately verified authentication contract. Do not forward YiDA bearer tokens to the external editor or use browser construction as CLI evidence. Preserve platform permission/entitlement errors and inspect resources before retrying an uncertain creation.'],
      }),
      command('data-card', ['data-card'], 'data-card <list|create|get|save|publish|probe|release-get|release-save|release-check|release-test|refs> <appType> [cardCode] [--name <title>] [--description <text>] [--schema <file>|--config <file>] [--expected-hash <hash>] [--backup <file>] [--out <file>] [--published|--version <version>] [--page <n>] [--size <n>] [--search <text>] [--allow-send] [--json]', 'data_card.description', {
        args: [
          { name: 'action', type: 'string', source: 'positional', position: 0, required: true, choices: ['list', 'create', 'get', 'save', 'publish', 'probe', 'release-get', 'release-save', 'release-check', 'release-test', 'refs'] },
          { name: 'appType', type: 'string', source: 'positional', position: 1, required: true },
          { name: 'cardCode', type: 'string', source: 'positional', position: 2, description: 'Required except for list/create; native CARD-... resource ID.' },
          { name: 'name', type: 'string', source: 'option', builder_options: ['--name'], description: 'Required only for create.' },
          { name: 'description', type: 'string', source: 'option', builder_options: ['--description'], description: 'create only.' },
          { name: 'schema', type: 'file', source: 'option', builder_options: ['--schema'], description: 'save only; complete schema, mutually exclusive with --config.' },
          { name: 'config', type: 'file', source: 'option', builder_options: ['--config'], description: 'save requires exactly one of --schema/--config; release-save requires --config; optional for release-test.' },
          { name: 'expectedHash', type: 'string', source: 'option', builder_options: ['--expected-hash'], description: 'Required for save/publish/release-save: original 64-character lowercase SHA-256.' },
          { name: 'backup', type: 'file', source: 'option', builder_options: ['--backup'], description: 'save/publish/release-save only; original configuration backup.' },
          { name: 'out', type: 'file', source: 'option', builder_options: ['--out'], description: 'create/get/release-get only; refuses overwrite.' },
          { name: 'published', type: 'boolean', source: 'option', builder_options: ['--published'], description: 'list/get/probe only; mutually exclusive with --version.' },
          { name: 'version', type: 'string', source: 'option', builder_options: ['--version'], description: 'get only; reads a historical online version.' },
          { name: 'page', type: 'string', source: 'option', builder_options: ['--page'], description: 'list/refs only; integer 1–1000 for list, 1–100 for refs.' },
          { name: 'size', type: 'string', source: 'option', builder_options: ['--size'], description: 'list/refs only; integer 1–100.' },
          { name: 'search', type: 'string', source: 'option', builder_options: ['--search'], description: 'list only.' },
          { name: 'allowSend', type: 'boolean', source: 'option', builder_options: ['--allow-send'], description: 'release-save/release-test only. Required for enabled schedules or test sends; obtain explicit sending authorization.' },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        managedRun: { scope: 'actions', actions: {
          list: { scope: 'app', appPosition: 1 }, get: { scope: 'app', appPosition: 1 }, probe: { scope: 'app', appPosition: 1 },
          create: { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_setting' } },
          save: { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_setting' } },
          publish: { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_setting' } },
          'release-get': { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_setting' } }, 'release-check': { scope: 'app', appPosition: 1 }, refs: { scope: 'app', appPosition: 1 },
          'release-save': { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_setting' } },
          'release-test': { scope: 'denied', reason: 'external_message_sending' },
        } }, output: 'json',
        examples: ['openyida data-card create APP_XXX --name "Sales summary" --json', 'openyida data-card get APP_XXX CARD-XXX --out card-schema.json --json'],
        notes: ['Native dataCardRpc resources. Agent use requires an explicit user choice of native YiDA data cards or continuation of an already explicit native-card task; generic cards, KPIs, dashboards or broadcasts do not trigger this capability. Metric cards rendered by custom page code belong to the page; an embedded CARD reference alone does not authorize changes to its native source. get defaults to the draft; --published reads the online schema. --out exports the complete schema without overwriting a file. save accepts either a complete exported --schema or a simplified --config with charts and optional select filters (legacy indicators remains compatible), appending verified native components. Supports indicator/bar/line/pie/table/combo/gauge/funnel/calendarheatmap with real form fields, aggregates and date grain. Six-column layout, full-width tables and optional gauge min/max ranges. Five chart maximum; filters link only within the same source. probe performs read-only CARD runtime queries and returns component data; a saved schema alone is not runtime evidence. Numeric fields support COUNT/SUM/AVG/MIN/MAX; text and serial fields support COUNT. Config generation preserves the existing page and rejects unsupported keys/types. save requires its original --expected-hash; backs up and rereads before writing, then verifies readback. publish requires the current draft hash, backs up, and verifies the published schema, version and state; it does not save unsent local edits. Hash checks are not atomic server locking. New i18n bindings are synchronized before saving. Writes are not automatically replayed. Preserve platform permission and entitlement errors; never alter quotas or app tags. release-get exports broadcast configuration and releaseHash; the native GET may initialize a cool app and is conservatively classified as a possible mutation; release-save requires its original --expected-hash, backup and verified readback. Enabled schedules require explicit --allow-send; release-test also requires --allow-send and only requests a test to the current operator. release-check checks published state and broadcast entitlement; refs queries portal usage records. Group delivery still requires installation in DingTalk. Successful save or test acceptance does not prove delivery. The CLI does not mount portal components or delete cards. Mutation receipts refresh the app using the existing update_app_setting operation.'],
      }),
      command('plugin', ['plugin'], 'plugin <dev-list|get|version-list|version-get|extensions|installed-list|installed-get|runtime-list|probe|create|create-version|save-dev|configure|enable|disable|upgrade|uninstall> [pluginId] [version] [options]', 'plugin_lifecycle.description', {
        managedRun: { scope: 'denied', reason: 'organization_level_plugin_lifecycle' },
        output: 'json',
        args: [
          { name: 'action', type: 'string', source: 'positional', position: 0, required: true },
          { name: 'pluginId', type: 'string', source: 'positional', position: 1 },
          { name: 'version', type: 'string', source: 'positional', position: 2 },
          { name: 'config', type: 'file', source: 'option', builder_options: ['--config'] },
          { name: 'expectedHash', type: 'string', source: 'option', builder_options: ['--expected-hash'] },
          { name: 'backup', type: 'file', source: 'option', builder_options: ['--backup'] },
          { name: 'extensions', type: 'string', source: 'option', builder_options: ['--extensions'] },
          { name: 'checkResource', type: 'boolean', source: 'option', builder_options: ['--check-resource'] },
          { name: 'type', type: 'string', source: 'option', builder_options: ['--type'], description: 'create only: connector (default) or other; custom-page extensions use other.' },
          { name: 'confirm', type: 'boolean', source: 'option', builder_options: ['--confirm'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        examples: ['openyida plugin dev-list --search AI --json', 'openyida plugin runtime-list --extensions yida.app.custom-page.component --json', 'openyida plugin create --type other --name Timeline --description "Custom page timeline" --logo https://example.com/logo.png --confirm --json'],
        notes: ['YiDA platform plugins, not npm packages or Codex plugins. Read commands separate persisted developer configuration, static resource reachability, runtime registry candidates, enabled state, and actual consumer execution. runtime-list includes disabled candidates and does not prove that an application consumed one. probe --check-resource sends a read-only HEAD request to the resolved HTTPS entry. save-dev and configure require the original hash and a non-overwriting backup; save-dev validates extension IDs and never publishes. Organization-wide writes require --confirm and readback. disable follows platform semantics: it blocks new selection but may not unload existing uses. The CLI intentionally does not publish/release/delete developer plugins or install from the market.'],
      }),
      command('app-entry.get', ['app-entry', 'get'], 'app-entry get <appType> [--json]', 'app_entry.desc_get', { managedRun: {'scope':'app','appPosition':1},
        args: [{ name: 'appType', type: 'string', source: 'positional', position: 0, required: true },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] }],
      }),
      command('app-entry.set', ['app-entry', 'set'], 'app-entry set <appType> [--frontend <url>|--frontend-page <formUuid>] [--management <url>|--management-page <formUuid>] [--clear-frontend] [--clear-management] [--json]', 'app_entry.desc_set', { managedRun: {'scope':'app','appPosition':1,'mutation':{'operation':'update_app_entry'}},
        args: [
          { name: 'appType', type: 'string', source: 'positional', position: 0, required: true },
          { name: 'frontend', type: 'string', source: 'option', builder_options: ['--frontend'] },
          { name: 'frontendPage', type: 'string', source: 'option', builder_options: ['--frontend-page'] },
          { name: 'management', type: 'string', source: 'option', builder_options: ['--management'] },
          { name: 'managementPage', type: 'string', source: 'option', builder_options: ['--management-page'] },
          { name: 'clearFrontend', type: 'boolean', source: 'option', builder_options: ['--clear-frontend'] },
          { name: 'clearManagement', type: 'boolean', source: 'option', builder_options: ['--clear-management'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Complete URLs, including workbench page IDs, are preserved. --frontend-page requires a published display page plus a live hidden-navigation readback, using the same standalone URL resolver as publish; missing/mismatched config or visible navigation prevents writing. Results return urls.frontend/management and configurationReadback separately from runtimeVerified. --management-page verifies ownership and builds /workbench/<formUuid>. Generated URLs need runtime verification; public entries require the verified complete URL. --frontend-page is a standalone shortcut only; an explicitly planned platform-shell frontend uses --frontend with its verified workbenchUrl. This command does not hide navigation, publish pages or change permissions. Entry registration accepts only platform-supported routes and query parameters; do not strip required per-open parameters from a rejected URL to claim an equivalent entry. Omitted entries remain unchanged.'],
      }),
      command('app-list', ['app-list'], 'app-list [--type managed|created] [--page N] [--size N]', 'help.cmd_app_list', { managedRun: {'scope':'denied','reason':'scope_not_audited'},
        notes: ['Successful results include appUrl/workbenchUrl for the business workspace and adminUrl for developer administration. Complete application delivery retains adminUrl regardless of auth runtime; route construction does not verify recipient access. Preserve the frontend URL from its own page result.'],
      }),
      command('solution-template', ['solution-template'], 'solution-template <search|detail|prepare|ai-build|enable|status> [templateId|requestId] [options] [--json]', 'solution_template.description', {
        managedRun: { scope: 'denied', reason: 'creates_new_application_or_requires_native_builder_handoff' },
        output: 'json',
        args: [
          { name: 'action', type: 'string', source: 'positional', position: 0, required: true, choices: ['search', 'detail', 'prepare', 'ai-build', 'enable', 'status'] },
          { name: 'identity', type: 'string', source: 'positional', position: 1, description: 'TPL_ template ID for detail/prepare/ai-build/enable; durable request ID for status.' },
          { name: 'query', type: 'string', source: 'option', builder_options: ['--query'] },
          { name: 'scene', type: 'string', source: 'option', builder_options: ['--scene'] },
          { name: 'industry', type: 'string', source: 'option', builder_options: ['--industry'] },
          { name: 'name', type: 'string', source: 'option', builder_options: ['--name'] },
          { name: 'withData', type: 'string', source: 'option', builder_options: ['--with-data'], choices: ['y', 'n'] },
          { name: 'requestId', type: 'string', source: 'option', builder_options: ['--request-id'] },
          { name: 'retry', type: 'boolean', source: 'option', builder_options: ['--retry'], description: 'Explicitly retry a platform-rejected enable attempt; never replay an uncertain request.' },
          { name: 'wait', type: 'string', source: 'option', builder_options: ['--wait'], description: 'Readback wait budget, 0-60 seconds. Default: enable 10, status 0.' },
          { name: 'page', type: 'string', source: 'option', builder_options: ['--page'] },
          { name: 'size', type: 'string', source: 'option', builder_options: ['--size'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        examples: [
          'openyida solution-template search --query "合同" --json',
          'openyida solution-template detail TPL_XXX --json',
          'openyida solution-template prepare TPL_XXX --name "合同管理" --with-data n --json',
          'openyida solution-template ai-build TPL_XXX --json',
          'openyida solution-template enable TPL_XXX --name "合同管理" --with-data y --json',
          'openyida solution-template status st-xxxxxxxx --json',
        ],
        notes: ['Independent local agents only: reject cloud/bound contexts, managed local runs and unknown environments before auth, HTTP or receipt writes. Help and command discovery remain available. Cloud native templateReference/PRD building continues inside the bound app and must not use this command. ai-build only hands the user a cloud builder URL; it does not run template AI generation locally. Search currently excludes SaaS templates.', 'Use only for an explicit user request to operate on Solution Center templates or to continue an already confirmed template task within its authorized scope. Ordinary app creation stays with yida-app; do not automatically search, recommend, enable or fall back to a template. A query, reference link, generic creation permission or AI handoff is not consent to enable. Enable, retry after rejection and an additional copy each require explicit user authorization. search/detail/prepare are read-only. prepare summarizes the organization/environment, template version, name, sample data and existing apps/requests; source availability is not permission to enable. Permissions and entitlements are decided exclusively by the platform on submit. ai-build only returns the native builder handoff. enable writes a durable receipt before a one-shot copy and waits up to 10 seconds for app-list readback; --wait 0-60 controls this budget. Rejected attempts retain the platform error, never claim later same-name apps, and require explicit --retry to submit again. Unknown outcomes only allow readback, including with --retry. Repeating a completed request returns its app without re-copying; use a distinct request ID only for an explicitly requested additional copy. applicationVerified reports current readback, while previouslyVerified/lastVerifiedAt retain historical creation evidence. No percentage progress or background polling.'],
      }),
      command('corp-efficiency', ['corp-efficiency'], 'corp-efficiency [overview|details|detail|groups|notify] [options] [--open|--no-open]', 'help.cmd_corp_efficiency', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        output: 'json',
      }),
      command('create-app', ['create-app'], 'create-app "<name>"|--name <name> [options] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]', 'help.cmd_create_app', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        notes: ['Successful results include appUrl/workbenchUrl for the business workspace and adminUrl for developer administration. Complete application delivery retains adminUrl regardless of auth runtime; route construction does not verify recipient access. Preserve the frontend URL from its own page result.', 'In QwenWork, permission failures return a nonzero exit and structured status=permission_required. YIDA_PLATFORM_ACCESS_REQUIRED and YIDA_APP_CREATE_PERMISSION_REQUIRED include details.permissionLabel/permissionUrl and nextAction.label/url; YIDA_PERMISSION_REQUIRED preserves an unclassified permission reason without inventing a link. Explain the missing permission, display the semantic label as a Markdown link to its paired URL (or reuse nextStep), and pause resource writes; do not automatically open it, send an application, switch spaces, log in again or retry creation. Resume only after the user requests continuation and the host identity, organization and permissions are verified.'],
      }),
      command('design-plan.catalog', ['design-plan', 'catalog'], 'design-plan catalog [--json]', 'help.cmd_design_plan_catalog', { managedRun: { scope: 'local' },
        requiresLogin: false, output: 'json',
        args: [{ name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] }],
        notes: ['Read available theme IDs and page patterns before init when the theme mapping is unknown. Theme summaries describe deep/light navigation and deep/light content in natural language; they do not expose navTheme/contentTheme assignment syntax. Reuse this result for the current planning session.'],
      }),
      command('design-plan.init', ['design-plan', 'init'], 'design-plan init <requirement-brief.json> [--theme-id <id>] [--output-dir <dir>] [--json]', 'help.cmd_design_plan_init', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'text|json',
        notes: ['Requires a selected theme from --theme-id or visualSelection.themeId. A recorded brief theme cannot be overridden by a conflicting --theme-id; reuse the recorded choice. Init disables comparison and style questions for the selected theme, even when design fields are pending. There is no navigation-tone argument: init reads navTheme from the selected theme template, overwrites stale navigationStyle.tone, and records toneSource=theme_derived. Free creative preserves an explicitly authored navigationStyle.tone and records toneSource=project_defined. Returns preserved business facts, authoring.pendingFields with file/path/message, typed examples in authoring-context.md, and materialize.command with materialize.shell (powershell on Windows, posix elsewhere). Execute the command in that shell. Complete the pending facts, review business coverage, then set ready=true. Author ordered page blocks as {name,purpose}; omitted contentPriority and contentRichness.contentLayers derive from these blocks, preserving explicit overrides. Author project-specific acceptanceCriteria; materialize merges them with resource-based checks. A string visualSelection.colorStrategy is preserved as usage text with primaryColor pending; invalid types fail before files are written. Init guidance is preliminary; materialize still validates the completed plan.'],
        args: [
          { name: 'requirementBrief', type: 'file', required: true, source: 'positional', position: 0, builder_options: ['--requirement-brief'] },
          { name: 'themeId', type: 'string', required: false, source: 'option', builder_options: ['--theme-id'] },
          { name: 'outputDir', type: 'string', required: false, source: 'option', builder_options: ['--output-dir'] },
          { name: 'json', type: 'boolean', required: false, source: 'option', builder_options: ['--json'] },
        ],
      }),
      command('design-plan.preview', ['design-plan', 'preview'], 'design-plan preview <build-plan.json> --part-file <module.json> [--json]', 'help.cmd_design_plan_preview', { managedRun: { scope: 'local' },
        requiresLogin: false, output: 'json',
        args: [
          { name: 'buildPlan', type: 'file', required: true, source: 'positional', position: 0, builder_options: ['--build-plan'] },
          { name: 'partFile', type: 'file', required: true, source: 'option', builder_options: ['--part-file'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Updates completed fact modules in preview/ drafts. Modules share a source base; one writer updates changed sections and preserves custom CSS. Final materialize validates the complete plan and writes PRD, design, HTML and theme together.'],
      }),
      command('design-plan.materialize', ['design-plan', 'materialize'], 'design-plan materialize <build-plan.json> [--from-preview | --business-file <json> --visual-file <json>] [--output-dir <dir>] [--rebase-parts] [--check] [--json]', 'help.cmd_design_plan_materialize', { managedRun: {'scope':'local'},
        notes: ['Local validation failures include repair.inputHash/errorHash. Do not retry unchanged inputs and arguments; stop after two repair attempts with the same error set. CLI reports diagnostics without persisting retry counters.', 'Validates readable text/surface pairs before materializing. Known low contrast returns DESIGN_THEME_CONTRAST_LOW and never silently recolors the project. Use check-design --json to inspect uncomputed pairs. Browser review follows builder_path.browser_verification and is limited to a local agent on the user machine.', 'Derives navigationStyle.tone and appConfig.navTheme from the selected theme template. Navigation appearance tokens come directly from that template plus explicit visualStyle.tokens; mode-independent tokens such as --pod-nav-menu-item-selected-shadow flow through the base token contract; materialize does not synthesize a light/dark replacement palette. Free creative uses project-authored navigation tone and tokens. Validates image slots before writing artifacts. JSON assetTasks lists taskKey/taskState, independent searches ordered by required/hero/design order, collection-wide concurrency, host-enforced time budgets, two-round limits, resume policy, output paths and resolve argv. After matching plan confirmation, executionContract requires checking background Agent and Bash separately, dispatching only verified nonblocking tools or doing authorized business work before synchronous asset batches; record real job IDs and continue app/form/page work; replace <appType> with the real ID for upload. Materialized PRD execution pages include navigationPolicy derived from app/page navigation: platform-shell is content-only; standalone without a planned menu renders no application menu. This command performs no search or upload. Local asset inputs resolve against the command cwd; absolute paths survive page-task directory changes.'],
        resultReuse: { mode: 'local_input_dependent', inputs: ['buildPlan', 'businessFile', 'visualFile', 'preview'], onInputChange: 'rerun_after_known_success', writes: 'local_artifacts_only' },
        requiresLogin: false,
        output: 'text|json',
        args: [
          { name: 'buildPlan', type: 'file', required: true, source: 'positional', position: 0, builder_options: ['--build-plan'] },
          { name: 'fromPreview', type: 'boolean', required: false, source: 'option', builder_options: ['--from-preview'] },
          { name: 'rebaseParts', type: 'boolean', source: 'option', builder_options: ['--rebase-parts'] },
          { name: 'businessFile', type: 'file', required: false, source: 'option', builder_options: ['--business-file'] },
          { name: 'visualFile', type: 'file', required: false, source: 'option', builder_options: ['--visual-file'] },
          { name: 'outputDir', type: 'string', required: false, source: 'option', builder_options: ['--output-dir'] },
          { name: 'check', type: 'boolean', required: false, source: 'option', builder_options: ['--check'] },
          { name: 'json', type: 'boolean', required: false, source: 'option', builder_options: ['--json'] },
        ],
      }),
      command('design-plan.patch', ['design-plan', 'patch'], 'design-plan patch <build-plan.json> --set <path=value> [--set <path=value> ...] [--materialize] [--output-dir <dir>] [--json]', 'help.cmd_design_plan_patch', { managedRun: {'scope':'local'},
        notes: ['Local validation failures include repair.inputHash/errorHash. Do not retry unchanged inputs and arguments; stop after two repair attempts with the same error set. CLI reports diagnostics without persisting retry counters.', 'Edit the existing plan with one batch of --set assignments; do not restart init or rewrite business.json/visual.json. navigationStyle.tone, navigationStyle.toneSource and execution.appConfig.navTheme are derived and cannot be patched; change the selected theme instead. For free-creative only, navigationStyle.tone is authored and can be patched. With --materialize, update changed PRD/design/HTML sections and theme tokens, preserving unrelated local content and custom CSS. JSON updated lists artifact files actually written. The CLI maintains .build-plan-artifacts.json as the generated baseline; overlapping local edits fail before any writes. Without --materialize, validate and save source facts without rendering HTML or writing artifacts. Unpresented edits keep the draft revision; substantive edits to a presented version advance once and clear approval. Asset materialStatus/missingAssets updates preserve approval.'],
        requiresLogin: false,
        output: 'text|json',
        args: [
          { name: 'buildPlan', type: 'file', required: true, source: 'positional', position: 0, builder_options: ['--build-plan'] },
          { name: 'setFile', type: 'file', source: 'option', builder_options: ['--set-file'], description: 'JSON object mapping field paths to typed values; use for Windows arrays, objects and quoted text. Requires --set or --set-file.' },
          { name: 'set', type: 'string', source: 'option', builder_options: ['--set'], repeatable: true, description: 'Field assignment path=value; repeat --set for multiple changes. CSS token overrides use visualStyle.tokens.<token>=<value>.' },
          { name: 'materialize', type: 'boolean', source: 'option', builder_options: ['--materialize'] },
          { name: 'outputDir', type: 'string', source: 'option', builder_options: ['--output-dir'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
      }),
      command('update-app', ['update-app'], 'update-app <appType> [--name "..."] [--desc "..."] [--icon <name>] [--icon-color <color>] [--colour <key>] [--theme-color <color>] [--theme-file <css>] [--confirm-legacy-app-style] [--disable-custom-theme] [--nav-theme light|dark|white|gray] [--logo-source appIcon|customImage] [--layout side|top|l_shape] [--hide-app-nav|--show-app-nav]', 'help.cmd_update_app', { managedRun: { scope: 'app', appPosition: 0, mutation: { operation: 'update_app_setting' } },
        args: [
          { name: 'appType', type: 'string', required: true, source: 'positional', position: 0 },
          { name: 'name', type: 'string', source: 'option', builder_options: ['--name', '-n'] },
          { name: 'desc', type: 'string', source: 'option', builder_options: ['--desc', '-d'] },
          { name: 'icon', type: 'string', source: 'option', builder_options: ['--icon'] },
          { name: 'iconColor', type: 'string', source: 'option', builder_options: ['--icon-color'] },
          { name: 'colour', type: 'string', source: 'option', builder_options: ['--colour', '--theme'], description: 'Platform theme key or custom; CSS colors belong in themeColor.' },
          { name: 'themeColor', type: 'string', source: 'option', builder_options: ['--theme-color', '--themeColor'], description: 'App primary color; themeFile supplies the effective color when both are provided.' },
          { name: 'themeFile', type: 'file', source: 'option', builder_options: ['--theme-file', '--custom-theme-file'], description: 'Completed application theme CSS, not a placeholder authoring bundle. Reads --color-brand1-6, uploads CSS and sets colour=custom. Supports app-theme.css or app_theme.css; use the actual generated path.' },
          { name: 'confirmLegacyAppStyle', type: 'boolean', source: 'option', builder_options: ['--confirm-legacy-app-style'], description: 'Attests to an affirmative human reply for this exact legacy/unknown app and reviewed CSS scope; never infer consent from a request to beautify a page.' },
          { name: 'disableCustomTheme', type: 'boolean', source: 'option', builder_options: ['--disable-custom-theme'], description: 'Disable app-level CSS by serializing the existing customThemeStyle with boolean enabled=false and iframePropagation=false. Retain cssUrl/cssFileName and other basic settings. Cannot be combined with other updates.' },
          { name: 'navTheme', type: 'string', source: 'option', builder_options: ['--nav-theme', '--navTheme'], description: 'Platform value: light, dark, white or gray; disabled/legacy apps persist white/gray as light. Generated design flows pass the selected template-derived light/dark value explicitly; this option has no implicit light default.' },
          { name: 'logoSource', type: 'string', source: 'option', builder_options: ['--logo-source', '--logoSource'], description: 'appIcon or customImage; customImage requires an existing homepageLogo.' },
          { name: 'layoutDirection', type: 'string', source: 'option', builder_options: ['--layout', '--layout-direction', '--layoutDirection'], description: 'side, top or l_shape. Disabled or legacy apps persist ver, hoz or ver respectively.' },
          { name: 'hideAppNav', type: 'boolean', source: 'option', builder_options: ['--hide-app-nav'] },
          { name: 'showAppNav', type: 'boolean', source: 'option', builder_options: ['--show-app-nav'] },
        ],
        notes: [
          'Before uploading or binding CSS, read server-resolved appThemeEnable/appThemeMode and verify app/corp identity. Only y/modern allows automatic app-level injection. Legacy or unknown capability requires asking the human about this exact application and reviewed stylesheet scope before --confirm-legacy-app-style; unavailable confirmation means stop before uploading. Prefer page-scoped styles for legacy applications. --disable-custom-theme retains the existing resource URL/name and sets enabled/iframePropagation to boolean false. Never submit an empty style or remove the resource URL. Inspect strict configuration readback. Checking that link#yida-app-custom-theme is absent and CSS is not requested follows builder_path.browser_verification; HTTP success alone is insufficient.',
          'Upload application CSS with --theme-file; the primary color is read from CSS and saved with the theme resource. Edit navigation radius, three border states and selected shadow in design.md, regenerate CSS, then upload; these tokens are not separate update-app flags. Unknown options, missing values and combined --hide-app-nav/--show-app-nav are rejected.',
          'themeUpload records this invocation: target app/environment, source name/bytes/SHA-256, themeColor and resource URL. resourceContentVerified=false means no remote byte comparison. Without --theme-file it is not_requested/uploadedThisRun=false. Unknown upload or failed binding needs readback before another upload; accepted uploads retain their receipt.',
          'One design document and theme CSS cover navigation, application shell, native forms, custom pages and record details. tokens.application-global.appearance.navigation defines navigation surfaces, text and interaction states, logo, groups, search, popups, borders, radius and density. Platform-supported tokens are applied through the active navigation mode; page content consumes the same application theme.',
          'Applications with appThemeEnable=n or appThemeMode=legacy persist side/top/l_shape as ver/hoz/ver and map unsupported white/gray navigation colors to legacy light. Existing legacy layouts and navType are preserved. Unknown theme capability keeps the existing save protocol.',
          'navigationVerification checks requested navTheme/layoutDirection/hideAppNav/logoSource; mismatch is APP_NAVIGATION_NOT_PERSISTED, nonzero, with read-only retries. themeVerification.scope=configuration_readback; operation is bind_resource/update_theme/disable/preserve. preserve is not upload evidence. New themes need an uploaded receipt and matching enabled resource/color. runtimeVerification stays false/not_checked. Browser checks follow builder_path.browser_verification; only a local agent on the user machine may run them. Cloud/sandbox/remote/unknown keep not_checked internal and deliver confirmed results and entry URLs, without default user verification tasks.',
          'For generated design artifacts, pass themeProfile.navTheme from design.md to --nav-theme. Do not infer it from the business brief or omit it expecting a light default.',
          'Platform preset keys are used independently of --theme-file and --theme-color. Choose --hide-app-nav or --show-app-nav to set navigation visibility.',
        ],
      }),
      command('data-manage-style.guide', ['data-manage-style', 'guide'], 'data-manage-style guide [--json]', 'help.cmd_data_manage_style_guide', {
        managedRun: { scope: 'local', allowedFlags: ['--json'] }, requiresLogin: false, output: 'json',
        args: [{ name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] }],
        notes: ['Default authoring entry: composable change dimensions, existing token consumers, scoped CSS targets and state checks. No style ID, login or file writes. Inspect the actual DOM before use. This guide does not generate or validate a page; list/generate recipes are optional examples, not the capability boundary.'],
      }),
      command('data-manage-style.list', ['data-manage-style', 'list'], 'data-manage-style list [--json]', 'help.cmd_data_manage_style_list', {
        managedRun: { scope: 'local', allowedFlags: ['--json'] }, requiresLogin: false, output: 'text|json',
        args: [{ name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] }],
        notes: ['Optional legacy recipe examples, column emphasis options and layout references. Start with guide for freeform token/CSS authoring; this catalog is not exhaustive and is not required. Custom directions are guidance, not native generate style IDs.'],
      }),
      command('data-manage-style.generate', ['data-manage-style', 'generate'], 'data-manage-style generate --app <appType> --form <formUuid> --style <id> --base-css <theme.css> --output <new.css> [--focus balanced|actions] [--field-id <actualId>]... [--emphasize-field <actualId>]... [--tag-field <selectFieldId>]... [--follow-shell] [--json]', 'help.cmd_data_manage_style_generate', {
        // Value-bearing and repeatable options are validated by the command parser.
        // allowedFlags is reserved for distinct, flag-only local invocations.
        managedRun: { scope: 'local' },
        requiresLogin: false, output: 'text|json',
        args: [
          { name: 'appType', type: 'string', required: true, source: 'option', builder_options: ['--app'] },
          { name: 'formUuid', type: 'string', required: true, source: 'option', builder_options: ['--form'] },
          { name: 'style', type: 'string', required: true, source: 'option', builder_options: ['--style'], choices: require('../style/data-manage-presets.json').map(item => item.id) },
          { name: 'baseCss', type: 'file', required: true, source: 'option', builder_options: ['--base-css'] },
          { name: 'output', type: 'file', required: true, source: 'option', builder_options: ['--output'] },
          { name: 'focus', type: 'string', source: 'option', builder_options: ['--focus'], choices: ['balanced', 'actions'], default: 'balanced' },
          { name: 'fieldId', type: 'string', source: 'option', builder_options: ['--field-id'], repeatable: true },
          { name: 'emphasizeField', type: 'string', source: 'option', builder_options: ['--emphasize-field'], repeatable: true },
          { name: 'tagField', type: 'string', source: 'option', builder_options: ['--tag-field'], repeatable: true },
          { name: 'followShell', type: 'boolean', source: 'option', builder_options: ['--follow-shell'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Local-only generation from existing application CSS into a new file. Replaces only the owned app/form block. Preserves business configuration and virtual row geometry. Uses current native navigation selection; repeat actual field IDs for nav-free native views. Shell changes are opt-in. Repeat --emphasize-field for themed column fill, header and weight without an accent line; --tag-field renders uniform SelectField labels, not conditional colors. Targets also supply nav-free field evidence. Regeneration without the flags removes these owned enhancements. Back up before publishing through update-app, read back and verify the actual runtime; generated CSS is not publication or acceptance.'],
      }),
      command('app-theme.snapshot', ['app-theme', 'snapshot'], 'app-theme snapshot <appType> --output-dir <new-dir> [--json]', 'help.cmd_app_theme_snapshot', { managedRun: { scope: 'app', appPosition: 1 },
        output: 'json',
        args: [
          { name: 'appType', type: 'string', required: true, source: 'positional', position: 0 },
          { name: 'outputDir', type: 'string', required: true, source: 'option', builder_options: ['--output-dir'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Read-only remote snapshot of application theme settings, runtime theme mode, and icon; archive original CSS bytes and checksums in a fresh local directory. Returns restorableKeys and cannotClearKeys. No page/source backup or icon/mode restore. Before beautification, ensure every planned changed key is restorable and no protected field changes; update-app theme upload may also change icon color. Missing or empty originals cannot be restored by the platform single-config endpoint. CSS fetch requires a direct HTTPS text/css response and sends no Yida credentials. Snapshot is not a server transaction; two matching reads detect changes during collection.'],
      }),
      command('app-theme.restore', ['app-theme', 'restore'], 'app-theme restore <appType> --snapshot <before.json> --expected-current <after.json> [--check | --confirm --output-dir <new-dir>] [--json]', 'help.cmd_app_theme_restore', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_app', requiredFlags: ['--confirm'] } },
        output: 'json',
        args: [
          { name: 'appType', type: 'string', required: true, source: 'positional', position: 0 },
          { name: 'snapshot', type: 'string', required: true, source: 'option', builder_options: ['--snapshot'] },
          { name: 'expectedCurrent', type: 'string', required: true, source: 'option', builder_options: ['--expected-current'] },
          { name: 'check', type: 'boolean', source: 'option', builder_options: ['--check'] },
          { name: 'confirm', type: 'boolean', source: 'option', builder_options: ['--confirm'] },
          { name: 'outputDir', type: 'string', source: 'option', builder_options: ['--output-dir'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Default/--check performs no remote writes and returns canRestore plus blockers. --confirm attests to user-authorized rollback and requires a new journal directory. Validate both snapshots, CSS bytes and app/corp/base URL; current theme state must equal the snapshot captured immediately after this run, not a newly captured externally changed baseline. Refuse empty/absent target values, changed protected icon/theme mode, or unavailable/changed original CSS. Restore only allowlisted nonempty theme config values via updateSingleConfig; never update the whole app, reupload CSS, upgrade theme mode, or overwrite business settings. Check tracked state before each write and read it back afterwards. This is not atomic/CAS and cannot exclude all concurrent writes. Partial/unknown outcomes retain a journal and require inspection before retry; verified success covers configuration only, not page appearance.'],
      }),
      command('upgrade-app-theme', ['upgrade-app-theme'], 'upgrade-app-theme <appType> --explicit-request [--confirm | --prepare --output-dir <dir>] [--json]', 'help.cmd_upgrade_app_theme', { managedRun: { scope: 'app', appPosition: 0, mutation: { operation: 'update_app', requiredFlags: ['--confirm'] } },
        output: 'json',
        args: [
          { name: 'appType', type: 'string', required: true, source: 'positional', position: 0 },
          { name: 'explicitRequest', type: 'boolean', required: true, source: 'option', builder_options: ['--explicit-request'] },
          { name: 'prepare', type: 'boolean', source: 'option', builder_options: ['--prepare'] },
          { name: 'outputDir', type: 'string', source: 'option', builder_options: ['--output-dir'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
          { name: 'confirm', type: 'boolean', source: 'option', builder_options: ['--confirm'] },
        ],
        notes: ['--prepare reads remote schemas/source bundles into a new local backup directory and produces a per-resource migration plan without remote writes; it requires explicit upgrade intent but no mutation confirmation. Before --confirm, use the independent upgrade Skill to prepare/review sources, migrate legacy JSX to Canvas without business/layout changes, and remove verified form-detail style injection. Only mutate after an explicit user request to upgrade an existing app to the modern theme AND an affirmative ask_human reply for that app. These flags attest to both checks; they do not replace human confirmation. If ask_human is unavailable, stop before mutation. The CLI itself checks server-derived agentAppType and app/corp identity before offering any confirmation or preparing backups. agentAppType comes from FROM_BUILDER_AI=y plus BUILDER_AI_SOURCE; source alone or FROM_AI does not qualify. Use the centralized server-derived AI application type check (including web_local). Reject non-AI or unverified apps without offering an upgrade or exposing source fields. Skill guidance and confirmation flags cannot bypass this gate. Do not check V4, appThemeEnable, organization theme gray or upgrade gray. After ask_human approval, migrate legacy navigation layout and colors before persisting CREATED_WITH_MODERN_THEME=y and APP_THEME_MODE=modern, then read all changed settings back. Already modern navigation colors stay unchanged. Report partial/unknown writes on failure. Success verifies configuration only, not page migration or runtime rendering. appUpgradeComplete remains false until the Skill verifies all page/form migrations.'],
      }),
      command('app-online', ['app-online'], 'app-online <appType> [--to-ding-app-center] [--show-app-center]', 'help.cmd_app_online', { managedRun: {'scope':'denied','reason':'scope_not_audited'} }),
      command('app-offline', ['app-offline'], 'app-offline <appType> [--to-ding-app-center] [--show-app-center]', 'help.cmd_app_offline', { managedRun: {'scope':'denied','reason':'scope_not_audited'} }),
      command('nav-group', ['nav-group'], 'nav-group <list|create|rename|delete|move|order|auto-order|hide|show> <appType> ...', 'help.cmd_nav_group', { managedRun: {'scope':'actions','actions':{'list':{'scope':'app','appPosition':1},'create':{'scope':'app','appPosition':1,'mutation':{'operation':'update_nav'}},'rename':{'scope':'app','appPosition':1,'mutation':{'operation':'update_nav'}},'delete':{'scope':'app','appPosition':1,'mutation':{'operation':'update_nav'}},'move':{'scope':'app','appPosition':1,'mutation':{'operation':'update_nav'}},'order':{'scope':'app','appPosition':1,'mutation':{'operation':'update_nav'}},'auto-order':{'scope':'app','appPosition':1,'mutation':{'operation':'update_nav'}},'hide':{'scope':'app','appPosition':1,'mutation':{'operation':'update_nav'}},'show':{'scope':'app','appPosition':1,'mutation':{'operation':'update_nav'}}}},
        output: 'json',
        aliases: ['group'],
        examples: [
          'openyida nav-group list APP_XXX --flat',
          'openyida nav-group create APP_XXX "客户管理" --icon auto',
          'openyida nav-group move APP_XXX FORM_XXX --to NAV_XXX',
        ],
        notes: ['create accepts --icon auto|<iconName>. By default it selects a business icon from the group title using the page navigation icon catalog, preserves the created node when updating its icon, and verifies readback. list exposes icon. NAV_GROUP_CREATE_INCOMPLETE is not retry-safe: inspect nextStep before further changes. Existing group icons are not automatically changed.'],
      }),
      command('app-permission', ['app-permission'], 'app-permission <get|set|add|remove|search-user> ...', 'help.cmd_app_permission', { managedRun: {
        scope: 'actions',
        actions: {
          get: { scope: 'app', appPosition: 1 },
          set: { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_permission' } },
          add: { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_permission' } },
          remove: { scope: 'app', appPosition: 1, mutation: { operation: 'update_app_permission' } }
        }
      },
      output: 'json',
      }),
      command('i18n', ['i18n'], 'i18n <overview|config|languages|list|upsert|delete|translate|translate-all|upgrade> <appType> ...', 'help.cmd_i18n', { managedRun: { scope: 'actions', actions: { config: { scope: 'actions', actions: { get: { scope: 'app', appPosition: 2 }, set: { scope: 'app', appPosition: 2, mutation: { operation: 'update_app' } } } }, 'overview': { scope: 'app', appPosition: 1 }, 'languages': { scope: 'app', appPosition: 1 }, 'list': { scope: 'app', appPosition: 1 }, 'translate': { scope: 'app', appPosition: 1 }, 'upsert': { scope: 'app', appPosition: 1, mutation: { operation: 'update_app' } }, 'batch-upsert': { scope: 'app', appPosition: 1, mutation: { operation: 'update_app' } }, 'delete': { scope: 'app', appPosition: 1, mutation: { operation: 'update_app' } }, 'translate-all': { scope: 'app', appPosition: 1, mutation: { operation: 'update_app' } }, 'upgrade': { scope: 'app', appPosition: 1, mutation: { operation: 'update_app' } } } },
        output: 'json',
      }),
      command('export', ['export'], 'export <appType> [output]', 'help.cmd_export', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
      command('import', ['import'], 'import <file> [name]', 'help.cmd_import', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
    ],
  },
  {
    id: 'form',
    titleKey: 'help.group_form',
    commands: [
      command('create-form.batch', ['create-form', 'batch'], 'create-form batch <appType> <plan.json> [--concurrency 1..4] [--check] [--json]', 'help.cmd_create_form_batch', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'create_form', forbiddenFlags: ['--check'] } },
        output: 'json',
        args: [
          { name: 'appType', type: 'string', required: true, source: 'positional', position: 0, builder_options: ['--app-type'] },
          { name: 'plan', type: 'file', required: true, source: 'positional', position: 1, builder_options: ['--plan'] },
          { name: 'concurrency', type: 'integer', default: 3, source: 'option', builder_options: ['--concurrency'], description: 'Maximum concurrent forms, 1 through 4; default 3.' },
          { name: 'check', type: 'boolean', source: 'option', builder_options: ['--check'], description: 'Validate definitions and dependency groups locally.' },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Creates independent normal forms concurrently after dependency validation. Each plan item accepts layout (single/double/card/section), theme (default/compact/comfortable), labelAlign (top/left/right), icon and locale, and forwards them to create-form create. References resolve from successful schema readbacks. Existing formUuid entries are read-only reuse. Saves IDs and status beside the plan; recoveryAction and nextAction are enum values: rerun_unchanged_plan reuses successful results and resumes known form IDs; inspect_unknown_write_then_reconcile requires checking uncertain writes before rerunning. Results expose appUrl and formUrl; url remains the compatible form entry. Navigation ordering and shared app configuration follow the batch.'],
      }),
      command('create-form.create', ['create-form', 'create'], 'create-form create <appType> "<formTitle>" <fieldsJsonFile> [--layout single|double|card|section] [--theme default|compact|comfortable] [--label-align top|left|right] [--icon auto|<iconName>] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]', 'help.cmd_create_form', { managedRun: {'scope':'app','appPosition':1,'mutation':{'operation':'create_form'}},
        args: [
          {
            name: 'appType',
            type: 'string',
            required: true,
            source: 'positional',
            position: 0,
            builder_options: ['--app-type', '--appType', '--app_type'],
            description: 'Yida application id, such as APP_XXX.',
          },
          {
            name: 'formTitle',
            type: 'string',
            required: true,
            source: 'positional',
            position: 1,
            display_quote: true,
            builder_options: ['--form-title', '--formTitle', '--form_title', '--name'],
            description: 'Form page title.',
          },
          {
            name: 'fieldsJsonFile',
            type: 'file',
            required: true,
            source: 'positional',
            position: 2,
            builder_options: ['--fields-json-file', '--fields-file', '--fieldsJsonFile', '--fields_json_file', '--fields'],
            inline_json_rejected_options: ['--fields'],
            description: 'Path to a local JSON file containing field definitions.',
          },
          {
            name: 'layout',
            type: 'string',
            required: false,
            source: 'option',
            builder_options: ['--layout'],
            default: 'single',
            values: ['single', 'double', 'card', 'section'],
            description: 'Form-wide layout preset: single, double, card or section. Numeric aliases 1 and 2 remain accepted by the CLI.',
          },
          {
            name: 'theme',
            type: 'string',
            required: false,
            source: 'option',
            builder_options: ['--theme'],
            default: 'default',
            values: ['default', 'compact', 'comfortable'],
            description: 'Form density preset: default, compact or comfortable; this is not the application visual theme.',
          },
          {
            name: 'labelAlign',
            type: 'string',
            required: false,
            source: 'option',
            builder_options: ['--label-align'],
            default: 'top',
            values: ['top', 'left', 'right'],
            description: 'PC field-label alignment: top, left or right.',
          },
          {
            name: 'icon',
            type: 'string',
            required: false,
            source: 'option',
            builder_options: ['--icon'],
            default: 'auto',
            value_catalog_command_id: 'create-form.icons',
            description: 'Form navigation icon name. Use auto for semantic selection or run create-form.icons for supported values.',
          },
          {
            name: 'contentLocale',
            type: 'string',
            required: false,
            source: 'option',
            builder_options: ['--locale', '--content-locale', '--lang'],
            values: ['zh_CN', 'en_US', 'ja_JP'],
            description: 'Content locale: zh_CN, en_US or ja_JP (normalized locale aliases are also accepted).',
          },
          { name: 'open', type: 'boolean', required: false, source: 'option', builder_options: ['--open'] },
          { name: 'noOpen', type: 'boolean', required: false, source: 'option', builder_options: ['--no-open'] },
        ],
        canonical: {
          command_id: 'create-form.create',
          path: ['create-form', 'create'],
          argv_template: ['create-form', 'create', '<appType>', '<formTitle>', '<fieldsJsonFile>'],
          display: 'openyida create-form create <appType> "<formTitle>" <fieldsJsonFile>',
          builder: 'openyida commands build create-form.create --app-type <appType> --form-title "<formTitle>" --fields-json-file <fieldsJsonFile> [--layout single|double|card|section] [--theme default|compact|comfortable] [--label-align top|left|right] [--icon <iconName>] [--locale zh_CN|en_US|ja_JP] [--open|--no-open] --json',
        },
        deprecatedPatterns: [
          {
            id: 'deprecated.create-form.name-fields-options',
            pattern: 'create-form <appType> --name <formTitle> --fields <fieldsJson>',
            matcher: {
              type: 'argv_shape',
              root: 'create-form',
              app_type_position: 1,
              app_type_must_not_be_known_subcommand: true,
              capture_options: {
                formTitle: ['--name'],
                fields: ['--fields'],
              },
            },
            code: 'CREATE_FORM_DEPRECATED_OPTION_SHAPE',
            reason: 'create-form requires the explicit create subcommand and a fields JSON file path.',
          },
        ],
        repairPatterns: [
          {
            id: 'repair.create-form.name-fields-to-create',
            from: 'create-form <appType> --name <formTitle> --fields <fieldsJson>',
            to: 'create-form create <appType> "<formTitle>" <fieldsJsonFile>',
            note: 'Write the inline --fields JSON to a local file, then pass that file path.',
          },
        ],
        examples: [
          'openyida create-form create APP_XXX "访客登记" .cache/openyida/visitor/fields.json',
          'openyida create-form create APP_XXX "访客登记" .cache/openyida/visitor/fields.json --layout section --theme comfortable --label-align left --icon name-card --locale zh_CN --no-open',
          'openyida commands build create-form.create --app-type APP_XXX --form-title "访客登记" --fields-json-file .cache/openyida/visitor/fields.json --layout section --theme comfortable --label-align left --locale zh_CN --no-open --json',
        ],
        notes: [
          'Divider accepts the 23 visible platform styles (none is excluded) through field JSON dividerType, not a CLI flag. Omission falls back to bold-with-thin; invalid supplied styles fail. Choose per business page and keep same-level sections consistent; see summary.core_workflows.full_app_build.divider_style_contract.',
          'Divider colorType defaults to theme. If default bindings are unsuitable for the current theme, use custom with backgroundColor, secondaryColor and titleColor designed together; explicit user color values are not required. These are field JSON properties, not CLI flags. Dark-content and composite-title guidance is advisory, not a new validation or upload/save gate.',
        ],
      }),
      command('create-form.icons', ['create-form', 'icons'], 'create-form icons [--json]', 'help.cmd_list_form_icons', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'json',
        args: [
          {
            name: 'json',
            type: 'boolean',
            required: false,
            source: 'option',
            builder_options: ['--json'],
            default: false,
            description: 'Pretty-print the icon catalog as JSON.',
          },
        ],
        canonical: {
          command_id: 'create-form.icons',
          path: ['create-form', 'icons'],
          argv_template: ['create-form', 'icons', '[--json]'],
          display: 'openyida create-form icons [--json]',
        },
        examples: ['openyida create-form icons --json'],
        aliases: ['create-form list-icons'],
      }),
      command('create-form.validate-fields', ['create-form', 'validate-fields'], 'create-form validate-fields <fieldsJsonOrFile> [--json]', 'help.cmd_validate_form', { managedRun: { scope: 'local' },
        requiresLogin: false,
      }),
      command('create-form.update', ['create-form', 'update'], 'create-form update <appType> <formUuid> (<changesJsonOrFile> | --data-file <changesJsonOrFile>) [--locale zh_CN|en_US|ja_JP] [--open|--no-open]', 'help.cmd_update_form', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } } }),
      command('create-form.resume', ['create-form', 'resume'], 'create-form resume <appType> <formUuid> <fieldsJsonOrFile> [--json]', 'help.cmd_update_form', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
        notes: ['On save-schema HTTP 5xx, read back the latest schema. Accept already-applied fields or retry missing compatible fields once with the latest revision; conflicts and other failures stop. Success includes appUrl, formUrl and the compatible url field.'],
      }),
      command('create-form.patch', ['create-form', 'patch'], 'create-form patch <appType> <formUuid> <patchJsonOrFile> [--open|--no-open]', 'help.cmd_update_form', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } } }),
      command('create-form.rule', ['create-form', 'rule'], 'create-form rule <appType> <formUuid> <rulesJsonOrFile> [--open|--no-open]', 'help.cmd_update_form', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } } }),
      command('create-form.validation', ['create-form', 'validation'], 'create-form validation <appType> <formUuid> <validationsJsonOrFile> [--open|--no-open]', 'help.cmd_update_form', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } } }),
      command('add-validation', ['add-validation'], 'add-validation <appType> <formUuid> --field <labelOrId> --type <phone|regex|idCard|email|...> [--message <text>]', 'help.cmd_update_form', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
      command('create-form.bind-datasource', ['create-form', 'bind-datasource'], 'create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile> [--open|--no-open]', 'help.cmd_update_form', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } } }),
      command('create-form.add-option', ['create-form', 'add-option'], 'create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...', 'help.cmd_update_form', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } } }),
      command('list-forms', ['list-forms'], 'list-forms <appType> [--keyword <text>]', 'help.cmd_list_forms', { managedRun: { scope: 'app', appPosition: 0 },
        examples: ['openyida list-forms APP_XXX --keyword 客户'],
      }),
      command('aggregate-table', ['aggregate-table'], 'aggregate-table <list|create-empty|inspect|preview|save|publish|status> <appType> ...', 'help.cmd_aggregate_table', { managedRun: {
        scope: 'actions',
        actions: {
          list: { scope: 'app', appPosition: 1 },
          inspect: { scope: 'app', appPosition: 1 },
          preview: { scope: 'app', appPosition: 1 },
          status: { scope: 'app', appPosition: 1 },
          'create-empty': { scope: 'app', appPosition: 1, mutation: { operation: 'create_report' } },
          save: { scope: 'app', appPosition: 1, mutation: { operation: 'create_report' } },
          publish: { scope: 'app', appPosition: 1, mutation: { operation: 'create_report' } }
        }
      },
      output: 'json',
      }),
      command(...printTemplateCommand),
      command('form-view', ['form-view'], 'form-view <list|inspect|save|create|order> <appType> <formUuid> [viewUuid] [--config <file>] [--name <title>] [--with-config] [--expected-hash <hash>] [--backup <file>] [--replace] [--json]', 'help.cmd_form_view', {
        managedRun: { scope: 'actions', actions: {
          list: { scope: 'app', appPosition: 1 },
          inspect: { scope: 'app', appPosition: 1 },
          save: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
          create: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
          order: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
        } },
        output: 'json',
        examples: ['openyida form-view list APP_XXX FORM_XXX --with-config --json', 'openyida form-view save APP_XXX FORM_XXX VIEW_XXX --config view-patch.json --json'],
        notes: ['Reads native multiViewInfos and per-view staticConfig/defaultConfig. Saves a recursive object patch; arrays, filter and dataRange replace. --replace restores full staticConfig/defaultConfig and requires --expected-hash. showFields controls visibility and order, widths controls pixel widths, lockFieldIds controls frozen columns, filter controls default filtering, staticConfig.columnFilter controls available fields. Backups precede mutations and success requires readback. --expected-hash detects stale edits; the platform has no atomic compare-and-swap. Personal browser view settings can override published defaults. create adds a table view; order requires every existing view UUID exactly once. No delete operation.'],
      }),
      command('custom-button', ['custom-button'], 'custom-button <list|inspect|options|create|update|delete> <appType> <formUuid> [buttonUuid] [--config <file>] [--expected-hash <hash>] [--backup <file>] [--yes] [--json]', 'help.cmd_custom_button', {
        managedRun: { scope: 'actions', actions: {
          list: { scope: 'app', appPosition: 1 },
          inspect: { scope: 'app', appPosition: 1 },
          options: { scope: 'app', appPosition: 1 },
          create: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
          update: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
          delete: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
        } },
        output: 'json',
        examples: ['openyida custom-button options APP_XXX FORM_XXX --json', 'openyida custom-button create APP_XXX FORM_XXX --config button.json --json'],
        notes: ['Manages native form custom buttons: edit current fields, fill an associated form, invoke a published manual custom-button flow (type 6), or open a page. options reads eligible fields, conditions, forms, flows and display locations. Updates merge action properties and translations; arrays and permissionConfig replace. Changing action type, fillType or urlType requires a complete new actionConfig. Saves back up first and verify by readback; writes are never replayed automatically. delete permanently removes the button definition and requires --yes and --expected-hash from inspect. This differs from removing a display reference. Platform permissions, edition limits, 10-button limit, and completed-process restrictions still apply. No runtime button execution. See docs/guides/custom-buttons.md.'],
      }),
      command('form-message', ['form-message'], 'form-message <list|inspect|options|create|update|delete> <appType> <formUuid> [messageId] [--config <file>] [--expected-hash <hash>] [--backup <file>] [--yes] [--json]', 'help.cmd_form_message', {
        managedRun: { scope: 'actions', actions: {
          list: { scope: 'app', appPosition: 1 },
          inspect: { scope: 'app', appPosition: 1 },
          options: { scope: 'app', appPosition: 1 },
          create: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
          update: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
          delete: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } },
        } },
        output: 'json',
        examples: ['openyida form-message options APP_XXX FORM_XXX --json', 'openyida form-message create APP_XXX FORM_XXX --config message.json --json'],
        notes: ['Manages native form-level message notification bindings, not application settings, custom-page messaging or integration automation. list and inspect preserve native configurations. create and update currently support verified immediate events for ordinary forms and seven native templates; scheduled and process-node writes are rejected until their rule and process context can be verified. The platform exposes no independent enable/disable state, so deletion is the only supported removal action and requires --yes plus the current inspect hash. Writes back up first, detect concurrent changes and require readback; requests are never replayed automatically. Saving a binding does not send a test message or prove delivery. See docs/guides/form-messages.md.'],
      }),
      command('get-schema', ['get-schema'], 'get-schema <appType> <formUuid|--all> [--summary-json|--field-map-json|--analysis-json]', 'help.cmd_get_schema', { managedRun: { scope: 'app', appPosition: 0 },
        examples: ['openyida get-schema APP_XXX FORM_XXX --field-map-json'],
      }),
      command('check-prd-completeness', ['check-prd-completeness'], 'check-prd-completeness <prd.md> --app-type <appType> [--build-manifest <file>] [--json]', 'help.cmd_check_prd_completeness', { managedRun: { scope: 'app', appParser: 'prd-completeness' },
        output: 'json',
        notes: ['Checks resource counts and optional build-manifest.assetExecution recorded intervals. Include materialize.assetTasks and taskState records plus businessWork startedAt/endedAt; missing dispatch proof, missing overlap or assets before business in synchronous fallback produces needs_review. This is record consistency, not independent verification of host events.', 'When the PRD execution handoff contains navigationVisibility, resolves frontend display pages through build-manifest resource IDs and checks PC/mobile menu hiding using the same remote resource-list read. A visible menu fails; unknown visibility or missing ID binding needs review. Checks PRD applicationTheme against live application settings: selected brand color, custom CSS enabled with a resource URL, and navigation tone. Mismatch fails; unreadable settings or invalid expectations need review. Reuses update-app readback field handling. Does not verify page renderNav, actual CSS content/loading, default routes or browser appearance.'],
      }),
      command('check-design', ['check-design'], 'check-design <design.md> [--prd <prd.md>] [--base-dir <dir>] [--json]', 'help.cmd_check_design', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'text|json',
        notes: ['Checks 26 text/surface pairs with alpha compositing and a 4.5:1 minimum. Known failures return DESIGN_THEME_CONTRAST_LOW with token names and ratios; paletteContrast.unresolved remains unverified; browser review follows builder_path.browser_verification and is limited to a local agent on the user machine. Disabled colors and decorative swatches are excluded. Gradients, images and local component CSS need visual verification. Theme generation with a complete design document uses the same check and never silently recolors the project.', 'Local validation failures include repair.inputHash/errorHash. Do not retry unchanged inputs and arguments; stop after two repair attempts with the same error set. CLI reports diagnostics without persisting retry counters.', 'Checks declared iconSystem.colorPairs against resolved design tokens. Each pair has a unique name, foreground, background and an opaque surface when the background is translucent. Icon contrast must reach 3:1; JSON iconContrast reports the checked pairs. Unsupported colors and missing surfaces fail rather than count as verified. This does not inspect browser styles, inherited opacity, gradients or undeclared icon colors.'],
        args: [
          { name: 'design', type: 'file', source: 'positional', position: 0, required: true },
          { name: 'prd', type: 'file', source: 'option', builder_options: ['--prd'] },
          { name: 'baseDir', type: 'string', source: 'option', builder_options: ['--base-dir'], description: 'Project root for PRD designFile references; defaults to the current working directory. Input file arguments remain relative to the working directory.' },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
      }),
      command('er', ['er'], 'er <appType> [--format mermaid|json] [--output file] [--include-system] [--include-pages]', 'help.cmd_er', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        output: 'text|json',
      }),
      command('create-page', ['create-page'], 'create-page <appType> "<name>" [--mode dashboard] [--hide-nav] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]', 'help.cmd_create_page', { managedRun: { scope: 'app', appPosition: 0, mutation: { operation: 'create_page' } },
        output: 'text|json',
        args: [
          { name: 'appType', type: 'string', source: 'positional', position: 0, required: true },
          { name: 'pageName', type: 'string', source: 'positional', position: 1, required: true },
          { name: 'mode', type: 'string', source: 'option', builder_options: ['--mode'], description: 'default or dashboard; neither hides navigation automatically.' },
          { name: 'hideNav', type: 'boolean', source: 'option', builder_options: ['--hide-nav', '--hide-navigation', '--no-nav'] },
          { name: 'renderNav', type: 'string', source: 'option', builder_options: ['--render-nav', '--is-render-nav', '--isRenderNav'], description: 'Compatibility alias: false hides navigation, true retains the default. Accepts true/false, 1/0, yes/no, y/n; last navigation option wins.' },
          { name: 'locale', type: 'string', source: 'option', builder_options: ['--locale', '--content-locale', '--lang'], description: 'Content locale: zh_CN, en_US or ja_JP (also accepts normalized locale aliases).' },
          { name: 'open', type: 'boolean', source: 'option', builder_options: ['--open'] },
          { name: 'noOpen', type: 'boolean', source: 'option', builder_options: ['--no-open'] },
        ],
        notes: [
          'Returns a JSON result with progress text; there is no command-specific --json flag. pageId is the created display page formUuid.',
          '--hide-nav updates the created page and reads its configuration back, with at most one repair write. navigationVerification contains requestedRenderNav, renderNav (boolean|null), verified and attempts. Read renderNav first; use isRenderNav only when renderNav is absent. URL query parameters are not readback evidence.',
          'Without --hide-nav: hideNavRequested=false, hideNav=false, chromeless=false and navigationVerification=null. With --hide-nav: hideNav reports the readback result (null if unknown); chromeless=true and the hidden-navigation URL require verified=true.',
          'Unverified hiding exits nonzero with success=false, pageCreated=true, pageId and CREATE_PAGE_NAVIGATION_NOT_VERIFIED. Use recovery.command/args and recovery.verifyCommand/verifyArgs on that existing page. Never repeat create-page to repair navigation.',
        ],
      }),
      command('build-page', ['build-page'], 'build-page <sourceFile> [--output file|--write]', 'help.cmd_build_page', { managedRun: { scope: 'local' }, requiresLogin: false }),
      command('check-page', ['check-page'], 'check-page <src> [--compat] [--json]', 'help.cmd_check_page', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'text|json',
        args: [
          { name: 'src', type: 'file', source: 'positional', position: 0, required: true },
          { name: 'compat', type: 'boolean', source: 'option', builder_options: ['--compat', '--modern'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Local source validation, including form-open-container checks for recognized form links and drawer structure. Fails with CHECK_PAGE_FAILED and per-rule diagnostics. Dynamic interactions still require runtime verification.'],
      }),
      command('compile', ['compile'], 'compile <src> [--canvas] [--compat] [--skip-lint] [--strict-theme|--allow-fixed-brand] [--json]', 'help.cmd_compile', { managedRun: {'scope':'local'},
        requiresLogin: false,
        output: 'text|json',
        args: [
          { name: 'src', type: 'file', source: 'positional', position: 0, required: true },
          { name: 'strictTheme', type: 'boolean', source: 'option', builder_options: ['--strict-theme'] },
          { name: 'allowFixedBrand', type: 'boolean', source: 'option', builder_options: ['--allow-fixed-brand'] },
          { name: 'canvas', type: 'boolean', source: 'option', builder_options: ['--canvas'] },
          { name: 'compat', type: 'boolean', source: 'option', builder_options: ['--compat', '--modern'] },
          { name: 'skipLint', type: 'boolean', source: 'option', builder_options: ['--skip-lint'], description: 'Legacy JSX lint only; does not bypass Canvas compilation checks.' },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Local validation failures include repair.inputHash/errorHash. Do not retry unchanged inputs and arguments; stop after two repair attempts with the same error set. CLI reports diagnostics without persisting retry counters.', 'Canvas compilation checks theme provider mounting, theme reads before the provider is active, module-level theme context declarations, fixed ConfigProvider brand colors, and known navigation destinations missing appType. Extract canvas-theme and canvas-navigation before coding. Form actions also require the maintained form-open-container fragment, hook and rendered container. Fixed brand colors remain in the source and are returned in warnings even with --json; --strict-theme blocks them and --allow-fixed-brand preserves them. These flags are Canvas-only and mutually exclusive. Dynamic colors, resource identity and runtime rendering still require verification.'],
      }),
      command('publish', ['publish'], 'publish <src> <appType> <formUuid> [--health-check] [--force] [--canvas] [--compat] [--skip-lint] [--fix-theme] [--strict-theme] [--allow-fixed-brand] [--auto-nav-order] [--open|--no-open] [--json]', 'help.cmd_publish', { managedRun: {'scope':'app','appPosition':1,'sourcePosition':0,'mutation':{'operation':'publish_page','formUuidPosition':2}},
        args: [
          { name: 'src', type: 'file', source: 'positional', position: 0, required: true },
          { name: 'appType', type: 'string', source: 'positional', position: 1, required: true },
          { name: 'formUuid', type: 'string', source: 'positional', position: 2, required: true },
          { name: 'fixTheme', type: 'boolean', source: 'option', builder_options: ['--fix-theme'], description: 'Canvas only: remove fixed brand overrides after verifying a mounted theme provider; compile before writing source. Never prompts for stdin.' },
          { name: 'healthCheck', type: 'boolean', source: 'option', builder_options: ['--health-check', '--check'] },
          { name: 'force', type: 'boolean', source: 'option', builder_options: ['--force'], description: 'Override target checks; does not bypass Canvas compilation checks.' },
          { name: 'strictTheme', type: 'boolean', source: 'option', builder_options: ['--strict-theme'] },
          { name: 'allowFixedBrand', type: 'boolean', source: 'option', builder_options: ['--allow-fixed-brand'] },
          { name: 'canvas', type: 'boolean', source: 'option', builder_options: ['--canvas'] },
          { name: 'compat', type: 'boolean', source: 'option', builder_options: ['--compat', '--modern'] },
          { name: 'skipLint', type: 'boolean', source: 'option', builder_options: ['--skip-lint'], description: 'Legacy JSX lint only; does not bypass Canvas compilation checks.' },
          { name: 'autoNavOrder', type: 'boolean', source: 'option', builder_options: ['--auto-nav-order'] },
          { name: 'open', type: 'boolean', source: 'option', builder_options: ['--open'] },
          { name: 'noOpen', type: 'boolean', source: 'option', builder_options: ['--no-open'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Canvas publishing runs the same theme and form-open-container structure checks as compile before login or remote writes. --force does not bypass Canvas compilation checks. --health-check verifies saved content; inspect the actual page for runtime behavior. Fixed brand overrides are preserved with structured warnings by default. --strict-theme blocks them; --allow-fixed-brand conflicts with --strict-theme and --fix-theme. --fix-theme requires the migrated controls to be inside a mounted CanvasThemeProvider and compiles before writing. Unproven dynamic render paths require manual migration. No stdin prompts.', 'Publishing reads persisted page navigation by default without a new flag. With renderNav=false, url and standaloneUrl use the clean /custom/<formUuid> route, with no navigation query parameters; workbenchUrl remains available. Unknown or visible navigation returns standaloneUrl=null; inspect navigationVerification and navigationWarning. A navigation read failure does not undo publication or prove standalone readiness. Configure scoped service frontend pages persistently before publishing; get-form-config can recover the verified URL without republishing.'],
      }),
      command('update-form-config', ['update-form-config'], 'update-form-config <appType> <formUuid> <true|false|keep> "<title>" [--locale zh_CN|en_US|ja_JP]', 'help.cmd_update_form_config', { managedRun: { scope: 'app', appPosition: 0, mutation: { operation: 'update_form_config', formUuidPosition: 1 } },
        args: [
          { name: 'appType', type: 'string', source: 'positional', position: 0, required: true },
          { name: 'formUuid', type: 'string', source: 'positional', position: 1, required: true },
          { name: 'isRenderNav', type: 'string', source: 'positional', position: 2, required: true, description: 'true, false or keep; use false for hide-navigation recovery.' },
          { name: 'title', type: 'string', source: 'positional', position: 3, required: true },
          { name: 'locale', type: 'string', source: 'option', builder_options: ['--locale', '--content-locale', '--lang'] },
        ],
        notes: ['The page write API accepts isRenderNav; keep reads renderNav first and falls back to the returned isRenderNav only when renderNav is absent. URL isRenderNav is a separate per-open parameter, not persistence evidence. A successful write acknowledgement is not navigation readback. Follow with get-form-config <appType> <formUuid> --json; inspect renderNav, falling back to isRenderNav only when renderNav is absent.'],
      }),
      command('get-form-config', ['get-form-config'], 'get-form-config <appType> <formUuid> [--json]', 'help.cmd_get_form_config', { managedRun: { scope: 'app', appPosition: 0 },
        output: 'json',
        args: [
          { name: 'appType', type: 'string', source: 'positional', position: 0, required: true },
          { name: 'formUuid', type: 'string', source: 'positional', position: 1, required: true },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Navigation readback uses renderNav first, falling back to isRenderNav only when renderNav is absent. true/false booleans and strings are recognized; missing or invalid values remain unknown. --json includes the raw configuration; the default summary preserves both navigation fields when present. For a confirmed display page, both outputs include url, workbenchUrl, standaloneUrl and navigationVerification. Only persisted renderNav=false returns a clean custom standaloneUrl; visible or unknown navigation returns standaloneUrl=null. Route construction does not verify publication or viewer permissions.'],
      }),
    ],
  },
  {
    id: 'data',
    titleKey: 'help.group_data',
    commands: [
      command('data', ['data'], 'data <query|get|create|update|transfer> <resource> ... | delete form <appType> <formUuid> --inst-id <id> --expect-form-name <name> --expect-form-type receipt --confirm [--json]', 'help.cmd_data', {
        managedRun: { scope: 'actions', actions: {
          query: { scope: 'actions', actions: {
            form: { scope: 'app', appPosition: 2 }, subform: { scope: 'app', appPosition: 2 },
            process: { scope: 'app', appPosition: 2 }, 'operation-records': { scope: 'app', appPosition: 2 },
            tasks: { scope: 'app', appPosition: 2 },
            'process-tasks': { scope: 'app', appPosition: 2 },
          } },
          get: { scope: 'actions', actions: {
            form: { scope: 'app', appPosition: 2 }, subform: { scope: 'app', appPosition: 2 },
            process: { scope: 'app', appPosition: 2 },
          } },
          create: { scope: 'actions', actions: {
            form: { scope: 'app', appPosition: 2, mutation: { operation: 'create_form_data', formUuidPosition: 3 } },
            process: { scope: 'app', appPosition: 2, mutation: { operation: 'create_form_data', formUuidPosition: 3 } },
          } },
          update: { scope: 'actions', actions: {
            form: { scope: 'app', appPosition: 2, mutation: { operation: 'update_form_data', formUuidOption: '--form-uuid' } },
            process: { scope: 'app', appPosition: 2, mutation: { operation: 'update_form_data', formUuidOption: '--form-uuid' } },
          } },
          delete: { scope: 'actions', actions: {
            form: { scope: 'app', appPosition: 2, mutation: { operation: 'delete_form_data', formUuidPosition: 3 } },
          } },
          execute: { scope: 'actions', actions: {
            task: { scope: 'app', appPosition: 2, mutation: { operation: 'execute_task', formUuidOption: '--form-uuid' } },
          } },
          transfer: { scope: 'actions', actions: {
            task: { scope: 'app', appPosition: 2, mutation: { operation: 'execute_task', formUuidOption: '--form-uuid' } },
          } },
        } },
        output: 'json',
        noteKeys: ['help.data_notes', 'query_data.approver_query_help'],
        notes: [
          'Ordinary form updates read record edit permission and native edit-schema field behaviors before writing. Only verified NORMAL fields are accepted; readonly, hidden, disabled, unknown or dynamically unverifiable fields reject the entire update. Restricted subform replacements require the native editor. This CLI preflight does not replace server-side authorization.',
          'Application tasks: data query tasks <appType> --type todo|created|done|cc [--normalized] [--transport app-v1|app-query]. submitted remains an alias of created. --normalized returns items/total/page/pageSize with native detail targets; an unknown total is null. app-v1 is the compatible default; only cc adds --process-codes and --instance-status. Explicit app-query fixes appKeys to the target app and supports the per-kind filters in task-center capabilities: --originators, --process-codes, --instance-create-from/to, --task-create-from/to, --task-finish-from/to, --carbon-create-from/to. Date values are Unix milliseconds. Unsupported filters and caller scope/identity overrides are rejected; transports never silently fall back.',
          'Each condition uses key (field ID), componentName, type, operator and value. Query types: TextField/TextareaField/TableField TEXT; NumberField/RateField/DateField/CascadeDateField DOUBLE; RadioField/SelectField/CheckboxField/MultiSelectField/DepartmentSelectField ARRAY; EmployeeField/CascadeSelectField/CitySelectField STRING; ImageField/AttachmentField TEXT.',
          'Ordinary form searchFormDatas accepts AND condition arrays via --search-json/--search-file. DateField: type DOUBLE, is/is_not, value ""; zero is filled. Query range endpoints as DateField with .start/.end: both empty means unfilled, both filled means complete.',
          'Use synchronized NumberField counts (eq 0/gt 0) for any filled endpoint, multi-choice options or subform rows; maintain every write entry and backfill history. --resolve-aliases supports rangeAlias.start/.end and parentId aliases. Use server pagination and dynamicOrder. Guide: yida-skills/references/query-condition-guide.md; sample: yida-data-management empty-query.',
        ],
        examples: [
          'openyida data query process APP_XXX FORM_XXX --current-approver USER_ID --count',
          'openyida data query form APP_XXX FORM_XXX --page 1 --size 20 --search-json \'[{"key":"dateField_due","componentName":"DateField","type":"DOUBLE","operator":"is","value":""}]\'',
          'openyida data create form APP_XXX FORM_XXX --expect-form-name 客户 --expect-form-type receipt --data-json \'{"textField_name":"客户 A","dateField_followUp":1787932800000}\'',
          'openyida data delete form APP_XXX FORM_XXX --inst-id FINST_XXX --expect-form-name 客户 --expect-form-type receipt --confirm --json',
          'openyida data query process-tasks APP_XXX --process-inst-id PINST_XXX --json',
          'openyida data transfer task APP_XXX --process-inst-id PINST_XXX --form-uuid FORM_XXX --to-user-id USER_ID --expect-form-name "Approval form" --expect-form-type process --json',
        ],
      }),
      command('task-center', ['task-center'], 'task-center <todo|created|done|cc|proxy|capabilities|link|scaffold|options|inspect|count> [--spec <file.json> --output <file.canvas.jsx>] [options]', 'help.cmd_task_center', {
        requiresLogin: false,
        managedRun: { scope: 'actions', actions: {
          capabilities: { scope: 'local', allowedFlags: ['--json'] },
          link: { scope: 'local', allowedFlags: ['--scope', '--type', '--base-url', '--mode', '--json'] },
          scaffold: { scope: 'local' },
          options: { scope: 'app', appPosition: 1 },
          inspect: { scope: 'app', appPosition: 1 },
          count: { scope: 'app', appPosition: 1 },
        } },
        output: 'json',
        examples: [
          'openyida task-center capabilities --json',
          'openyida task-center link APP_XXX --scope app --type todo --base-url https://tenant.aliwork.com --json',
          'openyida task-center link --scope corp --type cc --base-url https://tenant.aliwork.com --json',
          'openyida task-center count --scope corp --type created --json',
          'openyida task-center options APP_XXX --type originators --keyword 张 --json',
          'openyida task-center inspect APP_XXX --process-inst-id INSTANCE_REPLACE --form-uuid FORM_REPLACE --json',
          'openyida task-center inspect APP_XXX --process-inst-id INSTANCE_REPLACE --history --task-id TASK_REPLACE --json',
          'openyida task-center count APP_XXX --type todo --transport app-query --filters-json \'{"keyword":"采购"}\' --json',
          'openyida task-center scaffold --spec workflow-spec.json --output project/pages/src/progress.canvas.jsx',
        ],
        notes: ['link generates a native app or corporation task-center pageUrl and DingTalk AppLink without opening a browser or writing platform resources. --scope app|corp is required; app requires appType, corp rejects appType. --base-url allows offline URL generation; otherwise the active auth environment supplies the origin. --mode defaults to auto: browser pages stay in the browser and DingTalk pages use native openLink with ddtab=true; generating a link cannot detect a future page visitor environment. Explicit dingtalk mode adds ddtab=true. count --scope corp uses app-query with appKeys=[]; explicit --scope app defaults to app-query, while legacy count without --scope retains app-v1 compatibility. Scope must be clarified with the user when ambiguous. Published utilities expose openPage(url, {mode: auto|dingtalk|browser}), taskCenterLink and openTaskCenter. DingTalk mode never silently falls back to a browser. capabilities describes application task kinds, filters, lookup options, workflow read models and scaffold specs. inspect <appType> --process-inst-id ID [--history] [--task-id ID] reads authorized process progress and optional history; taskResult matches a task, without asserting visitor ownership. count <appType> --type KIND [--transport app-query] [--filters-json JSON] reads one list record and its server total; unknown totals stay null. Neither read command requires a custom-page choice. The tasks scaffold selects fields, filterFields and optional expandProcess; the progress view exports ProcessProgressSection for a real linked instance. options <appType> --type originators|processes|forms --keyword TEXT --size N --json reads current-visitor lookup candidates. scaffold creates a new local Canvas page only after an explicit custom-page request or affirmative ask_human choice, recorded as customPage.source and confirmed=true. A generic task-center request or Fast mode does not provide that choice. Pages use the current visitor and existing application theme; CLI credentials are never embedded. Global queries remain unavailable in application-bound managed runs.'],
      }),
      command('basic-info', ['basic-info'], 'basic-info <overview|commodity|grant|capacity|quota|abs-path|dataflow|i18n|domain>', 'help.cmd_basic_info', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        output: 'json',
      }),
      command('read-dingtalk-doc', ['read-dingtalk-doc'], 'read-dingtalk-doc <docUrl> [--output <file>] [--json]', 'help.cmd_read_dingtalk_doc', { managedRun: { scope: 'selected_input', inputType: 'ding_doc', inputField: 'docUrl' },
        output: 'text|json',
      }),
      command('read-dingtalk-tingji', ['read-dingtalk-tingji'], 'read-dingtalk-tingji <taskUuid> [--json]', 'help.cmd_read_dingtalk_tingji', { managedRun: { scope: 'selected_input', inputType: 'tingji', inputField: 'taskUuid' },
        output: 'json',
      }),
      command('get-permission', ['get-permission'], 'get-permission <appType> <formUuid> [--package-uuid <packageUuid>] [--package-type <FORM_PACKAGE_VIEW|FORM_PACKAGE_START>] [--check-matrix] [--json]', 'help.cmd_get_permission', { managedRun: { scope: 'app', appPosition: 0 }, noteKeys: ['permission_scope.matrix_notice'] }),
      command('save-permission', ['save-permission'], 'save-permission <appType> <formUuid> [--package-type <FORM_PACKAGE_VIEW|FORM_PACKAGE_START>] [--package-uuid <packageUuid>|--create --name <name>] [--data-permission <json>] [--action-permission <json>] [--field-permission <json>] [--members <userIds>|--roles <roleIds>|--all-members|--matrix <json>] [--confirm-member-replace] [--conditions-file <conditions.json>] [--owner-field <fieldId>] [--field-access <fieldId:view|edit|hidden|encrypt>] [--field-default <access>] [--dry-run]', 'help.cmd_save_permission', { managedRun: { scope: 'app', appPosition: 0, mutation: { operation: 'update_form_permission', formUuidPosition: 1, forbiddenFlags: ['--dry-run'] } },
        noteKeys: ['permission_scope.options_help', 'permission_scope.overlap_notice'],
        examples: [
          'openyida get-permission APP_XXX FORM_XXX --json',
          'openyida save-permission APP_XXX FORM_XXX --package-uuid PACKAGE_XXX --data-permission \'{"dataRange":"ORIGINATOR"}\'',
        ],
      }),
      command('permission-manage', ['permission-manage'], 'permission-manage <copy|rename|delete> <appType> <formUuid> <packageUuid> [--name <name>] [--package-type <type>] [--dry-run] [--confirm]', 'permission_manage.description', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, permission: actionDependentPermission({ preauthorized_actions: ['copy', 'rename', '--dry-run'], ask_actions: ['delete'] }), output: 'json' }),
      command('matrix', ['matrix'], 'matrix <list|detail|references|rows|create|update|delete|upsert-rows|delete-rows> [matrixId] [--file config.json] [--page 1] [--limit 20] [--expect hash] [--dry-run] [--confirm]', 'matrix_manage.description', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, permission: actionDependentPermission({ preauthorized_actions: ['list', 'detail', 'references', 'rows', 'create', 'update', 'upsert-rows', '--dry-run'], ask_actions: ['delete', 'delete-rows'] }), output: 'json' }),
      command('corp-manager', ['corp-manager'], 'corp-manager <search-user|list|add|remove|address-book> ...', 'help.cmd_corp_manager', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, output: 'json' }),
      command('agent-center', ['agent-center'], 'agent-center <list|create|update|cancel|range|search-user> ...', 'help.cmd_agent_center', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, output: 'json' }),
    ],
  },
  {
    id: 'process',
    titleKey: 'help.group_process',
    commands: [
      command('configure-process', ['configure-process'], 'configure-process <appType> <formUuid> <definition> [processCode] [--replace]', 'help.cmd_configure_process', { managedRun: {'scope':'app','appPosition':0,'mutation':{'operation':'update_process','formUuidPosition':1}},
        resultReuse: { mode: 'non_replayable_write', inputs: ['definition'], onInputChange: 'read_back_and_confirm_new_update', reason: 'May create and publish a new process version; --replace is not an idempotency key.' },
        examples: ['openyida configure-process APP_XXX FORM_XXX .cache/openyida/process/process-with-actions.json'],
      }),
      command('create-process', ['create-process'], 'create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile> [--replace] | create-process <appType> --formUuid <formUuid> <processDefinitionFile> [--replace]', 'help.cmd_create_process', { managedRun: { scope: 'app', appPosition: 0, mutation: { operation: 'create_process' } },
        output: 'json',
        noteKeys: ['help.create_process_notes'],
        examples: [
          'openyida create-process APP_XXX "Approval Form" .cache/openyida/process/fields.json .cache/openyida/process/process-with-actions.json',
          'openyida create-process APP_XXX --formUuid FORM_XXX .cache/openyida/process/process-with-actions.json',
        ],
      }),
      command('ai-form-setting', ['ai-form-setting'], 'ai-form-setting <get|fields|models|enable|disable|save> <appType> ...', 'help.cmd_ai_form_setting', { managedRun: {
        scope: 'actions',
        actions: {
          get: { scope: 'app', appPosition: 1 },
          fields: { scope: 'app', appPosition: 1 },
          models: { scope: 'app', appPosition: 1 },
          enable: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form_config' } },
          disable: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form_config' } },
          save: { scope: 'app', appPosition: 1, mutation: { operation: 'update_form_config' } }
        }
      },
      output: 'json',
      aliases: ['ai-approve', 'aiFormSetting'],
      }),
      command('process.preview', ['process', 'preview'], 'process preview <appType> ...', 'help.cmd_process_preview', { managedRun: { scope: 'app', appPosition: 1 } }),
      command('process.fields', ['process', 'fields'], 'process fields <appType> <formUuid> [--json]', 'help.cmd_process_fields', {
        managedRun: { scope: 'app', appPosition: 1 },
        permission: permission('allow', 'read', { reason: 'Read-only process designer field diagnostics.' }),
        output: 'json',
      }),
    ],
  },
  {
    id: 'share',
    titleKey: 'help.group_share',
    commands: [
      command('verify-short-url', ['verify-short-url'], 'verify-short-url <appType> ...', 'help.cmd_verify_url', { managedRun: { scope: 'app', appPosition: 0 } }),
      command('save-share-config', ['save-share-config'], 'save-share-config <appType> ...', 'help.cmd_save_share', { managedRun: { scope: 'app', appPosition: 0, mutation: { operation: 'update_share_config', formUuidPosition: 1 } } }),
      command('get-page-config', ['get-page-config'], 'get-page-config <appType> <formUuid>', 'help.cmd_get_page_config', { managedRun: { scope: 'app', appPosition: 0 } }),
      command('externalize-form', ['externalize-form'], 'externalize-form <appType> <formUuid> [--schema-file file]', 'help.cmd_externalize_form', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        output: 'json|markdown',
      }),
    ],
  },
  {
    id: 'report',
    titleKey: 'help.group_report',
    commands: [
      command('create-report', ['create-report'], 'create-report <appType> "<name>" ... [--json] [--open|--no-open]', 'help.cmd_create_report', { managedRun: {'scope':'app','appPosition':0,'mutation':{'operation':'create_report'}} }),
      command('append-chart', ['append-chart'], 'append-chart <appType> <reportId> ... [--json] [--open|--no-open]', 'help.cmd_append_chart', { managedRun: { scope: 'app', appPosition: 0, mutation: { operation: 'update_report', formUuidPosition: 1 } } }),
      command('report.inspect', ['report', 'inspect'], 'report inspect <appType> <reportId> --json', 'help.cmd_report_inspect', { managedRun: {'scope':'app','appPosition':1}, output: 'json', resultReuse: { mode: 'read_only', invalidateAfter: 'observed_remote_mutation', source: 'current_server_schema_and_query_probes' } }),
      command('report.configure', ['report', 'configure'], 'report configure <appType> <reportId> <cid> --hide-zero-values <true|false> [--hide-zero-categories <true|false>] [--hide-zero-legends <true|false>] [--dry-run] [--json]', 'report_runtime.zero_description', {
        permission: actionDependentPermission({ preauthorized_actions: ['--dry-run', 'apply configuration'] }),
        managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_report', formUuidPosition: 2, forbiddenFlags: ['--dry-run'] } },
        output: 'json',
        notes: ['Default off. Enable only when the user explicitly requests hiding zeros. Supported: native bar charts. hideZeroValues hides zero labels and tooltip entries while retaining categories and legends. hideZeroCategories and hideZeroLegends are separate opt-ins; ask the user when scope is unclear. Existing options are preserved when omitted on configure. Custom afterFetch code is never overwritten.'],
      }),
    ],
  },
  {
    id: 'connector',
    titleKey: 'help.group_connector',
    commands: [
      command('connector.list', ['connector', 'list'], 'connector list', 'help.cmd_connector_list', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.create', ['connector', 'create'], 'connector create "name" "domain" ...', 'help.cmd_connector_create', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.detail', ['connector', 'detail'], 'connector detail <id>', 'help.cmd_connector_detail', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.delete', ['connector', 'delete'], 'connector delete <id> [--force]', 'help.cmd_connector_delete', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.add-action', ['connector', 'add-action'], 'connector add-action --operations <file> --connector-id <id>', 'help.cmd_connector_add_action', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.update-action', ['connector', 'update-action'], 'connector update-action --connector-id <id> --action <operationId> --query-json JSON --confirm', 'help.cmd_connector_update_action', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.list-actions', ['connector', 'list-actions'], 'connector list-actions <id>', 'help.cmd_connector_list_actions', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.delete-action', ['connector', 'delete-action'], 'connector delete-action <id> <operation-id>', 'help.cmd_connector_delete_action', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.test', ['connector', 'test'], 'connector test --connector-id <id> --action <actionId> [--path-json JSON] [--query-json JSON] [--header-json JSON] [--body-json JSON] [--account-id <id>] [--system-token-app <appType>] [--ignore-defaults]', 'help.cmd_connector_test', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.list-connections', ['connector', 'list-connections'], 'connector list-connections <id>', 'help.cmd_connector_list_connections', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.create-connection', ['connector', 'create-connection'], 'connector create-connection <id> <name> [--interactive]', 'help.cmd_connector_create_connection', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.smart-create', ['connector', 'smart-create'], 'connector smart-create --curl "..."', 'help.cmd_connector_smart', { managedRun: { scope: 'denied', reason: 'organization_scope_required' } }),
      command('connector.parse-api', ['connector', 'parse-api'], 'connector parse-api [options]', 'help.cmd_connector_parse_api', { managedRun: { scope: 'local' } }),
      command('connector.gen-template', ['connector', 'gen-template'], 'connector gen-template [output]', 'help.cmd_connector_gen_template', { managedRun: { scope: 'local' } }),
    ],
  },
  {
    id: 'integration',
    titleKey: 'help.group_integration',
    commands: [
      command('integration.create', ['integration', 'create'], 'integration create <appType> <formUuid> <flowName> [--spec file.json] [--publish] [--connector-system-token-app <appType>]', 'help.cmd_integration', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'create_process' } },
        examples: [
          'openyida integration create APP_XXX FORM_XXX "批量复制明细" --spec .cache/openyida/task/integration/batch-data.json',
          'openyida integration create APP_XXX FORM_XXX "库存不足通知" --receivers USER_ID --trigger-condition "numberField_stock:当前库存:LessThan:numberField_minStock:NumberField:processVar"',
        ],
      }),
      command('integration.update', ['integration', 'update'], 'integration update <appType> <formUuid> <processCode> --patch <patch.json> [--dry-run] [--expect <fingerprint>] [--publish]', 'help.cmd_integration_update', { permission: actionDependentPermission({ preauthorized_actions: ['--dry-run', 'apply patch'] }), managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_process', formUuidPosition: 2, forbiddenFlags: ['--dry-run'] } },
        output: 'json',
      }),
      command('integration.copy', ['integration', 'copy'], 'integration copy <appType> <formUuid> <processCode> --name <name> [--dry-run]', 'integration_manage.desc_copy', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_process', formUuidPosition: 2, forbiddenFlags: ['--dry-run'] } }, permission: permission('allow', 'write'), output: 'json' }),
      command('integration.rename', ['integration', 'rename'], 'integration rename <appType> <formUuid> <processCode> --name <name> [--dry-run]', 'integration_manage.desc_rename', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_process', formUuidPosition: 2, forbiddenFlags: ['--dry-run'] } }, permission: permission('allow', 'write'), output: 'json' }),
      command('integration.delete', ['integration', 'delete'], 'integration delete <appType> <formUuid> <processCode> --confirm [--dry-run]', 'integration_manage.desc_delete', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, permission: permission('ask', 'write'), output: 'json' }),
      command('integration.monitor', ['integration', 'monitor'], 'integration monitor <appType> [--file monitor.json] [--dry-run] [--json]', 'integration_manage.desc_monitor', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, permission: actionDependentPermission({ preauthorized_actions: ['default', '--dry-run', '--file'] }), output: 'json' }),
      command('integration.list', ['integration', 'list'], 'integration list <appType> [--flow-types 1,2,3,5,6] [--form-uuid <uuid>] [--status y|n] [--json]', 'help.cmd_integration_list', { managedRun: { scope: 'app', appPosition: 1 },
        output: 'json',
      }),
      command('integration.enable', ['integration', 'enable'], 'integration enable <appType> <formUuid> <processCode>', 'help.cmd_integration_enable', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_process', formUuidPosition: 2 } },
        output: 'json',
      }),
      command('integration.disable', ['integration', 'disable'], 'integration disable <appType> <formUuid> <processCode>', 'help.cmd_integration_disable', { managedRun: { scope: 'app', appPosition: 1, mutation: { operation: 'update_process', formUuidPosition: 2 } },
        output: 'json',
      }),
      command('integration.check', ['integration', 'check'], 'integration check <appType...>', 'help.cmd_integration_check', { managedRun: { scope: 'app', appPosition: 1 } }),
      command('integration.detail-log', ['integration', 'detail-log'], 'integration detail-log <appType> <procInstId> [--json] [--include-params]', 'help.cmd_integration_detail_log', { managedRun: { scope: 'app', appPosition: 1 },
        output: 'text|json',
      }),
      command('integration.diagnose', ['integration', 'diagnose'], 'integration diagnose (--text <text>|--file <path>|--rules) [--json]', 'help.cmd_integration_diagnose', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'text|json',
      }),
      command('dws', ['dws'], 'dws <command> [args]', 'help.cmd_dws', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
      command('dws.contact-user-search', ['dws', 'contact', 'user', 'search'], 'dws contact user search --keyword <text>', 'help.cmd_dws', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
      command('dingtalk-link', ['dingtalk-link'], 'dingtalk-link <url> [--target fullScreen] [--legacy-scheme] [--json]', 'help.cmd_dingtalk_link', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'text|json',
      }),
    ],
  },
  {
    id: 'utility',
    titleKey: 'help.group_utility',
    commands: [
      command('commands', ['commands'], 'commands [--json]', 'help.cmd_commands', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'json',
      }),
      command('agent-capabilities', ['agent-capabilities'], 'agent-capabilities [--json] [--summary-json|--compact]', 'help.cmd_agent_capabilities', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'json',
      }),
      command('agent', ['agent'], 'agent <doctor|diagnose|status|connect|run|disconnect|logout|logs> [options]', 'help.cmd_agent', { managedRun: { scope: 'actions', actions: { 'ask-human': { scope: 'local' } } },
        requiresLogin: false,
        output: 'json',
        examples: ['openyida agent diagnose --json', 'openyida agent diagnose --session "<Yida session URL>" --json', 'openyida agent run --help'],
      }),
      command('mcp', ['mcp'], 'mcp', 'help.cmd_commands', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        requiresLogin: false,
        output: 'json',
        hidden: true,
      }),
      command('a2a', ['a2a'], 'a2a <serve|agent-card> [options]', 'help.cmd_a2a', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        requiresLogin: false,
        output: 'text|json',
      }),
      command('bridge', ['bridge'], 'bridge start [--token <pair-token>] [--port 6736] [--origin https://demo.aliwork.com] [--open|--no-open]', 'help.cmd_bridge', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        requiresLogin: false,
        output: 'text|json',
      }),
      command('copy', ['copy'], 'copy [--force]', 'help.cmd_copy', { managedRun: {'scope':'denied','reason':'scope_not_audited'}, requiresLogin: false }),
      command('sample', ['sample'], 'sample [--list] [<skill> <name>] [--output <file-or-directory>] [--var KEY=VALUE ...] [--design-file <design.md>] [--style-id <themeId|free-creative>] [--theme-ids <id,...>] [--pop-art-context <explicit-request|showcase>]', 'help.cmd_sample', { managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'text|json',
        notes: [
          'openyida sample yida-data-management empty-query --output <file.js> emits buildEmptyConditions, buildCountConditions and countFilledRangeEndpoints. Use current schema field IDs and explicit range modes. Returned arrays work with --search-json or page searchFormDatas. The template performs no query, schema change or count maintenance.',
          'On explicit preview requests only: openyida sample yida-design theme-preview --theme-ids <comma-separated-ids> --output <preview.html> --json generates a standalone read-only HTML gallery on any host. Displays all requested eligible themes, titles and images only, four to six columns on desktop with responsive wrapping and unlimited rows; refuses existing files. Named templates reuse the exact catalog previewImage URL; generated cards render without scripts. Returns attachment and presentation metadata: show HTML cards in the conversation and include result.attachment in the same ask_human attachments when selection is needed. A browser tab or bare link alone is not inline delivery; preview-only requests do not create a choice. No selection buttons. app-pop requires --pop-art-context explicit-request|showcase with actual task evidence; absent evidence, exclude it from recommendations, choices and previews.',
          'Optional read-only QwenWork preview, only on explicit user request: run openyida sample yida-design theme-selector --json to prepare only the preview HTML in the host skills directory. No bridge submission; selection always uses ask_human. Pass result.widget_path unchanged to qoder_show_widget; it is relative to result.skillsRoot, not result.outputPath or a repository path. This sample does not accept --output, --var, --design-file or --style-id.',
          'yida-design app-theme reads concrete tokens from --design-file and writes CSS plus a sibling <output>.tokens.md update snapshot. The same output path preserves project CSS and applies changed tokens. Without --design-file it resets the output to the public base template. Menu radius, normal/hover/selected borders and selected shadow apply to side, L-shaped and top navigation; only legacy/shared-skeleton CSS gains missing menu-shape rules. Named templates preserve paired CSS declarations and selectors, instantiate brand placeholders and apply project deltas without auto-adding navigation rules or color-group.',
          'yida-design application-style --style-id supports every catalog theme and exports a three-file design.md/app_theme.css/form-layout.json authoring bundle to an output directory without overwriting files. Each ID selects a complete application theme, never a separate nav-xxx style. Its design.md owns navigation, shell, custom pages, forms and details, including colors, borders, hover, radius and shadow; paired CSS owns authored selectors and CSS defaults; template files are not rewritten to match design defaults. Independent color roles are preserved; only explicit var() references link them. Brand primary and hover values remain project placeholders until app-theme --design-file generates concrete CSS. Use design-plan catalog for presets and its separate creativeOption; free creative requires independent business decisions and explicit design tokens.',
          'Reuse platform variable bindings and author only necessary navigation overrides; omitted tokens inherit platform defaults and removing an unchanged generated override restores its binding. Do not require all navigation colors or a minimum token count. Design menu radius, normal/hover/selected borders, selected shadow, item height, padding, gap and shell spacing together in design.md navigation tokens (Fast) or visualStyle.tokens (Plan). These are design values, not separate CLI flags. Preset appearance does not override the business navigation layout. Verify native data-management navigation and business pages in workbench access mode; /admin is the development configuration surface.',
          'Native forms use a component tree with top, left, main, right and between-field regions. Platform form components include tabs, button groups, images/graphics, status areas, dividers, columns and business fields, serving navigation, actions, visual focus, feedback, hierarchy, decoration and data capture. Application-style form-layout.json provides an editable starting layout for openyida create-form: use the supported business fields, Divider and ColumnContainer, and retain other existing components when updating a form.',
          'canvas-nav-side/top/mixed/dock consume the same menu radius, normal/hover/selected borders and selected shadow as platform navigation. Side and Dock items read menu item height/padding; top and mixed header items read top-tab height/padding/max-width. Side/top/mixed menus read menu-gap; Dock reads slide-collapsed-menu-gap. Side shell padding uses slide-aside-padding and mixed uses l-aside-padding. Re-export the fragment, integrate it into existing page source and republish to upgrade existing custom navigation. canvas-nav-tabs remains an in-page tab control.',
          'yida-cool-card project-brief exports official-editor import JSON with typed variables and Mock data. Replace APP_URL through --var, then let the user import/save in the official editor and verify the same resource with cool-card get. This sample neither creates nor saves/publishes/sends a remote card.',
          'Canvas form-drawer, table-form and trend-combo samples include the maintained CanvasThemeProvider, read the current application CSS variables, and prevent loading-mask border flashes caused by late CSS resets.',
          'form-fields demonstrates field layout, not a default divider design. Choose dividerType for the current business page before creating forms; keep same-level sections consistent and vary different business pages when appropriate.',
          'openyida-page-template canvas-theme outputs the same provider as a reusable fragment; combine its imports and code with the business page in one Canvas file, keeping its scoped loading-mask style. Existing pages must update their provider and be republished; changing application theme CSS alone does not upgrade embedded provider code.',
          'openyida-page-template form-open-container extracts the maintained Canvas form drawer. Merge its imports, CanvasDrawer, FormOpenContainer, useYidaFormOpen and helpers; bind openForm(request) and render formOpenContainer. Do not replace it with a similarly named custom drawer.',
          'canvas-admin-entry includes canvas-navigation and a theme-aware business-workbench button. For service-management apps, consider a role-aware secondary frontend-to-management shortcut by default (header actions, profile menu or existing navigation), reusing an equivalent entry when present. This is design guidance only: no new required fields, validator or publish gate. The built-in flag supports app-manager identity, not arbitrary business roles; those need the project current-viewer permission adapter. Use the verified registered management destination, never developer admin. Visibility uses the current app-scoped loginUser.isAppAdmin flag (y/true only), matching g_config/pageConfig app identity with conflicts kept unknown, never CLI identities or a copied admin list. Configure a verified business page ID; unknown identity stays hidden and backend authorization remains authoritative.',
          'canvas-view-state restores the current local task view, allowlisted non-sensitive enum filters and page through URL state, preserving unrelated query/hash/history metadata. Use only without an existing router or unsaved-edit blockers; drafts, per-task caches and scroll need explicit policies. Verify iframe refresh/return behavior in the host. Business writes require verified server-side role, record, field and state-transition authorization; hidden buttons do not grant or enforce it.',
          'Extract canvas-theme before antd UI and canvas-navigation before cross-page actions; use verified target types and resource IDs. Local tabs use state. Compile/publish reject known app-prefix omissions and fixed ConfigProvider brand colors; runtime theme and destination verification is still required.',
        ],
        args: [
          { name: 'skill', type: 'string', source: 'positional', position: 0, description: 'Required when copying a sample.' },
          { name: 'name', type: 'string', source: 'positional', position: 1, description: 'Required when copying a sample; use --list for available names.' },
          { name: 'list', type: 'boolean', source: 'option', builder_options: ['--list'] },
          { name: 'pop-art-context', type: 'string', source: 'option', builder_options: ['--pop-art-context'], description: 'theme-preview only: app-pop requires explicit-request (user specifically asked for pop art) or showcase (primary task is presentation). Never infer from generic all-styles requests, dashboards or portals; use actual task evidence.' },
          { name: 'theme-ids', type: 'string', source: 'option', builder_options: ['--theme-ids'], description: 'theme-preview only: comma-separated eligible theme IDs in requested order; required, no duplicates. No limit on preview count or rows.' },
          { name: 'output', type: 'file', source: 'option', builder_options: ['--output'], description: 'Output file for ordinary samples/app-theme/theme-preview; output directory for application-style. Defaults under cwd/.cache/samples; application-style defaults to its application-style subdirectory and rejects an existing bundle file. Not accepted by theme-selector; its destination is resolved from the active QwenWork host skills roots.' },
          { name: 'var', type: 'string', source: 'option', builder_options: ['--var'], repeatable: true, description: 'Ordinary sample assignment KEY=VALUE; repeat --var for multiple variables. Not accepted by yida-design app-theme, application-style, theme-preview or theme-selector; complete design.md before generating theme CSS.' },
          { name: 'designFile', type: 'file', source: 'option', builder_options: ['--design-file'], description: 'Only for yida-design app-theme: completed design.md with concrete tokens. Optional for a base-template reset; supply it to generate or incrementally update project CSS.' },
          { name: 'styleId', type: 'string', source: 'option', builder_options: ['--style-id'], description: 'Required only for yida-design application-style. Accepts any themeId from design-plan catalog, including shared themes and free-creative. Exports design.md, app_theme.css and form-layout.json with brand placeholders; accepts neither --design-file nor --var.' },
        ],
      }),
      command('doctor', ['doctor'], 'doctor [--fix]', 'help.cmd_doctor', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, requiresLogin: false }),
      command('db-seq-fix', ['db-seq-fix'], 'db-seq-fix [--fix]', 'help.cmd_db_seq_fix', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
      command('formula.evaluate', ['formula', 'evaluate'], FORMULA_COMMANDS.evaluate.usage, 'help.cmd_formula_evaluate', { ...FORMULA_COMMANDS.evaluate, managedRun: { scope: 'local' },
        requiresLogin: false,
        output: 'text|json',
      }),
      command('formula.check', ['formula', 'check'], FORMULA_COMMANDS.check.usage, 'help.cmd_formula_check', { ...FORMULA_COMMANDS.check,
        managedRun: { scope: 'local' }, requiresLogin: false, output: 'text|json',
      }),
      command('formula.contracts', ['formula', 'contracts'], FORMULA_COMMANDS.contracts.usage, 'help.cmd_formula_contracts', { ...FORMULA_COMMANDS.contracts,
        managedRun: { scope: 'local' }, requiresLogin: false, output: 'text|json',
      }),
      command('formula.functions', ['formula', 'functions'], FORMULA_COMMANDS.functions.usage, 'help.cmd_formula_functions', { ...FORMULA_COMMANDS.functions,
        managedRun: { scope: 'app', appPosition: 1 }, output: 'text|json',
      }),
      command('formula.types', ['formula', 'types'], FORMULA_COMMANDS.types.usage, 'help.cmd_formula_types', { ...FORMULA_COMMANDS.types,
        managedRun: { scope: 'app', appPosition: 1 }, output: 'text|json',
      }),
      command('formula.inspect', ['formula', 'inspect'], FORMULA_COMMANDS.inspect.usage, 'help.cmd_formula_inspect', { ...FORMULA_COMMANDS.inspect,
        managedRun: { scope: 'app', appPosition: 1 }, output: 'json',
      }),
      command('formula.test', ['formula', 'test'], FORMULA_COMMANDS.test.usage, 'help.cmd_formula_test', { ...FORMULA_COMMANDS.test,
        managedRun: { scope: 'app', appPosition: 1 }, output: 'json',
      }),
      command('update', ['update'], 'update', 'help.cmd_update', { managedRun: { scope: 'denied', reason: 'scope_not_audited' }, requiresLogin: false }),
      command('export-conversation', ['export-conversation'], 'export-conversation [options]', 'help.cmd_export_conversation', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        requiresLogin: false,
      }),
      command('feedback', ['feedback'], 'feedback <report|github|setup|url|dismiss|status> [options]', 'help.cmd_feedback', { managedRun: { scope: 'actions', actions: { report: { scope: 'local' } } },
        permission: actionDependentPermission({ preauthorized_actions: ['report', 'url', 'status', 'dismiss', 'github status'], ask_actions: ['setup', 'github setup', 'github setup --install --confirm', 'github star', 'github fork'] }),
        requiresLogin: false,
        output: 'text|json',
        examples: ['openyida feedback report --input summary.json --output-dir feedback-draft-001', 'openyida feedback github setup --json', 'openyida feedback github setup --install --confirm --json'],
        // Keep setup conservative in permission metadata: --install changes the local machine.
        // The parser distinguishes read-only setup from a separately confirmed installation.
        notes: ['github setup [--json] detects gh and verifies the current account without installing or logging in. github setup --install --confirm performs one user-approved installation via existing Homebrew (macOS/Linux) or WinGet (Windows), then checks gh again. No manager bootstrap, source changes, automatic retry, upgrade, or automatic login; unsupported environments use official instructions or the web. Browser authorization requires separate consent and public submission still requires content review. report prepares local review drafts only; no login, source checkout, update check or network submission. github status [--json] checks the authenticated github.com user, Star and personal Fork through an existing gh installation; it performs no writes. github star|fork --confirm [--json] requires the user to explicitly choose that account action. Missing gh/login, unknown status and declined actions never block Issue submission. Already applied actions are reused; writes are single-attempt with readback. No auto-update/install hook, Issue submission, clone or git remote modification. Managed runs permit only offline report preparation.'],
      }),
      command('batch', ['batch'], 'batch <file>|--commands "cmd1 ; cmd2" [--stop-on-error] [--json]', 'help.cmd_batch', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        output: 'text|json',
      }),
      command('flash-to-prd', ['flash-to-prd'], 'flash-to-prd --file <path> --name "<project>"', 'help.cmd_flash_to_prd', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        requiresLogin: false,
      }),
      command('ai', ['ai'], 'ai <text|image> [options]', 'help.cmd_ai', { managedRun: { scope: 'denied', reason: 'scope_not_audited' },
        output: 'text|json',
      }),
      command('asset', ['asset'], 'asset <status|resolve|sources> [options]', 'help.cmd_asset', { managedRun: { scope: 'actions', actions: { status: { scope: 'local' }, sources: { scope: 'local' }, resolve: { scope: 'app', appOption: '--app-type' } } },
        noteKeys: ['asset.sourceRecords'],
        notes: ['resolve --page-id <pageId> selects a page from --design or input assetStrategy; output contains only that page. Use distinct --manifest paths for concurrent page jobs. Host search follows collection_policy; resolve performs one attempt per supplied candidate. Verified hotlink-allowed URLs are delivered directly without login or appType. Draft assets accept hotlinkAllowed/rehostAllowed booleans and deliveryMode=auto|upload. Stock CDN URLs allow hotlinking by default; Unsplash requires hotlinking unless separate rehosting permission is recorded. --upload-assets requests permitted hosting; upload failure keeps only a verified hotlink-allowed original URL.'],
        args: [
          { name: 'pageId', type: 'string', source: 'option', builder_options: ['--page-id'], description: 'Resolve only this page; requires design or input assetStrategy.' },
          { name: 'appType', type: 'string', source: 'option', builder_options: ['--app-type'], description: 'Target application for uploads; direct URLs need no application.' },
          { name: 'uploadAssets', type: 'boolean', source: 'option', builder_options: ['--upload-assets'], description: 'Request hosting where rehosting is allowed; otherwise use verified direct URLs by default.' },
        ],
        requiresLogin: false,
        output: 'text|json',
      }),
      command('cdn-config', ['cdn-config'], 'cdn-config [options]', 'help.cmd_cdn_config', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
      command('cdn-upload', ['cdn-upload'], 'cdn-upload <image-path>', 'help.cmd_cdn_upload', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
      command('cdn-refresh', ['cdn-refresh'], 'cdn-refresh [options]', 'help.cmd_cdn_refresh', { managedRun: { scope: 'denied', reason: 'scope_not_audited' } }),
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
    args: cloneJsonMetadata(entry.args, []),
    canonical: cloneJsonMetadata(entry.canonical, null),
    deprecated_patterns: cloneJsonMetadata(entry.deprecatedPatterns, []),
    repair_patterns: cloneJsonMetadata(entry.repairPatterns, []),
    examples: entry.examples,
    notes: [...cloneJsonMetadata(entry.notes, []), ...(entry.noteKeys || []).map(key => translate(key))],
    ...(entry.resultReuse ? { result_reuse: cloneJsonMetadata(entry.resultReuse, null) } : {}),
    hidden: entry.hidden,
    managed_run: cloneJsonMetadata(entry.managedRun, null),
    side_effect: cloneSideEffect(entry.sideEffect),
    permission: clonePermission(entry.permission),
  };
}

function summarizeLocalizedCommands(commands) {
  const sideEffectCounts = {};
  const idsBySideEffect = {};
  const permissionModeCounts = {};
  const idsByPermissionMode = {};
  const readOnlyCommandIds = [];
  const mutatingCommandIds = [];
  const allowCommandIds = [];
  const askCommandIds = [];
  const denyCommandIds = [];

  for (const entry of commands) {
    const effect = entry.side_effect || {};
    const kind = effect.kind || 'unknown';
    sideEffectCounts[kind] = (sideEffectCounts[kind] || 0) + 1;
    if (!idsBySideEffect[kind]) {
      idsBySideEffect[kind] = [];
    }
    idsBySideEffect[kind].push(entry.id);

    if (effect.mutates_yida === false && effect.mutates_local === false && kind !== 'mixed') {
      readOnlyCommandIds.push(entry.id);
    }
    if (effect.mutates_yida === true || effect.mutates_local === true || kind === 'mixed') {
      mutatingCommandIds.push(entry.id);
    }

    const permissionMetadata = entry.permission || {};
    const mode = permissionMetadata.mode || 'unknown';
    permissionModeCounts[mode] = (permissionModeCounts[mode] || 0) + 1;
    if (!idsByPermissionMode[mode]) {
      idsByPermissionMode[mode] = [];
    }
    idsByPermissionMode[mode].push(entry.id);
    if (mode === 'allow') {
      allowCommandIds.push(entry.id);
    } else if (mode === 'ask') {
      askCommandIds.push(entry.id);
    } else if (mode === 'deny') {
      denyCommandIds.push(entry.id);
    }
  }

  return {
    command_count: commands.length,
    group_count: COMMAND_GROUPS.length,
    forbidden_alias_count: FORBIDDEN_ALIASES.length,
    forbidden_alias_patterns: FORBIDDEN_ALIASES.map(entry => entry.pattern),
    side_effect_counts: sideEffectCounts,
    ids_by_side_effect: idsBySideEffect,
    read_only_command_ids: readOnlyCommandIds,
    mutating_command_ids: mutatingCommandIds,
    permission_mode_counts: permissionModeCounts,
    ids_by_permission_mode: idsByPermissionMode,
    allow_command_ids: allowCommandIds,
    ask_command_ids: askCommandIds,
    deny_command_ids: denyCommandIds,
    core_workflows: {
      data_management_ui_improvement: {
        orchestrator_skill_id: 'yida-data-manage-ui',
        reference: 'yida-skills/skills/yida-data-manage-ui/SKILL.md',
        trigger_phrases: ['针对当前数据管理页换一种风格', '数据管理页重在操作', '突出新增和筛选', '数据管理页只保留横线', '突出客户名称列', '列级强调', '状态列改成标签'],
        command_ids: ['data-manage-style.guide', 'app-theme.snapshot', 'update-app', 'app-theme.restore'],
        optional_command_ids: ['data-manage-style.list', 'data-manage-style.generate'],
        policy: 'Derive composable changes from the user task and actual DOM; no preset selection required. Inspect existing token consumers, then author minimal page/field-scoped CSS on the current full theme. Recipes are optional examples, not the style boundary; --lab-native-* is recipe-local, not a platform token API. Preserve native/custom ownership, fields, data, permissions and actions. Shell changes opt-in. Back up and verify recovery before publishing. Do not alter virtual grid geometry or automatically migrate to custom pages. Runtime verification is required.',
      },
      existing_ui_improvement: {
        orchestrator_skill_id: 'yida-design',
        reference: 'yida-skills/skills/yida-design/sub_skill/ui-improve/SKILL.md',
        theme_command_ids: ['app-theme.snapshot', 'app-theme.restore'],
        policy: 'Show the visual proposal and obtain ask_human approval before implementation. Cover every page and overlay in application-wide work. UI components may change while business behavior stays intact. Preserve legacy theme mode. Prove backup and restore capability before changes; on user dissatisfaction restore this run and verify. Theme CLI snapshots do not back up pages, cannot clear originally absent/empty keys, and cannot restore changed icons or migrate theme modes. Stop unsupported changes before implementation.',
      },
      full_app_build: {
        mode: 'unified_build',
        orchestrator_skill_id: 'yida-app',
        trigger_phrases: ['默认方案', '不要追问', '直接创建', '尽快搭建'],
        default_page_skill_id: 'yida-canvas-custom-page',
        default_ui_guidance_skill_id: 'yida-design',
        requirement_analysis_skill_id: 'yida-requirement-analysis',
        requirement_brief_path: '.cache/openyida/<project>/requirement-brief.json',
        visual_decision_policy: getVisualDecisionPolicy(),
        user_visible_expression_policy: {
          reference: 'yida-skills/skills/yida-design/references/ask-human-interaction-contract.md',
          audience: 'nontechnical_user',
          wording: 'Use everyday language, concrete business names and short sentences. Lead with the result or action; explain necessary technical terms on first use.',
          progress: 'Say what is happening and what happens next. Report completed work from verified results.',
          image_progress: 'Use 素材采集&应用创建 as the progress description while image collection and app creation are both running; otherwise use the active stage name. Keep the todo items separate. Record image counts, slots, subtasks and execution details internally.',
          todo: {
            templates: 'yida-skills/skills/yida-design/references/ask-human-interaction-contract.md#步骤列表与进度',
            titles: 'Use the exact short stage titles for the selected mode; keep app, forms, sample data, images, pages and publication as separate items.',
            scope: 'Select stages needed by the agreed scope; omit app creation for an existing app and omit unused sample-data/image stages.',
            updates: 'Keep titles and display order stable; update statuses and retain completed items. Display order permits parallel work.',
            details: 'Put business details in progress messages; record commands, task IDs, authorization context and timings internally. Put requested timing summaries in the report.',
          },
          questions: 'Ask one concrete decision and explain each option by what the user can do.',
          failures: 'State what failed, the actual impact and the next safe action. Explain only evidenced causes; describe unknown outcomes as pending verification.',
          waiting: 'Explain what is taking time and what can continue. Give time estimates only with a basis and update them when circumstances change.',
          diagnostics: 'Keep exact technical fields and error codes in tool results and implementation handoffs; explain them when the user asks for technical details.',
          browser_acceptance: 'Cloud browser checks are not applicable, not failed delivery work. Keep not_checked internal; no install reports or default open/refresh/screenshot requests. Report unverified functions only for requested acceptance or business issues; never claim visual verification.',
        },
        optional_asset_branch: {
          skill_id: 'yida-image-assets',
          collection_policy: getMaterialSourcingGuidance().collectionPolicy,
          failure_policy: getMaterialSourcingGuidance().failurePolicy,
          completion_policy: getMaterialSourcingGuidance().completionPolicy,
          scheduling_policy: getMaterialSourcingGuidance().schedulingPolicy,
          trigger: 'Any page is imageNeed=required, or imageNeed=beneficial with declared image slots.',
          output_path: 'prd/<project>/asset-manifests/<pageId>.json',
          skip: 'All pages are imageNeed=none.',
          dependency_policy: 'After Plan confirmation, dispatch materialize.assetTasks through host background tools, record actual task IDs in taskState and continue app/form/page creation, layout, data binding and interactions. Fast derives the same tasks from design.md. Reattach running tasks; preserve deadlines and used rounds on resume. Use scheduling_policy for collection-wide concurrency, priorities and host-enforced budgets. One writer owns each page draft/manifest. Verify direct URLs as each page draft becomes ready; uploads additionally need appType. Read results at own-page image binding, waiting only after independent work. Check background_agent and background_shell independently. QwenWork may use Bash run_in_background only when the actual tool schema supports it; synchronous Agent calls are not background dispatch. Without usable background execution, perform authorized resource/seed/independent page work first, then bounded asset batches. Record dispatch return and business start/end intervals in build-manifest.assetExecution for check-prd-completeness; never claim overlap from task names alone.',
        },
        artifact_generation: {
          mode: 'parallel',
          audience: 'internal',
          user_visible_delivery: false,
          tasks: [
            { skill_id: 'yida-prd', output_path: 'prd/<project>/prd.md' },
            { skill_id: 'yida-design', output_path: 'prd/<project>/design.md' },
          ],
          join_owner_skill_id: 'yida-app',
        },
        ordinary_jsx_skill_id: 'yida-custom-page',
        form_page_policy: 'Use yida-create-form-page for form structure and business actions. Use create-form.batch to create independent normal forms concurrently, resolve dependencies from real IDs and read back fields; apply shared app configuration, application theme, and navigation order afterward.',
        divider_style_contract: {
          reference: 'yida-skills/skills/yida-create-form-page/references/form-field-properties.md#divider',
          input: 'fields[].dividerType (also inside layout children); field JSON, not a CLI flag',
          schema_path: 'Divider.props.type',
          supported_types: DIVIDER_TYPES,
          fallback: DEFAULT_DIVIDER_TYPE,
          selection: 'Choose by each page business task and visual weight; keep same-level sections consistent within a page. Prefer suitable variation across different business pages. If the scene is unclear or suitable candidates tie, shuffle compatible candidates and rotate across pages, preferring unused styles until exhausted. Record one choice per page in design.md and dividerType before compilation; retries reuse it. Preserve existing supported styles for local edits.',
          invalid_input: 'INVALID_DIVIDER_TYPE diagnostics; create rejects with CREATE_FORM_INVALID_DIVIDER_TYPE. Never silently replace a supplied unsupported style.',
          color_guidance: {
            reference: 'yida-skills/skills/yida-design/references/native-form-styles.md#分割线弱背景',
            mode: 'agent_design_guidance_only',
            default_mode: 'theme',
            custom_mode: 'custom',
            inputs: ['colorType', 'backgroundColor', 'secondaryColor', 'titleColor'],
            input_location: 'Field JSON for create/batch; changes for update; props in field-props operations for patch. Not CLI flags.',
            schema_paths: ['Divider.props.colorType', 'Divider.props.backgroundColor', 'Divider.props.secondaryColor', 'Divider.props.titleColor'],
            default_bindings: {
              primary: 'var(--color-brand1-6)',
              secondary: 'var(--color-brand1-2)',
              text: 'var(--color-text1-4, #171a1d)',
            },
            custom_when: 'The user requests colors, or default bindings do not suit the current theme, visual weight or readability. Design all three colors together; do not require user-specified values for each color. Reuse colors across peer sections.',
            dark_content: 'Distinguish dark content from dark navigation with light content. Treat brand1-2 as a weak brand surface, not permanently near-white. Root secondary overrides may lose to inline component bindings. For local repairs, prefer component colors when global changes would affect other consumers.',
            composite_titles: 'Consider outer decoration, the actual title surface and the title separately. In inner-ellipse-title the inner ellipse carries the text. Preserve existing supported shapes; do not dim the whole component to fix its background.',
            solid_title_surfaces: 'For dark-bar and light-left-title/light-center-title/light-house-title/light-hexagon-title, distinguish the primary-colored title block from the secondary strip. Prefer white or near-white on sufficiently dark primary surfaces; if a bright saturated fill weakens white text, deepen the component backgroundColor while preserving its hue. Do not force white onto pale surfaces. Set titleColor explicitly in custom mode instead of retaining its dark default; do not change global body text to fix a local title.',
            label_coordination: 'Design the divider title, first field label and input as a group. Share font family; use modest title weight/size emphasis, readable neutral labels, coordinated alignment and spacing. Preserve centered decorative headings without centering field labels. Keep the section gap larger than the title-to-first-field gap, and label-to-input spacing compact. Do not dim labels to create hierarchy or repeat excessive saturated decoration. The label role pod-form-label-color is separate from divider titleColor; record choices in existing design.md without new flags or blocking checks.',
            picker_icons: '--color-fill1-6 is a weak foreground for picker icons; choose a readable auxiliary foreground against the actual input surface, for example the current theme color-text1-3.',
            lifecycle: 'Record the choice in existing design.md. Revisit custom colors when changing themes; they do not automatically follow theme switching. Do not claim visual verification from a successful command or when preview is unavailable.',
            new_cli_flags: false,
            adds_validation_or_blocking: false,
          },
        },
        page_skill_policy: 'Use YidaCodeCanvas by default for new primary custom pages. Choose yida-custom-page only when the current target has been identified as existing .oyd.jsx/.oyb.jsx/renderJsx/platform Jsx component maintenance; do not switch to yida-custom-page merely because a page needs data, forms, uploads, this.utils.yida.*, or dataSourceMap-like capabilities.',
        form_entry_policy: {
          scope: 'Ordinary page-level form creation, submission and detail actions in frontend and backend, Fast and Plan; full-code pages are not exempt.',
          reference: 'yida-skills/skills/yida-canvas-custom-page/references/navigation-and-entry-guide.md#标准-formopencontainer',
          sample_command: 'openyida sample openyida-page-template form-open-container --output .cache/samples/form-open-container.jsx',
          integration: 'Merge CanvasDrawer, FormOpenContainer, useYidaFormOpen, imports and helpers. Bind openForm(request) and render formOpenContainer. Keep iframe, header controls, resize handlers and close refresh; desktop uses the drawer, mobile opens the native form.',
          validation_command_ids: ['check-page', 'compile', 'publish'],
          verification: 'Canvas preflight uses compile <source> --json; check-page is the legacy platform JSX preflight. Source checks detect recognized direct links, homemade overlays and incomplete template wiring; verify actual form interactions after publishing. Static checks do not prove all dynamic actions.',
          exceptions: 'Search/filter controls are not form submission. Explicit batch entry uses the table-form skill. Planned application navigation may embed a native form in its main content; this does not exempt page action buttons.',
        },
        plan_command_ids: ['design-plan.catalog', 'design-plan.init', 'design-plan.preview', 'design-plan.materialize', 'design-plan.patch'],
        plan_confirmation_policy: confirmationPolicy,
        theme_command_ids: ['sample', 'create-app', 'update-app'],
        navigation_command_ids: { platform: ['update-app', 'nav-group'], custom: ['update-app', 'update-form-config', 'get-form-config'] },
        navigation_policy: 'Before PRD planning in Fast and Plan, the agent determines navigation ownership and layout from business context. Follow yida-design/references/navigation-decision.md for entry and layout decisions. Preserve explicit user requirements and existing navigation for local changes; resource-only requests operate on their specified resources and settings. Use native navigation by default for the application workspace, and custom navigation only for an explicitly justified application-level branded menu or special navigation interaction. A service frontend defaults to one coding page with its own menu and all selected business views; a single-step entry can use navigation.type=none. Choose backend native or coding pages by task efficiency. Backend coding pages in platform-shell are content-only: platform menus own cross-module navigation; local Tabs cover categories or states of the current task only. Never turn the management entry menu into a second page navbar, sidebar or module Tabs. Persistent filters/state alone do not justify custom application navigation. Plan handoff pages include derived navigationPolicy; Fast records the same boundary. Do not hide platform navigation to repair duplicate page menus. Store application navigation in navigationType and standalone entry menus in pageSpecHandoff.navigation. Configure a custom frontend menu at page scope and preserve workspace navigation. Record type/source/reason/variant using ai_default for agent ownership decisions and user_selected for explicit user requirements. Include navigation in the overall Plan confirmation; Fast implements the recorded decision. Platform navigation uses update-app --layout top|side|l_shape --show-app-nav, persisting layoutDirection and hideAppNav=n. Preserve stored navType. For appThemeEnable=n or appThemeMode=legacy, persist side/top/l_shape as ver/hoz/ver and white/gray as light; without --layout preserve stored slide/ver/hoz. For modern or unknown capability, normalize layoutDirection and navType using the existing application layout compatibility rules (hoz plus top_side means l_shape; missing layout uses top_fold/top_side for top/l_shape). Apply shell top_fold/none overrides at page scope. Application-wide custom side/top/mixed/dock uses app hiding plus per-page hiding within scope; a standalone frontend in a platform-navigation app uses only page configuration. Read back layoutDirection, hideAppNav and each configured page, then verify the planned frontend and workspace links. Navigation structure is separate from tone. Navigation tone is derived from the final selected theme template, never guessed from the business brief or implicitly defaulted to light; apply that explicit value with update-app --nav-theme. Custom top navigation defaults to edge-to-edge, not floating. Over a hero image, start transparent, add a surface on scroll, restore transparency at the top; expanded menus stay readable. Follow yida-design/references/page-continuity.md; floating requires an explicit design.',
        design_mode_policy: 'Analyze requirements first with yida-requirement-analysis: read only necessary sources before the first question, offer concrete core-function candidates, clarify key usage, and preserve explicit scope and valid answers. Initial intake focuses on core functions and actual usage. Record actual user replies; proceed with dependent planning after a reply or explicit delegation. First-time builds include new apps and existing apps without business pages. After intake, reuse explicit mode choices and detailed supplied plans; if the user delegates the mode or asks for no more questions, use Fast unless Plan is explicit; otherwise, if the mode is unspecified, ask whether to prepare a PRD for confirmation (Plan, more detailed and slower) or build from the supplied requirements (Fast). Without detailed requirements, offer Fast and Plan neutrally. intake.confirmed records scope and key-usage clarification; the plan revision tracks plan approval separately. Apply visual_decision_policy.themeSelection.intent first: infer directly from stated styles or inspect reference websites/images for visual DNA, then generate design.md and theme CSS without reopening selection. Preserve sources and separate observed facts from AI defaults. Only without intent, visual reference or reusable choice do Fast and Plan share the three-direction comparison rule; Fast selects internally and Plan also selects internally when delegated. Follow themeSelection.reuse across stages, recovery and pending details; resolve only concrete conflicts. Preserve themeId and source. When Plan is explicit and there is no style intent, visual reference, reusable choice or delegation, generate exactly three directions and follow visual_decision_policy.themeSelection for the style choice before design-plan init. When a style question is needed, use ask_human on every host with text-only options by default. Apply themeSelection.preview on every host: all galleries, widgets, images and preview links are off by default and require explicit user requests; supplied references do not trigger display. On every host follow themeSelection.interactionOrder: batch ready independent style, scope and mode questions in one ask_human call; split only for real answer dependencies or host limits, keep only one pending interaction, and preserve later plan approval. Apply themeSelection.eligibility before recommending, selecting or previewing app-pop; generic all-styles requests do not qualify. Planning preparation derives page scenes, selected theme mapping and navigation structure before init; mark AI suggestions and apply navigation_policy. Existing business apps only clarify the current change. A named resource-only request with explicitScope.allowInferredResources=false keeps planning within the specified resources. When theme mapping is missing, query design-plan catalog once and reuse its themes and pagePatterns. Init returns authoring.pendingFields and context with typed examples; complete pending facts and review coverage before setting ready=true. Reuse one complete agent-capabilities summary per unchanged environment. Standard Plan uses design-plan init parallelTasks, then executes the returned materialize.command exactly once with business-file and visual-file; preview and --from-preview are only for explicitly incremental large plans. Present the current plan without revision numbers in user-visible titles, summaries, attachments or questions. Keep revision in internal confirmation fields, validate it before building, and execute its generated artifacts.',
        product_design_policy: 'yida-requirement-analysis owns shared facts and first-time intake. yida-prd owns business planning; yida-design owns visual design. Reuse the same confirmed brief and supplied details. Prepare business and base visuals concurrently, then bind visuals to settled page tasks. yida-app merges and checks the artifacts before creating resources. Plan authors scope, data and rules, page organization, business interactions and acceptance once. Ordered blocks {name,purpose} supply default priority and content layers; explicit designs remain authoritative. Project-specific acceptance criteria are merged with generated resource checks. Plan uses the compact authoring contract and selected theme context; the CLI reads full templates and renders all artifacts. Fast, Plan and single-page design share yida-design/templates/design-themes and visual_decision_policy: infer directly from supplied style intent or extracted reference DNA, and use the shared three-direction rule only when comparison is needed. Theme templates declare application-global variables from basic-tokens.json with fixed typography, spacing and Tooltip colors, plus scoped custom-page variables; component recipes consume those variables. Each selected template is the authority for navTheme, its six navigation color tokens, and its selected-item shadow token; free-creative authors its own navigation tone and tokens. Explicit project customization stays in visualStyle.tokens. The CLI declares each fixed application palette once in a shared :root and platform-mode selector block. The CLI preserves mode-independent navigation appearance tokens. Light, dark, white and gray mode classes consume the same project tokens; navTheme remains platform metadata, not a second palette. Legacy generated mode blocks are consolidated on update, while unrelated custom CSS is preserved.',
        ui_guidance_policy: 'Page implementation consumes yida-prd prd.md for positioning, information architecture, page prototype, native form entry policy, material strategy, business-specific checks, resource creation order, page implementation delivery order, navigation order, and acceptance criteria; it consumes yida-design design.md for app custom theme CSS delivery, themeColor/navTheme, visual states, visualScaffold, surface material, rounded rules, density rules, components, state styling, and page-level imageNeed. When a page is imageNeed=required, or beneficial with declared image slots, yida-image-assets prepares a traceable asset manifest alongside page layout and interaction work; wait for final images only at that page\'s image binding and acceptance. imageNeed=none skips the branch. prd.md and design.md remain the only design sources of truth. Page implementation may extract page-spec.json as a derived implementation handoff from prd.md + design.md; conflicts are resolved by sending business conflicts to yida-prd and visual conflicts to yida-design before regenerating the spec. Core normal forms default to 1-3 business sample records before page implementation, followed by query readback. An explicit opt-out, configuration dictionary, sensitive data, or lack of safely constructible values requires a recorded skip reason. Screenshots, public sharing, data-source deep binding, and fine navigation grouping are optional after explicit user request or PRD acceptance criteria.',
        default_nav_order_policy: 'For application-wide custom navigation, implement each entry menu and verify app/page navigation hiding. A standalone frontend preserves platform navigation for the management workspace; frontend-only delivery skips platform ordering. After all scoped resources and page publications finish, perform exactly one navigation order operation. Use management tasks and their default destination, without creating a homepage or putting a frontend page first. When execution.entryRecommendation exists, derive navigationOrder from its management/workspace menus. Call openyida nav-group order <appType> <items...> for an explicit order; otherwise call openyida nav-group auto-order <appType> once for legacy single-workspace plans. Do not use openyida publish ... --auto-nav-order for per-page application builds. Explicit and automatic ordering are mutually exclusive; never generate per-item move loops.',
        final_link_policy: 'Return up to three verified application entry URLs in frontend, business management, developer admin order; default complete delivery includes runtime access and developer admin. Never emit one artifact or link card per form, process, report, schema, manifest, PRD, design file, or intermediate artifact. Include one verified management entry when a management or unified workspace is in scope: the app workbench URL or a planned workbench/formUuid URL with its real viewUuid. Backend-only returns its verified business backend entry and developer admin URL without adding a frontend. Native management does not require a display homepage; frontend-only delivery includes its verified frontend entry and developer admin URL, without inventing a business backend. For scoped service frontend pages, infer standalone when entryMode is missing; preserve an explicit platform-shell choice and its verified workbenchUrl. Add the clean custom page URL only for standalone pages when get-form-config readback confirms renderNav=false (fallback to isRenderNav only when renderNav is absent). agent-capabilities application_entry_policy.entries.admin=include is independent of auth runtime. Read adminUrl from create-app or app-list results; route construction does not verify recipient permissions. Explicit user exclusions take precedence; single-page tasks retain their scope. QwenWork owns link, file and result presentation; return the verified summary and URLs without prescribing styles, card counts, display tools or update identifiers. Other hosts may use their terminal delivery artifact description; return the same concise content when no delivery tool is available. Summarize business resources by capability or count, but every resource count, seed-record count, and completed/verified claim must come from that resource\'s own successful result or readback. When the user or caller explicitly requests a resource manifest, resource UUIDs/IDs, publish status, or test-data summary, include one concise verified delivery manifest in that description (or the final response when no delivery tool is available).',
        entry_navigation_contract: {
          reference: 'yida-skills/skills/yida-app/references/entry-navigation.md',
          brief_path: 'entryRecommendation',
          plan_path: 'execution.entryRecommendation',
          input_transport: 'JSON file or design-plan patch --set execution.entryRecommendation=<json>; not a CLI flag',
          modes: [...ENTRY_MODES],
          mode_meaning: 'These modes describe how people use the application, not developer administration: unified shares business pages with role-based menus and permissions; service-management separates pages for people requesting a service and people processing it; frontend-only delivers only the requested frontend; backend-only delivers staff pages for recording, processing or maintaining business, with service requests originating elsewhere or no service entry required. For frontend-only submissions that need processing, record the existing system, staff entry or automation in reason and business flows; unresolved handling remains an open question. Backend-only entries use role management; new unified plans normally use workspace, while legacy unified plans retain their roles. Different roles alone do not require separate frontends and backends. Separate entries can share one application and its data.',
          user_facing_explanation: 'Say whether the system has separate frontend and business-backend pages, then explain who uses each entry, what they see and what they can do. Choose from confirmed tasks; if actual usage is unclear and changes the page plan, ask a concrete business-use question.',
          derived_summary: 'execution.entryModeSummary is generated for PRD and preview from the selected mode; do not author it in build-plan.json.',
          roles: ['service', 'management', 'workspace'],
          entry_required_fields: ['key', 'name', 'role', 'menu', 'defaultMenuKey'],
          service_page_binding: 'sceneKey of the frontend page; standalone by default, preserve explicit platform-shell. Missing page navigation for a multi-task service entry derives a custom top menu; single-task entries and explicit none retain their choice.',
          application_theme_handoff: 'Derived applicationTheme in the PRD execution handoff records final design themeColor/navTheme/designFile for full builds. Fast records the same contract. check-prd-completeness reads current application settings; publish does not install application themes. Resource-only changes add no theme task. Configuration matching is separate from browser acceptance and custom-page token consumption.',
          menu_visibility_handoff: 'Derived navigationVisibility in the PRD execution handoff, not a build-plan input: service-management hides frontend-only standalone display pages in PC/mobile platform menus. Shared forms and explicitly management-linked pages are preserved. Resolve names to build-manifest resource IDs; nav-group hide and readback are separate from page renderNav=false. Resource-only changes schedule no menu hiding.',
          page_navigation_policy: getPageNavigationContract(),
          local_menu_binding: 'Every entry containing local menus, including management/workspace, requires sceneKey matching exactly one page; each local menu requires resource equal to that page name and a nonempty viewKey.',
          menu_target_types: ['local', 'submission', 'page', 'custom'],
          menu_resource_reference: 'planned resource name; resolve to real formUuid before runtime',
          menu_optional_fields: ['viewUuid', 'viewKey'],
          planned_access_fields: ['resource', 'operation', 'dataScope', 'viewUuid?'],
          leaf_access_required: 'Every leaf menu in every role requires access: OPERATE_CREATE for submission, OPERATE_VIEW otherwise, with matching target resource and viewUuid. These declarations do not grant permissions.',
          runtime: {
            applies_to: 'Confirmed page-owned application menus only. Platform-shell management pages use platform menus and content-only pages; same-task Tabs do not require canvas-nav-data or a navigation shell.',
            sample: 'canvas-nav-data',
            loader: 'loadCanvasNavigation',
            parameters: ['items', 'appType?', 'formUuid?', 'csrfToken?', 'hiddenNav?', 'signal?', 'mode?', 'resolveAccess?'],
            app_type_required: 'platform, independent or any declared access',
            modes: ['local', 'platform', 'independent'],
            local_policy: 'Presentation-only views require key/viewKey/targetType=local and no href/url; no platform navigation request. Declared access still requires real resolveAccess. Business data and mutations retain platform permission checks.',
            platform_policy: 'Every leaf binds formUuid/navUuid. Local views must not be filtered through platform navigation; configuration errors fail before network requests.',
            layout_policy: 'Long pages use canvas-nav-content layout=document with natural height; canvas-nav-top uses headerOnly and overlay. Default full-width sticky header; navigationPosition=fixed stays within page bounds when the host prevents sticky. Workspace retains bounded flex and inner scrolling.',
            default_mode: 'platform',
            mode_meaning: 'Permission/filtering source for an already planned custom menu; platform mode does not mean platform-shell pages should render another menu.',
            resolve_access_required: 'independent mode or any declared access',
            resolve_access_input: ['appType', 'requirements', 'signal'],
            requirement_fields: ['formUuid', 'operation', 'viewUuid?'],
            resolve_access_output: '{appType,grants:[{formUuid,operation,viewUuid?,allowed:boolean}]}',
            builtin_permission_adapter: false,
            permission_policy: 'Current viewer, exact resource/operation/view and allowed===true; errors never fall back to unrestricted menus. dataScope is enforced by platform permissions, not menu filtering. In service-management frontends, consider a secondary management shortcut for authorized current viewers; hide for ordinary, anonymous or unknown viewers. Reuse the registered management destination and existing identity adapter. This is authoring guidance, not a new validation or delivery gate.',
          },
        },
        application_entry_policy: {
          ...buildEntryDeliveryPolicy(),
          persistence: {
            command_ids: ['app-entry.get', 'app-entry.set'],
            policy: 'Before final complete-application delivery, registration and readback of all verified in-scope business runtime entries is required by default: service-management writes both, frontend-only writes frontend, backend-only/unified writes management. Resolve each planned default resource/view independently; never reuse the last published page or substitute a root workbench for a task URL. Use readback urls.frontend/management for final entry URLs. Existing identical entries can reuse the readback; set performs partial merge and readback. Missing verification or failed persistence is incomplete delivery, not a reason to emit guessed links. Respect explicit no-write constraints. Do not register admin/design URLs. Incremental resource-only work preserves existing entries. Clear only on explicit removal. Conflicts require reread and review, never blind retries.',
          },
          workbench: {
            include: 'when_workspace_in_scope',
            url: '{base_url}/{appType}/workbench',
            task_url: '{base_url}/{appType}/workbench/{formUuid}',
            view_parameter: 'viewUuid',
            selection: 'one verified planned management default; use real resource/view IDs; no homepage required',
          },
          custom: {
            include: 'when_entry_mode_standalone_and_is_render_nav_false_readback',
            url: '{base_url}/{appType}/custom/{formUuid}',
            default_policy: 'A scoped service frontend is a standalone display page even when entryMode was omitted. Plan derives it from role=service and sceneKey; Fast follows the same business intent. Persist page navigation hiding and read it back, without a new flag or navigation URL query. Preserve explicit platform-shell frontend choices: use the verified workbenchUrl with app-entry --frontend, not --frontend-page. Only whole-application custom navigation hides hideAppNav; standalone frontend pages must preserve backend platform navigation and shared-form settings. URL isRenderNav for native submission/detail pages is independent of persisted renderNav; keep those per-open parameters. Missing verification is incomplete frontend delivery, not permission to silently omit it.',
            url_source: 'publish.standaloneUrl or post-publish get-form-config.standaloneUrl; require navigationVerification.renderNav=false and verified=true',
          },
          admin: {
            include: 'default_for_complete_application',
            url: '{base_url}/{appType}/admin',
          },
          internal_artifacts: 'never_user_visible',
          business_resources: 'summary_only_unless_explicit_verified_manifest_requested',
        },
        conditional_entry_command_ids: ['update-form-config', 'get-form-config'],
        required_command_ids: [
          'agent-capabilities',
          'create-app',
          'create-form.create',
          'create-form.batch',
          'create-process',
          'create-page',
          'publish',
          'app-entry.get',
          'app-entry.set',
          'check-prd-completeness',
        ],
        optional_read_command_ids: ['get-schema', 'list-forms'],
        recommended_read_commands: [
          'openyida get-schema <appType> <formUuid> --summary-json',
          'openyida get-schema <appType> --all --summary-json --keyword <text> --output-dir .cache/openyida/<task>/schemas',
          'openyida check-prd-completeness prd/<project>/prd.md --app-type <appType> --build-manifest prd/<project>/build-manifest.json --json',
        ],
        default_data_contract: 'Do not use this.dataSourceMap.* in default full-app page code unless a designer data source was created and bound in the same run; use this.utils.yida.* or an entry-only page by default.',
        optional_after_done_command_ids: [
          'save-share-config',
          'get-page-config',
          'create-report',
          'append-chart',
        ],
        do_not_default_skill_ids: [
          'yida-data-source-connectors',
          'yida-dashboard',
        ],
        completion_contract: 'Clarify core functions and actual usage first, then resolve the required resource context and settle entry navigation before PRD planning. Fast generates prd.md and design.md in parallel; Plan uses design-plan init/preview/materialize/patch and confirms the current revision. Validate both artifacts, create or reuse app and core forms/processes, seed and query-check core normal-form samples or record an allowed skip reason, then implement the primary page in PRD resource order, publish it, apply PRD navigation order or lightweight fallback navigation order for platform navigation, or verify app and per-page hiding for application-wide custom navigation. For a standalone frontend in a platform-navigation app, verify that page independently and retain workspace navigation. Before returning up to three verified application entry URLs, persist and read back the verified in-scope frontend/management access addresses through app-entry get/set; final business links come from urls.frontend/management, not the last publish result. Include workbench when a management or unified workspace is in scope; backend-only delivers its business backend and developer admin URL without adding a frontend; frontend-only delivery includes its verified frontend entry and developer admin URL, without inventing a business backend. Always include developer adminUrl for complete application delivery unless explicitly excluded by the user, regardless of auth runtime; this is separate from the optional business backend. Use create-app or app-list URL fields and state any unavailable entry instead of silently omitting it. Put the verified business summary, results and remaining work in the delivery artifact description; use the final response when no delivery tool is available.',
      },
    },
  };
}

function buildCommandManifest(options = {}) {
  const translate = typeof options.t === 'function' ? options.t : key => key;
  const commands = flattenCommandManifest();
  const localizedCommands = commands.map(entry => localizeCommand(entry, translate));

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
    managed_run_schema: managedPolicySchema(),
    side_effect_schema: cloneSideEffectSchema(),
    permission_schema: clonePermissionSchema(),
    forbidden_alias_schema: cloneForbiddenAliasSchema(),
    forbidden_aliases: FORBIDDEN_ALIASES.map(entry => localizeForbiddenAlias(entry, translate)),
    summary: summarizeLocalizedCommands(localizedCommands),
    commands: localizedCommands,
  };
}

module.exports = {
  COMMAND_GROUPS,
  buildCommandManifest,
  buildEntryDeliveryPolicy,
  findCommandSuggestion,
  findForbiddenAliasSuggestion,
  flattenCommandManifest,
  listCommandPermissionIds,
  listCommandSideEffectIds,
};
