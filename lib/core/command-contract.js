'use strict';

const { buildCommandManifest } = require('./command-manifest');

const CREATE_FORM_CREATE_COMMAND_ID = 'create-form.create';

let manifestCache = null;

function cloneJson(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return JSON.parse(JSON.stringify(value));
}

function getContractManifest() {
  if (!manifestCache) {
    manifestCache = buildCommandManifest({
      t: key => key,
      version: null,
    });
  }
  return manifestCache;
}

function getCommandEntry(commandId) {
  return getContractManifest().commands.find(entry => entry.id === commandId) || null;
}

function getCreateFormCreateEntry() {
  const entry = getCommandEntry(CREATE_FORM_CREATE_COMMAND_ID);
  if (!entry) {
    throw new Error('Missing command manifest entry: ' + CREATE_FORM_CREATE_COMMAND_ID);
  }
  return entry;
}

function normalizeInvocationArgv(argv = [], options = {}) {
  const normalized = (Array.isArray(argv) ? argv : [])
    .map(value => String(value === undefined || value === null ? '' : value).trim())
    .filter(Boolean);

  while (normalized[0] === '--') {
    normalized.shift();
  }
  if (normalized[0] === 'openyida' || normalized[0] === 'yida') {
    normalized.shift();
  }
  if (options.assumeCreateFormRoot && normalized[0] !== 'create-form') {
    normalized.unshift('create-form');
  }
  return normalized;
}

function optionNameToken(name) {
  return String(name || '').replace(/_/g, '-');
}

function optionKey(name) {
  return optionNameToken(name).replace(/^--/, '').replace(/-/g, '_');
}

function findOptionValue(tokens, names) {
  const accepted = new Set((names || []).map(optionNameToken));
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const eqIndex = token.indexOf('=');
    if (eqIndex > 0) {
      const name = token.slice(0, eqIndex);
      if (accepted.has(name)) {
        return {
          found: true,
          name,
          value: token.slice(eqIndex + 1),
        };
      }
    }
    if (accepted.has(token)) {
      const next = tokens[index + 1];
      if (next !== undefined && !String(next).startsWith('--')) {
        return {
          found: true,
          name: token,
          value: next,
        };
      }
      return {
        found: true,
        name: token,
        value: true,
      };
    }
  }
  return {
    found: false,
    name: null,
    value: undefined,
  };
}

function parseOptionArgs(tokens = []) {
  const options = {};
  const optionNames = {};
  const positionals = [];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === '--') {
      positionals.push(...tokens.slice(index + 1));
      break;
    }
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex > 0) {
      const name = token.slice(0, eqIndex);
      const key = optionKey(name);
      options[key] = token.slice(eqIndex + 1);
      optionNames[key] = name;
      continue;
    }

    const key = optionKey(token);
    const next = tokens[index + 1];
    if (next !== undefined && !String(next).startsWith('--')) {
      options[key] = next;
      optionNames[key] = token;
      index++;
    } else {
      options[key] = true;
      optionNames[key] = token;
    }
  }

  return {
    options,
    optionNames,
    positionals,
  };
}

function looksLikeInlineJson(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  );
}

