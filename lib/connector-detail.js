/**
 * connector detail - 获取连接器详情
 *
 * 用法：openyida connector detail <connector-id>
 */

"use strict";

const { getAuthRef, findConnectorById, getConnectorDetail } = require("./connector/api");

function showUsage() {
  console.log(`
用法: openyida connector detail <connector-id>

示例:
  openyida connector detail 910244
`);
}

async function run(args) {
  if (!args || args.length < 1 || args[0] === "--help" || args[0] === "-h") {
    showUsage();
    process.exit(0);
  }

  const connectorId = args[0];
  const authRef = getAuthRef();

  console.log(`🔍 正在获取连接器详情...\n`);
  console.log(`连接器 ID: ${connectorId}\n`);

  const connector = await findConnectorById(connectorId, authRef);
  if (!connector) {
    console.error("❌ 未找到该连接器");
    process.exit(1);
  }

  const detail = await getConnectorDetail(connector.connectorName, authRef);

  // 打印基本信息
  console.log("📋 基本信息");
  console.log("─".repeat(50));
  console.log(`显示名称: ${detail.displayName || "-"}`);
  console.log(`连接器名: ${detail.connectorName || "-"}`);
  console.log(`描述: ${detail.connectorDesc ? detail.connectorDesc.split("---")[0].trim() : "-"}`);
  console.log(`域名: ${detail.host || "-"}`);
  console.log(`基础路径: ${detail.baseUrl || "-"}`);
  console.log(`协议: ${detail.scheme || "-"}`);
  console.log(`鉴权方式: ${Object.keys(JSON.parse(detail.securitySchemes || "{}")).join(", ") || "NONE"}`);
  console.log();

  // 打印执行动作
  if (detail.operations) {
    try {
      const operations = JSON.parse(detail.operations);
      console.log(`⚡ 执行动作 (${operations.length} 个)`);
      console.log("─".repeat(50));

      operations.forEach((operation, index) => {
        console.log(`\n[${index + 1}] ${operation.operationId || operation.id || "-"}`);
        console.log(`  名称: ${operation.summary || "-"}`);
        console.log(`  描述: ${operation.description || "-"}`);
        console.log(`  方法: ${operation.method?.toUpperCase() || "-"}`);
        console.log(`  路径: ${operation.url || "-"}`);

        if (operation.inputs && operation.inputs.length > 0) {
          console.log("  参数:");
          operation.inputs.forEach(input => {
            const childList = input.childList || [];
            if (childList.length > 0) {
              console.log(`    ${input.name} (${input.desc}):`);
              childList.forEach(child => {
                const required = child.required ? "必填" : "可选";
                console.log(`      - ${child.name}: ${child.desc} [${required}]`);
              });
            }
          });
        }
      });
    } catch (e) {
      console.log("⚠️  解析执行动作失败");
    }
  }

  console.log();
  console.log("✅ 详情获取完成");
}

module.exports = { run };
