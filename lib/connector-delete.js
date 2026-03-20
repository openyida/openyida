/**
 * connector delete - 删除连接器
 *
 * 用法：openyida connector delete <connector-id> [--force]
 */

"use strict";

const { getAuthRef, findConnectorById, getConnectorDetail, saveConnector } = require("./connector/api");

function showUsage() {
  console.log(`
用法: openyida connector delete <connector-id> [--force]

选项:
  --force    跳过确认提示

示例:
  openyida connector delete 910244
  openyida connector delete 910244 --force
`);
}

async function run(args) {
  if (!args || args.length < 1 || args[0] === "--help" || args[0] === "-h") {
    showUsage();
    process.exit(0);
  }

  const connectorId = args[0];
  const force = args.includes("--force");

  console.log("⚠️  删除连接器\n");
  console.log(`连接器 ID: ${connectorId}`);

  if (!force) {
    console.log("\n⚠️  警告: 此操作不可恢复，关联的执行动作也将被删除！");
    console.log("如果需要跳过确认，请使用 --force 参数:");
    console.log(`   openyida connector delete ${connectorId} --force`);
    return;
  }

  const authRef = getAuthRef();

  const connector = await findConnectorById(connectorId, authRef);
  if (!connector) {
    console.error("❌ 未找到该连接器");
    process.exit(1);
  }

  // 宜搭没有独立的删除连接器 API，通过 createOrUpdateConnector 无法删除
  // 实际删除需要通过宜搭平台管理后台操作
  // 这里提示用户前往平台操作
  console.log(`\n连接器: ${connector.displayName}`);
  console.log("\n⚠️  注意: 宜搭 API 暂不支持通过接口直接删除连接器。");
  console.log("请前往宜搭平台管理后台手动删除:");
  console.log("   https://www.aliwork.com/platformManage/customConnectorFactory");
}

module.exports = { run };
