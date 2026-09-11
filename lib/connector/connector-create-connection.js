/**
 * connector create-connection - 创建连接器鉴权账号
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

const {
  getAuthRef,
  findConnectorById,
  getConnectorDetail,
  createConnection,
} = require('./api');
const { AUTH_TYPE_CODES } = require('./contract');

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
}

function buildSecurityValue(options, authType) {
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
      return JSON.stringify({ token: options.apiKey });

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
  const securityValue = buildSecurityValue(credentialOptions, authType);

  const result = await createConnection({
    connectionName: options.connectionName,
    securityValue,
    connectorName: connector.connectorName,
    securitySchemes: detail.securitySchemes,
    authType: AUTH_TYPE_CODES[authType] ?? AUTH_TYPE_CODES.NONE,
  }, authRef);

  log('✅ 鉴权账号创建成功!');
  log(`账号 ID: ${result.id || result.connectionId || '-'}`);
  const output = {
    success: true,
    connectionId: result.id || result.connectionId,
    connectionName: result.connectionName || options.connectionName,
    readbackVerified: result.readbackVerified === true,
  };
  if (options.json) {
    console.log(safeJsonStringify(output, 0));
  }
  return output;
}

module.exports = {
  buildSecurityValue,
  collectInteractiveCredentials,
  parseArgs,
  readHiddenLine,
  run,
};
