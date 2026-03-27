/**
 * connector create - 创建或更新宜搭 HTTP 连接器
 *
 * 用法：
 *   创建: openyida connector create "连接器名称" "https://api.example.com" --operations ./ops.json [选项]
 *   更新: openyida connector create --id <connector-id> [--desc "新描述"]
 *
 * 选项:
 *   --id <id>                  连接器 ID（用于更新现有连接器）
 *   --auth <type>              鉴权方式: 无身份验证, 基本身份验证, API密钥, 钉钉开放平台验证, 阿里云API网关, 钉钉零信任网关
 *   --username <username>      Basic Auth 用户名
 *   --password <password>      Basic Auth 密码
 *   --api-key-label <label>    API Key 显示标签
 *   --api-key-name <name>      API Key 参数名
 *   --api-key-location <loc>   API Key 位置: HEADER 或 QUERY
 *   --app-key <key>            钉钉 App Key
 *   --app-secret <secret>      钉钉 App Secret
 *   --desc <description>       连接器描述
 *   --icon <icon>              图标代码
 *   --operations <file>        执行动作配置文件 (JSON 格式，创建时必填)
 */

'use strict';

const fs = require('fs');
const {
  getAuthRef,
  buildConnectorDesc,
  findConnectorById,
  getConnectorDetail,
  saveConnector,
} = require('./api');

function showUsage() {
  console.log(`
用法:
  # 创建新连接器
  openyida connector create "连接器名称" "https://api.example.com" --operations ./ops.json [选项]

  # 更新现有连接器
  openyida connector create --id <connector-id> [--desc "新描述"]

选项:
  --id <id>                  连接器 ID（用于更新现有连接器）
  --auth <type>              鉴权方式: 无身份验证, 基本身份验证, API密钥, 钉钉开放平台验证, 阿里云API网关, 钉钉零信任网关
  --username <username>      Basic Auth 用户名
  --password <password>      Basic Auth 密码
  --api-key-label <label>    API Key 显示标签 (默认: API Key)
  --api-key-name <name>      API Key 参数名 (默认: X-API-Key)
  --api-key-location <loc>   API Key 位置: HEADER 或 QUERY (默认: HEADER)
  --app-key <key>            钉钉 App Key
  --app-secret <secret>      钉钉 App Secret
  --desc <description>       连接器描述
  --icon <icon>              图标代码 (默认: chaxun%%#FFA200)
  --operations <file>        执行动作配置文件 (JSON 格式，创建时必填)

示例:
  openyida connector create "测试API" "api.example.com" --operations ./ops.json
  openyida connector create "内部系统" "internal.company.com" --auth "基本身份验证" --username admin --password 123456 --operations ./ops.json
  openyida connector create "第三方API" "api.example.com" --auth "API密钥" --api-key-label "Authorization" --api-key-name "X-API-Key" --operations ./ops.json
  openyida connector create --id 910241 --desc "新的描述内容"
`);
}

const AUTH_TYPE_MAP = {
  '无身份验证': 'NONE',
  '基本身份验证': 'BASIC',
  'API密钥': 'API_KEY',
  '钉钉开放平台验证': 'DINGTALK',
  '阿里云API网关': 'ALIYUN',
  '钉钉零信任网关': 'DINGTRUST',
};

function parseArgs(args) {
  const idIndex = args.indexOf('--id');
  const isUpdateMode = idIndex !== -1;

  if (!isUpdateMode) {
    if (args.length < 2) {
      console.error('❌ 错误: 创建连接器需要提供名称和域名');
      showUsage();
      process.exit(1);
    }
    if (args[0].startsWith('--')) {
      console.error(`❌ 错误: 第一个参数 "${args[0]}" 看起来是一个选项，应该是连接器名称`);
      process.exit(1);
    }
    if (args[1].startsWith('--')) {
      console.error(`❌ 错误: 第二个参数 "${args[1]}" 看起来是一个选项，应该是域名`);
      process.exit(1);
    }
  }

  const options = {
    isUpdateMode,
    connectorId: isUpdateMode ? args[idIndex + 1] : null,
    name: isUpdateMode ? null : args[0],
    baseUrl: isUpdateMode ? null : args[1],
    authType: 'NONE',
    apiKeyLocation: 'HEADER',
    apiKeyName: 'X-API-Key',
    icon: 'chaxun%%#FFA200',
  };

  for (let i = isUpdateMode ? 0 : 2; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        showUsage();
        process.exit(0);
        break;
      case '--id':
        options.connectorId = args[++i];
        break;
      case '--auth':
        options.authType = AUTH_TYPE_MAP[args[++i]] || args[i].toUpperCase();
        break;
      case '--username':
        options.username = args[++i];
        break;
      case '--password':
        options.password = args[++i];
        break;
      case '--api-key-label':
        options.apiKeyLabel = args[++i];
        break;
      case '--api-key-name':
        options.apiKeyName = args[++i];
        break;
      case '--api-key-location':
        options.apiKeyLocation = args[++i]?.toUpperCase();
        break;
      case '--app-key':
        options.appKey = args[++i];
        break;
      case '--app-secret':
        options.appSecret = args[++i];
        break;
      case '--desc':
        options.description = args[++i];
        break;
      case '--icon':
        options.icon = args[++i];
        break;
      case '--operations':
        options.operationsFile = args[++i];
        break;
    }
  }

  return options;
}

