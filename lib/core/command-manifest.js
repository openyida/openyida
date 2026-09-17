'use strict';

const { getMaterialSourcingGuidance } = require('../asset/ai-image');
const { getVisualDecisionPolicy } = require('../design-plan/visual-policy');
const { getPageNavigationContract } = require('../design-plan/navigation-policy');

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
    ask: 'Requires user confirmation before agent execution; currently reserved for destructive/delete-like operations.',
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
  ['create-form.batch', sideEffect('remote_write', { mutates_local: true })],
  ...sideEffectEntries([
    'agent-capabilities',
    'check-page',
    'commands',
    'create-form.icons',
    'create-form.validate-fields',
    'dingtalk-link',
    'design-plan.catalog',
    'formula.evaluate',
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
    'logout',
    'sample',
    'update',
  ], sideEffect('local_write')),

  ...sideEffectEntries([
    'app-list',
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
    'integration.list',
    'list-forms',
    'process.preview',
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
    mutating_actions: ['login', 'refresh', 'logout', 'profile switch'],
  })],
  ['batch', sideEffect('mixed', {
    mutates_yida: true,
    mutates_local: true,
    read_actions: [],
    mutating_actions: ['depends on commands in batch'],
  })],
  ['integration.update', sideEffect('local_write', {
    mutates_yida: false,
    mutates_local: true,
  })],
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
    mutating_actions: ['create', 'update', 'delete'],
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
    read_actions: ['help', 'contact user search', 'calendar event list', 'approval instance list'],
    mutating_actions: ['install', 'setup', 'todo task create', 'chat robot send', 'depends on dws command'],
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
    read_actions: ['url', 'status'],
    mutating_actions: ['setup', 'dismiss'],
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
    mutates_yida: true,
    mutates_local: false,
    read_actions: ['todo', 'created', 'processed', 'cc'],
    mutating_actions: ['submit'],
  })],
]);

const ALLOW_WRITE_REASON = 'Allowed by policy: non-destructive write, update, publish, import, upload, or local file operation.';
const ALLOW_EXTERNAL_REASON = 'Allowed by policy: non-destructive auth, external service, local server, or package operation.';
const ACTION_DEPENDENT_REASON = 'Action-dependent command: allow only read_actions or preauthorized_actions; ask ask_actions and unknown mutating actions.';

