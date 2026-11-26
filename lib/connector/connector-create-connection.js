/**
 * 连接器鉴权账号创建与元数据维护
 *
 * 用法：openyida connector create-connection <connector-id> <connection-name> [选项]
 *
 * 选项:
 *   --username <username>   基本身份验证 - 用户名
 *   --password <password>   基本身份验证 - 密码
 *   --api-key <key>         API 密钥 - 密钥值
 *   --app-code <code>       阿里云 API 网关 - AppCode
 *   --interactive           在当前终端隐藏输入钉钉 App Key / App Secret
 */

'use strict';
const { fail } = require('../core/chalk');
const { safeJsonStringify } = require('../core/redact');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { isDeepStrictEqual } = require('util');

const {
  getAuthRef,
  findConnectorById,
  getConnectorDetail,
  createConnection,
  saveConnector,
} = require('./api');
const { AUTH_TYPE_CODES, parseJsonValue } = require('./contract');
const api = require('./api');

function showUsage() {
  console.log(`
用法: openyida connector create-connection <connector-id> <connection-name> [选项]

参数:
  connector-id      连接器 ID
  connection-name   鉴权账号显示名称

选项:
  --username <username>   基本身份验证 - 用户名
  --password <password>   基本身份验证 - 密码
  --api-key <key>         API 密钥 - 密钥值
  --app-code <code>       阿里云 API 网关 - AppCode
  --interactive           在 TTY 终端隐藏输入钉钉 App Key / App Secret（推荐）

示例:
  openyida connector create-connection 910264 "测试账号" --username "admin" --password "123456"
  openyida connector create-connection 910258 "生产密钥" --api-key "sk-xxxxxxxx"
  openyida connector create-connection 910244 "钉钉账号" --interactive
  openyida connector create-connection 910264 "阿里云账号" --app-code "your-app-code"
`);
  console.log(t('issue_fixes.repair_required'));
}

function apiKeyScheme(schemes) {
  const scheme = schemes && schemes.ApiKeyAuth;
  const location = scheme && (scheme.in || scheme.location);
  if (!scheme || typeof scheme.name !== 'string' || !scheme.name.trim()
    || !['header', 'query'].includes(location)
    || (scheme.type !== undefined && scheme.type !== 'apiKey')
    || (scheme.location !== undefined && scheme.location !== location)) {
    throw new CliError(t('issue_fixes.invalid_api_key'), { code: 'CONNECTOR_API_KEY_SCHEME_INVALID' });
  }
  return { ...scheme, type: 'apiKey', in: location, location };
}

function buildSecurityValue(options, authType, schemes) {
  switch (authType) {
    case 'BasicAuth':
      if (!options.username || !options.password) {
        throw new Error('基本身份验证需要提供 --username 和 --password');
      }
      return JSON.stringify({ username: options.username, password: options.password });

    case 'ApiKeyAuth':
      if (!options.apiKey) {
        throw new Error('API 密钥需要提供 --api-key');
      }
      return JSON.stringify({ [apiKeyScheme(schemes).name]: options.apiKey });

    case 'DingAuth':
      if (!options.appKey || !options.appSecret) {
        throw new Error('钉钉开放平台验证需要提供 --app-key 和 --app-secret');
      }
      return JSON.stringify({ appKey: options.appKey, appSecret: options.appSecret });

    case 'AliyunApiGateway':
      if (!options.appCode) {
        throw new Error('阿里云 API 网关需要提供 --app-code');
      }
      return JSON.stringify({ appCode: options.appCode });

    case 'DingTrustGW':
      if (!options.appKey || !options.appSecret) {
        throw new Error('钉钉零信任网关需要提供 --app-key 和 --app-secret');
      }
      return JSON.stringify({ appKey: options.appKey, appSecret: options.appSecret });

    default:
      throw new Error(`不支持的鉴权类型: ${authType}`);
  }
}

function secretInputError(code, message, details = {}) {
  return new CliError(message, {
    code,
    details: {
      retrySafe: true,
      sideEffectState: 'none',
      ...details,
    },
  });
}

