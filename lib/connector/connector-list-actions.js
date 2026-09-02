/**
 * connector list-actions - 列出连接器的执行动作
 *
 * 用法：openyida connector list-actions <connector-id>
 */

'use strict';
const { fail } = require('../core/chalk');
const { safeJsonStringify } = require('../core/redact');

const { getAuthRef, printTable, findConnectorById, getConnectorDetail } = require('./api');

function showUsage() {
  console.log(`
用法: openyida connector list-actions <connector-id>

示例:
  openyida connector list-actions 910244
`);
}

async function run(args) {
  if (!args || args.length < 1 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    process.exit(0);
  }

  const json = args.includes('--json');
  const connectorId = args.find(arg => !arg.startsWith('--'));
  const authRef = getAuthRef();

  console.log('🔍 正在获取连接器动作列表...\n');
  console.log(`连接器 ID: ${connectorId}\n`);

  const connector = await findConnectorById(connectorId, authRef);
  if (!connector) {
    fail('未找到该连接器');
    process.exit(1);
  }

  const detail = await getConnectorDetail(connector.connectorName, authRef);

  let actions = [];
  if (detail.operations) {
    try {
      actions = JSON.parse(detail.operations);
    } catch (e) {
      console.log('⚠️  解析动作列表失败');
    }
  }

  if (actions.length === 0) {
    if (json) {
      const result = { success: true, connectorId, operations: [] };
      console.log(safeJsonStringify(result, 0));
      return result;
    }
    console.log('📭 暂无执行动作');
    console.log('\n💡 创建动作:');
    console.log(`   openyida connector add-action --connector-id ${connectorId} --operations ./operation.json`);
    return;
  }

  console.log(`✅ 找到 ${actions.length} 个执行动作\n`);

  const headers = ['ID', '名称', '方法', '路径', '描述'];
  const rows = actions.map(action => [
    action.operationId || action.id || '-',
    action.summary || action.name || '-',
    action.method?.toUpperCase() || '-',
    action.url || action.path || '-',
    action.description
      ? action.description.length > 20
        ? action.description.substring(0, 20) + '...'
        : action.description
      : '-',
  ]);

  printTable(headers, rows);
  const result = { success: true, connectorId, operations: actions };
  if (json) {
    console.log(safeJsonStringify(result, 0));
  }
  return result;
}

module.exports = { run };
