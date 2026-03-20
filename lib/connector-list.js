/**
 * connector list - 列出宜搭 HTTP 连接器
 *
 * 用法：openyida connector list [选项]
 *   --keyword <keyword>    按显示名称关键字过滤
 *   --type <type>          连接器类型: mine(我创建的), manager(全部) (默认: mine)
 *   --start-date <date>    创建开始日期 (格式: YYYY-MM-DD)
 *   --end-date <date>      创建结束日期 (格式: YYYY-MM-DD)
 *   --page-size <number>   每页数量 (默认: 100)
 */

"use strict";

const { getAuthRef, printTable, listConnectors } = require("./connector/api");

function showUsage() {
  console.log(`
用法: openyida connector list [选项]

选项:
  --keyword <keyword>    按显示名称关键字过滤
  --type <type>          连接器类型: mine(我创建的), manager(全部) (默认: mine)
  --start-date <date>    创建开始日期 (格式: YYYY-MM-DD)
  --end-date <date>      创建结束日期 (格式: YYYY-MM-DD)
  --page-size <number>   每页数量 (默认: 100)

示例:
  openyida connector list
  openyida connector list --keyword "测试"
  openyida connector list --type manager
  openyida connector list --start-date 2026-03-01 --end-date 2026-03-31
`);
}

function parseArgs(args) {
  const options = {
    keyword: "",
    type: "mine",
    startDate: "",
    endDate: "",
    pageSize: 100,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        showUsage();
        process.exit(0);
        break;
      case "--keyword":
        options.keyword = args[++i];
        break;
      case "--type":
        options.type = args[++i];
        break;
      case "--start-date":
        options.startDate = args[++i];
        break;
      case "--end-date":
        options.endDate = args[++i];
        break;
      case "--page-size":
        options.pageSize = parseInt(args[++i]) || 100;
        break;
    }
  }

  return options;
}

async function run(args) {
  const options = parseArgs(args || []);
  const authRef = getAuthRef();

  console.log("🔍 正在获取连接器列表...\n");

  if (options.keyword) console.log(`关键字: ${options.keyword}`);
  if (options.type) console.log(`类型: ${options.type}`);
  if (options.startDate) console.log(`开始日期: ${options.startDate}`);
  if (options.endDate) console.log(`结束日期: ${options.endDate}`);

  const { connectors, total } = await listConnectors(options, authRef);

  if (connectors.length === 0) {
    console.log("📭 暂无连接器");
    return;
  }

  console.log(`✅ 找到 ${total || connectors.length} 个连接器\n`);

  const headers = ["ID", "显示名称", "连接器名", "描述", "创建人"];
  const rows = connectors.map(connector => [
    connector.id || "-",
    connector.displayName || "-",
    connector.connectorName || "-",
    connector.connectorDesc
      ? connector.connectorDesc.length > 15
        ? connector.connectorDesc.substring(0, 15) + "..."
        : connector.connectorDesc
      : "-",
    connector.creator || "-",
  ]);

  printTable(headers, rows);

  console.log("\n💡 提示: 使用以下命令查看详情:");
  console.log("   openyida connector detail <connector-id>");
}

module.exports = { run };
