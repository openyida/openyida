/**
 * connector smart-create - 智能创建连接器（完整流程）
 *
 * 用法：openyida connector smart-create --curl "curl命令" [选项]
 *
 * 选项:
 *   --curl <command>       curl 命令（必需）
 *   --name <name>          连接器名称
 *   --desc <description>   连接器描述
 */

"use strict";

const fs = require("fs");
const { getAuthRef, printTable, listConnectors } = require("./connector/api");
const { parseCurl, detectAuthType, filterBrowserHeaders } = require("./connector/curl-parser");
const { generateOperation } = require("./connector/action-generator");
const { generateConnectorDesc } = require("./connector/desc-generator");

function showUsage() {
  console.log(`
用法: openyida connector smart-create --curl "curl命令" [选项]

选项:
  --curl <command>       curl 命令（必需）
  --name <name>          连接器名称
  --desc <description>   连接器描述

示例:
  openyida connector smart-create \\
    --curl "curl 'https://api.dingtalk.com/v1.0/hrm/rosters' -H 'Authorization: Bearer xxx'" \\
    --name "钉钉花名册连接器"
`);
}

function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        showUsage();
        process.exit(0);
        break;
      case "--curl":
        options.curl = args[++i];
        break;
      case "--name":
        options.name = args[++i];
        break;
      case "--desc":
        options.desc = args[++i];
        break;
    }
  }

  return options;
}

/**
 * 阶段 1: 解析接口信息
 */
function phase1Parse(options) {
  console.log("🔍 阶段 1: 解析接口信息\n");

  if (!options.curl) {
    throw new Error("请提供 --curl 参数");
  }

  const curlData = parseCurl(options.curl);
  const authType = detectAuthType(curlData.headers);

  console.log("✅ 解析结果:");
  console.log(`   协议: ${curlData.protocol.toUpperCase()}`);
  console.log(`   Host: ${curlData.host}`);
  console.log(`   方法: ${curlData.method}`);
  console.log(`   路径: ${curlData.path}`);
  console.log(`   鉴权: ${authType.type}`);
  console.log();

  return { curlData, authType };
}

/**
 * 阶段 2: 查找匹配的已有连接器
 */
async function phase2Match(curlData, authType, authRef) {
  console.log("🔍 阶段 2: 查找匹配的已有连接器\n");

  const { connectors } = await listConnectors({ pageSize: 100 }, authRef);

  const matchingConnectors = connectors.filter(connector => {
    const hostMatch = connector.host === curlData.host;
    if (!hostMatch) return false;

    try {
      const securitySchemes = JSON.parse(connector.securitySchemes || "{}");
      return Object.keys(securitySchemes).includes(authType.code);
    } catch {
      return false;
    }
  });

  if (matchingConnectors.length > 0) {
    console.log(`✅ 找到 ${matchingConnectors.length} 个匹配的连接器:\n`);

    const headers = ["序号", "ID", "名称", "域名", "鉴权方式"];
    const rows = matchingConnectors.map((connector, index) => {
      let authTypeStr = "无";
      try {
        const schemes = JSON.parse(connector.securitySchemes || "{}");
        authTypeStr = Object.keys(schemes).join(", ") || "无";
      } catch {}
      return [index + 1, connector.id, connector.displayName, connector.host, authTypeStr];
    });

    printTable(headers, rows);

    console.log("\n💡 请选择操作方式:");
    console.log("   1. 追加到已有连接器（提供 --connector-id）");
    console.log("   2. 新建连接器");
    console.log();
  } else {
    console.log("ℹ️ 未找到匹配的连接器，建议新建连接器\n");
  }

  return matchingConnectors;
}

/**
 * 阶段 3: 生成执行动作配置
 */
function phase3Generate(curlData) {
  console.log("🔍 阶段 3: 生成执行动作配置\n");

  const relevantHeaders = filterBrowserHeaders(curlData.headers);
  const operation = generateOperation(curlData, relevantHeaders);
  const connectorDesc = generateConnectorDesc(curlData, operation);

  console.log("✅ 生成的配置:");
  console.log(`   动作ID: ${operation.operationId}`);
  console.log(`   动作名称: ${operation.summary}`);
  console.log(`   动作描述: ${operation.description}`);
  console.log(`   连接器描述: ${connectorDesc}`);
  console.log(`   输入参数: ${operation.inputs.length} 个`);
  console.log();

  return { operation, connectorDesc };
}

/**
 * 阶段 4: 保存配置并提供操作建议
 */
function phase4Output(options, curlData, authType, matchingConnectors, operation, connectorDesc) {
  const tempFile = `/tmp/operation-${Date.now()}.json`;
  fs.writeFileSync(tempFile, JSON.stringify([operation], null, 2));

  console.log(`💾 配置已保存到: ${tempFile}`);
  console.log();
  console.log("═══════════════════════════════════════════════════\n");
  console.log("💡 下一步操作:\n");

  if (matchingConnectors.length > 0) {
    console.log("选项 1 - 追加到已有连接器:");
    console.log(`   openyida connector add-action \\`);
    console.log(`     --operations ${tempFile} \\`);
    console.log(`     --connector-id ${matchingConnectors[0].id}`);
    console.log();
  }

  console.log("选项 2 - 新建连接器:");
  console.log(`   openyida connector create \\`);
  console.log(`     "${options.name || curlData.host + "连接器"}" \\`);
  console.log(`     "${curlData.host}" \\`);
  console.log(`     --auth "${authType.type}" \\`);
  console.log(`     --desc "${connectorDesc}" \\`);
  console.log(`     --operations ${tempFile}`);
  console.log();
  console.log("═══════════════════════════════════════════════════\n");

  // 测试建议
  console.log("🧪 阶段 4: 测试策略\n");
  console.log("连接器创建/更新后，建议进行以下测试:\n");
  console.log("选项 A - 自动测试（创建后执行）:");
  console.log(`   openyida connector test \\`);
  console.log(`     --connector-id <连接器ID> \\`);
  console.log(`     --action ${operation.operationId}`);
  console.log();
  console.log("选项 B - 在宜搭平台手动测试:");
  console.log("   1. 登录宜搭平台");
  console.log("   2. 进入「集成&自动化」→「连接器」");
  console.log("   3. 找到并打开该连接器，在执行动作列表中点击「测试」按钮");
  console.log();
  console.log("💡 测试参数建议:");
  console.log(`   该动作需要以下参数:`);
  operation.inputs.forEach(input => {
    if (input.childList && input.childList.length > 0) {
      console.log(`   - ${input.name}: ${input.childList.map(child => child.name).join(", ")}`);
    }
  });
  console.log();
  console.log("═══════════════════════════════════════════════════");
}

async function run(args) {
  if (!args || args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showUsage();
    process.exit(0);
  }

  const options = parseArgs(args);
  const authRef = getAuthRef();

  const { curlData, authType } = phase1Parse(options);
  const matchingConnectors = await phase2Match(curlData, authType, authRef);
  const { operation, connectorDesc } = phase3Generate(curlData);
  phase4Output(options, curlData, authType, matchingConnectors, operation, connectorDesc);
}

module.exports = { run };