const COMMAND_PERMISSIONS = new Map([
  ...permissionEntries([
    'agent-capabilities',
    'app-list',
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
    'get-form-config',
    'get-page-config',
    'get-permission',
    'get-schema',
    'integration.check',
    'integration.diagnose',
    'integration.list',
    'list-forms',
    'process.preview',
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
    'update-form-config',
  ], permission('allow', 'write', {
    reason: ALLOW_WRITE_REASON,
  })),

  ...permissionEntries([
    'login',
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
    preauthorized_actions: ['login', 'refresh', 'logout', 'profile switch'],
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
    preauthorized_actions: ['create', 'update'],
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
    preauthorized_actions: ['setup', 'dismiss'],
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
    preauthorized_actions: ['submit'],
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
    hidden: options.hidden === true,
    sideEffect: cloneSideEffect(commandSideEffect),
    permission: clonePermission(normalizedPermission),
  };
}

const COMMAND_GROUPS = [
  {
    id: 'auth',
    titleKey: 'help.group_auth',
    commands: [
      command('login', ['login'], 'login [target-url] [--env <name>|--intl|--overseas|--global|--yidaapps|--alibaba] [--client-id <clientId>] [--endpoint <url>] [--no-browser]', 'help.cmd_login', {
        requiresLogin: false,
        output: 'json',
      }),
      command('logout', ['logout'], 'logout', 'help.cmd_logout', { requiresLogin: false }),
      command('auth', ['auth'], 'auth <status|login|refresh|logout|profiles|profile switch>', 'help.cmd_auth', { requiresLogin: false }),
      command('org', ['org'], 'org <list|switch> [--json] [--corp-id <corpId>]', 'help.cmd_org'),
      command('env', ['env'], 'env [--json|setup|list|show|switch|add|remove] [options]', 'help.cmd_env', {
        requiresLogin: false,
        output: 'text|json',
      }),
    ],
  },
  {
    id: 'app',
    titleKey: 'help.group_app',
    commands: [
      command('app-list', ['app-list'], 'app-list [--type managed|created] [--page N] [--size N]', 'help.cmd_app_list', {
        notes: ['Successful results include appUrl/workbenchUrl for the business workspace and adminUrl for developer administration. Complete application delivery retains adminUrl regardless of auth runtime; route construction does not verify recipient access. Preserve the frontend URL from its own page result.'],
      }),
      command('corp-efficiency', ['corp-efficiency'], 'corp-efficiency [overview|details|detail|groups|notify] [options] [--open|--no-open]', 'help.cmd_corp_efficiency', {
        output: 'json',
      }),
      command('create-app', ['create-app'], 'create-app "<name>"|--name <name> [options] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]', 'help.cmd_create_app', {
        notes: ['Successful results include appUrl/workbenchUrl for the business workspace and adminUrl for developer administration. Complete application delivery retains adminUrl regardless of auth runtime; route construction does not verify recipient access. Preserve the frontend URL from its own page result.'],
      }),
      command('design-plan.catalog', ['design-plan', 'catalog'], 'design-plan catalog [--json]', 'help.cmd_design_plan_catalog', {
        requiresLogin: false, output: 'json',
        args: [{ name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] }],
        notes: ['Read available theme IDs and page patterns before init when the theme mapping is unknown. Reuse this result for the current planning session.'],
      }),
      command('design-plan.init', ['design-plan', 'init'], 'design-plan init <requirement-brief.json> [--theme-id <id>] [--output-dir <dir>] [--json]', 'help.cmd_design_plan_init', {
        requiresLogin: false,
        output: 'text|json',
        notes: ['Returns preserved business facts, authoring.pendingFields with file/path/message, typed examples in authoring-context.md, and materialize.command with materialize.shell (powershell on Windows, posix elsewhere). Execute the command in that shell. Complete the pending facts, review business coverage, then set ready=true. Author ordered page blocks as {name,purpose}; omitted contentPriority and contentRichness.contentLayers derive from these blocks, preserving explicit overrides. Author project-specific acceptanceCriteria; materialize merges them with resource-based checks. A string visualSelection.colorStrategy is preserved as usage text with primaryColor pending; invalid types fail before files are written. Init guidance is preliminary; materialize still validates the completed plan.'],
        args: [
          { name: 'requirementBrief', type: 'file', required: true, source: 'positional', position: 0, builder_options: ['--requirement-brief'] },
          { name: 'themeId', type: 'string', required: false, source: 'option', builder_options: ['--theme-id'] },
          { name: 'outputDir', type: 'string', required: false, source: 'option', builder_options: ['--output-dir'] },
          { name: 'json', type: 'boolean', required: false, source: 'option', builder_options: ['--json'] },
        ],
      }),
      command('design-plan.preview', ['design-plan', 'preview'], 'design-plan preview <build-plan.json> --part-file <module.json> [--json]', 'help.cmd_design_plan_preview', {
        requiresLogin: false, output: 'json',
        args: [
          { name: 'buildPlan', type: 'file', required: true, source: 'positional', position: 0, builder_options: ['--build-plan'] },
          { name: 'partFile', type: 'file', required: true, source: 'option', builder_options: ['--part-file'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Updates completed fact modules in preview/ drafts. Modules share a source base; one writer updates changed sections and preserves custom CSS. Final materialize validates the complete plan and writes PRD, design, HTML and theme together.'],
      }),
      command('design-plan.materialize', ['design-plan', 'materialize'], 'design-plan materialize <build-plan.json> [--from-preview | --business-file <json> --visual-file <json>] [--output-dir <dir>] [--check] [--json]', 'help.cmd_design_plan_materialize', {
        notes: ['Validates image slots before writing artifacts. JSON assetTasks lists taskKey/taskState, independent searches ordered by required/hero/design order, collection-wide concurrency, host-enforced time budgets, two-round limits, resume policy, output paths and resolve argv. After matching plan confirmation, executionContract requires checking background Agent and Bash separately, dispatching only verified nonblocking tools or doing authorized business work before synchronous asset batches; record real job IDs and continue app/form/page work; replace <appType> with the real ID for upload. Materialized PRD execution pages include navigationPolicy derived from app/page navigation: platform-shell is content-only; standalone without a planned menu renders no application menu. This command performs no search or upload. Local asset inputs resolve against the command cwd; absolute paths survive page-task directory changes.'],
        requiresLogin: false,
        output: 'text|json',
        args: [
          { name: 'buildPlan', type: 'file', required: true, source: 'positional', position: 0, builder_options: ['--build-plan'] },
          { name: 'fromPreview', type: 'boolean', required: false, source: 'option', builder_options: ['--from-preview'] },
          { name: 'businessFile', type: 'file', required: false, source: 'option', builder_options: ['--business-file'] },
          { name: 'visualFile', type: 'file', required: false, source: 'option', builder_options: ['--visual-file'] },
          { name: 'outputDir', type: 'string', required: false, source: 'option', builder_options: ['--output-dir'] },
          { name: 'check', type: 'boolean', required: false, source: 'option', builder_options: ['--check'] },
          { name: 'json', type: 'boolean', required: false, source: 'option', builder_options: ['--json'] },
        ],
      }),
      command('design-plan.patch', ['design-plan', 'patch'], 'design-plan patch <build-plan.json> --set <path=value> [--set <path=value> ...] [--materialize] [--output-dir <dir>] [--json]', 'help.cmd_design_plan_patch', {
        notes: ['Unpresented draft edits keep revision 1 (or the current draft revision). Persist meta.planState.presentedRevision after successful presentation; substantive edits then advance once and clear approval. Legacy plans without planState advance conservatively. Asset materialStatus/missingAssets updates preserve approval. Use --materialize to refresh documents.'],
        requiresLogin: false,
        output: 'text|json',
        args: [
          { name: 'buildPlan', type: 'file', required: true, source: 'positional', position: 0, builder_options: ['--build-plan'] },
          { name: 'set', type: 'string', required: true, source: 'option', builder_options: ['--set'], repeatable: true, description: 'Field assignment path=value; repeat --set for multiple changes.' },
          { name: 'materialize', type: 'boolean', source: 'option', builder_options: ['--materialize'] },
          { name: 'outputDir', type: 'string', source: 'option', builder_options: ['--output-dir'] },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
      }),
      command('update-app', ['update-app'], 'update-app <appType> [--name "..."] [--desc "..."] [--icon <name>] [--icon-color <color>] [--colour <key>] [--theme-color <color>] [--theme-file <css>] [--nav-theme light|dark|white|gray] [--logo-source appIcon|customImage] [--layout side|top|l_shape] [--hide-app-nav|--show-app-nav]', 'help.cmd_update_app', {
        args: [
          { name: 'appType', type: 'string', required: true, source: 'positional', position: 0 },
          { name: 'name', type: 'string', source: 'option', builder_options: ['--name', '-n'] },
          { name: 'desc', type: 'string', source: 'option', builder_options: ['--desc', '-d'] },
          { name: 'icon', type: 'string', source: 'option', builder_options: ['--icon'] },
          { name: 'iconColor', type: 'string', source: 'option', builder_options: ['--icon-color'] },
          { name: 'colour', type: 'string', source: 'option', builder_options: ['--colour', '--theme'], description: 'Platform theme key or custom; CSS colors belong in themeColor.' },
          { name: 'themeColor', type: 'string', source: 'option', builder_options: ['--theme-color', '--themeColor'], description: 'App primary color; themeFile supplies the effective color when both are provided.' },
          { name: 'themeFile', type: 'file', source: 'option', builder_options: ['--theme-file', '--custom-theme-file'], description: 'Application theme CSS; declares --color-brand1-6 and sets colour=custom.' },
          { name: 'navTheme', type: 'string', source: 'option', builder_options: ['--nav-theme', '--navTheme'], description: 'light, dark, white or gray.' },
          { name: 'logoSource', type: 'string', source: 'option', builder_options: ['--logo-source', '--logoSource'], description: 'appIcon or customImage; customImage requires an existing homepageLogo.' },
          { name: 'layoutDirection', type: 'string', source: 'option', builder_options: ['--layout', '--layout-direction', '--layoutDirection'], description: 'side, top or l_shape.' },
          { name: 'hideAppNav', type: 'boolean', source: 'option', builder_options: ['--hide-app-nav'] },
          { name: 'showAppNav', type: 'boolean', source: 'option', builder_options: ['--show-app-nav'] },
        ],
        notes: [
          'Upload application CSS with --theme-file; the primary color is read from CSS and saved with the theme resource.',
          'Platform preset keys are used independently of --theme-file and --theme-color. Choose --hide-app-nav or --show-app-nav to set navigation visibility.',
        ],
      }),
      command('app-online', ['app-online'], 'app-online <appType> [--to-ding-app-center] [--show-app-center]', 'help.cmd_app_online'),
      command('app-offline', ['app-offline'], 'app-offline <appType> [--to-ding-app-center] [--show-app-center]', 'help.cmd_app_offline'),
      command('nav-group', ['nav-group'], 'nav-group <list|create|rename|delete|move|order|auto-order|hide|show> <appType> ...', 'help.cmd_nav_group', {
        output: 'json',
        aliases: ['group'],
        examples: [
          'openyida nav-group list APP_XXX --flat',
          'openyida nav-group move APP_XXX FORM_XXX --to NAV_XXX',
        ],
      }),
      command('app-permission', ['app-permission'], 'app-permission <get|set|add|remove|search-user> ...', 'help.cmd_app_permission', {
        output: 'json',
      }),
      command('i18n', ['i18n'], 'i18n <overview|config|languages|list|upsert|delete|translate|translate-all|upgrade> <appType> ...', 'help.cmd_i18n', {
        output: 'json',
      }),
      command('export', ['export'], 'export <appType> [output]', 'help.cmd_export'),
      command('import', ['import'], 'import <file> [name]', 'help.cmd_import'),
    ],
  },
  {
    id: 'form',
    titleKey: 'help.group_form',
    commands: [
      command('create-form.batch', ['create-form', 'batch'], 'create-form batch <appType> <plan.json> [--concurrency 1..4] [--check] [--json]', 'help.cmd_create_form_batch', {
        output: 'json',
        args: [
          { name: 'appType', type: 'string', required: true, source: 'positional', position: 0, builder_options: ['--app-type'] },
          { name: 'plan', type: 'file', required: true, source: 'positional', position: 1, builder_options: ['--plan'] },
          { name: 'concurrency', type: 'integer', default: 3, source: 'option', builder_options: ['--concurrency'], description: 'Maximum concurrent forms, 1 through 4; default 3.' },
          { name: 'check', type: 'boolean', source: 'option', builder_options: ['--check'], description: 'Validate definitions and dependency groups locally.' },
          { name: 'json', type: 'boolean', source: 'option', builder_options: ['--json'] },
        ],
        notes: ['Creates independent normal forms concurrently after dependency validation. References resolve from successful schema readbacks. Existing formUuid entries are read-only reuse. Saves IDs and status beside the plan; recoveryAction and nextAction are enum values: rerun_unchanged_plan reuses successful results and resumes known form IDs; inspect_unknown_write_then_reconcile requires checking uncertain writes before rerunning. Results expose appUrl and formUrl; url remains the compatible form entry. Navigation ordering and shared app configuration follow the batch.'],
      }),
      command('create-form.create', ['create-form', 'create'], 'create-form create <appType> "<formTitle>" <fieldsJsonFile> [--icon auto|<iconName>] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]', 'help.cmd_create_form', {
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
            name: 'icon',
            type: 'string',
            required: false,
            source: 'option',
            builder_options: ['--icon'],
            default: 'auto',
            value_catalog_command_id: 'create-form.icons',
            description: 'Form navigation icon name. Use auto for semantic selection or run create-form.icons for supported values.',
          },
        ],
        canonical: {
          command_id: 'create-form.create',
          path: ['create-form', 'create'],
          argv_template: ['create-form', 'create', '<appType>', '<formTitle>', '<fieldsJsonFile>'],
          display: 'openyida create-form create <appType> "<formTitle>" <fieldsJsonFile>',
          builder: 'openyida commands build create-form.create --app-type <appType> --form-title "<formTitle>" --fields-json-file <fieldsJsonFile> [--icon <iconName>] --json',
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
          'openyida create-form create APP_XXX "访客登记" .cache/openyida/visitor/fields.json --icon name-card',
          'openyida commands build create-form.create --app-type APP_XXX --form-title "访客登记" --fields-json-file .cache/openyida/visitor/fields.json --json',
        ],
      }),
      command('create-form.icons', ['create-form', 'icons'], 'create-form icons [--json]', 'help.cmd_list_form_icons', {
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
      }),
      command('create-form.validate-fields', ['create-form', 'validate-fields'], 'create-form validate-fields <fieldsJsonOrFile> [--json]', 'help.cmd_validate_form', {
        requiresLogin: false,
      }),
      command('create-form.update', ['create-form', 'update'], 'create-form update <appType> <formUuid> (<changesJsonOrFile> | --data-file <changesJsonOrFile>) [--locale zh_CN|en_US|ja_JP] [--open|--no-open]', 'help.cmd_update_form'),
      command('create-form.resume', ['create-form', 'resume'], 'create-form resume <appType> <formUuid> <fieldsJsonOrFile> [--json]', 'help.cmd_update_form', {
        notes: ['On save-schema HTTP 5xx, read back the latest schema. Accept already-applied fields or retry missing compatible fields once with the latest revision; conflicts and other failures stop. Success includes appUrl, formUrl and the compatible url field.'],
      }),
      command('create-form.patch', ['create-form', 'patch'], 'create-form patch <appType> <formUuid> <patchJsonOrFile> [--open|--no-open]', 'help.cmd_update_form'),
      command('create-form.rule', ['create-form', 'rule'], 'create-form rule <appType> <formUuid> <rulesJsonOrFile> [--open|--no-open]', 'help.cmd_update_form'),
      command('create-form.validation', ['create-form', 'validation'], 'create-form validation <appType> <formUuid> <validationsJsonOrFile> [--open|--no-open]', 'help.cmd_update_form'),
      command('add-validation', ['add-validation'], 'add-validation <appType> <formUuid> --field <labelOrId> --type <phone|regex|idCard|email|...> [--message <text>]', 'help.cmd_update_form'),
      command('create-form.bind-datasource', ['create-form', 'bind-datasource'], 'create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile> [--open|--no-open]', 'help.cmd_update_form'),
      command('create-form.add-option', ['create-form', 'add-option'], 'create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...', 'help.cmd_update_form'),
      command('list-forms', ['list-forms'], 'list-forms <appType> [--keyword <text>]', 'help.cmd_list_forms', {
        examples: ['openyida list-forms APP_XXX --keyword 客户'],
      }),
      command('aggregate-table', ['aggregate-table'], 'aggregate-table <list|create-empty|inspect|preview|save|publish|status> <appType> ...', 'help.cmd_aggregate_table', {
        output: 'json',
      }),
      command('get-schema', ['get-schema'], 'get-schema <appType> <formUuid|--all> [--summary-json|--field-map-json|--analysis-json]', 'help.cmd_get_schema', {
        examples: ['openyida get-schema APP_XXX FORM_XXX --field-map-json'],
      }),
      command('check-prd-completeness', ['check-prd-completeness'], 'check-prd-completeness <prd.md> --app-type <appType> [--build-manifest <file>] [--json]', 'help.cmd_check_prd_completeness', {
        output: 'json',
        notes: ['Checks resource counts and optional build-manifest.assetExecution recorded intervals. Include materialize.assetTasks and taskState records plus businessWork startedAt/endedAt; missing dispatch proof, missing overlap or assets before business in synchronous fallback produces needs_review. This is record consistency, not independent verification of host events.'],
      }),
      command('er', ['er'], 'er <appType> [--format mermaid|json] [--output file] [--include-system] [--include-pages]', 'help.cmd_er', {
        output: 'text|json',
      }),
      command('create-page', ['create-page'], 'create-page <appType> "<name>" [--mode dashboard] [--hide-nav] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]', 'help.cmd_create_page'),
      command('build-page', ['build-page'], 'build-page <sourceFile> [--output file|--write]', 'help.cmd_build_page', { requiresLogin: false }),
      command('check-page', ['check-page'], 'check-page <src> [--compat]', 'help.cmd_check_page', { output: 'text|json' }),
      command('compile', ['compile'], 'compile <src> [--canvas] [--json]', 'help.cmd_compile', {
        requiresLogin: false,
        output: 'text|json',
        notes: ['Canvas compilation checks theme provider mounting, theme reads before the provider is active, module-level theme context declarations, fixed ConfigProvider brand colors, and known navigation destinations missing appType. Extract canvas-theme and canvas-navigation before coding. Dynamic colors, resource identity and runtime rendering still require verification.'],
      }),
      command('publish', ['publish'], 'publish <src> <appType> <formUuid> [--health-check] [--force] [--canvas] [--auto-nav-order] [--open|--no-open]', 'help.cmd_publish', {
        notes: ['Canvas publishing runs the same theme structure checks as compile before login or remote writes. --health-check verifies saved content; inspect the actual page for runtime behavior.'],
      }),
      command('update-form-config', ['update-form-config'], 'update-form-config <appType> <formUuid> <true|false|keep> "<title>" [--locale zh_CN|en_US|ja_JP]', 'help.cmd_update_form_config'),
      command('get-form-config', ['get-form-config'], 'get-form-config <appType> <formUuid> [--json]', 'help.cmd_get_form_config', { output: 'json' }),
    ],
  },
  {
    id: 'data',
    titleKey: 'help.group_data',
    commands: [
      command('data', ['data'], 'data <query|get|create|update> <resource> ... | delete form <appType> <formUuid> --inst-id <id> --expect-form-name <name> --expect-form-type receipt --confirm [--json]', 'help.cmd_data', {
        examples: [
          'openyida data create form APP_XXX FORM_XXX --expect-form-name 客户 --expect-form-type receipt --data-json \'{"textField_name":"客户 A","dateField_followUp":1787932800000}\'',
          'openyida data delete form APP_XXX FORM_XXX --inst-id FINST_XXX --expect-form-name 客户 --expect-form-type receipt --confirm --json',
        ],
      }),
      command('task-center', ['task-center'], 'task-center <type> [options]', 'help.cmd_task_center'),
      command('basic-info', ['basic-info'], 'basic-info <overview|commodity|grant|capacity|quota|abs-path|dataflow|i18n|domain>', 'help.cmd_basic_info', {
        output: 'json',
      }),
      command('read-dingtalk-doc', ['read-dingtalk-doc'], 'read-dingtalk-doc <docUrl> [--output <file>] [--json]', 'help.cmd_read_dingtalk_doc', {
        output: 'text|json',
      }),
      command('read-dingtalk-tingji', ['read-dingtalk-tingji'], 'read-dingtalk-tingji <taskUuid> [--json]', 'help.cmd_read_dingtalk_tingji', {
        output: 'json',
      }),
      command('get-permission', ['get-permission'], 'get-permission <appType> <formUuid> [--package-uuid <packageUuid>] [--json]', 'help.cmd_get_permission'),
      command('save-permission', ['save-permission'], 'save-permission <appType> <formUuid> --package-uuid <packageUuid> [--data-permission <json>|--action-permission <json>|--field-permission <json>]', 'help.cmd_save_permission', {
        examples: [
          'openyida get-permission APP_XXX FORM_XXX --json',
          'openyida save-permission APP_XXX FORM_XXX --package-uuid PACKAGE_XXX --data-permission \'{"dataRange":"ORIGINATOR"}\'',
        ],
      }),
      command('corp-manager', ['corp-manager'], 'corp-manager <search-user|list|add|remove|address-book> ...', 'help.cmd_corp_manager', { output: 'json' }),
      command('agent-center', ['agent-center'], 'agent-center <list|create|update|cancel|range|search-user> ...', 'help.cmd_agent_center', { output: 'json' }),
    ],
  },
  {
    id: 'process',
    titleKey: 'help.group_process',
    commands: [
      command('configure-process', ['configure-process'], 'configure-process <appType> <formUuid> <definition> [processCode] [--replace]', 'help.cmd_configure_process', {
        examples: ['openyida configure-process APP_XXX FORM_XXX .cache/openyida/process/process-with-actions.json'],
      }),
      command('create-process', ['create-process'], 'create-process <appType> ... [--replace]', 'help.cmd_create_process', {
        examples: [
          'openyida create-process APP_XXX "Approval Form" .cache/openyida/process/fields.json .cache/openyida/process/process-with-actions.json',
          'openyida create-process APP_XXX --formUuid FORM_XXX .cache/openyida/process/process-with-actions.json',
        ],
      }),
      command('ai-form-setting', ['ai-form-setting'], 'ai-form-setting <get|fields|models|enable|disable|save> <appType> ...', 'help.cmd_ai_form_setting', {
        output: 'json',
        aliases: ['ai-approve', 'aiFormSetting'],
      }),
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
      command('externalize-form', ['externalize-form'], 'externalize-form <appType> <formUuid> [--schema-file file]', 'help.cmd_externalize_form', {
        output: 'json|markdown',
      }),
    ],
  },
  {
    id: 'report',
    titleKey: 'help.group_report',
    commands: [
      command('create-report', ['create-report'], 'create-report <appType> "<name>" ... [--json] [--open|--no-open]', 'help.cmd_create_report'),
      command('append-chart', ['append-chart'], 'append-chart <appType> <reportId> ... [--json] [--open|--no-open]', 'help.cmd_append_chart'),
      command('report.inspect', ['report', 'inspect'], 'report inspect <appType> <reportId> --json', 'help.cmd_report_inspect', { output: 'json' }),
    ],
  },
  {
    id: 'connector',
    titleKey: 'help.group_connector',
    commands: [
      command('connector.list', ['connector', 'list'], 'connector list', 'help.cmd_connector_list'),
      command('connector.create', ['connector', 'create'], 'connector create "name" "domain" ...', 'help.cmd_connector_create'),
      command('connector.detail', ['connector', 'detail'], 'connector detail <id>', 'help.cmd_connector_detail'),
      command('connector.delete', ['connector', 'delete'], 'connector delete <id> [--force]', 'help.cmd_connector_delete'),
      command('connector.add-action', ['connector', 'add-action'], 'connector add-action --operations <file> --connector-id <id>', 'help.cmd_connector_add_action'),
      command('connector.update-action', ['connector', 'update-action'], 'connector update-action --connector-id <id> --action <operationId> --query-json JSON --confirm', 'help.cmd_connector_update_action'),
      command('connector.list-actions', ['connector', 'list-actions'], 'connector list-actions <id>', 'help.cmd_connector_list_actions'),
      command('connector.delete-action', ['connector', 'delete-action'], 'connector delete-action <id> <operation-id>', 'help.cmd_connector_delete_action'),
      command('connector.test', ['connector', 'test'], 'connector test --connector-id <id> --action <actionId> [--path-json JSON] [--query-json JSON] [--header-json JSON] [--body-json JSON] [--account-id <id>] [--system-token-app <appType>] [--ignore-defaults]', 'help.cmd_connector_test'),
      command('connector.list-connections', ['connector', 'list-connections'], 'connector list-connections <id>', 'help.cmd_connector_list_connections'),
      command('connector.create-connection', ['connector', 'create-connection'], 'connector create-connection <id> <name> [--interactive]', 'help.cmd_connector_create_connection'),
      command('connector.smart-create', ['connector', 'smart-create'], 'connector smart-create --curl "..."', 'help.cmd_connector_smart'),
      command('connector.parse-api', ['connector', 'parse-api'], 'connector parse-api [options]', 'help.cmd_connector_parse_api'),
      command('connector.gen-template', ['connector', 'gen-template'], 'connector gen-template [output]', 'help.cmd_connector_gen_template'),
    ],
  },
  {
    id: 'integration',
    titleKey: 'help.group_integration',
    commands: [
      command('integration.create', ['integration', 'create'], 'integration create <appType> ... [--spec file.json] [--connector-system-token-app <appType>]', 'help.cmd_integration'),
      command('integration.update', ['integration', 'update'], 'integration update <appType> <formUuid> <processCode> --spec <desired-spec.json> [--publish]', 'help.cmd_integration_update', {
        requiresLogin: false,
        output: 'json',
      }),
      command('integration.list', ['integration', 'list'], 'integration list <appType> [--flow-types 1,2,3,5,6] [--form-uuid <uuid>] [--status y|n] [--json]', 'help.cmd_integration_list', {
        output: 'json',
      }),
      command('integration.enable', ['integration', 'enable'], 'integration enable <appType> <formUuid> <processCode>', 'help.cmd_integration_enable', {
        output: 'json',
      }),
      command('integration.disable', ['integration', 'disable'], 'integration disable <appType> <formUuid> <processCode>', 'help.cmd_integration_disable', {
        output: 'json',
      }),
      command('integration.check', ['integration', 'check'], 'integration check <appType...>', 'help.cmd_integration_check'),
      command('integration.diagnose', ['integration', 'diagnose'], 'integration diagnose (--text <text>|--file <path>|--rules) [--json]', 'help.cmd_integration_diagnose', {
        requiresLogin: false,
        output: 'text|json',
      }),
      command('dws', ['dws'], 'dws <command> [args]', 'help.cmd_dws'),
      command('dws.contact-user-search', ['dws', 'contact', 'user', 'search'], 'dws contact user search --keyword <text>', 'help.cmd_dws'),
      command('dingtalk-link', ['dingtalk-link'], 'dingtalk-link <url> [--target fullScreen] [--legacy-scheme] [--json]', 'help.cmd_dingtalk_link', {
        requiresLogin: false,
        output: 'text|json',
      }),
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
      command('agent-capabilities', ['agent-capabilities'], 'agent-capabilities [--json] [--summary-json|--compact]', 'help.cmd_agent_capabilities', {
        requiresLogin: false,
        output: 'json',
      }),
      command('agent', ['agent'], 'agent <doctor|diagnose|status|connect|run|disconnect|logout> [options]', 'help.cmd_agent', {
        requiresLogin: false,
        output: 'json',
        examples: ['openyida agent diagnose --json', 'openyida agent diagnose --session "<Yida session URL>" --json', 'openyida agent run --help'],
      }),
      command('mcp', ['mcp'], 'mcp', 'help.cmd_commands', {
        requiresLogin: false,
        output: 'json',
        hidden: true,
      }),
      command('a2a', ['a2a'], 'a2a <serve|agent-card> [options]', 'help.cmd_a2a', {
        requiresLogin: false,
        output: 'text|json',
      }),
      command('bridge', ['bridge'], 'bridge start [--token <pair-token>] [--port 6736] [--origin https://demo.aliwork.com] [--open|--no-open]', 'help.cmd_bridge', {
        requiresLogin: false,
        output: 'text|json',
      }),
      command('copy', ['copy'], 'copy [--force]', 'help.cmd_copy', { requiresLogin: false }),
      command('sample', ['sample'], 'sample [--list] [<skill> <name>] [--output <file>] [--var KEY=VALUE ...] [--design-file <design.md>]', 'help.cmd_sample', {
        requiresLogin: false,
        notes: [
          'Canvas form-drawer, table-form and trend-combo samples include the maintained CanvasThemeProvider and read the current application CSS variables.',
          'openyida-page-template canvas-theme outputs the same provider as a reusable fragment; combine its imports and code with the business page in one Canvas file.',
          'canvas-admin-entry includes canvas-navigation and a theme-aware business-workbench button. Visibility uses the current app-scoped loginUser.isAppAdmin flag (y/true only), matching g_config/pageConfig app identity with conflicts kept unknown, never CLI identities or a copied admin list. Configure a verified business page ID; unknown identity stays hidden and backend authorization remains authoritative.',
          'canvas-view-state restores the current local task view, allowlisted non-sensitive enum filters and page through URL state, preserving unrelated query/hash/history metadata. Use only without an existing router or unsaved-edit blockers; drafts, per-task caches and scroll need explicit policies. Verify iframe refresh/return behavior in the host. Business writes require verified server-side role, record, field and state-transition authorization; hidden buttons do not grant or enforce it.',
          'Extract canvas-theme before antd UI and canvas-navigation before cross-page actions; use verified target types and resource IDs. Local tabs use state. Compile/publish reject known app-prefix omissions and fixed ConfigProvider brand colors; runtime theme and destination verification is still required.',
        ],
        args: [
          { name: 'skill', type: 'string', source: 'positional', position: 0, description: 'Required when copying a sample.' },
          { name: 'name', type: 'string', source: 'positional', position: 1, description: 'Required when copying a sample; use --list for available names.' },
          { name: 'list', type: 'boolean', source: 'option', builder_options: ['--list'] },
          { name: 'output', type: 'file', source: 'option', builder_options: ['--output'] },
          { name: 'var', type: 'string', source: 'option', builder_options: ['--var'], repeatable: true, description: 'Template assignment KEY=VALUE; repeat --var for multiple variables.' },
          { name: 'designFile', type: 'file', source: 'option', builder_options: ['--design-file'], description: 'Design tokens for yida-design app-theme; preserves custom CSS when updating.' },
        ],
      }),
      command('doctor', ['doctor'], 'doctor [--fix]', 'help.cmd_doctor', { requiresLogin: false }),
      command('db-seq-fix', ['db-seq-fix'], 'db-seq-fix [--fix]', 'help.cmd_db_seq_fix'),
      command('formula.evaluate', ['formula', 'evaluate'], 'formula evaluate <formula|file> [--schema file]', 'help.cmd_formula_evaluate', {
        requiresLogin: false,
        output: 'text|json',
      }),
      command('update', ['update'], 'update', 'help.cmd_update', { requiresLogin: false }),
      command('export-conversation', ['export-conversation'], 'export-conversation [options]', 'help.cmd_export_conversation', {
        requiresLogin: false,
      }),
      command('feedback', ['feedback'], 'feedback <setup|url|dismiss|status> [options]', 'help.cmd_feedback', {
        requiresLogin: false,
        output: 'text|json',
      }),
      command('batch', ['batch'], 'batch <file>|--commands "cmd1 ; cmd2" [--stop-on-error] [--json]', 'help.cmd_batch', {
        output: 'text|json',
      }),
      command('flash-to-prd', ['flash-to-prd'], 'flash-to-prd --file <path> --name "<project>"', 'help.cmd_flash_to_prd', {
        requiresLogin: false,
      }),
      command('ai', ['ai'], 'ai <text|image> [options]', 'help.cmd_ai', {
        output: 'text|json',
      }),
      command('asset', ['asset'], 'asset <status|resolve|sources> [options]', 'help.cmd_asset', {
        notes: ['resolve --page-id <pageId> selects a page from --design or input assetStrategy; output contains only that page. Use distinct --manifest paths for concurrent page jobs. Host search follows collection_policy; resolve performs one attempt per supplied candidate. Verified hotlink-allowed URLs are delivered directly without login or appType. Draft assets accept hotlinkAllowed/rehostAllowed booleans and deliveryMode=auto|upload. Stock CDN URLs allow hotlinking by default; Unsplash requires hotlinking unless separate rehosting permission is recorded. --upload-assets requests permitted hosting; upload failure keeps only a verified hotlink-allowed original URL.'],
        args: [
          { name: 'pageId', type: 'string', source: 'option', builder_options: ['--page-id'], description: 'Resolve only this page; requires design or input assetStrategy.' },
          { name: 'appType', type: 'string', source: 'option', builder_options: ['--app-type'], description: 'Target application for uploads; direct URLs need no application.' },
          { name: 'uploadAssets', type: 'boolean', source: 'option', builder_options: ['--upload-assets'], description: 'Request hosting where rehosting is allowed; otherwise use verified direct URLs by default.' },
        ],
        requiresLogin: false,
        output: 'text|json',
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
    args: cloneJsonMetadata(entry.args, []),
    canonical: cloneJsonMetadata(entry.canonical, null),
    deprecated_patterns: cloneJsonMetadata(entry.deprecatedPatterns, []),
    repair_patterns: cloneJsonMetadata(entry.repairPatterns, []),
    examples: entry.examples,
    notes: cloneJsonMetadata(entry.notes, []),
    hidden: entry.hidden,
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
        form_page_policy: 'Use yida-create-form-page for form structure. Use create-form.batch to create independent normal forms concurrently, resolve dependencies from real IDs and read back fields; apply shared app configuration and navigation order afterward. Never inject CSS, JavaScript, HTML, or theme code into native forms or formDetail pages; the platform renders those pages.',
        page_skill_policy: 'Use YidaCodeCanvas by default for new primary custom pages. Choose yida-custom-page only when the current target has been identified as existing .oyd.jsx/.oyb.jsx/renderJsx/platform Jsx component maintenance; do not switch to yida-custom-page merely because a page needs data, forms, uploads, this.utils.yida.*, or dataSourceMap-like capabilities.',
        plan_command_ids: ['design-plan.catalog', 'design-plan.init', 'design-plan.preview', 'design-plan.materialize', 'design-plan.patch'],
        theme_command_ids: ['sample', 'create-app', 'update-app'],
        navigation_command_ids: { platform: ['update-app', 'nav-group'], custom: ['update-app', 'update-form-config', 'get-form-config'] },
        navigation_policy: 'Before PRD planning in Fast and Plan, the agent determines navigation ownership and layout from business context. Follow yida-design/references/navigation-decision.md for entry and layout decisions. Preserve explicit user requirements and existing navigation for local changes; resource-only requests operate on their specified resources and settings. Use native navigation by default for the application workspace, and custom navigation only for an explicitly justified application-level branded menu or special navigation interaction. A service frontend defaults to one coding page with its own menu and all selected business views; a single-step entry can use navigation.type=none. Choose backend native or coding pages by task efficiency. Backend coding pages in platform-shell are content-only: platform menus own cross-module navigation; local Tabs cover categories or states of the current task only. Never turn the management entry menu into a second page navbar, sidebar or module Tabs. Persistent filters/state alone do not justify custom application navigation. Plan handoff pages include derived navigationPolicy; Fast records the same boundary. Do not hide platform navigation to repair duplicate page menus. Store application navigation in navigationType and standalone entry menus in pageSpecHandoff.navigation. Configure a custom frontend menu at page scope and preserve workspace navigation. Record type/source/reason/variant using ai_default for agent ownership decisions and user_selected for explicit user requirements. Include navigation in the overall Plan confirmation; Fast implements the recorded decision. Platform navigation uses update-app --layout top|side|l_shape --show-app-nav, persisting layoutDirection and hideAppNav=n. Preserve stored navType. Without --layout, normalize legacy layoutDirection and navType using the application layout compatibility rules (hoz plus top_side means l_shape; missing layout uses top_fold/top_side for top/l_shape). Apply shell top_fold/none overrides at page scope. Application-wide custom side/top/mixed/dock uses app hiding plus per-page hiding within scope; a standalone frontend in a platform-navigation app uses only page configuration. Read back layoutDirection, hideAppNav and each configured page, then verify the planned frontend and workspace links. Navigation tone is separate from layout. Custom top navigation defaults to edge-to-edge, not floating. Over a hero image, start transparent, add a surface on scroll, restore transparency at the top; expanded menus stay readable. Follow yida-design/references/page-continuity.md; floating requires an explicit design.',
        design_mode_policy: 'Analyze requirements first with yida-requirement-analysis: read only necessary sources before the first question, offer concrete core-function candidates, clarify key usage, and preserve explicit scope and valid answers. Initial intake focuses on core functions and actual usage. Record actual user replies; proceed with dependent planning after a reply or explicit delegation. First-time builds include new apps and existing apps without business pages. After intake, reuse explicit mode choices and detailed supplied plans; if the user delegates the mode or asks for no more questions, use Fast unless Plan is explicit; otherwise, if the mode is unspecified, ask whether to prepare a PRD for confirmation (Plan, more detailed and slower) or build from the supplied requirements (Fast). Without detailed requirements, offer Fast and Plan neutrally. intake.confirmed records scope and key-usage clarification; the plan revision tracks plan approval separately. Planning preparation derives page scenes, theme mapping and navigation before design-plan init; mark AI suggestions and apply navigation_policy. Existing business apps only clarify the current change. A named resource-only request with explicitScope.allowInferredResources=false keeps planning within the specified resources. When theme mapping is missing, query design-plan catalog once and reuse its themes and pagePatterns. Init returns authoring.pendingFields and context with typed examples; complete pending facts and review coverage before setting ready=true. Reuse one complete agent-capabilities summary per unchanged environment. Standard Plan uses design-plan init parallelTasks, then executes the returned materialize.command exactly once with business-file and visual-file; preview and --from-preview are only for explicitly incremental large plans. Present the current plan without revision numbers in user-visible titles, summaries, attachments or questions. Keep revision in internal confirmation fields, validate it before building, and execute its generated artifacts.',
        product_design_policy: 'yida-requirement-analysis owns shared facts and first-time intake. yida-prd owns business planning; yida-design owns visual design. Reuse the same confirmed brief and supplied details. Prepare business and base visuals concurrently, then bind visuals to settled page tasks. yida-app merges and checks the artifacts before creating resources. Plan authors scope, data and rules, page organization, business interactions and acceptance once. Ordered blocks {name,purpose} supply default priority and content layers; explicit designs remain authoritative. Project-specific acceptance criteria are merged with generated resource checks. Plan uses the compact authoring contract and selected theme context; the CLI reads full templates and renders all artifacts. Theme templates use only basic-tokens.json variables with fixed typography, spacing and Tooltip colors; component recipes consume those variables. Explicit project customization stays in visualStyle.tokens. CSS binds light and dark platform navigation to their respective brand colors and preserves white and gray modes.',
        ui_guidance_policy: 'Page implementation consumes yida-prd prd.md for positioning, information architecture, page prototype, native form entry policy, material strategy, business-specific checks, resource creation order, page implementation delivery order, navigation order, and acceptance criteria; it consumes yida-design design.md for app custom theme CSS delivery, themeColor/navTheme, visual states, visualScaffold, surface material, rounded rules, density rules, components, state styling, and page-level imageNeed. When a page is imageNeed=required, or beneficial with declared image slots, yida-image-assets prepares a traceable asset manifest alongside page layout and interaction work; wait for final images only at that page\'s image binding and acceptance. imageNeed=none skips the branch. prd.md and design.md remain the only design sources of truth. Page implementation may extract page-spec.json as a derived implementation handoff from prd.md + design.md; conflicts are resolved by sending business conflicts to yida-prd and visual conflicts to yida-design before regenerating the spec. Core normal forms default to 1-3 business sample records before page implementation, followed by query readback. An explicit opt-out, configuration dictionary, sensitive data, or lack of safely constructible values requires a recorded skip reason. Screenshots, public sharing, data-source deep binding, and fine navigation grouping are optional after explicit user request or PRD acceptance criteria.',
        default_nav_order_policy: 'For application-wide custom navigation, implement each entry menu and verify app/page navigation hiding. A standalone frontend preserves platform navigation for the management workspace; frontend-only delivery skips platform ordering. After all scoped resources and page publications finish, perform exactly one navigation order operation. Use management tasks and their default destination, without creating a homepage or putting a frontend page first. When execution.entryRecommendation exists, derive navigationOrder from its management/workspace menus. Call openyida nav-group order <appType> <items...> for an explicit order; otherwise call openyida nav-group auto-order <appType> once for legacy single-workspace plans. Do not use openyida publish ... --auto-nav-order for per-page application builds. Explicit and automatic ordering are mutually exclusive; never generate per-item move loops.',
        final_link_policy: 'Return exactly one user-visible application entry group, never one artifact or link card per form, process, report, schema, manifest, PRD, design file, or intermediate artifact. Include one verified management entry when a management or unified workspace is in scope: the app workbench URL or a planned workbench/formUuid URL with its real viewUuid. Native management does not require a display homepage; frontend-only delivery includes its verified frontend entry and developer admin URL, without inventing a business backend. Add the clean custom page URL only when PRD entryMode=standalone and get-form-config readback confirms isRenderNav=false. Complete application delivery defaults to 2-3 distinct entries: frontend or unified workspace, business backend when separately planned, and developer admin. agent-capabilities application_entry_policy.entries.admin=include is independent of auth runtime. Read adminUrl from create-app or app-list results; route construction does not verify recipient permissions. Explicit user exclusions take precedence; single-page tasks retain their scope. Put the business summary, verification results and remaining work in the terminal delivery artifact description; when no delivery tool is available, return the same content and entry group in the final response. Summarize business resources by capability or count, but every resource count, seed-record count, and completed/verified claim must come from that resource\'s own successful result or readback. When the user or caller explicitly requests a resource manifest, resource UUIDs/IDs, publish status, or test-data summary, include one concise verified delivery manifest in that description (or the final response when no delivery tool is available).',
        entry_navigation_contract: {
          reference: 'yida-skills/skills/yida-app/references/entry-navigation.md',
          brief_path: 'entryRecommendation',
          plan_path: 'execution.entryRecommendation',
          input_transport: 'JSON file or design-plan patch --set execution.entryRecommendation=<json>; not a CLI flag',
          modes: ['unified', 'service-management', 'frontend-only'],
          roles: ['service', 'management', 'workspace'],
          entry_required_fields: ['key', 'name', 'role', 'menu', 'defaultMenuKey'],
          service_page_binding: 'sceneKey of a standalone page',
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
            permission_policy: 'Current viewer, exact resource/operation/view and allowed===true; errors never fall back to unrestricted menus. dataScope is enforced by platform permissions, not menu filtering.',
          },
        },
        application_entry_policy: {
          delivery_unit: 'single_application_entry_group',
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
        completion_contract: 'Clarify core functions and actual usage first, then resolve the required resource context and settle entry navigation before PRD planning. Fast generates prd.md and design.md in parallel; Plan uses design-plan init/preview/materialize/patch and confirms the current revision. Validate both artifacts, create or reuse app and core forms/processes, seed and query-check core normal-form samples or record an allowed skip reason, then implement the primary page in PRD resource order, publish it, apply PRD navigation order or lightweight fallback navigation order for platform navigation, or verify app and per-page hiding for application-wide custom navigation. For a standalone frontend in a platform-navigation app, verify that page independently and retain workspace navigation. Return one named application entry group. Include workbench when a management or unified workspace is in scope; frontend-only delivery includes its verified frontend entry and developer admin URL, without inventing a business backend. Always include developer adminUrl for complete application delivery unless explicitly excluded by the user, regardless of auth runtime; this is separate from the optional business backend. Use create-app or app-list URL fields and state any unavailable entry instead of silently omitting it. Put the verified business summary, results and remaining work in the delivery artifact description; use the final response when no delivery tool is available.',
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
  findCommandSuggestion,
  findForbiddenAliasSuggestion,
  flattenCommandManifest,
  listCommandPermissionIds,
  listCommandSideEffectIds,
};