function readHiddenLine(prompt, input = process.stdin, output = process.stderr) {
  if (!input || !output || input.isTTY !== true || typeof input.setRawMode !== 'function') {
    return Promise.reject(secretInputError(
      'CONNECTOR_SECRET_INPUT_TTY_REQUIRED',
      t('connector_auth.tty_required'),
      { nextStep: t('connector_auth.tty_next_step') }
    ));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = !!input.isRaw;
    const cleanup = () => {
      input.removeListener('data', onData);
      if (!wasRaw) {input.setRawMode(false);}
      input.pause();
    };
    const finish = () => {
      cleanup();
      output.write('\n');
      resolve(value);
    };
    const abort = () => {
      cleanup();
      output.write('\n');
      reject(secretInputError('CONNECTOR_SECRET_INPUT_CANCELLED', t('connector_auth.input_cancelled')));
    };
    const onData = (chunk) => {
      const text = String(chunk);
      for (const char of text) {
        if (char === '\u0003') {abort(); return;}
        if (char === '\r' || char === '\n') {finish(); return;}
        if (char === '\u007f' || char === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else if (char >= ' ') {
          value += char;
        }
      }
    };

    output.write(prompt);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function collectInteractiveCredentials(options, authType, deps = {}) {
  if (!options.interactive) {return options;}
  if (options.appKey || options.appSecret) {
    throw secretInputError(
      'CONNECTOR_SECRET_INPUT_CONFLICT',
      t('connector_auth.interactive_conflict')
    );
  }
  if (authType !== 'DingAuth' && authType !== 'DingTrustGW') {
    throw secretInputError(
      'CONNECTOR_INTERACTIVE_AUTH_UNSUPPORTED',
      t('connector_auth.interactive_auth_unsupported', authType)
    );
  }

  const readSecret = deps.readSecret || readHiddenLine;
  const input = deps.input || process.stdin;
  const output = deps.output || process.stderr;
  if (input.isTTY !== true || typeof input.setRawMode !== 'function') {
    throw secretInputError(
      'CONNECTOR_SECRET_INPUT_TTY_REQUIRED',
      t('connector_auth.tty_required'),
      { nextStep: t('connector_auth.tty_next_step') }
    );
  }
  const appKey = await readSecret(t('connector_auth.prompt_app_key'), input, output);
  const appSecret = await readSecret(t('connector_auth.prompt_app_secret'), input, output);
  if (!appKey || !appSecret) {
    throw secretInputError('CONNECTOR_SECRET_INPUT_EMPTY', t('connector_auth.input_empty'));
  }
  return { ...options, appKey, appSecret };
}

function parseArgs(args) {
  const options = {
    connectorId: args[0],
    connectionName: args[1],
  };

  for (let i = 2; i < args.length; i++) {
    switch (args[i]) {
      case '--username':
        options.username = args[++i];
        break;
      case '--password':
        options.password = args[++i];
        break;
      case '--api-key':
        options.apiKey = args[++i];
        break;
      case '--app-key':
        options.appKey = args[++i];
        break;
      case '--app-secret':
        options.appSecret = args[++i];
        break;
      case '--app-code':
        options.appCode = args[++i];
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--repair-api-key-scheme':
        options.repairApiKeyScheme = true;
        break;
      case '--json':
        options.json = true;
        break;
    }
  }

  return options;
}

async function run(args, deps = {}) {
  if (!args || args.length < 2 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    process.exit(0);
  }

  const options = parseArgs(args);
  const log = options.json ? () => {} : console.log;
  const authRef = getAuthRef();

  log('🔧 正在创建鉴权账号...\n');
  log(`连接器 ID: ${options.connectorId}`);
  log(`账号名称: ${options.connectionName}\n`);

  const connector = await findConnectorById(options.connectorId, authRef);
  if (!connector) {
    fail('未找到该连接器');
    process.exit(1);
  }

  log(`连接器: ${connector.displayName}`);
  log(`连接器名: ${connector.connectorName}\n`);

  const detail = await getConnectorDetail(connector.connectorName, authRef);
  const securitySchemes = JSON.parse(detail.securitySchemes || '{}');
  const authType = Object.keys(securitySchemes)[0];

  if (!authType || authType === 'NONE') {
    fail('该连接器无需鉴权账号');
    process.exit(1);
  }

  log(`鉴权类型: ${authType}\n`);

  const credentialOptions = await collectInteractiveCredentials(options, authType, deps);
  const securityValue = buildSecurityValue(credentialOptions, authType, securitySchemes);
  let accountSchemes = securitySchemes;
  let schemeRepaired = false;
  if (authType === 'ApiKeyAuth') {
    accountSchemes = { ...securitySchemes, ApiKeyAuth: apiKeyScheme(securitySchemes) };
    if (!isDeepStrictEqual(accountSchemes, securitySchemes)) {
      if (!options.repairApiKeyScheme) {
        throw new CliError(t('issue_fixes.repair_required'), { code: 'CONNECTOR_API_KEY_REPAIR_REQUIRED' });
      }
      await saveConnector({ ...detail, id: connector.id, connectorName: connector.connectorName,
        operations: typeof detail.operations === 'string' ? detail.operations : JSON.stringify(detail.operations),
        securitySchemes: JSON.stringify(accountSchemes) }, authRef);
      schemeRepaired = true;
    }
  } else if (options.repairApiKeyScheme) {
    throw new CliError(t('issue_fixes.invalid_api_key'), { code: 'CONNECTOR_API_KEY_SCHEME_INVALID' });
  }

  const result = await createConnection({
    connectionName: options.connectionName,
    securityValue,
    connectorName: connector.connectorName,
    securitySchemes: JSON.stringify(accountSchemes),
    authType: AUTH_TYPE_CODES[authType] ?? AUTH_TYPE_CODES.NONE,
  }, authRef);

  log('✅ 鉴权账号创建成功!');
  log(`账号 ID: ${result.id || result.connectionId || '-'}`);
  const output = {
    success: true,
    connectionId: result.id || result.connectionId,
    connectionName: result.connectionName || options.connectionName,
    readbackVerified: result.readbackVerified === true,
    ...(authType === 'ApiKeyAuth' ? { schemeRepaired, existingAccountsUnchanged: true,
      notice: t('issue_fixes.replacement_notice') } : {}),
  };
  if (authType === 'ApiKeyAuth') { log(output.notice); }
  if (options.json) {
    console.log(safeJsonStringify(output, 0));
  }
  return output;
}

// Account detail/update shares the existing hidden-input and credential builders.
function stop(code, key, details = {}) {
  throw new CliError(t(`connector_account.${key}`), { code,
    details: { retrySafe: true, sideEffectState: 'none', ...details } });
}

function parseMaintenanceArgs(args, mode) {
  const options = { positional: [] };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help' || flag === '-h') { options.help = true; }
    else if (flag === '--json') { options.json = true; }
    else if (mode === 'update' && flag === '--confirm') { options.confirm = true; }
    else if (mode === 'update' && flag === '--interactive') { options.interactive = true; }
    else if (mode === 'update' && flag === '--name') {
      const value = args[++i];
      if (!value || value.startsWith('--')) { stop('CLI_INVALID_ARGUMENTS', 'usage'); }
      options.name = value;
    } else if (flag.startsWith('-')) { stop('CLI_INVALID_ARGUMENTS', 'usage'); }
    else { options.positional.push(flag); }
  }
  if (!options.help && (options.positional.length !== 2 || !options.positional.every(x => /^[1-9]\d*$/.test(x)))) {
    stop('CLI_INVALID_ARGUMENTS', 'usage');
  }
  return options;
}

function metadata(row) {
  return {
    connectionId: String(row.id || row.connectionId), connectionName: row.connectionName || row.name || '',
    connectorName: row.connectorName, typeCode: row.authType, status: row.status,
  };
}

function accountSchemeMatches(row, schemes) {
  try { return isDeepStrictEqual(parseJsonValue(row.securitySchemes, null), schemes); }
  catch (_error) { return false; }
}

async function readAccount(connectorId, connectionId, authRef) {
  const connector = await api.findConnectorById(connectorId, authRef);
  if (!connector || !connector.connectorName) { stop('CONNECTOR_CONNECTION_TARGET_INVALID', 'target_invalid'); }
  const rows = await api.listAllConnections(connector.connectorName, authRef);
  if (!Array.isArray(rows)) { stop('CONNECTOR_CONNECTION_TARGET_INVALID', 'target_invalid'); }
  const matches = rows.filter(row => String(row.id || row.connectionId) === connectionId);
  if (matches.length !== 1 || matches[0].connectorName !== connector.connectorName) {
    stop('CONNECTOR_CONNECTION_TARGET_INVALID', 'target_invalid');
  }
  return { connector, row: matches[0], metadata: metadata(matches[0]) };
}

async function credentials(type, schemes, deps) {
  const input = deps.input || process.stdin;
  const output = deps.output || process.stderr;
  if (input.isTTY !== true || typeof input.setRawMode !== 'function') {
    stop('CONNECTOR_SECRET_INPUT_TTY_REQUIRED', 'interactive_required');
  }
  const fields = {
    BasicAuth: ['username', 'password'], ApiKeyAuth: ['apiKey'], DingAuth: ['appKey', 'appSecret'],
    AliyunApiGateway: ['appCode'], DingTrustGW: ['appKey', 'appSecret'],
  }[type];
  if (!fields) { stop('CONNECTOR_CONNECTION_AUTH_UNSUPPORTED', 'auth_unsupported'); }
  const options = {};
  for (const field of fields) {
    options[field] = await (deps.readSecret || readHiddenLine)(t('connector_account.prompt', field), input, output);
    if (!options[field]) { stop('CONNECTOR_SECRET_INPUT_EMPTY', 'credentials_empty'); }
  }
  return buildSecurityValue(options, type, schemes);
}

async function runAction(args, mode, deps = {}) {
  const options = parseMaintenanceArgs(args, mode);
  if (options.help) { console.log(t('connector_account.usage')); return; }
  const [connectorId, connectionId] = options.positional;
  const authRef = api.getAuthRef();
  const before = await readAccount(connectorId, connectionId, authRef);
  let result = { success: true, connectorId, ...before.metadata, source: 'connection_list', credentialValuesIncluded: false };
  if (mode === 'update') {
    const name = options.name || before.metadata.connectionName;
    if (!name.trim()) { stop('CLI_INVALID_ARGUMENTS', 'usage'); }
    if (!options.confirm) {
      result = { ...result, dryRun: true, mutationPerformed: false, requiresConfirm: true,
        requestedConnectionName: name, nextStep: t('connector_account.confirm_required') };
    } else {
      if (!options.interactive) { stop('CONNECTOR_SECRET_INPUT_TTY_REQUIRED', 'interactive_required'); }
      const detail = await api.getConnectorDetail(before.connector.connectorName, authRef);
      const schemes = parseJsonValue(detail.securitySchemes, {});
      const types = Object.keys(schemes);
      if (types.length !== 1 || types[0] === 'NONE' || AUTH_TYPE_CODES[types[0]] === undefined) {
        stop('CONNECTOR_CONNECTION_AUTH_UNSUPPORTED', 'auth_unsupported');
      }
      const type = types[0];
      // The native account update only persists name/credentials. It cannot
      // repair an existing account's authentication type or scheme.
      if (String(before.metadata.typeCode) !== String(AUTH_TYPE_CODES[type])) {
        stop('CONNECTOR_CONNECTION_AUTH_TYPE_MISMATCH', 'type_mismatch', {
          connectionId, expectedTypeCode: AUTH_TYPE_CODES[type], actualTypeCode: before.metadata.typeCode ?? null,
        });
      }
      if (!accountSchemeMatches(before.row, schemes)) {
        stop('CONNECTOR_CONNECTION_AUTH_SCHEME_MISMATCH', 'scheme_mismatch', { connectionId });
      }
      const securityValue = await credentials(type, schemes, deps);
      const current = await readAccount(connectorId, connectionId, authRef);
      const currentDetail = await api.getConnectorDetail(before.connector.connectorName, authRef);
      if (!isDeepStrictEqual(current.metadata, before.metadata)
        || !accountSchemeMatches(current.row, schemes)
        || !isDeepStrictEqual(parseJsonValue(currentDetail.securitySchemes, {}), schemes)) {
        stop('CONNECTOR_CONNECTION_CHANGED', 'changed');
      }
      const target = { type: 'connectorConnection', connectorId, connectorName: before.connector.connectorName, connectionId };
      const uncertain = { target, partial: { connectionId }, retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true,
        nextStep: `openyida connector connection detail ${connectorId} ${connectionId} --json` };
      let response;
      try {
        response = await api.connectorPostOnce('/query/connection/updateConnection.json', {
          id: connectionId, connectorName: before.connector.connectorName, connectionName: name,
          securityValue,
        }, authRef);
      } catch (_error) { stop('CONNECTOR_CONNECTION_UPDATE_UNVERIFIED', 'update_unverified', uncertain); }
      if (response?.success !== true || response.hasError || String(response.content) !== connectionId) {
        stop('CONNECTOR_CONNECTION_UPDATE_UNVERIFIED', 'update_unverified', uncertain);
      }
      let after;
      try { after = await readAccount(connectorId, connectionId, authRef); }
      catch (_error) { stop('CONNECTOR_CONNECTION_UPDATE_UNVERIFIED', 'update_unverified', uncertain); }
      if (after.metadata.connectionName !== name || String(after.metadata.typeCode) !== String(AUTH_TYPE_CODES[type])) {
        stop('CONNECTOR_CONNECTION_UPDATE_UNVERIFIED', 'update_unverified', uncertain);
      }
      result = { success: true, connectorId, ...after.metadata, metadataReadbackVerified: true,
        credentialsVerified: false, credentialValuesIncluded: false };
    }
  }
  console.log(safeJsonStringify(result, 0));
  return result;
}

async function runConnection(args = [], deps = {}) {
  const [mode, ...rest] = args;
  if (!mode || mode === '--help' || mode === '-h') { console.log(t('connector_account.usage')); return; }
  if (!['detail', 'update'].includes(mode)) { stop('CLI_INVALID_ARGUMENTS', 'usage'); }
  return runAction(rest, mode, deps);
}

module.exports = {
  buildSecurityValue,
  collectInteractiveCredentials,
  parseArgs,
  readHiddenLine,
  run,
  runConnection,
  runAction,
  readAccount,
  metadata,
  parseMaintenanceArgs,
};
