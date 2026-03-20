/**
 * connector add-action - 添加执行动作到已有连接器
 *
 * 用法：openyida connector add-action --operations <file> [选项]
 *
 * 选项:
 *   --operations <file>    执行动作配置文件 (JSON 格式，必填)
 *   --connector-id <id>    直接指定连接器 ID
 *   --host <host>          目标域名 (可选，用于筛选)
 *   --confirm              确认执行（不加此参数时仅展示预览）
 */

"use strict";

const fs = require("fs");
const {
  getAuthRef,
  printTable,
  buildConnectorDesc,
  listConnectors,
  findConnectorById,
  getConnectorDetail,
  saveConnector,
} = require("./connector/api");

function showUsage() {
  console.log(`
用法: openyida connector add-action --operations <file> [选项]

选项:
  --operations <file>    执行动作配置文件 (JSON 格式，必填)
  --connector-id <id>    直接指定连接器 ID
  --host <host>          目标域名 (可选，用于筛选匹配的连接器)
  --confirm              确认执行（不加此参数时仅展示预览）

示例:
  openyida connector add-action --operations ./new-action.json
  openyida connector add-action --operations ./new-action.json --host api.dingtalk.com
  openyida connector add-action --operations ./new-action.json --connector-id 910244 --confirm
`);
}

function parseArgs(args) {
  const options = {
    operationsFile: null,
    hostFilter: null,
    connectorId: null,
    confirm: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        showUsage();
        process.exit(0);
        break;
      case "--operations":
        options.operationsFile = args[++i];
        break;
      case "--host":
        options.hostFilter = args[++i];
        break;
      case "--connector-id":
        options.connectorId = args[++i];
        break;
      case "--confirm":
        options.confirm = true;
        break;
    }
  }

  return options;
}

async function run(args) {
  if (!args || args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (!options.operationsFile) {
    console.error("❌ 请提供 --operations 参数");
    process.exit(1);
  }

  const authRef = getAuthRef();

  console.log("🔧 添加执行动作到连接器\n");

  // 读取执行动作配置
  let newOperations;
  try {
    const opsContent = fs.readFileSync(options.operationsFile, "utf-8");
    newOperations = JSON.parse(opsContent);
    if (!Array.isArray(newOperations)) {
      newOperations = [newOperations];
    }
    console.log(`✓ 已加载 ${newOperations.length} 个执行动作`);
    newOperations.forEach((operation, index) => {
      console.log(`  [${index + 1}] ${operation.operationId}: ${operation.summary}`);
    });
    console.log();
  } catch (e) {
    console.error(`❌ 读取执行动作配置文件失败: ${e.message}`);
    process.exit(1);
  }

  // 智能匹配或直接指定连接器
  let targetConnector = null;

  if (options.connectorId) {
    // 直接指定连接器
    const connector = await findConnectorById(options.connectorId, authRef);
    if (!connector) {
      console.error(`❌ 未找到连接器 ID: ${options.connectorId}`);
      process.exit(1);
    }

    const detail = await getConnectorDetail(connector.connectorName, authRef);
    targetConnector = { ...connector, detail };

    const existingOps = JSON.parse(targetConnector.detail.operations || "[]");
    console.log("📋 即将追加到以下连接器:");
    console.log(`   名称: ${targetConnector.displayName}`);
    console.log(`   ID: ${targetConnector.id}`);
    console.log(`   域名: ${targetConnector.detail.host}`);
    console.log(`   当前动作数: ${existingOps.length}`);
    console.log(`   新增动作数: ${newOperations.length}`);
    console.log();

    if (!options.confirm) {
      console.log("⚠️  请确认是否继续追加？如需继续请添加 --confirm 参数:");
      console.log(`   openyida connector add-action --operations ${options.operationsFile} --connector-id ${options.connectorId} --confirm`);
      return;
    }
  } else {
    // 智能匹配
    console.log("🔍 正在查找匹配的连接器...\n");
    const { connectors } = await listConnectors({ pageSize: 100 }, authRef);

    // 按 host 过滤
    const matching = options.hostFilter
      ? connectors.filter(c => c.host === options.hostFilter)
      : connectors;

    if (matching.length === 0) {
      console.log("📭 未找到匹配的连接器");
      console.log("\n💡 建议: 使用 openyida connector create 创建新连接器");
      process.exit(1);
    }

    console.log(`✅ 找到 ${matching.length} 个连接器:\n`);
    const headers = ["序号", "ID", "名称", "域名"];
    const rows = matching.map((connector, index) => [index + 1, connector.id, connector.displayName, connector.host || "-"]);
    printTable(headers, rows);

    console.log("\n💡 请使用 --connector-id 参数指定要更新的连接器:");
    console.log(`   openyida connector add-action --operations ${options.operationsFile} --connector-id ${matching[0].id}`);
    return;
  }

  // 合并执行动作
  const existingOperations = JSON.parse(targetConnector.detail.operations || "[]");
  const existingIds = new Set(existingOperations.map(op => op.operationId));
  const duplicates = newOperations.filter(op => existingIds.has(op.operationId));

  if (duplicates.length > 0) {
    console.log("⚠️  警告: 以下动作 ID 已存在，将被覆盖:");
    duplicates.forEach(op => console.log(`   - ${op.operationId}`));
    console.log();
  }

  const mergedOperations = [
    ...existingOperations.filter(op => !newOperations.find(newOp => newOp.operationId === op.operationId)),
    ...newOperations,
  ];

  console.log(`✓ 合并后动作总数: ${mergedOperations.length}\n`);

  const updatedDesc = buildConnectorDesc(null, targetConnector.detail.connectorDesc, authRef, mergedOperations);

  await saveConnector({
    operations: JSON.stringify(mergedOperations),
    displayName: targetConnector.detail.displayName,
    iconUrl: targetConnector.detail.iconUrl || "chaxun%%#FFA200",
    connectorDesc: updatedDesc,
    host: targetConnector.detail.host,
    baseUrl: targetConnector.detail.baseUrl || "/",
    scheme: targetConnector.detail.scheme || "https",
    tongxunluTemplateId: targetConnector.detail.tongxunluTemplateId || "",
    faasTemplateId: targetConnector.detail.faasTemplateId || "0",
    securitySchemes: targetConnector.detail.securitySchemes || "{}",
    connectorMode: "5",
    id: targetConnector.id,
    connectorName: targetConnector.connectorName,
    category: "http",
  }, authRef);

  console.log("✅ 执行动作添加成功!");
  console.log(`\n连接器: ${targetConnector.displayName} (ID: ${targetConnector.id})`);
  console.log(`现在共有 ${mergedOperations.length} 个执行动作`);

  console.log("\n执行动作列表:");
  mergedOperations.forEach((operation, index) => {
    const isNew = newOperations.find(newOp => newOp.operationId === operation.operationId);
    const marker = isNew ? " [新增]" : "";
    console.log(`  ${index + 1}. ${operation.operationId}: ${operation.summary}${marker}`);
  });
}

module.exports = { run };
