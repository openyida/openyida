/**
 * connector create-connection - 创建连接器鉴权账号
 *
 * 用法：openyida connector create-connection <connector-id> <connection-name> [选项]
 *
 * 选项:
 *   --username <username>   基本身份验证 - 用户名
 *   --password <password>   基本身份验证 - 密码
 *   --api-key <key>         API 密钥 - 密钥值
 *   --app-key <key>         钉钉开放平台 - App Key
 *   --app-secret <secret>   钉钉开放平台 - App Secret
 *   --app-code <code>       阿里云 API 网关 - AppCode
 */

"use strict";

const {
  getAuthRef,
  findConnectorById,
  getConnectorDetail,
  createConnection,
} = require("./connector/api");

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
  --app-key <key>         钉钉开放平台 - App Key
  --app-secret <secret>   钉钉开放平台 - App Secret
  --app-code <code>       阿里云 API 网关 - AppCode

示例:
  openyida connector create-connection 910264 "测试账号" --username "admin" --password "123456"
  openyida connector create-connection 910258 "生产密钥" --api-key "sk-xxxxxxxx"
  openyida connector create-connection 910244 "钉钉账号" --app-key "dingxxx" --app-secret "xxx"
  openyida connector create-connection 910264 "阿里云账号" --app-code "your-app-code"
`);
}

const AUTH_TYPE_CODE_MAP = {
  "NONE": 0,
  "BasicAuth": 2,
  "ApiKeyAuth": 3,
  "DingAuth": 4,
  "AliyunApiGateway": 6,
  "DingTrustGW": 7,
};

function buildSecurityValue(options, authType) {
  switch (authType) {
    case "BasicAuth":
      if (!options.username || !options.password) {
        throw new Error("基本身份验证需要提供 --username 和 --password");
      }
      return JSON.stringify({ username: options.username, password: options.password });

    case "ApiKeyAuth":
      if (!options.apiKey) {
        throw new Error("API 密钥需要提供 --api-key");
      }
      return JSON.stringify({ token: options.apiKey });

    case "DingAuth":
      if (!options.appKey || !options.appSecret) {
        throw new Error("钉钉开放平台验证需要提供 --app-key 和 --app-secret");
      }
      return JSON.stringify({ appKey: options.appKey, appSecret: options.appSecret });

    case "AliyunApiGateway":
      if (!options.appCode) {
        throw new Error("阿里云 API 网关需要提供 --app-code");
      }
      return JSON.stringify({ appCode: options.appCode });

    case "DingTrustGW":
      if (!options.appKey || !options.appSecret) {
        throw new Error("钉钉零信任网关需要提供 --app-key 和 --app-secret");
      }
      return JSON.stringify({ appKey: options.appKey, appSecret: options.appSecret });

    default:
      throw new Error(`不支持的鉴权类型: ${authType}`);
  }
}

function parseArgs(args) {
  const options = {
    connectorId: args[0],
    connectionName: args[1],
  };

  for (let i = 2; i < args.length; i++) {
    switch (args[i]) {
      case "--username":
        options.username = args[++i];
        break;
      case "--password":
        options.password = args[++i];
        break;
      case "--api-key":
        options.apiKey = args[++i];
        break;
      case "--app-key":
        options.appKey = args[++i];
        break;
      case "--app-secret":
        options.appSecret = args[++i];
        break;
      case "--app-code":
        options.appCode = args[++i];
        break;
    }
  }

  return options;
}

async function run(args) {
  if (!args || args.length < 2 || args[0] === "--help" || args[0] === "-h") {
    showUsage();
    process.exit(0);
  }

  const options = parseArgs(args);
  const authRef = getAuthRef();

  console.log("🔧 正在创建鉴权账号...\n");
  console.log(`连接器 ID: ${options.connectorId}`);
  console.log(`账号名称: ${options.connectionName}\n`);

  const connector = await findConnectorById(options.connectorId, authRef);
  if (!connector) {
    console.error("❌ 未找到该连接器");
    process.exit(1);
  }

  console.log(`连接器: ${connector.displayName}`);
  console.log(`连接器名: ${connector.connectorName}\n`);

  const detail = await getConnectorDetail(connector.connectorName, authRef);
  const securitySchemes = JSON.parse(detail.securitySchemes || "{}");
  const authType = Object.keys(securitySchemes)[0];

  if (!authType || authType === "NONE") {
    console.error("❌ 该连接器无需鉴权账号");
    process.exit(1);
  }

  console.log(`鉴权类型: ${authType}\n`);

  const securityValue = buildSecurityValue(options, authType);

  const result = await createConnection({
    connectionName: options.connectionName,
    securityValue,
    connectorName: connector.connectorName,
    securitySchemes: detail.securitySchemes,
    authType: AUTH_TYPE_CODE_MAP[authType] || 0,
  }, authRef);

  console.log("✅ 鉴权账号创建成功!");
  console.log(`账号 ID: ${result.id || result.connectionId || "-"}`);
}

module.exports = { run };