function quoteDisplayArg(value, force) {
  const text = String(value === undefined || value === null ? '' : value);
  if (!force && /^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/(["\\$`])/g, '\\$1')}"`;
}

function normalizeEntryArgs(entry) {
  return (entry.args || [])
    .filter(arg => arg.source !== 'option')
    .slice()
    .sort((left, right) => (left.position || 0) - (right.position || 0));
}

function normalizeEntryOptions(entry) {
  return (entry.args || []).filter(arg => arg.source === 'option');
}

function primaryBuilderOption(arg) {
  return (arg.builder_options || [])[0] || `--${optionNameToken(arg.name)}`;
}

function getCreateFormCreateCanonical(entry = getCreateFormCreateEntry()) {
  return cloneJson(entry.canonical, null);
}

function canonicalPath(entry) {
  const canonical = getCreateFormCreateCanonical(entry);
  return canonical && Array.isArray(canonical.path)
    ? canonical.path
    : entry.path;
}

function canonicalTemplate(entry) {
  const canonical = getCreateFormCreateCanonical(entry);
  return canonical && Array.isArray(canonical.argv_template)
    ? canonical.argv_template
    : entry.path;
}

function getArgPlaceholder(entry, arg) {
  const pathLength = canonicalPath(entry).length;
  const template = canonicalTemplate(entry);
  return template[pathLength + (arg.position || 0)] || `<${arg.name}>`;
}

function buildCreateFormCreateCommand(params = {}, entry = getCreateFormCreateEntry()) {
  const args = normalizeEntryArgs(entry);
  const optionArgv = [];
  const optionDisplay = [];
  normalizeEntryOptions(entry).forEach(arg => {
    const value = params[arg.name];
    if (value === undefined || value === null || value === false || value === '') {
      return;
    }
    const option = primaryBuilderOption(arg);
    optionArgv.push(option);
    optionDisplay.push(option);
    if (arg.type !== 'boolean') {
      optionArgv.push(String(value));
      optionDisplay.push(quoteDisplayArg(value, false));
    }
  });
  const argv = [
    ...canonicalPath(entry),
    ...args.map(arg => String(params[arg.name] || getArgPlaceholder(entry, arg))),
    ...optionArgv,
  ];
  return {
    argv,
    display: [
      'openyida',
      ...canonicalPath(entry),
      ...args.map(arg => quoteDisplayArg(params[arg.name] || getArgPlaceholder(entry, arg), !!arg.display_quote)),
      ...optionDisplay,
    ].join(' '),
  };
}

function getPrimaryRepairPattern(entry) {
  return (entry.repair_patterns || [])[0] || {};
}

function buildCreateFormSuggestion(params = {}, entry = getCreateFormCreateEntry()) {
  const fieldsArg = normalizeEntryArgs(entry).find(arg => arg.name === 'fieldsJsonFile');
  const placeholderFile = params.fieldsJsonFile || (fieldsArg ? getArgPlaceholder(entry, fieldsArg) : '<fieldsJsonFile>');
  const command = buildCreateFormCreateCommand({
    appType: params.appType,
    formTitle: params.formTitle,
    fieldsJsonFile: placeholderFile,
  }, entry);
  const repair = getPrimaryRepairPattern(entry);
  return {
    command_id: entry.id,
    argv: command.argv,
    display: command.display,
    note: repair.note || 'Write the --fields JSON to a file, then pass that file path as <fieldsJsonFile>.',
    requires_fields_json_file: true,
    fields_inline_value_present: !!params.fieldsInline,
  };
}

function collectKnownCreateFormSubcommands() {
  return new Set(getContractManifest().commands
    .map(entry => entry.path || [])
    .filter(path => path[0] === 'create-form' && path[1])
    .map(path => path[1]));
}

function getCreateFormDeprecatedPattern(entry = getCreateFormCreateEntry()) {
  return (entry.deprecated_patterns || []).find(pattern => {
    const matcher = pattern.matcher || {};
    return matcher.type === 'argv_shape' && matcher.root === 'create-form';
  }) || null;
}

function buildDeprecatedCreateFormPattern(pattern, tokens, params) {
  return {
    ...cloneJson(pattern, {}),
    received: {
      argv: [...tokens],
      appType: params.appType,
      formTitle: params.formTitle,
      fields: params.fields,
    },
  };
}

function createDeprecatedCreateFormResult(entry, pattern, tokens, params) {
  const suggestion = buildCreateFormSuggestion({
    appType: params.appType,
    formTitle: params.formTitle,
    fieldsInline: looksLikeInlineJson(params.fields),
  }, entry);
  const resultPattern = buildDeprecatedCreateFormPattern(pattern, tokens, params);
  const message = [
    'Unsupported create-form option shape.',
    `\`${pattern.pattern}\` is not supported.`,
    `Use: ${suggestion.display}.`,
    suggestion.note,
  ].join(' ');

  return {
    ok: false,
    status: 'invalid',
    code: pattern.code || 'COMMAND_CONTRACT_DEPRECATED_PATTERN',
    message,
    command_id: entry.id,
    canonical: getCreateFormCreateCanonical(entry),
    suggestion,
    pattern: resultPattern,
  };
}

function detectDeprecatedCreateFormInvocation(argv = [], options = {}) {
  const entry = getCreateFormCreateEntry();
  const pattern = getCreateFormDeprecatedPattern(entry);
  if (!pattern) {
    return null;
  }

  const matcher = pattern.matcher || {};
  const tokens = normalizeInvocationArgv(argv, options);
  if (tokens[0] !== matcher.root) {
    return null;
  }

  const maybeAppType = tokens[matcher.app_type_position];
  if (!maybeAppType || (matcher.app_type_must_not_be_known_subcommand && collectKnownCreateFormSubcommands().has(maybeAppType))) {
    return null;
  }

  const captures = matcher.capture_options || {};
  const name = findOptionValue(tokens, captures.formTitle);
  const fields = findOptionValue(tokens, captures.fields);
  if (!name.found || !fields.found) {
    return null;
  }

  return createDeprecatedCreateFormResult(entry, pattern, tokens, {
    appType: maybeAppType,
    formTitle: name.value,
    fields: fields.value,
  });
}

function validateCreateFormCreateInvocation(tokens, entry = getCreateFormCreateEntry()) {
  const path = canonicalPath(entry);
  const args = normalizeEntryArgs(entry);
  const parsed = parseOptionArgs(tokens.slice(path.length));
  const params = {};
  const missing = [];

  args.forEach(arg => {
    const value = parsed.positionals[arg.position || 0];
    if (value) {
      params[arg.name] = value;
    } else if (arg.required) {
      missing.push(arg.name);
    }
  });

  normalizeEntryOptions(entry).forEach(arg => {
    const source = readParam(parsed, arg, undefined);
    if (source.value !== undefined) {
      params[arg.name] = source.value;
    }
  });

  if (missing.length === 0) {
    const command = buildCreateFormCreateCommand(params, entry);
    return {
      ok: true,
      status: 'ok',
      code: 'OK',
      command_id: entry.id,
      path: cloneJson(entry.path, []),
      argv: [...tokens],
      canonical: getCreateFormCreateCanonical(entry),
      matched_pattern: 'canonical.create-form.create',
      params,
      display: command.display,
    };
  }

  return {
    ok: false,
    status: 'invalid',
    code: 'COMMAND_CONTRACT_MISSING_ARGUMENTS',
    message: `Missing required ${entry.id} argument(s): ${missing.join(', ')}.`,
    command_id: entry.id,
    canonical: getCreateFormCreateCanonical(entry),
    suggestion: buildCreateFormSuggestion(params, entry),
    missing,
  };
}

function validateCommandInvocation(argv = []) {
  const deprecated = detectDeprecatedCreateFormInvocation(argv);
  if (deprecated) {
    return deprecated;
  }

  const entry = getCreateFormCreateEntry();
  const tokens = normalizeInvocationArgv(argv);
  const path = canonicalPath(entry);
  if (path.every((token, index) => tokens[index] === token)) {
    return validateCreateFormCreateInvocation(tokens, entry);
  }

  return {
    ok: false,
    status: 'unsupported',
    code: 'COMMAND_CONTRACT_UNSUPPORTED',
    message: 'No MVP command contract covers this invocation yet.',
    argv: tokens,
  };
}

function readParam(parsed, arg, fallback) {
  for (const option of arg.builder_options || []) {
    const normalizedKey = optionKey(option);
    if (parsed.options[normalizedKey] !== undefined) {
      return {
        value: parsed.options[normalizedKey],
        option,
      };
    }
  }
  return {
    value: fallback,
    option: null,
  };
}

function buildCreateFormCreateFromArgs(args = [], entry = getCreateFormCreateEntry()) {
  const parsed = parseOptionArgs(args);
  const params = {};
  const missing = [];
  let rejectedInlineJson = false;

  normalizeEntryArgs(entry).forEach(arg => {
    const source = readParam(parsed, arg, parsed.positionals[arg.position || 0]);
    const rejectedOptions = new Set(arg.inline_json_rejected_options || []);
    const rejectedInlineValue = source.option && rejectedOptions.has(source.option) && looksLikeInlineJson(source.value);

    if (rejectedInlineValue) {
      rejectedInlineJson = true;
    }

    if (source.value !== undefined && !rejectedInlineValue) {
      params[arg.name] = source.value;
    } else if (arg.required) {
      missing.push(arg.name);
    }
  });

  normalizeEntryOptions(entry).forEach(arg => {
    const source = readParam(parsed, arg, undefined);
    if (source.value !== undefined) {
      params[arg.name] = source.value;
    }
  });

  if (missing.length > 0) {
    return {
      ok: false,
      status: 'invalid',
      code: rejectedInlineJson
        ? 'COMMAND_BUILD_REQUIRES_FIELDS_JSON_FILE'
        : 'COMMAND_BUILD_MISSING_ARGUMENTS',
      message: rejectedInlineJson
        ? 'commands build does not write inline --fields JSON; pass --fields-json-file <fieldsJsonFile>.'
        : `Missing required ${entry.id} build parameter(s): ${missing.join(', ')}.`,
      command_id: entry.id,
      canonical: getCreateFormCreateCanonical(entry),
      suggestion: buildCreateFormSuggestion({
        ...params,
        fieldsInline: rejectedInlineJson,
      }, entry),
      missing,
    };
  }

  const command = buildCreateFormCreateCommand(params, entry);
  return {
    ok: true,
    status: 'ok',
    code: 'OK',
    command_id: entry.id,
    execute: false,
    argv: command.argv,
    display: command.display,
    canonical: getCreateFormCreateCanonical(entry),
    params,
  };
}

function buildCommandInvocation(commandId, args = []) {
  if (commandId === CREATE_FORM_CREATE_COMMAND_ID) {
    return buildCreateFormCreateFromArgs(args);
  }
  return {
    ok: false,
    status: 'unsupported',
    code: 'COMMAND_BUILD_UNSUPPORTED',
    message: `No MVP command builder covers command id: ${commandId || '<missing>'}.`,
    command_id: commandId || null,
  };
}

function stripJsonFlag(args = []) {
  const stripped = [];
  let json = false;
  for (const arg of args) {
    if (arg === '--json') {
      json = true;
    } else {
      stripped.push(arg);
    }
  }
  return { args: stripped, json };
}

function parseValidateArgs(args = []) {
  const delimiter = args.indexOf('--');
  const beforeDelimiter = delimiter === -1 ? args : args.slice(0, delimiter);
  const afterDelimiter = delimiter === -1 ? [] : args.slice(delimiter + 1);
  const parsedGlobals = stripJsonFlag(beforeDelimiter);

  return {
    json: parsedGlobals.json,
    args: delimiter === -1 ? parsedGlobals.args : afterDelimiter,
  };
}

function printCommandContractResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok && result.display) {
    console.log(result.display);
  } else {
    console.error(result.message || result.code || 'Command contract failed.');
    if (result.suggestion && result.suggestion.display) {
      console.error(`Suggestion: ${result.suggestion.display}`);
    }
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function runCommandsContract(args = []) {
  const action = args[0];

  if (action === 'validate') {
    const parsed = parseValidateArgs(args.slice(1));
    const result = parsed.args.length > 0
      ? validateCommandInvocation(parsed.args)
      : {
        ok: false,
        status: 'invalid',
        code: 'COMMAND_CONTRACT_EMPTY_INVOCATION',
        message: 'Usage: openyida commands validate --json -- <command...>',
      };
    printCommandContractResult(result, parsed.json);
    return result;
  }

  if (action === 'build') {
    const parsed = stripJsonFlag(args.slice(1));
    const commandId = parsed.args[0];
    const result = commandId
      ? buildCommandInvocation(commandId, parsed.args.slice(1))
      : {
        ok: false,
        status: 'invalid',
        code: 'COMMAND_BUILD_MISSING_COMMAND_ID',
        message: 'Usage: openyida commands build <command-id> ... --json',
      };
    printCommandContractResult(result, parsed.json);
    return result;
  }

  const result = {
    ok: false,
    status: 'invalid',
    code: 'COMMAND_CONTRACT_UNKNOWN_ACTION',
    message: 'Usage: openyida commands [--json] | commands validate --json -- <command...> | commands build <command-id> ... --json',
  };
  printCommandContractResult(result, args.includes('--json'));
  return result;
}

module.exports = {
  CREATE_FORM_CREATE_COMMAND_ID,
  buildCommandInvocation,
  buildCreateFormCreateCommand,
  detectDeprecatedCreateFormInvocation,
  getCreateFormCreateCanonical,
  runCommandsContract,
  validateCommandInvocation,
};
