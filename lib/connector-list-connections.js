/**
 * connector list-connections - 列出连接器的鉴权账号
 *
 * 用法：openyida connector list-connections <connector-id>
 */

"use strict";

const { getAuthRef, printTable, findConnectorById, listConnections } = require("./connector/api");

function showUsage() {
  console.log(`
用法: openyida connector list-connections <connector-id>

示例:
  openyida connector list-connections 910244
`);
}

async function run(args) {
  if (!args || args.length < 1 || args[0] === "--help" || args[0] === "-h") {
    showUsage();
    process.exit(0);
  }

  const connectorId = args[0];
  const authRef = getAuthRef();

  console.log(`🔍 正在获取鉴权账号列表...\n`);
  console.log(`连接器 ID: ${connectorId}\n`);

  const connector = await findConnectorById(connectorId, authRef);
  if (!connector) {
    console.error("❌ 未找到该连接器");
    process.exit(1);
  }

  console.log(`连接器: ${connector.displayName}`);
  console.log(`连接器名: ${connector.connectorName}\n`);

  const connections = await listConnections(connector.connectorName, authRef);

  if (connections.length === 0) {
    console.log("📭 暂无鉴权账号");
    console.log("\n💡 提示: 需要在宜搭平台管理后台创建鉴权账号");
    console.log("   https://www.aliwork.com/platformManage/customConnectorFactory");
    return;
  }

  console.log(`✅ 找到 ${connections.length} 个鉴权账号\n`);

  const headers = ["ID", "名称", "状态", "创建时间"];
  const rows = connections.map(connection => [
    connection.id || connection.connectionId || "-",
    connection.name || connection.connectionName || "-",
    connection.status === "ACTIVE" ? "✅ 有效" : (connection.status || "-"),
    connection.createTime ? new Date(connection.createTime).toLocaleString("zh-CN") : "-",
  ]);

  printTable(headers, rows);

  console.log("\n💡 测试连接器时需要指定鉴权账号:");
  console.log(`   openyida connector test --connector-id ${connectorId} --action <actionId> --account-id <accountId>`);
}

module.exports = { run };
