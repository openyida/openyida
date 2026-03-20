/**
 * connector delete-action - 删除执行动作
 *
 * 用法：openyida connector delete-action <connector-id> <operation-id> [--force]
 *
 * 实现方式：获取连接器详情，过滤掉目标动作，再整体更新 operations。
 * 宜搭没有单独的删除动作 API，必须通过整体更新连接器来实现删除。
 */

"use strict";

const {
  getAuthRef,
  buildConnectorDesc,
  findConnectorById,
  getConnectorDetail,
  saveConnector,
} = require("./connector/api");

function showUsage() {
  console.log(`
用法: openyida connector delete-action <connector-id> <operation-id> [--force]

参数:
  connector-id    连接器 ID（数字，如 910322）
  operation-id    要删除的动作 operationId（如 groupMessageMucText）

选项:
  --force    跳过确认提示，直接执行删除

示例:
  # 先查看有哪些动作
  openyida connector list-actions 910322

  # 删除指定动作（先展示确认信息）
  openyida connector delete-action 910322 groupMessageMucText

  # 确认后执行删除
  openyida connector delete-action 910322 groupMessageMucText --force
`);
}

async function run(args) {
  if (!args || args.length < 2 || args[0] === "--help" || args[0] === "-h") {
    showUsage();
    process.exit(0);
  }

  const connectorId = args[0];
  const operationId = args[1];
  const force = args.includes("--force");

  const authRef = getAuthRef();

  console.log("🔍 正在获取连接器详情...\n");

  const connector = await findConnectorById(connectorId, authRef);
  if (!connector) {
    console.error(`❌ 未找到连接器 ID: ${connectorId}`);
    console.log("💡 使用 openyida connector list 查看所有连接器");
    process.exit(1);
  }

  const detail = await getConnectorDetail(connector.connectorName, authRef);
  const currentOperations = JSON.parse(detail.operations || "[]");
  const targetOperation = currentOperations.find(op => op.operationId === operationId);

  if (!targetOperation) {
    console.error(`❌ 未找到动作 operationId: ${operationId}`);
    console.log("\n当前动作列表:");
    currentOperations.forEach((op, index) => {
      console.log(`  ${index + 1}. ${op.operationId}: ${op.summary}`);
    });
    process.exit(1);
  }

  console.log("📋 即将删除以下动作:");
  console.log(`   连接器: ${connector.displayName} (ID: ${connector.id})`);
  console.log(`   动作 ID: ${targetOperation.operationId}`);
  console.log(`   动作名称: ${targetOperation.summary}`);
  console.log(`   删除后剩余动作数: ${currentOperations.length - 1}`);
  console.log();

  if (!force) {
    console.log("⚠️  警告: 此操作不可恢复！");
    console.log("如需继续，请添加 --force 参数:");
    console.log(`   openyida connector delete-action ${connectorId} ${operationId} --force`);
    return;
  }

  const filteredOperations = currentOperations.filter(op => op.operationId !== operationId);
  const updatedDesc = buildConnectorDesc(null, detail.connectorDesc, authRef, filteredOperations);

  await saveConnector({
    operations: JSON.stringify(filteredOperations),
    displayName: detail.displayName,
    iconUrl: detail.iconUrl || "chaxun%%#FFA200",
    connectorDesc: updatedDesc,
    host: detail.host,
    baseUrl: detail.baseUrl || "/",
    scheme: detail.scheme || "https",
    tongxunluTemplateId: detail.tongxunluTemplateId || "",
    faasTemplateId: detail.faasTemplateId || "0",
    securitySchemes: detail.securitySchemes || "{}",
    connectorMode: "5",
    id: connector.id,
    connectorName: connector.connectorName,
    category: "http",
  }, authRef);

  console.log("✅ 执行动作删除成功!");
  console.log(`\n连接器: ${connector.displayName} (ID: ${connector.id})`);
  console.log(`剩余 ${filteredOperations.length} 个执行动作:`);
  filteredOperations.forEach((op, index) => {
    console.log(`  ${index + 1}. ${op.operationId}: ${op.summary}`);
  });
}

module.exports = { run };