function buildSecuritySchemes(options) {
  switch (options.authType) {
    case 'BASIC':
      return JSON.stringify({
        BasicAuth: {
          username: options.username || '用户名',
          password: options.password || '密码',
          type: 'http',
          scheme: 'basic',
        },
      });
    case 'API_KEY':
      return JSON.stringify({
        ApiKeyAuth: {
          label: options.apiKeyLabel || 'API Key',
          name: options.apiKeyName || 'X-API-Key',
          location: options.apiKeyLocation === 'QUERY' ? 'query' : 'header',
        },
      });
    case 'DINGTALK':
      if (!options.appKey || !options.appSecret) {
        throw new Error('钉钉鉴权需要提供 --app-key 和 --app-secret');
      }
      return JSON.stringify({ DingAuth: {} });
    case 'ALIYUN':
      return JSON.stringify({ AliyunApiGateway: {} });
    case 'DINGTRUST':
      return JSON.stringify({ DingTrustGW: {} });
    case 'NONE':
    default:
      return '{}';
  }
}

function parseBaseUrl(url) {
  try {
    const urlWithScheme = url.match(/^https?:\/\//) ? url : 'https://' + url;
    const parsed = new URL(urlWithScheme);
    return {
      scheme: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      basePath: '/',
    };
  } catch (e) {
    return {
      scheme: 'https',
      host: url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      basePath: '/',
    };
  }
}

function generateConnectorName() {
  return 'Http_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function run(args) {
  if (!args || args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    process.exit(0);
  }

  const options = parseArgs(args);
  const authRef = getAuthRef();

  // 更新模式
  if (options.isUpdateMode) {
    console.log('🔧 正在更新连接器...\n');
    console.log(`连接器 ID: ${options.connectorId}\n`);

    const connector = await findConnectorById(options.connectorId, authRef);
    if (!connector) {
      console.error('❌ 未找到该连接器');
      process.exit(1);
    }

    console.log(`找到连接器: ${connector.displayName}`);
    console.log(`当前描述: ${connector.connectorDesc || '(空)'}\n`);

    const detail = await getConnectorDetail(connector.connectorName, authRef);
    const currentOperations = JSON.parse(detail.operations || '[]');
    const newDesc = buildConnectorDesc(options.description, connector.connectorDesc, authRef, currentOperations);

    await saveConnector({
      operations: detail.operations || '[]',
      displayName: detail.displayName,
      iconUrl: detail.iconUrl || 'chaxun%%#FFA200',
      connectorDesc: newDesc,
      host: detail.host,
      baseUrl: detail.baseUrl || '/',
      scheme: detail.scheme || 'https',
      tongxunluTemplateId: detail.tongxunluTemplateId || '',
      faasTemplateId: detail.faasTemplateId || '0',
      securitySchemes: detail.securitySchemes || '{}',
      connectorMode: detail.connectorMode || '5',
      id: options.connectorId,
      connectorName: connector.connectorName,
      category: detail.category || 'http',
    }, authRef);

    console.log('✅ 连接器更新成功!');
    console.log('\n新描述:');
    console.log(newDesc);
    return;
  }

  // 创建模式
  console.log('🔧 正在创建连接器...\n');
  console.log(`名称: ${options.name}`);
  console.log(`基础域名: ${options.baseUrl}`);
  console.log(`鉴权方式: ${options.authType}`);

  if (!options.operationsFile) {
    console.error('❌ 错误: 创建连接器必须提供 --operations 参数');
    console.error('宜搭平台不允许创建没有执行动作的连接器');
    process.exit(1);
  }

  let operations;
  try {
    const opsContent = fs.readFileSync(options.operationsFile, 'utf-8');
    operations = JSON.parse(opsContent);
    if (!Array.isArray(operations) || operations.length === 0) {
      console.error('❌ 错误: operations 文件不能为空数组');
      process.exit(1);
    }
    console.log(`✓ 已加载 ${operations.length} 个执行动作`);
  } catch (e) {
    console.error(`❌ 读取执行动作配置文件失败: ${e.message}`);
    process.exit(1);
  }

  const urlInfo = parseBaseUrl(options.baseUrl);
  const securitySchemes = buildSecuritySchemes(options);
  const connectorName = generateConnectorName();
  const connectorDesc = buildConnectorDesc(options.description, null, authRef, operations);

  const saveResult = await saveConnector({
    operations: JSON.stringify(operations),
    displayName: options.name,
    iconUrl: options.icon,
    connectorDesc,
    host: urlInfo.host,
    baseUrl: urlInfo.basePath,
    scheme: urlInfo.scheme,
    tongxunluTemplateId: '',
    faasTemplateId: '0',
    securitySchemes,
    connectorMode: '5',
    connectorName,
    category: 'http',
  }, authRef);

  const connectorId = saveResult.connectorId;
  const detailUrl = connectorId
    ? `https://yidalogin.aliwork.com/platformManage/customConnectorFactory/update?id=${connectorId}&connectorName=${connectorName}&mode=http`
    : null;

  console.log('\n✅ 连接器创建成功!');
  if (connectorId) {
    console.log(`\nID: ${connectorId}`);
  }
  console.log(`连接器名称: ${connectorName}`);
  console.log(`显示名称: ${options.name}`);
  console.log(`基础域名: ${options.baseUrl}`);
  if (detailUrl) {
    console.log(`\n🔗 查看连接器:\n   ${detailUrl}`);
  } else {
    console.log('\n💡 下一步: 查看连接器列表获取 ID');
    console.log('   openyida connector list');
  }
}

module.exports = { run };
